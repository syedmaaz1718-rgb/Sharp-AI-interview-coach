// Thin wrapper over Node's built-in node:sqlite (Node 22+).
import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'

export function openDb(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true })
  const raw = new DatabaseSync(file)
  raw.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;')
  return {
    raw,
    exec: (sql) => raw.exec(sql),
    run: (sql, ...p) => raw.prepare(sql).run(...p),
    get: (sql, ...p) => raw.prepare(sql).get(...p),
    all: (sql, ...p) => raw.prepare(sql).all(...p),
  }
}
