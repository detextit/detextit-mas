import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import { Product, ApiResponse } from '@/lib/types'
import { requireRole, isAuthResponse } from '@/lib/auth-helpers'

// GET /api/products - List all products with optional filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const inStock = searchParams.get('in_stock')
    const search = searchParams.get('search')

    let results

    if (category && inStock === 'true') {
      results = await sql`
        SELECT * FROM products
        WHERE category = ${category} AND stock_quantity > 0
        ORDER BY created_at DESC
      `
    } else if (category) {
      results = await sql`
        SELECT * FROM products
        WHERE category = ${category}
        ORDER BY created_at DESC
      `
    } else if (inStock === 'true') {
      results = await sql`
        SELECT * FROM products
        WHERE stock_quantity > 0
        ORDER BY created_at DESC
      `
    } else if (search) {
      results = await sql`
        SELECT * FROM products
        WHERE name ILIKE ${'%' + search + '%'} OR description ILIKE ${'%' + search + '%'}
        ORDER BY created_at DESC
      `
    } else {
      results = await sql`SELECT * FROM products ORDER BY created_at DESC`
    }

    const products = [...results] as Product[]

    return NextResponse.json<ApiResponse<Product[]>>({
      success: true,
      data: products
    })
  } catch (error) {
    console.error('Error fetching products:', error)
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: 'Failed to fetch products'
    }, { status: 500 })
  }
}

// POST /api/products - Create a new product (admin only)
export async function POST(request: NextRequest) {
  try {
    const auth = await requireRole(request, ['admin'])
    if (isAuthResponse(auth)) return auth

    const body = await request.json()
    const {
      name,
      description,
      image_url,
      market_price,
      min_acceptable_price,
      category,
      stock_quantity
    } = body

    if (!name || !market_price || !min_acceptable_price) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Name, market_price, and min_acceptable_price are required'
      }, { status: 400 })
    }

    const result = await sql`
      INSERT INTO products (name, description, image_url, market_price, min_acceptable_price, category, stock_quantity)
      VALUES (${name}, ${description || null}, ${image_url || null}, ${market_price}, ${min_acceptable_price}, ${category || null}, ${stock_quantity || 0})
      RETURNING *
    `

    return NextResponse.json<ApiResponse<Product>>({
      success: true,
      data: result[0] as Product
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating product:', error)
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: 'Failed to create product'
    }, { status: 500 })
  }
}
