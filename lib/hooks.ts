import useSWR from 'swr'
import { Product, LeaderboardEntry, HaggleSession, HaggleMessage } from './types'

function getAuthHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  const apiKey = localStorage.getItem('haggle_api_key')
  if (!apiKey) return {}
  return { 'Authorization': `Bearer ${apiKey}` }
}

const fetcher = async (url: string) => {
  const res = await fetch(url, { headers: getAuthHeaders() })
  const data = await res.json()
  if (!data.success) {
    throw new Error(data.error || 'API error')
  }
  return data.data
}

// Products hooks
export function useProducts(category?: string) {
  const url = category
    ? `/api/products?category=${encodeURIComponent(category)}&in_stock=true`
    : '/api/products?in_stock=true'

  return useSWR<Product[]>(url, fetcher)
}

export function useProduct(id: string | null) {
  return useSWR<Product>(id ? `/api/products/${id}` : null, fetcher)
}

// Leaderboard hook
export function useLeaderboard(limit = 50) {
  return useSWR<LeaderboardEntry[]>(`/api/leaderboard?limit=${limit}`, fetcher, {
    refreshInterval: 30000
  })
}

// Player stats hook
export function usePlayerStats(playerId: string | null) {
  return useSWR(
    playerId ? `/api/players/${playerId}/stats` : null,
    fetcher,
    { refreshInterval: 60000 }
  )
}

// Haggle session hook
export function useHaggleSession(sessionId: string | null) {
  return useSWR<{
    session: HaggleSession
    product: Product
    messages: HaggleMessage[]
  }>(
    sessionId ? `/api/haggle/${sessionId}` : null,
    fetcher,
    { refreshInterval: 2000 }
  )
}

// Inventory hook
export function useInventory(category?: string) {
  const url = category
    ? `/api/inventory?category=${encodeURIComponent(category)}`
    : '/api/inventory'

  return useSWR(url, fetcher)
}

// Transactions hook
export function useTransactions(playerId: string | null) {
  return useSWR(
    playerId ? `/api/transactions?player_id=${playerId}` : null,
    fetcher
  )
}
