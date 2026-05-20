"use client"

import { Trophy, TrendingUp, Medal, Crown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useLeaderboard } from '@/lib/hooks'
import { usePlayer } from '@/lib/player-context'

export function Leaderboard() {
  const { data: leaderboard, isLoading, error } = useLeaderboard(20)
  const { player } = usePlayer()

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-warning" />
            Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-48 text-muted-foreground" role="status">
            Loading...
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-warning" />
            Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-48 text-muted-foreground" role="alert">
            Failed to load leaderboard
          </div>
        </CardContent>
      </Card>
    )
  }

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-5 h-5 text-warning" />
      case 2:
        return <Medal className="w-5 h-5 text-silver" />
      case 3:
        return <Medal className="w-5 h-5 text-bronze" />
      default:
        return <span className="w-5 text-center text-muted-foreground font-medium">{rank}</span>
    }
  }

  const getRankStyle = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-warning/10 border-warning/30'
      case 2:
        return 'bg-muted/50 border-border'
      case 3:
        return 'bg-bronze/10 border-bronze/30'
      default:
        return 'bg-card border-border'
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-warning" />
          Top Hagglers
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Score = Total Market Value / Credits Spent
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px]">
          <div className="px-4 pb-4 space-y-2">
            {!leaderboard || leaderboard.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Trophy className="w-12 h-12 mx-auto mb-2 text-muted-foreground/30" />
                <p>No players yet. Be the first!</p>
              </div>
            ) : (
              leaderboard.map((entry) => {
                const isCurrentPlayer = player?.id === entry.id

                return (
                  <div
                    key={entry.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${getRankStyle(entry.rank || 0)} ${
                      isCurrentPlayer ? 'ring-2 ring-primary' : ''
                    }`}
                  >
                    <div className="flex items-center justify-center w-8">
                      {getRankIcon(entry.rank || 0)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className={`font-medium truncate ${isCurrentPlayer ? 'text-primary' : 'text-foreground'}`}>
                        {entry.username}
                        {isCurrentPlayer && <span className="text-xs ml-1">(you)</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {entry.items_purchased} {entry.items_purchased === 1 ? 'item' : 'items'}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="flex items-center gap-1 justify-end">
                        <TrendingUp className="w-4 h-4 text-success" />
                        <span className="font-bold text-success">
                          {Number(entry.score).toFixed(2)}x
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
