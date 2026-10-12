// Copies the MediaPipe WASM runtime from node_modules into public/ so the app
// serves it itself (no CDN needed for the runtime). Runs before build/dev.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const from = path.join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm')
const to = path.join(root, 'public', 'mediapipe', 'wasm')
if (!fs.existsSync(from)) {
  console.error('MediaPipe wasm folder not found. Run npm install first.')
  process.exit(1)
}
fs.mkdirSync(to, { recursive: true })
for (const f of fs.readdirSync(from)) fs.copyFileSync(path.join(from, f), path.join(to, f))
console.log('Copied MediaPipe wasm ->', path.relative(root, to))
