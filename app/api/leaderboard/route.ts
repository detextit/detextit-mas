import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import { ApiResponse, LeaderboardEntry } from '@/lib/types'

// GET /api/leaderboard - Get leaderboard rankings
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')

    // Public leaderboard intentionally omits total_market_value, total_spent,
    // and total_savings — with a small catalog, those fields can be
    // reverse-engineered to identify which products a player bought.
    const leaderboard = await sql`
      SELECT
        id,
        username,
        score,
        items_purchased
      FROM leaderboard
      WHERE total_spent > 0
      ORDER BY score DESC
      LIMIT ${limit}
    `

    // Add rank to each entry
    const rankedLeaderboard = leaderboard.map((entry, index) => ({
      ...entry,
      rank: index + 1
    }))

    return NextResponse.json<ApiResponse<LeaderboardEntry[]>>({
      success: true,
      data: rankedLeaderboard as unknown as LeaderboardEntry[]
    })
  } catch (error) {
    console.error('Error fetching leaderboard:', error)
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: 'Failed to fetch leaderboard'
    }, { status: 500 })
  }
}
