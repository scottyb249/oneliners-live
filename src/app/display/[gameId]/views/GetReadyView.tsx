'use client'

import type { Game } from '@/lib/types'

interface Props {
  game: Game
}

export default function GetReadyView({ game }: Props) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center px-12">
      <img
        src="/logo.png"
        alt="O.N.E. Liners Live"
        style={{ height: 'clamp(6rem, 14vw, 12rem)', width: 'auto', objectFit: 'contain', opacity: 0.7 }}
      />
      <div className="flex flex-col gap-3 items-center">
        <p
          className="font-black text-white animate-pulse"
          style={{ fontSize: 'clamp(3rem, 8vw, 7rem)' }}
        >
          Get Ready...
        </p>
        <p
          className="text-white/40 font-semibold uppercase tracking-widest"
          style={{ fontSize: 'clamp(0.875rem, 1.8vw, 1.4rem)' }}
        >
          Next round coming up
        </p>
      </div>
      {game.host_name && (
        <p
          className="text-white/30 font-semibold"
          style={{ fontSize: 'clamp(0.875rem, 1.5vw, 1.2rem)' }}
        >
          Hosted by{' '}
          <span className="text-yellow-400/60">
            {game.host_name.charAt(0).toUpperCase() + game.host_name.slice(1)}
          </span>
        </p>
      )}
    </div>
  )
}
