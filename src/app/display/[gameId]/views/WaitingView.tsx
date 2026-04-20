'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { QRCodeSVG } from 'qrcode.react'
import type { Game } from '@/lib/types'

interface Props {
  game: Game
}

export default function WaitingView({ game }: Props) {
  const [playerCount, setPlayerCount] = useState(0)
  const slide = game.display_slide ?? 0

  useEffect(() => {
    async function load() {
      const { count } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', game.id)
      setPlayerCount(count ?? 0)
    }
    load()

    const channel = supabase
      .channel(`display-players-${game.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'players', filter: `game_id=eq.${game.id}` },
        () => setPlayerCount((prev) => prev + 1),
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [game.id])

  if (slide === 0) return <LobbySlide game={game} playerCount={playerCount} />
  if (slide === 1) return <HowToPlaySlide />
  if (slide === 2) return <RulesSlide />
  if (slide === 3) return <PledgeSlide />
  return <LobbySlide game={game} playerCount={playerCount} />
}

// ─── Slide 0: Lobby ──────────────────────────────────────────────────────────

function LobbySlide({ game, playerCount }: { game: Game; playerCount: number }) {
  const joinUrl = `https://onelinerslive.com/?code=${game.code}`

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-12 text-center">
      {/* Logo */}
      <img
        src="/logo.png"
        alt="O.N.E. Liners Live"
        style={{ height: 'clamp(8rem, 20vw, 16rem)', width: 'auto', objectFit: 'contain' }}
      />

      <div className="flex flex-col lg:flex-row items-center gap-10">
        {/* QR Code */}
        <div className="flex flex-col items-center gap-3">
          <div className="rounded-2xl bg-white p-5">
            <QRCodeSVG value={joinUrl} size={200} bgColor="#ffffff" fgColor="#09090b" level="M" />
          </div>
          <p
            className="text-white/70 font-semibold"
            style={{ fontSize: 'clamp(1rem, 1.8vw, 1.4rem)' }}
          >
            Scan to join
          </p>
        </div>

        {/* Divider */}
        <div className="hidden lg:flex flex-col items-center gap-2">
          <div className="h-16 w-px bg-white/10" />
          <p className="text-white/30 text-lg font-medium">or</p>
          <div className="h-16 w-px bg-white/10" />
        </div>

        {/* Join info */}
        <div className="flex flex-col gap-5 text-left">
          <div>
            <p
              className="text-white/60 font-semibold uppercase tracking-widest"
              style={{ fontSize: 'clamp(0.875rem, 1.5vw, 1.2rem)' }}
            >
              Go to
            </p>
            <p
              className="font-black text-white"
              style={{ fontSize: 'clamp(1.5rem, 4vw, 3.5rem)' }}
            >
              onelinerslive.com
            </p>
          </div>

          <div>
            <p
              className="text-white/60 font-semibold uppercase tracking-widest"
              style={{ fontSize: 'clamp(0.875rem, 1.5vw, 1.2rem)' }}
            >
              Game Code
            </p>
            <p
              className="font-black tracking-[0.2em] text-yellow-400"
              style={{ fontSize: 'clamp(2.5rem, 7vw, 6rem)' }}
            >
              {game.code}
            </p>
          </div>
        </div>
      </div>

      {/* Player count */}
      <div className="flex items-center gap-3">
        <span className="inline-block h-3 w-3 rounded-full bg-green-400 animate-pulse" />
        <p
          className="font-semibold text-white/60"
          style={{ fontSize: 'clamp(1rem, 2vw, 1.75rem)' }}
        >
          {playerCount} {playerCount === 1 ? 'player' : 'players'} joined
        </p>
      </div>

      {/* Host name */}
      {game.host_name && (
        <p
          className="text-white/30 font-medium"
          style={{ fontSize: 'clamp(0.75rem, 1.4vw, 1rem)' }}
        >
          Hosted by {game.host_name.charAt(0).toUpperCase() + game.host_name.slice(1)}
        </p>
      )}
    </div>
  )
}

// ─── Slide 1: How to Play ─────────────────────────────────────────────────────

function HowToPlaySlide() {
  const steps = [
    {
      icon: '📝',
      text: 'An acronym appears on screen — write the funniest phrase using those letters before time runs out.',
    },
    {
      icon: '✅',
      text: 'Submit your answer to the host. The host will approve the top 10 to vote on — inappropriate answers will be removed.',
    },
    {
      icon: '⚡',
      text: 'Fastest answer bonus! The first approved answer submitted each round earns +1 bonus point — speed matters!',
    },
    {
      icon: '🗳️',
      text: 'Everyone votes for their favourite one-liner on their phone. You cannot vote for your own answer.',
    },
    {
      icon: '🏆',
      text: 'Each vote = 1 point. The final KRACRONYM round is worth Double Points!',
    },
    {
      icon: '🎁',
      text: 'Prizes for 1st, 2nd, and 3rd place at the end of the session.',
    },
  ]

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-16 py-10">
      <div className="text-center">
        <p
          className="font-black text-yellow-400 uppercase tracking-widest"
          style={{ fontSize: 'clamp(1rem, 2vw, 1.5rem)' }}
        >
          Quick Rules
        </p>
        <p
          className="font-black text-white mt-1"
          style={{ fontSize: 'clamp(2.5rem, 7vw, 6rem)' }}
        >
          How to Play
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full max-w-5xl">
        {steps.map((step, i) => (
          <div
            key={i}
            className="flex items-start gap-5 rounded-2xl border border-white/10 bg-white/5 px-7 py-5"
          >
            <span style={{ fontSize: 'clamp(2rem, 3.5vw, 3rem)' }}>{step.icon}</span>
            <p
              className="text-white font-semibold leading-snug"
              style={{ fontSize: 'clamp(1rem, 1.8vw, 1.4rem)' }}
            >
              {step.text}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Slide 2: Rules ───────────────────────────────────────────────────────────

function RulesSlide() {
  const rules = [
    'Host will narrow down answers to 10 if there are more than 10 players.',
    'Do not use outside app help.',
    'Submit fast — the first approved answer each round earns a +1 bonus point!',
    'Similar or identical answers? First one in wins. Be unique.',
    'The host sets the appropriateness level based on the crowd: G · PG · PG-13 · R · XXX.',
    'Do not use your answer to harass a real person. Example: B.A.D. = "Bob\'s A D***".',
    'Keep highly inflammatory political or religious content out of it. Host will not approve it.',
    'Players and Teams will not be able to vote for their own response. If you\'re playing, you need to vote.',
    'Judges can come and go whenever they want and join anytime.',
  ]

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-16 py-6">
      <div className="text-center">
        <p
          className="font-black text-yellow-400 uppercase tracking-widest"
          style={{ fontSize: 'clamp(0.75rem, 1.4vw, 1.1rem)' }}
        >
          Don&apos;t be a Jabronie
        </p>
        <p
          className="font-black text-white mt-1"
          style={{ fontSize: 'clamp(2rem, 5vw, 4.5rem)' }}
        >
          The Rules
        </p>
      </div>

      <div className="flex flex-col gap-2 w-full max-w-5xl">
        {rules.map((rule, i) => (
          <div
            key={i}
            className="flex items-start gap-4 rounded-xl border border-white/10 bg-white/5 px-5 py-3"
          >
            <span
              className="font-black text-yellow-400 shrink-0 tabular-nums"
              style={{ fontSize: 'clamp(0.85rem, 1.4vw, 1.1rem)' }}
            >
              {i + 1}.
            </span>
            <p
              className="text-white font-semibold leading-snug"
              style={{ fontSize: 'clamp(0.85rem, 1.4vw, 1.1rem)' }}
            >
              {rule}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Slide 3: Pledge ─────────────────────────────────────────────────────────

function PledgeSlide() {
  const lines = [
    'I will not get mad at the host for not choosing my answer.',
    'I will not personally harass or single out anyone in this room (unless they\'re on my team).',
    'I will do my best to not get offended and ruin a good time.',
    'The host is the moderator, tiebreaker, and judge of what\'s appropriate.',
  ]

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-10 px-16 py-10 text-center">
      <div>
        <p
          className="font-black text-yellow-400 uppercase tracking-widest"
          style={{ fontSize: 'clamp(1rem, 2vw, 1.5rem)' }}
        >
          Raise Your Right Hand &amp; Repeat After Me
        </p>
        <p
          className="font-black text-white mt-1"
          style={{ fontSize: 'clamp(2.5rem, 6vw, 5.5rem)' }}
        >
          O.N.E. Liners Pledge ✋
        </p>
      </div>

      <div className="flex flex-col gap-5 w-full max-w-3xl">
        {lines.map((line, i) => (
          <div
            key={i}
            className="rounded-2xl border border-yellow-400/20 bg-yellow-400/5 px-8 py-5"
          >
            <p
              className="font-semibold text-white leading-snug"
              style={{ fontSize: 'clamp(1.1rem, 2.2vw, 1.75rem)' }}
            >
              &ldquo;{line}&rdquo;
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
