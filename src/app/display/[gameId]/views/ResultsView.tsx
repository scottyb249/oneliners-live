'use client'

import { useState, useEffect, useRef } from 'react'
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

// ── Gold confetti for 1st place ───────────────────────────────────────────
function GoldConfetti() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const pieces: {
      x: number; y: number; w: number; h: number;
      color: string; rot: number; vx: number; vy: number; vr: number
    }[] = []

    const colors = ['#facc15', '#fde68a', '#ffffff', '#fbbf24', '#f59e0b', '#fef9c3']

    for (let i = 0; i < 220; i++) {
      pieces.push({
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * 300,
        w: 8 + Math.random() * 10,
        h: 4 + Math.random() * 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        rot: Math.random() * Math.PI * 2,
        vx: (Math.random() - 0.5) * 3,
        vy: 2.5 + Math.random() * 3.5,
        vr: (Math.random() - 0.5) * 0.18,
      })
    }

    let running = true
    function draw() {
      if (!running || !ctx || !canvas) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (const p of pieces) {
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        ctx.restore()
        p.x += p.vx
        p.y += p.vy
        p.rot += p.vr
        if (p.y > canvas.height + 20) {
          p.y = -20
          p.x = Math.random() * canvas.width
        }
      }
      requestAnimationFrame(draw)
    }
    draw()
    return () => { running = false }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-0"
      style={{ width: '100%', height: '100%' }}
    />
  )
}

// ── Scrabble-style letter tile ────────────────────────────────────────────
function LetterTile({ letter, delay }: { letter: string; delay: number }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay)
    return () => clearTimeout(t)
  }, [delay])

  return (
    <div
      style={{
        transition: 'opacity 0.4s ease, transform 0.4s cubic-bezier(0.175,0.885,0.32,1.275)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(-30px) scale(0.6)',
      }}
    >
      <div
        style={{
          width: 'clamp(52px, 7vw, 88px)',
          height: 'clamp(52px, 7vw, 88px)',
          background: 'linear-gradient(145deg, #f5e6c8 0%, #e8d5a0 50%, #d4b96a 100%)',
          border: '3px solid #8b6914',
          borderRadius: '6px',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6), 0 4px 12px rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            fontSize: 'clamp(1.75rem, 4.5vw, 3.5rem)',
            fontWeight: '900',
            color: '#1a0a00',
            fontFamily: 'Georgia, serif',
            lineHeight: 1,
          }}
        >
          {letter}
        </span>
      </div>
    </div>
  )
}

export default function ResultsView({ game }: Props) {
  const [results, setResults] = useState<AnswerWithVotes[]>([])
  const [leaderboard, setLeaderboard] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)

  // For 1st place reveal drama
  const [showNameReveal, setShowNameReveal] = useState(false)

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

  // Auto-transition from buildup → name reveal
  useEffect(() => {
    if (!isFinal || podiumStep !== 4) return
    setShowNameReveal(false)
    const t = setTimeout(() => setShowNameReveal(true), 2800)
    return () => clearTimeout(t)
  }, [isFinal, podiumStep])

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="animate-pulse text-white/30" style={{ fontSize: '2rem' }}>
          Tallying votes...
        </p>
      </div>
    )
  }

  // ── Waiting state ─────────────────────────────────────────────────────────
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

  // ── Answer card ───────────────────────────────────────────────────────────
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
            {isFinal && answer.vote_count > 0 && (
              <p className="text-xs font-bold text-yellow-400/70 mt-0.5">
                = {answer.vote_count * 2} pts
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── FINAL ROUND: Podium suspense sequence ─────────────────────────────────
  if (isFinal) {

    // Step 0: answer reveal
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

    // Step 1: The rest of the pack (4th+)
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

    // Steps 2 & 3: 3rd place and 2nd place (unchanged popIn)
    if (podiumStep === 2 || podiumStep === 3) {
      const placeIndex = podiumStep - 2   // 0 = 3rd, 1 = 2nd
      const leaderIndex = 2 - placeIndex  // 2 = 3rd place player, 1 = 2nd place player
      const placeLabels = ['3rd Place', '2nd Place']
      const placeColors = [
        'border-amber-500/60 bg-amber-600/10 text-amber-500',
        'border-zinc-400/60 bg-zinc-400/10 text-zinc-300',
      ]
      const trophyEmojis = ['🥉', '🥈']
      const pointColors = ['text-amber-500', 'text-zinc-300']

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

    // ── Step 4: 1st Place — FULL DRAMA ──────────────────────────────────────
    if (podiumStep === 4) {
      const winner = leaderboard[0]
      const displayName = winner?.team_name ?? winner?.name ?? '—'
      const acronym = game.current_acronym ?? ''
      const letters = acronym.toUpperCase().split('')

      // Phase 1: Buildup — kraken-themed suspense with letter tiles
      if (!showNameReveal) {
        return (
          <div
            className="flex flex-1 flex-col items-center justify-center gap-10 px-12 text-center relative overflow-hidden"
            style={{ background: 'radial-gradient(ellipse at center, #1a0a00 0%, #000000 100%)' }}
          >
            {/* Eerie vignette rings */}
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              background: 'radial-gradient(ellipse at 50% 60%, rgba(139,105,20,0.12) 0%, transparent 70%)',
            }} />

            {/* "The champion is..." pulsing text */}
            <div style={{ animation: 'pulse 1.4s ease-in-out infinite' }}>
              <p
                className="font-black uppercase tracking-[0.3em] text-yellow-600/70"
                style={{ fontSize: 'clamp(0.75rem, 2vw, 1.5rem)' }}
              >
                Final Results · KRACRONYM
              </p>
            </div>

            <div style={{ animation: 'breathe 1.6s ease-in-out infinite' }}>
              <p
                className="font-black text-white leading-tight"
                style={{ fontSize: 'clamp(2.5rem, 7vw, 6rem)', textShadow: '0 0 40px rgba(250,204,21,0.3)' }}
              >
                THE CHAMPION IS...
              </p>
            </div>

            {/* Letter tiles */}
            {letters.length > 0 && (
              <div className="flex items-center justify-center gap-3 flex-wrap">
                {letters.map((letter, i) => (
                  <LetterTile key={i} letter={letter} delay={i * 180} />
                ))}
              </div>
            )}

            <style>{`
              @keyframes pulse {
                0%, 100% { opacity: 0.4; }
                50% { opacity: 1; }
              }
              @keyframes breathe {
                0%, 100% { transform: scale(1); opacity: 0.85; }
                50% { transform: scale(1.03); opacity: 1; }
              }
            `}</style>
          </div>
        )
      }

      // Phase 2: Name slam — explosion reveal
      return (
        <div
          className="relative flex flex-1 flex-col items-center justify-center gap-8 px-12 text-center overflow-hidden"
          style={{ background: 'radial-gradient(ellipse at center, #1a0800 0%, #000000 100%)' }}
        >
          <GoldConfetti />

          {/* Gold flash background pulse */}
          <div
            style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              background: 'radial-gradient(ellipse at 50% 50%, rgba(250,204,21,0.18) 0%, transparent 65%)',
              animation: 'goldPulse 1.2s ease-out both',
            }}
          />

          <div className="relative z-10 flex flex-col items-center gap-6">
            {/* Trophy */}
            <div style={{ animation: 'trophyDrop 0.5s cubic-bezier(0.175,0.885,0.32,1.275) both' }}>
              <p style={{ fontSize: 'clamp(5rem, 14vw, 11rem)', lineHeight: 1, filter: 'drop-shadow(0 0 30px rgba(250,204,21,0.6))' }}>
                🏆
              </p>
            </div>

            {/* 1st Place label */}
            <div style={{ animation: 'slideUp 0.5s ease 0.2s both' }}>
              <p
                className="font-black uppercase tracking-[0.4em] text-yellow-400"
                style={{ fontSize: 'clamp(1rem, 3vw, 2.25rem)' }}
              >
                1st Place
              </p>
            </div>

            {/* Winner name — the big slam */}
            <div style={{ animation: 'nameSplash 0.7s cubic-bezier(0.175,0.885,0.32,1.275) 0.35s both' }}>
              <p
                className="font-black text-white leading-none"
                style={{
                  fontSize: 'clamp(3rem, 10vw, 9rem)',
                  textShadow: '0 0 60px rgba(250,204,21,0.5), 0 4px 30px rgba(0,0,0,0.8)',
                  letterSpacing: '-0.02em',
                }}
              >
                {displayName}
              </p>
            </div>

            {/* Score */}
            <div style={{ animation: 'slideUp 0.5s ease 0.7s both' }}>
              <p
                className="font-black text-yellow-400 tabular-nums"
                style={{ fontSize: 'clamp(1.5rem, 4vw, 3rem)' }}
              >
                {winner?.score ?? 0} pts
              </p>
            </div>


          </div>

          <style>{`
            @keyframes goldPulse {
              0% { opacity: 0; transform: scale(0.5); }
              40% { opacity: 1; }
              100% { opacity: 0.6; transform: scale(1); }
            }
            @keyframes trophyDrop {
              from { opacity: 0; transform: scale(0.2) translateY(-60px); }
              to { opacity: 1; transform: scale(1) translateY(0); }
            }
            @keyframes nameSplash {
              from { opacity: 0; transform: scale(2.5); filter: blur(12px); }
              to { opacity: 1; transform: scale(1); filter: blur(0); }
            }
            @keyframes slideUp {
              from { opacity: 0; transform: translateY(24px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
        </div>
      )
    }
  }

  // ── REGULAR ROUND results ──────────────────────────────────────────────────
  const showLeaderboard = podiumStep >= 1

  return (
    <div className="flex flex-1 gap-6 px-8 py-6 overflow-hidden">
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
