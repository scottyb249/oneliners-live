'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Game } from '@/lib/types'

interface Props {
  game: Game
}

export default function WaitingView({ game }: Props) {
  const [playerCount, setPlayerCount] = useState(0)

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

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-10 px-12 text-center">
      {/* Logo */}
      <div>
        <p
          className="font-black text-yellow-400 leading-none"
          style={{ fontSize: 'clamp(1rem, 4vw, 3.5rem)' }}
        >
          O.N.E. Liners
        </p>
        <p
          className="font-black text-white leading-tight"
          style={{ fontSize: 'clamp(3rem, 14vw, 12rem)' }}
        >
          LIVE
        </p>
      </div>

      {/* Game code */}
      <div>
        <p className="text-xl font-semibold uppercase tracking-widest text-white/40">
          Game Code
        </p>
        <p
          className="font-black tracking-[0.3em] text-yellow-400 leading-none"
          style={{ fontSize: 'clamp(4rem, 16vw, 12rem)' }}
        >
          {game.code}
        </p>
      </div>

      {/* Join instruction */}
      <p
        className="text-white/50 font-medium"
        style={{ fontSize: 'clamp(1rem, 2.5vw, 2rem)' }}
      >
        Scan the QR code below or go to{' '}
        <span className="text-white font-bold">onelinerslive.com</span> to join
      </p>

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
    </div>
  )
}
