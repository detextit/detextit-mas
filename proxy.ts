import { NextRequest, NextResponse } from 'next/server'
import { clerkMiddleware } from '@clerk/nextjs/server'

const PUBLIC_RULES: { path: string; methods: string[] }[] = [
  { path: '/api/players/signin', methods: ['POST'] },
  { path: '/api/players', methods: ['POST'] },
  { path: '/api/products', methods: ['GET'] },
  { path: '/api/leaderboard', methods: ['GET'] },
  { path: '/api/auth/validate', methods: ['POST'] },
]

function isPublicRoute(pathname: string, method: string): boolean {
  return PUBLIC_RULES.some(
    rule => pathname.startsWith(rule.path) && rule.methods.includes(method)
  )
}

function sanitizedRequestHeaders(request: NextRequest): Headers {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.delete('x-player-id')
  requestHeaders.delete('x-player-username')
  requestHeaders.delete('x-player-role')
  return requestHeaders
}

async function authenticateApiKey(request: NextRequest) {
  const { pathname } = request.nextUrl
  const method = request.method
  const requestHeaders = sanitizedRequestHeaders(request)

  if (isPublicRoute(pathname, method)) {
    return NextResponse.next({
      request: { headers: requestHeaders },
    })
  }

  const authHeader = request.headers.get('authorization')

  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    return NextResponse.next({
      request: { headers: requestHeaders },
    })
  }

  const token = authHeader.slice(7).trim()

  if (!token) {
    return NextResponse.json(
      { success: false, error: 'Bearer token is empty' },
      { status: 401 }
    )
  }

  try {
    const validateUrl = new URL('/api/auth/validate', request.url)
    const validateResponse = await fetch(validateUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })

    const result = await validateResponse.json()

    if (!result.valid) {
      return NextResponse.json(
        { success: false, error: 'Invalid API key' },
        { status: 401 }
      )
    }

    requestHeaders.set('x-player-id', result.id)
    requestHeaders.set('x-player-username', result.username)
    requestHeaders.set('x-player-role', result.role || 'player')

    return NextResponse.next({
      request: { headers: requestHeaders },
    })
  } catch (error) {
    console.error('Auth middleware error:', error)
    return NextResponse.json(
      { success: false, error: 'Authentication failed' },
      { status: 500 }
    )
  }
}

export default clerkMiddleware(async (_auth, request: NextRequest) => {
  return authenticateApiKey(request)
})

export const config = {
  matcher: '/api/:path*',
}
