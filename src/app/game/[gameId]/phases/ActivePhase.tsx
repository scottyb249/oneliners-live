'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Game, Player } from '../types'
import CountdownTimer from '@/app/components/CountdownTimer'

interface Props {
  game: Game
  player: Player
}

export default function ActivePhase({ game, player }: Props) {
  const [answer, setAnswer] = useState('')
  const [submittedContent, setSubmittedContent] = useState('')
  const [answerId, setAnswerId] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [editing, setEditing] = useState(false)
  const [approved, setApproved] = useState(false)
  const [justApproved, setJustApproved] = useState(false)
  const [locked, setLocked] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const handleExpire = useCallback(() => setLocked(true), [])

  const canSubmit = player.role === 'individual' || player.role === 'team_leader'

  const acronym = game.current_acronym ?? '—'
  const letters = acronym.replace(/[^A-Z]/gi, '').split('')
  const letterCount = letters.length

  const acronymFontSize =
    letterCount <= 3 ? '5rem' :
    letterCount === 4 ? '4rem' :
    letterCount === 5 ? '3.25rem' :
    '2.5rem'

  const timerSeconds = game.round_duration ?? (game.is_final_round ? 180 : 90)

  // Check for existing answer on load / round change
  useEffect(() => {
    async function checkExisting() {
      const { data } = await supabase
        .from('answers')
        .select('id, content, approved')
        .eq('game_id', game.id)
        .eq('player_id', player.id)
        .eq('round', game.current_round)
        .maybeSingle()

      if (data) {
        setAnswerId(data.id)
        setSubmittedContent(data.content)
        setAnswer(data.content)
        setApproved(data.approved ?? false)
        setSubmitted(true)
        setEditing(false)
      } else {
        setAnswerId(null)
        setSubmittedContent('')
        setAnswer('')
        setApproved(false)
        setJustApproved(false)
        setSubmitted(false)
        setEditing(false)
        setLocked(false)
        setError('')
      }
    }
    checkExisting()
  }, [game.id, game.current_round, player.id])

  // Realtime subscription — watch for host approving this player's answer
  useEffect(() => {
    if (!answerId) return

    const channel = supabase
      .channel(`approval-${answerId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'answers',
          filter: `id=eq.${answerId}`,
        },
        (payload) => {
          const updated = payload.new as { approved: boolean; content: string }
          // If host edited the content, reflect that too
          if (updated.content && updated.content !== submittedContent) {
            setSubmittedContent(updated.content)
            setAnswer(updated.content)
          }
          if (updated.approved && !approved) {
            setApproved(true)
            setJustApproved(true)
            setEditing(false)
            // Clear the "just approved" flash after 3 seconds
            setTimeout(() => setJustApproved(false), 3000)
          } else if (!updated.approved) {
            setApproved(false)
          }
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [answerId, approved, submittedContent])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!answer.trim() || submitting || locked) return
    setSubmitting(true)
    setError('')

    const { data, error: insertError } = await supabase
      .from('answers')
      .insert({
        game_id: game.id,
        player_id: player.id,
        round: game.current_round,
        content: answer.trim(),
        submitted_at: new Date().toISOString(),
        approved: false,
        is_tiebreaker: false,
      })
      .select('id')
      .single()

    if (insertError || !data) {
      setError('Failed to submit. Try again.')
      setSubmitting(false)
      return
    }

    setAnswerId(data.id)
    setSubmittedContent(answer.trim())
    setSubmitted(true)
    setEditing(false)
    setSubmitting(false)
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!answer.trim() || submitting || locked || !answerId) return
    setSubmitting(true)
    setError('')

    const { error: updateError } = await supabase
      .from('answers')
      .update({
        content: answer.trim(),
        submitted_at: new Date().toISOString(),
      })
      .eq('id', answerId)

    if (updateError) {
      setError('Failed to update. Try again.')
      setSubmitting(false)
      return
    }

    setSubmittedContent(answer.trim())
    setEditing(false)
    setSubmitting(false)
  }

  function handleEdit() {
    setAnswer(submittedContent)
    setEditing(true)
    setError('')
  }

  function handleCancelEdit() {
    setAnswer(submittedContent)
    setEditing(false)
    setError('')
  }

  if (!canSubmit) {
    return (
      <div className="flex w-full flex-col gap-6">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-yellow-400">
            Round {game.current_round}{game.is_final_round ? ' · KRACRONYM' : ''}
          </p>
          <p
            className="mt-3 font-black tracking-[0.2em] text-white break-all"
            style={{ fontSize: acronymFontSize, lineHeight: 1.1 }}
          >
            {acronym}
          </p>
        </div>
        <CountdownTimer
          key={`active-r${game.current_round}`}
          seconds={timerSeconds}
          startedAt={game.round_started_at}
          onExpire={handleExpire}
        />
        {player.role === 'team_member' ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-5 text-center">
            <p className="text-3xl">🤝</p>
            <p className="mt-3 font-semibold text-white">Your Team Leader is submitting for your team.</p>
            <p className="mt-1 text-sm text-white/60">Cheer them on!</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-5 text-center">
            <p className="text-3xl">🗳️</p>
            <p className="mt-3 font-semibold text-white">Get ready to vote!</p>
            <p className="mt-1 text-sm text-white/60">Voting opens when the round ends.</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col gap-6">
      {/* Acronym display */}
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-yellow-400">
          Round {game.current_round}{game.is_final_round ? ' · KRACRONYM' : ''}
        </p>
        <p
          className="mt-3 font-black tracking-[0.2em] text-white break-all"
          style={{ fontSize: acronymFontSize, lineHeight: 1.1 }}
        >
          {acronym}
        </p>
        <p className="mt-2 text-sm text-white/60">Write a one-liner for each letter</p>
      </div>

      <CountdownTimer
        key={`active-r${game.current_round}`}
        seconds={timerSeconds}
        startedAt={game.round_started_at}
        onExpire={handleExpire}
      />

      {/* Not yet submitted */}
      {!submitted && (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="rounded-xl border border-yellow-400/30 bg-yellow-400/5 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-yellow-400/60 mb-2">
              Your acronym
            </p>
            <div className="flex flex-wrap gap-2">
              {letters.map((letter, i) => (
                <span
                  key={i}
                  className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-yellow-400/15 border border-yellow-400/30 font-black text-yellow-400 text-lg"
                >
                  {letter}
                </span>
              ))}
            </div>
          </div>

          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Type your one-liner here..."
            maxLength={200}
            rows={3}
            disabled={locked}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            className="w-full resize-none rounded-xl border border-white/40 bg-white/10 px-4 py-3 text-white placeholder:text-white/50 focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/30 disabled:opacity-40"
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
      )}

      {/* Submitted — editing mode */}
      {submitted && editing && (
        <form onSubmit={handleUpdate} className="space-y-3">
          <div className="rounded-xl border border-yellow-400/30 bg-yellow-400/5 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-yellow-400/60 mb-2">
              Your acronym
            </p>
            <div className="flex flex-wrap gap-2">
              {letters.map((letter, i) => (
                <span
                  key={i}
                  className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-yellow-400/15 border border-yellow-400/30 font-black text-yellow-400 text-lg"
                >
                  {letter}
                </span>
              ))}
            </div>
          </div>

          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            maxLength={200}
            rows={3}
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            className="w-full resize-none rounded-xl border border-yellow-400/60 bg-white/10 px-4 py-3 text-white placeholder:text-white/50 focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/30"
          />

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCancelEdit}
              className="flex-1 rounded-xl border border-white/20 py-3 text-sm font-bold text-white/60 hover:text-white transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!answer.trim() || submitting || answer.trim() === submittedContent}
              className="flex-1 rounded-xl bg-yellow-400 py-3 text-sm font-bold text-black transition-all hover:bg-yellow-300 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Saving...' : 'Save Changes →'}
            </button>
          </div>
        </form>
      )}

      {/* Submitted — confirmed state */}
      {submitted && !editing && (
        <div className="flex flex-col gap-3">
          <div className="rounded-2xl border border-green-500/30 bg-green-500/10 px-6 py-5">
            <p className="text-sm font-semibold uppercase tracking-widest text-green-400/70 mb-1">
              Your answer
            </p>
            <p className="text-white font-semibold leading-snug">{submittedContent}</p>
          </div>

          {/* Approval notification — flashes green then settles */}
          {approved && (
            <div className={`rounded-xl border px-4 py-4 text-center transition-all duration-500 ${
              justApproved
                ? 'border-green-400/60 bg-green-400/20'
                : 'border-yellow-400/30 bg-yellow-400/5'
            }`}>
              <p className="text-2xl mb-1">✅</p>
              <p className={`text-sm font-bold transition-colors duration-500 ${
                justApproved ? 'text-green-300' : 'text-yellow-400'
              }`}>
                {justApproved ? 'Your answer was approved!' : 'Approved by host — get ready to vote!'}
              </p>
            </div>
          )}

          {!locked && !approved && (
            <button
              onClick={handleEdit}
              className="w-full rounded-xl border border-white/20 py-3 text-sm font-bold text-white/60 hover:border-white/40 hover:text-white transition-all"
            >
              ✏️ Edit Answer
            </button>
          )}

          {locked && !approved && (
            <p className="text-center text-sm text-white/40">Time's up — waiting for host.</p>
          )}
        </div>
      )}
    </div>
  )
}
