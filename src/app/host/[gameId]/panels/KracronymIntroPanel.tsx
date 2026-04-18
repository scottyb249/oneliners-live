'use client'

import type { Game } from '@/lib/types'

interface Props {
  game: Game
  onPickAcronym: () => void
  onToggleLeaderboard: () => void
}

export default function KracronymIntroPanel({ game, onPickAcronym, onToggleLeaderboard }: Props) {
  return (
    <div className="flex flex-col items-center gap-8 text-center">
      {/* Title */}
      <div>
        <p className="text-4xl mb-3">🦑</p>
        <p className="text-sm font-semibold uppercase tracking-widest text-yellow-400">
          The Final Round
        </p>
        <p className="mt-1 text-2xl font-black text-white">KRACRONYM</p>
        <p className="mt-2 text-sm text-white/40">
          The display is showing the intro.<br />
          When the crowd is hyped, pick the acronym.
        </p>
      </div>

      {/* Info card */}
      <div className="w-full max-w-xs rounded-2xl border border-yellow-400/20 bg-yellow-400/5 px-5 py-4 text-left space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-yellow-400">Final Round Rules</p>
        <p className="text-sm text-white/60">6-letter acronym · Double points · Extra time</p>
        <p className="text-sm text-white/60">Votes × 2 — winner takes all</p>
      </div>

      {/* Main action */}
      <button
        onClick={onPickAcronym}
        className="w-full max-w-xs rounded-xl bg-yellow-400 px-6 py-4 text-lg font-bold text-black transition-all hover:bg-yellow-300 active:scale-95"
      >
        Pick the Acronym →
      </button>

      {/* Secondary */}
      <button
        onClick={onToggleLeaderboard}
        className={`w-full max-w-xs rounded-xl border px-4 py-3 text-sm font-bold transition-all ${
          game.show_leaderboard
            ? 'border-yellow-400/60 bg-yellow-400/10 text-yellow-400 hover:bg-yellow-400/20'
            : 'border-yellow-400/40 text-yellow-400/70 hover:border-yellow-400 hover:text-yellow-400'
        }`}
      >
        {game.show_leaderboard ? '🏆 Hide Leaderboard' : '🏆 Show Leaderboard'}
      </button>
    </div>
  )
}
