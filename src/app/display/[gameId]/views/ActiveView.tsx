import type { Game } from '@/lib/types'
import BigCountdown from '../components/BigCountdown'

interface Props {
  game: Game
  answerCount: number
}

export default function ActiveView({ game, answerCount }: Props) {
  const acronym = game.current_acronym ?? '—'
  const letterCount = acronym.replace(/[^A-Z]/gi, '').length

  const acronymFontSize =
    letterCount <= 3 ? 'clamp(5rem, 22vw, 18rem)' :
    letterCount === 4 ? 'clamp(4rem, 18vw, 15rem)' :
    letterCount === 5 ? 'clamp(3rem, 14vw, 12rem)' :
    'clamp(2.5rem, 10vw, 9rem)'

  const timerSeconds = (game as any).round_duration ?? (game.is_final_round ? 180 : 90)

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center gap-6 px-12">
      {/* Round label */}
      <p
        className="font-semibold uppercase tracking-[0.4em] text-yellow-400"
        style={{ fontSize: 'clamp(0.875rem, 1.8vw, 1.5rem)' }}
      >
        Round {game.current_round}{game.is_final_round ? ' · KRACRONYM' : ''}
      </p>

      {/* Acronym */}
      <p
        className="font-black tracking-[0.4em] text-white leading-none text-center break-all"
        style={{ fontSize: acronymFontSize }}
      >
        {acronym}
      </p>

      {/* Answer count */}
      <p
        className="font-bold text-white"
        style={{ fontSize: 'clamp(1.25rem, 2.5vw, 2rem)' }}
      >
        {answerCount} {answerCount === 1 ? 'answer' : 'answers'} submitted
      </p>

      {/* Timer — pinned bottom-right corner */}
      <div className="absolute bottom-4 right-10 w-48">
        <BigCountdown
          key={`active-${game.current_round}`}
          totalSeconds={timerSeconds}
          startedAt={game.round_started_at}
          compact
        />
      </div>
    </div>
  )
}
