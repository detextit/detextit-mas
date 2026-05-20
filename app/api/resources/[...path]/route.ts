import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const segments = (await params).path
  const filePath = path.join(process.cwd(), 'content', 'resources', ...segments)

  if (!filePath.endsWith('.md') || filePath.includes('..')) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let content: string
  try {
    content = await readFile(filePath, 'utf-8')
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const proto = request.headers.get('x-forwarded-proto') || 'http'
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'localhost:3000'
  const baseUrl = `${proto}://${host}`

  content = content.replaceAll('{{BASE_URL}}', baseUrl)

  return new NextResponse(content, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  })
}
