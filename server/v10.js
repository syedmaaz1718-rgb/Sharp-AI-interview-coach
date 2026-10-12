// v10 logic: live recruiter copilot (rule-based layer) and Skill Passport. Pure functions.
import crypto from 'node:crypto'
import { tokenize, round1 } from '../src/lib/analysis.js'
import { extractSkills } from './v8.js'

const STOP = new Set('about their there which would could should these those where while being other after before because specific situation example examples clear concrete general'.split(' '))
const stems = (s) => [...new Set((String(s).toLowerCase().match(/[a-z]{5,}/g) || []).filter((w) => !STOP.has(w)).map((w) => w.slice(0, 5)))]

// A "look for" item counts as covered when enough of its key words show up in the answer.
export function coverItems(items, transcript) {
  const text = ' ' + String(transcript || '').toLowerCase() + ' '
  return (items || []).map((t) => {
    const st = stems(t)
    const hit = st.length ? st.filter((w) => text.includes(w)).length >= Math.max(1, Math.ceil(st.length * 0.4)) : false
    return { text: t, hit }
  })
}

const VAGUE = [
  [/\b(we|our team|the team)\b/i, 'Says "we" without saying what the candidate personally did'],
  [/\b(kind of|sort of|maybe|i guess|i think|probably)\b/i, 'Hedged wording'],
  [/\b(etc|and so on|and stuff|things like that|something like)\b/i, 'Trails off instead of naming specifics'],
  [/\b(a lot|many|several|some|various)\b/i, 'Unquantified claim'],
  [/\b(worked on|helped with|was involved in|part of)\b/i, 'Unclear own contribution'],
]
export function vagueProbes(transcript) {
  const out = []
  const sentences = String(transcript || '').split(/(?<=[.!?])\s+/)
  for (const [re, why] of VAGUE) {
    const s = sentences.find((x) => re.test(x))
    if (/personally did/.test(why) && (String(transcript).match(/\b(i|my|me)\b/gi) || []).length >= 3) continue
    if (s && out.length < 3) out.push({ quote: s.length > 70 ? s.slice(0, 67).trim() + '...' : s.trim(), why: why + '. Ask for a concrete example.' })
  }
  return out
}

export function copilotRules({ question, transcript, role, answeredIds = [], looksFor = [], redFlags = [] }) {
  const words = tokenize(transcript).length
  const hasNumber = /\d/.test(transcript)
  const personal = /\b(i|my|me)\b/i.test(transcript)
  const look = coverItems(looksFor, transcript)
  const flags = coverItems(redFlags, transcript)
  const missed = look.filter((x) => !x.hit)
  const verdict = words < 25 ? 'thin' : (missed.length >= Math.ceil(look.length / 2) && look.length) || !personal ? 'partial' : hasNumber || look.every((x) => x.hit) ? 'strong' : 'ok'
  const followUps = []
  if (words < 25) followUps.push({ text: 'Can you walk me through a specific example, step by step?', why: 'Answer is very short' })
  if (!personal && words >= 25) followUps.push({ text: 'What exactly did you do yourself, as opposed to the team?', why: 'No personal ownership heard' })
  if (!hasNumber && words >= 25) followUps.push({ text: 'What was the measurable result, and how do you know?', why: 'No numbers or checkable result' })
  for (const m of missed.slice(0, 2)) followUps.push({ text: `You have not mentioned this yet: "${m.text}". Can you speak to that?`, why: 'Expected point not covered' })
  return {
    words, verdict,
    lookFor: look, redFlags: flags.filter((x) => x.hit),
    probes: vagueProbes(transcript),
    followUps: followUps.slice(0, 3),
    summary: verdict === 'thin' ? 'Very short answer, there is not much to judge yet.' : verdict === 'strong' ? 'Specific and well supported.' : verdict === 'partial' ? 'Some expected points are missing.' : 'Reasonable, could use more detail.',
  }
}

export function pillarCoverage(rubric, questions, answeredIds) {
  const set = new Set(answeredIds)
  const rows = rubric.map((c) => {
    const qs = questions.filter((q) => q.competency === c.id)
    const done = qs.filter((q) => set.has(q.id))
    return { id: c.id, name: c.name, weight: c.weight, asked: done.length, of: qs.length }
  })
  const gaps = rows.filter((r) => r.of > r.asked).sort((a, b) => (a.asked / (a.of || 1)) - (b.asked / (b.of || 1)) || b.weight - a.weight)
  let next = null
  if (gaps.length) next = questions.find((q) => q.competency === gaps[0].id && !set.has(q.id)) || null
  return { rows, next: next ? { id: next.id, text: next.text, pillar: gaps[0].name } : null }
}

// ------------------------------------------------------------------ Skill Passport
export function passportPayload({ id, name, report, score, roleLabel, issuedAt }) {
  const skills = new Map()
  for (const a of report.answers || []) {
    if (a.followUp) continue
    const found = extractSkills(a.transcript || '')
    const strong = typeof a.score === 'number' && a.score >= 6
    for (const [label] of found) {
      const cur = skills.get(label) || { skill: label, answers: 0, strong: 0 }
      cur.answers += 1; if (strong) cur.strong += 1
      skills.set(label, cur)
    }
  }
  const skillList = [...skills.values()].sort((a, b) => b.strong - a.strong || b.answers - a.answers).slice(0, 12)
    .map((s) => ({ skill: s.skill, level: s.strong ? 'demonstrated' : 'mentioned', answers: s.answers }))
  return {
    v: 1, id, name: String(name || '').slice(0, 40), role: roleLabel, date: report.finishedAt, issuedAt,
    score: score.score, band: score.band, dims: score.dims, strongest: score.strongest, mode: report.mode || 'standard', lang: report.lang || 'en',
    answered: score.answered, skills: skillList,
    framing: 'AI-verified practice interview. Scored by SharpAI from real answers. Not an employer credential or certification.',
  }
}
const canon = (p) => JSON.stringify(p, Object.keys(p).sort())
export const signPayload = (payload, secret) => crypto.createHmac('sha256', secret).update(canon(payload)).digest('hex')
export const verifyPayload = (payload, sig, secret) => {
  const good = Buffer.from(signPayload(payload, secret)); const given = Buffer.from(String(sig || ''))
  return good.length === given.length && crypto.timingSafeEqual(good, given)
}
