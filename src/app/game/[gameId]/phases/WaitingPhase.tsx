'use client'

import { useState, useEffect } from 'react'
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

const HOW_TO_PLAY = [
  { icon: '📝', text: 'An acronym appears on screen — write the funniest phrase using those letters before time runs out.' },
  { icon: '✅', text: 'Submit your answer on your phone. The host approves the top 10.' },
  { icon: '⚡', text: 'Fastest answer bonus! First approved answer each round earns +1 bonus point — be quick!' },
  { icon: '🗳️', text: 'Everyone votes for their favourite one-liner. You cannot vote for your own.' },
  { icon: '🏆', text: 'Each vote = 1 point. The final KRACRONYM round is worth Double Points!' },
  { icon: '🎁', text: 'Prizes for 1st, 2nd, and 3rd place at the end!' },
]

const RULES = [
  'Host will narrow down answers to 10 if there are more than 10 players.',
  'Do not use outside app help.',
  'Submit fast — the first approved answer each round earns a +1 bonus point!',
  'Similar or identical answers? First one in wins. Be unique.',
  'The host sets the appropriateness level: G · PG · PG-13 · R · XXX.',
  'Do not use your answer to harass a real person.',
  'Keep highly inflammatory political or religious content out of it.',
  'Players and Teams cannot vote for their own response.',
  'Judges can come and go whenever they want.',
]

const PLEDGE = [
  'I will not get mad at the host for not choosing my answer.',
  'I will not personally harass or single out anyone in this room.',
  'I will do my best to not get offended and ruin a good time.',
  'The host is the moderator, tiebreaker, and judge of what\'s appropriate.',
]

const SLIDES = ['how-to-play', 'rules', 'pledge'] as const
type Slide = typeof SLIDES[number]

const SLIDE_LABELS: Record<Slide, string> = {
  'how-to-play': 'How to Play',
  'rules': 'The Rules',
  'pledge': 'The Pledge',
}

export default function WaitingPhase({ game, player, playerCount }: Props) {
  const [currentSlide, setCurrentSlide] = useState<Slide>('how-to-play')
  const [slideIndex, setSlideIndex] = useState(0)

  // Auto-cycle slides every 15 seconds
  useEffect(() => {
    const id = setInterval(() => {
      setSlideIndex((prev) => {
        const next = (prev + 1) % SLIDES.length
        setCurrentSlide(SLIDES[next])
        return next
      })
    }, 15000)
    return () => clearInterval(id)
  }, [])

  function goToSlide(i: number) {
    setSlideIndex(i)
    setCurrentSlide(SLIDES[i])
  }

  return (
    <div className="flex w-full flex-col gap-5">
      {/* Player card — always visible at top */}
      <div className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 flex items-center justify-between">
        <div>
          <p className="text-lg font-bold text-white">{player.name}</p>
          <p className="text-sm text-white/50">
            {ROLE_ICONS[player.role]} {ROLE_LABELS[player.role]}
            {player.team_name ? ` · ${player.team_name}` : ''}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-white/30 uppercase tracking-widest">Game</p>
          <p className="text-xl font-black tracking-[0.2em] text-yellow-400">{game.code}</p>
        </div>
      </div>

      {/* Waiting status */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-white/40 text-sm">
          <span className="inline-block h-2 w-2 rounded-full bg-green-400 animate-pulse" />
          <span>{playerCount} {playerCount === 1 ? 'player' : 'players'} joined</span>
        </div>
        <p className="text-sm text-white/30">Waiting for host...</p>
      </div>

      {/* Slide nav dots */}
      <div className="flex items-center justify-center gap-3">
        {SLIDES.map((slide, i) => (
          <button
            key={slide}
            onClick={() => goToSlide(i)}
            className="flex items-center gap-1.5"
          >
            <span className={`block rounded-full transition-all ${
              i === slideIndex ? 'w-6 h-2 bg-yellow-400' : 'w-2 h-2 bg-white/20'
            }`} />
          </button>
        ))}
      </div>

      {/* Slide label */}
      <p className="text-center text-xs font-semibold uppercase tracking-widest text-yellow-400">
        {SLIDE_LABELS[currentSlide]}
      </p>

      {/* Slide content */}
      {currentSlide === 'how-to-play' && (
        <div className="flex flex-col gap-3">
          {HOW_TO_PLAY.map((step, i) => (
            <div key={i} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <span className="text-xl shrink-0">{step.icon}</span>
              <p className="text-sm text-white font-medium leading-snug">{step.text}</p>
            </div>
          ))}
        </div>
      )}

      {currentSlide === 'rules' && (
        <div className="flex flex-col gap-2">
          {RULES.map((rule, i) => (
            <div key={i} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <span className="text-sm font-black text-yellow-400 shrink-0 tabular-nums">{i + 1}.</span>
              <p className="text-sm text-white font-medium leading-snug">{rule}</p>
            </div>
          ))}
        </div>
      )}

      {currentSlide === 'pledge' && (
        <div className="flex flex-col gap-3">
          <p className="text-center text-sm text-white/40">✋ Raise your right hand and repeat after the host:</p>
          {PLEDGE.map((line, i) => (
            <div key={i} className="rounded-xl border border-yellow-400/20 bg-yellow-400/5 px-4 py-3">
              <p className="text-sm text-white font-medium leading-snug">&ldquo;{line}&rdquo;</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
