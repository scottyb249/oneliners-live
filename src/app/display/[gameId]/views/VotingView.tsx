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
  const [totalVotes, setTotalVotes] = useState(0)
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

      if (ans) setAnswers(ans as unknown as Answer[])
      setTotalVotes((votes ?? []).length)
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
            setTotalVotes((prev) => prev + 1)
          }
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [game.id, game.current_round])

  return (
    <div className="relative flex flex-1 flex-col gap-3 px-10 py-5">
      {/* Header row */}
      <div>
        <p
          className="font-semibold uppercase tracking-[0.4em] text-yellow-400"
          style={{ fontSize: 'clamp(0.75rem, 1.2vw, 1rem)' }}
        >
          Round {game.current_round}{game.is_final_round ? ' · KRACRONYM' : ''} · Vote
        </p>
        <p
          className="font-black text-white leading-tight"
          style={{ fontSize: 'clamp(1.25rem, 3vw, 2.5rem)' }}
        >
          Pick your favourite one-liner
        </p>
      </div>

      {/* Answer cards — no live vote counts shown */}
      {loading ? (
        <p className="animate-pulse text-center text-white/30">Loading answers...</p>
      ) : (
        <div className="flex flex-1 flex-col justify-center gap-3">
          {answers.map((answer, i) => {
            const isFastest = (answer as any).is_fastest
            return (
              <div
                key={answer.id}
                className="rounded-xl border border-white/10 bg-white/5 px-5 py-4"
              >
                <div className="flex items-center gap-4">
                  <span
                    className="font-black text-white/20 shrink-0 tabular-nums"
                    style={{ fontSize: 'clamp(1rem, 2vw, 1.5rem)' }}
                  >
                    {i + 1}
                  </span>
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
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Timer + votes cast — pinned bottom-right */}
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
