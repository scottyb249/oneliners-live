'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Game, Answer, Player } from '@/lib/types'
import BigCountdown from '../components/BigCountdown'

interface Props {
  game: Game
  answerCount: number
}

export default function TiebreakerView({ game, answerCount }: Props) {
  const [subPhase, setSubPhase] = useState<'submitting' | 'voting'>('submitting')
  const [answers, setAnswers] = useState<Answer[]>([])
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({})
  const [tiedPosition, setTiedPosition] = useState<number | null>(null)
  const [tiedPlayers, setTiedPlayers] = useState<string[]>([])

  const handleSubmitExpire = useCallback(() => setSubPhase('voting'), [])

  // Fetch tied position context
  useEffect(() => {
    async function loadTieContext() {
      const { data } = await supabase
        .from('players')
        .select('id, name, score, is_tiebreaker_participant')
        .eq('game_id', game.id)
        .eq('is_host', false)
        .order('score', { ascending: false })

      if (!data) return
      const participants = (data as Player[]).filter((p) => p.is_tiebreaker_participant)
      const names = participants.map((p) => p.name)
      setTiedPlayers(names)

      if (participants.length > 0) {
        const pos = (data as Player[]).findIndex((p) => p.id === participants[0].id) + 1
        setTiedPosition(pos)
      }
    }
    loadTieContext()
  }, [game.id])

  // Load tiebreaker answers when voting phase begins
  useEffect(() => {
    if (subPhase !== 'voting') return

    async function loadAnswers() {
      const [{ data: ans }, { data: votes }] = await Promise.all([
        supabase
          .from('answers')
          .select('id, content')
          .eq('game_id', game.id)
          .eq('round', game.current_round)
          .eq('approved', true)
          .eq('is_tiebreaker', true),
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
    }
    loadAnswers()

    const channel = supabase
      .channel(`display-tb-votes-${game.id}`)
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
  }, [subPhase, game.id, game.current_round])

  const sorted = [...answers].sort(
    (a, b) => (voteCounts[b.id] ?? 0) - (voteCounts[a.id] ?? 0),
  )
  const maxVotes = Math.max(...Object.values(voteCounts), 1)
  const totalVotes = Object.values(voteCounts).reduce((s, n) => s + n, 0)

  return (
    <div className="flex flex-1 flex-col items-center gap-8 px-12 py-8">
      {/* TIEBREAKER header */}
      <div className="text-center">
        <p
          className="font-black text-red-400 leading-none animate-pulse"
          style={{ fontSize: 'clamp(2.5rem, 8vw, 7rem)' }}
        >
          ⚡ TIEBREAKER
        </p>
        {tiedPosition !== null && tiedPlayers.length > 0 && (
          <p
            className="mt-2 text-white/50 font-semibold"
            style={{ fontSize: 'clamp(0.875rem, 2vw, 1.75rem)' }}
          >
            Position #{tiedPosition} contested —{' '}
            <span className="text-white">{tiedPlayers.join(' vs ')}</span>
          </p>
        )}
      </div>

      {/* Acronym */}
      <p
        className="font-black tracking-[0.4em] text-white leading-none"
        style={{ fontSize: 'clamp(4rem, 18vw, 14rem)' }}
      >
        {game.current_acronym ?? '—'}
      </p>

      {subPhase === 'submitting' ? (
        <>
          <div className="w-full max-w-3xl">
            <BigCountdown key="tb-display-submit" totalSeconds={60} onExpire={handleSubmitExpire} />
          </div>
          <p
            className="text-white/40 font-semibold"
            style={{ fontSize: 'clamp(1rem, 2vw, 1.75rem)' }}
          >
            {answerCount} {answerCount === 1 ? 'answer' : 'answers'} submitted
          </p>
        </>
      ) : (
        <div className="flex w-full flex-1 flex-col gap-5">
          <div className="w-full">
            <BigCountdown key="tb-display-vote" totalSeconds={90} />
          </div>
          <p
            className="text-white/30 text-center font-semibold"
            style={{ fontSize: 'clamp(0.875rem, 1.5vw, 1.25rem)' }}
          >
            {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'} cast
          </p>
          <div className="flex flex-col gap-3">
            {sorted.map((answer) => {
              const count = voteCounts[answer.id] ?? 0
              const pct = (count / maxVotes) * 100
              return (
                <div
                  key={answer.id}
                  className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 px-6 py-4"
                >
                  <div
                    className="absolute inset-y-0 left-0 rounded-2xl bg-red-500/10 transition-all duration-700"
                    style={{ width: `${pct}%` }}
                  />
                  <div className="relative flex items-center justify-between gap-6">
                    <p
                      className="flex-1 font-semibold text-white"
                      style={{ fontSize: 'clamp(1rem, 2.2vw, 2rem)' }}
                    >
                      {answer.content}
                    </p>
                    <p
                      className="shrink-0 font-black text-red-400 tabular-nums"
                      style={{ fontSize: 'clamp(1.5rem, 3.5vw, 3rem)' }}
                    >
                      {count}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
