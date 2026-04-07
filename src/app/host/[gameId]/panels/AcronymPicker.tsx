'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Game, Prompt } from '@/lib/types'

interface Props {
  game: Game
  targetRound: number
  isFinalRound: boolean
  letterCount: number
  onCancel: () => void
  onConfirmed: () => void
}

export default function AcronymPicker({
  game,
  targetRound,
  isFinalRound,
  letterCount,
  onCancel,
  onConfirmed,
}: Props) {
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [loading, setLoading] = useState(true)
  const [themeFilter, setThemeFilter] = useState<string>('all')
  const [selected, setSelected] = useState<Prompt | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('prompts')
        .select('*')
        .eq('letter_count', letterCount)
        .order('theme', { nullsFirst: false })
        .order('acronym')

      if (data) setPrompts(data as Prompt[])
      setLoading(false)
    }
    load()
  }, [letterCount])

  const themes = ['all', ...Array.from(new Set(prompts.map((p) => p.theme ?? 'Uncategorized')))]

  const filtered = themeFilter === 'all'
    ? prompts
    : prompts.filter((p) => (p.theme ?? 'Uncategorized') === themeFilter)

  async function handleConfirm() {
    if (!selected || confirming) return
    setConfirming(true)
    setError('')

    const { error: updateErr } = await supabase
      .from('games')
      .update({
        current_acronym: selected.acronym,
        current_round: targetRound,
        status: 'active',
        round_started_at: new Date().toISOString(),
        is_final_round: isFinalRound,
      })
      .eq('id', game.id)

    if (updateErr) {
      setError('Failed to start round. Try again.')
      setConfirming(false)
      return
    }

    onConfirmed()
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-yellow-400">
            {isFinalRound ? '⚡ KRACRONYM — Final Round' : `Round ${targetRound}`}
          </p>
          <p className="mt-1 text-lg font-bold text-white">{letterCount}-letter acronym</p>
        </div>
        <button onClick={onCancel} className="text-sm text-white/30 hover:text-white transition-colors">
          Cancel
        </button>
      </div>

      {/* Theme filter */}
      {themes.length > 2 && (
        <div className="flex flex-wrap gap-2">
          {themes.map((theme) => (
            <button
              key={theme}
              onClick={() => setThemeFilter(theme)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-all ${
                themeFilter === theme
                  ? 'bg-yellow-400 text-black'
                  : 'bg-white/10 text-white/60 hover:bg-white/20'
              }`}
            >
              {theme === 'all' ? 'All' : theme}
            </button>
          ))}
        </div>
      )}

      {/* Prompt list */}
      {loading ? (
        <p className="text-center animate-pulse text-white/40">Loading prompts...</p>
      ) : filtered.length === 0 ? (
        <p className="text-center text-white/40">
          No {letterCount}-letter prompts found.
        </p>
      ) : (
        <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
          {filtered.map((prompt) => (
            <button
              key={prompt.id}
              onClick={() => setSelected(prompt)}
              className={`w-full rounded-xl border px-4 py-3 text-left transition-all ${
                selected?.id === prompt.id
                  ? 'border-yellow-400 bg-yellow-400/10 ring-2 ring-yellow-400/30'
                  : 'border-white/10 bg-white/5 hover:border-white/30 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <p className="text-xl font-black tracking-widest text-white">{prompt.acronym}</p>
                {prompt.theme && (
                  <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/40">
                    {prompt.theme}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Confirm */}
      {error && <p className="text-sm text-red-400 text-center">{error}</p>}
      <button
        onClick={handleConfirm}
        disabled={!selected || confirming}
        className="w-full rounded-xl bg-yellow-400 py-4 text-lg font-bold text-black transition-all hover:bg-yellow-300 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {confirming
          ? 'Starting...'
          : selected
          ? `Launch "${selected.acronym}" →`
          : 'Select an acronym'}
      </button>
    </div>
  )
}
