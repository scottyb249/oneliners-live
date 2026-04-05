'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Game, Answer } from '@/lib/types'
import CountdownTimer from '@/app/components/CountdownTimer'

interface Props {
  game: Game
}

export default function VotingPanel({ game }: Props) {
  const [answers, setAnswers] = useState<Answer[]>([])
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({})
  const [ending, setEnding] = useState(false)
  const [timerExpired, setTimerExpired] = useState(false)

  const isTiebreaker = game.status === 'tiebreaker'

  useEffect(() => {
    async function load() {
      const [{ data: ans }, { data: votes }] = await Promise.all([
        supabase
          .from('answers')
          .select('*')
          .eq('game_id', game.id)
          .eq('approved', true)
          .eq('is_tiebreaker', isTiebreaker)
          .eq('round', game.current_round),
        supabase
          .from('votes')
          .select('answer_id')
          .eq('game_id', game.id)
          .eq('round', game.current_round),
      ])

      if (ans) setAnswers(ans as Answer[])

      const counts: Record<string, number> = {}
      for (const vote of votes ?? []) {
        counts[vote.answer_id] = (counts[vote.answer_id] ?? 0) + 1
      }
      setVoteCounts(counts)
    }
    load()

    // Subscribe to new votes
    const channel = supabase
      .channel(`votes-host-${game.id}-${game.current_round}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'votes', filter: `game_id=eq.${game.id}` },
        (payload) => {
          const vote = payload.new as { answer_id: string; round: number }
          if (vote.round === game.current_round) {
            setVoteCounts((prev) => ({
              ...prev,
              [vote.answer_id]: (prev[vote.answer_id] ?? 0) + 1,
            }))
          }
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [game.id, game.current_round, isTiebreaker])

  const handleExpire = useCallback(() => setTimerExpired(true), [])

  const totalVotes = Object.values(voteCounts).reduce((s, n) => s + n, 0)

  const sorted = [...answers].sort(
    (a, b) => (voteCounts[b.id] ?? 0) - (voteCounts[a.id] ?? 0),
  )

  async function endVotingAndShowResults() {
    if (ending) return
    setEnding(true)

    // Tally votes per player answer
    const pointsPerPlayer: Record<string, number> = {}
    for (const answer of answers) {
      const pts = voteCounts[answer.id] ?? 0
      const multiplier = game.is_final_round ? 2 : 1
      pointsPerPlayer[answer.player_id] = (pointsPerPlayer[answer.player_id] ?? 0) + pts * multiplier
    }

    // Increment each player's score atomically
    await Promise.all(
      Object.entries(pointsPerPlayer).map(([playerId, amount]) =>
        amount > 0
          ? supabase.rpc('increment_score', { p_player_id: playerId, p_amount: amount })
          : Promise.resolve(),
      ),
    )

    // Transition to results
    const updates: Partial<Game> = { status: 'results' }
    if (isTiebreaker) updates.tiebreaker_ran = true

    await supabase.from('games').update(updates).eq('id', game.id)
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-widest text-yellow-400">
          {isTiebreaker ? '⚡ Tiebreaker' : `Round ${game.current_round}`} · Voting
        </p>
        <p className="mt-1 text-white/40 text-sm">{totalVotes} votes cast</p>
      </div>

      <CountdownTimer
        key={`host-voting-${game.current_round}`}
        seconds={90}
        onExpire={handleExpire}
      />

      {timerExpired && (
        <p className="text-center text-sm font-semibold text-yellow-400">
          Timer expired — end voting when ready.
        </p>
      )}

      {/* Live vote counts */}
      <div className="space-y-2">
        {sorted.map((answer) => {
          const count = voteCounts[answer.id] ?? 0
          const maxVotes = Math.max(...Object.values(voteCounts), 1)
          const pct = (count / maxVotes) * 100
          return (
            <div key={answer.id} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex items-start justify-between gap-3 mb-2">
                <p className="text-sm text-white flex-1">{answer.content}</p>
                <span className="text-xl font-black text-white shrink-0">{count}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-yellow-400 transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      <button
        onClick={endVotingAndShowResults}
        disabled={ending}
        className="w-full rounded-xl bg-yellow-400 py-4 text-lg font-bold text-black transition-all hover:bg-yellow-300 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {ending ? 'Saving...' : 'End Voting & Show Results →'}
      </button>
    </div>
  )
}
