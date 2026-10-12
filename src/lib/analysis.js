// Pure scoring functions shared by the server (and unit-tested). No DOM, no Node APIs.
// Every score is 0-10. null means "could not be measured" and is left out of averages.

export const clamp = (x, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x))
export const round1 = (x) => Math.round(x * 10) / 10
export const num = (x, lo, hi, def = null) => {
  const n = Number(x)
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : def
}

// 0 below a, rises to 1 at b, stays 1 until c, falls to 0 at d.
export function trap(x, a, b, c, d) {
  if (x <= a || x >= d) return 0
  if (x < b) return (x - a) / (b - a)
  if (x <= c) return 1
  return (d - x) / (d - c)
}
const toScore = (t, floor = 0) => round1(10 * (floor + (1 - floor) * clamp(t)))

export function wavg(pairs) {
  let s = 0
  let w = 0
  for (const [v, weight] of pairs) {
    if (v == null) continue
    s += v * weight
    w += weight
  }
  return w ? round1(s / w) : null
}

// ---------- text ----------
export function tokenize(text) {
  return (String(text || '').toLowerCase().match(/[a-z0-9'%.\u0900-\u097F]+/g) || []).map((w) => w.replace(/^[.']+|[.']+$/g, '')).filter(Boolean)
}

const SINGLE_FILLERS = ['um', 'umm', 'uh', 'uhh', 'er', 'erm', 'hmm', 'basically', 'actually', 'literally', 'honestly']
const PHRASE_FILLERS = ['you know', 'i mean', 'sort of', 'kind of', 'you see']
const LIKE_OK_AFTER = new Set(['would', 'i', 'you', 'we', 'they', 'looks', 'look', 'feel', 'feels', 'something', 'much', 'more', 'seem', 'seems', 'sounds', 'sound', 'just', 'not', "don't", 'to', 'and', 'or', 'unlike', 'alike'])

// Hindi / Hinglish fillers and STAR cues (Roman and Devanagari). Used when the interview language is not English.
const HI_FILLERS = ['matlab', 'mtlb', 'yaani', 'yani', 'basically', 'मतलब', 'यानी', 'बेसिकली', 'एक्चुअली', 'अच्छा', 'मतलब']
const HI = {
  situation: ['jab', 'dauran', 'college mein', 'project mein', 'internship', 'team mein', 'ek baar', 'pichle saal', 'जब', 'दौरान', 'कॉलेज', 'प्रोजेक्ट', 'टीम', 'एक बार', 'पिछले साल'],
  task: ['karna tha', 'zimmedari', 'lakshya', 'chunauti', 'samasya', 'problem', 'deadline', 'मुझे करना', 'ज़िम्मेदारी', 'जिम्मेदारी', 'लक्ष्य', 'चुनौती', 'समस्या'],
  action: ['maine banaya', 'maine kiya', 'maine likha', 'maine socha', 'maine decide', 'maine use', 'maine seekha', 'maine test', 'मैंने बनाया', 'मैंने किया', 'मैंने लिखा', 'मैंने सीखा', 'मैंने इस्तेमाल', 'मैंने तय', 'मैंने टेस्ट'],
  result: ['natija', 'nateeja', 'result', 'sudhar', 'kam hua', 'badh', 'safal', 'seekha', 'नतीजा', 'परिणाम', 'सफल', 'सुधार', 'कम हुआ', 'बढ़', 'सीखा'],
  reasoning: ['kyunki', 'kyuki', 'isliye', 'udaharan', 'jaise', 'lekin', 'magar', 'fayda', 'nuksan', 'depends', 'क्योंकि', 'इसलिए', 'उदाहरण', 'जैसे', 'लेकिन', 'मगर', 'फायदा', 'नुकसान'],
  I: ['maine', 'mai', 'main', 'मैंने', 'मैं', 'मैने'],
  WE: ['humne', 'hum', 'hamare', 'हमने', 'हम', 'हमारे'],
}

export function countFillers(text, lang = 'en') {
  const toks = tokenize(text)
  const byWord = {}
  const add = (k, n = 1) => (byWord[k] = (byWord[k] || 0) + n)
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i]
    if (lang !== 'en' && HI_FILLERS.includes(t)) add(t)
    else if (SINGLE_FILLERS.includes(t)) add(t === 'umm' ? 'um' : t === 'uhh' ? 'uh' : t === 'erm' ? 'er' : t)
    else if (t === 'like' && i > 0 && !LIKE_OK_AFTER.has(toks[i - 1]) && i < toks.length - 1) add('like')
    const pair = t + ' ' + (toks[i + 1] || '')
    if (PHRASE_FILLERS.includes(pair)) add(pair)
  }
  const total = Object.values(byWord).reduce((a, b) => a + b, 0)
  return { total, byWord }
}

// ---------- voice ----------
export function scorePace(wpm) {
  if (wpm == null) return null
  return toScore(trap(wpm, 40, 120, 165, 260), 0.05)
}
export function scoreFillers(per100) {
  if (per100 == null) return null
  return round1(clamp(10 - per100 * 0.9, 0, 10))
}
export function scorePauses(silenceRatio) {
  if (silenceRatio == null) return null
  return toScore(trap(silenceRatio, -0.01, 0.08, 0.3, 0.75), 0.05)
}
export function scoreEnergy(dbStd) {
  if (dbStd == null) return null
  return toScore(trap(dbStd, 0, 3.5, 10, 20), 0.15)
}

// ---------- face ----------
export function scoreEyeContact(ratio) {
  if (ratio == null) return null
  return round1(clamp((ratio - 0.15) / 0.65) * 10)
}
export function scoreSteadiness(headMotionDegPerSec) {
  if (headMotionDegPerSec == null) return null
  return toScore(trap(headMotionDegPerSec, -1, 0.5, 9, 45), 0.1)
}
export function scoreExpression(smileRatio, browMean) {
  if (smileRatio == null && browMean == null) return null
  const s = smileRatio == null ? 0.7 : trap(smileRatio, -0.01, 0.12, 0.65, 1.01)
  const b = browMean == null ? 0.7 : 1 - clamp(browMean / 0.55)
  return toScore(0.55 * s + 0.45 * b, 0.05)
}

// ---------- answer content ----------
const SITUATION = ['when', 'during', 'while', 'at my', 'in my', 'last year', 'in college', 'in class', 'project', 'internship', 'team', 'hackathon', 'once', 'there was', 'we were']
const TASK = ['needed to', 'had to', 'responsible', 'goal', 'task', 'objective', 'challenge', 'problem', 'my role', 'asked to', 'deadline']
const ACTION = ['i built', 'i created', 'i decided', 'i implemented', 'i led', 'i wrote', 'i designed', 'i used', 'i started', 'i organized', 'i learned', 'i worked', 'i tested', 'i analyzed', 'i developed', 'i fixed', 'i took', 'i proposed', 'i set', 'i reached', 'i asked', 'i made', 'i split', 'i divided', 'i focused', 'i researched', 'i trained']
const RESULT = ['result', 'outcome', 'as a result', 'improved', 'reduced', 'increased', 'achieved', 'finished', 'delivered', 'won', 'saved', 'learned', 'in the end', 'successfully', 'which led', 'ended up', 'impact', 'feedback']
const REASONING = ['because', 'for example', 'for instance', 'trade-off', 'tradeoff', 'compared', 'whereas', 'however', 'time complexity', 'space complexity', 'o(', 'advantage', 'disadvantage', 'depends', 'in practice', 'therefore', 'so that', 'which means']
const STOP = new Set('a an the and or of to in on for with is are was were be been it its this that you your i me my we our they them their as at by from about do does did can could would should how what why when where which who tell describe explain give between difference'.split(' '))

const has = (text, list) => list.filter((p) => text.includes(p)).length

export function keywordCoverage(question, transcript) {
  const text = ' ' + String(transcript || '').toLowerCase() + ' '
  const kws = (question.keywords || []).map((k) => k.toLowerCase())
  if (!kws.length) return null
  const hit = kws.filter((k) => text.includes(k))
  return { hit, total: kws.length, ratio: hit.length / kws.length }
}

export function scoreAnswerContent(question, transcript, lang = 'en') {
  const hi = lang !== 'en'
  const text = String(transcript || '').toLowerCase()
  const toks = tokenize(transcript)
  const words = toks.length
  const tips = []
  const parts = {}

  // length
  const followUp = question.category === 'followup'
  parts.length = followUp ? toScore(trap(words, 5, 35, 170, 320), 0) : toScore(trap(words, 5, 70, 230, 420), 0)
  if (words < (followUp ? 20 : 40)) tips.push({ area: 'answer', text: `Your answer was only ${words} words. Aim for ${followUp ? '40 to 120 words' : '90 to 200 words (about 40 to 90 seconds)'}.`, weight: 3 })
  else if (words > 320) tips.push({ area: 'answer', text: `Your answer ran long (${words} words). Cut to the main point and one example.`, weight: 2 })

  // relevance
  const cov = keywordCoverage(question, transcript)
  const qWords = tokenize(question.text).filter((w) => !STOP.has(w) && w.length > 3)
  const overlap = qWords.length ? qWords.filter((w) => toks.includes(w) || toks.some((t) => t.startsWith(w.slice(0, 5)))).length / qWords.length : 0
  if (cov) {
    parts.relevance = toScore(clamp(cov.ratio / 0.6) * 0.8 + clamp(overlap / 0.5) * 0.2)
    if (cov.ratio < 0.3) tips.push({ area: 'answer', text: `You missed key ideas for this question. Good answers usually touch on: ${(question.keywords || []).slice(0, 4).join(', ')}.`, weight: 3 })
  } else {
    parts.relevance = toScore(clamp(overlap / 0.5))
  }

  // structure
  const behavioral = question.category === 'behavioral' || question.category === 'situational' || question.category === 'intro'
  const followUpQ = followUp
  if (behavioral) {
    const found = {
      situation: has(text, SITUATION) + (hi ? has(text, HI.situation) : 0) > 0,
      task: has(text, TASK) + (hi ? has(text, HI.task) : 0) > 0,
      action: has(text, ACTION) + (hi ? has(text, HI.action) : 0) > 0,
      result: has(text, RESULT) + (hi ? has(text, HI.result) : 0) > 0,
    }
    const n = Object.values(found).filter(Boolean).length
    parts.structure = toScore(n / 4, 0)
    const missing = Object.keys(found).filter((k) => !found[k])
    if (question.category !== 'intro' && missing.length)
      tips.push({ area: 'answer', text: `Use the STAR structure. Your answer is missing: ${missing.join(', ')}. ${missing.includes('result') ? 'End with a concrete result.' : ''}`.trim(), weight: 2 })
    parts.starFound = found
  } else {
    const r = has(text, REASONING) + (hi ? has(text, HI.reasoning) : 0) + (followUpQ ? has(text, ACTION) : 0)
    parts.structure = toScore(clamp(r / 4))
    if (r < 2) tips.push({ area: 'answer', text: 'Explain the "why": mention a trade-off, an example, or complexity so it sounds like understanding, not memorizing.', weight: 2 })
  }

  // specificity: numbers and ownership
  const nums = (String(transcript || '').match(/\b\d[\d,.]*%?/g) || []).length
  const iCount = toks.filter((t) => t === 'i' || t === "i'm" || t === "i've" || t === "i'd" || (hi && HI.I.includes(t))).length
  const weCount = toks.filter((t) => t === 'we' || t === 'our' || t === "we're" || (hi && HI.WE.includes(t))).length
  parts.specificity = toScore(clamp(nums / 3) * 0.6 + clamp(iCount / 4) * 0.4)
  if (behavioral && question.category !== 'intro' && nums === 0) tips.push({ area: 'answer', text: 'Add at least one number (team size, percentage, time saved, users). Numbers make results believable.', weight: 1 })
  if (behavioral && weCount > iCount * 2 && words > 40) tips.push({ area: 'answer', text: 'You said "we" a lot. Say what YOU did, the interviewer is hiring you.', weight: 2 })

  // clarity
  const sentences = String(transcript || '').split(/[.!?]+/).map((s) => s.trim()).filter(Boolean)
  const avgLen = sentences.length ? words / sentences.length : words
  const uniq = words ? new Set(toks).size / words : 0
  // Speech transcripts often lack punctuation, so do not punish very long "sentences" hard.
  parts.clarity = toScore(0.5 * trap(avgLen, 2, 7, 30, 80) + 0.5 * trap(uniq, 0.25, 0.5, 1.01, 1.02), 0.05)

  const score = words < 3 ? 0 : wavg([[parts.relevance, 25], [parts.structure, 25], [parts.length, 20], [parts.specificity, 15], [parts.clarity, 15]])
  return { score, parts, words, keywordsHit: cov ? cov.hit : [], keywordsTotal: cov ? cov.total : 0, tips }
}

// ---------- one answer ----------
export function analyzeAnswer({ question, transcript, durationSec, input, metrics, lang = 'en' }) {
  const words = tokenize(transcript).length
  const spoken = input === 'speech'
  const dur = num(durationSec, 1, 900, 60)
  const wpm = spoken && words >= 8 ? Math.round((words / dur) * 60) : null
  const fillers = countFillers(transcript, lang)
  const per100 = words >= 8 ? round1((fillers.total / words) * 100) : null

  const face = metrics?.face || null
  const voice = metrics?.voice || null

  const s = {
    eye: face ? scoreEyeContact(face.eyeContactRatio) : null,
    steady: face ? scoreSteadiness(face.headMotion) : null,
    expression: face ? scoreExpression(face.smileRatio, face.browMean) : null,
    pace: scorePace(wpm),
    filler: spoken ? scoreFillers(per100) : null,
    pauses: spoken && voice ? scorePauses(voice.silenceRatio) : null,
    energy: spoken && voice ? scoreEnergy(voice.energyDbStd) : null,
  }
  s.face = wavg([[s.eye, 50], [s.steady, 25], [s.expression, 25]])
  s.voice = wavg([[s.pace, 35], [s.filler, 35], [s.pauses, 15], [s.energy, 15]])
  s.confidence = wavg([[s.face, 50], [s.voice, 50]])

  const content = scoreAnswerContent(question, transcript, lang)
  const tips = [...content.tips]
  if (face) {
    if (s.eye != null && s.eye < 6) tips.push({ area: 'face', text: `Estimated eye contact was ${Math.round(face.eyeContactRatio * 100)}%. Look at the camera lens, not at your own face on the screen.`, weight: 3 })
    if (s.steady != null && s.steady < 6) tips.push({ area: 'face', text: face.headMotion > 9 ? 'Your head moved around a lot. Keep your head steady and use small hand gestures instead.' : 'You stayed very still. A small nod or natural movement looks more relaxed.', weight: 1 })
    if (s.expression != null && s.expression < 6) tips.push({ area: 'face', text: face.browMean > 0.3 ? 'Your brows looked tense. Relax your forehead and take a breath before answering.' : 'You rarely smiled. A small smile at the start and end of an answer helps a lot.', weight: 1 })
  }
  if (spoken) {
    if (per100 != null && per100 > 4) tips.push({ area: 'voice', text: `${fillers.total} filler words (${per100} per 100 words)${topFiller(fillers) ? `, mostly "${topFiller(fillers)}"` : ''}. Pause silently instead of saying them.`, weight: 3 })
    if (wpm != null && wpm > 175) tips.push({ area: 'voice', text: `You spoke fast (${wpm} words/min). Aim for 120 to 160.`, weight: 2 })
    if (wpm != null && wpm < 100) tips.push({ area: 'voice', text: `You spoke slowly (${wpm} words/min). Aim for 120 to 160 to sound energetic.`, weight: 1 })
    if (voice && s.pauses != null && s.pauses < 6) tips.push({ area: 'voice', text: voice.silenceRatio > 0.3 ? 'Long pauses while thinking. Take 3 seconds before you start, then keep going.' : 'You rushed with almost no pauses. Short pauses make you sound confident.', weight: 1 })
    if (voice && s.energy != null && s.energy < 6) tips.push({ area: 'voice', text: 'Your voice sounded flat. Vary your pitch and stress the key words.', weight: 2 })
  }

  return {
    words,
    wpm,
    fillers: { total: fillers.total, per100, byWord: fillers.byWord },
    scores: { ...s, content: content.score },
    content: { parts: content.parts, keywordsHit: content.keywordsHit, keywordsTotal: content.keywordsTotal },
    measured: { face: !!face, voice: spoken && !!voice, speech: spoken },
    tips: tips.sort((a, b) => b.weight - a.weight).map(({ area, text }) => ({ area, text })),
  }
}

function topFiller(f) {
  const e = Object.entries(f.byWord).sort((a, b) => b[1] - a[1])[0]
  return e ? e[0] : null
}

// ---------- whole interview ----------
export function buildReport(items) {
  // items: [{ question, transcript, durationSec, analysis, llm? }]
  const n = items.length
  const pick = (f) => wavg(items.map((it) => [f(it), Math.max(10, it.analysis.words)]))
  const pickAnswer = (it) => (it.llm && it.llm.score != null ? round1(0.4 * it.analysis.scores.content + 0.6 * it.llm.score) : it.analysis.scores.content)
  const eye = pick((it) => it.analysis.scores.eye)
  const steady = pick((it) => it.analysis.scores.steady)
  const expression = pick((it) => it.analysis.scores.expression)
  const face = pick((it) => it.analysis.scores.face)
  const voice = pick((it) => it.analysis.scores.voice)
  const pace = pick((it) => it.analysis.scores.pace)
  const filler = pick((it) => it.analysis.scores.filler)
  const pauses = pick((it) => it.analysis.scores.pauses)
  const energy = pick((it) => it.analysis.scores.energy)
  const answer = pick(pickAnswer)
  const confidence = wavg([[face, 50], [voice, 50]])
  const overall = wavg([[face, 25], [voice, 30], [answer, 45]])

  const totalWords = items.reduce((a, it) => a + it.analysis.words, 0)
  const totalFillers = items.reduce((a, it) => a + it.analysis.fillers.total, 0)
  const byWord = {}
  for (const it of items) for (const [k, v] of Object.entries(it.analysis.fillers.byWord)) byWord[k] = (byWord[k] || 0) + v
  const spokenItems = items.filter((it) => it.analysis.wpm != null)
  const avgWpm = spokenItems.length ? Math.round(spokenItems.reduce((a, it) => a + it.analysis.wpm, 0) / spokenItems.length) : null
  const eyeItems = items.filter((it) => it.analysis.scores.eye != null)
  const eyePct = eyeItems.length ? Math.round((eyeItems.reduce((a, it) => a + (it.metricsFace?.eyeContactRatio ?? 0), 0) / eyeItems.length) * 100) : null

  // headline: the 3 most important tips across answers, de-duplicated by text
  const seen = new Set()
  const tips = []
  for (const it of items) for (const t of it.analysis.tips) if (!seen.has(t.text)) { seen.add(t.text); tips.push(t) }
  const summaryTips = tips.slice(0, 5)

  const bestIdx = items.map((it, i) => [i, pickAnswer(it)]).sort((a, b) => b[1] - a[1])[0]?.[0]
  const worstIdx = items.map((it, i) => [i, pickAnswer(it)]).sort((a, b) => a[1] - b[1])[0]?.[0]

  const headline = []
  if (confidence != null) headline.push(`confidence ${Math.round(confidence)}/10`)
  if (totalWords >= 8) headline.push(`${totalFillers} filler word${totalFillers === 1 ? '' : 's'}`)
  if (eyePct != null) headline.push(eyePct < 55 ? 'eye contact weak' : eyePct < 75 ? 'eye contact okay' : 'eye contact strong')

  return {
    questions: n,
    scores: { overall, confidence, face, voice, answer, eye, steady, expression, pace, filler, pauses, energy },
    stats: { totalWords, totalFillers, fillersPer100: totalWords ? round1((totalFillers / totalWords) * 100) : null, fillerBreakdown: byWord, avgWpm, eyeContactPct: eyePct },
    headline: headline.join(', '),
    tips: summaryTips,
    best: bestIdx ?? null,
    worst: worstIdx ?? null,
    grade: grade(overall),
  }
}

export function grade(score) {
  if (score == null) return null
  if (score >= 8.5) return 'Interview ready'
  if (score >= 7) return 'Strong'
  if (score >= 5.5) return 'Getting there'
  if (score >= 4) return 'Needs practice'
  return 'Early days'
}

// Splits text into segments flagged when they are filler words (same rules as countFillers).
export function markFillers(text) {
  const parts = String(text || '').match(/[A-Za-z0-9'%.]+|[^A-Za-z0-9'%.]+/g) || []
  const words = []
  parts.forEach((p, i) => {
    if (/[A-Za-z0-9]/.test(p)) words.push({ i, w: p.toLowerCase().replace(/^[.']+|[.']+$/g, '') })
  })
  const flagged = new Set()
  for (let k = 0; k < words.length; k++) {
    const { w, i } = words[k]
    if (SINGLE_FILLERS.includes(w)) flagged.add(i)
    else if (w === 'like' && k > 0 && !LIKE_OK_AFTER.has(words[k - 1].w) && k < words.length - 1) flagged.add(i)
    const next = words[k + 1]
    if (next && PHRASE_FILLERS.includes(w + ' ' + next.w)) { flagged.add(i); flagged.add(next.i) }
  }
  return parts.map((t, i) => ({ t, f: flagged.has(i) }))
}
