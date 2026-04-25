'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { Game, Player } from '@/lib/types'

interface Props {
  game: Game
}

// Simple canvas confetti
function Confetti() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const pieces: {
      x: number; y: number; w: number; h: number;
      color: string; rot: number; vx: number; vy: number; vr: number
    }[] = []

    const colors = ['#facc15', '#ffffff', '#60a5fa', '#f472b6', '#34d399', '#fb923c']

    for (let i = 0; i < 180; i++) {
      pieces.push({
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * 200,
        w: 8 + Math.random() * 8,
        h: 4 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rot: Math.random() * Math.PI * 2,
        vx: (Math.random() - 0.5) * 2,
        vy: 2 + Math.random() * 3,
        vr: (Math.random() - 0.5) * 0.15,
      })
    }

    let running = true
    function draw() {
      if (!running || !ctx || !canvas) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (const p of pieces) {
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        ctx.restore()
        p.x += p.vx
        p.y += p.vy
        p.rot += p.vr
        if (p.y > canvas.height + 20) {
          p.y = -20
          p.x = Math.random() * canvas.width
        }
      }
      requestAnimationFrame(draw)
    }
    draw()
    return () => { running = false }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-0"
      style={{ width: '100%', height: '100%' }}
    />
  )
}

const PODIUM_ORDER = [1, 0, 2] // 2nd, 1st, 3rd
const PODIUM_HEIGHTS = ['h-36', 'h-52', 'h-28']
const PODIUM_COLORS = [
  'from-zinc-600 to-zinc-700 border-zinc-400/50',   // 2nd - silver
  'from-yellow-500 to-yellow-600 border-yellow-300', // 1st - gold
  'from-amber-700 to-amber-800 border-amber-500/50', // 3rd - bronze
]
const TROPHY_COLORS = ['text-zinc-300', 'text-yellow-300', 'text-amber-500']
const PLACE_LABELS = ['2nd', '1st', '3rd']

export default function EndedView({ game }: Props) {
  const [leaderboard, setLeaderboard] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('players')
        .select('*')
        .eq('game_id', game.id)
        .eq('is_host', false)
        .order('score', { ascending: false })

      if (data) setLeaderboard(data as Player[])
      setLoading(false)
    }
    load()
  }, [game.id])

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="animate-pulse text-white/30" style={{ fontSize: '2rem' }}>
          Loading...
        </p>
      </div>
    )
  }

  const top3 = leaderboard.slice(0, 3)
  const rest = leaderboard.slice(3)

  return (
    <div className="relative flex flex-1 flex-col items-center justify-between px-8 py-6 overflow-hidden">
      <Confetti />

      {/* Title */}
      <div className="relative z-10 text-center shrink-0">
        <p className="font-black text-yellow-400 leading-none" style={{ fontSize: 'clamp(2.5rem, 6vw, 5rem)' }}>
          Game Over!
        </p>
        <p className="mt-1 font-semibold text-white/50" style={{ fontSize: 'clamp(0.875rem, 1.5vw, 1.1rem)' }}>
          Thanks for playing O.N.E. Liners Live!
        </p>
      </div>

      {top3.length > 0 && (
        <div className="relative z-10 flex w-full flex-1 items-end justify-center gap-4 px-4 py-2 max-w-5xl">
          {PODIUM_ORDER.map((leaderIdx, podiumIdx) => {
            const player = top3[leaderIdx]
            if (!player) return <div key={podiumIdx} className="flex-1" />
            const displayName = player.team_name ?? player.name
            const podiumHeights = ['45%', '65%', '30%']
            return (
              <div key={player.id} className="flex flex-1 flex-col items-center gap-3">
                <div className="flex flex-col items-center gap-2 text-center">
                  <span className={TROPHY_COLORS[leaderIdx]} style={{ fontSize: 'clamp(2.5rem, 5vw, 5rem)' }}>&#x1F3C6;</span>
                  <p className="font-black text-white leading-tight px-2" style={{ fontSize: 'clamp(1.25rem, 2.8vw, 2.5rem)' }}>
                    {displayName}
                  </p>
                  <p className="font-black text-yellow-400 tabular-nums" style={{ fontSize: 'clamp(1rem, 2vw, 1.75rem)' }}>
                    {player.score} pts
                  </p>
                </div>
                <div
                  className={`w-full rounded-t-2xl border-2 bg-gradient-to-b flex items-center justify-center ${PODIUM_COLORS[leaderIdx]}`}
                  style={{ height: podiumHeights[podiumIdx], minHeight: '80px' }}
                >
                  <p className="font-black text-white/90" style={{ fontSize: 'clamp(2rem, 5vw, 4.5rem)' }}>
                    {PLACE_LABELS[podiumIdx]}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {rest.length > 0 && (
        <div className="relative z-10 w-full max-w-3xl flex flex-wrap justify-center gap-2 shrink-0">
          {rest.map((player, i) => (
            <div key={player.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2">
              <span className="font-bold text-white/30 tabular-nums" style={{ fontSize: 'clamp(0.875rem, 1.5vw, 1.1rem)' }}>#{i + 4}</span>
              <p className="font-semibold text-white" style={{ fontSize: 'clamp(0.875rem, 1.5vw, 1.1rem)' }}>{player.team_name ?? player.name}</p>
              <p className="font-black text-white/50 tabular-nums" style={{ fontSize: 'clamp(0.875rem, 1.5vw, 1.1rem)' }}>{player.score} pts</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
