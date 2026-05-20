import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import { createHash } from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json()
    if (!token) {
      return NextResponse.json({ valid: false }, { status: 400 })
    }

    const tokenHash = createHash('sha256').update(token).digest('hex')
    const result = await sql`SELECT id, username, role FROM players WHERE api_key_hash = ${tokenHash}`

    if (result.length === 0) {
      return NextResponse.json({ valid: false })
    }

    return NextResponse.json({
      valid: true,
      id: result[0].id,
      username: result[0].username,
      role: result[0].role,
    })
  } catch {
    return NextResponse.json({ valid: false }, { status: 500 })
  }
}
