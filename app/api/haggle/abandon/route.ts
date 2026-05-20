import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import { ApiResponse, HaggleSession } from '@/lib/types'
import { getAuthContext, forbidden, unauthorized } from '@/lib/auth-helpers'

const AGENT_URL = process.env.AGENT_URL || 'http://localhost:8000'

// POST /api/haggle/abandon - Abandon a haggle session
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

    // Get the session
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

    // Update session to abandoned
    const updatedSession = await sql`
      UPDATE haggle_sessions 
      SET status = 'abandoned', 
          ended_at = NOW()
      WHERE id = ${session_id}
      RETURNING *
    `

    await sql`
      INSERT INTO haggle_messages (session_id, sender, message)
      VALUES (${session_id}, 'player', 'I''ve decided to walk away from this deal.')
    `

    fetch(`${AGENT_URL}/end-session`, { method: 'POST' }).catch(() => {})

    return NextResponse.json<ApiResponse<HaggleSession>>({
      success: true,
      data: updatedSession[0] as HaggleSession
    })
  } catch (error) {
    console.error('Error abandoning session:', error)
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: 'Failed to abandon session'
    }, { status: 500 })
  }
}
