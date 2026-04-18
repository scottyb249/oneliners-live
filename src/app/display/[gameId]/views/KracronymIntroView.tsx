'use client'

import type { Game } from '@/lib/types'

interface Props {
  game: Game
}

export default function KracronymIntroView({ game }: Props) {
  return (
    <div className="flex flex-1 relative bg-black overflow-hidden">
      <img
        src="/kracronym-rises.png"
        alt="The Krakronym Rises"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          objectPosition: 'center top',
        }}
      />
    </div>
  )
}
