import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import { ApiResponse } from '@/lib/types'
import { requireSelfOrRole, isAuthResponse } from '@/lib/auth-helpers'

interface PlayerStats {
  player_id: string
  username: string
  credits: number
  total_market_value: number
  total_spent: number
  score: number
  rank: number
  total_transactions: number
  total_savings: number
  active_sessions: number
  completed_sessions: number
  best_deal_percentage: number | null
}

// GET /api/players/[id]/stats - Get player statistics (self or admin)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const auth = await requireSelfOrRole(request, id, ['admin'])
    if (isAuthResponse(auth)) return auth

    // Get player basic info
    const playerResult = await sql`SELECT id, username, email, credits, total_market_value, total_spent, created_at, updated_at FROM players WHERE id = ${id}`

    if (playerResult.length === 0) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Player not found'
      }, { status: 404 })
    }

    const player = playerResult[0]

    // Calculate score
    const score = Number(player.total_spent) > 0 
      ? Number(player.total_market_value) / Number(player.total_spent)
      : 0

    // Get player rank
    const rankResult = await sql`
      SELECT COUNT(*) + 1 as rank
      FROM leaderboard
      WHERE score > ${score}
    `
    const rank = Number(rankResult[0].rank)

    // Get transaction stats
    const transactionStats = await sql`
      SELECT 
        COUNT(*) as total_transactions,
        COALESCE(SUM(savings), 0) as total_savings,
        COALESCE(MAX((market_price - final_price) / market_price * 100), 0) as best_deal_percentage
      FROM transactions
      WHERE player_id = ${id} AND status = 'completed'
    `

    // Get session counts
    const sessionStats = await sql`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'active') as active_sessions,
        COUNT(*) FILTER (WHERE status IN ('accepted', 'rejected', 'abandoned', 'expired')) as completed_sessions
      FROM haggle_sessions
      WHERE player_id = ${id}
    `

    const stats: PlayerStats = {
      player_id: player.id,
      username: player.username,
      credits: Number(player.credits),
      total_market_value: Number(player.total_market_value),
      total_spent: Number(player.total_spent),
      score: Math.round(score * 100) / 100,
      rank,
      total_transactions: Number(transactionStats[0].total_transactions),
      total_savings: Number(transactionStats[0].total_savings),
      active_sessions: Number(sessionStats[0].active_sessions),
      completed_sessions: Number(sessionStats[0].completed_sessions),
      best_deal_percentage: transactionStats[0].best_deal_percentage 
        ? Math.round(Number(transactionStats[0].best_deal_percentage) * 100) / 100 
        : null
    }

    return NextResponse.json<ApiResponse<PlayerStats>>({
      success: true,
      data: stats
    })
  } catch (error) {
    console.error('Error fetching player stats:', error)
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: 'Failed to fetch player stats'
    }, { status: 500 })
  }
}
