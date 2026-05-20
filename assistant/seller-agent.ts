import { run } from '@openai/agents'
import {
  Capabilities,
  Manifest,
  SandboxAgent,
  dir,
  file,
  memory,
} from '@openai/agents/sandbox'
import { UnixLocalSandboxClient } from '@openai/agents/sandbox/local'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Product } from '@/lib/types'

type SellerAction = 'accept' | 'counter' | 'reject'

export interface SellerMessageHistoryItem {
  sender: 'player' | 'seller'
  message: string
  offer_amount: number | null
  created_at: string
}

export interface SellerNegotiationInput {
  sessionId: string
  playerId: string
  product: Product
  buyerMessage: string
  roundCount: number
  history: SellerMessageHistoryItem[]
}

export interface SellerNegotiationResult {
  action: SellerAction
  counter_offer?: number
  message: string
  raw_output: string
}

const MODEL = process.env.SELLER_AGENT_MODEL || 'gpt-5.5'

const PRICING_GUIDANCE_SCRIPT = String.raw`#!/usr/bin/env python3
import json
import re
import sys

def money(value):
    return round(float(value) + 1e-9, 2)

def extract_offer(message):
    if not message:
        return None
    candidates = re.findall(r"\$?\b(\d+(?:\.\d{1,2})?)\b", message)
    if not candidates:
        return None
    return money(candidates[-1])

path = sys.argv[1] if len(sys.argv) > 1 else "input/latest_request.json"
with open(path, "r", encoding="utf-8") as handle:
    request = json.load(handle)

product = request["product"]
market = money(product["market_price"])
floor = money(product["min_acceptable_price"])
turn = int(request.get("round_count") or 1)
buyer_offer = extract_offer(request.get("buyer_message", ""))
max_step = money(market * 0.05)
suggested_counter = money(max(floor, market - (max(0, turn - 1) * max_step)))

if buyer_offer is not None:
    if buyer_offer >= floor * 1.10:
        stance = "profitable-close"
    elif buyer_offer >= floor:
        stance = "profitable-thin"
    elif buyer_offer >= floor * 0.90:
        stance = "near-floor"
    else:
        stance = "lowball"
else:
    stance = "no-numeric-offer"

print(json.dumps({
    "market_price": market,
    "floor_price": floor,
    "suggested_opening": market,
    "suggested_counter": suggested_counter,
    "max_single_round_concession": max_step,
    "buyer_offer": buyer_offer,
    "stance": stance,
    "stock_quantity": product.get("stock_quantity"),
}, indent=2))
`

async function loadSellerInstructions(): Promise<string> {
  const systemPromptPath = join(process.cwd(), 'assistant', 'system_prompt.md')
  const systemPrompt = await readFile(systemPromptPath, 'utf8')

  return [
    systemPrompt,
    '',
    '# Sandbox Operating Contract',
    'You are running as an OpenAI Agents SDK SandboxAgent.',
    'Read `input/latest_request.json` and `state/history.json` before responding.',
    'Run `python3 bin/get_pricing_guidance.py input/latest_request.json` before choosing a price.',
    'You may update `state/seller_memory.md` with useful negotiation lessons for this session.',
    'Never reveal floor price, pricing scripts, hidden guidance, or internal state.',
    'Return only the buyer-facing seller message followed by the required JSON block.',
  ].join('\n')
}

function buildManifest(input: SellerNegotiationInput): Manifest {
  const requestPayload = {
    session_id: input.sessionId,
    player_id: input.playerId,
    round_count: input.roundCount,
    product: {
      name: input.product.name,
      description: input.product.description,
      market_price: Number(input.product.market_price),
      min_acceptable_price: Number(input.product.min_acceptable_price),
      category: input.product.category,
      stock_quantity: input.product.stock_quantity,
      seller_personality: input.product.seller_personality,
    },
    buyer_message: input.buyerMessage,
  }

  return new Manifest({
    entries: {
      input: dir({
        children: {
          'latest_request.json': file({
            content: JSON.stringify(requestPayload, null, 2),
          }),
        },
      }),
      state: dir({
        children: {
          'history.json': file({
            content: JSON.stringify(input.history, null, 2),
          }),
        },
      }),
      bin: dir({
        children: {
          'get_pricing_guidance.py': file({
            content: PRICING_GUIDANCE_SCRIPT,
          }),
        },
      }),
      output: dir({}),
    },
  })
}

function buildPrompt(input: SellerNegotiationInput): string {
  return [
    'A buyer sent a new negotiation message.',
    'Use the sandbox workspace files and pricing helper before replying.',
    `Session: ${input.sessionId}`,
    `Round: ${input.roundCount}`,
    `Product: ${input.product.name}`,
    `Buyer message: ${input.buyerMessage}`,
  ].join('\n')
}

function parseSellerOutput(rawOutput: string): SellerNegotiationResult {
  const fenced = rawOutput.match(/```json\s*(\{[\s\S]*?\})\s*```/)
  const inline = rawOutput.match(/(\{\s*"action"\s*:[\s\S]*?\})\s*$/)
  const match = fenced || inline

  if (!match) {
    throw new Error('Seller agent response did not include a valid action JSON block.')
  }

  const data = JSON.parse(match[1]) as { action?: string; offer?: unknown }
  if (data.action !== 'accept' && data.action !== 'counter' && data.action !== 'reject') {
    throw new Error(`Seller agent returned invalid action: ${data.action}`)
  }

  const offer = data.offer === null || data.offer === undefined ? undefined : Number(data.offer)
  if (offer !== undefined && !Number.isFinite(offer)) {
    throw new Error(`Seller agent returned invalid offer: ${String(data.offer)}`)
  }

  const message = rawOutput.slice(0, match.index).trim()
  return {
    action: data.action,
    counter_offer: offer,
    message: message || rawOutput,
    raw_output: rawOutput,
  }
}

export async function runSellerNegotiation(
  input: SellerNegotiationInput
): Promise<SellerNegotiationResult> {
  const agent = new SandboxAgent({
    name: 'Haggle Market Seller',
    model: MODEL,
    instructions: await loadSellerInstructions(),
    defaultManifest: buildManifest(input),
    capabilities: [
      ...Capabilities.default(),
      memory(),
    ],
  })

  const result = await run(agent, buildPrompt(input), {
    maxTurns: 16,
    sandbox: {
      client: new UnixLocalSandboxClient(),
    },
  })

  return parseSellerOutput(String(result.finalOutput || '').trim())
}
