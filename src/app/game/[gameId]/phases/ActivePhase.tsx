'use client'

import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Game, Player } from '../types'
import CountdownTimer from '@/app/components/CountdownTimer'

interface Props {
  game: Game
  player: Player
}

export default function ActivePhase({ game, player }: Props) {
  const [answer, setAnswer] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [locked, setLocked] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleExpire = useCallback(() => setLocked(true), [])

  const canSubmit = player.role === 'individual' || player.role === 'team_leader'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!answer.trim() || submitting || locked) return
    setSubmitting(true)
    setError('')

    const { error: insertError } = await supabase.from('answers').insert({
      game_id: game.id,
      player_id: player.id,
      round: game.current_round,
      content: answer.trim(),
      submitted_at: new Date().toISOString(),
      approved: false,
      is_tiebreaker: false,
    })

    if (insertError) {
      setError('Failed to submit. Try again.')
      setSubmitting(false)
      return
    }

    setSubmitted(true)
    setLocked(true)
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-8">
      {/* Acronym display */}
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-yellow-400">
          Round {game.current_round}
        </p>
        <p className="mt-3 text-7xl font-black tracking-[0.35em] text-white">
          {game.current_acronym ?? '—'}
        </p>
        <p className="mt-2 text-sm text-white/30">Write a one-liner for each letter</p>
      </div>

      <CountdownTimer key={`active-r${game.current_round}`} seconds={60} onExpire={handleExpire} />

      {/* Role-based submission UI */}
      {canSubmit ? (
        submitted || locked ? (
          <div className="rounded-2xl border border-green-500/30 bg-green-500/10 px-6 py-5 text-center">
            <p className="text-lg font-bold text-green-400">Answer submitted!</p>
            <p className="mt-1 text-sm text-white/40">Get ready to vote.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Type your one-liner here..."
              maxLength={200}
              rows={3}
              disabled={locked}
              className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/20 focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/30 disabled:opacity-40"
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={!answer.trim() || submitting || locked}
              className="w-full rounded-xl bg-yellow-400 px-6 py-4 text-lg font-bold text-black transition-all hover:bg-yellow-300 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Answer →'}
            </button>
          </form>
        )
      ) : player.role === 'team_member' ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-5 text-center">
          <p className="text-3xl">🤝</p>
          <p className="mt-3 font-semibold text-white">Your Team Leader is submitting for your team.</p>
          <p className="mt-1 text-sm text-white/40">Cheer them on!</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-5 text-center">
          <p className="text-3xl">🗳️</p>
          <p className="mt-3 font-semibold text-white">Get ready to vote!</p>
          <p className="mt-1 text-sm text-white/40">Voting opens when the round ends.</p>
        </div>
      )}
    </div>
  )
}
