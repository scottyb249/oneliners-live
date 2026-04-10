import type { Game } from '@/lib/types'
import BigCountdown from '../components/BigCountdown'

interface Props {
  game: Game
  answerCount: number
}

export default function ActiveView({ game, answerCount }: Props) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-12">
      {/* Round label */}
      <p
        className="font-semibold uppercase tracking-[0.4em] text-yellow-400"
        style={{ fontSize: 'clamp(0.875rem, 1.8vw, 1.5rem)' }}
      >
        Round {game.current_round}{game.is_final_round ? ' · KRACRONYM' : ''}
      </p>

      {/* Acronym — the centrepiece */}
      <p
        className="font-black tracking-[0.4em] text-white leading-none text-center"
        style={{ fontSize: 'clamp(5rem, 22vw, 18rem)' }}
      >
        {game.current_acronym ?? '—'}
      </p>

      {/* Answer count */}
      <p
        className="font-bold text-white"
        style={{ fontSize: 'clamp(1.25rem, 2.5vw, 2rem)' }}
      >
        {answerCount} {answerCount === 1 ? 'answer' : 'answers'} submitted
      </p>

      {/* Timer — smaller, below answer count */}
      <div className="w-full max-w-xl">
        <BigCountdown
          key={`active-${game.current_round}`}
          totalSeconds={60}
          startedAt={game.round_started_at}
        />
      </div>
    </div>
  )
}
