'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Game, Player, Answer } from '@/lib/types'

interface Props {
  game: Game
  onNextRound: () => void
  onTakeBreak: () => void
  onFinalRound: () => void
  onRunTiebreaker: (tiedPlayerIds: string[]) => void
}

interface AnswerWithVotes extends Answer {
  vote_count: number
}

interface LeaderboardEntry {
  id: string
  name: string
  role: string
  team_name: string | null
  score: number
  is_tiebreaker_participant: boolean
}

export default function ResultsPanel({ game, onNextRound, onTakeBreak, onFinalRound, onRunTiebreaker }: Props) {
  const [results, setResults] = useState<AnswerWithVotes[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    async function load() {
      const [{ data: answers }, { data: votes }, { data: players }] = await Promise.all([
        supabase
          .from('answers')
          .select('*, players(name, team_name)')
          .eq('game_id', game.id)
          .eq('approved', true)
          .eq('is_tiebreaker', game.tiebreaker_ran)
          .eq('round', game.current_round),
        supabase
          .from('votes')
          .select('answer_id')
          .eq('game_id', game.id)
          .eq('round', game.current_round),
        supabase
          .from('players')
          .select('id, name, role, team_name, score, is_tiebreaker_participant')
          .eq('game_id', game.id)
          .neq('role', 'team_member')
          .neq('role', 'crowd_voter')
          .order('score', { ascending: false }),
      ])

      const tally: Record<string, number> = {}
      for (const v of votes ?? []) {
        tally[v.answer_id] = (tally[v.answer_id] ?? 0) + 1
      }

      const withVotes: AnswerWithVotes[] = ((answers ?? []) as Answer[])
        .map((a) => ({ ...a, vote_count: tally[a.id] ?? 0 }))
        .sort((a, b) => b.vote_count - a.vote_count)

      setResults(withVotes)
      setLeaderboard((players ?? []) as LeaderboardEntry[])
      setLoading(false)
    }
    load()
  }, [game.id, game.current_round, game.tiebreaker_ran])

  // --- Tie detection (only for final round, pre-tiebreaker) ---
  function getTiedPositions(): { position: number; players: LeaderboardEntry[] }[] {
    const ties: { position: number; players: LeaderboardEntry[] }[] = []
    let rank = 1
    let i = 0
    while (i < leaderboard.length && rank <= 3) {
      const score = leaderboard[i].score
      const group: LeaderboardEntry[] = []
      while (i < leaderboard.length && leaderboard[i].score === score) {
        group.push(leaderboard[i])
        i++
      }
      if (group.length > 1) ties.push({ position: rank, players: group })
      rank += group.length
    }
    return ties
  }

  async function runTiebreaker(tiedPlayerIds: string[]) {
    if (actionLoading) return
    setActionLoading(true)
    const allPlayerIds = leaderboard.map((p) => p.id)

    await Promise.all(
      allPlayerIds.map((id) =>
        supabase
          .from('players')
          .update({ is_tiebreaker_participant: tiedPlayerIds.includes(id) })
          .eq('id', id),
      ),
    )

    setActionLoading(false)
    onRunTiebreaker(tiedPlayerIds)
  }

  async function endGame() {
    if (actionLoading) return
    setActionLoading(true)

    let pos = 1
    for (let i = 0; i < leaderboard.length; i++) {
      if (i > 0 && leaderboard[i].score < leaderboard[i - 1].score) pos = i + 1
      await supabase
        .from('players')
        .update({ final_position: pos })
        .eq('id', leaderboard[i].id)
    }

    await supabase.from('games').update({ status: 'ended' }).eq('id', game.id)
  }

  if (loading) {
    return <p className="animate-pulse text-center text-white/40">Loading results...</p>
  }

  const isFinalResults = game.is_final_round
  const tiebreakerAlreadyRan = game.tiebreaker_ran
  const tiedPositions = isFinalResults && !tiebreakerAlreadyRan ? getTiedPositions() : []
  const hasTies = tiedPositions.length > 0
  const allTiedPlayerIds = tiedPositions.flatMap((t) => t.players.map((p) => p.id))

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm font-semibold uppercase tracking-widest text-yellow-400">
        Round {game.current_round} · Results{isFinalResults ? ' · KRACRONYM' : ''}
      </p>

      {/* Vote results */}
      <div className="space-y-2">
        {results.map((answer, i) => (
          <div key={answer.id} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white/40 mb-0.5">
                  #{i + 1} · {answer.players?.name ?? '—'}
                  {answer.players?.team_name ? ` (${answer.players.team_name})` : ''}
                </p>
                <p className="text-sm text-white">{answer.content}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xl font-black text-yellow-400">{answer.vote_count}</p>
                <p className="text-xs text-white/30">votes</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Leaderboard */}
      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-3">
          Leaderboard
        </p>
        {leaderboard.map((player, i) => {
          const displayName = player.role === 'team_leader' && player.team_name
            ? player.team_name
            : player.name
          return (
            <div key={player.id} className="flex items-center gap-3">
              <span className="text-xs font-bold text-white/30 w-4">#{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{displayName}</p>
                {player.role === 'team_leader' && player.team_name && (
                  <p className="text-xs text-white/30 truncate">led by {player.name}</p>
                )}
              </div>
              <p className="text-sm font-black text-white">{player.score}</p>
            </div>
          )
        })}
      </div>

      {/* --- Post-KRACRONYM: tie detection & end game --- */}
      {isFinalResults ? (
        tiebreakerAlreadyRan ? (
          <button
            onClick={endGame}
            disabled={actionLoading}
            className="w-full rounded-xl bg-yellow-400 py-4 text-lg font-bold text-black transition-all hover:bg-yellow-300 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {actionLoading ? 'Ending...' : 'End Game →'}
          </button>
        ) : (
          <div className="space-y-4">
            {hasTies ? (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-4 space-y-3">
                <p className="text-sm font-semibold text-red-400">Ties detected!</p>
                {tiedPositions.map(({ position, players }) => (
                  <p key={position} className="text-sm text-white">
                    <span className="font-bold text-white/60">#{position}:</span>{' '}
                    {players.map((p) =>
                      p.role === 'team_leader' && p.team_name ? p.team_name : p.name
                    ).join(' vs ')}
                  </p>
                ))}
                <button
                  onClick={() => runTiebreaker(allTiedPlayerIds)}
                  disabled={actionLoading}
                  className="w-full rounded-xl bg-red-500 py-3 font-bold text-white transition-all hover:bg-red-400 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {actionLoading ? 'Setting up...' : 'Run Tiebreaker ⚡'}
                </button>
              </div>
            ) : (
              <p className="text-center text-sm text-green-400">No ties — clear winner!</p>
            )}
            <button
              onClick={endGame}
              disabled={actionLoading}
              className="w-full rounded-xl bg-yellow-400 py-4 text-lg font-bold text-black transition-all hover:bg-yellow-300 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLoading ? 'Ending...' : 'End Game →'}
            </button>
          </div>
        )
      ) : (
        <div className="space-y-3">
          <button
            onClick={onNextRound}
            className="w-full rounded-xl bg-yellow-400 py-4 text-lg font-bold text-black transition-all hover:bg-yellow-300 active:scale-95"
          >
            Next Round →
          </button>
          <button
            onClick={onTakeBreak}
            className="w-full rounded-xl border border-white/20 py-3 font-semibold text-white/70 transition-all hover:bg-white/10 active:scale-95"
          >
            Take a Break
          </button>
          <button
            onClick={onFinalRound}
            className="w-full rounded-xl bg-red-500 py-4 text-lg font-bold text-white transition-all hover:bg-red-400 active:scale-95"
          >
            ⚡ Final Round — KRACRONYM
          </button>
        </div>
      )}
    </div>
  )
}
