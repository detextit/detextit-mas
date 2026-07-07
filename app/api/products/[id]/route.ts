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

// PATCH /api/products/[id] - Update product (admin/service only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRole(request, ['admin', 'service'])
    if (isAuthResponse(auth)) return auth

    const { id } = await params
    const body = await request.json()
    const { stock_quantity, market_price, min_acceptable_price } = body

    const stockQuantity = stock_quantity === undefined ? null : Number(stock_quantity)
    const marketPrice = market_price === undefined ? null : Number(market_price)
    const minAcceptablePrice = min_acceptable_price === undefined ? null : Number(min_acceptable_price)

    if (stockQuantity === null && marketPrice === null && minAcceptablePrice === null) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'No fields to update'
      }, { status: 400 })
    }

    if (
      (stockQuantity !== null && (!Number.isInteger(stockQuantity) || stockQuantity < 0)) ||
      (marketPrice !== null && (!Number.isFinite(marketPrice) || marketPrice <= 0)) ||
      (minAcceptablePrice !== null && (!Number.isFinite(minAcceptablePrice) || minAcceptablePrice <= 0))
    ) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Invalid product update values'
      }, { status: 400 })
    }

    const result = await sql`
      UPDATE products 
      SET stock_quantity = COALESCE(${stockQuantity}, stock_quantity),
          market_price = COALESCE(${marketPrice}, market_price),
          min_acceptable_price = COALESCE(${minAcceptablePrice}, min_acceptable_price),
          updated_at = NOW()
      WHERE id = ${id}
        AND COALESCE(${minAcceptablePrice}, min_acceptable_price) < COALESCE(${marketPrice}, market_price)
      RETURNING *
    `

    if (result.length === 0) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Product not found or invalid price bounds'
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
