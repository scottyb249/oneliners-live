'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Game, Player, Answer } from '../types'
import CountdownTimer from '@/app/components/CountdownTimer'

interface Props {
  game: Game
  player: Player
}

export default function VotingPhase({ game, player }: Props) {
  const [answers, setAnswers] = useState<Answer[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hasVoted, setHasVoted] = useState(false)
  const [locked, setLocked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const handleExpire = useCallback(() => setLocked(true), [])

  useEffect(() => {
    async function load() {
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
        setLocked(true)
      }

      const { data } = await supabase
        .from('answers')
        .select('*, players(name, team_name)')
        .eq('game_id', game.id)
        .eq('approved', true)
        .eq('is_tiebreaker', false)
        .eq('round', game.current_round)
        .limit(10)

      if (data) setAnswers(data as Answer[])
      setLoading(false)
    }
    load()
  }, [game.id, game.current_round, player.id])

  function isHidden(answer: Answer): boolean {
    if (player.role === 'crowd_voter') return false
    if (answer.player_id === player.id) return true
    if (player.role === 'team_leader' || player.role === 'team_member') {
      return !!player.team_name &&
        !!answer.players?.team_name &&
        answer.players.team_name === player.team_name
    }
    return false
  }

  async function handleVote(answerId: string) {
    if (locked || hasVoted) return
    setSelectedId(answerId)
    setLocked(true)

    const { error: voteError } = await supabase.from('votes').insert({
      game_id: game.id,
      voter_id: player.id,
      answer_id: answerId,
      round: game.current_round,
    })

    if (voteError) {
      setError('Failed to record vote. Please try again.')
      setSelectedId(null)
      setLocked(false)
      return
    }

    setHasVoted(true)
  }

  const visibleAnswers = answers.filter((a) => !isHidden(a))

  if (loading) {
    return (
      <div className="flex w-full flex-col items-center gap-4">
        <p className="animate-pulse text-white/40">Loading answers...</p>
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-yellow-400">
          Round {game.current_round} · Vote
        </p>
        <p className="mt-1 text-2xl font-bold text-white">Pick your favorite one-liner</p>
        {hasVoted && (
          <p className="mt-2 text-sm font-medium text-green-400">Vote locked in! ✓</p>
        )}
      </div>

      <CountdownTimer key={`voting-r${game.current_round}`} seconds={90} onExpire={handleExpire} />

      {visibleAnswers.length === 0 ? (
        <p className="text-center text-white/40">No answers available to vote on.</p>
      ) : (
        <div className="space-y-3">
          {visibleAnswers.map((answer) => (
            <button
              key={answer.id}
              onClick={() => handleVote(answer.id)}
              disabled={locked}
              className={`w-full rounded-xl border px-5 py-4 text-left transition-all active:scale-[0.98] ${
                selectedId === answer.id
                  ? 'border-yellow-400 bg-yellow-400/10 ring-2 ring-yellow-400/30'
                  : 'border-white/10 bg-white/5 hover:border-white/30 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60'
              }`}
            >
              <p className="text-base text-white">{answer.content}</p>
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-center text-sm text-red-400">{error}</p>}
    </div>
  )
}
