import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import { HaggleSession, MakeOfferInput, ApiResponse, Product, SellerNegotiationResponse } from '@/lib/types'
import { getAuthContext, forbidden, unauthorized } from '@/lib/auth-helpers'
import { runSellerNegotiation, SellerAgentState, SellerInventoryUpdate, SellerMessageHistoryItem } from '@/assistant/seller-agent'

export const runtime = 'nodejs'
export const maxDuration = 300

type SellerResponseWithAgentState = SellerNegotiationResponse & {
  seller_agent_state?: SellerAgentState | null
  inventory_update?: SellerInventoryUpdate
}

type SqlJsonValue = Parameters<typeof sql.json>[0]

function publicSession<T extends HaggleSession>(session: T): HaggleSession {
  const { seller_agent_state: _sellerAgentState, ...safeSession } = session
  return safeSession as HaggleSession
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext(request)
    if (!auth) return unauthorized()

    const body: MakeOfferInput = await request.json()
    const { session_id, message } = body

    if (!session_id) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'session_id is required'
      }, { status: 400 })
    }

    if (!message) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'message is required'
      }, { status: 400 })
    }

    const sessionResult = await sql`
      SELECT * FROM haggle_sessions WHERE id = ${session_id}
    `

    if (sessionResult.length === 0) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Session not found'
      }, { status: 404 })
    }

    const session = sessionResult[0]

    if (session.player_id !== auth.playerId && auth.role !== 'admin') {
      return forbidden('You do not own this session')
    }

    if (session.status !== 'active') {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Session is no longer active'
      }, { status: 400 })
    }

    const [productResult, playerResult] = await Promise.all([
      sql`SELECT * FROM products WHERE id = ${session.product_id}`,
      sql`SELECT id, credits, total_market_value, total_spent FROM players WHERE id = ${session.player_id}`,
    ])
    const product = productResult[0] as Product
    const player = playerResult[0]

    await sql`
      INSERT INTO haggle_messages (session_id, sender, message)
      VALUES (${session_id}, 'player', ${message})
    `

    const newRoundsCount = Number(session.rounds_count) + 1
    await sql`
      UPDATE haggle_sessions
      SET rounds_count = ${newRoundsCount}
      WHERE id = ${session_id}
    `

    const sellerResponse = await getSellerNegotiationResponse({
      sessionId: session_id,
      playerId: session.player_id,
      product,
      buyerMessage: message,
      roundCount: newRoundsCount,
      sellerAgentState: session.seller_agent_state ?? null,
    })

    if (!sellerResponse) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'The seller is currently unavailable. Please try again later.'
      }, { status: 503 })
    }

    await sql`
      INSERT INTO haggle_messages (session_id, sender, message, offer_amount)
      VALUES (${session_id}, 'seller', ${sellerResponse.message}, ${sellerResponse.counter_offer ?? null})
    `

    let updatedSession: HaggleSession
    let responseProduct = product
    const nextSellerAgentState = sellerResponse.seller_agent_state ?? null

    if (sellerResponse.action === 'accept') {
      const acceptedPrice = sellerResponse.counter_offer ?? 0

      if (Number(player.credits) < acceptedPrice) {
        return NextResponse.json<ApiResponse<null>>({
          success: false,
          error: 'Insufficient credits to complete this purchase'
        }, { status: 400 })
      }

      const newCredits = Number(player.credits) - acceptedPrice
      const newTotalMarketValue = Number(player.total_market_value || 0) + Number(product.market_price)
      const newTotalSpent = Number(player.total_spent || 0) + acceptedPrice

      await sql.begin(tx => [
        tx`
          UPDATE haggle_sessions
          SET status = 'accepted',
              final_price = ${acceptedPrice},
              ended_at = NOW(),
              ai_counter_offer = ${acceptedPrice},
              seller_agent_state = NULL
          WHERE id = ${session_id}
        `,
        tx`
          INSERT INTO transactions (player_id, session_id, product_id, quantity, market_price, final_price, status)
          VALUES (${session.player_id}, ${session_id}, ${session.product_id}, 1, ${product.market_price}, ${acceptedPrice}, 'completed')
        `,
        tx`
          UPDATE players
          SET credits = ${newCredits},
              total_market_value = ${newTotalMarketValue},
              total_spent = ${newTotalSpent},
              updated_at = NOW()
          WHERE id = ${session.player_id}
        `,
        tx`
          UPDATE products
          SET stock_quantity = stock_quantity - 1,
              updated_at = NOW()
          WHERE id = ${session.product_id}
        `,
      ])

      updatedSession = {
        ...session as HaggleSession,
        status: 'accepted',
        final_price: acceptedPrice,
        ended_at: new Date().toISOString(),
        ai_counter_offer: acceptedPrice,
        seller_agent_state: null,
      }
    } else if (sellerResponse.action === 'reject' || newRoundsCount >= Number(session.max_rounds)) {
      const result = await sql`
        UPDATE haggle_sessions
        SET status = ${newRoundsCount >= Number(session.max_rounds) ? 'expired' : 'rejected'},
            ended_at = NOW(),
            seller_agent_state = NULL
        WHERE id = ${session_id}
        RETURNING *
      `
      updatedSession = result[0] as HaggleSession
    } else {
      const result = await sql`
        UPDATE haggle_sessions
        SET ai_counter_offer = ${sellerResponse.counter_offer ?? null},
            seller_agent_state = ${nextSellerAgentState ? sql.json(nextSellerAgentState as unknown as SqlJsonValue) : null}
        WHERE id = ${session_id}
        RETURNING *
      `
      updatedSession = result[0] as HaggleSession
    }

    const inventoryUpdatedProduct = await applySellerInventoryUpdate(sellerResponse.inventory_update, product)
    if (inventoryUpdatedProduct) {
      responseProduct = inventoryUpdatedProduct
    }

    return NextResponse.json<ApiResponse<{
      session: HaggleSession
      seller_response: SellerNegotiationResponse
      product: Product
    }>>({
      success: true,
      data: {
        session: publicSession(updatedSession),
        seller_response: {
          action: sellerResponse.action,
          counter_offer: sellerResponse.counter_offer,
          message: sellerResponse.message,
        },
        product: responseProduct
      }
    })
  } catch (error) {
    console.error('Error processing offer:', error)
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: 'Failed to process offer'
    }, { status: 500 })
  }
}

async function getSellerNegotiationResponse({
  sessionId,
  playerId,
  product,
  buyerMessage,
  roundCount,
  sellerAgentState,
}: {
  sessionId: string
  playerId: string
  product: Product
  buyerMessage: string
  roundCount: number
  sellerAgentState?: SellerAgentState | null
}): Promise<SellerResponseWithAgentState | null> {
  try {
    const [history, catalog] = await Promise.all([
      sql<SellerMessageHistoryItem[]>`
        SELECT sender, message, offer_amount, created_at
        FROM haggle_messages
        WHERE session_id = ${sessionId}
        ORDER BY created_at ASC
      `,
      sql<Product[]>`
        SELECT *
        FROM products
        ORDER BY name ASC
      `,
    ])

    const data = await runSellerNegotiation({
      sessionId,
      playerId,
      product,
      catalog,
      buyerMessage,
      roundCount,
      history,
      sellerAgentState,
    })

    return {
      action: data.action,
      counter_offer: data.counter_offer,
      message: data.message,
      seller_agent_state: data.seller_agent_state,
      inventory_update: data.inventory_update,
    }
  } catch (error) {
    console.error('Seller agent failed:', error)
  }

  return null
}

function boundedNumber(value: number | undefined): number | null {
  if (value === undefined || value === null || !Number.isFinite(value)) return null
  return Math.round(value * 100) / 100
}

function sameProduct(update: SellerInventoryUpdate, product: Product): boolean {
  if (update.product_id && update.product_id === product.id) return true
  if (update.product_name && update.product_name.toLowerCase() === product.name.toLowerCase()) return true
  return !update.product_id && !update.product_name
}

async function applySellerInventoryUpdate(
  update: SellerInventoryUpdate | undefined,
  product: Product
): Promise<Product | null> {
  if (!update || process.env.SELLER_AGENT_INVENTORY_UPDATES === 'false') return null
  if (!sameProduct(update, product)) return null

  if (update.type === 'promotion_note') {
    console.info('Seller promotion note:', {
      product_id: product.id,
      note: update.note,
      reason: update.reason,
    })
    return null
  }

  if (update.type === 'stock_adjustment') {
    const requestedStockQuantity = update.stock_quantity
    if (
      typeof requestedStockQuantity !== 'number' ||
      !Number.isInteger(requestedStockQuantity) ||
      requestedStockQuantity < 0
    ) return null

    const currentStock = Number(product.stock_quantity)
    const maxDelta = Math.max(5, Math.ceil(currentStock * 0.25))
    if (Math.abs(requestedStockQuantity - currentStock) > maxDelta) return null

    const result = await sql`
      UPDATE products
      SET stock_quantity = ${requestedStockQuantity},
          updated_at = NOW()
      WHERE id = ${product.id}
      RETURNING *
    `
    return (result[0] as Product) || null
  }

  const currentMarket = Number(product.market_price)
  const currentFloor = Number(product.min_acceptable_price)
  const marketPrice = boundedNumber(update.market_price) ?? currentMarket
  const minAcceptablePrice = boundedNumber(update.min_acceptable_price) ?? currentFloor
  const maxPriceMove = currentMarket * 0.10

  if (marketPrice <= 0 || minAcceptablePrice <= 0) return null
  if (Math.abs(marketPrice - currentMarket) > maxPriceMove) return null
  if (minAcceptablePrice >= marketPrice) return null
  if (minAcceptablePrice < marketPrice * 0.45) return null
  if (minAcceptablePrice > marketPrice * 0.95) return null

  const result = await sql`
    UPDATE products
    SET market_price = ${marketPrice},
        min_acceptable_price = ${minAcceptablePrice},
        updated_at = NOW()
    WHERE id = ${product.id}
    RETURNING *
  `

  return (result[0] as Product) || null
}
