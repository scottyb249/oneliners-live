'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const HOST_PASSWORD = process.env.NEXT_PUBLIC_HOST_PASSWORD ?? ''
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const IN_PROGRESS_STATUSES = ['active', 'voting', 'results', 'break', 'picking', 'kracronym_intro']

function generateCode(): string {
  return Array.from({ length: 4 }, () =>
    LETTERS[Math.floor(Math.random() * LETTERS.length)]
  ).join('')
}

async function getUniqueCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateCode()
    const { data } = await supabase
      .from('games')
      .select('id')
      .eq('code', code)
      .maybeSingle()
    if (!data) return code
  }
  throw new Error('Could not generate a unique game code. Try again.')
}

type Step = 'password' | 'resume' | 'create'

interface ResumeGame {
  id: string
  code: string
  host_name: string
  status: string
  current_round: number
}

export default function HostLanding() {
  const router = useRouter()

  const [step, setStep] = useState<Step>('password')
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [hostName, setHostName] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')
  const [resumeGame, setResumeGame] = useState<ResumeGame | null>(null)

  // Game code rejoin
  const [showCodeInput, setShowCodeInput] = useState(false)
  const [gameCode, setGameCode] = useState('')
  const [codeError, setCodeError] = useState('')
  const [codeLoading, setCodeLoading] = useState(false)

  // On mount, check sessionStorage for a saved gameId
  useEffect(() => {
    const savedGameId = sessionStorage.getItem('host_game_id')
    if (savedGameId) {
      // Verify it's still in progress before auto-redirecting
      supabase
        .from('games')
        .select('id, status')
        .eq('id', savedGameId)
        .single()
        .then(({ data }) => {
          if (data && IN_PROGRESS_STATUSES.includes(data.status)) {
            router.replace(`/host/${savedGameId}`)
          } else {
            sessionStorage.removeItem('host_game_id')
          }
        })
    }
  }, [router])

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== HOST_PASSWORD) {
      setPasswordError('Incorrect password.')
      return
    }
    setPasswordError('')
    setChecking(true)

    // Check sessionStorage first
    const savedGameId = sessionStorage.getItem('host_game_id')
    if (savedGameId) {
      const { data } = await supabase
        .from('games')
        .select('id, code, host_name, status, current_round')
        .eq('id', savedGameId)
        .single()
      if (data && IN_PROGRESS_STATUSES.includes(data.status)) {
        setResumeGame(data as ResumeGame)
        setChecking(false)
        setStep('resume')
        return
      } else {
        sessionStorage.removeItem('host_game_id')
      }
    }

    setChecking(false)
    setStep('create')
  }

  async function handleResumeGame() {
    if (!resumeGame) return
    sessionStorage.setItem('host_game_id', resumeGame.id)
    router.push(`/host/${resumeGame.id}`)
  }

  async function handleRejoinByCode(e: React.FormEvent) {
    e.preventDefault()
    const code = gameCode.trim().toUpperCase()
    if (!code) return
    setCodeLoading(true)
    setCodeError('')

    const { data } = await supabase
      .from('games')
      .select('id, status')
      .eq('code', code)
      .maybeSingle()

    if (!data) {
      setCodeError('No game found with that code.')
      setCodeLoading(false)
      return
    }

    if (!IN_PROGRESS_STATUSES.includes(data.status)) {
      setCodeError('That game is not currently in progress.')
      setCodeLoading(false)
      return
    }

    sessionStorage.setItem('host_game_id', data.id)
    router.push(`/host/${data.id}`)
  }

  async function handleCreateGame(e: React.FormEvent) {
    e.preventDefault()
    if (!hostName.trim()) return

    setLoading(true)
    setError('')

    try {
      const code = await getUniqueCode()

      const { data, error: insertError } = await supabase
        .from('games')
        .insert({
          code,
          host_name: hostName.trim(),
          status: 'waiting',
          current_round: 0,
          current_acronym: null,
          round_started_at: null,
          is_final_round: false,
          tiebreaker_ran: false,
          used_acronyms: [],
        })
        .select('id')
        .single()

      if (insertError) throw insertError

      sessionStorage.setItem('host_game_id', data.id)
      router.push(`/host/${data.id}`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong.'
      setError(message)
      setLoading(false)
    }
  }

  const stepTitle = {
    password: 'Host Access',
    resume: 'Game In Progress',
    create: 'New Game',
  }[step]

  const stepSubtitle = {
    password: 'Enter your host password to continue',
    resume: 'You have an active game — would you like to resume?',
    create: 'Your name will be shown on the display screen',
  }[step]

  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-950 px-6">
      <div className="w-full max-w-sm flex flex-col items-center gap-8">

        {/* Logo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt="O.N.E. Liners Live"
          className="w-64 h-auto"
        />

        {/* Step label */}
        <div className="text-center">
          <h1 className="text-3xl font-black text-white">{stepTitle}</h1>
          <p className="mt-1 text-white/40 text-sm">{stepSubtitle}</p>
        </div>

        {/* Step 1: Password */}
        {step === 'password' && (
          <form onSubmit={handlePasswordSubmit} className="w-full flex flex-col gap-4">
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Host password"
              autoFocus
              className="w-full rounded-xl border border-white/20 bg-white/10 px-5 py-4 text-lg text-white placeholder:text-white/30 focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/30"
            />
            {passwordError && (
              <p className="text-sm text-red-400 text-center">{passwordError}</p>
            )}
            <button
              type="submit"
              disabled={checking}
              className="w-full rounded-xl bg-yellow-400 py-4 text-lg font-bold text-black transition-all hover:bg-yellow-300 active:scale-95 disabled:opacity-50"
            >
              {checking ? 'Checking...' : 'Continue →'}
            </button>

            {/* Game code rejoin */}
            <div className="pt-2 border-t border-white/10">
              {!showCodeInput ? (
                <button
                  type="button"
                  onClick={() => setShowCodeInput(true)}
                  className="w-full text-sm text-white/30 hover:text-white/60 transition-colors py-2"
                >
                  Rejoin by game code
                </button>
              ) : (
                <form onSubmit={handleRejoinByCode} className="flex flex-col gap-3 pt-2">
                  <p className="text-xs text-white/40 text-center">
                    Enter your 4-letter game code from the display screen
                  </p>
                  <input
                    type="text"
                    value={gameCode}
                    onChange={e => setGameCode(e.target.value.toUpperCase())}
                    placeholder="GAME CODE"
                    maxLength={4}
                    autoFocus
                    className="w-full rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-center text-2xl font-black tracking-[0.5em] text-yellow-400 placeholder:text-white/20 placeholder:tracking-normal focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/30 uppercase"
                  />
                  {codeError && (
                    <p className="text-sm text-red-400 text-center">{codeError}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setShowCodeInput(false); setGameCode(''); setCodeError('') }}
                      className="flex-1 rounded-xl border border-white/10 py-3 text-sm font-semibold text-white/40 hover:text-white/60 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={codeLoading || gameCode.length < 4}
                      className="flex-1 rounded-xl bg-yellow-400 py-3 text-sm font-bold text-black transition-all hover:bg-yellow-300 active:scale-95 disabled:opacity-50"
                    >
                      {codeLoading ? 'Finding...' : 'Rejoin →'}
                    </button>
                  </div>
                  <p className="text-xs text-white/20 text-center">
                    💡 Tip: Write down your game code at the start of each event — it&apos;s always visible on the display screen.
                  </p>
                </form>
              )}
            </div>
          </form>
        )}

        {/* Step 2: Resume in-progress game */}
        {step === 'resume' && resumeGame && (
          <div className="w-full flex flex-col gap-4">
            <div className="rounded-2xl border border-yellow-400/30 bg-yellow-400/10 px-6 py-5 text-center space-y-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-yellow-400">Active Game</p>
              <p className="text-4xl font-black text-white tracking-widest">{resumeGame.code}</p>
              <p className="text-sm text-white/50">
                Hosted by {resumeGame.host_name} · Round {resumeGame.current_round}
              </p>
              <p className="text-xs text-white/30 capitalize">Status: {resumeGame.status}</p>
            </div>

            <button
              onClick={handleResumeGame}
              className="w-full rounded-xl bg-yellow-400 py-4 text-lg font-bold text-black transition-all hover:bg-yellow-300 active:scale-95"
            >
              Resume Game →
            </button>

            <button
              onClick={() => { setResumeGame(null); sessionStorage.removeItem('host_game_id'); setStep('create') }}
              className="w-full rounded-xl border border-white/10 py-3 text-sm font-semibold text-white/40 hover:text-white/60 transition-colors"
            >
              Start New Game Instead
            </button>
          </div>
        )}

        {/* Step 3: Create game */}
        {step === 'create' && (
          <div className="w-full flex flex-col gap-4">
            <form onSubmit={handleCreateGame} className="flex flex-col gap-4">
              <input
                type="text"
                value={hostName}
                onChange={e => setHostName(e.target.value)}
                placeholder="Your name"
                maxLength={30}
                autoFocus
                className="w-full rounded-xl border border-white/20 bg-white/10 px-5 py-4 text-lg text-white placeholder:text-white/30 focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/30"
              />
              {error && (
                <p className="text-sm text-red-400 text-center">{error}</p>
              )}
              <button
                type="submit"
                disabled={loading || !hostName.trim()}
                className="w-full rounded-xl bg-yellow-400 py-4 text-lg font-bold text-black transition-all hover:bg-yellow-300 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? 'Creating game...' : 'Create Game →'}
              </button>
            </form>
          </div>
        )}

      </div>
    </main>
  )
}
