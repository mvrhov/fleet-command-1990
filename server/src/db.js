import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const DB_PATH = process.env.DB_PATH || "./data/battleship.db";
mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'waiting',
    current_turn INTEGER,
    winner INTEGER,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS players (
    game_id TEXT NOT NULL,
    slot INTEGER NOT NULL,
    session_id TEXT NOT NULL,
    board TEXT,
    shots TEXT NOT NULL DEFAULT '[]',
    ready INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (game_id, slot),
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_players_session ON players(session_id);
`);

// Cleanup games older than 24h
setInterval(() => {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  db.prepare("DELETE FROM games WHERE created_at < ?").run(cutoff);
}, 60 * 60 * 1000);
