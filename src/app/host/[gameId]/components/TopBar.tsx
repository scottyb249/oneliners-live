import type { Game } from '@/lib/types'

const STATUS_LABELS: Record<string, string> = {
  waiting: 'Lobby',
  active: 'Submissions Open',
  voting: 'Voting',
  results: 'Results',
  tiebreaker: 'Tiebreaker',
  ended: 'Game Over',
}

const STATUS_COLORS: Record<string, string> = {
  waiting: 'bg-zinc-700 text-white/60',
  active: 'bg-green-500/20 text-green-400',
  voting: 'bg-blue-500/20 text-blue-400',
  results: 'bg-yellow-500/20 text-yellow-400',
  tiebreaker: 'bg-red-500/20 text-red-400',
  ended: 'bg-zinc-700 text-white/60',
}

interface Props {
  game: Game
}

export default function TopBar({ game }: Props) {
  return (
    <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-zinc-950/90 px-4 py-3 backdrop-blur">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-yellow-400">
          Host · {game.code}
        </p>
        {game.current_round > 0 && (
          <p className="text-xs text-white/30">
            Round {game.current_round}{game.is_final_round ? ' · KRACRONYM' : ''}
          </p>
        )}
      </div>
      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLORS[game.status] ?? 'bg-zinc-700 text-white/60'}`}>
        {STATUS_LABELS[game.status] ?? game.status}
      </span>
    </div>
  )
}
