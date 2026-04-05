'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const HOST_PASSWORD = 'onel1ners'
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ' // no I or O to avoid confusion

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
    round: 1,
    current_acronym: null,
    round_started_at: null,
    is_final_round: false,
    is_tiebreaker_ran: false,
    letter_pattern: [3, 4, 4, 5, 5],
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
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      backgroundColor: 'var(--color-background-tertiary)',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '400px',
        background: 'var(--color-background-primary)',
        border: '0.5px solid var(--color-border-tertiary)',
        borderRadius: '16px',
        padding: '2rem',
      }}>

        {/* Logo / title */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{
            fontSize: '26px',
            fontWeight: '500',
            color: 'var(--color-text-primary)',
            margin: '0 0 6px',
          }}>
            O.N.E. Liners Live
          </h1>
          <p style={{
            fontSize: '14px',
            color: 'var(--color-text-secondary)',
            margin: 0,
          }}>
            {step === 'password' ? 'Host access' : 'Create a new game'}
          </p>
        </div>

        {/* Step 1: Password */}
        {step === 'password' && (
          <form onSubmit={handlePasswordSubmit}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              color: 'var(--color-text-secondary)',
              marginBottom: '6px',
            }}>
              Host password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter password"
              autoFocus
              style={{ width: '100%', marginBottom: '8px', boxSizing: 'border-box' }}
            />
            {passwordError && (
              <p style={{
                fontSize: '13px',
                color: 'var(--color-text-danger)',
                margin: '0 0 12px',
              }}>
                {passwordError}
              </p>
            )}
            <button
              type="submit"
              style={{
                width: '100%',
                padding: '10px',
                marginTop: '4px',
                fontSize: '15px',
                cursor: 'pointer',
              }}
            >
              Continue
            </button>
          </form>
        )}

        {/* Step 2: Create game */}
        {step === 'create' && (
          <form onSubmit={handleCreateGame}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              color: 'var(--color-text-secondary)',
              marginBottom: '6px',
            }}>
              Your name (shown to players)
            </label>
            <input
              type="text"
              value={hostName}
              onChange={e => setHostName(e.target.value)}
              placeholder="e.g. Scott"
              maxLength={30}
              autoFocus
              style={{ width: '100%', marginBottom: '8px', boxSizing: 'border-box' }}
            />
            {error && (
              <p style={{
                fontSize: '13px',
                color: 'var(--color-text-danger)',
                margin: '0 0 12px',
              }}>
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading || !hostName.trim()}
              style={{
                width: '100%',
                padding: '10px',
                marginTop: '4px',
                fontSize: '15px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading || !hostName.trim() ? 0.5 : 1,
              }}
            >
              {loading ? 'Creating game...' : 'Create game'}
            </button>
          </form>
        )}

      </div>
    </main>
  )
}
