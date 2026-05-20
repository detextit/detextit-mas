import { randomBytes, createHash } from "crypto"

const API_KEY_PREFIX = "hg_"

export function createApiKey(): string {
  return `${API_KEY_PREFIX}${randomBytes(24).toString("hex")}`
}

export function hashApiKey(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex")
}

export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null
  const [type, token] = authHeader.split(" ")
  if (type !== "Bearer" || !token) return null
  return token.trim()
}
