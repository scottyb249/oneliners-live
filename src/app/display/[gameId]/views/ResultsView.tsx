'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Game, Answer, Player } from '@/lib/types'

interface Props {
  game: Game
}

interface AnswerWithVotes extends Answer {
  vote_count: number
  is_fastest: boolean
}

const MEDALS = ['🥇', '🥈', '🥉']

export default function ResultsView({ game }: Props) {
  const [results, setResults] = useState<AnswerWithVotes[]>([])
  const [leaderboard, setLeaderboard] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)

  const revealIndex = game.reveal_index ?? -1
  const podiumStep = game.podium_step ?? 0
  const isFinal = game.is_final_round

  const revealThreshold = results.length - 1 - revealIndex

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
          .in('role', ['individual', 'team_leader'])
          .order('score', { ascending: false }),
      ])

      const tally: Record<string, number> = {}
      for (const v of votes ?? []) {
        tally[v.answer_id] = (tally[v.answer_id] ?? 0) + 1
      }

      const withVotes: AnswerWithVotes[] = ((answers ?? []) as Answer[])
        .map((a) => ({
          ...a,
          vote_count: tally[a.id] ?? 0,
          is_fastest: (a as any).is_fastest ?? false,
        }))
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

  // ── Waiting state (no reveal yet) ─────────────────────────────────────────
  if (revealIndex < 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center px-12">
        <p
          className="font-black text-yellow-400 uppercase tracking-widest"
          style={{ fontSize: 'clamp(0.75rem, 2vw, 1.25rem)' }}
        >
          Round {game.current_round} · Results{isFinal ? ' · KRACRONYM' : ''}
        </p>
        <p className="font-black text-white" style={{ fontSize: 'clamp(2rem, 6vw, 5rem)' }}>
          Get Ready...
        </p>
        <p className="text-white/40 font-medium" style={{ fontSize: 'clamp(1rem, 2vw, 1.5rem)' }}>
          The host is about to reveal the answers
        </p>
      </div>
    )
  }

  // ── Answer card helper ────────────────────────────────────────────────────
  function AnswerCard({ answer, i, isNewest }: { answer: AnswerWithVotes; i: number; isNewest: boolean }) {
    return (
      <div
        style={{
          transition: 'opacity 0.6s ease, transform 0.6s ease',
          opacity: 1,
          transform: 'translateY(0)',
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
              {answer.is_fastest && (
                <span className="ml-2 text-yellow-400 font-bold">⚡ Fastest +1</span>
              )}
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
  }

  // ── FINAL ROUND: Podium suspense sequence ────────────────────────────────
  if (isFinal) {
    if (podiumStep === 0) {
      return (
        <div className="flex flex-1 flex-col gap-4 px-10 py-6 overflow-hidden">
          <p
            className="font-semibold uppercase tracking-[0.4em] text-yellow-400 shrink-0"
            style={{ fontSize: 'clamp(0.75rem, 1.5vw, 1.25rem)' }}
          >
            KRACRONYM · Round {game.current_round} · Results
          </p>
          <div className="flex flex-col gap-3 overflow-auto">
            {results.map((answer, i) => {
              const isRevealed = i >= revealThreshold
              const isNewest = i === revealThreshold
              return (
                <div
                  key={answer.id}
                  style={{
                    transition: 'opacity 0.6s ease, transform 0.6s ease',
                    opacity: isRevealed ? 1 : 0,
                    transform: isRevealed ? 'translateY(0)' : 'translateY(16px)',
                  }}
                >
                  <AnswerCard answer={answer} i={i} isNewest={isNewest} />
                </div>
              )
            })}
          </div>
        </div>
      )
    }

    if (podiumStep === 1) {
      const below3 = leaderboard.slice(3)
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-8 px-16 py-10">
          <div className="text-center">
            <p
              className="font-black text-yellow-400 uppercase tracking-widest"
              style={{ fontSize: 'clamp(0.75rem, 2vw, 1.25rem)' }}
            >
              Final Standings
            </p>
            <p
              className="font-black text-white mt-1"
              style={{ fontSize: 'clamp(2rem, 5vw, 4rem)' }}
            >
              The Rest of the Pack
            </p>
          </div>
          <div className="flex flex-col gap-3 w-full max-w-2xl">
            {below3.length === 0 ? (
              <p className="text-center text-white/40" style={{ fontSize: 'clamp(1rem, 2vw, 1.5rem)' }}>
                Everyone made the top 3!
              </p>
            ) : (
              [...below3].reverse().map((player, i) => {
                const position = leaderboard.length - i
                const displayName = player.team_name ?? player.name
                return (
                  <div
                    key={player.id}
                    style={{ animation: `fadeSlideUp 0.5s ease ${i * 0.15}s both` }}
                    className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 px-6 py-4"
                  >
                    <span
                      className="font-black text-white/30 w-10 shrink-0 tabular-nums"
                      style={{ fontSize: 'clamp(1rem, 2vw, 1.5rem)' }}
                    >
                      #{position}
                    </span>
                    <p
                      className="flex-1 font-bold text-white truncate"
                      style={{ fontSize: 'clamp(1rem, 2.5vw, 2rem)' }}
                    >
                      {displayName}
                    </p>
                    <p
                      className="font-black text-white/60 tabular-nums shrink-0"
                      style={{ fontSize: 'clamp(1rem, 2vw, 1.5rem)' }}
                    >
                      {player.score} pts
                    </p>
                  </div>
                )
              })
            )}
          </div>
          <style>{`
            @keyframes fadeSlideUp {
              from { opacity: 0; transform: translateY(20px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
        </div>
      )
    }

    // Steps 2, 3, 4 — Individual podium reveals (3rd, 2nd, 1st)
    const placeIndex = podiumStep - 2
    const leaderIndex = 2 - placeIndex
    const placeLabels = ['3rd Place', '2nd Place', '🏆 1st Place']
    const placeColors = [
      'border-amber-500/60 bg-amber-600/10 text-amber-500',
      'border-zinc-400/60 bg-zinc-400/10 text-zinc-300',
      'border-yellow-400 bg-yellow-400/15 text-yellow-400',
    ]
    const trophyEmojis = ['🥉', '🥈', '🥇']
    const pointColors = ['text-amber-500', 'text-zinc-300', 'text-yellow-400']

    const player = leaderboard[leaderIndex]
    const displayName = player?.team_name ?? player?.name ?? '—'

    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-12 text-center">
        <p
          className="font-black text-yellow-400 uppercase tracking-widest"
          style={{ fontSize: 'clamp(0.75rem, 2vw, 1.25rem)' }}
        >
          Final Results · KRACRONYM
        </p>
        <div
          style={{ animation: 'popIn 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) both' }}
          className={`flex flex-col items-center gap-4 rounded-3xl border-2 px-16 py-12 ${placeColors[placeIndex]}`}
        >
          <p style={{ fontSize: 'clamp(4rem, 10vw, 8rem)' }}>{trophyEmojis[placeIndex]}</p>
          <p
            className="font-black uppercase tracking-widest"
            style={{ fontSize: 'clamp(1rem, 2.5vw, 2rem)' }}
          >
            {placeLabels[placeIndex]}
          </p>
          <p
            className="font-black text-white leading-tight"
            style={{ fontSize: 'clamp(2rem, 6vw, 5rem)' }}
          >
            {displayName}
          </p>
          <p
            className={`font-black tabular-nums ${pointColors[placeIndex]}`}
            style={{ fontSize: 'clamp(1.5rem, 4vw, 3rem)' }}
          >
            {player?.score ?? 0} pts
          </p>
        </div>
        <style>{`
          @keyframes popIn {
            from { opacity: 0; transform: scale(0.5); }
            to { opacity: 1; transform: scale(1); }
          }
        `}</style>
      </div>
    )
  }

  // ── REGULAR ROUND results ─────────────────────────────────────────────────
  const showLeaderboard = podiumStep >= 1

  return (
    <div className="flex flex-1 gap-6 px-8 py-6 overflow-hidden">
      {/* Left: ranked answers — bottom-up reveal */}
      <div className={`flex flex-col gap-4 overflow-hidden ${showLeaderboard ? 'flex-[3]' : 'flex-1'}`}>
        <p
          className="font-semibold uppercase tracking-[0.4em] text-yellow-400 shrink-0"
          style={{ fontSize: 'clamp(0.75rem, 1.5vw, 1.25rem)' }}
        >
          Round {game.current_round} · Results
        </p>
        <div className="flex flex-col gap-3 overflow-auto">
          {results.map((answer, i) => {
            const isRevealed = i >= revealThreshold
            const isNewest = i === revealThreshold
            return (
              <div
                key={answer.id}
                style={{
                  transition: 'opacity 0.6s ease, transform 0.6s ease',
                  opacity: isRevealed ? 1 : 0,
                  transform: isRevealed ? 'translateY(0)' : 'translateY(16px)',
                }}
              >
                <AnswerCard answer={answer} i={i} isNewest={isNewest} />
              </div>
            )
          })}
        </div>
      </div>

      {/* Right: leaderboard */}
      {showLeaderboard && (
        <div className="flex-[2] flex-shrink-0 flex flex-col gap-4 overflow-hidden">
          <p
            className="font-semibold uppercase tracking-[0.4em] text-blue-400 shrink-0"
            style={{ fontSize: 'clamp(0.75rem, 1.5vw, 1.25rem)' }}
          >
            Leaderboard
          </p>
          <div className="flex flex-col gap-2 overflow-auto">
            {leaderboard.map((player, i) => {
              const displayName = player.team_name ?? player.name
              return (
                <div
                  key={player.id}
                  style={{ animation: `fadeSlideUp 0.4s ease ${i * 0.08}s both` }}
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
                    {displayName}
                  </p>
                  <p
                    className="font-black text-white shrink-0 tabular-nums"
                    style={{ fontSize: 'clamp(1rem, 1.8vw, 1.5rem)' }}
                  >
                    {player.score}
                  </p>
                </div>
              )
            })}
          </div>
          <style>{`
            @keyframes fadeSlideUp {
              from { opacity: 0; transform: translateY(12px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
        </div>
      )}
    </div>
  )
}
