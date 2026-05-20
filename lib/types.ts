// Player types
export interface Player {
  id: string
  username: string
  email: string
  credits: number
  total_market_value: number
  total_spent: number
  created_at: string
  updated_at: string
}

/** Returned only once at registration — includes the plaintext API key */
export interface PlayerWithKey extends Player {
  api_key: string
}

export interface CreatePlayerInput {
  email: string
}

// Product types
export interface Product {
  id: string
  name: string
  description: string | null
  image_url: string | null
  market_price: number
  min_acceptable_price: number
  category: string | null
  stock_quantity: number
  seller_personality: string | null
  created_at: string
  updated_at: string
}

// Haggle types
export type HaggleStatus = 'active' | 'accepted' | 'rejected' | 'abandoned' | 'expired'
export type MessageSender = 'player' | 'seller'

export interface HaggleSession {
  id: string
  player_id: string
  product_id: string
  status: HaggleStatus
  current_offer: number | null
  ai_counter_offer: number | null
  rounds_count: number
  max_rounds: number
  started_at: string
  ended_at: string | null
  final_price: number | null
}

export interface HaggleSessionWithProduct extends HaggleSession {
  product: Product
}

export interface HaggleMessage {
  id: string
  session_id: string
  sender: MessageSender
  message: string
  offer_amount: number | null
  created_at: string
}

export interface StartHaggleInput {
  product_id: string
}

export interface MakeOfferInput {
  session_id: string
  message: string
}

// Seller Negotiation types
export interface SellerNegotiationResponse {
  action: 'counter' | 'accept' | 'reject'
  counter_offer?: number
  message: string
}

// Transaction types
export type TransactionStatus = 'pending' | 'completed' | 'cancelled' | 'refunded'

export interface Transaction {
  id: string
  player_id: string
  session_id: string | null
  product_id: string
  quantity: number
  market_price: number
  final_price: number
  savings: number
  status: TransactionStatus
  created_at: string
}

export interface TransactionWithProduct extends Transaction {
  product: Product
}

// Leaderboard types
// Public fields only — totals/savings are omitted to prevent reverse-engineering
// which products a player bought from a small catalog.
export interface LeaderboardEntry {
  id: string
  username: string
  score: number
  items_purchased: number
  rank?: number
}

// API Response types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}
