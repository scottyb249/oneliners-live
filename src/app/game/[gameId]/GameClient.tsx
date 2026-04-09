'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
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

const ABANDONMENT_MS = 5 * 60 * 1000 // 5 minutes

export default function GameClient({ gameId, playerId }: Props) {
  const router = useRouter()
  const [game, setGame] = useState<Game | null>(null)
  const [player, setPlayer] = useState<Player | null>(null)
  const [playerCount, setPlayerCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [showAbandonedBanner, setShowAbandonedBanner] = useState(false)

  // Track last time the game status changed
  const lastActivityRef = useRef<number>(Date.now())

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
        async (payload) => {
          const updatedGame = payload.new as Game
          setGame(updatedGame)
          lastActivityRef.current = Date.now()
          setShowAbandonedBanner(false)
          // Re-fetch player when tiebreaker starts so is_tiebreaker_participant is fresh
          if (updatedGame.status === 'tiebreaker') {
            const { data: freshPlayer } = await supabase
              .from('players')
              .select('*')
              .eq('id', playerId)
              .single()
            if (freshPlayer) setPlayer(freshPlayer as Player)
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'players', filter: `game_id=eq.${gameId}` },
        () => setPlayerCount((prev) => prev + 1),
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [gameId])

  // Abandonment detection — check every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (!game || game.status === 'ended' || game.status === 'waiting') return
      const elapsed = Date.now() - lastActivityRef.current
      if (elapsed >= ABANDONMENT_MS) {
        setShowAbandonedBanner(true)
      }
    }, 30_000)
    return () => clearInterval(interval)
  }, [game])

  async function handleLeave() {
    setLeaving(true)
    await supabase.from('players').delete().eq('id', playerId)
    localStorage.removeItem('one_game_id')
    localStorage.removeItem('one_player_id')
    router.replace('/')
  }

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
      {/* Persistent header with leave button */}
      <div className="mb-8 flex w-full max-w-md items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-yellow-400">
          O.N.E. Liners Live
        </p>
        <button
          onClick={() => setShowLeaveConfirm(true)}
          className="text-xs font-semibold uppercase tracking-widest text-white/30 hover:text-white/60 transition-colors"
        >
          Leave Game
        </button>
      </div>

      {/* Abandonment banner */}
      {showAbandonedBanner && (
        <div className="mb-6 w-full max-w-md rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-4 py-3 text-center">
          <p className="text-sm font-semibold text-yellow-400">The game may have ended or the host left.</p>
          <button
            onClick={() => setShowLeaveConfirm(true)}
            className="mt-2 text-xs font-bold uppercase tracking-widest text-yellow-400 underline underline-offset-2"
          >
            Leave Game
          </button>
        </div>
      )}

      {game.status === 'waiting' && (
        <WaitingPhase game={game} player={player} playerCount={playerCount} />
      )}
      {game.status === 'active' && <ActivePhase game={game} player={player} />}
      {game.status === 'voting' && <VotingPhase game={game} player={player} />}
      {game.status === 'results' && <ResultsPhase game={game} player={player} />}
      {game.status === 'tiebreaker' && <TiebreakerPhase game={game} player={player} />}
      {game.status === 'ended' && <EndedPhase game={game} player={player} />}

      {/* Leave confirmation modal */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-zinc-900 p-6 text-center space-y-4">
            <p className="text-lg font-bold text-white">Leave the game?</p>
            <p className="text-sm text-white/50">You'll be removed from the game and sent back to the join screen.</p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowLeaveConfirm(false)}
                disabled={leaving}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-all disabled:opacity-50"
              >
                Stay
              </button>
              <button
                onClick={handleLeave}
                disabled={leaving}
                className="flex-1 rounded-xl bg-red-500 px-4 py-3 text-sm font-bold text-white hover:bg-red-400 transition-all disabled:opacity-50"
              >
                {leaving ? 'Leaving...' : 'Leave'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
