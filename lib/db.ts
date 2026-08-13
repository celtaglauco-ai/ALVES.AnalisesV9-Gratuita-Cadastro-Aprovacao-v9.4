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
  created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL,
  CONSTRAINT users_status_check CHECK (status IN ('pending','approved','rejected','blocked'))
 ); ALTER TABLE leagues ADD COLUMN IF NOT EXISTS data_quality JSONB NOT NULL DEFAULT '{"goals":true,"corners":true,"cards":true,"shots":true,"shotsOnTarget":true}'::jsonb`,
      )
      .then(() => undefined);
  return globalDb.alvesReady;
}
export async function listLeagues(): Promise<League[]> {
  await initDb();
  const { rows } = await pool.query(
    "SELECT id,code,country,name,season,file_name,games,updated_at,data_quality FROM leagues ORDER BY country,name,season",
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
  }));
}
