-- GAMES
CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  host_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'active', 'voting', 'results', 'tiebreaker', 'ended')),
  current_round INT NOT NULL DEFAULT 0,
  current_acronym TEXT,
  round_started_at TIMESTAMPTZ,
  is_final_round BOOLEAN NOT NULL DEFAULT FALSE,
  tiebreaker_ran BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PLAYERS
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'individual'
    CHECK (role IN ('individual', 'team_leader', 'team_member', 'crowd_voter')),
  team_name TEXT,
  score INT NOT NULL DEFAULT 0,
  is_host BOOLEAN NOT NULL DEFAULT FALSE,
  is_tiebreaker_participant BOOLEAN NOT NULL DEFAULT FALSE,
  final_position INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ANSWERS
CREATE TABLE answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  round INT NOT NULL,
  content TEXT NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved BOOLEAN NOT NULL DEFAULT FALSE,
  is_tiebreaker BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (game_id, player_id, round)
);

-- VOTES
CREATE TABLE votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  voter_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  answer_id UUID NOT NULL REFERENCES answers(id) ON DELETE CASCADE,
  round INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (game_id, voter_id, round)
);

-- PROMPTS
-- Pre-loaded one-liner prompts for the host to choose from each round
CREATE TABLE prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  acronym TEXT NOT NULL,
  letter_count INT NOT NULL GENERATED ALWAYS AS (length(acronym)) STORED,
  theme TEXT,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- INDEXES
CREATE INDEX ON players(game_id);
CREATE INDEX ON answers(game_id, round);
CREATE INDEX ON votes(answer_id);
CREATE INDEX ON prompts(letter_count, used);

-- HELPER FUNCTION: atomically increment a player's score
CREATE OR REPLACE FUNCTION increment_score(p_player_id UUID, p_amount INT)
RETURNS void LANGUAGE SQL AS $$
  UPDATE players SET score = score + p_amount WHERE id = p_player_id;
$$;

-- ROW LEVEL SECURITY POLICIES
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read games"   ON games   FOR SELECT USING (true);
CREATE POLICY "Public insert games" ON games   FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update games" ON games   FOR UPDATE USING (true);

CREATE POLICY "Public read players"   ON players FOR SELECT USING (true);
CREATE POLICY "Public insert players" ON players FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update players" ON players FOR UPDATE USING (true);

CREATE POLICY "Public read answers"   ON answers FOR SELECT USING (true);
CREATE POLICY "Public insert answers" ON answers FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update answers" ON answers FOR UPDATE USING (true);

CREATE POLICY "Public read votes"   ON votes FOR SELECT USING (true);
CREATE POLICY "Public insert votes" ON votes FOR INSERT WITH CHECK (true);

CREATE POLICY "Public read prompts"   ON prompts FOR SELECT USING (true);
CREATE POLICY "Public update prompts" ON prompts FOR UPDATE USING (true);

-- REALTIME
ALTER PUBLICATION supabase_realtime ADD TABLE games;
ALTER PUBLICATION supabase_realtime ADD TABLE players;
ALTER PUBLICATION supabase_realtime ADD TABLE answers;
ALTER PUBLICATION supabase_realtime ADD TABLE votes;
