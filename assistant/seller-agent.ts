import { readFile, readdir } from 'node:fs/promises'
import { join, posix } from 'node:path'
import { Product } from '@/lib/types'

type SellerAction = 'accept' | 'counter' | 'reject'

export interface SellerMessageHistoryItem {
  sender: 'player' | 'seller'
  message: string
  offer_amount: number | null
  created_at: string
}

export interface SellerAgentState {
  environment_id: string
  previous_interaction_id: string
  agent_id?: string
  updated_at?: string
  last_heartbeat_at?: string
  heartbeat_count?: number
  skill_bundle_version?: string
}

export interface SellerInventoryUpdate {
  type: 'price_adjustment' | 'stock_adjustment' | 'promotion_note'
  product_id?: string
  product_name?: string
  market_price?: number
  min_acceptable_price?: number
  stock_quantity?: number
  note?: string
  reason?: string
}

export interface SellerNegotiationInput {
  sessionId: string
  playerId: string
  product: Product
  catalog?: Product[]
  buyerMessage: string
  roundCount: number
  history: SellerMessageHistoryItem[]
  sellerAgentState?: SellerAgentState | null
}

export interface SellerNegotiationResult {
  action: SellerAction
  counter_offer?: number
  message: string
  raw_output: string
  inventory_update?: SellerInventoryUpdate
  seller_agent_state: SellerAgentState
}

type GeminiInteractionResponse = {
  id?: string
  environment_id?: string
  output_text?: string
  outputs?: Array<{ text?: string; type?: string }>
  steps?: Array<{
    type?: string
    content?: Array<{ text?: string; type?: string }>
  }>
  error?: { message?: string }
}

const GEMINI_AGENT_ID = process.env.GEMINI_SELLER_AGENT_ID || 'antigravity-preview-05-2026'
const GEMINI_API_REVISION = process.env.GEMINI_API_REVISION || '2026-05-20'
const GEMINI_INTERACTIONS_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions'
const HEARTBEAT_DEFAULT_EVERY = process.env.SELLER_AGENT_HEARTBEAT_EVERY || '30m'
const HEARTBEAT_DEFAULT_TURNS = Number(process.env.SELLER_AGENT_HEARTBEAT_EVERY_TURNS || 3)

type GeminiEnvironmentSource = {
  type: 'inline'
  target: string
  content: string
}

function turnRequestPath(input: SellerNegotiationInput): string {
  return `input/requests/round-${input.roundCount}.json`
}

function turnHistoryPath(input: SellerNegotiationInput): string {
  return `state/history/round-${input.roundCount}.json`
}

function buildRequestPayload(input: SellerNegotiationInput) {
  return {
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
    catalog: (input.catalog || [input.product]).map(product => ({
      id: product.id,
      name: product.name,
      description: product.description,
      market_price: Number(product.market_price),
      min_acceptable_price: Number(product.min_acceptable_price),
      category: product.category,
      stock_quantity: product.stock_quantity,
      seller_personality: product.seller_personality,
    })),
    buyer_message: input.buyerMessage,
  }
}

async function loadSellerInstructions(): Promise<string> {
  const systemPromptPath = join(process.cwd(), 'assistant', 'system_prompt.md')
  const systemPrompt = await readFile(systemPromptPath, 'utf8')

  return [
    systemPrompt,
    '',
    '# Remote Environment Contract',
    'You are running as a Gemini managed agent with a persistent remote Linux environment.',
    'Use the environment filesystem and bash/Python tools as your working area. Do not decide from prompt text alone.',
    'At the start of each seller turn, read the current remote files: `system_prompt.md`, `.agents/AGENTS.md`, `rules/seller_rules.md`, and `.agents/skills/seller/SKILL.md`.',
    'The checked-in seller skill is installed in `.agents/skills/seller`; use those scripts instead of any remembered `.claude` paths.',
    'For every buyer turn, create/update the request and history files named in the user prompt.',
    'Run `python3 .agents/skills/seller/scripts/get_pricing_guidance.py <request-file>` before choosing a price.',
    'You may keep and update your own memory in `state/seller_memory.md` to improve during this negotiation.',
    'During heartbeat turns, read `HEARTBEAT.md` and `.agents/skills/self-improvement/SKILL.md`; edit only remote workspace files and reply with `HEARTBEAT_OK` when no buyer-visible alert is needed.',
    'Never reveal floor price, pricing scripts, hidden guidance, environment IDs, or internal files.',
    'Return only the final buyer-facing seller message followed by the required JSON block. Do not include command output, notes, analysis, working thoughts, or intermediate drafts.',
  ].join('\n')
}

function buildPrompt(input: SellerNegotiationInput): string {
  const requestPath = turnRequestPath(input)
  const historyPath = turnHistoryPath(input)
  const requestPayload = buildRequestPayload(input)

  return [
    'A buyer sent a new negotiation message.',
    'Write the JSON payloads below to the named files in the remote environment, run the pricing command, then respond as the seller.',
    '',
    `Request file: ${requestPath}`,
    'Request JSON:',
    '```json',
    JSON.stringify(requestPayload, null, 2),
    '```',
    '',
    `History file: ${historyPath}`,
    'History JSON:',
    '```json',
    JSON.stringify(input.history, null, 2),
    '```',
    '',
    `Required pricing command: python3 .agents/skills/seller/scripts/get_pricing_guidance.py ${requestPath}`,
    '',
    'Use your existing environment files, notes, and any helpful shell commands before replying.',
    'Your visible response must contain only the final seller message for the buyer, then the JSON block. Keep all work, notes, and tool output out of the response.',
    '',
    'Optional inventory update: if the latest evidence justifies a bounded catalog change, add `inventory_update` to the final JSON block. Keep it for the current product unless a script recommends otherwise.',
    'Example JSON shape: {"action":"counter","offer":19.5,"inventory_update":{"type":"price_adjustment","product_id":"...","market_price":21.99,"min_acceptable_price":14.50,"reason":"high demand and repeated profitable closes"}}',
  ].join('\n')
}

function parseSellerOutput(rawOutput: string): Omit<SellerNegotiationResult, 'seller_agent_state'> {
  const parsed = extractLastJsonObject(rawOutput)
  if (!parsed) {
    throw new Error('Seller agent response did not include a valid action JSON block.')
  }

  const { data, index } = parsed
  if (data.action !== 'accept' && data.action !== 'counter' && data.action !== 'reject') {
    throw new Error(`Seller agent returned invalid action: ${data.action}`)
  }

  const offer = data.offer === null || data.offer === undefined ? undefined : Number(data.offer)
  if (offer !== undefined && !Number.isFinite(offer)) {
    throw new Error(`Seller agent returned invalid offer: ${String(data.offer)}`)
  }

  const inventoryUpdate = parseInventoryUpdate(data.inventory_update)
  const message = extractFinalSellerMessage(rawOutput.slice(0, index))
  return {
    action: data.action,
    counter_offer: offer,
    message: message || 'I can work with you on this, but I need a fair price for the item.',
    raw_output: rawOutput,
    inventory_update: inventoryUpdate,
  }
}

function extractFinalSellerMessage(candidate: string): string {
  const withoutCodeBlocks = candidate
    .replace(/```[\s\S]*?```/g, '\n')
    .replace(/```json\s*$/g, '')
    .trim()

  if (!withoutCodeBlocks) return ''

  const paragraphs = withoutCodeBlocks
    .split(/\n\s*\n/)
    .map(paragraph => paragraph
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .join(' ')
      .trim()
    )
    .filter(Boolean)

  const safeParagraphs = paragraphs.filter(paragraph => !looksInternal(paragraph))
  const finalParagraph = safeParagraphs.at(-1) || paragraphs.at(-1) || ''

  return finalParagraph
    .replace(/^(final seller message|seller|response)\s*:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function looksInternal(text: string): boolean {
  return [
    /\b(thought|thinking|analysis|reasoning|plan|scratchpad|internal note|tool output|command output)\b/i,
    /\b(pricing guidance|floor price|minimum acceptable|min_acceptable_price|suggested counter)\b/i,
    /\b(\.agents|HEARTBEAT|seller_memory|\.learnings|rules\/seller_rules|scripts\/|python3\s+)/i,
    /^\s*(i ran|i checked|i wrote|i updated|running|command|observation|note)\b/i,
    /^\s*[\-$]\s+/,
  ].some(pattern => pattern.test(text))
}

function extractLastJsonObject(rawOutput: string): { data: { action?: string; offer?: unknown; inventory_update?: unknown }; index: number } | null {
  const fencedMatches = [...rawOutput.matchAll(/```json\s*([\s\S]*?)\s*```/g)]
  for (const match of fencedMatches.reverse()) {
    try {
      return {
        data: JSON.parse(match[1]) as { action?: string; offer?: unknown; inventory_update?: unknown },
        index: match.index ?? 0,
      }
    } catch {
      // Try the next candidate.
    }
  }

  for (let start = rawOutput.lastIndexOf('{'); start >= 0; start = rawOutput.lastIndexOf('{', start - 1)) {
    let depth = 0
    let inString = false
    let escaped = false
    for (let i = start; i < rawOutput.length; i++) {
      const char = rawOutput[i]
      if (inString) {
        if (escaped) {
          escaped = false
        } else if (char === '\\') {
          escaped = true
        } else if (char === '"') {
          inString = false
        }
        continue
      }
      if (char === '"') inString = true
      if (char === '{') depth += 1
      if (char === '}') depth -= 1
      if (depth === 0) {
        try {
          return {
            data: JSON.parse(rawOutput.slice(start, i + 1)) as { action?: string; offer?: unknown; inventory_update?: unknown },
            index: start,
          }
        } catch {
          break
        }
      }
    }
  }

  return null
}

function parseInventoryUpdate(value: unknown): SellerInventoryUpdate | undefined {
  if (!value || typeof value !== 'object') return undefined
  const data = value as Record<string, unknown>
  if (data.type !== 'price_adjustment' && data.type !== 'stock_adjustment' && data.type !== 'promotion_note') {
    return undefined
  }

  const numberOrUndefined = (candidate: unknown) => {
    if (candidate === undefined || candidate === null || candidate === '') return undefined
    const number = Number(candidate)
    return Number.isFinite(number) ? number : undefined
  }

  return {
    type: data.type,
    product_id: typeof data.product_id === 'string' ? data.product_id : undefined,
    product_name: typeof data.product_name === 'string' ? data.product_name : undefined,
    market_price: numberOrUndefined(data.market_price),
    min_acceptable_price: numberOrUndefined(data.min_acceptable_price),
    stock_quantity: numberOrUndefined(data.stock_quantity),
    note: typeof data.note === 'string' ? data.note.slice(0, 500) : undefined,
    reason: typeof data.reason === 'string' ? data.reason.slice(0, 500) : undefined,
  }
}

function extractOutputText(response: GeminiInteractionResponse): string {
  if (response.output_text) return response.output_text

  const outputText = response.outputs
    ?.map(output => output.text)
    .filter((text): text is string => Boolean(text))
    .join('\n')

  if (outputText) return outputText

  const stepText = response.steps
    ?.filter(step => step.type === 'model_output')
    .flatMap(step => step.content || [])
    .map(content => content.text)
    .filter((text): text is string => Boolean(text))
    .join('\n')

  if (stepText) return stepText

  throw new Error('Gemini interaction did not return output text.')
}

async function getLocalEnvValue(name: string): Promise<string | undefined> {
  if (process.env.NODE_ENV === 'production') return undefined

  try {
    const envFile = await readFile(join(process.cwd(), '.env.local'), 'utf8')
    const line = envFile
      .split(/\r?\n/)
      .find(candidate => candidate.trim().startsWith(`${name}=`))

    if (!line) return undefined

    const value = line.slice(line.indexOf('=') + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      return value.slice(1, -1)
    }

    return value
  } catch {
    return undefined
  }
}

async function readInlineSources(localDir: string, remoteDir: string): Promise<GeminiEnvironmentSource[]> {
  const entries = await readdir(localDir, { withFileTypes: true })
  const sources: GeminiEnvironmentSource[] = []

  for (const entry of entries) {
    if (
      entry.name === '.DS_Store' ||
      entry.name === '__pycache__' ||
      entry.name.endsWith('.pyc')
    ) {
      continue
    }

    const localPath = join(localDir, entry.name)
    const remotePath = posix.join(remoteDir, entry.name)

    if (entry.isDirectory()) {
      sources.push(...await readInlineSources(localPath, remotePath))
    } else if (entry.isFile()) {
      sources.push({
        type: 'inline',
        target: remotePath,
        content: await readFile(localPath, 'utf8'),
      })
    }
  }

  return sources
}

async function firstTurnEnvironment() {
  const assistantDir = join(process.cwd(), 'assistant')
  const systemPrompt = await readFile(join(assistantDir, 'system_prompt.md'), 'utf8')
  const sellerRules = await readFile(join(assistantDir, '.agents', 'rules', 'seller_rules.md'), 'utf8')
  const heartbeat = await readFile(join(assistantDir, '.agents', 'HEARTBEAT.md'), 'utf8')
  const agentSources = await readInlineSources(join(assistantDir, '.agents'), '.agents')

  return {
    type: 'remote',
    sources: [
      {
        type: 'inline',
        target: 'system_prompt.md',
        content: systemPrompt,
      },
      {
        type: 'inline',
        target: 'rules/seller_rules.md',
        content: sellerRules,
      },
      {
        type: 'inline',
        target: 'state/seller_memory.md',
        content: '# Seller Memory\n\nTrack useful lessons from this active negotiation here.\n',
      },
      {
        type: 'inline',
        target: 'HEARTBEAT.md',
        content: heartbeat,
      },
      {
        type: 'inline',
        target: '.learnings/LEARNINGS.md',
        content: '# Learnings\n\nCorrections, insights, and best practices captured by seller heartbeat runs.\n\n---\n',
      },
      {
        type: 'inline',
        target: '.learnings/ERRORS.md',
        content: '# Errors\n\nCommand failures and integration errors captured by seller heartbeat runs.\n\n---\n',
      },
      {
        type: 'inline',
        target: '.learnings/FEATURE_REQUESTS.md',
        content: '# Feature Requests\n\nRequested seller capabilities and future improvements.\n\n---\n',
      },
      ...agentSources,
    ],
  }
}

async function createInteraction(input: SellerNegotiationInput, prompt = buildPrompt(input), environment?: unknown): Promise<GeminiInteractionResponse> {
  const apiKey =
    await getLocalEnvValue('GEMINI_API_KEY') ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured.')
  }

  const body: Record<string, unknown> = {
    agent: input.sellerAgentState?.agent_id || GEMINI_AGENT_ID,
    input: [{ type: 'text', text: prompt }],
    system_instruction: await loadSellerInstructions(),
    environment: environment ?? input.sellerAgentState?.environment_id ?? await firstTurnEnvironment(),
  }

  if (input.sellerAgentState?.previous_interaction_id) {
    body.previous_interaction_id = input.sellerAgentState.previous_interaction_id
  }

  const response = await fetch(GEMINI_INTERACTIONS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
      'Api-Revision': GEMINI_API_REVISION,
    },
    body: JSON.stringify(body),
  })

  const responseText = await response.text()
  let data: GeminiInteractionResponse
  try {
    data = JSON.parse(responseText) as GeminiInteractionResponse
  } catch {
    data = {}
  }

  if (!response.ok) {
    const errorMessage =
      data.error?.message ||
      (Array.isArray(data) ? data[0]?.error?.message : undefined) ||
      responseText.slice(0, 500) ||
      `Gemini interaction failed with HTTP ${response.status}.`

    throw new Error(`Gemini interaction failed with HTTP ${response.status}: ${errorMessage}`)
  }

  return data
}

function parseDurationMs(value: string): number {
  const trimmed = value.trim().toLowerCase()
  if (trimmed === '0' || trimmed === '0m') return 0
  const match = trimmed.match(/^(\d+(?:\.\d+)?)(ms|s|m|h)?$/)
  if (!match) return 30 * 60 * 1000
  const amount = Number(match[1])
  const unit = match[2] || 'm'
  if (unit === 'ms') return amount
  if (unit === 's') return amount * 1000
  if (unit === 'h') return amount * 60 * 60 * 1000
  return amount * 60 * 1000
}

function shouldRunHeartbeat(input: SellerNegotiationInput, state: SellerAgentState): boolean {
  if (process.env.SELLER_AGENT_HEARTBEAT_DISABLED === 'true') return false

  const intervalMs = parseDurationMs(HEARTBEAT_DEFAULT_EVERY)
  if (intervalMs === 0) return false

  if (!state.last_heartbeat_at) return true

  const lastHeartbeat = Date.parse(state.last_heartbeat_at)
  if (Number.isFinite(lastHeartbeat) && Date.now() - lastHeartbeat >= intervalMs) return true

  return HEARTBEAT_DEFAULT_TURNS > 0 && input.roundCount > 0 && input.roundCount % HEARTBEAT_DEFAULT_TURNS === 0
}

function buildHeartbeatPrompt(
  input: SellerNegotiationInput,
  parsedResult: Omit<SellerNegotiationResult, 'seller_agent_state'>
): string {
  return [
    'This is an internal seller heartbeat turn.',
    'Read `HEARTBEAT.md` if it exists and follow it strictly. Do not infer or repeat old tasks from prior chats.',
    'Use the same main session and remote workspace. Review only concise recent state: latest request/history, `state/seller_memory.md`, `.learnings/`, `rules/seller_rules.md`, and seller skill files.',
    'If you identify a reusable improvement, edit the relevant remote file with a surgical change and log a short sanitized entry in `.learnings/LEARNINGS.md` or `.learnings/ERRORS.md`.',
    'If pricing/inventory evidence suggests a catalog update policy, update the skill/rules or draft a recommendation; do not fabricate stock or weaken floor-price protections.',
    'If nothing needs attention, reply `HEARTBEAT_OK`.',
    'If you made internal maintenance changes, end with `HEARTBEAT_OK` and a short internal summary. Do not return buyer-facing text or an action JSON block.',
    '',
    'Latest seller result:',
    '```json',
    JSON.stringify({
      session_id: input.sessionId,
      round_count: input.roundCount,
      product_id: input.product.id,
      product_name: input.product.name,
      action: parsedResult.action,
      offer: parsedResult.counter_offer ?? null,
      inventory_update: parsedResult.inventory_update ?? null,
    }, null, 2),
    '```',
  ].join('\n')
}

async function maybeRunHeartbeat(
  input: SellerNegotiationInput,
  state: SellerAgentState,
  parsedResult: Omit<SellerNegotiationResult, 'seller_agent_state'>
): Promise<SellerAgentState> {
  if (!shouldRunHeartbeat(input, state)) return state

  try {
    const heartbeat = await createInteraction(
      {
        ...input,
        sellerAgentState: state,
      },
      buildHeartbeatPrompt(input, parsedResult),
      state.environment_id
    )

    return {
      ...state,
      previous_interaction_id: heartbeat.id || state.previous_interaction_id,
      environment_id: heartbeat.environment_id || state.environment_id,
      last_heartbeat_at: new Date().toISOString(),
      heartbeat_count: (state.heartbeat_count || 0) + 1,
      updated_at: new Date().toISOString(),
    }
  } catch (error) {
    console.warn('Seller heartbeat failed:', error)
    return state
  }
}

export async function runSellerNegotiation(
  input: SellerNegotiationInput
): Promise<SellerNegotiationResult> {
  const interaction = await createInteraction(input)
  const id = interaction.id
  const environmentId = interaction.environment_id || input.sellerAgentState?.environment_id

  if (!id) {
    throw new Error('Gemini interaction response did not include an interaction id.')
  }

  if (!environmentId) {
    throw new Error('Gemini interaction response did not include an environment id.')
  }

  const parsedResult = parseSellerOutput(extractOutputText(interaction).trim())
  const sellerAgentState: SellerAgentState = {
      environment_id: environmentId,
      previous_interaction_id: id,
      agent_id: input.sellerAgentState?.agent_id || GEMINI_AGENT_ID,
      updated_at: new Date().toISOString(),
      last_heartbeat_at: input.sellerAgentState?.last_heartbeat_at,
      heartbeat_count: input.sellerAgentState?.heartbeat_count || 0,
  }
  const updatedState = await maybeRunHeartbeat(input, sellerAgentState, parsedResult)

  return {
    ...parsedResult,
    seller_agent_state: updatedState,
  }
}
