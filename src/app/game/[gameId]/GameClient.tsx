'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Game, Player } from './types'
import WaitingPhase from './phases/WaitingPhase'
import ActivePhase from './phases/ActivePhase'
import VotingPhase from './phases/VotingPhase'
import ResultsPhase from './phases/ResultsPhase'
import EndedPhase from './phases/EndedPhase'

interface Props {
  gameId: string
  playerId: string
}

const ABANDONMENT_MS = 5 * 60 * 1000
const STALE_HOURS = 12

function isStaleGame(game: Game): boolean {
  if (game.status === 'ended') return true
  const created = new Date(game.created_at).getTime()
  return Date.now() - created > STALE_HOURS * 60 * 60 * 1000
}

// ── Kracronym intro hype screen shown on player phones ───────────────────
function KracronymIntroPhase() {
  return (
    <div className="flex w-full flex-col items-center gap-8 text-center py-8">
      <div style={{ animation: 'krakenPulse 2s ease-in-out infinite' }}>
        <p style={{ fontSize: '5rem', lineHeight: 1 }}>🦑</p>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.4em] text-yellow-400 mb-3">
          The Final Round
        </p>
        <p
          className="font-black text-white leading-tight"
          style={{ fontSize: 'clamp(2rem, 8vw, 3rem)' }}
        >
          THE KRACRONYM RISES
        </p>
      </div>

      <div className="rounded-2xl border border-yellow-400/20 bg-yellow-400/5 px-6 py-5 w-full max-w-xs">
        <p className="text-sm font-bold text-yellow-400 mb-2">Final Round Rules</p>
        <div className="space-y-1.5 text-sm text-white/60 text-left">
          <p>⚡ 6-letter acronym</p>
          <p>🕐 Extra time to write</p>
          <p>✌️ Double points on votes</p>
          <p>🏆 This is it — go for glory</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-yellow-400 animate-pulse inline-block" />
        <p className="text-sm text-white/40">Waiting for host to reveal the acronym...</p>
      </div>

      <style>{`
        @keyframes krakenPulse {
          0%, 100% { transform: scale(1) rotate(-3deg); }
          50% { transform: scale(1.1) rotate(3deg); }
        }
      `}</style>
    </div>
  )
}

export default function GameClient({ gameId, playerId }: Props) {
  const router = useRouter()
  const [game, setGame] = useState<Game | null>(null)
  const [player, setPlayer] = useState<Player | null>(null)
  const [playerCount, setPlayerCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [showAbandonedBanner, setShowAbandonedBanner] = useState(false)
  const [staleMessage, setStaleMessage] = useState('')
  const [leaderboard, setLeaderboard] = useState<{ name: string; score: number }[]>([])

  const lastActivityRef = useRef<number>(Date.now())

  async function refreshGame() {
    const { data } = await supabase.from('games').select('*').eq('id', gameId).single()
    if (data) {
      setGame(data as Game)
      lastActivityRef.current = Date.now()
      setShowAbandonedBanner(false)
    }
  }

  useEffect(() => {
    async function init() {
      const [{ data: gameData }, { data: playerData }, { count }] = await Promise.all([
        supabase.from('games').select('*').eq('id', gameId).single(),
        supabase.from('players').select('*').eq('id', playerId).single(),
        supabase.from('players').select('*', { count: 'exact', head: true }).eq('game_id', gameId),
      ])

      if (gameData && isStaleGame(gameData as Game)) {
        localStorage.removeItem('one_game_id')
        localStorage.removeItem('one_player_id')
        setStaleMessage(
          (gameData as Game).status === 'ended'
            ? 'That game has already ended.'
            : 'That game is no longer active.'
        )
        setLoading(false)
        return
      }

      if (!playerData) {
        localStorage.removeItem('one_game_id')
        localStorage.removeItem('one_player_id')
        setStaleMessage('Your session has expired.')
        setLoading(false)
        return
      }

      if (gameData) setGame(gameData as Game)
      if (playerData) setPlayer(playerData as Player)
      setPlayerCount(count ?? 0)
      setLoading(false)
    }
    if (gameId && playerId) init()
    else setLoading(false)
  }, [gameId, playerId])

  useEffect(() => {
    const channel = supabase
      .channel(`game-${gameId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
        (payload) => {
          setGame(payload.new as Game)
          lastActivityRef.current = Date.now()
          setShowAbandonedBanner(false)
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

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        refreshGame()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [gameId])

  useEffect(() => {
    if (!game?.show_leaderboard) return
    async function fetchLeaderboard() {
      const { data } = await supabase
        .from('players')
        .select('name, score')
        .eq('game_id', gameId)
        .eq('is_host', false)
        .order('score', { ascending: false })
      setLeaderboard(data ?? [])
    }
    fetchLeaderboard()
  }, [game?.show_leaderboard, gameId])

  useEffect(() => {
    const interval = setInterval(() => {
      if (!game || game.status === 'ended' || game.status === 'waiting' || game.status === 'break' || game.status === 'picking') return
      if (Date.now() - lastActivityRef.current >= ABANDONMENT_MS) {
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
      <main className="flex min-h-screen items-center justify-center bg-zinc-950">
        <p className="animate-pulse text-white/40">Loading game...</p>
      </main>
    )
  }

  if (staleMessage) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 gap-6 text-center">
        <p className="text-white/60">{staleMessage}</p>
        <button
          onClick={() => router.replace('/')}
          className="rounded-xl bg-yellow-400 px-6 py-3 font-bold text-black transition-all hover:bg-yellow-300 active:scale-95"
        >
          Back to Home
        </button>
      </main>
    )
  }

  if (!game || !player) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
        <div className="text-center">
          <p className="text-red-400 font-semibold">Could not load the game.</p>
          <p className="mt-1 text-sm text-white/30">Check your link and try again.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-zinc-950">
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
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

      {showAbandonedBanner && (
        <div className="mx-auto max-w-2xl px-6 pt-4">
          <div className="rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-4 py-3 text-center">
            <p className="text-sm font-semibold text-yellow-400">The game may have ended or the host left.</p>
            <button
              onClick={refreshGame}
              className="mt-1 text-xs font-bold uppercase tracking-widest text-yellow-400 underline underline-offset-2"
            >
              Tap to Reconnect
            </button>
          </div>
        </div>
      )}

      <div className="mx-auto w-full max-w-2xl px-6 py-8">
        {game.show_leaderboard ? (
          <div className="flex w-full flex-col gap-4">
            <div className="text-center">
              <p className="text-sm font-semibold uppercase tracking-widest text-yellow-400">Leaderboard</p>
              <p className="text-xs text-white/30 mt-1">Round {game.current_round}</p>
            </div>
            <div className="flex flex-col gap-2">
              {leaderboard.map((p, i) => (
                <div
                  key={p.name}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 border ${
                    i === 0
                      ? 'border-yellow-400/40 bg-yellow-400/10'
                      : 'border-white/10 bg-white/5'
                  }`}
                >
                  <span className={`text-lg font-black w-7 text-center ${
                    i === 0 ? 'text-yellow-400' : 'text-white/30'
                  }`}>
                    {i === 0 ? '🏆' : `${i + 1}`}
                  </span>
                  <span className="flex-1 font-semibold text-white truncate">{p.name}</span>
                  <span className={`font-black text-lg ${i === 0 ? 'text-yellow-400' : 'text-white/60'}`}>
                    {p.score}
                  </span>
                </div>
              ))}
              {leaderboard.length === 0 && (
                <p className="text-center text-white/30 text-sm py-6">No scores yet</p>
              )}
            </div>
          </div>
        ) : (
          <>
            {game.status === 'waiting' && (
              <WaitingPhase game={game} player={player} playerCount={playerCount} />
            )}
            {(game.status === 'break' || game.status === 'picking') && (
              <div className="flex flex-col items-center gap-6 text-center py-12">
                <p className="text-5xl">{game.status === 'picking' ? '🎯' : '☕'}</p>
                <p className="text-2xl font-black text-white">
                  {game.status === 'picking' ? 'Get Ready!' : 'We\'ll Be Right Back!'}
                </p>
                <p className="text-white/50 font-medium">
                  {game.status === 'picking'
                    ? 'The host is picking the next acronym.\nGet ready to write!'
                    : 'O.N.E. Liners Live is on a short break.\nHang tight — the game will resume shortly.'}
                </p>
                <div className="flex items-center gap-2 mt-4">
                  <span className="h-2 w-2 rounded-full bg-yellow-400 animate-pulse inline-block" />
                  <p className="text-sm text-white/30">
                    {game.status === 'picking' ? 'Next round coming up...' : 'Waiting for host to resume...'}
                  </p>
                </div>
              </div>
            )}
            {game.status === 'kracronym_intro' && <KracronymIntroPhase />}
            {game.status === 'active' && <ActivePhase game={game} player={player} />}
            {game.status === 'voting' && <VotingPhase game={game} player={player} />}
            {game.status === 'results' && <ResultsPhase game={game} player={player} />}
            {game.status === 'ended' && <EndedPhase game={game} player={player} />}
          </>
        )}
      </div>

      {showLeaveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-zinc-900 p-6 text-center space-y-4">
            <p className="text-lg font-bold text-white">Leave the game?</p>
            <p className="text-sm text-white/50">You&apos;ll be removed from the game and sent back to the join screen.</p>
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
