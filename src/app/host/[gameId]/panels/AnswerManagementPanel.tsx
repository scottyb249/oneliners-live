'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Game, Answer } from '@/lib/types'

const MAX_APPROVED = 10

interface Props {
  game: Game
}

export default function AnswerManagementPanel({ game }: Props) {
  const [answers, setAnswers] = useState<Answer[]>([])
  const [launching, setLaunching] = useState(false)

  // Load existing answers + subscribe to new ones
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('answers')
        .select('*')
        .eq('game_id', game.id)
        .eq('round', game.current_round)
        .order('submitted_at', { ascending: true })

      if (data) setAnswers(data as Answer[])
    }
    load()

    const channel = supabase
      .channel(`answers-${game.id}-${game.current_round}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'answers',
          filter: `game_id=eq.${game.id}`,
        },
        (payload) => {
          const incoming = payload.new as Answer
          if (incoming.round === game.current_round) {
            setAnswers((prev) => [...prev, incoming])
          }
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [game.id, game.current_round])

  const approvedCount = answers.filter((a) => a.approved).length
  const atLimit = approvedCount >= MAX_APPROVED

  async function toggleApprove(answer: Answer) {
    const newVal = !answer.approved
    // Prevent approving beyond limit
    if (newVal && atLimit) return

    // Optimistic update
    setAnswers((prev) =>
      prev.map((a) => (a.id === answer.id ? { ...a, approved: newVal } : a)),
    )

    await supabase.from('answers').update({ approved: newVal }).eq('id', answer.id)
  }

  async function launchVoting() {
    if (approvedCount === 0 || launching) return
    setLaunching(true)
    await supabase.from('games').update({ status: 'voting' }).eq('id', game.id)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-yellow-400">
            Round {game.current_round} · Answers
          </p>
          <p className="mt-1 text-3xl font-black tracking-widest text-white">
            {game.current_acronym}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black text-white">{approvedCount}<span className="text-white/30 text-lg">/{MAX_APPROVED}</span></p>
          <p className="text-xs text-white/30">approved</p>
        </div>
      </div>

      {/* Launch voting button */}
      <button
        onClick={launchVoting}
        disabled={approvedCount === 0 || launching}
        className="w-full rounded-xl bg-blue-500 py-4 text-lg font-bold text-white transition-all hover:bg-blue-400 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
      >
        {launching ? 'Launching...' : `Launch Voting (${approvedCount} approved)`}
      </button>

      {/* Answer feed */}
      {answers.length === 0 ? (
        <div className="py-12 text-center">
          <p className="animate-pulse text-white/30">Waiting for answers...</p>
        </div>
      ) : (
        <div className="space-y-2">
          {answers.map((answer, i) => {
            const isApproved = answer.approved
            const disableApprove = !isApproved && atLimit

            return (
              <div
                key={answer.id}
                className={`flex items-start gap-3 rounded-xl border px-4 py-3 transition-all ${
                  isApproved
                    ? 'border-green-500/40 bg-green-500/10'
                    : 'border-white/10 bg-white/5'
                } ${disableApprove ? 'opacity-40' : ''}`}
              >
                <span className="mt-0.5 text-xs font-bold text-white/20 w-5 shrink-0">
                  {i + 1}
                </span>
                <p className="flex-1 text-sm text-white leading-relaxed">{answer.content}</p>
                <button
                  onClick={() => toggleApprove(answer)}
                  disabled={disableApprove}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                    isApproved
                      ? 'bg-green-500/20 text-green-400 hover:bg-red-500/20 hover:text-red-400'
                      : 'bg-white/10 text-white/40 hover:bg-green-500/20 hover:text-green-400 disabled:cursor-not-allowed'
                  }`}
                >
                  {isApproved ? '✓ Approved' : 'Approve'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
