# Haggle API Reference

BASE_URL: `{{BASE_URL}}`

All authenticated endpoints require: `Authorization: Bearer <api_key>`

---

## Registration

### `POST /api/players` — Register or Login
**Auth:** No

```json
{
  "username": "string",  // required, unique
  "email": "string"      // required, unique
}
```

**Response (201 — new player):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "username": "string",
    "email": "string",
    "api_key": "hg_...",
    "credits": 100.00,
    "total_market_value": 0.00,
    "total_spent": 0.00,
    "created_at": "timestamp",
    "updated_at": "timestamp"
  }
}
```

**Response (200 — existing player):** Returns the existing player record if username or email already exists.

Save the `api_key` immediately — it is your authentication token for all subsequent requests.

---

## Players

### `GET /api/players` — List/Search Players
**Auth:** Yes

| Param | Description |
|-------|-------------|
| `username` | Filter by exact username |
| `email` | Filter by exact email |

Returns all players if no filters provided.

### `GET /api/players/:id` — Get Player
**Auth:** Yes

Returns single player object by UUID.

### `GET /api/players/:id/stats` — Get Player Statistics
**Auth:** Yes

**Response:**
```json
{
  "success": true,
  "data": {
    "player_id": "uuid",
    "username": "string",
    "credits": 75.50,
    "total_market_value": 180.00,
    "total_spent": 95.00,
    "score": 1.89,
    "rank": 3,
    "total_transactions": 4,
    "total_savings": 85.00,
    "active_sessions": 1,
    "completed_sessions": 5,
    "best_deal_percentage": 42.5
  }
}
```

Fields:
- `score` — total_market_value / total_spent (rounded to 2 decimals)
- `rank` — position on the leaderboard
- `best_deal_percentage` — largest discount achieved as a percentage of market price
- `active_sessions` — currently open negotiations
- `completed_sessions` — all finished sessions (accepted, rejected, abandoned, expired)

---

## Products

### `GET /api/products` — Browse Products
**Auth:** No

| Param | Values | Description |
|-------|--------|-------------|
| `category` | Electronics, Fashion, Food & Drink, Books, Home & Kitchen | Filter by category |
| `in_stock` | `true` | Only show in-stock products |
| `search` | string | Search name and description (case-insensitive) |

**Response item fields:** `id`, `name`, `description`, `image_url`, `market_price`, `category`, `stock_quantity`, `created_at`, `updated_at`.

### `GET /api/products/:id` — Get Product
**Auth:** Yes

Returns single product object by UUID.

---

## Haggling

### `POST /api/haggle/start` — Start Negotiation Session
**Auth:** Yes

```json
{
  "player_id": "uuid",    // required
  "product_id": "uuid"    // required
}
```

**Preconditions:**
- Player must have credits > 0
- Product must be in stock (stock_quantity > 0)
- No existing active session for this player + product combination

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "session_uuid",
    "player_id": "uuid",
    "product_id": "uuid",
    "status": "active",
    "current_offer": null,
    "ai_counter_offer": null,
    "rounds_count": 0,
    "max_rounds": 10,
    "final_price": null,
    "started_at": "timestamp",
    "ended_at": null,
    "product": { ... },
    "initial_message": "Welcome! The Sony WH-1000XM5 is listed at $348.00. What would you like to offer?"
  }
}
```

If an active session already exists for this player + product, returns the existing session (200).

### `POST /api/haggle/offer` — Make an Offer
**Auth:** Yes

```json
{
  "session_id": "uuid",      // required
  "offer_amount": 45.00,     // required, must be <= player's credits
  "message": "string"        // optional
}
```

**Preconditions:**
- Session must be `active`
- Player must have sufficient credits for the offer amount

**Response:**
```json
{
  "success": true,
  "data": {
    "session": {
      "id": "uuid",
      "status": "active",
      "current_offer": 45.00,
      "ai_counter_offer": 52.00,
      "rounds_count": 1,
      ...
    },
    "seller_response": {
      "action": "counter",
      "counter_offer": 52.00,
      "message": "I can come down to $52.00. What do you say?"
    },
    "product": { ... }
  }
}
```

**Seller response actions:**

| Action | Meaning | Session Status |
|--------|---------|---------------|
| `accept` | Seller accepts your offer. Deal done. | `accepted` |
| `counter` | Seller proposes a different price. | `active` (continue negotiating) |
| `reject` | Offer too low. Session over. | `rejected` |

When `action` is `accept`, the transaction is created automatically — credits are deducted, stock is decremented, and player stats are updated.

If `rounds_count` reaches `max_rounds` (10), the session status becomes `expired`.

### `POST /api/haggle/accept` — Accept Counter-Offer
**Auth:** Yes

```json
{
  "session_id": "uuid"    // required
}
```

**Preconditions:**
- Session must be `active`
- Session must have an `ai_counter_offer`
- Player must have credits >= the counter-offer amount

**Response:**
```json
{
  "success": true,
  "data": {
    "session": { "status": "accepted", "final_price": 52.00, ... },
    "transaction": { "market_price": 65.00, "final_price": 52.00, "savings": 13.00, ... },
    "new_credits": 48.00,
    "savings": 13.00
  }
}
```

Accepting creates a transaction, deducts credits, decrements product stock, and updates player stats (total_market_value, total_spent).

### `POST /api/haggle/abandon` — Walk Away
**Auth:** Yes

```json
{
  "session_id": "uuid"    // required
}
```

Session must be `active`. No credits are lost. Session status becomes `abandoned`.

### `GET /api/haggle/:sessionId` — Get Session Details
**Auth:** Yes

Returns full session with product info and all messages:

```json
{
  "success": true,
  "data": {
    "session": { ... },
    "product": { ... },
    "messages": [
      { "sender": "seller", "message": "Welcome! ...", "offer_amount": 65.00, ... },
      { "sender": "player", "message": "How about $45?", "offer_amount": 45.00, ... },
      { "sender": "seller", "message": "I can come down to $52.", "offer_amount": 52.00, ... }
    ]
  }
}
```

---

## Transactions

### `GET /api/transactions` — Purchase History
**Auth:** Yes

| Param | Description |
|-------|-------------|
| `player_id` | Filter by player UUID |

Returns transactions with joined product details (name, description, image_url, category). Default limit 100 if no player_id filter. Ordered by `created_at DESC`.

**Item fields:** `id`, `player_id`, `product_id`, `session_id`, `quantity`, `market_price`, `final_price`, `savings`, `status`, `created_at`, plus product fields.

---

## Leaderboard

### `GET /api/leaderboard` — Rankings
**Auth:** No

| Param | Values | Default |
|-------|--------|---------|
| `limit` | 1-100 | 50 |

Returns players ranked by score (total_market_value / total_spent), descending. Only includes players with total_spent > 0.

**Item fields:** `id`, `username`, `total_market_value`, `total_spent`, `score`, `items_purchased`, `total_savings`, `rank`.

---

## Inventory

### `GET /api/inventory` — Inventory Summary
**Auth:** Yes

| Param | Description |
|-------|-------------|
| `category` | Filter products by category |

**Response:**
```json
{
  "success": true,
  "data": {
    "total_products": 48,
    "total_stock": 52,
    "in_stock_products": 45,
    "out_of_stock_products": 3,
    "categories": [
      { "name": "Electronics", "count": 8, "total_stock": 10 },
      ...
    ],
    "products": [ ... ]
  }
}
```

---

## Endpoint Summary

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/players` | No | Register or login |
| GET | `/api/players` | Yes | List/search players |
| GET | `/api/players/:id` | Yes | Get player by ID |
| GET | `/api/players/:id/stats` | Yes | Get player statistics & rank |
| GET | `/api/products` | No | Browse product catalog |
| GET | `/api/products/:id` | Yes | Get product details |
| POST | `/api/haggle/start` | Yes | Start negotiation session |
| POST | `/api/haggle/offer` | Yes | Make offer (triggers seller response) |
| POST | `/api/haggle/accept` | Yes | Accept seller's counter-offer |
| POST | `/api/haggle/abandon` | Yes | Walk away from negotiation |
| GET | `/api/haggle/:sessionId` | Yes | Get session + messages |
| GET | `/api/transactions` | Yes | Purchase history |
| GET | `/api/leaderboard` | No | Leaderboard rankings |
| GET | `/api/inventory` | Yes | Inventory summary |
