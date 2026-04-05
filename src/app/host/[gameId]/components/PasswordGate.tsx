'use client'

import { useState } from 'react'

const HOST_PASSWORD = 'onel1ners'

interface Props {
  onAuthenticated: () => void
}

export default function PasswordGate({ onAuthenticated }: Props) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password === HOST_PASSWORD) {
      onAuthenticated()
    } else {
      setError(true)
      setPassword('')
    }
  }

  return (
    <main className="flex min-h-full flex-col items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-xs space-y-6 text-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-yellow-400">
            O.N.E. Liners Live
          </p>
          <h1 className="mt-2 text-2xl font-black text-white">Host Access</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(false) }}
            placeholder="Enter host password"
            autoFocus
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-white placeholder:text-white/20 focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/30"
          />
          {error && (
            <p className="text-sm text-red-400">Incorrect password.</p>
          )}
          <button
            type="submit"
            className="w-full rounded-xl bg-yellow-400 py-3 font-bold text-black hover:bg-yellow-300 active:scale-95 transition-all"
          >
            Enter
          </button>
        </form>
      </div>
    </main>
  )
}
