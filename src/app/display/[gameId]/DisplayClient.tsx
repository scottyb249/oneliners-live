'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { Game } from '@/lib/types'
import BottomBar from './components/BottomBar'
import WaitingView from './views/WaitingView'
import ActiveView from './views/ActiveView'
import VotingView from './views/VotingView'
import ResultsView from './views/ResultsView'
import EndedView from './views/EndedView'
import BreakView from './views/BreakView'
import KracronymIntroView from './views/KracronymIntroView'
import GetReadyView from './views/GetReadyView'

interface Props {
  gameId: string
}

export default function DisplayClient({ gameId }: Props) {
  const [game, setGame] = useState<Game | null>(null)
  const [answerCount, setAnswerCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [closed, setClosed] = useState(false)
  const [leaderboard, setLeaderboard] = useState<{ name: string; score: number }[]>([])
  const [connectionLost, setConnectionLost] = useState(false)
  const prevStatusRef = useRef<string | null>(null)

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

  // Initial load
  useEffect(() => {
    async function init() {
      const { data } = await supabase.from('games').select('*').eq('id', gameId).single()
      if (data) {
        setGame(data as Game)
        prevStatusRef.current = (data as Game).status
      }
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

          // Only close if display_close changed from false → true (host explicitly closed it)
          if (updated.display_close === true && (payload.old as Game).display_close === false) {
            window.close()
            setClosed(true)
            return
          }

          setConnectionLost(false)
          prevStatusRef.current = updated.status
          setGame(updated)
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'answers', filter: `game_id=eq.${gameId}` },
        (payload) => {
          setConnectionLost(false)
          const incoming = payload.new as { round: number }
          setGame((prev) => {
            if (prev && incoming.round === prev.current_round) {
              setAnswerCount((c) => c + 1)
            }
            return prev
          })
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
        }
      })

    return () => { supabase.removeChannel(channel) }
  }, [gameId])



  if (closed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 gap-6 text-center px-8">
        <p className="text-6xl">👋</p>
        <p className="text-3xl font-black text-white">Thanks for playing!</p>
        <p className="text-white/40 text-lg">The host has ended the session.</p>
        <p className="text-white/20 text-sm mt-4">onelinerslive.com</p>
      </div>
    )
  }

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

  if (game.display_active === false) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 gap-6 text-center px-8">
        <img src="/logo.png" alt="O.N.E. Liners Live" className="w-48 opacity-60" />
        <p className="text-white/20 text-lg font-semibold uppercase tracking-widest">Be right back...</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950">
      {connectionLost && (
        <div className="fixed bottom-16 right-4 z-50 rounded-lg border border-orange-400/30 bg-zinc-900/90 px-3 py-2 text-xs font-semibold text-orange-400 backdrop-blur">
          ⚠️ Connection lost — reconnecting...
        </div>
      )}
      <div className="flex flex-1 flex-col">
        {game.show_leaderboard ? (
          <div className="flex flex-1 flex-col items-center justify-center px-12 gap-8">
            <p className="text-4xl font-black uppercase tracking-widest text-yellow-400">Leaderboard</p>
            <div className="w-full max-w-2xl flex flex-col gap-3">
              {leaderboard.map((p, i) => (
                <div
                  key={p.name}
                  className={`flex items-center gap-6 rounded-2xl px-8 py-5 border ${
                    i === 0
                      ? 'border-yellow-400/40 bg-yellow-400/10'
                      : 'border-white/10 bg-white/5'
                  }`}
                >
                  <span className={`text-3xl font-black w-10 text-center ${
                    i === 0 ? 'text-yellow-400' : 'text-white/30'
                  }`}>
                    {i === 0 ? '🏆' : `${i + 1}`}
                  </span>
                  <span className="flex-1 text-2xl font-bold text-white truncate">{p.name}</span>
                  <span className={`text-3xl font-black ${i === 0 ? 'text-yellow-400' : 'text-white/60'}`}>
                    {p.score}
                  </span>
                </div>
              ))}
              {leaderboard.length === 0 && (
                <p className="text-center text-white/40 text-xl py-12">No scores yet</p>
              )}
            </div>
          </div>
        ) : (
          <>
            {game.status === 'picking' && <GetReadyView game={game} />}
            {game.status === 'waiting' && <WaitingView game={game} />}
            {game.status === 'break' && <BreakView game={game} />}
            {game.status === 'kracronym_intro' && <KracronymIntroView game={game} />}
            {game.status === 'active' && <ActiveView game={game} answerCount={answerCount} />}
            {game.status === 'voting' && <VotingView game={game} />}
            {game.status === 'results' && <ResultsView game={game} />}
            {game.status === 'ended' && <EndedView game={game} />}
          </>
        )}
      </div>
      <BottomBar game={game} />
    </div>
  )
}
