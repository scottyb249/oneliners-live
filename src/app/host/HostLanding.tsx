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

type Step = 'password' | 'name' | 'rejoin'

export default function HostLanding() {
  const router = useRouter()

  const [step, setStep] = useState<Step>('password')
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [hostName, setHostName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Rejoin state
  const [gameCode, setGameCode] = useState('')
  const [codeError, setCodeError] = useState('')
  const [codeLoading, setCodeLoading] = useState(false)

  // On mount, check sessionStorage for a saved gameId and auto-resume silently
  useEffect(() => {
    const savedGameId = sessionStorage.getItem('host_game_id')
    if (savedGameId) {
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

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== HOST_PASSWORD) {
      setPasswordError('Incorrect password.')
      return
    }
    setPasswordError('')
    setStep('name')
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

  async function handleRejoin(e: React.FormEvent) {
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

        {/* Step: Password */}
        {step === 'password' && (
          <>
            <div className="text-center">
              <h1 className="text-3xl font-black text-white">Host Access</h1>
              <p className="mt-1 text-white/40 text-sm">Enter your host password to continue</p>
            </div>
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
                className="w-full rounded-xl bg-yellow-400 py-4 text-lg font-bold text-black transition-all hover:bg-yellow-300 active:scale-95"
              >
                Continue →
              </button>
            </form>
          </>
        )}

        {/* Step: Name → New Game or Rejoin */}
        {step === 'name' && (
          <>
            <div className="text-center">
              <h1 className="text-3xl font-black text-white">New Game</h1>
              <p className="mt-1 text-white/40 text-sm">Your name will be shown on the display screen</p>
            </div>
            <form onSubmit={handleCreateGame} className="w-full flex flex-col gap-4">
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
                {loading ? 'Creating game...' : 'Start New Game →'}
              </button>
            </form>

            <div className="w-full flex flex-col items-center gap-3">
              <div className="flex items-center gap-3 w-full">
                <div className="flex-1 h-px bg-white/10" />
                <p className="text-xs text-white/30 uppercase tracking-widest">or</p>
                <div className="flex-1 h-px bg-white/10" />
              </div>
              <button
                onClick={() => { setStep('rejoin'); setCodeError('') }}
                className="w-full rounded-xl border border-white/10 py-4 text-base font-semibold text-white/50 hover:border-yellow-400/40 hover:text-yellow-400 transition-all"
              >
                Rejoin Existing Game
              </button>
              <p className="text-xs text-white/20 text-center">
                💡 Tip: Write down your game code at the start of each event — it&apos;s always visible on the display screen.
              </p>
            </div>
          </>
        )}

        {/* Step: Rejoin by code */}
        {step === 'rejoin' && (
          <>
            <div className="text-center">
              <h1 className="text-3xl font-black text-white">Rejoin Game</h1>
              <p className="mt-1 text-white/40 text-sm">Enter the 4-letter code from your display screen</p>
            </div>
            <form onSubmit={handleRejoin} className="w-full flex flex-col gap-4">
              <input
                type="text"
                value={gameCode}
                onChange={e => setGameCode(e.target.value.toUpperCase())}
                placeholder="GAME CODE"
                maxLength={4}
                autoFocus
                className="w-full rounded-xl border border-white/20 bg-white/10 px-5 py-4 text-center text-3xl font-black tracking-[0.5em] text-yellow-400 placeholder:text-white/20 placeholder:tracking-normal focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/30 uppercase"
              />
              {codeError && (
                <p className="text-sm text-red-400 text-center">{codeError}</p>
              )}
              <button
                type="submit"
                disabled={codeLoading || gameCode.length < 4}
                className="w-full rounded-xl bg-yellow-400 py-4 text-lg font-bold text-black transition-all hover:bg-yellow-300 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {codeLoading ? 'Finding game...' : 'Rejoin →'}
              </button>
              <button
                type="button"
                onClick={() => setStep('name')}
                className="w-full rounded-xl border border-white/10 py-3 text-sm font-semibold text-white/40 hover:text-white/60 transition-colors"
              >
                ← Back
              </button>
            </form>
          </>
        )}

      </div>
    </main>
  )
}
