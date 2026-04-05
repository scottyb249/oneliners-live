'use client'

import { useState, useEffect, useRef } from 'react'

interface Props {
  totalSeconds: number
  startedAt?: string | null   // ISO timestamp — calculates real elapsed time if provided
  onExpire?: () => void
}

export default function BigCountdown({ totalSeconds, startedAt, onExpire }: Props) {
  function calcRemaining() {
    if (startedAt) {
      const elapsed = (Date.now() - new Date(startedAt).getTime()) / 1000
      return Math.max(0, Math.round(totalSeconds - elapsed))
    }
    return totalSeconds
  }

  const [timeLeft, setTimeLeft] = useState(calcRemaining)
  const onExpireRef = useRef(onExpire)
  onExpireRef.current = onExpire

  useEffect(() => {
    setTimeLeft(calcRemaining())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startedAt, totalSeconds])

  useEffect(() => {
    if (timeLeft <= 0) {
      onExpireRef.current?.()
      return
    }
    const id = setTimeout(() => setTimeLeft((t) => t - 1), 1000)
    return () => clearTimeout(id)
  }, [timeLeft])

  const pct = Math.max(0, (timeLeft / totalSeconds) * 100)
  const urgent = timeLeft <= 10 && timeLeft > 0

  return (
    <div className="w-full space-y-4">
      <div
        className={`text-center tabular-nums font-black leading-none transition-colors ${
          urgent ? 'text-red-400 animate-pulse' : 'text-white'
        }`}
        style={{ fontSize: 'clamp(5rem, 18vw, 14rem)' }}
      >
        {timeLeft}
      </div>
      <div className="h-4 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${
            urgent ? 'bg-red-500' : 'bg-yellow-400'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
