// Resume helpers: validation of question objects and a no-AI "template" fallback.
const TECH = ['react', 'node', 'express', 'python', 'java', 'c++', 'javascript', 'typescript', 'sql', 'sqlite', 'mysql', 'postgresql', 'mongodb', 'django', 'flask', 'fastapi', 'spring', 'html', 'css', 'tailwind', 'next.js', 'angular', 'vue', 'docker', 'git', 'linux', 'aws', 'firebase', 'tensorflow', 'pytorch', 'scikit-learn', 'pandas', 'numpy', 'opencv', 'machine learning', 'deep learning', 'nlp', 'computer vision', 'kotlin', 'flutter', 'react native', 'android', 'rest api', 'graphql', 'dsa', 'data structures', 'power bi', 'tableau', 'excel']
const PRETTY = { sql: 'SQL', sqlite: 'SQLite', mysql: 'MySQL', postgresql: 'PostgreSQL', mongodb: 'MongoDB', html: 'HTML', css: 'CSS', aws: 'AWS', nlp: 'NLP', dsa: 'DSA', 'c++': 'C++', 'next.js': 'Next.js', 'rest api': 'REST APIs', 'react native': 'React Native', 'scikit-learn': 'scikit-learn', 'power bi': 'Power BI', opencv: 'OpenCV', tensorflow: 'TensorFlow', pytorch: 'PyTorch', javascript: 'JavaScript', typescript: 'TypeScript', fastapi: 'FastAPI', graphql: 'GraphQL' }
const pretty = (t) => PRETTY[t] || t.charAt(0).toUpperCase() + t.slice(1)

export function extractResumeFacts(resume) {
  const text = String(resume || '')
  const lower = text.toLowerCase()
  const skills = TECH.filter((t) => new RegExp(`(^|[^a-z0-9+#])${t.replace(/[.+*?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9+#])`).test(lower)).map(pretty)
  const lines = text.split(/\n+/).map((l) => l.replace(/^[\s\-*•▪●·\d.)]+/, '').trim()).filter(Boolean)
  const projects = []
  for (const l of lines) {
    if (l.length < 12 || l.length > 160) continue
    if (/(project|built|developed|created|designed|implemented|deployed|clone|app\b|system|dashboard|platform)/i.test(l) && !/^(education|skills|summary)/i.test(l)) projects.push(l.replace(/\s+/g, ' '))
    if (projects.length >= 6) break
  }
  return { skills, projects }
}

const short = (t, n = 90) => (t.length > n ? t.slice(0, n - 3) + '...' : t)
// Interleave several lists so a short result still covers every project and skill instead of piling up on one.
function roundRobin(lists, count) {
  const out = []
  const seen = new Set()
  for (let i = 0; out.length < count && lists.some((l) => i < l.length); i++) {
    for (const l of lists) {
      if (i < l.length && !seen.has(l[i].text)) { seen.add(l[i].text); out.push(l[i]); if (out.length >= count) break }
    }
  }
  return out
}

export function templateQuestions(resume, count = 7) {
  const { skills, projects } = extractResumeFacts(resume)
  const proj = projects.slice(0, 4).map((p) => short(p))
  const walk = proj.map((name) => ({ category: 'behavioral', text: `Your resume says: "${name}". Walk me through it: what problem did it solve and what was the hardest part?`, tip: 'Problem, your role, one hard decision, a result.', keywords: ['problem', 'built', 'challenge', 'decision', 'result', 'learned', 'users'] }))
  const deeper = proj.map((name, i) => ({ category: 'technical', text: i % 2 === 0 ? `In "${name}", how did you test that it actually worked, and what bug taught you the most?` : `If you had two more weeks on "${name}", what would you change first and why?`, tip: 'Name one concrete bug or trade-off, not a general lesson.', keywords: ['test', 'bug', 'fixed', 'because', 'changed', 'improve'] }))
  const skillQs = skills.slice(0, 5).map((sk, i) => ({ category: 'technical', text: i === 0 ? `You list ${sk} on your resume. Why did you pick it, and what would break first if your app got 100 times more users?` : `You list ${sk} on your resume. Tell me about the most challenging thing you did with it and why you chose it.`, tip: `Be ready to go one level deeper on ${sk}.`, keywords: [sk.toLowerCase(), 'because', 'challenge', 'built', 'learned', 'example'] }))
  const own = [
    { category: 'behavioral', text: proj[0] ? `Which part of "${proj[0]}" did you personally build, and which part did someone else or a library handle?` : 'Which line on your resume are you proudest of, and what exactly was your part in it?', tip: 'Be exact about your own contribution.', keywords: ['i built', 'my part', 'team', 'wrote', 'designed'] },
    { category: 'situational', text: skills.length ? `Which skill on your resume are you least confident in (for example ${skills[skills.length - 1]}), and how would you get stronger at it in a month?` : 'Which skill on your resume are you least confident in, and how would you get stronger at it in a month?', tip: 'Honest gap, concrete plan.', keywords: ['learn', 'practice', 'plan', 'project'] },
    { category: 'behavioral', text: proj[0] ? `Who used or reviewed "${proj[0]}", and what feedback did you get that changed something?` : 'Pick the one line on your resume an interviewer is most likely to ask about. What would they ask, and what is your answer?', tip: 'Real feedback, one real change.', keywords: ['feedback', 'changed', 'user', 'because'] },
    { category: 'technical', text: skills[0] ? `What is something about ${skills[0]} that you got wrong at first, and how did you find out?` : 'What is a technical thing from your projects that you got wrong at first, and how did you find out?', tip: 'A real mistake and how you caught it.', keywords: ['wrong', 'bug', 'learned', 'fixed'] },
    { category: 'situational', text: 'A reviewer says the main project on your resume is too simple. How do you answer, and what would you add next?', tip: 'Calm answer, then one concrete next feature.', keywords: ['add', 'next', 'because', 'users'] },
  ]
  return roundRobin([walk, skillQs, deeper, own], count)
}

const CATS = new Set(['behavioral', 'technical', 'situational'])
const clip = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n)
export function sanitizeCustomQuestions(list, max = 7) {
  if (!Array.isArray(list)) return []
  const out = []
  for (const q of list) {
    const text = clip(q?.text, 320)
    if (text.length < 12) continue
    out.push({
      id: 'r' + (out.length + 1),
      role: 'custom',
      category: CATS.has(q.category) ? q.category : 'behavioral',
      text,
      tip: clip(q.tip, 200) || 'Answer with one concrete example.',
      keywords: (Array.isArray(q.keywords) ? q.keywords : []).slice(0, 8).map((k) => clip(k, 30).toLowerCase()).filter(Boolean),
    })
    if (out.length >= max) break
  }
  return out
}

// No-key fallback for job-description interviews. Uses the skills found in the JD (and the resume's projects when given).
export function templateJdQuestions(jd, resume = '', count = 7) {
  const jdSkills = extractResumeFacts(jd).skills
  const mine = resume ? extractResumeFacts(resume) : { skills: [], projects: [] }
  const titleLine = String(jd).split('\n').map((l) => l.trim()).find((l) => l.length > 3 && l.length < 80 && !/^(about|we are|who we|job description|responsibilities|requirements)/i.test(l)) || ''
  const proj = mine.projects.map((p) => short(p))
  const duties = String(jd).split(/\n|(?<=\.)\s/).map((l) => l.replace(/^[\s\-*•▪●·\d.)]+/, '').trim()).filter((l) => l.length >= 20 && l.length <= 140 && /^(build|develop|design|write|maintain|work|deliver|create|implement|analy|collaborate|support|test|deploy|own|lead|you will)/i.test(l)).slice(0, 3)
  const fit = [{ category: 'behavioral', text: titleLine ? `You are applying for "${titleLine}". Why this role, and why do you think you would be good at it?` : 'Why this role, and why do you think you would be good at it?', tip: 'Connect two things in the posting to two things you have done.', keywords: ['role', 'because', 'project', 'learn', 'team'] }]
  const skillQs = jdSkills.slice(0, 5).map((sk, i) => {
    const have = mine.skills.some((m) => m.toLowerCase() === sk.toLowerCase())
    const text = have && proj[i % Math.max(proj.length, 1)] ? `This role asks for ${sk}. In "${proj[i % proj.length]}", where did you use it, and what was the hardest decision you made with it?` : have ? `This role asks for ${sk}, which is on your resume. Describe the hardest thing you did with it.` : `This role asks for ${sk}. Tell me about your experience with it, or how you would get productive with it in your first two weeks.`
    return { category: 'technical', text, tip: `Give one concrete example with ${sk}. If you are new to it, be honest and describe how you learn.`, keywords: [sk.toLowerCase(), 'because', 'built', 'learned', 'example'] }
  })
  const dutyQs = duties.map((d) => ({ category: 'situational', text: `The posting says: "${short(d, 110)}". How would you approach that in your first month?`, tip: 'Show a method: clarify, break it down, start small, check the result.', keywords: ['first', 'plan', 'test', 'ask', 'step'] }))
  const link = proj.length ? [{ category: 'behavioral', text: `Which of your projects is closest to the work in this posting, and what would you do differently now?`, tip: 'Pick one project and tie it to a specific line of the posting.', keywords: ['project', 'built', 'because', 'changed'] }] : []
  const gap = jdSkills.filter((sk) => !mine.skills.some((m) => m.toLowerCase() === sk.toLowerCase())).slice(0, 1).map((sk) => ({ category: 'situational', text: `You have not listed ${sk}, which this role needs. What would you build in your first two weeks to get up to speed?`, tip: 'A small concrete project beats saying you learn fast.', keywords: [sk.toLowerCase(), 'build', 'learn', 'project'] }))
  const second = [{ category: 'situational', text: 'Imagine it is your second week and you are handed a task you have never done before. What do you do in the first hour?', tip: 'Show a method: clarify, break it down, ask a precise question.', keywords: ['ask', 'break', 'plan', 'test'] }]
  return roundRobin([fit, skillQs, dutyQs, link, gap, second], count)
}

// Built-in interviewer (no AI key): reacts to what the candidate actually said. Resume/JD skills ride along in q.keywords.
const FU_STOP = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'was', 'were', 'have', 'from', 'then', 'because', 'about', 'which', 'would', 'could'])
export function templateFollowUp({ question, transcript, contentScore }) {
  const text = String(transcript || '').replace(/\s+/g, ' ').trim()
  const words = text ? text.split(' ').length : 0
  const q = String(question?.text || '').replace(/\s+/g, ' ').trim()
  const qShort = q.length > 110 ? q.slice(0, 107) + '...' : q
  if (words < 8) return `I did not get much from that. Can you answer again with one real example? The question was: "${qShort}"`
  const said = extractResumeFacts(text).skills
  const num = text.match(/\b(\d+(?:\.\d+)?\s?(?:%|percent|x|times|ms|seconds?|minutes?|hours?|days?|weeks?|users|people|members|requests?|lines))/i)
  const doing = text.match(/\b(?:I|we)\s+(?:built|made|wrote|created|fixed|designed|used|led|implemented|deployed|tested|optimi[sz]ed|reduced|improved|decided)\s+([^.,;]{6,70})/i)
  const kw = (question?.keywords || []).filter((k) => k.length > 2 && /^[a-z0-9+#.]+$/i.test(k) && !FU_STOP.has(k) && extractResumeFacts(k).skills.length)
  const missing = kw.find((k) => !text.toLowerCase().includes(k.toLowerCase()))
  // unsatisfactory answers get a targeted probe first
  if (words < 35) return said.length ? `That was brief. You mentioned ${said[0]}: give me the full story, what exactly did you do with it and what was the result?` : 'That was brief. Walk me through one specific example: the situation, what you did yourself, and what happened.'
  if (missing) return `You did not mention ${missing}, which matters for this question. Where have you actually used it, even in a small project?`
  if (!num && (contentScore == null || contentScore < 7)) return doing ? `You said you ${doing[0].replace(/^(?:I|we)\s+/i, '').trim()}. What was the actual result? Give me a number or something I could check.` : 'What was the actual result of that? Give me a number or something concrete I could check.'
  if (said.length) return `You mentioned ${said[0]}. Why did you choose it over the alternatives, and what would you change if you did it again?`
  if (num) return `You said "${num[1]}". How did you measure that, and which part was your own work?`
  if (doing) return `You said you ${doing[0].replace(/^(?:I|we)\s+/i, '').trim()}. What was the hardest part of that, and how did you handle it?`
  return 'What is one specific detail from that story that someone else on the team would not have known to do?'
}
