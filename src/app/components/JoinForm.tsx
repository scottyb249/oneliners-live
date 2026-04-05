'use client'

import { useState } from 'react'
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
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!gameCode.trim() || !playerName.trim() || !role) {
      setError('Please fill in all fields and select a role.')
      return
    }

    setLoading(true)

    try {
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

      const { data: player, error: playerError } = await supabase
        .from('players')
        .insert({
          game_id: game.id,
          name: playerName.trim(),
          role,
          is_host: false,
        })
        .select('id')
        .single()

      if (playerError || !player) {
        setError('Could not join the game. Please try again.')
        setLoading(false)
        return
      }

      router.push(`/game/${game.id}?playerId=${player.id}`)
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleJoin} className="w-full max-w-md space-y-6">
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
          placeholder="e.g. ABC123"
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
              onClick={() => setRole(r.value)}
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

      {/* Error */}
      {error && (
        <p className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400 border border-red-500/20">
          {error}
        </p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-yellow-400 px-6 py-4 text-lg font-bold text-black transition-all hover:bg-yellow-300 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? 'Joining...' : 'Join Game →'}
      </button>
    </form>
  )
}
