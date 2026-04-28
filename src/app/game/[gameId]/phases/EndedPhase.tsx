'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Game, Player } from '../types'

interface Props {
  game: Game
  player: Player
}

interface LeaderboardEntry {
  id: string
  name: string
  role: string
  team_name: string | null
  score: number
  final_position: number | null
  avatar: string | null
}

const MEDALS = ['🥇', '🥈', '🥉']

// ── Avatar sprite ─────────────────────────────────────────────────────────
const AVATAR_DATA: Record<string, { charX: number; charY: number; charW: number; charH: number }> = {
  avatar_01: { charX: 95,  charY: 319, charW: 249, charH: 385 },
  avatar_02: { charX: 72,  charY: 383, charW: 288, charH: 242 },
  avatar_03: { charX: 95,  charY: 319, charW: 249, charH: 386 },
  avatar_04: { charX: 159, charY: 312, charW: 209, charH: 345 },
  avatar_05: { charX: 127, charY: 319, charW: 242, charH: 386 },
  avatar_06: { charX: 143, charY: 319, charW: 241, charH: 306 },
}
function AvatarSprite({ id, size = 48 }: { id: string | null; size?: number }) {
  const avatarId = id ?? 'avatar_01'
  const data = AVATAR_DATA[avatarId] ?? AVATAR_DATA.avatar_01
  const scale = size / data.charH
  const scaledW = 1536 * scale
  const scaledH = 1024 * scale
  const offsetX = -(data.charX * scale)
  const offsetY = -(data.charY * scale)
  const displayW = data.charW * scale
  return (
    <div style={{
      width: displayW, height: size,
      backgroundImage: `url(/avatars/${avatarId}.png)`,
      backgroundSize: `${scaledW}px ${scaledH}px`,
      backgroundPosition: `${offsetX}px ${offsetY}px`,
      backgroundRepeat: 'no-repeat',
      imageRendering: 'pixelated',
      flexShrink: 0,
      overflow: 'hidden',
    }} />
  )
}

export default function EndedPhase({ game, player }: Props) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('players')
        .select('id, name, role, team_name, score, final_position, avatar')
        .eq('game_id', game.id)
        .neq('role', 'team_member')
        .neq('role', 'crowd_voter')
        .order('final_position', { ascending: true, nullsFirst: false })

      if (data) setLeaderboard(data)
      setLoading(false)
    }
    load()
  }, [game.id])

  function handleDone() {
    localStorage.removeItem('one_game_id')
    localStorage.removeItem('one_player_id')
    window.location.href = '/'
  }

  const isNonScoring = player.role === 'team_member' || player.role === 'crowd_voter'
  const myEntry = leaderboard.find((p) => p.id === player.id)
  const myFinalPos = myEntry?.final_position ?? null

  if (loading) {
    return (
      <div className="flex w-full flex-col items-center">
        <p className="animate-pulse text-white/40">Loading final results...</p>
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col gap-8">
      <div className="text-center">
        <p className="text-4xl">🎉</p>
        <p className="mt-2 text-sm font-semibold uppercase tracking-widest text-yellow-400">
          Game Over
        </p>
        <p className="mt-1 text-3xl font-black text-white">Final Leaderboard</p>
      </div>

      {!isNonScoring && myFinalPos && myEntry && (
        <div className="rounded-2xl border border-yellow-400/30 bg-yellow-400/10 px-6 py-5 text-center">
          <div className="flex justify-center mb-2">
            <AvatarSprite id={player.avatar ?? null} size={72} />
          </div>
          <p className="text-sm text-white/50">You finished</p>
          <p className="mt-1 text-5xl font-black text-yellow-400">
            {myFinalPos <= 3 ? MEDALS[myFinalPos - 1] : `#${myFinalPos}`}
          </p>
          <p className="mt-1 text-sm text-white/50">
            with {myEntry.score} {myEntry.score === 1 ? 'point' : 'points'}
          </p>
        </div>
      )}

      {player.role === 'team_member' && (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-5 text-center">
          <p className="text-3xl">🤝</p>
          <p className="mt-2 font-semibold text-white">Great teamwork!</p>
          <p className="mt-1 text-sm text-white/50">Check your team leader's score below.</p>
        </div>
      )}

      {player.role === 'crowd_voter' && (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-5 text-center">
          <p className="text-3xl">🗳️</p>
          <p className="mt-2 font-semibold text-white">Thanks for voting!</p>
          <p className="mt-1 text-sm text-white/50">Your votes helped crown the winner.</p>
        </div>
      )}

      <div className="space-y-3">
        {leaderboard.map((entry, i) => {
          const isMe = entry.id === player.id
          const displayName = entry.role === 'team_leader' && entry.team_name
            ? entry.team_name
            : entry.name
          const pos = entry.final_position
          return (
            <div
              key={entry.id}
              className={`flex items-center gap-4 rounded-xl border px-5 py-3 ${
                isMe ? 'border-yellow-400/40 bg-yellow-400/10' : 'border-white/10 bg-white/5'
              }`}
            >
              <span className="w-8 shrink-0 text-center text-xl">
                {pos != null && pos <= 3 ? MEDALS[pos - 1] : `#${pos ?? i + 1}`}
              </span>
              <AvatarSprite id={entry.avatar ?? null} size={36} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-white truncate">
                  {displayName}{' '}
                  {isMe && <span className="text-sm text-yellow-400">(You)</span>}
                </p>
                {entry.role === 'team_leader' && entry.team_name && (
                  <p className="text-xs text-white/40 truncate">led by {entry.name}</p>
                )}
              </div>
              <p className="shrink-0 text-xl font-black text-white">{entry.score}</p>
            </div>
          )
        })}
      </div>

      <button
        onClick={handleDone}
        className="w-full rounded-xl bg-yellow-400 py-4 text-lg font-bold text-black transition-all hover:bg-yellow-300 active:scale-95"
      >
        Done →
      </button>
    </div>
  )
}
