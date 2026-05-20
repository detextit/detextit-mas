import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import postgres from 'postgres'

dotenv.config({ path: '.env.local', quiet: true })

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL environment variable is not set')
  process.exit(1)
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const sql = postgres(process.env.DATABASE_URL, { max: 1 })
const files = process.argv.slice(2)

if (files.length === 0) {
  console.error('Usage: node scripts/run-sql.mjs <migration.sql> [...]')
  process.exit(1)
}

async function resolveSqlFile(name) {
  const candidates = [
    path.resolve(process.cwd(), name),
    path.resolve(__dirname, name),
    path.resolve(__dirname, 'sql', name),
  ]

  for (const candidate of candidates) {
    try {
      await fs.access(candidate)
      return candidate
    } catch {
      // Try the next location.
    }
  }

  throw new Error(`SQL file not found: ${name}`)
}

try {
  for (const file of files) {
    const resolved = await resolveSqlFile(file)
    const statement = await fs.readFile(resolved, 'utf8')
    await sql.unsafe(statement)
    console.log(`Applied ${path.relative(process.cwd(), resolved)}`)
  }
} finally {
  await sql.end()
}
