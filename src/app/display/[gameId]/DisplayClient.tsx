'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Game } from '@/lib/types'
import BottomBar from './components/BottomBar'
import WaitingView from './views/WaitingView'
import ActiveView from './views/ActiveView'
import VotingView from './views/VotingView'
import ResultsView from './views/ResultsView'
import EndedView from './views/EndedView'
import BreakView from './views/BreakView'

interface Props {
  gameId: string
}

export default function DisplayClient({ gameId }: Props) {
  const [game, setGame] = useState<Game | null>(null)
  const [answerCount, setAnswerCount] = useState(0)
  const [loading, setLoading] = useState(true)

  // Initial load
  useEffect(() => {
    async function init() {
      const { data } = await supabase.from('games').select('*').eq('id', gameId).single()
      if (data) setGame(data as Game)
      setLoading(false)
    }
    init()
  }, [gameId])

  // Sync answer count whenever round changes
  useEffect(() => {
    if (!game) return
    async function fetchCount() {
      const { count } = await supabase
        .from('answers')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', gameId)
        .eq('round', game!.current_round)
      setAnswerCount(count ?? 0)
    }
    fetchCount()
  }, [gameId, game?.current_round])

  // Realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel(`display-${gameId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
        (payload) => {
          const updated = payload.new as Game
          setGame(updated)
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'answers', filter: `game_id=eq.${gameId}` },
        (payload) => {
          const incoming = payload.new as { round: number }
          setGame((prev) => {
            if (prev && incoming.round === prev.current_round) {
              setAnswerCount((c) => c + 1)
            }
            return prev
          })
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [gameId])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <p className="animate-pulse text-white/30" style={{ fontSize: '2rem' }}>
          Loading...
        </p>
      </div>
    )
  }

  if (!game) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <p className="text-red-400" style={{ fontSize: '1.5rem' }}>
          Game not found.
        </p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950">
      <div className="flex flex-1 flex-col">
        {game.status === 'waiting' && <WaitingView game={game} />}
        {game.status === 'break' && <BreakView game={game} />}
        {game.status === 'active' && (
          <ActiveView game={game} answerCount={answerCount} />
        )}
        {game.status === 'voting' && <VotingView game={game} />}
        {game.status === 'results' && <ResultsView game={game} />}
        {game.status === 'ended' && <EndedView game={game} />}
      </div>

      <BottomBar game={game} />
    </div>
  )
}
