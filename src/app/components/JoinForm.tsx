'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Role = 'individual' | 'team_leader' | 'team_member' | 'crowd_voter'

const ROLES: { value: Role; label: string; description: string; icon: string }[] = [
  {
    value: 'individual',
    label: 'Individual Player',
    description: 'Flying solo — write and compete on your own',
    icon: '🎤',
  },
  {
    value: 'team_leader',
    label: 'Team Leader',
    description: 'Lead your crew and submit your team\'s one-liner',
    icon: '👑',
  },
  {
    value: 'team_member',
    label: 'Team Member',
    description: 'Join a team and help craft the perfect line',
    icon: '🤝',
  },
  {
    value: 'crowd_voter',
    label: 'Crowd Voter',
    description: 'Skip the spotlight — just vote for your favorites',
    icon: '🗳️',
  },
]

export default function JoinForm() {
  const router = useRouter()
  const [gameCode, setGameCode] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [role, setRole] = useState<Role | null>(null)
  const [teamName, setTeamName] = useState('')
  const [existingTeams, setExistingTeams] = useState<string[]>([])
  const [teamsLoading, setTeamsLoading] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [wasKicked, setWasKicked] = useState(false)
  const [avatar, setAvatar] = useState<string | null>(null)

  const AVATARS = [
    { id: 'avatar_01', label: 'Lucha' },
    { id: 'avatar_02', label: 'Kraken' },
    { id: 'avatar_03', label: 'Wrestler' },
    { id: 'avatar_04', label: 'Banana' },
  ]

  // Per-avatar frame 1 bounding box data, measured via Pillow
  // Sheet: 1536x1024, 4 frames horizontally (384px each)
  const AVATAR_DATA: Record<string, { charX: number; charY: number; charW: number; charH: number }> = {
    avatar_01: { charX: 95, charY: 319, charW: 249, charH: 385 }, // Lucha Wrestler
    avatar_02: { charX: 72, charY: 383, charW: 288, charH: 242 }, // Kraken
    avatar_03: { charX: 95, charY: 319, charW: 249, charH: 386 }, // X Wrestler
    avatar_04: { charX: 87, charY: 312, charW: 209, charH: 345 }, // Banana
  }

  function AvatarSprite({ id, size = 64 }: { id: string; size?: number }) {
    const data = AVATAR_DATA[id] ?? AVATAR_DATA.avatar_01
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
        backgroundImage: `url(/avatars/${id}.png)`,
        backgroundSize: `${scaledW}px ${scaledH}px`,
        backgroundPosition: `${offsetX}px ${offsetY}px`,
        backgroundRepeat: 'no-repeat',
        imageRendering: 'pixelated',
        overflow: 'hidden',
      }} />
    )
  }

  // Check for kicked redirect before attempting session resume
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('kicked') === '1') {
      setWasKicked(true)
      window.history.replaceState({}, '', '/')
    }
  }, [])

  // Resume session only if player record still exists in Supabase
  // Skip if they were just kicked
  useEffect(() => {
    if (wasKicked) return
    const savedGameId = localStorage.getItem('one_game_id')
    const savedPlayerId = localStorage.getItem('one_player_id')
    if (!savedGameId || !savedPlayerId) return

    async function verifySession() {
      const { data } = await supabase
        .from('players')
        .select('id')
        .eq('id', savedPlayerId)
        .maybeSingle()

      if (data) {
        router.replace(`/game/${savedGameId}?playerId=${savedPlayerId}`)
      } else {
        localStorage.removeItem('one_game_id')
        localStorage.removeItem('one_player_id')
      }
    }
    verifySession()
  }, [router, wasKicked])

  // When role is team_member and game code is entered, fetch existing teams
  useEffect(() => {
    if (role !== 'team_member' || gameCode.trim().length < 4) {
      setExistingTeams([])
      setTeamName('')
      return
    }
    async function fetchTeams() {
      setTeamsLoading(true)
      const { data: game } = await supabase
        .from('games')
        .select('id')
        .ilike('code', gameCode.trim())
        .single()
      if (!game) {
        setExistingTeams([])
        setTeamsLoading(false)
        return
      }
      const { data: leaders } = await supabase
        .from('players')
        .select('team_name')
        .eq('game_id', game.id)
        .eq('role', 'team_leader')
        .not('team_name', 'is', null)
      if (leaders) {
        setExistingTeams(leaders.map((l) => l.team_name).filter(Boolean) as string[])
      }
      setTeamsLoading(false)
    }
    fetchTeams()
  }, [role, gameCode])

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!gameCode.trim() || !playerName.trim() || !role) {
      setError('Please fill in all fields and select a role.')
      return
    }

    if (role === 'team_leader' && !teamName.trim()) {
      setError('Please enter a team name.')
      return
    }

    if (role === 'team_member' && !teamName.trim()) {
      setError('Please select a team to join.')
      return
    }

    setLoading(true)

    try {
      // Look up the game
      const { data: game, error: gameError } = await supabase
        .from('games')
        .select('id, status')
        .ilike('code', gameCode.trim())
        .single()

      if (gameError || !game) {
        setError('Game not found. Check your code and try again.')
        setLoading(false)
        return
      }

      if (game.status === 'ended') {
        setError('This game has already ended.')
        setLoading(false)
        return
      }

      // Always create a fresh player record
      const { data: player, error: playerError } = await supabase
        .from('players')
        .insert({
          game_id: game.id,
          name: playerName.trim(),
          role,
          team_name: (role === 'team_leader' || role === 'team_member') ? teamName.trim() : null,
          is_host: false,
          avatar: avatar ?? 'avatar_01',
        })
        .select('id')
        .single()

      if (playerError || !player) {
        setError('Could not join the game. Please try again.')
        setLoading(false)
        return
      }

      localStorage.setItem('one_game_id', game.id)
      localStorage.setItem('one_player_id', player.id)

      router.push(`/game/${game.id}?playerId=${player.id}`)
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleJoin} className="w-full max-w-md space-y-6">
      {/* Kicked banner */}
      {wasKicked && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-center">
          <p className="text-base font-bold text-white">You've been removed from the game.</p>
          <p className="text-sm text-white/50 mt-1">Contact the host if you think this was a mistake.</p>
        </div>
      )}

      {/* Game Code */}
      <div className="space-y-2">
        <label htmlFor="game-code" className="block text-sm font-semibold uppercase tracking-widest text-yellow-400">
          Game Code
        </label>
        <input
          id="game-code"
          type="text"
          value={gameCode}
          onChange={(e) => setGameCode(e.target.value.toUpperCase())}
          placeholder="e.g. ABCD"
          maxLength={8}
          autoComplete="off"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-2xl font-bold uppercase tracking-[0.3em] text-white placeholder:text-white/20 focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/30"
        />
      </div>

      {/* Player Name */}
      <div className="space-y-2">
        <label htmlFor="player-name" className="block text-sm font-semibold uppercase tracking-widest text-yellow-400">
          Your Name
        </label>
        <input
          id="player-name"
          type="text"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          placeholder="What should we call you?"
          maxLength={30}
          autoComplete="off"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-lg text-white placeholder:text-white/20 focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/30"
        />
      </div>

      {/* Role Selection */}
      <div className="space-y-3">
        <p className="block text-sm font-semibold uppercase tracking-widest text-yellow-400">
          Your Role
        </p>
        <div className="grid grid-cols-1 gap-3">
          {ROLES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => {
                setRole(r.value)
                setTeamName('')
                setExistingTeams([])
              }}
              className={`flex items-start gap-4 rounded-xl border px-4 py-3 text-left transition-all ${
                role === r.value
                  ? 'border-yellow-400 bg-yellow-400/10 ring-2 ring-yellow-400/30'
                  : 'border-white/10 bg-white/5 hover:border-white/30 hover:bg-white/10'
              }`}
            >
              <span className="text-2xl">{r.icon}</span>
              <div>
                <p className="font-semibold text-white">{r.label}</p>
                <p className="text-sm text-white/50">{r.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Team Leader — free text input */}
      {role === 'team_leader' && (
        <div className="space-y-2">
          <label className="block text-sm font-semibold uppercase tracking-widest text-yellow-400">
            Team Name
          </label>
          <input
            type="text"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="e.g. Team Chaos"
            maxLength={30}
            autoComplete="off"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-lg text-white placeholder:text-white/20 focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/30"
          />
        </div>
      )}

      {/* Team Member — buttons only, no free text */}
      {role === 'team_member' && (
        <div className="space-y-2">
          <label className="block text-sm font-semibold uppercase tracking-widest text-yellow-400">
            Your Team
          </label>
          {teamsLoading ? (
            <p className="text-sm text-white/40 animate-pulse">Looking for teams...</p>
          ) : existingTeams.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {existingTeams.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTeamName(t)}
                  className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-all ${
                    teamName === t
                      ? 'border-yellow-400 bg-yellow-400/10 text-yellow-400'
                      : 'border-white/10 bg-white/5 text-white/70 hover:border-white/30'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          ) : gameCode.trim().length >= 4 ? (
            <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/40">
              No teams found — ask your Team Leader to join first.
            </p>
          ) : (
            <p className="text-sm text-white/40">Enter your game code above to see available teams.</p>
          )}
        </div>
      )}

      {/* Avatar Picker */}
      <div className="space-y-3">
        <p className="block text-sm font-semibold uppercase tracking-widest text-yellow-400">
          Pick Your Character
        </p>
        <div className="grid grid-cols-3 gap-3">
          {AVATARS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setAvatar(a.id)}
              className={`flex flex-col items-center gap-2 rounded-xl border py-4 transition-all ${
                avatar === a.id
                  ? 'border-yellow-400 bg-yellow-400/10 ring-2 ring-yellow-400/30'
                  : 'border-white/10 bg-white/5 hover:border-white/30 hover:bg-white/10'
              }`}
            >
              <AvatarSprite id={a.id} size={72} />
              <p className="text-xs font-semibold text-white/60">{a.label}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400 border border-red-500/20">
          {error}
        </p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={loading || (role === 'team_member' && existingTeams.length === 0)}
        className="w-full rounded-xl bg-yellow-400 px-6 py-4 text-lg font-bold text-black transition-all hover:bg-yellow-300 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? 'Joining...' : 'Join Game →'}
      </button>
    </form>
  )
}
