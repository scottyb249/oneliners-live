'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Game, Answer } from '@/lib/types'

interface Props {
  game: Game
  onNextRound: () => void
  onTakeBreak: () => void
  onFinalRound: () => void
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

interface ResolvedTie {
  position: number
  players: { name: string; team_name: string | null; role: string }[]
}

const PODIUM_STEP_LABELS = [
  'Showing KRACRONYM results',
  'Revealing leaderboard (4th+)',
  'Revealing 3rd place',
  'Revealing 2nd place',
  '1st place revealed — End Game when ready',
]

export default function ResultsPanel({ game, onNextRound, onTakeBreak, onFinalRound }: Props) {
  const [results, setResults] = useState<AnswerWithVotes[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [resolvedTies, setResolvedTies] = useState<ResolvedTie[]>([])
  const [speedResolutionDone, setSpeedResolutionDone] = useState(false)
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [leaderboardOnDisplay, setLeaderboardOnDisplay] = useState(false)

  const revealIndex = game.reveal_index ?? -1
  const podiumStep = game.podium_step ?? 0
  const isFinalResults = game.is_final_round

  // Results are sorted lowest votes → highest votes for bottom-up reveal
  // revealIndex 0 = last item in array (lowest), counts up toward index 0 (highest)
  // We store results sorted high→low but reveal from the end
  const allRevealed = results.length > 0 && revealIndex >= results.length - 1

  // The "revealed" answers are the last (revealIndex+1) items in the array
  // i.e. index >= results.length - 1 - revealIndex
  const revealThreshold = results.length - 1 - revealIndex

  const nextUpAnswer = !allRevealed && results.length > 0
    ? results[revealThreshold - 1]
    : null

  useEffect(() => {
    async function load() {
      const [{ data: answers }, { data: votes }, { data: players }] = await Promise.all([
        supabase
          .from('answers')
          .select('*, players(name, team_name)')
          .eq('game_id', game.id)
          .eq('approved', true)
          .eq('is_tiebreaker', false)
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
          .in('role', ['individual', 'team_leader'])
          .order('score', { ascending: false }),
      ])

      const tally: Record<string, number> = {}
      for (const v of votes ?? []) {
        tally[v.answer_id] = (tally[v.answer_id] ?? 0) + 1
      }

      // Sort high → low so that reveal from the end = low → high
      const withVotes: AnswerWithVotes[] = ((answers ?? []) as Answer[])
        .map((a) => ({ ...a, vote_count: tally[a.id] ?? 0 }))
        .sort((a, b) => b.vote_count - a.vote_count)

      setResults(withVotes)
      setLeaderboard((players ?? []) as LeaderboardEntry[])
      setLoading(false)
    }
    load()
  }, [game.id, game.current_round])

  useEffect(() => {
    if (!game.is_final_round || loading || speedResolutionDone) return
    if (game.tiebreaker_ran) {
      setSpeedResolutionDone(true)
      return
    }
    resolveBySpeed()
  }, [loading, game.is_final_round, game.tiebreaker_ran])

  function getTiedGroups(): { position: number; players: LeaderboardEntry[] }[] {
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

  async function resolveBySpeed() {
    const tiedGroups = getTiedGroups()
    if (tiedGroups.length === 0) {
      setSpeedResolutionDone(true)
      return
    }

    const resolved: ResolvedTie[] = []

    for (const group of tiedGroups) {
      const tiedIds = group.players.map((p) => p.id)

      const { data: answers } = await supabase
        .from('answers')
        .select('player_id, submitted_at')
        .eq('game_id', game.id)
        .eq('round', game.current_round)
        .eq('is_tiebreaker', false)
        .in('player_id', tiedIds)

      const sorted = (answers ?? []).slice().sort((a, b) => {
        const diff = new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime()
        if (diff !== 0) return diff
        return Math.random() - 0.5
      })

      for (let i = 0; i < sorted.length; i++) {
        await supabase
          .from('players')
          .update({ final_position: group.position + i })
          .eq('id', sorted[i].player_id)
      }

      const sortedPlayers = sorted
        .map((a) => group.players.find((p) => p.id === a.player_id)!)
        .filter(Boolean)

      resolved.push({ position: group.position, players: sortedPlayers })
    }

    await supabase.from('games').update({ tiebreaker_ran: true }).eq('id', game.id)
    setResolvedTies(resolved)
    setSpeedResolutionDone(true)
  }

  async function revealNextAnswer() {
    const next = revealIndex + 1
    if (next >= results.length) return
    await supabase.from('games').update({ reveal_index: next }).eq('id', game.id)
  }

  async function revealAllAnswers() {
    await supabase.from('games').update({ reveal_index: results.length - 1 }).eq('id', game.id)
  }

  async function resetReveal() {
    await supabase.from('games').update({ reveal_index: -1 }).eq('id', game.id)
  }

  async function nextPodiumStep() {
    const next = Math.min(podiumStep + 1, 4)
    await supabase.from('games').update({ podium_step: next }).eq('id', game.id)
  }

  async function toggleLeaderboardOnDisplay() {
    const next = !leaderboardOnDisplay
    setLeaderboardOnDisplay(next)
    // Use podium_step = 1 to show leaderboard on display, 0 to hide
    // Only for non-final rounds — final round uses its own podium sequence
    if (!isFinalResults) {
      await supabase.from('games').update({ podium_step: next ? 1 : 0 }).eq('id', game.id)
    }
    setShowLeaderboard(next)
  }

  async function endGame() {
    if (actionLoading) return
    setActionLoading(true)

    const { data: players } = await supabase
      .from('players')
      .select('id, score, final_position')
      .eq('game_id', game.id)
      .in('role', ['individual', 'team_leader'])
      .order('score', { ascending: false })

    const list = players ?? []
    let pos = 1
    for (let i = 0; i < list.length; i++) {
      if (i > 0 && list[i].score < list[i - 1].score) pos = i + 1
      if (list[i].final_position == null) {
        await supabase.from('players').update({ final_position: pos }).eq('id', list[i].id)
      }
    }

    await supabase.from('games').update({ status: 'ended' }).eq('id', game.id)
  }

  if (loading) {
    return <p className="animate-pulse text-center text-white/40">Loading results...</p>
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm font-semibold uppercase tracking-widest text-yellow-400">
        Round {game.current_round} · Results{isFinalResults ? ' · KRACRONYM' : ''}
      </p>

      {/* Answer reveal controls */}
      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/30">
            Answer Reveal
          </p>
          <p className="text-xs text-white/40">
            {revealIndex + 1} / {results.length} shown
          </p>
        </div>

        {/* Next up preview */}
        {nextUpAnswer && (
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <p className="text-xs text-white/30 mb-0.5">Next up:</p>
            <p className="text-sm font-semibold text-white/80">{nextUpAnswer.content}</p>
            <p className="text-xs text-white/30 mt-0.5">
              {nextUpAnswer.players?.name ?? '—'} · {nextUpAnswer.vote_count} votes
            </p>
          </div>
        )}

        <div className="flex gap-2 items-center">
          <button
            onClick={revealNextAnswer}
            disabled={allRevealed}
            className="rounded-xl bg-yellow-400 px-4 py-2 text-sm font-bold text-black transition-all hover:bg-yellow-300 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {allRevealed ? '✓ All Revealed' : 'Reveal Next →'}
          </button>
          {!allRevealed && (
            <button
              onClick={revealAllAnswers}
              className="rounded-xl border border-white/20 px-3 py-2 text-xs font-semibold text-white/50 hover:bg-white/10 active:scale-95 transition-all"
            >
              All
            </button>
          )}
          {revealIndex >= 0 && (
            <button
              onClick={resetReveal}
              className="rounded-xl border border-white/20 px-3 py-2 text-xs font-semibold text-white/50 hover:bg-white/10 active:scale-95 transition-all"
            >
              ↺
            </button>
          )}
        </div>
      </div>

      {/* Vote results — displayed high→low, revealed from the bottom up */}
      <div className="space-y-1.5">
        {results.map((answer, i) => {
          const isRevealed = i >= revealThreshold
          return (
            <div
              key={answer.id}
              className={`rounded-xl border px-4 py-2.5 transition-all duration-300 ${
                isRevealed
                  ? 'border-white/10 bg-white/5 opacity-100'
                  : 'border-white/5 bg-white/[0.02] opacity-25'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white/40 mb-0.5">
                    {answer.players?.name ?? '—'}
                    {answer.players?.team_name ? ` (${answer.players.team_name})` : ''}
                  </p>
                  <p className="text-sm text-white">{answer.content}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-black text-yellow-400">{answer.vote_count}</p>
                  <p className="text-xs text-white/30">votes</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Host leaderboard toggle (non-final rounds) */}
      {!isFinalResults && (
        <button
          onClick={toggleLeaderboardOnDisplay}
          className={`w-full rounded-xl border py-3 text-sm font-bold transition-all ${
            leaderboardOnDisplay
              ? 'border-yellow-400 bg-yellow-400/10 text-yellow-400'
              : 'border-white/20 text-white/60 hover:border-white/40 hover:text-white'
          }`}
        >
          {leaderboardOnDisplay ? '📊 Hide Leaderboard on Display' : '📊 Show Leaderboard on Display'}
        </button>
      )}

      {/* Host-side leaderboard preview */}
      {showLeaderboard && (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-3">
            Leaderboard
          </p>
          {leaderboard.map((player, i) => {
            const displayName =
              player.role === 'team_leader' && player.team_name ? player.team_name : player.name
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
      )}

      {/* Speed resolution notice */}
      {isFinalResults && resolvedTies.length > 0 && (
        <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 px-4 py-4 space-y-2">
          <p className="text-sm font-semibold text-blue-400">⚡ Tie broken by submission speed</p>
          {resolvedTies.map(({ position, players }) => (
            <p key={position} className="text-sm text-white">
              <span className="font-bold text-white/60">#{position}:</span>{' '}
              {players
                .map((p) => (p.role === 'team_leader' && p.team_name ? p.team_name : p.name))
                .join(' → ')}
            </p>
          ))}
        </div>
      )}

      {/* KRACRONYM podium reveal controls */}
      {isFinalResults && (
        <div className="rounded-2xl border border-yellow-400/20 bg-yellow-400/5 px-4 py-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest text-yellow-400">
              Podium Reveal
            </p>
            <p className="text-xs text-yellow-400/60">Step {podiumStep + 1} / 5</p>
          </div>
          <p className="text-xs text-white/50">{PODIUM_STEP_LABELS[podiumStep]}</p>
          {podiumStep < 4 ? (
            <button
              onClick={nextPodiumStep}
              disabled={!speedResolutionDone}
              className="w-full rounded-xl bg-yellow-400 py-3 text-sm font-bold text-black transition-all hover:bg-yellow-300 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {!speedResolutionDone ? 'Resolving ties...' : 'Next Reveal →'}
            </button>
          ) : (
            <button
              onClick={endGame}
              disabled={actionLoading}
              className="w-full rounded-xl bg-green-500 py-3 text-sm font-bold text-white transition-all hover:bg-green-400 active:scale-95 disabled:opacity-50"
            >
              {actionLoading ? 'Ending...' : '🎉 End Game & Show Podium →'}
            </button>
          )}
        </div>
      )}

      {/* Non-final action buttons */}
      {!isFinalResults && (
        <div className="space-y-3 pt-2">
          <button
            onClick={onNextRound}
            className="w-full rounded-xl bg-yellow-400 py-4 text-lg font-bold text-black transition-all hover:bg-yellow-300 active:scale-95"
          >
            Next Round →
          </button>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={onTakeBreak}
              className="rounded-xl border border-white/20 py-3 text-sm font-semibold text-white/70 transition-all hover:bg-white/10 active:scale-95"
            >
              ☕ Take a Break
            </button>
            <button
              onClick={onFinalRound}
              className="rounded-xl bg-red-500/80 py-3 text-sm font-bold text-white transition-all hover:bg-red-500 active:scale-95"
            >
              ⚡ KRACRONYM
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
