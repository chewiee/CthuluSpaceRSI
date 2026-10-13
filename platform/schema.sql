-- CthuluSpaceRSI platform state. Rituals never touch this.

CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL,
  favor INTEGER NOT NULL DEFAULT 0,
  favor_today INTEGER NOT NULL DEFAULT 0,
  favor_day TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  planets INTEGER,
  favor INTEGER
);
CREATE INDEX IF NOT EXISTS runs_player ON runs (player_id, started_at);

-- kind: 'rename' (free, pre-coded) or 'ai' (spends Favor + API budget)
-- status: queued -> running -> deployed | failed | rejected
CREATE TABLE IF NOT EXISTS rituals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  prompt TEXT NOT NULL,
  favor_cost INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  cost_usd REAL NOT NULL DEFAULT 0,
  pr_url TEXT,
  note TEXT,
  claimed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS rituals_status ON rituals (status, id);

CREATE TABLE IF NOT EXISTS world (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO world (key, value) VALUES ('name', 'CthuluSpaceRSI');
INSERT OR IGNORE INTO world (key, value) VALUES ('renamed', '0');
INSERT OR IGNORE INTO world (key, value) VALUES ('paused', '0');
