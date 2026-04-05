import { QRCodeSVG } from 'qrcode.react'
import type { Game } from '@/lib/types'

interface Props {
  game: Game
}

export default function BottomBar({ game }: Props) {
  const joinUrl = `https://onelinerslive.com/?code=${game.code}`

  return (
    <div className="flex items-center justify-between border-t border-white/10 bg-zinc-900 px-8 py-4">
      {/* QR code */}
      <div className="rounded-xl bg-white p-2.5">
        <QRCodeSVG value={joinUrl} size={80} bgColor="#ffffff" fgColor="#09090b" level="M" />
      </div>

      {/* Domain */}
      <div className="text-center">
        <p
          className="font-black text-white leading-none"
          style={{ fontSize: 'clamp(1.5rem, 3.5vw, 3rem)' }}
        >
          onelinerslive.com
        </p>
        <p className="mt-1 text-sm text-white/30 uppercase tracking-widest">
          Scan or visit to join
        </p>
      </div>

      {/* Game code */}
      <div className="text-right">
        <p className="text-xs font-semibold uppercase tracking-widest text-yellow-400">
          Game Code
        </p>
        <p
          className="font-black tracking-[0.2em] text-white leading-none"
          style={{ fontSize: 'clamp(2rem, 4vw, 3.5rem)' }}
        >
          {game.code}
        </p>
      </div>
    </div>
  )
}
