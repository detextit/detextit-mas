import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import { HaggleSession, MakeOfferInput, ApiResponse, Product, SellerNegotiationResponse } from '@/lib/types'
import { getAuthContext, forbidden, unauthorized } from '@/lib/auth-helpers'
import { runSellerNegotiation, SellerMessageHistoryItem } from '@/assistant/seller-agent'

export const runtime = 'nodejs'
export const maxDuration = 300

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
              ai_counter_offer = ${acceptedPrice}
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
      }
    } else if (sellerResponse.action === 'reject' || newRoundsCount >= Number(session.max_rounds)) {
      const result = await sql`
        UPDATE haggle_sessions
        SET status = ${newRoundsCount >= Number(session.max_rounds) ? 'expired' : 'rejected'},
            ended_at = NOW()
        WHERE id = ${session_id}
        RETURNING *
      `
      updatedSession = result[0] as HaggleSession
    } else {
      const result = await sql`
        UPDATE haggle_sessions
        SET ai_counter_offer = ${sellerResponse.counter_offer ?? null}
        WHERE id = ${session_id}
        RETURNING *
      `
      updatedSession = result[0] as HaggleSession
    }

    return NextResponse.json<ApiResponse<{
      session: HaggleSession
      seller_response: SellerNegotiationResponse
      product: Product
    }>>({
      success: true,
      data: {
        session: updatedSession,
        seller_response: sellerResponse,
        product
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
}: {
  sessionId: string
  playerId: string
  product: Product
  buyerMessage: string
  roundCount: number
}): Promise<SellerNegotiationResponse | null> {
  try {
    const history = await sql<SellerMessageHistoryItem[]>`
      SELECT sender, message, offer_amount, created_at
      FROM haggle_messages
      WHERE session_id = ${sessionId}
      ORDER BY created_at ASC
    `

    const data = await runSellerNegotiation({
      sessionId,
      playerId,
      product,
      buyerMessage,
      roundCount,
      history,
    })

    return {
      action: data.action,
      counter_offer: data.counter_offer,
      message: data.message,
    }
  } catch (error) {
    console.error('Seller agent failed:', error)
  }

  return null
}
