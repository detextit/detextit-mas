import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getAuthContext, unauthorized } from '@/lib/auth-helpers'
import { ApiResponse, Player } from '@/lib/types'

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext(request)
    if (!auth) return unauthorized()

    const result = await sql`
      SELECT id, username, email, credits, total_market_value, total_spent, created_at, updated_at
      FROM players
      WHERE id = ${auth.playerId}
    `

    if (result.length === 0) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Player not found',
      }, { status: 404 })
    }

    return NextResponse.json<ApiResponse<Player>>({
      success: true,
      data: result[0] as Player,
    })
  } catch (error) {
    console.error('Error fetching current player:', error)
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: 'Failed to fetch current player',
    }, { status: 500 })
  }
}
