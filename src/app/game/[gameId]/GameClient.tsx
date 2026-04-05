'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Game, Player } from './types'
import WaitingPhase from './phases/WaitingPhase'
import ActivePhase from './phases/ActivePhase'
import VotingPhase from './phases/VotingPhase'
import ResultsPhase from './phases/ResultsPhase'
import TiebreakerPhase from './phases/TiebreakerPhase'
import EndedPhase from './phases/EndedPhase'

interface Props {
  gameId: string
  playerId: string
}

export default function GameClient({ gameId, playerId }: Props) {
  const [game, setGame] = useState<Game | null>(null)
  const [player, setPlayer] = useState<Player | null>(null)
  const [playerCount, setPlayerCount] = useState(0)
  const [loading, setLoading] = useState(true)

  // Initial data load
  useEffect(() => {
    async function init() {
      const [{ data: gameData }, { data: playerData }, { count }] = await Promise.all([
        supabase.from('games').select('*').eq('id', gameId).single(),
        supabase.from('players').select('*').eq('id', playerId).single(),
        supabase.from('players').select('*', { count: 'exact', head: true }).eq('game_id', gameId),
      ])
      if (gameData) setGame(gameData as Game)
      if (playerData) setPlayer(playerData as Player)
      setPlayerCount(count ?? 0)
      setLoading(false)
    }
    if (gameId && playerId) init()
    else setLoading(false)
  }, [gameId, playerId])

  // Realtime: game updates + new player joins
  useEffect(() => {
    const channel = supabase
      .channel(`game-${gameId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
        (payload) => setGame(payload.new as Game),
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'players', filter: `game_id=eq.${gameId}` },
        () => setPlayerCount((prev) => prev + 1),
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [gameId])

  if (loading) {
    return (
      <main className="flex min-h-full items-center justify-center bg-zinc-950">
        <p className="animate-pulse text-white/40">Loading game...</p>
      </main>
    )
  }

  if (!game || !player) {
    return (
      <main className="flex min-h-full items-center justify-center bg-zinc-950 px-4">
        <div className="text-center">
          <p className="text-red-400 font-semibold">Could not load the game.</p>
          <p className="mt-1 text-sm text-white/30">Check your link and try again.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-full flex-col items-center bg-zinc-950 px-4 py-10">
      {/* Persistent header */}
      <div className="mb-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-yellow-400">
          O.N.E. Liners Live
        </p>
      </div>

      {game.status === 'waiting' && (
        <WaitingPhase game={game} player={player} playerCount={playerCount} />
      )}
      {game.status === 'active' && <ActivePhase game={game} player={player} />}
      {game.status === 'voting' && <VotingPhase game={game} player={player} />}
      {game.status === 'results' && <ResultsPhase game={game} player={player} />}
      {game.status === 'tiebreaker' && <TiebreakerPhase game={game} player={player} />}
      {game.status === 'ended' && <EndedPhase game={game} player={player} />}
    </main>
  )
}
