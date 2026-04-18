'use client'

import type { Game } from '@/lib/types'

interface Props {
  game: Game
}

export default function KracronymIntroView({ game }: Props) {
  return (
    <div className="flex flex-1 relative overflow-hidden">
      {/* Full-bleed background image */}
      <img
        src="/kracronym-rises.png"
        alt="The Krakronym Rises"
        className="absolute inset-0 w-full h-full object-cover"
      />
    </div>
  )
}
