'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Game } from '@/lib/types'

const STATUS_LABELS: Record<string, string> = {
  waiting: 'Lobby',
  active: 'Submissions Open',
  voting: 'Voting',
  results: 'Results',
  break: 'Break',
  ended: 'Game Over',
}

const STATUS_COLORS: Record<string, string> = {
  waiting: 'bg-zinc-700 text-white/60',
  active: 'bg-green-500/20 text-green-400',
  voting: 'bg-blue-500/20 text-blue-400',
  results: 'bg-yellow-500/20 text-yellow-400',
  break: 'bg-orange-500/20 text-orange-400',
  ended: 'bg-zinc-700 text-white/60',
}

interface Props {
  game: Game
}

interface RoleCounts {
  individual: number
  team_leader: number
  team_member: number
  crowd_voter: number
}

export default function TopBar({ game }: Props) {
  const [roleCounts, setRoleCounts] = useState<RoleCounts>({
    individual: 0,
    team_leader: 0,
    team_member: 0,
    crowd_voter: 0,
  })

  const answerablePlayers = roleCounts.individual + roleCounts.team_leader
  const noAnswerablePlayers = answerablePlayers === 0 && game.status === 'active'

  // Load and subscribe to player role counts
  useEffect(() => {
    async function fetchRoleCounts() {
      const { data } = await supabase
        .from('players')
        .select('role')
        .eq('game_id', game.id)

      if (data) {
        const counts: RoleCounts = { individual: 0, team_leader: 0, team_member: 0, crowd_voter: 0 }
        for (const p of data) {
          if (p.role in counts) counts[p.role as keyof RoleCounts]++
        }
        setRoleCounts(counts)
      }
    }

    fetchRoleCounts()

    const channel = supabase
      .channel(`topbar-players-${game.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players', filter: `game_id=eq.${game.id}` },
        () => fetchRoleCounts(),
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [game.id])


  return (
    <>
      <div className="sticky top-0 z-10 flex flex-col border-b border-white/10 bg-zinc-950/90 backdrop-blur">
        {/* Main row */}
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-yellow-400">
              Host · {game.code}
            </p>
            {game.current_round > 0 && (
              <p className="text-xs text-white/30">
                Round {game.current_round}{game.is_final_round ? ' · KRACRONYM' : ''}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLORS[game.status] ?? 'bg-zinc-700 text-white/60'}`}>
              {STATUS_LABELS[game.status] ?? game.status}
            </span>
          </div>
        </div>

        {/* Player breakdown row */}
        <div className={`flex items-center gap-2 px-4 pb-2 ${noAnswerablePlayers ? 'animate-pulse' : ''}`}>
          {/* Answerable players — highlighted */}
          <div className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
            noAnswerablePlayers ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-white'
          }`}>
            <span>🎤</span>
            <span>{roleCounts.individual}</span>
          </div>
          <div className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
            noAnswerablePlayers ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-white'
          }`}>
            <span>👑</span>
            <span>{roleCounts.team_leader}</span>
          </div>

          <span className="text-white/20 text-xs">·</span>

          {/* Supporting roles — dimmer */}
          <div className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-white/5 text-white/40">
            <span>🤝</span>
            <span>{roleCounts.team_member}</span>
          </div>
          <div className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-white/5 text-white/40">
            <span>🗳️</span>
            <span>{roleCounts.crowd_voter}</span>
          </div>

          {noAnswerablePlayers && (
            <span className="text-xs text-red-400 font-semibold ml-1">⚠ No answerable players!</span>
          )}
        </div>
      </div>

    </>
  )
}
