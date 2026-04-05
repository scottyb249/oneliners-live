'use client'

import { useState, useEffect, useRef } from 'react'

interface Props {
  seconds: number
  onExpire?: () => void
}

export default function CountdownTimer({ seconds, onExpire }: Props) {
  const [timeLeft, setTimeLeft] = useState(seconds)
  const onExpireRef = useRef(onExpire)
  onExpireRef.current = onExpire

  // Reset if duration prop changes
  useEffect(() => {
    setTimeLeft(seconds)
  }, [seconds])

  useEffect(() => {
    if (timeLeft <= 0) {
      onExpireRef.current?.()
      return
    }
    const id = setTimeout(() => setTimeLeft((t) => t - 1), 1000)
    return () => clearTimeout(id)
  }, [timeLeft])

  const pct = Math.max(0, (timeLeft / seconds) * 100)
  const urgent = timeLeft <= 10 && timeLeft > 0

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between">
        <span className={`text-sm font-semibold ${urgent ? 'animate-pulse text-red-400' : 'text-white/40'}`}>
          Time left
        </span>
        <span className={`tabular-nums text-xl font-black ${urgent ? 'text-red-400' : 'text-white'}`}>
          {timeLeft}s
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${urgent ? 'bg-red-500' : 'bg-yellow-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
