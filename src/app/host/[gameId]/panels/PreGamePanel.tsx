'use client'

import { QRCodeSVG } from 'qrcode.react'
import type { Game } from '@/lib/types'

interface Props {
  game: Game
  playerCount: number
  onStartGame: () => void
}

export default function PreGamePanel({ game, playerCount, onStartGame }: Props) {
  const joinUrl = `https://onelinerslive.com/?code=${game.code}`

  const hasStarted = game.current_round > 1 || !!game.current_acronym

  return (
    <div className="flex flex-col items-center gap-8 text-center">
      {/* Game code */}
      <div>
        <p className="text-sm font-semibold uppercase tracking-widest text-yellow-400">Game Code</p>
        <p className="mt-1 text-6xl font-black tracking-[0.25em] text-white">{game.code}</p>
      </div>

      {/* QR code */}
      <div className="rounded-2xl bg-white p-4">
        <QRCodeSVG
          value={joinUrl}
          size={180}
          bgColor="#ffffff"
          fgColor="#09090b"
          level="M"
        />
      </div>
      <p className="text-xs text-white/30 -mt-4">Scan to join at onelinerslive.com</p>

      {/* Player count */}
      <div className="flex items-center gap-2 text-white/60">
        <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse inline-block" />
        <span className="text-lg font-semibold">
          {playerCount} {playerCount === 1 ? 'player' : 'players'} joined
        </span>
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
