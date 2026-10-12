import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { openDb } from './sqlite.js'

const here = path.dirname(fileURLToPath(import.meta.url))

export function createDb(file = process.env.DB_FILE || path.join(here, 'coach.db')) {
  const db = openDb(file)
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      role TEXT NOT NULL,
      questions TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      finished_at TEXT,
      overall REAL,
      report TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_client ON sessions(client_id, created_at);
    CREATE TABLE IF NOT EXISTS answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      question_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      transcript TEXT NOT NULL,
      duration_sec REAL NOT NULL,
      input TEXT NOT NULL,
      metrics TEXT NOT NULL,
      analysis TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(session_id, question_id)
    );
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      name TEXT,
      picture TEXT,
      created_at TEXT NOT NULL,
      last_login TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS auth_sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS hr_roles (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      title TEXT NOT NULL,
      company TEXT NOT NULL DEFAULT '',
      jd TEXT NOT NULL,
      lang TEXT NOT NULL DEFAULT 'en',
      questions TEXT NOT NULL,
      rubric TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'template',
      screen_token TEXT,
      screen_open INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_hr_roles_client ON hr_roles(client_id, created_at);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_hr_roles_token ON hr_roles(screen_token) WHERE screen_token IS NOT NULL;
    CREATE TABLE IF NOT EXISTS hr_candidates (
      id TEXT PRIMARY KEY,
      role_id TEXT NOT NULL REFERENCES hr_roles(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'manual',
      status TEXT NOT NULL DEFAULT 'in_progress',
      cand_key TEXT,
      ratings TEXT NOT NULL DEFAULT '{}',
      answers TEXT NOT NULL DEFAULT '{}',
      notes TEXT NOT NULL DEFAULT '',
      decision TEXT,
      shortlisted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_hr_cand_role ON hr_candidates(role_id);
  `)
  const cols = db.all('PRAGMA table_info(sessions)').map((c) => c.name)
  const add = (name, ddl) => { if (!cols.includes(name)) db.exec(`ALTER TABLE sessions ADD COLUMN ${name} ${ddl}`) }
  add('mode', "TEXT NOT NULL DEFAULT 'standard'")
  add('lang', "TEXT NOT NULL DEFAULT 'en'")
  add('share_token', 'TEXT')
  add('share_name', "TEXT NOT NULL DEFAULT ''")
  const ccols = db.all('PRAGMA table_info(hr_candidates)').map((c) => c.name)
  if (!ccols.includes('college')) db.exec("ALTER TABLE hr_candidates ADD COLUMN college TEXT NOT NULL DEFAULT ''")
  db.exec(`
    CREATE TABLE IF NOT EXISTS battles (
      id TEXT PRIMARY KEY, token TEXT NOT NULL UNIQUE, label TEXT NOT NULL, kind TEXT NOT NULL, ref TEXT NOT NULL,
      questions TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS battle_players (
      id TEXT PRIMARY KEY, battle_id TEXT NOT NULL REFERENCES battles(id) ON DELETE CASCADE, slot TEXT NOT NULL,
      name TEXT NOT NULL, pkey TEXT NOT NULL, answers TEXT NOT NULL DEFAULT '{}', status TEXT NOT NULL DEFAULT 'playing',
      created_at TEXT NOT NULL, finished_at TEXT, UNIQUE (battle_id, slot)
    );
    CREATE TABLE IF NOT EXISTS rewinds (
      id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      question_id TEXT NOT NULL, attempt INTEGER NOT NULL, transcript TEXT NOT NULL, analysis TEXT NOT NULL,
      compare TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_rewinds_session ON rewinds(session_id);
  `)
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS passports (
      token TEXT PRIMARY KEY, session_id TEXT NOT NULL UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
      payload TEXT NOT NULL, sig TEXT NOT NULL, issued_at TEXT NOT NULL, revoked INTEGER NOT NULL DEFAULT 0
    );
  `)
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_share ON sessions(share_token) WHERE share_token IS NOT NULL')
  return db
}
