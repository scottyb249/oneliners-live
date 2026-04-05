import DisplayClient from './DisplayClient'

export default async function DisplayPage({
  params,
}: {
  params: Promise<{ gameId: string }>
}) {
  const { gameId } = await params
  return <DisplayClient gameId={gameId} />
}
