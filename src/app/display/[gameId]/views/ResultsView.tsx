'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Game, Answer, Player } from '@/lib/types'

interface Props {
  game: Game
}

interface AnswerWithVotes extends Answer {
  vote_count: number
}

const MEDALS = ['🥇', '🥈', '🥉']

export default function ResultsView({ game }: Props) {
  const [results, setResults] = useState<AnswerWithVotes[]>([])
  const [leaderboard, setLeaderboard] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)

  const revealIndex = game.reveal_index ?? -1

  useEffect(() => {
    async function load() {
      const [{ data: answers }, { data: votes }, { data: players }] = await Promise.all([
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
        supabase
          .from('players')
          .select('*')
          .eq('game_id', game.id)
          .eq('is_host', false)
          .order('score', { ascending: false }),
      ])

      const tally: Record<string, number> = {}
      for (const v of votes ?? []) {
        tally[v.answer_id] = (tally[v.answer_id] ?? 0) + 1
      }

      const withVotes: AnswerWithVotes[] = ((answers ?? []) as Answer[])
        .map((a) => ({ ...a, vote_count: tally[a.id] ?? 0 }))
        .sort((a, b) => b.vote_count - a.vote_count)

      setResults(withVotes)
      setLeaderboard((players ?? []) as Player[])
      setLoading(false)
    }
    load()
  }, [game.id, game.current_round])

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="animate-pulse text-white/30" style={{ fontSize: '2rem' }}>
          Tallying votes...
        </p>
      </div>
    )
  }

  // If nothing revealed yet, show a waiting state
  if (revealIndex < 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center px-12">
        <p
          className="font-black text-yellow-400 uppercase tracking-widest"
          style={{ fontSize: 'clamp(0.75rem, 2vw, 1.25rem)' }}
        >
          Round {game.current_round} · Results
        </p>
        <p
          className="font-black text-white"
          style={{ fontSize: 'clamp(2rem, 6vw, 5rem)' }}
        >
          Get Ready...
        </p>
        <p
          className="text-white/40 font-medium"
          style={{ fontSize: 'clamp(1rem, 2vw, 1.5rem)' }}
        >
          The host is about to reveal the answers
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 gap-6 px-8 py-6 overflow-hidden">
      {/* Left: ranked answers — slightly more space */}
      <div className="flex flex-[3] flex-col gap-4 overflow-hidden">
        <p
          className="font-semibold uppercase tracking-[0.4em] text-yellow-400 shrink-0"
          style={{ fontSize: 'clamp(0.75rem, 1.5vw, 1.25rem)' }}
        >
          Round {game.current_round} · Results
        </p>

        <div className="flex flex-col gap-3 overflow-auto">
          {results.map((answer, i) => {
            const isRevealed = i <= revealIndex
            const isNewest = i === revealIndex

            return (
              <div
                key={answer.id}
                style={{
                  transition: 'opacity 0.6s ease, transform 0.6s ease',
                  opacity: isRevealed ? 1 : 0,
                  transform: isRevealed ? 'translateY(0)' : 'translateY(16px)',
                }}
                className={`rounded-2xl border px-5 py-4 ${
                  isNewest
                    ? i === 0
                      ? 'border-yellow-400 bg-yellow-400/20 shadow-lg shadow-yellow-400/20'
                      : 'border-white/40 bg-white/10 shadow-lg shadow-white/10'
                    : i === 0
                    ? 'border-yellow-400/50 bg-yellow-400/10'
                    : 'border-white/10 bg-white/5'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p
                      className="font-semibold text-white/50 mb-1"
                      style={{ fontSize: 'clamp(0.75rem, 1.2vw, 1rem)' }}
                    >
                      {i < 3 ? MEDALS[i] : `#${i + 1}`}{' '}
                      {answer.players?.name ?? '—'}
                      {answer.players?.team_name ? ` · ${answer.players.team_name}` : ''}
                    </p>
                    <p
                      className="font-semibold text-white leading-snug"
                      style={{ fontSize: 'clamp(1rem, 2vw, 1.75rem)' }}
                    >
                      {answer.content}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className="font-black text-yellow-400 tabular-nums"
                      style={{ fontSize: 'clamp(1.5rem, 3vw, 2.5rem)' }}
                    >
                      {answer.vote_count}
                    </p>
                    <p className="text-xs text-white/30">
                      {answer.vote_count === 1 ? 'vote' : 'votes'}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Right: leaderboard — equal-ish space */}
      <div className="flex-[2] flex-shrink-0 flex flex-col gap-4 overflow-hidden">
        <p
          className="font-semibold uppercase tracking-[0.4em] text-blue-400 shrink-0"
          style={{ fontSize: 'clamp(0.75rem, 1.5vw, 1.25rem)' }}
        >
          Leaderboard
        </p>
        <div className="flex flex-col gap-2 overflow-auto">
          {leaderboard.map((player, i) => (
            <div
              key={player.id}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
                i === 0
                  ? 'border-yellow-400/40 bg-yellow-400/10'
                  : 'border-white/10 bg-white/5'
              }`}
            >
              <span
                className="w-6 text-center shrink-0"
                style={{ fontSize: 'clamp(0.875rem, 1.5vw, 1.25rem)' }}
              >
                {i < 3 ? MEDALS[i] : `#${i + 1}`}
              </span>
              <p
                className="flex-1 font-semibold text-white truncate"
                style={{ fontSize: 'clamp(0.875rem, 1.5vw, 1.25rem)' }}
              >
                {player.name}
              </p>
              <p
                className="font-black text-white shrink-0 tabular-nums"
                style={{ fontSize: 'clamp(1rem, 1.8vw, 1.5rem)' }}
              >
                {player.score}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
