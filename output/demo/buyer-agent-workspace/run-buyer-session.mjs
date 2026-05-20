import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const workspaceDir = process.cwd()
const baseUrl = process.env.HAGGLE_BASE_URL || 'http://localhost:3000'
const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)
const preferredEmail = 'demo_buyer@example.com'
const fallbackEmail = `demo_buyer_${timestamp}@example.com`

const artifactsDir = join(workspaceDir, 'artifacts')
await mkdir(artifactsDir, { recursive: true })

const transcript = []
const add = (line = '') => transcript.push(line)

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options)
  const text = await response.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = null
  }

  if (!response.ok) {
    const error = new Error(`${options.method || 'GET'} ${path} failed with ${response.status}: ${text}`)
    error.status = response.status
    error.body = json || text
    throw error
  }

  return json
}

async function publicPost(path, payload) {
  return request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

async function authed(path, apiKey, options = {}) {
  return request(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...(options.headers || {}),
    },
  })
}

async function registerBuyer() {
  try {
    return await publicPost('/api/players', { email: preferredEmail })
  } catch (error) {
    if (error.status !== 409) throw error
    add(`Preferred demo email already exists; using ${fallbackEmail}.`)
    return publicPost('/api/players', { email: fallbackEmail })
  }
}

function requireSuccess(label, payload) {
  if (!payload?.success) {
    throw new Error(`${label} did not return success=true`)
  }
  return payload.data
}

function pickProduct(products) {
  const preferred = products.find((product) => product.name === 'Apple AirPods Pro 2')
  return preferred || products.find((product) => Number(product.stock_quantity) > 0)
}

add('# Demo Buyer Terminal Session')
add('')
add(`Base URL: ${baseUrl}`)
add(`Started: ${new Date().toISOString()}`)
add('')

add('## Fetch platform skill')
const skillResponse = await fetch(`${baseUrl}/resources/skill.md`)
const skillText = await skillResponse.text()
await writeFile(join(workspaceDir, 'skill.md'), skillText)
add(`Downloaded skill.md (${skillText.length} bytes).`)
add('')

add('## Register buyer')
const buyer = requireSuccess('register buyer', await registerBuyer())
await writeFile(
  join(workspaceDir, '.env.local'),
  `HAGGLE_BASE_URL=${baseUrl}\nHAGGLE_PLAYER_ID=${buyer.id}\nHAGGLE_API_KEY=${buyer.api_key}\n`
)
add(`Registered buyer username=${buyer.username} id=${buyer.id}.`)
add('')

add('## Select product')
const products = requireSuccess('products', await request('/api/products?in_stock=true'))
const product = pickProduct(products)
if (!product) throw new Error('No in-stock product found.')
const beforeStock = Number(product.stock_quantity)
await writeFile(join(artifactsDir, 'product-before.json'), JSON.stringify(product, null, 2))
add(`Selected ${product.name}: market=$${product.market_price}, stock=${beforeStock}.`)
add('')

add('## Start negotiation')
const started = requireSuccess(
  'start negotiation',
  await authed('/api/haggle/start', buyer.api_key, {
    method: 'POST',
    body: JSON.stringify({ product_id: product.id }),
  })
)
await writeFile(join(artifactsDir, 'session-start.json'), JSON.stringify(started, null, 2))
add(`Started haggle session ${started.id}.`)
add('')

add('## Make buyer offer')
const openingOffer = Math.max(1, Math.floor(Number(product.market_price) * 0.6))
const offerResponse = requireSuccess(
  'make offer',
  await authed('/api/haggle/offer', buyer.api_key, {
    method: 'POST',
    body: JSON.stringify({
      session_id: started.id,
      message: `demo_buyer can pay $${openingOffer} today if you can move quickly.`,
    }),
  })
)
await writeFile(join(artifactsDir, 'offer-response.json'), JSON.stringify(offerResponse, null, 2))
add(`Seller action=${offerResponse.seller_response.action}; counter=${offerResponse.seller_response.counter_offer}.`)
add(`Seller said: ${offerResponse.seller_response.message}`)
add('')

add('## Accept seller counter')
const accepted = requireSuccess(
  'accept counter',
  await authed('/api/haggle/accept', buyer.api_key, {
    method: 'POST',
    body: JSON.stringify({ session_id: started.id }),
  })
)
await writeFile(join(artifactsDir, 'accept-response.json'), JSON.stringify(accepted, null, 2))
add(`Accepted final price=$${accepted.session.final_price}; new credits=$${accepted.new_credits}.`)
add('')

add('## Verify transaction')
const transactions = requireSuccess(
  'transactions',
  await authed(`/api/transactions?player_id=${buyer.id}`, buyer.api_key)
)
await writeFile(join(artifactsDir, 'transactions.json'), JSON.stringify(transactions, null, 2))
const matchingTransaction = transactions.find((transaction) => transaction.session_id === started.id)
if (!matchingTransaction) throw new Error('No transaction recorded for accepted haggle session.')
add(`Transaction recorded id=${matchingTransaction.id}; status=${matchingTransaction.status}.`)
add('')

add('## Verify inventory')
const afterProduct = requireSuccess('product after', await request(`/api/products/${product.id}`))
await writeFile(join(artifactsDir, 'product-after.json'), JSON.stringify(afterProduct, null, 2))
const afterStock = Number(afterProduct.stock_quantity)
if (afterStock !== beforeStock - 1) {
  throw new Error(`Inventory did not decrement by 1. before=${beforeStock}, after=${afterStock}`)
}
add(`Inventory decremented: ${beforeStock} -> ${afterStock}.`)
add('')

add('## Verify leaderboard')
const leaderboard = requireSuccess('leaderboard', await request('/api/leaderboard?limit=50'))
await writeFile(join(artifactsDir, 'leaderboard.json'), JSON.stringify(leaderboard, null, 2))
const standing = leaderboard.find((entry) => entry.id === buyer.id)
if (!standing) throw new Error('Buyer was not present on leaderboard after purchase.')
add(`Leaderboard standing: rank=${standing.rank}, score=${standing.score}, items=${standing.items_purchased}.`)
add('')

add('## Result')
add('Full buyer/seller flow completed successfully.')
add(`Finished: ${new Date().toISOString()}`)

const summary = {
  baseUrl,
  buyer: {
    id: buyer.id,
    username: buyer.username,
    email: buyer.email,
  },
  product: {
    id: product.id,
    name: product.name,
    stock_before: beforeStock,
    stock_after: afterStock,
  },
  session: {
    id: started.id,
    final_price: accepted.session.final_price,
    status: accepted.session.status,
  },
  transaction: {
    id: matchingTransaction.id,
    status: matchingTransaction.status,
  },
  leaderboard: standing,
}

await writeFile(join(workspaceDir, 'transcript.md'), transcript.join('\n'))
await writeFile(join(workspaceDir, 'summary.json'), JSON.stringify(summary, null, 2))

console.log(transcript.join('\n'))
