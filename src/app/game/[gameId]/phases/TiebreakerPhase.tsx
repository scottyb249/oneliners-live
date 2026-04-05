'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Game, Player, Answer } from '../types'
import CountdownTimer from '@/app/components/CountdownTimer'

interface Props {
  game: Game
  player: Player
}

export default function TiebreakerPhase({ game, player }: Props) {
  // Two internal sub-phases: submitting (60s) → voting (90s)
  const [subPhase, setSubPhase] = useState<'submitting' | 'voting'>('submitting')

  // Submission state
  const [answer, setAnswer] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [inputLocked, setInputLocked] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Voting state
  const [answers, setAnswers] = useState<Answer[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hasVoted, setHasVoted] = useState(false)
  const [voteLocked, setVoteLocked] = useState(false)
  const [answersLoading, setAnswersLoading] = useState(false)

  const [error, setError] = useState('')

  const handleSubmitExpire = useCallback(() => {
    setInputLocked(true)
    setSubPhase('voting')
  }, [])

  const handleVoteExpire = useCallback(() => setVoteLocked(true), [])

  // Load tiebreaker answers when voting starts
  useEffect(() => {
    if (subPhase !== 'voting') return
    setAnswersLoading(true)

    async function loadAnswers() {
      const { data: existingVote } = await supabase
        .from('votes')
        .select('id, answer_id')
        .eq('game_id', game.id)
        .eq('voter_id', player.id)
        .eq('round', game.current_round)
        .maybeSingle()

      if (existingVote) {
        setSelectedId(existingVote.answer_id)
        setHasVoted(true)
        setVoteLocked(true)
      }

      const { data } = await supabase
        .from('answers')
        .select('*, players(name, team_name)')
        .eq('game_id', game.id)
        .eq('approved', true)
        .eq('is_tiebreaker', true)
        .eq('round', game.current_round)
        .limit(10)

      if (data) setAnswers(data as Answer[])
      setAnswersLoading(false)
    }
    loadAnswers()
  }, [subPhase, game.id, game.current_round, player.id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!answer.trim() || submitting || inputLocked) return
    setSubmitting(true)
    setError('')

    const { error: insertError } = await supabase.from('answers').insert({
      game_id: game.id,
      player_id: player.id,
      round: game.current_round,
      content: answer.trim(),
      submitted_at: new Date().toISOString(),
      approved: false,
      is_tiebreaker: true,
    })

    if (insertError) {
      setError('Failed to submit. Try again.')
      setSubmitting(false)
      return
    }

    setSubmitted(true)
    setInputLocked(true)
  }

  function isHidden(a: Answer): boolean {
    if (player.role === 'crowd_voter') return false
    if (player.role === 'individual') return a.player_id === player.id
    const sameTeam =
      !!player.team_name &&
      !!a.players?.team_name &&
      a.players.team_name === player.team_name
    return sameTeam
  }

  async function handleVote(answerId: string) {
    if (voteLocked || hasVoted) return
    setSelectedId(answerId)
    setVoteLocked(true)

    const { error: voteError } = await supabase.from('votes').insert({
      game_id: game.id,
      voter_id: player.id,
      answer_id: answerId,
      round: game.current_round,
    })

    if (voteError) {
      setError('Failed to record vote. Please try again.')
      setSelectedId(null)
      setVoteLocked(false)
      return
    }

    setHasVoted(true)
  }

  // --- Submitting sub-phase ---
  if (subPhase === 'submitting') {
    return (
      <div className="flex w-full max-w-md flex-col gap-8">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-red-400">
            ⚡ Tiebreaker · Round {game.current_round}
          </p>
          <p className="mt-3 text-7xl font-black tracking-[0.35em] text-white">
            {game.current_acronym ?? '—'}
          </p>
        </div>

        <CountdownTimer key="tb-submit" seconds={60} onExpire={handleSubmitExpire} />

        {player.is_tiebreaker_participant ? (
          submitted || inputLocked ? (
            <div className="rounded-2xl border border-green-500/30 bg-green-500/10 px-6 py-5 text-center">
              <p className="text-lg font-bold text-green-400">Tiebreaker submitted!</p>
              <p className="mt-1 text-sm text-white/40">Voting opens next.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Your tiebreaker one-liner..."
                maxLength={200}
                rows={3}
                disabled={inputLocked}
                className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/20 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-400/30 disabled:opacity-40"
              />
              {error && <p className="text-sm text-red-400">{error}</p>}
              <button
                type="submit"
                disabled={!answer.trim() || submitting || inputLocked}
                className="w-full rounded-xl bg-red-500 px-6 py-4 text-lg font-bold text-white transition-all hover:bg-red-400 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit Tiebreaker →'}
              </button>
            </form>
          )
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-5 text-center">
            <p className="text-3xl">⚡</p>
            <p className="mt-3 font-semibold text-white">Tiebreaker in progress</p>
            <p className="mt-1 text-sm text-white/40">
              Get ready to vote on the tiebreaker answers.
            </p>
          </div>
        )}
      </div>
    )
  }

  // --- Voting sub-phase ---
  const visibleAnswers = answers.filter((a) => !isHidden(a))

  return (
    <div className="flex w-full max-w-md flex-col gap-6">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-red-400">
          ⚡ Tiebreaker Vote
        </p>
        <p className="mt-1 text-2xl font-bold text-white">Pick the best tiebreaker</p>
        {hasVoted && (
          <p className="mt-2 text-sm font-medium text-green-400">Vote locked in! ✓</p>
        )}
      </div>

      <CountdownTimer key="tb-vote" seconds={90} onExpire={handleVoteExpire} />

      {answersLoading ? (
        <p className="text-center animate-pulse text-white/40">Loading answers...</p>
      ) : visibleAnswers.length === 0 ? (
        <p className="text-center text-white/40">No tiebreaker answers to vote on.</p>
      ) : (
        <div className="space-y-3">
          {visibleAnswers.map((a) => (
            <button
              key={a.id}
              onClick={() => handleVote(a.id)}
              disabled={voteLocked}
              className={`w-full rounded-xl border px-5 py-4 text-left transition-all active:scale-[0.98] ${
                selectedId === a.id
                  ? 'border-red-400 bg-red-400/10 ring-2 ring-red-400/30'
                  : 'border-white/10 bg-white/5 hover:border-white/30 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60'
              }`}
            >
              <p className="text-base text-white">{a.content}</p>
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-center text-sm text-red-400">{error}</p>}
    </div>
  )
}
