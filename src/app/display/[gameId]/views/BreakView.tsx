'use client'

import type { Game } from '@/lib/types'

interface Props {
  game: Game
}

export default function BreakView({ game }: Props) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-12 text-center">
      {/* Logo */}
      <div>
        <p
          className="font-black text-yellow-400 leading-none"
          style={{ fontSize: 'clamp(1.5rem, 4vw, 3.5rem)' }}
        >
          O.N.E. Liners
        </p>
        <p
          className="font-black text-white leading-tight"
          style={{ fontSize: 'clamp(3rem, 12vw, 10rem)' }}
        >
          LIVE
        </p>
      </div>

      {/* Break message */}
      <div className="flex flex-col items-center gap-4">
        <p className="text-6xl">☕</p>
        <p
          className="font-black text-white"
          style={{ fontSize: 'clamp(2rem, 5vw, 4rem)' }}
        >
          We&apos;ll Be Right Back
        </p>
        <p
          className="text-white/50 font-medium max-w-xl"
          style={{ fontSize: 'clamp(1rem, 2vw, 1.5rem)' }}
        >
          O.N.E. Liners Live will resume shortly.
          <br />
          Grab a drink and don&apos;t go anywhere!
        </p>
        {game.host_name && (
          <p
            className="text-white/70 font-semibold"
            style={{ fontSize: 'clamp(1rem, 1.8vw, 1.4rem)' }}
          >
            Hosted by <span className="text-yellow-400">{game.host_name.charAt(0).toUpperCase() + game.host_name.slice(1)}</span>
          </p>
        )}
      </div>

      {/* Round info */}
      <div className="rounded-2xl border border-white/10 bg-white/5 px-8 py-4">
        <p
          className="font-semibold text-white/40 uppercase tracking-widest"
          style={{ fontSize: 'clamp(0.75rem, 1.5vw, 1rem)' }}
        >
          Round {game.current_round}{game.is_final_round ? ' · KRACRONYM' : ''} · On Break
        </p>
      </div>
    </div>
  )
}
