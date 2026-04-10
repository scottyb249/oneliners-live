'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const HOST_PASSWORD = process.env.NEXT_PUBLIC_HOST_PASSWORD ?? ''
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'

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

type Step = 'password' | 'create'

export default function HostLanding() {
  const router = useRouter()

  const [step, setStep] = useState<Step>('password')
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [hostName, setHostName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password === HOST_PASSWORD) {
      setPasswordError('')
      setStep('create')
    } else {
      setPasswordError('Incorrect password.')
    }
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

      router.push(`/host/${data.id}`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong.'
      setError(message)
      setLoading(false)
    }
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

        {/* Step label */}
        <div className="text-center">
          <h1 className="text-3xl font-black text-white">
            {step === 'password' ? 'Host Access' : 'New Game'}
          </h1>
          <p className="mt-1 text-white/40 text-sm">
            {step === 'password' ? 'Enter your host password to continue' : 'Enter your name to create a game'}
          </p>
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
              className="w-full rounded-xl bg-yellow-400 py-4 text-lg font-bold text-black transition-all hover:bg-yellow-300 active:scale-95"
            >
              Continue →
            </button>
          </form>
        )}

        {/* Step 2: Create game */}
        {step === 'create' && (
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
              {loading ? 'Creating game...' : 'Create Game →'}
            </button>
          </form>
        )}

      </div>
    </main>
  )
}
