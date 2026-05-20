import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import { HaggleSession, ApiResponse, Product } from '@/lib/types'
import { getAuthContext } from '@/lib/auth-helpers'

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext(request)
    if (!auth) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 })
    }

    const body = await request.json()
    const { product_id } = body
    const player_id = auth.playerId

    if (!product_id) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'product_id is required'
      }, { status: 400 })
    }

    const [player, product] = await Promise.all([
      sql`SELECT id, credits FROM players WHERE id = ${player_id}`,
      sql`SELECT * FROM products WHERE id = ${product_id}`,
    ])

    if (player.length === 0) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Player not found'
      }, { status: 404 })
    }

    if (Number(player[0].credits) <= 0) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Insufficient credits to haggle'
      }, { status: 400 })
    }

    if (product.length === 0) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Product not found'
      }, { status: 404 })
    }

    if (product[0].stock_quantity <= 0) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Product is out of stock'
      }, { status: 400 })
    }

    const existingSession = await sql`
      SELECT * FROM haggle_sessions
      WHERE player_id = ${player_id}
      AND product_id = ${product_id}
      AND status = 'active'
    `

    if (existingSession.length > 0) {
      return NextResponse.json<ApiResponse<HaggleSession & { product: Product }>>({
        success: true,
        data: {
          ...(existingSession[0] as HaggleSession),
          product: product[0] as Product
        }
      })
    }

    const session = await sql`
      INSERT INTO haggle_sessions (player_id, product_id, status, rounds_count, max_rounds)
      VALUES (${player_id}, ${product_id}, 'active', 0, 10)
      RETURNING *
    `

    const productData = product[0] as Product

    return NextResponse.json<ApiResponse<HaggleSession & { product: Product }>>({
      success: true,
      data: {
        ...(session[0] as HaggleSession),
        product: productData,
      }
    }, { status: 201 })
  } catch (error) {
    console.error('Error starting haggle session:', error)
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: 'Failed to start haggle session'
    }, { status: 500 })
  }
}
