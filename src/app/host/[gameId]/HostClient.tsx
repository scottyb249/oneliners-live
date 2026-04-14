'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Game } from '@/lib/types'
import TopBar from './components/TopBar'
import PreGamePanel from './panels/PreGamePanel'
import AcronymPicker from './panels/AcronymPicker'
import AnswerManagementPanel from './panels/AnswerManagementPanel'
import VotingPanel from './panels/VotingPanel'
import ResultsPanel from './panels/ResultsPanel'
import BreakPanel from './panels/BreakPanel'

const ROUND_PATTERN = [3, 4, 4, 5, 5]

export function getLetterCount(round: number, isFinalRound: boolean): number {
  if (isFinalRound) return 6
  return ROUND_PATTERN[(round - 1) % ROUND_PATTERN.length]
}

interface Props {
  gameId: string
}

export default function HostClient({ gameId: rawGameId }: Props) {
  const gameId = decodeURIComponent(rawGameId).replace(/^\[|\]$/g, '')
  const router = useRouter()
  const [game, setGame] = useState<Game | null>(null)
  const [playerCount, setPlayerCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [showEndConfirm, setShowEndConfirm] = useState(false)
  const [ending, setEnding] = useState(false)

  const [showAcronymPicker, setShowAcronymPicker] = useState(false)
  const [pickerTargetRound, setPickerTargetRound] = useState(1)
  const [pickerIsFinalRound, setPickerIsFinalRound] = useState(false)
  const [pickerCameFromResults, setPickerCameFromResults] = useState(false)

  useEffect(() => {
    setLoading(true)
    setLoadError('')

    async function init() {
      const [{ data: gameData, error: gameError }, { count }] = await Promise.all([
        supabase.from('games').select('*').eq('id', gameId).single(),
        supabase.from('players').select('*', { count: 'exact', head: true }).eq('game_id', gameId),
      ])

      if (gameError) {
        console.error('Failed to load game:', gameError)
        setLoadError(`Could not load game: ${gameError.message}`)
      } else if (gameData) {
        setGame(gameData as Game)
      }

      setPlayerCount(count ?? 0)
      setLoading(false)
    }
    init()
  }, [gameId])

  useEffect(() => {
    async function refreshPlayerCount() {
      const { count } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', gameId)
      setPlayerCount(count ?? 0)
    }

    const channel = supabase
      .channel(`host-game-${gameId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
        (payload) => setGame(payload.new as Game),
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'players', filter: `game_id=eq.${gameId}` },
        () => refreshPlayerCount(),
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'players', filter: `game_id=eq.${gameId}` },
        () => refreshPlayerCount(),
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [gameId])

  useEffect(() => {
    if (!game || game.status === 'ended' || game.status === 'waiting') return
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [game])

  function openAcronymPicker(targetRound: number, isFinalRound: boolean, fromResults = false) {
    setPickerTargetRound(targetRound)
    setPickerIsFinalRound(isFinalRound)
    setPickerCameFromResults(fromResults)
    setShowAcronymPicker(true)
  }

  async function handleTakeBreak() {
    await supabase.from('games').update({ status: 'break' }).eq('id', gameId)
    setShowAcronymPicker(false)
  }

  async function handleBackToResults() {
    await supabase.from('games').update({ status: 'results' }).eq('id', gameId)
    setShowAcronymPicker(false)
  }

  async function handleToggleDisplay() {
    const currentlyActive = (game as any)?.display_active !== false
    await supabase
      .from('games')
      .update({ display_active: !currentlyActive })
      .eq('id', gameId)
  }

  async function handleEndGame() {
    setEnding(true)
    await supabase.from('games').update({ status: 'ended' }).eq('id', gameId)
    setShowEndConfirm(false)
    setEnding(false)
  }

  async function handleBackToLobby() {
    await supabase.from('answers').delete().eq('game_id', gameId)
    await supabase.from('votes').delete().eq('game_id', gameId)
    await supabase.from('players').delete().eq('game_id', gameId).eq('is_host', false)
    await supabase
      .from('games')
      .update({
        status: 'waiting',
        current_round: 1,
        current_acronym: null,
        is_final_round: false,
        tiebreaker_ran: false,
        used_acronyms: [],
        display_slide: 0,
        reveal_index: -1,
        podium_step: 0,
        display_active: true,
      })
      .eq('id', gameId)
  }

  function handleLogOut() {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('host_password_verified')
    }
    router.push('/host')
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950">
        <p className="animate-pulse text-white/40">Loading game...</p>
      </main>
    )
  }

  if (loadError || !game) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
        <div className="text-center space-y-2">
          <p className="text-red-400 font-semibold">Game not found.</p>
          {loadError && <p className="text-xs text-white/30 max-w-xs">{loadError}</p>}
        </div>
      </main>
    )
  }

  if (game.status === 'ended') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-6 text-center gap-8">
        <div className="flex flex-col items-center gap-4">
          <p className="text-6xl">🎉</p>
          <h1 className="text-5xl font-black text-white">Game Over!</h1>
          <p className="text-lg text-white/40">
            Thanks for hosting, {game.host_name.charAt(0).toUpperCase() + game.host_name.slice(1)}.
          </p>
        </div>
        <div className="flex flex-col w-full max-w-sm gap-3">
          <button
            onClick={() => router.push('/host')}
            className="w-full rounded-xl bg-yellow-400 py-4 text-lg font-bold text-black transition-all hover:bg-yellow-300 active:scale-95"
          >
            Start New Game →
          </button>
          <button
            onClick={handleBackToLobby}
            className="w-full rounded-xl border border-white/20 py-4 text-lg font-bold text-white/60 transition-all hover:border-white/40 hover:text-white active:scale-95"
          >
            Back to Lobby
          </button>
          <button
            onClick={handleLogOut}
            className="w-full rounded-xl border border-white/10 py-3 text-sm font-semibold text-white/30 transition-all hover:border-white/20 hover:text-white/50 active:scale-95"
          >
            Log Out
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen flex-col bg-zinc-950">
      <TopBar game={game} />

      <div className="flex justify-end px-4 pt-3">
        <button
          onClick={() => setShowEndConfirm(true)}
          className="rounded-lg border border-red-500/30 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-red-400 hover:border-red-400 hover:text-red-300 transition-all"
        >
          End Game
        </button>
      </div>

      <div className="flex-1 px-4 py-4">
        {showAcronymPicker ? (
          <AcronymPicker
            game={game}
            targetRound={pickerTargetRound}
            isFinalRound={pickerIsFinalRound}
            letterCount={getLetterCount(pickerTargetRound, pickerIsFinalRound)}
            onCancel={() => setShowAcronymPicker(false)}
            onConfirmed={() => setShowAcronymPicker(false)}
            onTakeBreak={handleTakeBreak}
            onToggleDisplay={handleToggleDisplay}
            onBackToResults={pickerCameFromResults ? handleBackToResults : undefined}
          />
        ) : (
          <>
            {game.status === 'waiting' && (
              <PreGamePanel
                game={game}
                playerCount={playerCount}
                onStartGame={() => openAcronymPicker(game.current_round === 0 ? 1 : game.current_round + 1, false)}
              />
            )}
            {game.status === 'break' && (
              <BreakPanel
                game={game}
                onResume={() => openAcronymPicker(game.current_round + 1, game.is_final_round)}
              />
            )}
            {game.status === 'active' && (
              <AnswerManagementPanel game={game} />
            )}
            {game.status === 'voting' && (
              <VotingPanel game={game} />
            )}
            {game.status === 'results' && (
              <ResultsPanel
                game={game}
                onNextRound={() => openAcronymPicker(game.current_round + 1, false, true)}
                onTakeBreak={handleTakeBreak}
                onFinalRound={() => openAcronymPicker(game.current_round + 1, true, true)}
              />
            )}
          </>
        )}
      </div>

      {showEndConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-zinc-900 p-6 text-center space-y-4">
            <p className="text-lg font-bold text-white">End the game?</p>
            <p className="text-sm text-white/50">
              This will end the game for all players and take everyone to the final screen.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowEndConfirm(false)}
                disabled={ending}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleEndGame}
                disabled={ending}
                className="flex-1 rounded-xl bg-red-500 px-4 py-3 text-sm font-bold text-white hover:bg-red-400 transition-all disabled:opacity-50"
              >
                {ending ? 'Ending...' : 'End Game'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
