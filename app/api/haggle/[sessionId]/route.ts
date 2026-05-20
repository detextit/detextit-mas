import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import { ApiResponse, HaggleSession, HaggleMessage, Product } from '@/lib/types'
import { getAuthContext, forbidden, unauthorized } from '@/lib/auth-helpers'

// GET /api/haggle/[sessionId] - Get session details with messages
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const auth = await getAuthContext(request)
    if (!auth) return unauthorized()

    const { sessionId } = await params

    // Get session
    const sessionResult = await sql`
      SELECT * FROM haggle_sessions WHERE id = ${sessionId}
    `

    if (sessionResult.length === 0) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Session not found'
      }, { status: 404 })
    }

    const session = sessionResult[0] as HaggleSession

    if (session.player_id !== auth.playerId && auth.role !== 'admin') {
      return forbidden('You do not own this session')
    }

    // Get product
    const productResult = await sql`
      SELECT * FROM products WHERE id = ${session.product_id}
    `
    const product = productResult[0] as Product

    // Get messages
    const messages = await sql`
      SELECT * FROM haggle_messages 
      WHERE session_id = ${sessionId}
      ORDER BY created_at ASC
    `

    return NextResponse.json<ApiResponse<{
      session: HaggleSession
      product: Product
      messages: HaggleMessage[]
    }>>({
      success: true,
      data: {
        session,
        product,
        messages: [...messages] as HaggleMessage[]
      }
    })
  } catch (error) {
    console.error('Error fetching session:', error)
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: 'Failed to fetch session'
    }, { status: 500 })
  }
}
