import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role key so RLS doesn't block deletes
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const STALE_HOURS = 12

export async function GET(request: Request) {
  // Verify this is coming from Vercel Cron (or a manual call with the secret)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cutoff = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000).toISOString()

  // Find stale game IDs first
  const { data: staleGames, error: fetchError } = await supabase
    .from('games')
    .select('id')
    .lt('created_at', cutoff)

  if (fetchError) {
    console.error('Cron: failed to fetch stale games', fetchError)
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  if (!staleGames || staleGames.length === 0) {
    return NextResponse.json({ deleted: 0, message: 'No stale games found' })
  }

  const staleIds = staleGames.map((g) => g.id)

  // Delete related data first (FK constraints)
  await supabase.from('answers').delete().in('game_id', staleIds)
  await supabase.from('votes').delete().in('game_id', staleIds)
  await supabase.from('players').delete().in('game_id', staleIds)

  const { error: deleteError } = await supabase
    .from('games')
    .delete()
    .in('id', staleIds)

  if (deleteError) {
    console.error('Cron: failed to delete stale games', deleteError)
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  console.log(`Cron: deleted ${staleIds.length} stale games`)
  return NextResponse.json({ deleted: staleIds.length })
}
