'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Game } from '@/lib/types'

interface Props {
  game: Game
  onPickAcronym: () => void
  onToggleLeaderboard: () => void
}

export default function KracronymIntroPanel({ game, onPickAcronym, onToggleLeaderboard }: Props) {
  const [launching, setLaunching] = useState(false)

  // If acronym already set (came via AcronymPicker), just flip to active
  const acronymReady = !!game.current_acronym

  async function handleLaunchNow() {
    if (launching) return
    setLaunching(true)
    await supabase
      .from('games')
      .update({
        status: 'active',
        round_started_at: new Date().toISOString(),
      })
      .eq('id', game.id)
  }

  return (
    <div className="flex flex-col items-center gap-8 text-center">
      <div>
        <p className="text-4xl mb-3">🦑</p>
        <p className="text-sm font-semibold uppercase tracking-widest text-yellow-400">
          The Final Round
        </p>
        <p className="mt-1 text-2xl font-black text-white">KRACRONYM</p>
        <p className="mt-2 text-sm text-white/40">
          The display is showing the intro.<br />
          {acronymReady
            ? `Acronym ready: ${game.current_acronym} — launch when the crowd is hyped.`
            : 'Pick the acronym when the crowd is hyped.'}
        </p>
      </div>

      <div className="w-full max-w-xs rounded-2xl border border-yellow-400/20 bg-yellow-400/5 px-5 py-4 text-left space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-yellow-400">Final Round Rules</p>
        <p className="text-sm text-white/60">6-letter acronym · Double points · Extra time</p>
        <p className="text-sm text-white/60">Votes × 2 — winner takes all</p>
      </div>

      {acronymReady ? (
        <button
          onClick={handleLaunchNow}
          disabled={launching}
          className="w-full max-w-xs rounded-xl bg-yellow-400 px-6 py-4 text-lg font-bold text-black transition-all hover:bg-yellow-300 active:scale-95 disabled:opacity-50"
        >
          {launching ? 'Launching...' : `Launch "${game.current_acronym}" →`}
        </button>
      ) : (
        <button
          onClick={onPickAcronym}
          className="w-full max-w-xs rounded-xl bg-yellow-400 px-6 py-4 text-lg font-bold text-black transition-all hover:bg-yellow-300 active:scale-95"
        >
          Pick the Acronym →
        </button>
      )}

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
