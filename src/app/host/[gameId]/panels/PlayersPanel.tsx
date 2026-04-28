'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Game } from '@/lib/types'

interface Player {
  id: string
  name: string
  role: string
  team_name: string | null
  score: number
  kicked: boolean
  avatar: string | null
}

const ROLE_ICONS: Record<string, string> = {
  individual: '🎤',
  team_leader: '👑',
  team_member: '🤝',
  crowd_voter: '🗳️',
}

const ROLE_LABELS: Record<string, string> = {
  individual: 'Individual',
  team_leader: 'Team Leader',
  team_member: 'Team Member',
  crowd_voter: 'Crowd Voter',
}

interface Props {
  game: Game
  onClose: () => void
}

// Per-avatar frame 1 bounding box data, measured via Pillow
// Sheet: 1536x1024, 4 frames horizontally (384px each)
const AVATAR_DATA: Record<string, { charX: number; charY: number; charW: number; charH: number }> = {
  avatar_01: { charX: 95, charY: 319, charW: 249, charH: 385 }, // Lucha Wrestler
  avatar_02: { charX: 72, charY: 383, charW: 288, charH: 242 }, // Kraken
  avatar_03: { charX: 95, charY: 319, charW: 249, charH: 386 }, // X Wrestler
  avatar_04: { charX: 96, charY: 303, charW: 192, charH: 354 }, // Banana
}

function AvatarSprite({ id, size = 40 }: { id: string | null; size?: number }) {
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
      width: displayW,
      height: size,
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

export default function PlayersPanel({ game, onClose }: Props) {
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmKickId, setConfirmKickId] = useState<string | null>(null)
  const [kicking, setKicking] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('players')
        .select('id, name, role, team_name, score, kicked, avatar')
        .eq('game_id', game.id)
        .eq('is_host', false)
        .order('score', { ascending: false })

      if (data) setPlayers(data as Player[])
      setLoading(false)
    }
    load()

    const channel = supabase
      .channel(`players-panel-${game.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'players', filter: `game_id=eq.${game.id}` },
        (payload) => {
          const p = payload.new as Player
          setPlayers((prev) => {
            if (prev.find((x) => x.id === p.id)) return prev
            return [...prev, p]
          })
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'players', filter: `game_id=eq.${game.id}` },
        (payload) => {
          const updated = payload.new as Player
          setPlayers((prev) =>
            prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)),
          )
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [game.id])

  async function handleKick(player: Player) {
    setKicking(player.id)
    await supabase.from('players').update({ kicked: true }).eq('id', player.id)
    setPlayers((prev) =>
      prev.map((p) => (p.id === player.id ? { ...p, kicked: true } : p)),
    )
    setKicking(null)
    setConfirmKickId(null)
  }

  const activePlayers = players.filter((p) => !p.kicked)
  const kickedPlayers = players.filter((p) => p.kicked)

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-yellow-400">
            Players
          </p>
          <p className="mt-0.5 text-2xl font-black text-white">
            {activePlayers.length}
            <span className="text-white/30 text-lg font-normal ml-1">
              {activePlayers.length === 1 ? 'player' : 'players'} in game
            </span>
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-sm font-semibold text-white/40 hover:border-white/30 hover:text-white transition-all"
        >
          ✕ Close
        </button>
      </div>

      {loading ? (
        <p className="text-center animate-pulse text-white/30 py-8">Loading players...</p>
      ) : activePlayers.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-4xl mb-3">👻</p>
          <p className="text-white/30">No players yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {activePlayers.map((player) => {
            const isConfirming = confirmKickId === player.id
            const isKicking = kicking === player.id
            const displayName =
              player.role === 'team_leader' && player.team_name
                ? player.team_name
                : player.name

            return (
              <div
                key={player.id}
                className={`rounded-xl border px-4 py-3 transition-all ${
                  isConfirming
                    ? 'border-red-500/40 bg-red-500/10'
                    : 'border-white/10 bg-white/5'
                }`}
              >
                {isConfirming ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        Boot <span className="text-red-400">{displayName}</span>?
                      </p>
                      <p className="text-xs text-white/40 mt-0.5">
                        They'll see a "removed from game" screen.
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => setConfirmKickId(null)}
                        disabled={isKicking}
                        className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-bold text-white/50 hover:text-white transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleKick(player)}
                        disabled={isKicking}
                        className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-400 transition-all disabled:opacity-50"
                      >
                        {isKicking ? 'Booting...' : 'Boot'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <AvatarSprite id={player.avatar} size={40} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        {displayName}
                      </p>
                      <p className="text-xs text-white/40">
                        {ROLE_LABELS[player.role] ?? player.role}
                        {player.role === 'team_leader' && player.team_name
                          ? ` · led by ${player.name}`
                          : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {game.status !== 'waiting' && (
                        <span className="text-sm font-black text-white/60 tabular-nums">
                          {player.score} pts
                        </span>
                      )}
                      <button
                        onClick={() => setConfirmKickId(player.id)}
                        className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-bold text-white/20 hover:border-red-500/40 hover:text-red-400 transition-all"
                        title={`Boot ${displayName}`}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Kicked players — collapsed section */}
      {kickedPlayers.length > 0 && (
        <div className="rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/20">
            Booted ({kickedPlayers.length})
          </p>
          {kickedPlayers.map((p) => (
            <p key={p.id} className="text-sm text-white/20 line-through">
              {p.role === 'team_leader' && p.team_name ? p.team_name : p.name}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
