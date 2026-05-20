import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import { Player, ApiResponse } from '@/lib/types'
import { requireRole, requireSelfOrRole, isAuthResponse } from '@/lib/auth-helpers'

// GET /api/players/[id] - Get player by ID (self or admin)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const auth = await requireSelfOrRole(request, id, ['admin'])
    if (isAuthResponse(auth)) return auth

    const result = await sql`SELECT id, username, email, credits, total_market_value, total_spent, created_at, updated_at FROM players WHERE id = ${id}`

    if (result.length === 0) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Player not found'
      }, { status: 404 })
    }

    return NextResponse.json<ApiResponse<Player>>({
      success: true,
      data: result[0] as Player
    })
  } catch (error) {
    console.error('Error fetching player:', error)
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: 'Failed to fetch player'
    }, { status: 500 })
  }
}

// PATCH /api/players/[id] - Update player credits (admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRole(request, ['admin'])
    if (isAuthResponse(auth)) return auth

    const { id } = await params
    const body = await request.json()
    const { credits } = body

    if (credits === undefined) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Credits value is required'
      }, { status: 400 })
    }

    const result = await sql`
      UPDATE players 
      SET credits = ${credits}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `

    if (result.length === 0) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Player not found'
      }, { status: 404 })
    }

    return NextResponse.json<ApiResponse<Player>>({
      success: true,
      data: result[0] as Player
    })
  } catch (error) {
    console.error('Error updating player:', error)
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: 'Failed to update player'
    }, { status: 500 })
  }
}
