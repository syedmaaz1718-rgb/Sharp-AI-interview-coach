// v9 logic: peer battles, interview rewind, recruiter bias audit. Pure functions, no I/O.
import { round1 } from '../src/lib/analysis.js'

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0)
const sd = (a) => { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)) }
const nums = (t) => (String(t || '').match(/\d[\d,.]*%?/g) || []).length

// ------------------------------------------------------------------ peer battle
// Both players answer the same questions and are scored by the same content analysis,
// so typed and spoken answers compete fairly. Delivery (pace, fillers) is shown, not scored.
export function battleTotal(questions, answers) {
  const per = questions.map((q) => {
    const a = answers?.[q.id]
    return { id: q.id, score: a ? a.content : 0, answered: !!a, words: a?.words || 0, hit: a?.hit || 0, total: a?.total || 0, nums: a?.nums || 0 }
  })
  const answered = per.filter((p) => p.answered).length
  return { per, answered, score: round1(mean(per.map((p) => p.score)) * 10) }
}

export function judgeBattle(questions, A, B) {
  const a = battleTotal(questions, A.answers)
  const b = battleTotal(questions, B.answers)
  const diff = round1(a.score - b.score)
  const winner = Math.abs(diff) < 3 ? 'tie' : diff > 0 ? 'a' : 'b'
  const names = { a: A.name, b: B.name }
  const rounds = questions.map((q, i) => {
    const x = a.per[i]; const y = b.per[i]
    const d = round1(x.score - y.score)
    const w = Math.abs(d) < 0.5 ? 'tie' : d > 0 ? 'a' : 'b'
    const why = []
    if (w !== 'tie') {
      const [win, lose] = w === 'a' ? [x, y] : [y, x]
      if (!lose.answered) why.push('the other answer was missing')
      else {
        if (win.hit > lose.hit) why.push(`covered ${win.hit} of ${win.total || '?'} expected points vs ${lose.hit}`)
        if (win.nums > lose.nums) why.push('backed it with numbers')
        if (win.words > lose.words * 1.4 && win.words >= 60) why.push('gave a fuller answer')
        if (!why.length) why.push('better structure and relevance')
      }
    }
    return { id: q.id, text: q.text, a: x.score, b: y.score, winner: w, why: why.join(', ') }
  })
  const wins = { a: rounds.filter((r) => r.winner === 'a').length, b: rounds.filter((r) => r.winner === 'b').length }
  let reason
  if (winner === 'tie') reason = `Too close to call: ${a.score} vs ${b.score}. Each side won ${wins.a} and ${wins.b} questions.`
  else {
    const wn = names[winner]
    const best = [...rounds].filter((r) => r.winner === winner).sort((p, q) => Math.abs(q.a - q.b) - Math.abs(p.a - p.b))[0]
    reason = `${wn} scored ${winner === 'a' ? a.score : b.score} vs ${winner === 'a' ? b.score : a.score} and won ${wins[winner]} of ${questions.length} questions.` + (best ? ` Biggest gap: "${best.text.slice(0, 80)}" - ${best.why}.` : '')
  }
  return { winner, winnerName: winner === 'tie' ? null : names[winner], scores: { a: a.score, b: b.score }, diff, wins, rounds, reason,
    note: 'Scored by the same answer analysis for both players (relevance, structure, depth). Voice and camera are not part of the battle score.' }
}

export function battleCardSvg({ role, aName, bName, aScore, bScore, winner }) {
  const e = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  const line = winner === 'tie' ? 'Dead heat' : (winner === 'a' ? aName : bName) + ' wins'
  const col = (w) => (winner === w ? '#34d399' : '#9aa3b2')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8b5cf6"/><stop offset="1" stop-color="#22d3ee"/></linearGradient><radialGradient id="r1" cx=".15" cy=".1" r=".7"><stop offset="0" stop-color="#8b5cf6" stop-opacity=".45"/><stop offset="1" stop-color="#0a0b14" stop-opacity="0"/></radialGradient></defs><rect width="1200" height="630" fill="#0a0b14"/><rect width="1200" height="630" fill="url(#r1)"/><text x="60" y="90" fill="#e8eaf2" font-family="Arial" font-size="30" font-weight="700">SharpAI Battle</text><text x="60" y="130" fill="#9aa3b2" font-family="Arial" font-size="22">${e(role)}</text><text x="600" y="230" fill="url(#g)" font-family="Arial" font-size="64" font-weight="800" text-anchor="middle">${e(line)}</text><text x="300" y="400" fill="${col('a')}" font-family="Arial" font-size="140" font-weight="800" text-anchor="middle">${e(aScore)}</text><text x="900" y="400" fill="${col('b')}" font-family="Arial" font-size="140" font-weight="800" text-anchor="middle">${e(bScore)}</text><text x="300" y="460" fill="#e8eaf2" font-family="Arial" font-size="30" text-anchor="middle">${e(aName)}</text><text x="900" y="460" fill="#e8eaf2" font-family="Arial" font-size="30" text-anchor="middle">${e(bName)}</text><text x="600" y="395" fill="#9aa3b2" font-family="Arial" font-size="34" text-anchor="middle">vs</text><text x="60" y="580" fill="#9aa3b2" font-family="Arial" font-size="20">Same questions, same scoring. Scored from real answers by SharpAI.</text></svg>`
}

// ------------------------------------------------------------------ interview rewind
const PART_LABEL = { length: 'Answer depth', relevance: 'Relevance to the question', structure: 'Structure' }
export function compareAttempts(before, after, { bText = '', aText = '' } = {}) {
  const b = before.scores.content; const a = after.scores.content
  const delta = round1(a - b)
  const gains = []
  const losses = []
  for (const k of Object.keys(PART_LABEL)) {
    const pb = before.content?.parts?.[k]; const pa = after.content?.parts?.[k]
    if (pb == null || pa == null) continue
    const d = round1(pa - pb)
    if (d >= 1) gains.push(`${PART_LABEL[k]} went from ${pb} to ${pa}`)
    else if (d <= -1) losses.push(`${PART_LABEL[k]} dropped from ${pb} to ${pa}`)
  }
  const cnt = (x) => (Array.isArray(x) ? x.length : Number(x) || 0)
  const kb = cnt(before.content?.keywordsHit); const ka = cnt(after.content?.keywordsHit)
  if (ka > kb) gains.push(`You covered ${ka - kb} more key idea${ka - kb > 1 ? 's' : ''} (${ka} of ${after.content.keywordsTotal})`)
  if (ka < kb) losses.push(`You covered ${kb - ka} fewer key ideas`)
  const sb = before.content?.parts?.starFound; const sa = after.content?.parts?.starFound
  if (sb && sa) {
    const add = Object.keys(sa).filter((k) => sa[k] && !sb[k])
    if (add.length) gains.push(`Added the ${add.join(' and ')} of the STAR structure`)
  }
  const nb = nums(bText); const na = nums(aText)
  if (na > nb) gains.push(`Added ${na - nb} number${na - nb > 1 ? 's' : ''} or measurable detail`)
  if (before.words && after.words && after.words >= before.words * 1.3 && after.words - before.words >= 20) gains.push(`Fuller answer: ${before.words} to ${after.words} words`)
  const fb = before.fillers?.per100; const fa = after.fillers?.per100
  if (fb != null && fa != null && fb - fa >= 1.5) gains.push(`Fewer filler words (${fb} to ${fa} per 100 words)`)
  const verdict = delta >= 1 ? 'improved' : delta <= -1 ? 'declined' : 'about the same'
  const summary = verdict === 'improved' ? `Better by ${delta} points.` + (gains[0] ? ' ' + gains[0] + '.' : '')
    : verdict === 'declined' ? `Down ${Math.abs(delta)} points. ${losses[0] || 'The second attempt covered less.'}.`
      : 'Scores are about the same. Try adding one specific example with a number.'
  return { before: b, after: a, delta, verdict, gains, losses, summary }
}

// ------------------------------------------------------------------ recruiter bias audit
// Compares the recruiter's own ratings with an objective baseline (content analysis of the answers)
// and checks whether the gap between them differs across groups. It is a signal, not a finding.
const F = new Set('aarti aditi ananya anjali anita ankita asha ayesha divya deepika diya isha kavya kiran kritika lakshmi meera megha neha nisha pooja priya priyanka radha riya rina sakshi sana sara shreya shruti simran sneha sunita swati tanvi teena uma vidya zoya emma olivia sophia mia anna sarah emily jessica jennifer lisa maria mary linda susan karen'.split(' '))
const M = new Set('aarav aditya ajay akash aman amit anil arjun arun ashish deepak dev dhruv gaurav harsh karan kunal manish mohit mukesh naveen nikhil pranav prakash raj rahul rajesh ravi rohan rohit sachin sandeep sanjay saurabh shubham siddharth suresh tarun varun vikas vikram vishal vivek yash john david michael james robert william daniel mark paul kabir ali farhan imran'.split(' '))
export function nameCue(name) {
  const first = String(name || '').trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z]/g, '')
  return F.has(first) ? 'female-coded' : M.has(first) ? 'male-coded' : null
}
const MIN_N = 5
const MIN_GAP = 0.5 // on the 1-5 rating scale

export function biasAudit(rows) {
  // rows: [{ name, college, decisionRating (1-5 mean of human-entered ratings), baseline (1-5 from content analysis) }]
  const usable = rows.filter((r) => r.rating != null && r.baseline != null)
  const resid = usable.map((r) => ({ ...r, resid: r.rating - r.baseline }))
  const overallMean = mean(resid.map((r) => r.resid))
  const checks = []
  const test = (title, cue, groups) => {
    const labeled = groups.filter((g) => g.rows.length)
    if (labeled.length < 2) { checks.push({ title, cue, status: 'insufficient', text: `Need at least two groups with ${MIN_N}+ candidates each. Not enough labeled data yet.`, groups: labeled.map(sum) }); return }
    const ok = labeled.filter((g) => g.rows.length >= MIN_N)
    if (ok.length < 2) { checks.push({ title, cue, status: 'insufficient', text: `Groups are too small (${labeled.map((g) => g.label + ' ' + g.rows.length).join(', ')}). Each needs ${MIN_N}+ rated candidates before any pattern means something.`, groups: labeled.map(sum) }); return }
    const means = ok.map((g) => ({ g, m: mean(g.rows.map((r) => r.resid)) }))
    means.sort((p, q) => q.m - p.m)
    const gap = means[0].m - means[means.length - 1].m
    const pooled = sd(resid.map((r) => r.resid)) || 1
    const se = Math.sqrt(ok.reduce((s, g) => s + 1 / g.rows.length, 0)) * pooled
    const flagged = gap >= MIN_GAP && gap > 2 * se
    checks.push({
      title, cue, status: flagged ? 'flag' : 'clear', gap: round1(gap),
      text: flagged
        ? `Your ratings relative to answer quality are ${round1(gap)} points higher for ${means[0].g.label} than for ${means[means.length - 1].g.label}. That is larger than chance would usually explain at this sample size. It does not prove bias. Review those ratings against the answers.`
        : `No meaningful difference found (gap ${round1(gap)} points on a 1 to 5 scale).`,
      groups: ok.map(sum),
    })
  }
  const sum = (g) => ({ label: g.label, n: g.rows.length, avgRating: round1(mean(g.rows.map((r) => r.rating))), avgBaseline: round1(mean(g.rows.map((r) => r.baseline))), avgGap: round1(mean(g.rows.map((r) => r.resid))) })

  const by = (fn) => { const m = {}; for (const r of resid) { const k = fn(r); if (k) (m[k] ||= []).push(r) } return Object.entries(m).map(([label, rs]) => ({ label, rows: rs })) }
  test('Name-coded gender', 'name', by((r) => nameCue(r.name)))
  const colleges = by((r) => (r.college || '').trim().toLowerCase() || null).map((g) => ({ ...g, label: g.rows[0].college.trim() }))
  const big = colleges.filter((g) => g.rows.length >= MIN_N)
  if (big.length) {
    const rest = resid.filter((r) => !big.some((g) => g.rows.includes(r)) && (r.college || '').trim())
    test('College', 'college', rest.length >= MIN_N ? [...big, { label: 'other colleges', rows: rest }] : big.length >= 2 ? big : [...big, { label: 'other colleges', rows: rest }])
  } else checks.push({ title: 'College', cue: 'college', status: 'insufficient', text: `No college has ${MIN_N}+ rated candidates yet, or colleges were not entered.`, groups: [] })

  // does the rating follow the answers at all?
  let corr = null
  if (usable.length >= 8) {
    const mr = mean(usable.map((r) => r.rating)); const mb = mean(usable.map((r) => r.baseline))
    const num = usable.reduce((s, r) => s + (r.rating - mr) * (r.baseline - mb), 0)
    const den = Math.sqrt(usable.reduce((s, r) => s + (r.rating - mr) ** 2, 0) * usable.reduce((s, r) => s + (r.baseline - mb) ** 2, 0))
    corr = den ? round1(num / den) : null
  }
  return {
    usable: usable.length, total: rows.length, avgOffset: round1(overallMean), agreement: corr, checks,
    flags: checks.filter((c) => c.status === 'flag').length,
    method: [
      'Baseline: for candidates who took your screening link, the content analysis of their answers (relevance, structure, depth) is converted to a 1 to 5 score. Manually added candidates have no baseline and are left out.',
      'Your rating: the average of the scores you entered or changed yourself. Scores left on the automatic suggestion are not counted as your judgment.',
      `Test: for each cue (name-coded gender, college), the average difference between your rating and the baseline is compared across groups. A group needs ${MIN_N}+ candidates, and the gap must be at least ${MIN_GAP} points and larger than about two standard errors.`,
      'Gender is inferred only from a short list of common first names and is often wrong or unknown. Candidates with unknown names are excluded. Treat it as a rough probe, not a fact about any person.',
      'Small samples produce noise. A flag is a prompt to re-read specific ratings. A clear result does not prove there is no bias.',
    ],
  }
}
