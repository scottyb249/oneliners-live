export type GameStatus = 'waiting' | 'active' | 'voting' | 'results' | 'ended' | 'break'
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
