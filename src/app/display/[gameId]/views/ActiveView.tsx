import type { Game } from '@/lib/types'
import BigCountdown from '../components/BigCountdown'

interface Props {
  game: Game
  answerCount: number
}

export default function ActiveView({ game, answerCount }: Props) {
  const acronym = game.current_acronym ?? '—'
  const letters = acronym.replace(/[^A-Z]/gi, '').split('')
  const letterCount = letters.length
  const isFinal = game.is_final_round

  const timerSeconds = game.round_duration ?? (isFinal ? 180 : 90)

  // ── FINAL ROUND: ship/tentacle background with letter tiles ───────────────
  if (isFinal) {
    return (
      <div className="flex flex-1 relative overflow-hidden">
        {/* Ship + tentacles background */}
        <img
          src="/kracronym-tiles.png"
          alt="Krakronym"
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Gradient overlay — readable top and bottom */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 30%, transparent 55%, rgba(0,0,0,0.75) 100%)',
          }}
        />

        {/* Top: round label */}
        <div className="absolute top-0 left-0 right-0 px-10 pt-6">
          <p
            className="font-black uppercase tracking-[0.3em] text-yellow-400"
            style={{ fontSize: 'clamp(0.75rem, 1.8vw, 1.25rem)', textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}
          >
            ⚡ The Final Round · KRACRONYM · Double Points!
          </p>
        </div>

        {/* Center: letter tiles in the blank-tile zone of the image */}
        <div
          className="absolute left-0 right-0 flex items-center justify-center gap-3 flex-wrap px-8"
          style={{ top: '50%', transform: 'translateY(-50%)' }}
        >
          {letters.map((letter, i) => (
            <div
              key={i}
              style={{
                width: 'clamp(90px, 12vw, 160px)',
                height: 'clamp(90px, 12vw, 160px)',
                background: 'linear-gradient(145deg, #f5e6c8 0%, #e8d5a0 50%, #d4b96a 100%)',
                border: '3px solid #8b6914',
                borderRadius: '6px',
                boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.6), 0 6px 20px rgba(0,0,0,0.7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                animation: `tileReveal 0.5s cubic-bezier(0.175,0.885,0.32,1.275) ${i * 0.12}s both`,
              }}
            >
              <span
                style={{
                  fontSize: 'clamp(3rem, 7.5vw, 7rem)',
                  fontWeight: 900,
                  color: '#1a0a00',
                  fontFamily: 'Georgia, serif',
                  lineHeight: 1,
                }}
              >
                {letter}
              </span>
            </div>
          ))}
        </div>

        {/* Bottom: answer count + timer */}
        <div className="absolute bottom-4 left-10 right-10 flex items-center justify-between">
          <p
            className="font-bold text-white"
            style={{ fontSize: 'clamp(1rem, 2vw, 1.5rem)', textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}
          >
            {answerCount} {answerCount === 1 ? 'answer' : 'answers'} submitted
          </p>
          <div className="w-48">
            <BigCountdown
              key={`active-${game.current_round}`}
              totalSeconds={timerSeconds}
              startedAt={game.round_started_at}
              compact
            />
          </div>
        </div>

        <style>{`
          @keyframes tileReveal {
            from { opacity: 0; transform: translateY(-40px) scale(0.6) rotate(-5deg); }
            to   { opacity: 1; transform: translateY(0)    scale(1)   rotate(0deg); }
          }
        `}</style>
      </div>
    )
  }

  // ── REGULAR ROUND ─────────────────────────────────────────────────────────
  const acronymFontSize =
    letterCount <= 3 ? 'clamp(8rem, 28vw, 22rem)' :
    letterCount === 4 ? 'clamp(6rem, 22vw, 18rem)' :
    letterCount === 5 ? 'clamp(5rem, 18vw, 14rem)' :
    'clamp(3.5rem, 13vw, 11rem)'

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center gap-8 px-12">
      <p
        className="font-semibold uppercase tracking-[0.4em] text-yellow-400"
        style={{ fontSize: 'clamp(1rem, 2vw, 1.75rem)' }}
      >
        Round {game.current_round}{game.is_final_round ? ' · KRACRONYM' : ''}
      </p>

      <p
        className="font-black tracking-[0.4em] text-white leading-none text-center break-all"
        style={{ fontSize: acronymFontSize }}
      >
        {acronym}
      </p>

      <p
        className="font-bold text-white/70"
        style={{ fontSize: 'clamp(1.5rem, 3vw, 2.5rem)' }}
      >
        {answerCount} {answerCount === 1 ? 'answer' : 'answers'} submitted
      </p>

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
