'use client'

import { useState, useEffect, useRef } from 'react'
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
import KracronymIntroPanel from './panels/KracronymIntroPanel'
import PlayersPanel from './panels/PlayersPanel'

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
  const [connectionLost, setConnectionLost] = useState(false)
  const [showPlayersPanel, setShowPlayersPanel] = useState(false)
  const [joinToast, setJoinToast] = useState<string | null>(null)
  const joinToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [showAcronymPicker, setShowAcronymPicker] = useState(false)
  const [pickerTargetRound, setPickerTargetRound] = useState(1)
  const [pickerIsFinalRound, setPickerIsFinalRound] = useState(false)
  const [pickerCameFromResults, setPickerCameFromResults] = useState(false)
  const [prePickerStatus, setPrePickerStatus] = useState<string>('waiting')

  // Save gameId to sessionStorage so host can resume if browser is accidentally closed
  useEffect(() => {
    if (gameId) sessionStorage.setItem('host_game_id', gameId)
  }, [gameId])

  useEffect(() => {
    setLoading(true)
    setLoadError('')

    async function init() {
      const [{ data: gameData, error: gameError }, { count }] = await Promise.all([
        supabase.from('games').select('*').eq('id', gameId).single(),
        supabase.from('players').select('*', { count: 'exact', head: true }).eq('game_id', gameId),
      ])

      if (gameError) {
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
        (payload) => {
          setConnectionLost(false)
          setGame(payload.new as Game)
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'players', filter: `game_id=eq.${gameId}` },
        (payload) => {
          setConnectionLost(false)
          refreshPlayerCount()
          // Join toast — show player name briefly
          const name = (payload.new as { name?: string }).name
          if (name) {
            if (joinToastTimer.current) clearTimeout(joinToastTimer.current)
            setJoinToast(name)
            joinToastTimer.current = setTimeout(() => setJoinToast(null), 4000)
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'players', filter: `game_id=eq.${gameId}` },
        () => {
          refreshPlayerCount()
        },
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setConnectionLost(true)
        } else if (status === 'SUBSCRIBED') {
          setConnectionLost(false)
          // Re-fetch game state in case we missed updates while disconnected
          supabase.from('games').select('*').eq('id', gameId).single().then(({ data }) => {
            if (data) setGame(data as Game)
          })
          refreshPlayerCount()
        }
      })
    return () => { supabase.removeChannel(channel) }
  }, [gameId])



  useEffect(() => {
    if (!game || game.status === 'ended' || game.status === 'waiting' || game.status === 'picking') return
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [game])

  async function openAcronymPicker(targetRound: number, isFinalRound: boolean, fromResults = false) {
    setPrePickerStatus(game?.status ?? 'waiting')
    setPickerTargetRound(targetRound)
    setPickerIsFinalRound(isFinalRound)
    setPickerCameFromResults(fromResults)
    await supabase
      .from('games')
      .update({ status: 'picking' })
      .eq('id', gameId)
    setShowAcronymPicker(true)
  }

  async function handleCancelPicker() {
    await supabase
      .from('games')
      .update({ status: prePickerStatus })
      .eq('id', gameId)
    setShowAcronymPicker(false)
  }

  async function handleFinalRound() {
    const nextRound = (game?.current_round ?? 0) + 1
    await supabase
      .from('games')
      .update({
        status: 'kracronym_intro',
        is_final_round: true,
        current_acronym: null,
        current_round: nextRound,
        reveal_index: -1,
        podium_step: 0,
      })
      .eq('id', gameId)
    setPickerTargetRound(nextRound)
    setPickerIsFinalRound(true)
    setPickerCameFromResults(true)
    setShowAcronymPicker(false)
  }

  async function handleTakeBreak() {
    await supabase.from('games').update({ status: 'break' }).eq('id', gameId)
    setShowAcronymPicker(false)
  }

  async function handleBackToResults() {
    await supabase.from('games').update({ status: 'results' }).eq('id', gameId)
    setShowAcronymPicker(false)
  }

  async function handleToggleLeaderboard() {
    await supabase
      .from('games')
      .update({ show_leaderboard: !game?.show_leaderboard })
      .eq('id', gameId)
  }

  async function handleCloseDisplay() {
    await supabase
      .from('games')
      .update({ display_close: true })
      .eq('id', gameId)
  }

  async function handleEndGame() {
    setEnding(true)

    // Fetch all scoring players sorted by score descending
    const { data: players } = await supabase
      .from('players')
      .select('id, score')
      .eq('game_id', gameId)
      .eq('is_host', false)
      .neq('role', 'team_member')
      .neq('role', 'crowd_voter')
      .order('score', { ascending: false })

    if (players && players.length > 0) {
      // Assign positions with tie handling (tied players share the same position)
      let position = 1
      const updates = players.map((p, i) => {
        if (i > 0 && p.score < players[i - 1].score) position = i + 1
        return { id: p.id, final_position: position }
      })

      await Promise.all(
        updates.map(({ id, final_position }) =>
          supabase.from('players').update({ final_position }).eq('id', id)
        )
      )
    }

    await supabase.from('games').update({ status: 'ended' }).eq('id', gameId)
    sessionStorage.removeItem('host_game_id')
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
        display_close: false,
        show_leaderboard: false,
      })
      .eq('id', gameId)
  }

  function handleLogOut() {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('host_password_verified')
      sessionStorage.removeItem('host_game_id')
      // Close the display window if it was opened via window.open
      window.open('', 'oneliners-display')?.close()
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

      {connectionLost && (
        <div className="px-4 pt-3">
          <div className="rounded-lg border border-orange-400/30 bg-orange-400/10 px-4 py-2 text-center">
            <p className="text-xs font-semibold text-orange-400">
              ⚠️ Connection lost — attempting to reconnect. Game state may be delayed.
            </p>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 px-4 pt-3">
        <button
          onClick={() => setShowPlayersPanel(true)}
          className="rounded-lg border border-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-white/40 hover:border-white/30 hover:text-white transition-all"
        >
          👥 Players {playerCount > 0 ? `(${playerCount})` : ''}
        </button>
        <button
          onClick={handleToggleLeaderboard}
          className={`rounded-lg border px-4 py-1.5 text-xs font-semibold uppercase tracking-widest transition-all ${
            game.show_leaderboard
              ? 'border-yellow-400/60 bg-yellow-400/10 text-yellow-400 hover:bg-yellow-400/20'
              : 'border-white/10 text-white/30 hover:border-yellow-400/40 hover:text-yellow-400'
          }`}
        >
          {game.show_leaderboard ? 'Hide Leaderboard' : 'Show Leaderboard'}
        </button>

        {(game.display_close || game.display_active == null) ? (
          <button
            onClick={async () => {
              await supabase.from('games').update({ display_close: false, display_active: true }).eq('id', game.id)
              window.open(`/display/${game.id}`, 'oneliners-display', 'width=1280,height=720,menubar=no,toolbar=no,location=no,status=no')
            }}
            className="rounded-lg border border-blue-400/40 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-blue-400 hover:border-blue-400 transition-all"
          >
            Open Display
          </button>
        ) : (
          <button
            onClick={handleCloseDisplay}
            className="rounded-lg border border-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-white/30 hover:border-red-500/40 hover:text-red-400 transition-all"
          >
            Close Display
          </button>
        )}
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
            onCancel={handleCancelPicker}
            onConfirmed={() => setShowAcronymPicker(false)}
            onTakeBreak={handleTakeBreak}
            onToggleLeaderboard={handleToggleLeaderboard}
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
            {game.status === 'kracronym_intro' && (
              <KracronymIntroPanel
                game={game}
                onPickAcronym={() => openAcronymPicker(game.current_round, true, true)}
                onToggleLeaderboard={handleToggleLeaderboard}
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
                onFinalRound={handleFinalRound}
              />
            )}
            {/* picking is a transient display-only status — host panel renders nothing extra */}
          </>
        )}
      </div>

      {/* Join toast */}
      {joinToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
          <div className="rounded-xl border border-green-500/40 bg-zinc-900 px-5 py-3 shadow-xl flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse inline-block" />
            <p className="text-sm font-semibold text-white">
              <span className="text-green-400">{joinToast}</span> joined the game
            </p>
          </div>
        </div>
      )}

      {/* Players panel overlay */}
      {showPlayersPanel && (
        <div className="fixed inset-0 z-40 flex flex-col bg-zinc-950">
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <PlayersPanel game={game} onClose={() => setShowPlayersPanel(false)} />
          </div>
        </div>
      )}

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
