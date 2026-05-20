import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import { ApiResponse, Product } from '@/lib/types'
import { requireRole, isAuthResponse } from '@/lib/auth-helpers'

interface InventorySummary {
  total_products: number
  total_stock: number
  in_stock_products: number
  out_of_stock_products: number
  categories: {
    name: string
    count: number
    total_stock: number
  }[]
  products: Product[]
}

// GET /api/inventory - Get inventory summary (admin or service)
export async function GET(request: NextRequest) {
  try {
    const auth = await requireRole(request, ['admin', 'service'])
    if (isAuthResponse(auth)) return auth

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')

    // Get all products
    let results
    if (category) {
      results = await sql`
        SELECT * FROM products
        WHERE category = ${category}
        ORDER BY name ASC
      `
    } else {
      results = await sql`
        SELECT * FROM products
        ORDER BY name ASC
      `
    }
    const products = [...results] as Product[]

    // Calculate summary stats
    const totalProducts = products.length
    const totalStock = products.reduce((sum, p) => sum + Number(p.stock_quantity), 0)
    const inStockProducts = products.filter(p => Number(p.stock_quantity) > 0).length
    const outOfStockProducts = totalProducts - inStockProducts

    // Get category breakdown
    const categoryStats = await sql`
      SELECT 
        category as name,
        COUNT(*) as count,
        SUM(stock_quantity) as total_stock
      FROM products
      WHERE category IS NOT NULL
      GROUP BY category
      ORDER BY category
    `

    const summary: InventorySummary = {
      total_products: totalProducts,
      total_stock: totalStock,
      in_stock_products: inStockProducts,
      out_of_stock_products: outOfStockProducts,
      categories: categoryStats.map(c => ({
        name: c.name as string,
        count: Number(c.count),
        total_stock: Number(c.total_stock)
      })),
      products
    }

    return NextResponse.json<ApiResponse<InventorySummary>>({
      success: true,
      data: summary
    })
  } catch (error) {
    console.error('Error fetching inventory:', error)
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: 'Failed to fetch inventory'
    }, { status: 500 })
  }
}

// PATCH /api/inventory - Bulk update stock (admin only)
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireRole(request, ['admin'])
    if (isAuthResponse(auth)) return auth

    const body = await request.json()
    const { updates } = body // Array of { product_id, stock_quantity }

    if (!updates || !Array.isArray(updates)) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'updates array is required'
      }, { status: 400 })
    }

    // Update each product
    const results = []
    for (const update of updates) {
      const result = await sql`
        UPDATE products 
        SET stock_quantity = ${update.stock_quantity}, updated_at = NOW()
        WHERE id = ${update.product_id}
        RETURNING *
      `
      if (result.length > 0) {
        results.push(result[0])
      }
    }

    return NextResponse.json<ApiResponse<Product[]>>({
      success: true,
      data: results as unknown as Product[]
    })
  } catch (error) {
    console.error('Error updating inventory:', error)
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: 'Failed to update inventory'
    }, { status: 500 })
  }
}
