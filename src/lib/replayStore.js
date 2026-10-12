// Answer video replays live in IndexedDB in the browser that recorded them (server disk is ephemeral and we do
// not upload video). Every function fails soft so a storage problem never breaks an interview.
const DB = 'coach-replays'
const STORE = 'replays'

function open() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('no indexedDB'))
    const r = indexedDB.open(DB, 1)
    r.onupgradeneeded = () => { const s = r.result.createObjectStore(STORE, { keyPath: 'key' }); s.createIndex('session', 'sessionId'); s.createIndex('createdAt', 'createdAt') }
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}
const wrap = (req) => new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error) })

export const replayKey = (sessionId, questionId) => `${sessionId}:${questionId}`

export async function saveReplay({ sessionId, questionId, blob, mime, timeline, question }) {
  try {
    if (navigator.storage?.estimate) {
      const { usage = 0, quota = 0 } = await navigator.storage.estimate()
      if (quota && quota - usage < blob.size * 2 + 20e6) { await prune(4); }
    }
    const db = await open()
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put({ key: replayKey(sessionId, questionId), sessionId, questionId, blob, mime, timeline, question, createdAt: Date.now() })
    await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error) })
    db.close()
    prune(14).catch(() => {})
    return { ok: true }
  } catch (e) {
    return { ok: false, reason: e?.name === 'QuotaExceededError' ? 'storage full' : 'storage unavailable' }
  }
}

export async function getReplay(sessionId, questionId) {
  try {
    const db = await open()
    const v = await wrap(db.transaction(STORE).objectStore(STORE).get(replayKey(sessionId, questionId)))
    db.close()
    return v || null
  } catch { return null }
}

export async function hasSessionReplays(sessionId) {
  try {
    const db = await open()
    const keys = await wrap(db.transaction(STORE).objectStore(STORE).index('session').getAllKeys(sessionId))
    db.close()
    return keys.length
  } catch { return 0 }
}

export async function deleteSessionReplays(sessionId) {
  try {
    const db = await open()
    const store = db.transaction(STORE, 'readwrite').objectStore(STORE)
    const keys = await wrap(store.index('session').getAllKeys(sessionId))
    for (const k of keys) store.delete(k)
    db.close()
  } catch {}
}

// Keep only replays from the newest N sessions.
export async function prune(keepSessions = 14) {
  try {
    const db = await open()
    const store = db.transaction(STORE, 'readwrite').objectStore(STORE)
    const all = await wrap(store.getAll())
    const newest = new Map()
    for (const r of all) newest.set(r.sessionId, Math.max(newest.get(r.sessionId) || 0, r.createdAt))
    const keep = new Set([...newest.entries()].sort((a, b) => b[1] - a[1]).slice(0, keepSessions).map((x) => x[0]))
    for (const r of all) if (!keep.has(r.sessionId)) store.delete(r.key)
    db.close()
  } catch {}
}

export function pickMime() {
  if (typeof MediaRecorder === 'undefined') return null
  const options = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
  return options.find((m) => { try { return MediaRecorder.isTypeSupported(m) } catch { return false } }) || null
}

// Starts recording a MediaStream. stop() resolves to {blob, mime} or null.
export function startRecorder(stream) {
  const mime = pickMime()
  if (!mime || !stream.getVideoTracks().length) return null
  try {
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 900_000, audioBitsPerSecond: 64_000 })
    const chunks = []
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data) }
    rec.start(1000)
    return {
      stop: () => new Promise((resolve) => {
        if (rec.state === 'inactive') return resolve(chunks.length ? { blob: new Blob(chunks, { type: mime }), mime } : null)
        rec.onstop = () => resolve(chunks.length ? { blob: new Blob(chunks, { type: mime }), mime } : null)
        try { rec.stop() } catch { resolve(null) }
      }),
    }
  } catch { return null }
}
