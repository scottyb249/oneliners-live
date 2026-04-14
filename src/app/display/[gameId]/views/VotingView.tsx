'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Game, Answer } from '@/lib/types'
import BigCountdown from '../components/BigCountdown'
import { VOTING_TIMER_DURATION } from '@/lib/constants'

interface Props {
  game: Game
}

export default function VotingView({ game }: Props) {
  const [answers, setAnswers] = useState<Answer[]>([])
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: ans }, { data: votes }] = await Promise.all([
        supabase
          .from('answers')
          .select('id, content, is_fastest')
          .eq('game_id', game.id)
          .eq('round', game.current_round)
          .eq('approved', true)
          .eq('is_tiebreaker', false)
          .limit(10),
        supabase
          .from('votes')
          .select('answer_id')
          .eq('game_id', game.id)
          .eq('round', game.current_round),
      ])

      if (ans) setAnswers(ans as Answer[])

      const counts: Record<string, number> = {}
      for (const v of votes ?? []) {
        counts[v.answer_id] = (counts[v.answer_id] ?? 0) + 1
      }
      setVoteCounts(counts)
      setLoading(false)
    }
    load()

    const channel = supabase
      .channel(`display-votes-${game.id}-${game.current_round}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'votes', filter: `game_id=eq.${game.id}` },
        (payload) => {
          const v = payload.new as { answer_id: string; round: number }
          if (v.round === game.current_round) {
            setVoteCounts((prev) => ({
              ...prev,
              [v.answer_id]: (prev[v.answer_id] ?? 0) + 1,
            }))
          }
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [game.id, game.current_round])

  const sorted = [...answers].sort(
    (a, b) => (voteCounts[b.id] ?? 0) - (voteCounts[a.id] ?? 0),
  )
  const maxVotes = Math.max(...Object.values(voteCounts), 1)
  const totalVotes = Object.values(voteCounts).reduce((s, n) => s + n, 0)

  return (
    <div className="relative flex flex-1 flex-col gap-3 px-10 py-5">
      {/* Header row */}
      <div>
        <p
          className="font-semibold uppercase tracking-[0.4em] text-yellow-400"
          style={{ fontSize: 'clamp(0.75rem, 1.2vw, 1rem)' }}
        >
          Round {game.current_round} · Vote
        </p>
        <p
          className="font-black text-white leading-tight"
          style={{ fontSize: 'clamp(1.25rem, 3vw, 2.5rem)' }}
        >
          Pick your favourite one-liner
        </p>
      </div>

      {/* Answer cards */}
      {loading ? (
        <p className="animate-pulse text-center text-white/30">Loading answers...</p>
      ) : (
        <div className="flex flex-1 flex-col justify-center gap-2">
          {sorted.map((answer) => {
            const count = voteCounts[answer.id] ?? 0
            const pct = (count / maxVotes) * 100
            const isFastest = (answer as any).is_fastest

            return (
              <div
                key={answer.id}
                className="relative overflow-hidden rounded-xl border border-white/10 bg-white/5 px-5 py-3"
              >
                <div
                  className="absolute inset-y-0 left-0 rounded-xl bg-blue-500/10 transition-all duration-700"
                  style={{ width: `${pct}%` }}
                />
                <div className="relative flex items-center justify-between gap-6">
                  <div className="flex-1 min-w-0">
                    <p
                      className="font-semibold text-white leading-snug"
                      style={{ fontSize: 'clamp(0.875rem, 1.8vw, 1.5rem)' }}
                    >
                      {answer.content}
                    </p>
                    {isFastest && (
                      <p
                        className="text-yellow-400 font-bold mt-0.5"
                        style={{ fontSize: 'clamp(0.65rem, 1vw, 0.875rem)' }}
                      >
                        ⚡ Fastest Answer +1
                      </p>
                    )}
                  </div>
                  <p
                    className="shrink-0 font-black text-white tabular-nums"
                    style={{ fontSize: 'clamp(1.25rem, 2.5vw, 2rem)' }}
                  >
                    {count}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Timer + votes cast — pinned bottom-right corner */}
      <div className="absolute bottom-4 right-10 flex items-center gap-3">
        <p
          className="font-bold text-white/70"
          style={{ fontSize: 'clamp(0.75rem, 1.2vw, 1rem)' }}
        >
          {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'} cast
        </p>
        <div className="w-32 shrink-0">
          <BigCountdown
            key={`voting-${game.current_round}`}
            totalSeconds={VOTING_TIMER_DURATION}
            compact
          />
        </div>
      </div>
    </div>
  )
}
