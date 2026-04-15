'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Game, Prompt } from '@/lib/types'
import { getTimerDuration } from '@/lib/constants'

interface Props {
  game: Game
  targetRound: number
  isFinalRound: boolean
  letterCount: number
  onCancel: () => void
  onConfirmed: () => void
  onTakeBreak: () => void
  onToggleDisplay: () => void
  onBackToResults?: () => void
}

export default function AcronymPicker({
  game,
  targetRound,
  isFinalRound,
  letterCount,
  onCancel,
  onConfirmed,
  onTakeBreak,
  onToggleDisplay,
  onBackToResults,
}: Props) {
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [loading, setLoading] = useState(true)
  const [themeFilter, setThemeFilter] = useState<string>('all')
  const [selected, setSelected] = useState<Prompt | null>(null)
  const [randomAcronym, setRandomAcronym] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [leaderboard, setLeaderboard] = useState<{ name: string; score: number }[]>([])

  const displayActive = (game as any).display_active !== false
  const usedAcronyms: string[] = game.used_acronyms ?? []

  const CONSONANTS = 'BCDFGHJKLMNPQRSTVWXYZ'
  const VOWELS = 'AEIOU'
  const ALL_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

  function generateRandomAcronym(count: number): string {
    // Ensure at least one vowel and one consonant for playability
    let letters = ''
    if (count >= 2) {
      const vowelPos = Math.floor(Math.random() * count)
      for (let i = 0; i < count; i++) {
        if (i === vowelPos) {
          letters += VOWELS[Math.floor(Math.random() * VOWELS.length)]
        } else {
          letters += CONSONANTS[Math.floor(Math.random() * CONSONANTS.length)]
        }
      }
    } else {
      letters = ALL_LETTERS[Math.floor(Math.random() * ALL_LETTERS.length)]
    }
    return letters
  }

  function handleShuffle() {
    const acronym = generateRandomAcronym(letterCount)
    setRandomAcronym(acronym)
    setSelected(null) // clear any picked prompt — mutual exclusion
  }

  function handleSelectPrompt(prompt: Prompt) {
    setSelected(prompt)
    setRandomAcronym(null) // clear random — mutual exclusion
  }

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

  async function handleShowLeaderboard() {
    const { data } = await supabase
      .from('players')
      .select('name, score, role, team_name')
      .eq('game_id', game.id)
      .in('role', ['individual', 'team_leader'])
      .order('score', { ascending: false })

    if (data) {
      setLeaderboard(data.map((p) => ({ name: p.team_name ?? p.name, score: p.score })))
    }
    setShowLeaderboard(true)
  }

  async function handleLaunchKracronym() {
    if (confirming) return
    setConfirming(true)
    setError('')

    const { data: kracronymPrompts } = await supabase
      .from('prompts')
      .select('*')
      .gte('letter_count', 6)
      .not('acronym', 'in', `(${usedAcronyms.join(',')})`)
      .limit(50)

    if (!kracronymPrompts || kracronymPrompts.length === 0) {
      setError('No KRACRONYM prompts available.')
      setConfirming(false)
      return
    }

    const pick = kracronymPrompts[Math.floor(Math.random() * kracronymPrompts.length)] as Prompt
    const updatedUsed = [...usedAcronyms, pick.acronym]
    const duration = getTimerDuration(pick.acronym, true)

    const { error: updateErr } = await supabase
      .from('games')
      .update({
        current_acronym: pick.acronym,
        current_round: targetRound,
        status: 'active',
        round_started_at: new Date().toISOString(),
        is_final_round: true,
        used_acronyms: updatedUsed,
        reveal_index: -1,
        podium_step: 0,
        round_duration: duration,
      })
      .eq('id', game.id)

    if (updateErr) {
      setError('Failed to launch KRACRONYM. Try again.')
      setConfirming(false)
      return
    }

    onConfirmed()
  }

  async function handleConfirm() {
    // Either a picked prompt or a random acronym must be active
    if ((!selected && !randomAcronym) || confirming) return
    setConfirming(true)
    setError('')

    const acronymToLaunch = selected ? selected.acronym : randomAcronym!
    // Random acronyms are NOT added to used_acronyms so they don't block future picks
    const updatedUsed = selected ? [...usedAcronyms, selected.acronym] : usedAcronyms
    const duration = getTimerDuration(acronymToLaunch, isFinalRound)

    const { error: updateErr } = await supabase
      .from('games')
      .update({
        current_acronym: acronymToLaunch,
        current_round: targetRound,
        status: 'active',
        round_started_at: new Date().toISOString(),
        is_final_round: isFinalRound,
        used_acronyms: updatedUsed,
        reveal_index: -1,
        podium_step: 0,
        round_duration: duration,
      })
      .eq('id', game.id)

    if (updateErr) {
      setError('Failed to start round. Try again.')
      setConfirming(false)
      return
    }

    onConfirmed()
  }

  const themes = ['all', ...Array.from(new Set(prompts.map((p) => p.theme ?? 'Uncategorized')))]
  const filtered = themeFilter === 'all'
    ? prompts
    : prompts.filter((p) => (p.theme ?? 'Uncategorized') === themeFilter)

  // The active acronym for the launch button label
  const activeAcronym = randomAcronym ?? selected?.acronym ?? null

  if (showLeaderboard) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold uppercase tracking-widest text-yellow-400">Current Standings</p>
          <button onClick={() => setShowLeaderboard(false)} className="text-sm text-white/30 hover:text-white transition-colors">← Back</button>
        </div>
        <div className="space-y-2">
          {leaderboard.map((entry, i) => (
            <div key={i} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-yellow-400">#{i + 1}</span>
                <span className="font-bold text-white">{entry.name}</span>
              </div>
              <span className="text-lg font-black text-white">{entry.score}</span>
            </div>
          ))}
        </div>
        <button onClick={() => setShowLeaderboard(false)} className="w-full rounded-xl border border-white/20 py-3 text-sm font-bold text-white/60 hover:text-white transition-colors">
          ← Back to Acronym Picker
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
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

      {/* Random acronym display — shows when shuffle has been used */}
      {randomAcronym && (
        <div className="flex items-center justify-between rounded-xl border border-purple-400/40 bg-purple-400/10 px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-purple-400">Random Acronym</p>
            <p className="text-2xl font-black tracking-widest text-white mt-0.5">{randomAcronym}</p>
          </div>
          <button
            onClick={handleShuffle}
            className="rounded-lg border border-purple-400/40 px-3 py-2 text-sm font-bold text-purple-400 hover:border-purple-400 hover:bg-purple-400/20 transition-all"
          >
            🎲 Shuffle
          </button>
        </div>
      )}

      {/* PRIMARY: Launch button at top */}
      <button
        onClick={handleConfirm}
        disabled={!activeAcronym || confirming}
        className="w-full rounded-xl bg-yellow-400 py-4 text-lg font-bold text-black transition-all hover:bg-yellow-300 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {confirming
          ? 'Starting...'
          : activeAcronym
          ? `Launch "${activeAcronym}" →`
          : 'Select an acronym below'}
      </button>

      {/* Secondary actions — 3 columns */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={onTakeBreak}
          className="rounded-xl border border-white/20 px-3 py-3 text-sm font-bold text-white/70 hover:border-white/40 hover:text-white transition-all"
        >
          ☕ Break
        </button>
        <button
          onClick={handleShowLeaderboard}
          className="rounded-xl border border-yellow-400/40 px-3 py-3 text-sm font-bold text-yellow-400/80 hover:border-yellow-400 hover:text-yellow-400 transition-all"
        >
          🏆 Standings
        </button>
        <button
          onClick={onToggleDisplay}
          className={`rounded-xl border px-3 py-3 text-sm font-bold transition-all ${
            displayActive
              ? 'border-blue-400/40 text-blue-400/80 hover:border-blue-400 hover:text-blue-400'
              : 'border-orange-400/60 bg-orange-400/10 text-orange-400 hover:bg-orange-400/20'
          }`}
        >
          {displayActive ? '📺 Screen On' : '📺 Screen Off'}
        </button>
      </div>

      {!isFinalRound && (
        <button
          onClick={handleLaunchKracronym}
          disabled={confirming}
          className="w-full rounded-xl border border-yellow-400/60 bg-yellow-400/10 py-3 text-sm font-bold text-yellow-300 transition-all hover:bg-yellow-400/20 disabled:opacity-40"
        >
          {confirming ? 'Launching...' : '⚡ Skip to KRACRONYM'}
        </button>
      )}

      {onBackToResults && (
        <button
          onClick={onBackToResults}
          className="w-full rounded-xl border border-blue-400/30 bg-blue-400/5 py-3 text-sm font-bold text-blue-400 hover:border-blue-400/60 hover:bg-blue-400/10 transition-all"
        >
          ← Back to Round Results
        </button>
      )}

      {error && <p className="text-sm text-red-400 text-center">{error}</p>}

      {/* Theme filter + shuffle button row */}
      <div className="flex items-center gap-2 flex-wrap">
        {themes.length > 2 && themes.map((theme) => (
          <button
            key={theme}
            onClick={() => setThemeFilter(theme)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-all ${
              themeFilter === theme ? 'bg-yellow-400 text-black' : 'bg-white/10 text-white/60 hover:bg-white/20'
            }`}
          >
            {theme === 'all' ? 'All' : theme}
          </button>
        ))}
        {/* Shuffle button — always visible, sits at end of filter row */}
        {!randomAcronym && (
          <button
            onClick={handleShuffle}
            className="ml-auto rounded-full border border-purple-400/40 px-3 py-1 text-sm font-medium text-purple-400 hover:border-purple-400 hover:bg-purple-400/10 transition-all"
          >
            🎲 Random
          </button>
        )}
      </div>

      {/* Acronym list */}
      {loading ? (
        <p className="text-center animate-pulse text-white/40">Loading prompts...</p>
      ) : filtered.length === 0 ? (
        <p className="text-center text-white/40">No {letterCount}-letter prompts found.</p>
      ) : (
        <div className="space-y-2 max-h-[35vh] overflow-y-auto pr-1">
          {filtered.map((prompt) => {
            const alreadyUsed = usedAcronyms.includes(prompt.acronym)
            const isSelected = selected?.id === prompt.id
            return (
              <button
                key={prompt.id}
                onClick={() => !alreadyUsed && handleSelectPrompt(prompt)}
                disabled={alreadyUsed}
                className={`w-full rounded-xl border px-4 py-3 text-left transition-all ${
                  alreadyUsed
                    ? 'cursor-not-allowed border-white/5 bg-white/[0.02] opacity-40'
                    : isSelected
                    ? 'border-yellow-400 bg-yellow-400/10 ring-2 ring-yellow-400/30'
                    : 'border-white/10 bg-white/5 hover:border-white/30 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <p className="text-xl font-black tracking-widest text-white">{prompt.acronym}</p>
                  <div className="flex items-center gap-2 shrink-0">
                    {alreadyUsed && (
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/40">used this game</span>
                    )}
                    {prompt.theme && !alreadyUsed && (
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/40">{prompt.theme}</span>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
