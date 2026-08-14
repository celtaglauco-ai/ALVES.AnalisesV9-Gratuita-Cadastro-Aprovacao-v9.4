import { Pool } from "pg";
import type { League } from "./types";

const globalDb = globalThis as unknown as {
  alvesPool?: Pool;
  alvesReady?: Promise<void>;
};
export const pool =
  globalDb.alvesPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl:
      process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : undefined,
    max: 5,
  });
if (process.env.NODE_ENV !== "production") globalDb.alvesPool = pool;

export function initDb() {
  if (!globalDb.alvesReady)
    globalDb.alvesReady = pool
      .query(
        `CREATE TABLE IF NOT EXISTS leagues (
  id TEXT PRIMARY KEY, code TEXT NOT NULL, country TEXT NOT NULL, name TEXT NOT NULL,
  season TEXT NOT NULL, file_name TEXT NOT NULL DEFAULT '', games JSONB NOT NULL,
  updated_at BIGINT NOT NULL, data_quality JSONB NOT NULL DEFAULT '{"goals":true,"corners":true,"cards":true,"shots":true,"shotsOnTarget":true}'::jsonb
 ); CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
  created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL, last_seen BIGINT NOT NULL DEFAULT 0,
  CONSTRAINT users_status_check CHECK (status IN ('pending','approved','rejected','blocked'))
 ); ALTER TABLE leagues ADD COLUMN IF NOT EXISTS data_quality JSONB NOT NULL DEFAULT '{"goals":true,"corners":true,"cards":true,"shots":true,"shotsOnTarget":true}'::jsonb;
 ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen BIGINT NOT NULL DEFAULT 0;
 CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_ci ON users (lower(email));
 CREATE TABLE IF NOT EXISTS user_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb, updated_at BIGINT NOT NULL
 );
 CREATE TABLE IF NOT EXISTS analysis_history (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL, league_id TEXT, home TEXT NOT NULL, away TEXT NOT NULL,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb, created_at BIGINT NOT NULL
 );
 CREATE TABLE IF NOT EXISTS referees (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, country TEXT NOT NULL DEFAULT '', league_id TEXT NOT NULL DEFAULT '',
  games INTEGER NOT NULL DEFAULT 0, fouls_per_game DOUBLE PRECISION NOT NULL DEFAULT 0,
  yellow_per_game DOUBLE PRECISION NOT NULL DEFAULT 0, red_per_game DOUBLE PRECISION NOT NULL DEFAULT 0,
  home_yellow DOUBLE PRECISION NOT NULL DEFAULT 0, away_yellow DOUBLE PRECISION NOT NULL DEFAULT 0,
  over35 DOUBLE PRECISION NOT NULL DEFAULT 0, over45 DOUBLE PRECISION NOT NULL DEFAULT 0,
  over55 DOUBLE PRECISION NOT NULL DEFAULT 0, updated_at BIGINT NOT NULL
 );
 CREATE UNIQUE INDEX IF NOT EXISTS referees_name_unique_ci ON referees(lower(name));
 CREATE TABLE IF NOT EXISTS league_api_sync (
  league_id TEXT PRIMARY KEY REFERENCES leagues(id) ON DELETE CASCADE,
  api_league_id INTEGER, season INTEGER, standings JSONB NOT NULL DEFAULT '{}'::jsonb,
  games JSONB NOT NULL DEFAULT '[]'::jsonb, status TEXT NOT NULL DEFAULT 'pending',
  error TEXT NOT NULL DEFAULT '', current_round TEXT NOT NULL DEFAULT '',
  remaining INTEGER, updated_at BIGINT NOT NULL DEFAULT 0
 );
 CREATE INDEX IF NOT EXISTS analysis_history_user_idx ON analysis_history(user_id,created_at DESC)`,
      )
      .then(() => undefined);
  return globalDb.alvesReady;
}
export async function listLeagues(): Promise<League[]> {
  await initDb();
  const { rows } = await pool.query(
    `SELECT l.id,l.code,l.country,l.name,l.season,l.file_name,l.games,l.updated_at,l.data_quality,
      s.games api_games,s.updated_at api_updated_at,s.status api_status,s.error api_error,
      s.current_round api_round,s.remaining api_remaining
     FROM leagues l LEFT JOIN league_api_sync s ON s.league_id=l.id ORDER BY l.country,l.name,l.season`,
  );
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    country: r.country,
    name: r.name,
    season: r.season,
    fileName: r.file_name,
    games: r.games,
    quality: r.data_quality,
    updatedAt: Number(r.updated_at),
    apiSync: r.api_updated_at ? {updatedAt:Number(r.api_updated_at),status:r.api_status,error:r.api_error,round:r.api_round,remaining:r.api_remaining,games:r.api_games||[]} : undefined,
  }));
}
