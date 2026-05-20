import dotenv from 'dotenv'
import postgres from 'postgres'
import { createHash, randomBytes } from 'node:crypto'

dotenv.config({ path: '.env.local', quiet: true })

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL environment variable is not set')
  process.exit(1)
}

const sql = postgres(process.env.DATABASE_URL, { max: 1 })

function createApiKey() {
  return `hg_${randomBytes(24).toString('hex')}`
}

function hashApiKey(apiKey) {
  return createHash('sha256').update(apiKey).digest('hex')
}

const email = process.env.HAGGLE_SERVICE_EMAIL || 'service@haggle.local'
const username = process.env.HAGGLE_SERVICE_USERNAME || 'service_agent'
const apiKey = createApiKey()

try {
  const result = await sql`
    INSERT INTO players (username, email, api_key_hash, role, credits)
    VALUES (${username}, ${email}, ${hashApiKey(apiKey)}, 'service', 500.00)
    ON CONFLICT (email) DO UPDATE
    SET api_key_hash = EXCLUDED.api_key_hash,
        role = 'service',
        updated_at = NOW()
    RETURNING id, username, role
  `

  console.log(`Seeded ${result[0].role} account ${result[0].username} (${result[0].id})`)
  console.log(`API key: ${apiKey}`)
} finally {
  await sql.end()
}
