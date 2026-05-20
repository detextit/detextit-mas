import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import { hashApiKey } from '@/lib/security'
import { Player, ApiResponse } from '@/lib/types'

// POST /api/players/signin - Sign in with email + API key
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, api_key } = body

    if (!email || !api_key) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Email and API key are required'
      }, { status: 400 })
    }

    const keyHash = hashApiKey(api_key)

    const result = await sql`
      SELECT id, username, email, credits, total_market_value, total_spent, created_at, updated_at
      FROM players
      WHERE email = ${email} AND api_key_hash = ${keyHash}
    `

    if (result.length === 0) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Invalid email or API key'
      }, { status: 401 })
    }

    return NextResponse.json<ApiResponse<Player>>({
      success: true,
      data: result[0] as Player
    })
  } catch (error) {
    console.error('Error signing in:', error)
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: 'Failed to sign in'
    }, { status: 500 })
  }
}
