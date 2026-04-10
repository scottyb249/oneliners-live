import { QRCodeSVG } from 'qrcode.react'
import type { Game } from '@/lib/types'

interface Props {
  game: Game
}

export default function BottomBar({ game }: Props) {
  const joinUrl = `https://onelinerslive.com/?code=${game.code}`

  return (
    <div className="flex items-center justify-between border-t border-white/10 bg-zinc-900 px-8 py-3">
      {/* QR code */}
      <div className="rounded-xl bg-white p-2.5">
        <QRCodeSVG value={joinUrl} size={80} bgColor="#ffffff" fgColor="#09090b" level="M" />
      </div>

      {/* Center — domain + pills */}
      <div className="flex flex-col items-center gap-2">
        <p
          className="font-black text-white leading-none"
          style={{ fontSize: 'clamp(1.5rem, 3.5vw, 3rem)' }}
        >
          onelinerslive.com
        </p>
        <p className="text-sm font-semibold text-white/70 uppercase tracking-widest">
          Scan or visit to join · Join anytime!
        </p>
        <div className="flex gap-3">
          {['🤝 Play as a Team', '🧑 Play Solo', '⚖️ Be a Judge!'].map((item) => (
            <div
              key={item}
              className="rounded-full border border-yellow-400/40 bg-yellow-400/10 px-3 py-1"
            >
              <p className="text-xs font-semibold text-yellow-400">{item}</p>
            </div>
          ))}
        </div>
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
