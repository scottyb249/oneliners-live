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

interface LeaderboardEntry {
  name: string
  score: number
}

interface RoleCounts {
  individual: number
  team_leader: number
  team_member: number
  crowd_voter: number
}

export default function TopBar({ game }: Props) {
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [pushingToDisplay, setPushingToDisplay] = useState(false)
  const [roleCounts, setRoleCounts] = useState<RoleCounts>({
    individual: 0,
    team_leader: 0,
    team_member: 0,
    crowd_voter: 0,
  })

  const displayingLeaderboard = game.podium_step >= 1
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

  async function handleToggleDisplayLeaderboard() {
    setPushingToDisplay(true)
    await supabase
      .from('games')
      .update({ podium_step: displayingLeaderboard ? 0 : 1 })
      .eq('id', game.id)
    setPushingToDisplay(false)
  }

  async function handleClose() {
    if (displayingLeaderboard) {
      await supabase.from('games').update({ podium_step: 0 }).eq('id', game.id)
    }
    setShowLeaderboard(false)
  }

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

      {/* Leaderboard modal */}
      {showLeaderboard && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          onClick={handleClose}
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
                onClick={handleClose}
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
              onClick={handleToggleDisplayLeaderboard}
              disabled={pushingToDisplay || loading}
              className={`w-full rounded-xl border py-3 text-sm font-bold transition-all disabled:opacity-50 ${
                displayingLeaderboard
                  ? 'border-green-400/60 bg-green-400/10 text-green-400 hover:bg-green-400/20'
                  : 'border-white/20 text-white/60 hover:border-white/40 hover:text-white'
              }`}
            >
              {pushingToDisplay
                ? 'Updating...'
                : displayingLeaderboard
                ? '📺 Showing on Display — Tap to Hide'
                : '📺 Show on Display Screen'}
            </button>

            <button
              onClick={handleClose}
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
