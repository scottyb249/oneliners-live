'use client'

import { useState } from 'react'
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

interface LeaderboardEntry {
  name: string
  score: number
}

export default function TopBar({ game }: Props) {
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(false)

  async function handleOpenLeaderboard() {
    setShowLeaderboard(true)
    setLoading(true)
    const { data } = await supabase
      .from('players')
      .select('name, score, role, team_name')
      .eq('game_id', game.id)
      .in('role', ['individual', 'team_leader'])
      .order('score', { ascending: false })

    if (data) {
      setLeaderboard(data.map((p) => ({ name: p.team_name ?? p.name, score: p.score })))
    }
    setLoading(false)
  }

  return (
    <>
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-zinc-950/90 px-4 py-3 backdrop-blur">
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
          {/* Anytime leaderboard button */}
          <button
            onClick={handleOpenLeaderboard}
            className="rounded-full border border-yellow-400/30 px-3 py-1 text-xs font-semibold text-yellow-400/70 hover:border-yellow-400 hover:text-yellow-400 transition-all"
          >
            🏆 Standings
          </button>

          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLORS[game.status] ?? 'bg-zinc-700 text-white/60'}`}>
            {STATUS_LABELS[game.status] ?? game.status}
          </span>
        </div>
      </div>

      {/* Leaderboard modal */}
      {showLeaderboard && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          onClick={() => setShowLeaderboard(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-zinc-900 p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold uppercase tracking-widest text-yellow-400">
                Current Standings
              </p>
              <button
                onClick={() => setShowLeaderboard(false)}
                className="text-sm text-white/30 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            {loading ? (
              <p className="text-center text-white/40 animate-pulse py-4">Loading...</p>
            ) : leaderboard.length === 0 ? (
              <p className="text-center text-white/40 py-4">No players yet.</p>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {leaderboard.map((entry, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                      i === 0 ? 'border-yellow-400/40 bg-yellow-400/10' : 'border-white/10 bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-yellow-400 w-5">#{i + 1}</span>
                      <span className="font-bold text-white">{entry.name}</span>
                    </div>
                    <span className="text-lg font-black text-white">{entry.score}</span>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => setShowLeaderboard(false)}
              className="w-full rounded-xl border border-white/10 py-3 text-sm font-semibold text-white/50 hover:text-white transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  )
}
