"use client"

import { useState, useRef, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Product, HaggleMessage, HaggleSession, SellerNegotiationResponse } from '@/lib/types'
import { usePlayer } from '@/lib/player-context'

interface HaggleChatProps {
  product: Product
  onClose: () => void
  onPurchaseComplete: (savings: number) => void
}

const THINKING_PHRASES = [
  'Accomplishing',
  'Actioning',
  'Actualizing',
  'Architecting',
  'Baking',
  'Beaming',
  "Beboppin'",
  'Befuddling',
  'Billowing',
  'Blanching',
  'Bloviating',
  'Boogieing',
  'Boondoggling',
  'Booping',
  'Bootstrapping',
  'Brewing',
  'Bunning',
  'Burrowing',
  'Calculating',
  'Canoodling',
  'Caramelizing',
  'Cascading',
  'Catapulting',
  'Cerebrating',
  'Channeling',
  'Channelling',
  'Choreographing',
  'Churning',
  'Clauding',
  'Coalescing',
  'Cogitating',
  'Combobulating',
  'Composing',
  'Computing',
  'Concocting',
  'Considering',
  'Contemplating',
  'Cooking',
  'Crafting',
  'Creating',
  'Crunching',
  'Crystallizing',
  'Cultivating',
  'Deciphering',
  'Deliberating',
  'Determining',
  'Dilly-dallying',
  'Discombobulating',
  'Doing',
  'Doodling',
  'Drizzling',
  'Ebbing',
  'Effecting',
  'Elucidating',
  'Embellishing',
  'Enchanting',
  'Envisioning',
  'Evaporating',
  'Fermenting',
  'Fiddle-faddling',
  'Finagling',
  'Flambéing',
  'Flibbertigibbeting',
  'Flowing',
  'Flummoxing',
  'Fluttering',
  'Forging',
  'Forming',
  'Frolicking',
  'Frosting',
  'Gallivanting',
  'Galloping',
  'Garnishing',
  'Generating',
  'Gesticulating',
  'Germinating',
  'Gitifying',
  'Grooving',
  'Gusting',
  'Harmonizing',
  'Hashing',
  'Hatching',
  'Herding',
  'Honking',
  'Hullaballooing',
  'Hyperspacing',
  'Ideating',
  'Imagining',
  'Improvising',
  'Incubating',
  'Inferring',
  'Infusing',
  'Ionizing',
  'Jitterbugging',
  'Julienning',
  'Kneading',
  'Leavening',
  'Levitating',
  'Lollygagging',
  'Manifesting',
  'Marinating',
  'Meandering',
  'Metamorphosing',
  'Misting',
  'Moonwalking',
  'Moseying',
  'Mulling',
  'Mustering',
  'Musing',
  'Nebulizing',
  'Nesting',
  'Newspapering',
  'Noodling',
  'Nucleating',
  'Orbiting',
  'Orchestrating',
  'Osmosing',
  'Perambulating',
  'Percolating',
  'Perusing',
  'Philosophising',
  'Photosynthesizing',
  'Pollinating',
  'Pondering',
  'Pontificating',
  'Pouncing',
  'Precipitating',
  'Prestidigitating',
  'Processing',
  'Proofing',
  'Propagating',
  'Puttering',
  'Puzzling',
  'Quantumizing',
  'Razzle-dazzling',
  'Razzmatazzing',
  'Recombobulating',
  'Reticulating',
  'Roosting',
  'Ruminating',
  'Sautéing',
  'Scampering',
  'Schlepping',
  'Scurrying',
  'Seasoning',
  'Shenaniganing',
  'Shimmying',
  'Simmering',
  'Skedaddling',
  'Sketching',
  'Slithering',
  'Smooshing',
  'Sock-hopping',
  'Spelunking',
  'Spinning',
  'Sprouting',
  'Stewing',
  'Sublimating',
  'Swirling',
  'Swooping',
  'Symbioting',
  'Synthesizing',
  'Tempering',
  'Thinking',
  'Thundering',
  'Tinkering',
  'Tomfoolering',
  'Topsy-turvying',
  'Transfiguring',
  'Transmuting',
  'Twisting',
  'Undulating',
  'Unfurling',
  'Unravelling',
  'Vibing',
  'Waddling',
  'Wandering',
  'Warping',
  'Whatchamacalliting',
  'Whirlpooling',
  'Whirring',
  'Whisking',
  'Wibbling',
  'Working',
  'Wrangling',
  'Zesting',
  'Zigzagging',
]
function getRandomPhrase(): string {
  return THINKING_PHRASES[Math.floor(Math.random() * THINKING_PHRASES.length)];
}

export function HaggleChat({ product, onClose, onPurchaseComplete }: HaggleChatProps) {
  const { player, refreshPlayer, apiFetch } = usePlayer()
  const [session, setSession] = useState<HaggleSession | null>(null)
  const [messages, setMessages] = useState<HaggleMessage[]>([])
  const [messageInput, setMessageInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [thinkingPhrase, setThinkingPhrase] = useState(THINKING_PHRASES[0])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const startedRef = useRef(false)

  useEffect(() => {
    if (!isLoading) return
    setThinkingPhrase(getRandomPhrase())
    const interval = setInterval(() => {
      setThinkingPhrase(getRandomPhrase())
    }, 30000) // 30 seconds
    return () => clearInterval(interval)
  }, [isLoading])

  const fetchGreeting = useCallback(async (sessionId: string) => {
    setIsLoading(true)
    const greeting = `Hi, I'm interested in the ${product.name}`
    setMessages([{
      id: `player-${Date.now()}`,
      session_id: sessionId,
      sender: 'player',
      message: greeting,
      offer_amount: null,
      created_at: new Date().toISOString()
    }])
    try {
      const response = await apiFetch('/api/haggle/offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          message: greeting,
        })
      })
      const data = await response.json()
      if (data.success && data.data) {
        setSession(data.data.session)
        const sellerResponse: SellerNegotiationResponse = data.data.seller_response
        setMessages(prev => [...prev, {
          id: `seller-${Date.now()}`,
          session_id: sessionId,
          sender: 'seller',
          message: sellerResponse.message,
          offer_amount: sellerResponse.counter_offer || null,
          created_at: new Date().toISOString()
        }])
      } else {
        setError(data.error || 'Seller is unavailable')
      }
    } catch (err) {
      setError('Connection error')
      console.error('Fetch greeting error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [product.name, apiFetch])

  const startSession = useCallback(async () => {
    if (!player) return

    setError(null)

    try {
      const response = await apiFetch('/api/haggle/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: product.id
        })
      })

      const data = await response.json()

      if (data.success && data.data) {
        setSession(data.data)
        fetchGreeting(data.data.id)
      } else {
        setError(data.error || 'Failed to start session')
      }
    } catch (err) {
      setError('Connection error')
      console.error('Start session error:', err)
    }
  }, [player, product.id, apiFetch, fetchGreeting])

  useEffect(() => {
    if (player && !startedRef.current) {
      startedRef.current = true
      startSession()
    }
  }, [player, startSession])

  const sessionRef = useRef<HaggleSession | null>(null)
  useEffect(() => { sessionRef.current = session }, [session])
  const abandonedRef = useRef(false)

  useEffect(() => {
    return () => {
      const s = sessionRef.current
      if (s && s.status === 'active' && !abandonedRef.current) {
        fetch('/api/haggle/abandon', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('haggle_api_key')}`,
          },
          body: JSON.stringify({ session_id: s.id }),
          keepalive: true,
        }).catch(() => {})
      }
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const sendMessage = async () => {
    if (!session || !messageInput.trim() || isLoading) return

    const text = messageInput.trim()

    setIsLoading(true)
    setError(null)

    const playerMessage: HaggleMessage = {
      id: `player-${Date.now()}`,
      session_id: session.id,
      sender: 'player',
      message: text,
      offer_amount: null,
      created_at: new Date().toISOString()
    }
    setMessages(prev => [...prev, playerMessage])
    setMessageInput('')

    try {
      const response = await apiFetch('/api/haggle/offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session.id,
          message: text,
        })
      })

      const data = await response.json()

      if (data.success && data.data) {
        setSession(data.data.session)

        const sellerResponse: SellerNegotiationResponse = data.data.seller_response
        const sellerMessage: HaggleMessage = {
          id: `seller-${Date.now()}`,
          session_id: session.id,
          sender: 'seller',
          message: sellerResponse.message,
          offer_amount: sellerResponse.counter_offer || null,
          created_at: new Date().toISOString()
        }
        setMessages(prev => [...prev, sellerMessage])

        if (data.data.session.status === 'accepted') {
          await refreshPlayer()
        }
      } else {
        setError(data.error || 'Failed to send message')
        setMessages(prev => prev.filter(m => m.id !== playerMessage.id))
      }
    } catch (err) {
      setError('Connection error')
      setMessages(prev => prev.filter(m => m.id !== playerMessage.id))
      console.error('Send message error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    if (session?.status === 'accepted' && session.final_price != null) {
      onPurchaseComplete(Number(product.market_price) - Number(session.final_price))
    } else {
      onClose()
    }
  }

  const abandonSession = async () => {
    if (!session) return

    abandonedRef.current = true

    if (session.status === 'active') {
      try {
        await apiFetch('/api/haggle/abandon', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: session.id })
        })
      } catch (err) {
        console.error('Abandon session error:', err)
      }
    }

    handleClose()
  }

  const isSessionActive = session?.status === 'active'
  const canSendMessage = isSessionActive && !isLoading

  return (
    <div>
      {/* Header */}
      <div className="bg-nav text-nav-foreground rounded-t-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {product.image_url ? (
              <div className="relative size-10 rounded-full overflow-hidden border border-white/20 bg-white/10 flex-shrink-0 flex items-center justify-center">
                <Image
                  src={product.image_url}
                  alt={product.name}
                  fill
                  sizes="40px"
                  className="object-cover"
                />
              </div>
            ) : null}
            <div className="min-w-0">
              <h3 className="text-lg font-semibold leading-tight">Haggle Time!</h3>
              <p className="text-xs opacity-90 truncate max-w-[180px] sm:max-w-[240px]">{product.name}</p>
            </div>
          </div>
          <Button
            variant="default"
            size="sm"
            className="bg-primary hover:bg-primary/80 text-primary-foreground flex-shrink-0"
            onClick={abandonSession}
            aria-label="Close negotiation"
          >
            Close
          </Button>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <Badge variant="secondary" className="bg-white/20 text-white border-0 text-[10px] font-bold">
            Market: ${Number(product.market_price).toFixed(2)}
          </Badge>
          <Badge variant="secondary" className="bg-white/20 text-white border-0 text-[10px] font-bold">
            Round {session?.rounds_count || 0}/{session?.max_rounds || 10}
          </Badge>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="h-80 min-h-48 max-h-[60vh] resize-y p-4">
        <div className="space-y-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.sender === 'player' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 ${
                  msg.sender === 'player'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-foreground'
                }`}
              >
                <p className="text-sm">{msg.message}</p>
                {msg.sender === 'seller' && msg.offer_amount && (
                  <p className="text-xs mt-1 font-semibold text-muted-foreground">
                    Asking: ${Number(msg.offer_amount).toFixed(2)}
                  </p>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start" role="status" aria-label="Seller is typing">
              <div className="bg-secondary rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{thinkingPhrase}</span>
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" />
                    <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                    <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Session Status Messages */}
      {session?.status === 'accepted' && (
        <Alert className="rounded-none border-x-0 border-b-0 border-success/30 bg-success/10 py-3" role="status">
          <AlertDescription className="text-center text-sm font-medium text-success">
            Deal accepted! You saved ${(Number(product.market_price) - Number(session.final_price)).toFixed(2)}
          </AlertDescription>
        </Alert>
      )}

      {session?.status === 'rejected' && (
        <Alert variant="destructive" className="rounded-none border-x-0 border-b-0 bg-destructive/10 py-3" role="alert">
          <AlertDescription className="text-center text-sm font-medium">
            The seller rejected your offer. Better luck next time!
          </AlertDescription>
        </Alert>
      )}

      {session?.status === 'expired' && (
        <Alert className="rounded-none border-x-0 border-b-0 border-warning/30 bg-warning/10 py-3" role="status">
          <AlertDescription className="text-center text-sm font-medium text-warning">
            Max rounds reached. Negotiation closed.
          </AlertDescription>
        </Alert>
      )}

      {/* Error */}
      {error && (
        <Alert variant="destructive" className="rounded-none border-x-0 border-b-0 bg-destructive/10 py-2" role="alert">
          <AlertDescription className="text-center text-xs">{error}</AlertDescription>
        </Alert>
      )}

      {/* Input Area */}
      {isSessionActive && (
        <div className="border-t border-border p-3 space-y-2">
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="Negotiate with the seller..."
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              disabled={!canSendMessage}
            />
            <Button
              onClick={sendMessage}
              disabled={!canSendMessage || !messageInput.trim()}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Your credits: ${player ? Number(player.credits).toFixed(2) : '0.00'}
          </p>
        </div>
      )}

      {/* Close Button for ended sessions */}
      {!isSessionActive && session && (
        <div className="border-t border-border p-3">
          <Button variant="default" className="w-full" onClick={handleClose}>
            Close
          </Button>
        </div>
      )}
    </div>
  )
}
