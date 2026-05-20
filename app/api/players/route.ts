import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import { createApiKey, hashApiKey } from '@/lib/security'
import { Player, PlayerWithKey, CreatePlayerInput, ApiResponse } from '@/lib/types'
import { randomBytes } from 'crypto'
import { requireRole, isAuthResponse } from '@/lib/auth-helpers'

// GET /api/players - List all players (admin only — exposes emails)
export async function GET(request: NextRequest) {
  try {
    const auth = await requireRole(request, ['admin'])
    if (isAuthResponse(auth)) return auth

    const { searchParams } = new URL(request.url)
    const username = searchParams.get('username')
    const email = searchParams.get('email')

    let players

    if (username) {
      players = await sql`SELECT id, username, email, credits, total_market_value, total_spent, created_at, updated_at FROM players WHERE username = ${username}`
    } else if (email) {
      players = await sql`SELECT id, username, email, credits, total_market_value, total_spent, created_at, updated_at FROM players WHERE email = ${email}`
    } else {
      players = await sql`SELECT id, username, email, credits, total_market_value, total_spent, created_at, updated_at FROM players ORDER BY created_at DESC`
    }

    return NextResponse.json<ApiResponse<Player[]>>({
      success: true,
      data: [...players] as Player[]
    })
  } catch (error) {
    console.error('Error fetching players:', error)
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: 'Failed to fetch players'
    }, { status: 500 })
  }
}

// POST /api/players - Register a new player (public, no auth required)
export async function POST(request: NextRequest) {
  try {
    const body: CreatePlayerInput = await request.json()
    const { email } = body

    if (!email || !email.includes('@')) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'A valid email is required'
      }, { status: 400 })
    }

    // Check if player already exists with this email
    const existing = await sql`
      SELECT id FROM players WHERE email = ${email}
    `

    if (existing.length > 0) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'An account with this email already exists. Please sign in instead.'
      }, { status: 409 })
    }

    // Auto-generate username from email prefix
    const baseUsername = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 40)
    const usernameConflict = await sql`SELECT id FROM players WHERE username = ${baseUsername}`
    const username = usernameConflict.length > 0
      ? `${baseUsername}_${randomBytes(2).toString('hex')}`
      : baseUsername

    // Generate API key, store only the hash
    const apiKey = createApiKey()
    const apiKeyHash = hashApiKey(apiKey)

    const result = await sql`
      INSERT INTO players (username, email, api_key_hash, credits)
      VALUES (${username}, ${email}, ${apiKeyHash}, 500.00)
      RETURNING id, username, email, credits, total_market_value, total_spent, created_at, updated_at
    `

    // Return player data + plaintext key (shown once, never stored server-side)
    return NextResponse.json<ApiResponse<PlayerWithKey>>({
      success: true,
      data: { ...(result[0] as Player), api_key: apiKey }
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating player:', error)
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: 'Failed to create player'
    }, { status: 500 })
  }
}
