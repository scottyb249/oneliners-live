// NOTE: The `status` column on the `games` table in Supabase is plain text with NO check constraint.
// A check constraint (games_status_check) was dropped early in the project to allow new statuses freely.
// If a new status value is silently rejected by Supabase, run:
//   SELECT conname FROM pg_constraint WHERE conrelid = 'games'::regclass;
// If games_status_check appears, drop it:
//   ALTER TABLE games DROP CONSTRAINT IF EXISTS games_status_check;
// Valid statuses: waiting | picking | active | voting | results | break | kracronym_intro | ended

export type GameStatus = 'waiting' | 'active' | 'voting' | 'results' | 'ended' | 'break' | 'kracronym_intro' | 'picking'
export type PlayerRole = 'individual' | 'team_leader' | 'team_member' | 'crowd_voter'

export interface Game {
  id: string
  code: string
  host_name: string
  status: GameStatus
  current_round: number
  current_acronym: string | null
  round_started_at: string | null
  is_final_round: boolean
  tiebreaker_ran: boolean
  used_acronyms: string[]
  created_at: string
  display_slide: number
  reveal_index: number
  podium_step: number
  round_duration: number | null
  display_active: boolean
  display_close: boolean
  show_leaderboard: boolean
}

export interface Player {
  id: string
  game_id: string
  name: string
  role: PlayerRole
  team_name: string | null
  score: number
  is_host: boolean
  is_tiebreaker_participant: boolean
  final_position: number | null
  created_at: string
  avatar: string | null
}

export interface Answer {
  id: string
  game_id: string
  player_id: string
  round: number
  content: string
  submitted_at: string
  approved: boolean
  is_tiebreaker: boolean
  is_fastest: boolean
  host_message: string | null
  players?: {
    name: string
    team_name: string | null
  }
}

export interface Prompt {
  id: string
  acronym: string
  letter_count: number
  theme: string | null
  used: boolean
  created_at: string
}
