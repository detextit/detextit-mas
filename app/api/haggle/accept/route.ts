import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import { ApiResponse, HaggleSession } from '@/lib/types'
import { getAuthContext, forbidden, unauthorized } from '@/lib/auth-helpers'

const AGENT_URL = process.env.AGENT_URL || 'http://localhost:8000'

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext(request)
    if (!auth) return unauthorized()

    const body = await request.json()
    const { session_id } = body

    if (!session_id) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'session_id is required'
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

    if (!session.ai_counter_offer) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'No counter offer to accept'
      }, { status: 400 })
    }

    const acceptedPrice = Number(session.ai_counter_offer)

    const [playerResult, productResult] = await Promise.all([
      sql`SELECT id, credits, total_market_value, total_spent FROM players WHERE id = ${session.player_id}`,
      sql`SELECT * FROM products WHERE id = ${session.product_id}`,
    ])
    const player = playerResult[0]
    const product = productResult[0]

    if (Number(player.credits) < acceptedPrice) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Insufficient credits to accept this offer'
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
            ended_at = NOW()
        WHERE id = ${session_id}
      `,
      tx`
        INSERT INTO haggle_messages (session_id, sender, message, offer_amount)
        VALUES (${session_id}, 'player', ${`I accept your offer of $${acceptedPrice}!`}, ${acceptedPrice})
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

    const updatedSession: HaggleSession = {
      ...session as HaggleSession,
      status: 'accepted',
      final_price: acceptedPrice,
      ended_at: new Date().toISOString(),
    }

    fetch(`${AGENT_URL}/end-session`, { method: 'POST' }).catch(() => {})

    return NextResponse.json<ApiResponse<{
      session: HaggleSession
      new_credits: number
      savings: number
    }>>({
      success: true,
      data: {
        session: updatedSession,
        new_credits: newCredits,
        savings: Number(product.market_price) - acceptedPrice
      }
    })
  } catch (error) {
    console.error('Error accepting offer:', error)
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: 'Failed to accept offer'
    }, { status: 500 })
  }
}
