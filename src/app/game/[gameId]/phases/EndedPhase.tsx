'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Game, Player } from '../types'

interface Props {
  game: Game
  player: Player
}

interface LeaderboardEntry {
  id: string
  name: string
  role: string
  team_name: string | null
  score: number
}

const MEDALS = ['🥇', '🥈', '🥉']

export default function EndedPhase({ game, player }: Props) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('players')
        .select('id, name, role, team_name, score')
        .eq('game_id', game.id)
        .order('score', { ascending: false })

      if (data) setLeaderboard(data)
      setLoading(false)
    }
    load()
  }, [game.id])

  const myPosition = leaderboard.findIndex((p) => p.id === player.id) + 1
  const myEntry = leaderboard.find((p) => p.id === player.id)

  if (loading) {
    return (
      <div className="flex w-full max-w-md flex-col items-center">
        <p className="animate-pulse text-white/40">Loading final results...</p>
      </div>
    )
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-8">
      <div className="text-center">
        <p className="text-4xl">🎉</p>
        <p className="mt-2 text-sm font-semibold uppercase tracking-widest text-yellow-400">
          Game Over
        </p>
        <p className="mt-1 text-3xl font-black text-white">Final Leaderboard</p>
      </div>

      {/* Current player's finish position */}
      {myPosition > 0 && myEntry && (
        <div className="rounded-2xl border border-yellow-400/30 bg-yellow-400/10 px-6 py-5 text-center">
          <p className="text-sm text-white/50">You finished</p>
          <p className="mt-1 text-5xl font-black text-yellow-400">
            {myPosition <= 3 ? MEDALS[myPosition - 1] : `#${myPosition}`}
          </p>
          <p className="mt-1 text-sm text-white/50">
            with {myEntry.score} {myEntry.score === 1 ? 'point' : 'points'}
          </p>
        </div>
      )}

      {/* Full leaderboard */}
      <div className="space-y-3">
        {leaderboard.map((entry, i) => {
          const isMe = entry.id === player.id
          return (
            <div
              key={entry.id}
              className={`flex items-center gap-4 rounded-xl border px-5 py-3 ${
                isMe ? 'border-yellow-400/40 bg-yellow-400/10' : 'border-white/10 bg-white/5'
              }`}
            >
              <span className="w-8 shrink-0 text-center text-xl">
                {i < 3 ? MEDALS[i] : `#${i + 1}`}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-white truncate">
                  {entry.name}{' '}
                  {isMe && <span className="text-sm text-yellow-400">(You)</span>}
                </p>
                {entry.team_name && (
                  <p className="text-xs text-white/40 truncate">{entry.team_name}</p>
                )}
              </div>
              <p className="shrink-0 text-xl font-black text-white">{entry.score}</p>
            </div>
          )
        })}
      </div>

      <p className="text-center text-sm text-white/30">
        Thanks for playing O.N.E. Liners Live!
      </p>
    </div>
  )
}
