'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Game } from '@/lib/types'
import CountdownTimer from '@/app/components/CountdownTimer'

interface Props {
  game: Game
}

export default function TiebreakerPanel({ game }: Props) {
  const [submissionCount, setSubmissionCount] = useState(0)
  const [phase, setPhase] = useState<'submitting' | 'voting'>('submitting')

  const handleSubmitExpire = useCallback(() => setPhase('voting'), [])

  useEffect(() => {
    if (game.tiebreaker_voting) setPhase('voting')
  }, [game.tiebreaker_voting])

  useEffect(() => {
    async function loadCount() {
      const { count } = await supabase
        .from('answers')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', game.id)
        .eq('round', game.current_round)
        .eq('is_tiebreaker', true)

      setSubmissionCount(count ?? 0)
    }
    loadCount()

    const channel = supabase
      .channel(`tb-answers-${game.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'answers', filter: `game_id=eq.${game.id}` },
        () => setSubmissionCount((prev) => prev + 1),
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [game.id, game.current_round])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-widest text-red-400">
          ⚡ Tiebreaker · Round {game.current_round}
        </p>
        <p className="mt-1 text-3xl font-black tracking-widest text-white">
          {game.current_acronym}
        </p>
      </div>

      {phase === 'submitting' ? (
        <>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-center">
            <p className="text-sm text-white/40">Tiebreaker submissions</p>
            <p className="text-4xl font-black text-white mt-1">{submissionCount}</p>
          </div>
          <CountdownTimer key="tb-host-submit" seconds={60} onExpire={handleSubmitExpire} />
          <p className="text-center text-sm text-white/30">
            Players are submitting their tiebreaker answers...
          </p>
          <button
            onClick={async () => {
              await supabase.from('games').update({ tiebreaker_voting: true }).eq('id', game.id)
            }}
            className="w-full rounded-xl border border-white/20 py-3 font-semibold text-white/60 transition-all hover:bg-white/10"
          >
            Skip to Voting →
          </button>
        </>
      ) : (
        <>
          <p className="text-center text-sm font-semibold text-yellow-400">
            Players are voting on tiebreaker answers
          </p>
          <p className="text-center text-sm text-white/30">
            Use the voting panel once you end the tiebreaker.
          </p>
          {/* The game.status is still 'tiebreaker' here.
              VotingPanel renders when status = 'voting', so we
              surface a direct end-tiebreaker button here instead. */}
          <TiebreakerVotingView game={game} />
        </>
      )}
    </div>
  )
}

// Inline voting view for tiebreaker — mirrors VotingPanel but for tiebreaker answers
function TiebreakerVotingView({ game }: { game: Game }) {
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({})
  const [answers, setAnswers] = useState<{ id: string; content: string }[]>([])
  const [ending, setEnding] = useState(false)

  useEffect(() => {
    async function load() {
      const [{ data: ans }, { data: votes }] = await Promise.all([
        supabase
          .from('answers')
          .select('id, content')
          .eq('game_id', game.id)
          .eq('round', game.current_round)
          .eq('is_tiebreaker', true)
          .eq('approved', true),
        supabase
          .from('votes')
          .select('answer_id')
          .eq('game_id', game.id)
          .eq('round', game.current_round),
      ])

      if (ans) setAnswers(ans)

      const counts: Record<string, number> = {}
      for (const v of votes ?? []) {
        counts[v.answer_id] = (counts[v.answer_id] ?? 0) + 1
      }
      setVoteCounts(counts)
    }
    load()

    const channel = supabase
      .channel(`tb-votes-host-${game.id}`)
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

  async function endTiebreaker() {
    if (ending) return
    setEnding(true)

    // Score tiebreaker answers (double points as it's final round)
    const pointsPerPlayer: Record<string, number> = {}
    for (const answer of answers) {
      const pts = voteCounts[answer.id] ?? 0
      pointsPerPlayer[(answer as { id: string; content: string; player_id?: string }).player_id ?? ''] =
        (pointsPerPlayer[(answer as { id: string; content: string; player_id?: string }).player_id ?? ''] ?? 0) + pts * 2
    }

    await Promise.all(
      Object.entries(pointsPerPlayer)
        .filter(([id, amt]) => id && amt > 0)
        .map(([id, amt]) =>
          supabase.rpc('increment_score', { p_player_id: id, p_amount: amt }),
        ),
    )

    await supabase
      .from('games')
      .update({ status: 'results', tiebreaker_ran: true, tiebreaker_voting: false })
      .eq('id', game.id)
  }

  const totalVotes = Object.values(voteCounts).reduce((s, n) => s + n, 0)
  const sorted = [...answers].sort(
    (a, b) => (voteCounts[b.id] ?? 0) - (voteCounts[a.id] ?? 0),
  )

  return (
    <div className="space-y-4">
      <p className="text-sm text-white/40">{totalVotes} votes cast</p>

      <div className="space-y-2">
        {sorted.map((answer) => {
          const count = voteCounts[answer.id] ?? 0
          const maxVotes = Math.max(...Object.values(voteCounts), 1)
          return (
            <div key={answer.id} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex items-start justify-between gap-3 mb-2">
                <p className="text-sm text-white flex-1">{answer.content}</p>
                <span className="text-xl font-black text-white shrink-0">{count}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-red-400 transition-all duration-500"
                  style={{ width: `${((count / maxVotes) * 100)}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      <button
        onClick={endTiebreaker}
        disabled={ending}
        className="w-full rounded-xl bg-yellow-400 py-4 text-lg font-bold text-black transition-all hover:bg-yellow-300 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {ending ? 'Saving...' : 'End Tiebreaker & Show Results →'}
      </button>
    </div>
  )
}
