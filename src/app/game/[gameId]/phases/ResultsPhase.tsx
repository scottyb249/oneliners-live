'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Game, Player, Answer } from '../types'

interface Props {
  game: Game
  player: Player
}

interface AnswerWithVotes extends Answer {
  vote_count: number
}

export default function ResultsPhase({ game, player }: Props) {
  const [results, setResults] = useState<AnswerWithVotes[]>([])
  const [pointsEarned, setPointsEarned] = useState(0)
  const [loading, setLoading] = useState(true)

  const isTeamMember = player.role === 'team_member'
  const isCrowdVoter = player.role === 'crowd_voter'
  const isFinal = game.is_final_round
  const revealIndex = game.reveal_index ?? -1

  // During final round podium sequence, show a waiting screen on phones
  // until the host is done with the full reveal
  const podiumStep = game.podium_step ?? 0
  const showingPodium = isFinal && podiumStep > 0

  useEffect(() => {
    async function load() {
      const [{ data: answers }, { data: votes }] = await Promise.all([
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
      ])

      if (!answers || !votes) { setLoading(false); return }

      const tally: Record<string, number> = {}
      for (const vote of votes) {
        tally[vote.answer_id] = (tally[vote.answer_id] ?? 0) + 1
      }

      const withVotes: AnswerWithVotes[] = (answers as Answer[])
        .map((a) => ({ ...a, vote_count: tally[a.id] ?? 0 }))
        .sort((a, b) => b.vote_count - a.vote_count)

      setResults(withVotes)

      if (isTeamMember) {
        const teamAnswer = withVotes.find((a) => a.players?.team_name === player.team_name)
        setPointsEarned(teamAnswer?.vote_count ?? 0)
      } else if (!isCrowdVoter) {
        const myAnswer = withVotes.find((a) => a.player_id === player.id)
        setPointsEarned(myAnswer?.vote_count ?? 0)
      }

      setLoading(false)
    }
    load()
  }, [game.id, game.current_round, player.id, player.team_name, isTeamMember, isCrowdVoter])

  if (loading) {
    return (
      <div className="flex w-full flex-col items-center">
        <p className="animate-pulse text-white/40">Tallying votes...</p>
      </div>
    )
  }

  // Before host starts revealing — show a suspense waiting screen
  if (revealIndex < 0) {
    return (
      <div className="flex w-full flex-col items-center gap-6 text-center py-8">
        <p className="text-5xl">{isFinal ? '🦑' : '🎭'}</p>
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-yellow-400 mb-2">
            Round {game.current_round} · Results
          </p>
          <p className="text-2xl font-black text-white">
            {isFinal ? 'The Final Results...' : 'Get Ready...'}
          </p>
        </div>
        <div className="flex items-center gap-2 mt-4">
          <span className="h-2 w-2 rounded-full bg-yellow-400 animate-pulse inline-block" />
          <p className="text-sm text-white/40">The host is about to reveal the answers</p>
        </div>
      </div>
    )
  }

  // During final round podium steps — show suspense screen on phones
  if (showingPodium) {
    const stepMessages = [
      'The verdict is in...',
      'Revealing the results...',
      '3rd place revealed — watch the screen!',
      '2nd place revealed — watch the screen!',
      '🏆 The champion has been crowned!',
    ]
    return (
      <div className="flex w-full flex-col items-center gap-6 text-center py-8">
        <div style={{ animation: 'krakenPulse 2s ease-in-out infinite' }}>
          <p style={{ fontSize: '4rem', lineHeight: 1 }}>🏆</p>
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-yellow-400 mb-2">
            KRACRONYM · Final Results
          </p>
          <p className="text-2xl font-black text-white">
            {stepMessages[Math.min(podiumStep, stepMessages.length - 1)]}
          </p>
        </div>
        <p className="text-sm text-white/40">Watch the display screen!</p>
        <style>{`
          @keyframes krakenPulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
          }
        `}</style>
      </div>
    )
  }

  // Normal results view — answers revealed
  return (
    <div className="flex w-full flex-col gap-8">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-yellow-400">
          Round {game.current_round} · Results
        </p>
        <p className="mt-1 text-2xl font-bold text-white">The votes are in</p>
      </div>

      {isCrowdVoter ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-5 text-center">
          <p className="text-3xl">🗳️</p>
          <p className="mt-2 font-semibold text-white">Thanks for voting!</p>
          <p className="mt-1 text-sm text-white/50">See how the round played out below.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-yellow-400/30 bg-yellow-400/10 px-6 py-5 text-center">
          <p className="text-sm text-white/50">
            {isTeamMember ? 'Your team earned' : 'You earned'}
          </p>
          <p className="text-5xl font-black text-yellow-400">
            {isFinal ? pointsEarned * 2 : pointsEarned}
          </p>
          <p className="text-sm text-white/50">
            {(isFinal ? pointsEarned * 2 : pointsEarned) === 1 ? 'point' : 'points'} this round
            {isFinal && pointsEarned > 0 ? ' (double points!)' : ''}
          </p>
        </div>
      )}

      <div className="space-y-3">
        {results.map((answer, i) => {
          const isOwnTeam = isTeamMember
            ? answer.players?.team_name === player.team_name
            : answer.player_id === player.id
          const highlight = !isCrowdVoter && isOwnTeam
          return (
            <div
              key={answer.id}
              className={`rounded-xl border px-5 py-4 ${
                highlight ? 'border-yellow-400/40 bg-yellow-400/10' : 'border-white/10 bg-white/5'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white/40 mb-1">
                    #{i + 1} · {answer.players?.name ?? 'Unknown'}
                    {answer.players?.team_name ? ` (${answer.players.team_name})` : ''}
                    {highlight ? (isTeamMember ? ' · Your Team' : ' · You') : ''}
                  </p>
                  <p className="text-base text-white">{answer.content}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-2xl font-black text-yellow-400">{answer.vote_count}</p>
                  <p className="text-xs text-white/30">{answer.vote_count === 1 ? 'vote' : 'votes'}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-center text-sm text-white/30">
        Waiting for host to start next round...
      </p>
    </div>
  )
}
