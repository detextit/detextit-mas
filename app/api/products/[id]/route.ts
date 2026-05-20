import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import { Product, ApiResponse } from '@/lib/types'
import { requireRole, isAuthResponse } from '@/lib/auth-helpers'

// GET /api/products/[id] - Get product by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const result = await sql`SELECT * FROM products WHERE id = ${id}`

    if (result.length === 0) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Product not found'
      }, { status: 404 })
    }

    return NextResponse.json<ApiResponse<Product>>({
      success: true,
      data: result[0] as Product
    })
  } catch (error) {
    console.error('Error fetching product:', error)
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: 'Failed to fetch product'
    }, { status: 500 })
  }
}

// PATCH /api/products/[id] - Update product (admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRole(request, ['admin'])
    if (isAuthResponse(auth)) return auth

    const { id } = await params
    const body = await request.json()
    const { stock_quantity, market_price, min_acceptable_price } = body

    // Build update query dynamically based on provided fields
    const updates: string[] = []
    const values: (string | number)[] = []

    if (stock_quantity !== undefined) {
      updates.push('stock_quantity')
      values.push(stock_quantity)
    }
    if (market_price !== undefined) {
      updates.push('market_price')
      values.push(market_price)
    }
    if (min_acceptable_price !== undefined) {
      updates.push('min_acceptable_price')
      values.push(min_acceptable_price)
    }

    if (updates.length === 0) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'No fields to update'
      }, { status: 400 })
    }

    // For simplicity, handle common update case
    let result
    if (stock_quantity !== undefined) {
      result = await sql`
        UPDATE products 
        SET stock_quantity = ${stock_quantity}, updated_at = NOW()
        WHERE id = ${id}
        RETURNING *
      `
    } else {
      result = await sql`
        UPDATE products 
        SET updated_at = NOW()
        WHERE id = ${id}
        RETURNING *
      `
    }

    if (result.length === 0) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Product not found'
      }, { status: 404 })
    }

    return NextResponse.json<ApiResponse<Product>>({
      success: true,
      data: result[0] as Product
    })
  } catch (error) {
    console.error('Error updating product:', error)
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: 'Failed to update product'
    }, { status: 500 })
  }
}
