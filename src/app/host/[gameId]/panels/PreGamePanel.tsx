'use client'

import { useState, useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '@/lib/supabase'
import type { Game } from '@/lib/types'

interface Props {
  game: Game
  playerCount: number
  onStartGame: () => void
}

const SLIDE_LABELS = ['Lobby', 'How to Play', 'Rules', 'Pledge']
const TOTAL_SLIDES = SLIDE_LABELS.length

export default function PreGamePanel({ game, playerCount, onStartGame }: Props) {
  const joinUrl = `https://onelinerslive.com/?code=${game.code}`
  const hasStarted = game.current_round > 1 || !!game.current_acronym
  const [secondScreenOpen, setSecondScreenOpen] = useState(false)
  const secondWindowRef = useRef<Window | null>(null)

  const currentSlide = game.display_slide ?? 0

  function openSecondScreen() {
    const win = window.open(
      `/display/${game.id}`,
      'oneliners-display',
      'width=1280,height=720,menubar=no,toolbar=no,location=no,status=no'
    )
    secondWindowRef.current = win
    setSecondScreenOpen(true)
  }

  function closeSecondScreen() {
    secondWindowRef.current?.close()
    secondWindowRef.current = null
    setSecondScreenOpen(false)
  }

  async function goToSlide(index: number) {
    await supabase
      .from('games')
      .update({ display_slide: index })
      .eq('id', game.id)
  }

  async function nextSlide() {
    const next = Math.min(currentSlide + 1, TOTAL_SLIDES - 1)
    await goToSlide(next)
  }

  async function prevSlide() {
    const prev = Math.max(currentSlide - 1, 0)
    await goToSlide(prev)
  }

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      {/* Game code */}
      <div>
        <p className="text-sm font-semibold uppercase tracking-widest text-yellow-400">Game Code</p>
        <p className="mt-1 text-6xl font-black tracking-[0.25em] text-white">{game.code}</p>
      </div>

      {/* QR code */}
      <div className="rounded-2xl bg-white p-4">
        <QRCodeSVG value={joinUrl} size={180} bgColor="#ffffff" fgColor="#09090b" level="M" />
      </div>
      <p className="text-xs text-white/30 -mt-4">Scan to join at onelinerslive.com</p>

      {/* Player count */}
      <div className="flex items-center gap-2 text-white/60">
        <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse inline-block" />
        <span className="text-lg font-semibold">
          {playerCount} {playerCount === 1 ? 'player' : 'players'} joined
        </span>
      </div>

      {/* Second screen toggle */}
      <div className="w-full max-w-xs">
        {!secondScreenOpen ? (
          <button
            onClick={openSecondScreen}
            className="w-full rounded-xl border border-blue-500/50 bg-blue-500/10 px-4 py-3 text-sm font-semibold text-blue-400 transition-all hover:bg-blue-500/20 active:scale-95"
          >
            🖥️ Open Second Screen
          </button>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Mini preview label */}
            <div className="flex items-center justify-between rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-2">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse inline-block" />
                <span className="text-sm font-semibold text-blue-400">Second Screen Active</span>
              </div>
              <button
                onClick={closeSecondScreen}
                className="text-xs text-white/30 hover:text-white/60 transition-colors"
              >
                ✕ Close
              </button>
            </div>

            {/* Mini preview of current slide */}
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left">
              <p className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-1">
                Now Showing
              </p>
              <p className="text-sm font-bold text-white">
                {SLIDE_LABELS[currentSlide]}
              </p>
              <p className="text-xs text-white/40 mt-0.5">
                Slide {currentSlide + 1} of {TOTAL_SLIDES}
              </p>
            </div>

            {/* Slide navigation */}
            <div className="flex gap-2">
              <button
                onClick={prevSlide}
                disabled={currentSlide === 0}
                className="flex-1 rounded-xl border border-white/20 py-2 text-sm font-semibold text-white/70 transition-all hover:bg-white/10 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ← Prev
              </button>
              <button
                onClick={nextSlide}
                disabled={currentSlide === TOTAL_SLIDES - 1}
                className="flex-1 rounded-xl border border-white/20 py-2 text-sm font-semibold text-white/70 transition-all hover:bg-white/10 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>

            {/* Quick jump buttons */}
            <div className="grid grid-cols-2 gap-1.5">
              {SLIDE_LABELS.map((label, i) => (
                <button
                  key={i}
                  onClick={() => goToSlide(i)}
                  className={`rounded-lg px-2 py-1.5 text-xs font-semibold transition-all active:scale-95 ${
                    currentSlide === i
                      ? 'bg-yellow-400 text-black'
                      : 'border border-white/10 bg-white/5 text-white/50 hover:bg-white/10'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Start button */}
      <button
        onClick={onStartGame}
        className="w-full max-w-xs rounded-xl bg-yellow-400 px-6 py-4 text-lg font-bold text-black transition-all hover:bg-yellow-300 active:scale-95"
      >
        {hasStarted ? 'Continue Game →' : 'Start Game →'}
      </button>
    </div>
  )
}
