"use client"

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { useAuth, useClerk } from '@clerk/nextjs'
import { Player, PlayerWithKey } from './types'

interface PlayerContextType {
  player: Player | null
  isLoading: boolean
  error: string | null
  register: (email: string) => Promise<PlayerWithKey | null>
  signIn: (email: string, apiKey: string) => Promise<boolean>
  logout: () => Promise<void>
  refreshPlayer: () => Promise<void>
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined)

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { isLoaded: clerkLoaded, isSignedIn } = useAuth()
  const { signOut } = useClerk()
  const [player, setPlayer] = useState<Player | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!clerkLoaded) return

    if (isSignedIn) {
      fetchCurrentPlayer()
      return
    }

    const storedApiKey = localStorage.getItem('haggle_api_key')
    const storedPlayerId = localStorage.getItem('haggle_player_id')
    if (storedApiKey && storedPlayerId) {
      fetchPlayer(storedPlayerId, storedApiKey)
    } else {
      setPlayer(null)
      setIsLoading(false)
    }
  }, [clerkLoaded, isSignedIn])

  const apiFetch = useCallback((url: string, options: RequestInit = {}): Promise<Response> => {
    const apiKey = localStorage.getItem('haggle_api_key')
    const headers = new Headers(options.headers)
    if (apiKey && !isSignedIn) headers.set('Authorization', `Bearer ${apiKey}`)

    return fetch(url, {
      ...options,
      headers,
    })
  }, [isSignedIn])

  const fetchCurrentPlayer = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/players/me')
      const data = await response.json()

      if (data.success && data.data) {
        setPlayer(data.data)
      } else {
        setPlayer(null)
      }
    } catch (err) {
      console.error('Error fetching Clerk player:', err)
      setPlayer(null)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchPlayer = async (playerId: string, apiKey: string) => {
    try {
      const response = await fetch(`/api/players/${playerId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      })
      const data = await response.json()

      if (data.success && data.data) {
        setPlayer(data.data)
      } else {
        localStorage.removeItem('haggle_player_id')
        localStorage.removeItem('haggle_api_key')
      }
    } catch (err) {
      console.error('Error fetching player:', err)
      localStorage.removeItem('haggle_player_id')
      localStorage.removeItem('haggle_api_key')
    } finally {
      setIsLoading(false)
    }
  }

  const register = async (email: string): Promise<PlayerWithKey | null> => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })

      const data = await response.json()

      if (data.success && data.data) {
        const { api_key, ...playerData } = data.data
        setPlayer(playerData)
        localStorage.setItem('haggle_player_id', playerData.id)
        localStorage.setItem('haggle_api_key', api_key)
        return data.data as PlayerWithKey
      } else {
        setError(data.error || 'Failed to register')
        return null
      }
    } catch (err) {
      setError('Failed to connect to server')
      console.error('Register error:', err)
      return null
    } finally {
      setIsLoading(false)
    }
  }

  const signIn = async (email: string, apiKey: string): Promise<boolean> => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/players/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, api_key: apiKey })
      })

      const data = await response.json()

      if (data.success && data.data) {
        setPlayer(data.data)
        localStorage.setItem('haggle_player_id', data.data.id)
        // Store the key the user provided — server never returns it
        localStorage.setItem('haggle_api_key', apiKey)
        return true
      } else {
        setError(data.error || 'Invalid email or API key')
        return false
      }
    } catch (err) {
      setError('Failed to connect to server')
      console.error('Sign-in error:', err)
      return false
    } finally {
      setIsLoading(false)
    }
  }

  const logout = async () => {
    setPlayer(null)
    localStorage.removeItem('haggle_player_id')
    localStorage.removeItem('haggle_api_key')
    if (isSignedIn) await signOut()
  }

  const refreshPlayer = async () => {
    if (isSignedIn) {
      await fetchCurrentPlayer()
      return
    }

    const apiKey = localStorage.getItem('haggle_api_key')
    if (player?.id && apiKey) {
      await fetchPlayer(player.id, apiKey)
    }
  }

  return (
    <PlayerContext.Provider value={{ player, isLoading, error, register, signIn, logout, refreshPlayer, apiFetch }}>
      {children}
    </PlayerContext.Provider>
  )
}

export function usePlayer() {
  const context = useContext(PlayerContext)
  if (context === undefined) {
    throw new Error('usePlayer must be used within a PlayerProvider')
  }
  return context
}
