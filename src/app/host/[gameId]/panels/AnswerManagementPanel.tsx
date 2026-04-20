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
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [messagingId, setMessagingId] = useState<string | null>(null)
  const [messageContent, setMessageContent] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)

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
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'answers',
          filter: `game_id=eq.${game.id}`,
        },
        (payload) => {
          const updated = payload.new as Answer
          if (updated.round === game.current_round) {
            setAnswers((prev) =>
              prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)),
            )
          }
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [game.id, game.current_round])

  const approvedAnswers = answers.filter((a) => a.approved)
  const approvedCount = approvedAnswers.length
  const atLimit = approvedCount >= MAX_APPROVED

  async function toggleApprove(answer: Answer) {
    const newVal = !answer.approved
    if (newVal && atLimit) return

    setAnswers((prev) =>
      prev.map((a) => (a.id === answer.id ? { ...a, approved: newVal } : a)),
    )

    await supabase.from('answers').update({ approved: newVal }).eq('id', answer.id)
  }

  function startEdit(answer: Answer) {
    setEditingId(answer.id)
    setEditingContent(answer.content)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditingContent('')
  }

  function startMessage(answer: Answer) {
    setMessagingId(answer.id)
    setMessageContent('')
    setEditingId(null)
  }

  function cancelMessage() {
    setMessagingId(null)
    setMessageContent('')
  }

  async function sendMessage(answer: Answer) {
    const trimmed = messageContent.trim()
    if (!trimmed) return
    setSendingMessage(true)
    await supabase.from('answers').update({ host_message: trimmed }).eq('id', answer.id)
    setAnswers((prev) =>
      prev.map((a) => (a.id === answer.id ? { ...a, host_message: trimmed } : a))
    )
    setSendingMessage(false)
    setMessagingId(null)
    setMessageContent('')
  }

  async function saveEdit(answer: Answer) {
    const trimmed = editingContent.trim()
    if (!trimmed || trimmed === answer.content) {
      cancelEdit()
      return
    }
    setSaving(true)

    await supabase
      .from('answers')
      .update({ content: trimmed })
      .eq('id', answer.id)

    setAnswers((prev) =>
      prev.map((a) => (a.id === answer.id ? { ...a, content: trimmed } : a)),
    )
    setSaving(false)
    setEditingId(null)
    setEditingContent('')
  }

  async function launchVoting() {
    if (approvedCount === 0 || launching) return
    setLaunching(true)

    // Find the approved answer with the earliest submitted_at
    const fastest = approvedAnswers.reduce((prev, curr) =>
      new Date(curr.submitted_at).getTime() < new Date(prev.submitted_at).getTime() ? curr : prev
    )

    // Mark it as fastest and award +1 to that player's score
    await supabase
      .from('answers')
      .update({ is_fastest: true })
      .eq('id', fastest.id)

    await supabase.rpc('increment_player_score', {
      p_player_id: fastest.player_id,
      p_amount: 1,
    })

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
          <p className="text-2xl font-black text-white">
            {approvedCount}<span className="text-white/30 text-lg">/{MAX_APPROVED}</span>
          </p>
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
            const isFastest = answer.is_fastest
            const disableApprove = !isApproved && atLimit
            const isEditing = editingId === answer.id
            const isMessaging = messagingId === answer.id

            return (
              <div
                key={answer.id}
                className={`rounded-xl border px-4 py-3 transition-all ${
                  isApproved
                    ? 'border-green-500/40 bg-green-500/10'
                    : 'border-white/10 bg-white/5'
                } ${disableApprove && !isEditing && !isMessaging ? 'opacity-40' : ''}`}
              >
                {isEditing ? (
                  /* Edit mode */
                  <div className="space-y-2">
                    <textarea
                      value={editingContent}
                      onChange={(e) => setEditingContent(e.target.value)}
                      maxLength={200}
                      rows={2}
                      autoFocus
                      className="w-full resize-none rounded-lg border border-yellow-400/40 bg-white/10 px-3 py-2 text-sm text-white focus:border-yellow-400 focus:outline-none focus:ring-1 focus:ring-yellow-400/30"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={cancelEdit}
                        disabled={saving}
                        className="flex-1 rounded-lg border border-white/20 py-1.5 text-xs font-bold text-white/50 hover:text-white transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => saveEdit(answer)}
                        disabled={saving || !editingContent.trim() || editingContent.trim() === answer.content}
                        className="flex-1 rounded-lg bg-yellow-400 py-1.5 text-xs font-bold text-black hover:bg-yellow-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                ) : isMessaging ? (
                  /* Message mode */
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-blue-400 uppercase tracking-widest">Note from the Host</p>
                    <p className="text-xs text-white/40 italic">"{answer.content}"</p>
                    <textarea
                      value={messageContent}
                      onChange={(e) => setMessageContent(e.target.value)}
                      maxLength={150}
                      rows={2}
                      autoFocus
                      placeholder="e.g. Please keep it clean 😅"
                      className="w-full resize-none rounded-lg border border-blue-400/40 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400/30"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={cancelMessage}
                        disabled={sendingMessage}
                        className="flex-1 rounded-lg border border-white/20 py-1.5 text-xs font-bold text-white/50 hover:text-white transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => sendMessage(answer)}
                        disabled={sendingMessage || !messageContent.trim()}
                        className="flex-1 rounded-lg bg-blue-500 py-1.5 text-xs font-bold text-white hover:bg-blue-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {sendingMessage ? 'Sending...' : 'Send Note'}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Normal display mode */
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 text-xs font-bold text-white/20 w-5 shrink-0">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white leading-relaxed">{answer.content}</p>
                      {isFastest && (
                        <p className="text-xs text-yellow-400 font-semibold mt-0.5">⚡ Fastest Answer +1</p>
                      )}
                      {(answer as any).host_message && (
                        <p className="text-xs text-blue-400 mt-0.5">✉️ "{(answer as any).host_message}"</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => startMessage(answer)}
                        className="rounded-lg px-2 py-1.5 text-xs font-bold text-white/30 hover:bg-white/10 hover:text-blue-400 transition-all"
                        title="Send note to player"
                      >
                        ✉️
                      </button>
                      {/* Edit button — only show before voting launches */}
                      <button
                        onClick={() => startEdit(answer)}
                        className="rounded-lg px-2 py-1.5 text-xs font-bold text-white/30 hover:bg-white/10 hover:text-white/70 transition-all"
                        title="Edit answer"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => toggleApprove(answer)}
                        disabled={disableApprove}
                        className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                          isApproved
                            ? 'bg-green-500/20 text-green-400 hover:bg-red-500/20 hover:text-red-400'
                            : 'bg-white/10 text-white/40 hover:bg-green-500/20 hover:text-green-400 disabled:cursor-not-allowed'
                        }`}
                      >
                        {isApproved ? '✓ Approved' : 'Approve'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
