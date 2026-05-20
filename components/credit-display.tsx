"use client"

import { Coins, TrendingUp, Trophy } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { usePlayer } from '@/lib/player-context'
import { usePlayerStats } from '@/lib/hooks'

export function CreditDisplay() {
  const { player } = usePlayer()
  const { data: stats } = usePlayerStats(player?.id || null)

  if (!player) return null

  const score = stats?.score || 0

  return (
    <div className="flex items-center gap-3">
      <Badge variant="secondary" className="bg-info/20 text-nav-foreground hover:bg-info/25">
        <Coins className="w-4 h-4 text-info" />
        <span>
          ${Number(player.credits).toFixed(2)}
        </span>
      </Badge>

      {stats && Number(stats.total_spent) > 0 && (
        <Badge variant="secondary" className="bg-success/20 text-nav-foreground hover:bg-success/25">
          <TrendingUp className="w-4 h-4 text-success-light" />
          <span>
            {score.toFixed(2)}x
          </span>
        </Badge>
      )}

      {stats && stats.rank && stats.rank <= 10 && (
        <Badge variant="secondary" className="bg-rank-purple/20 text-rank-purple-foreground">
          <Trophy className="w-3 h-3 mr-1" />
          #{stats.rank}
        </Badge>
      )}
    </div>
  )
}
