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

  return (
    <div className="flex flex-1 gap-8 px-10 py-6 overflow-hidden">
      {/* Left: ranked answers */}
      <div className="flex flex-1 flex-col gap-4 overflow-hidden">
        <p
          className="font-semibold uppercase tracking-[0.4em] text-yellow-400 shrink-0"
          style={{ fontSize: 'clamp(0.75rem, 1.5vw, 1.25rem)' }}
        >
          Round {game.current_round} · Results
        </p>

        <div className="flex flex-col gap-3 overflow-auto">
          {results.map((answer, i) => (
            <div
              key={answer.id}
              className={`rounded-2xl border px-5 py-4 ${
                i === 0
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
          ))}
        </div>
      </div>

      {/* Right: leaderboard */}
      <div className="w-72 flex-shrink-0 flex flex-col gap-4">
        <p
          className="font-semibold uppercase tracking-[0.4em] text-blue-400 shrink-0"
          style={{ fontSize: 'clamp(0.75rem, 1.5vw, 1.25rem)' }}
        >
          Leaderboard
        </p>
        <div className="flex flex-col gap-2">
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
