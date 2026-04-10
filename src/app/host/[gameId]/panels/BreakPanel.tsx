'use client'

import type { Game } from '@/lib/types'

interface Props {
  game: Game
  onResume: () => void
}

export default function BreakPanel({ game, onResume }: Props) {
  return (
    <div className="flex flex-col items-center gap-8 text-center">
      <div>
        <p className="text-4xl mb-3">☕</p>
        <p className="text-2xl font-black text-white">On a Break</p>
        <p className="text-sm text-white/40 mt-2">
          The display screen is showing a "Be right back" message.<br />
          Players are seeing a hold screen on their phones.
        </p>
      </div>

      <div className="w-full max-w-xs rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-left space-y-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-white/30">Current Game</p>
        <p className="text-sm font-semibold text-white">
          Round {game.current_round}{game.is_final_round ? ' · KRACRONYM' : ''}
        </p>
        <p className="text-xs text-white/40">Resume when you&apos;re ready</p>
      </div>

      <button
        onClick={onResume}
        className="w-full max-w-xs rounded-xl bg-yellow-400 px-6 py-4 text-lg font-bold text-black transition-all hover:bg-yellow-300 active:scale-95"
      >
        Resume Game →
      </button>
    </div>
  )
}
