// Timer durations in seconds
export const TIMER_DURATIONS: Record<number, number> = {
  3: 90,
  4: 90,
  5: 120,
  6: 180, // KRACRONYM
  7: 180,
  8: 180,
  9: 180,
}

export const VOTING_TIMER_DURATION = 90

export const KRACRONYM_TIMER_DURATION = 180

// Helper: get timer duration by acronym length
export function getTimerDuration(acronym: string, isKracronym = false): number {
  if (isKracronym) return KRACRONYM_TIMER_DURATION
  const len = acronym.replace(/[^A-Z]/gi, '').length
  return TIMER_DURATIONS[len] ?? 90
}

// Leaderboard: only these roles show on the public leaderboard
export const LEADERBOARD_ROLES = ['individual', 'team_leader'] as const
