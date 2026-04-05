import GameClient from './GameClient'

export default async function GamePage({
  params,
  searchParams,
}: {
  params: Promise<{ gameId: string }>
  searchParams: Promise<{ playerId?: string }>
}) {
  const { gameId } = await params
  const { playerId = '' } = await searchParams

  return <GameClient gameId={gameId} playerId={playerId} />
}
