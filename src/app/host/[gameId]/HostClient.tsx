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
import TiebreakerPanel from './panels/TiebreakerPanel'

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

  const [showAcronymPicker, setShowAcronymPicker] = useState(false)
  const [pickerTargetRound, setPickerTargetRound] = useState(1)
  const [pickerIsFinalRound, setPickerIsFinalRound] = useState(false)

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
        () => setPlayerCount((prev) => prev + 1),
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [gameId])

  function openAcronymPicker(targetRound: number, isFinalRound: boolean) {
    setPickerTargetRound(targetRound)
    setPickerIsFinalRound(isFinalRound)
    setShowAcronymPicker(true)
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
          {loadError && (
            <p className="text-xs text-white/30 max-w-xs">{loadError}</p>
          )}
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
          <p className="text-lg text-white/40">Thanks for hosting, {game.host_name}.</p>
        </div>

        <div className="flex flex-col w-full max-w-sm gap-3">
          <button
            onClick={() => router.push('/host')}
            className="w-full rounded-xl bg-yellow-400 py-4 text-lg font-bold text-black transition-all hover:bg-yellow-300 active:scale-95"
          >
            Start New Game →
          </button>
          <button
            onClick={async () => {
              await supabase
                .from('games')
                .update({
                  status: 'waiting',
                  current_round: 1,
                  current_acronym: null,
                  is_final_round: false,
                  is_tiebreaker_ran: false,
                })
                .eq('id', game.id)
            }}
            className="w-full rounded-xl border border-white/20 py-4 text-lg font-bold text-white/60 transition-all hover:border-white/40 hover:text-white active:scale-95"
          >
            Back to Lobby
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen flex-col bg-zinc-950">
      <TopBar game={game} />

      <div className="flex-1 px-4 py-6">
        {showAcronymPicker ? (
          <AcronymPicker
            game={game}
            targetRound={pickerTargetRound}
            isFinalRound={pickerIsFinalRound}
            letterCount={getLetterCount(pickerTargetRound, pickerIsFinalRound)}
            onCancel={() => setShowAcronymPicker(false)}
            onConfirmed={() => setShowAcronymPicker(false)}
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
            {game.status === 'active' && (
              <AnswerManagementPanel game={game} />
            )}
            {game.status === 'voting' && (
              <VotingPanel game={game} />
            )}
            {game.status === 'results' && (
              <ResultsPanel
                game={game}
                onNextRound={() => openAcronymPicker(game.current_round + 1, false)}
                onTakeBreak={async () => {
                  await supabase.from('games').update({ status: 'waiting' }).eq('id', game.id)
                }}
                onFinalRound={() => openAcronymPicker(game.current_round + 1, true)}
              />
            )}
            {game.status === 'tiebreaker' && (
              <TiebreakerPanel game={game} />
            )}
          </>
        )}
      </div>
    </main>
  )
}
