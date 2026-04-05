'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Game, Player } from '@/lib/types'

interface Props {
  game: Game
}

const MEDALS = ['🥇', '🥈', '🥉']
const MEDAL_STYLES = [
  'border-yellow-400/60 bg-yellow-400/15 text-yellow-400',
  'border-zinc-400/40 bg-zinc-400/10 text-zinc-300',
  'border-amber-600/40 bg-amber-600/10 text-amber-500',
]

export default function EndedView({ game }: Props) {
  const [leaderboard, setLeaderboard] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('players')
        .select('*')
        .eq('game_id', game.id)
        .eq('is_host', false)
        .order('score', { ascending: false })

      if (data) setLeaderboard(data as Player[])
      setLoading(false)
    }
    load()
  }, [game.id])

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="animate-pulse text-white/30" style={{ fontSize: '2rem' }}>
          Loading...
        </p>
      </div>
    )
  }

  const top3 = leaderboard.slice(0, 3)
  const rest = leaderboard.slice(3)

  return (
    <div className="flex flex-1 flex-col items-center gap-8 px-12 py-8 overflow-auto">
      {/* Title */}
      <div className="text-center">
        <p
          className="font-black text-yellow-400 leading-none"
          style={{ fontSize: 'clamp(2rem, 6vw, 5rem)' }}
        >
          Game Over!
        </p>
        <p
          className="mt-2 font-semibold text-white/40"
          style={{ fontSize: 'clamp(0.875rem, 2vw, 1.5rem)' }}
        >
          Thanks for playing O.N.E. Liners Live!
        </p>
      </div>

      {/* Top 3 podium */}
      {top3.length > 0 && (
        <div className="flex w-full max-w-4xl items-end justify-center gap-4">
          {/* Reorder: 2nd, 1st, 3rd */}
          {[top3[1], top3[0], top3[2]].map((player, podiumIdx) => {
            if (!player) return <div key={podiumIdx} className="flex-1" />
            const leaderIdx = top3.indexOf(player)
            const heights = ['h-32', 'h-44', 'h-24']
            return (
              <div
                key={player.id}
                className={`flex flex-1 flex-col items-center justify-end rounded-2xl border px-4 pb-4 ${heights[podiumIdx]} ${MEDAL_STYLES[leaderIdx]}`}
              >
                <p style={{ fontSize: 'clamp(1.5rem, 3vw, 2.5rem)' }}>{MEDALS[leaderIdx]}</p>
                <p
                  className="font-black text-white text-center leading-tight"
                  style={{ fontSize: 'clamp(1rem, 2.2vw, 1.75rem)' }}
                >
                  {player.name}
                </p>
                <p
                  className="font-black tabular-nums mt-1"
                  style={{ fontSize: 'clamp(1.25rem, 2.5vw, 2rem)' }}
                >
                  {player.score} pts
                </p>
              </div>
            )
          })}
        </div>
      )}

      {/* 4th place and below */}
      {rest.length > 0 && (
        <div className="w-full max-w-2xl flex flex-col gap-2">
          {rest.map((player, i) => (
            <div
              key={player.id}
              className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 px-5 py-3"
            >
              <span
                className="font-bold text-white/30 w-8 shrink-0 tabular-nums"
                style={{ fontSize: 'clamp(0.875rem, 1.5vw, 1.25rem)' }}
              >
                #{i + 4}
              </span>
              <p
                className="flex-1 font-semibold text-white truncate"
                style={{ fontSize: 'clamp(0.875rem, 1.8vw, 1.5rem)' }}
              >
                {player.name}
              </p>
              <p
                className="font-black text-white/60 tabular-nums shrink-0"
                style={{ fontSize: 'clamp(0.875rem, 1.8vw, 1.5rem)' }}
              >
                {player.score} pts
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
