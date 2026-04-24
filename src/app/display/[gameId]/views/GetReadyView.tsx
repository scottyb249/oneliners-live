'use client'

import type { Game } from '@/lib/types'

interface Props {
  game: Game
}

export default function GetReadyView({ game }: Props) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-10 text-center px-12">
      <img
        src="/logo.png"
        alt="O.N.E. Liners Live"
        style={{ height: 'clamp(10rem, 20vw, 18rem)', width: 'auto', objectFit: 'contain', opacity: 0.85 }}
      />
      <div className="flex flex-col gap-4 items-center">
        <p
          className="font-black text-white"
          style={{
            fontSize: 'clamp(5rem, 14vw, 12rem)',
            lineHeight: 1,
            animation: 'pulse 1.5s ease-in-out infinite',
          }}
        >
          Get Ready...
        </p>
        <p
          className="text-white/50 font-bold uppercase tracking-[0.4em]"
          style={{ fontSize: 'clamp(1rem, 2.5vw, 2rem)' }}
        >
          Next round coming up
        </p>
      </div>
      {game.host_name && (
        <p
          className="text-white/30 font-semibold"
          style={{ fontSize: 'clamp(1rem, 1.8vw, 1.5rem)' }}
        >
          Hosted by{' '}
          <span className="text-yellow-400/60">
            {game.host_name.charAt(0).toUpperCase() + game.host_name.slice(1)}
          </span>
        </p>
      )}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
