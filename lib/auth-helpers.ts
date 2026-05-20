import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient, currentUser } from '@clerk/nextjs/server'
import { randomBytes } from 'crypto'
import sql from './db'
import { ApiResponse } from './types'

export type Role = 'player' | 'admin' | 'service'
export type AuthType = 'api_key' | 'clerk'

export interface AuthContext {
  playerId: string
  username: string
  role: Role
  authType: AuthType
  clerkUserId?: string
}

export async function getAuthContext(request: NextRequest): Promise<AuthContext | null> {
  const playerId = request.headers.get('x-player-id')
  const username = request.headers.get('x-player-username')
  const role = (request.headers.get('x-player-role') || 'player') as Role
  if (playerId && username) return { playerId, username, role, authType: 'api_key' }

  const clerkAuth = await auth()
  if (!clerkAuth.userId) return null

  return ensureClerkPlayer(clerkAuth.userId)
}

export function forbidden(message = 'Forbidden') {
  return NextResponse.json<ApiResponse<null>>(
    { success: false, error: message },
    { status: 403 }
  )
}

export function unauthorized(message = 'Unauthorized') {
  return NextResponse.json<ApiResponse<null>>(
    { success: false, error: message },
    { status: 401 }
  )
}

export async function requireRole(
  request: NextRequest,
  roles: Role[]
): Promise<AuthContext | NextResponse> {
  const ctx = await getAuthContext(request)
  if (!ctx) return unauthorized()
  if (!roles.includes(ctx.role)) return forbidden()
  return ctx
}

export async function requireSelfOrRole(
  request: NextRequest,
  targetPlayerId: string,
  roles: Role[] = ['admin']
): Promise<AuthContext | NextResponse> {
  const ctx = await getAuthContext(request)
  if (!ctx) return unauthorized()
  if (ctx.playerId === targetPlayerId) return ctx
  if (roles.includes(ctx.role)) return ctx
  return forbidden()
}

export function isAuthResponse(
  value: AuthContext | NextResponse
): value is NextResponse {
  return value instanceof NextResponse
}

function usernameFromEmail(email: string): string {
  const base = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_')
  return base.slice(0, 40) || `player_${randomBytes(2).toString('hex')}`
}

async function uniqueUsername(baseUsername: string): Promise<string> {
  const existing = await sql`SELECT id FROM players WHERE username = ${baseUsername}`
  if (existing.length === 0) return baseUsername
  return `${baseUsername.slice(0, 35)}_${randomBytes(2).toString('hex')}`
}

async function mirrorPlayerIdToClerk(clerkUserId: string, playerId: string) {
  try {
    const client = await clerkClient()
    await client.users.updateUserMetadata(clerkUserId, {
      privateMetadata: { hagglePlayerId: playerId },
    })
  } catch (error) {
    console.warn('Unable to update Clerk user metadata:', error)
  }
}

async function ensureClerkPlayer(clerkUserId: string): Promise<AuthContext | null> {
  const byClerkId = await sql`
    SELECT id, username, role, clerk_user_id
    FROM players
    WHERE clerk_user_id = ${clerkUserId}
  `

  if (byClerkId.length > 0) {
    const player = byClerkId[0]
    return {
      playerId: player.id,
      username: player.username,
      role: (player.role || 'player') as Role,
      authType: 'clerk',
      clerkUserId,
    }
  }

  const user = await currentUser()
  if (!user) return null

  const email =
    user.primaryEmailAddress?.emailAddress ||
    user.emailAddresses[0]?.emailAddress ||
    `${clerkUserId}@clerk.local`
  const displayName = user.username || user.fullName || usernameFromEmail(email)

  const byEmail = await sql`
    SELECT id, username, role, clerk_user_id
    FROM players
    WHERE email = ${email}
  `

  if (byEmail.length > 0) {
    const existing = byEmail[0]
    if (!existing.clerk_user_id) {
      await sql`
        UPDATE players
        SET clerk_user_id = ${clerkUserId}, updated_at = NOW()
        WHERE id = ${existing.id}
      `
    }
    await mirrorPlayerIdToClerk(clerkUserId, existing.id)
    return {
      playerId: existing.id,
      username: existing.username,
      role: (existing.role || 'player') as Role,
      authType: 'clerk',
      clerkUserId,
    }
  }

  const baseUsername = displayName.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 40) || usernameFromEmail(email)
  const username = await uniqueUsername(baseUsername)
  const result = await sql`
    INSERT INTO players (username, email, clerk_user_id, credits)
    VALUES (${username}, ${email}, ${clerkUserId}, 500.00)
    RETURNING id, username, role
  `

  const player = result[0]
  await mirrorPlayerIdToClerk(clerkUserId, player.id)

  return {
    playerId: player.id,
    username: player.username,
    role: (player.role || 'player') as Role,
    authType: 'clerk',
    clerkUserId,
  }
}
