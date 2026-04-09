import type { Game, Player } from '../types'

const ROLE_LABELS: Record<string, string> = {
  individual: 'Individual Player',
  team_leader: 'Team Leader',
  team_member: 'Team Member',
  crowd_voter: 'Crowd Voter',
}

const ROLE_ICONS: Record<string, string> = {
  individual: '🎤',
  team_leader: '👑',
  team_member: '🤝',
  crowd_voter: '🗳️',
}

interface Props {
  game: Game
  player: Player
  playerCount: number
}

export default function WaitingPhase({ game, player, playerCount }: Props) {
  return (
    <div className="flex w-full flex-col items-center gap-8 text-center">
      {/* Game code */}
      <div>
        <p className="text-sm font-semibold uppercase tracking-widest text-yellow-400">Game Code</p>
        <p className="mt-1 text-5xl font-black tracking-[0.25em] text-white">{game.code}</p>
      </div>

      {/* Player card */}
      <div className="w-full rounded-2xl border border-white/10 bg-white/5 px-6 py-5 space-y-1">
        <p className="text-2xl font-bold text-white">{player.name}</p>
        <p className="text-white/50">
          {ROLE_ICONS[player.role]} {ROLE_LABELS[player.role]}
          {player.team_name ? ` · ${player.team_name}` : ''}
        </p>
      </div>

      {/* Live player count */}
      <div className="flex items-center gap-2 text-white/40">
        <span className="inline-block h-2 w-2 rounded-full bg-green-400 animate-pulse" />
        <span>
          {playerCount} {playerCount === 1 ? 'player' : 'players'} joined
        </span>
      </div>

      {/* Status */}
      <div className="space-y-1">
        <p className="text-lg font-semibold text-white">Waiting for host to start...</p>
        <p className="text-sm text-white/30">Sit tight. The fun is about to begin.</p>
      </div>
    </div>
  )
}
