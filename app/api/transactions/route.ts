import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import { ApiResponse, TransactionWithProduct } from '@/lib/types'
import { getAuthContext, unauthorized } from '@/lib/auth-helpers'

// GET /api/transactions
// - Players: see only their own (player_id query param is ignored)
// - Admin/service: can query across players or filter by player_id
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext(request)
    if (!auth) return unauthorized()

    const { searchParams } = new URL(request.url)
    const privileged = auth.role === 'admin' || auth.role === 'service'
    const filterPlayerId = privileged
      ? searchParams.get('player_id')
      : auth.playerId

    let transactions

    if (filterPlayerId) {
      transactions = await sql`
        SELECT
          t.*,
          p.name as product_name,
          p.description as product_description,
          p.image_url as product_image_url,
          p.category as product_category
        FROM transactions t
        JOIN products p ON t.product_id = p.id
        WHERE t.player_id = ${filterPlayerId}
        ORDER BY t.created_at DESC
      `
    } else {
      transactions = await sql`
        SELECT
          t.*,
          p.name as product_name,
          p.description as product_description,
          p.image_url as product_image_url,
          p.category as product_category
        FROM transactions t
        JOIN products p ON t.product_id = p.id
        ORDER BY t.created_at DESC
        LIMIT 100
      `
    }

    return NextResponse.json<ApiResponse<TransactionWithProduct[]>>({
      success: true,
      data: [...transactions] as TransactionWithProduct[]
    })
  } catch (error) {
    console.error('Error fetching transactions:', error)
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: 'Failed to fetch transactions'
    }, { status: 500 })
  }
}
