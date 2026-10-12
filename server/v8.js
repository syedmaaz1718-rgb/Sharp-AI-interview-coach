// v8 logic: resume vs JD gap analysis, SharpAI Score, interviewer (HR) packs and scorecards,
// Hinglish / Hindi question banks, and stress-mode pushbacks. Pure functions, no I/O.
import { round1 } from '../src/lib/analysis.js'
import { scoreCardSvg } from '../src/lib/scoreCard.js'

const esc = (s) => s.replace(/[.+*?^${}()|[\]\\]/g, '\\$&')
const clip = (s, n) => String(s || '').slice(0, n)

// ---------------------------------------------------------------- skills catalog
// [label, aliases, how to cover it fast, proof you can show]
const SK = (label, aliases, how, proof) => ({ label, aliases: aliases.map((a) => a.toLowerCase()), how, proof })
export const SKILLS = [
  SK('React', ['react', 'react.js', 'reactjs'], ['Build a small app with components, props, state and useEffect', 'Learn how re-renders work and when to memoize'], 'A deployed React app with a public link'),
  SK('Node.js', ['node', 'node.js', 'nodejs'], ['Build a REST API with Express and a database', 'Understand the event loop and async/await'], 'A REST API repo with 4 endpoints and tests'),
  SK('Express', ['express', 'express.js'], ['Create routes, middleware and error handling', 'Add input validation and auth to one route'], 'An API with auth and validation'),
  SK('Python', ['python'], ['Solve 20 problems and write one script that automates a real task', 'Learn lists, dicts, comprehensions and virtual environments'], 'A script or small project on GitHub'),
  SK('Java', ['java'], ['Re-learn OOP: classes, interfaces, collections, exceptions', 'Write one console project with JUnit tests'], 'A small Java project with tests'),
  SK('C++', ['c++', 'cpp'], ['Practice STL containers and pointers on 15 problems', 'Know RAII and how memory is managed'], 'Solved DSA problems in C++'),
  SK('JavaScript', ['javascript', 'js', 'es6'], ['Learn closures, promises, async/await and the DOM', 'Build one vanilla JS project without a framework'], 'A vanilla JS project'),
  SK('TypeScript', ['typescript', 'ts'], ['Convert one small JS project to TypeScript', 'Learn types, interfaces, generics and strict mode'], 'A TypeScript repo with strict mode on'),
  SK('SQL', ['sql', 'mysql', 'postgresql', 'postgres', 'sqlite', 'rdbms'], ['Practice joins, group by and subqueries on 20 problems', 'Design a 3-table schema and write the queries for it'], 'A schema plus queries in a repo'),
  SK('MongoDB', ['mongodb', 'mongo', 'nosql'], ['Build CRUD with Mongoose', 'Know when documents beat tables'], 'A project that stores data in MongoDB'),
  SK('HTML/CSS', ['html', 'css', 'tailwind', 'sass', 'responsive'], ['Rebuild one real landing page, responsive', 'Learn flexbox and grid properly'], 'A responsive page you rebuilt'),
  SK('Next.js', ['next.js', 'nextjs'], ['Build a small app with routing and server rendering', 'Learn SSR vs CSR trade-offs'], 'A Next.js app deployed on Vercel'),
  SK('Angular', ['angular'], ['Follow the official tutorial and build a CRUD app', 'Learn services, DI and RxJS basics'], 'A small Angular CRUD app'),
  SK('Vue', ['vue', 'vue.js'], ['Build a todo app, then a routed app', 'Learn the reactivity system'], 'A Vue app'),
  SK('Django', ['django'], ['Build a blog with models, views and admin', 'Learn the ORM'], 'A Django app with a database'),
  SK('Flask', ['flask'], ['Build a JSON API with 3 routes', 'Add SQLite and basic tests'], 'A Flask API'),
  SK('FastAPI', ['fastapi'], ['Build an API with Pydantic models', 'Read the auto-generated docs and add auth'], 'A FastAPI service'),
  SK('Spring Boot', ['spring', 'spring boot'], ['Build a REST API with JPA', 'Learn dependency injection'], 'A Spring Boot API'),
  SK('Docker', ['docker', 'containers'], ['Containerize one project with a Dockerfile', 'Run it with docker compose with a database'], 'A repo with a working Dockerfile'),
  SK('Kubernetes', ['kubernetes', 'k8s'], ['Deploy one container on a local cluster (minikube or kind)', 'Learn pods, deployments and services'], 'A manifest set that runs locally'),
  SK('Git', ['git', 'github', 'version control'], ['Practice branches, merges, rebase and pull requests', 'Resolve a merge conflict on purpose'], 'A repo with a clean PR history'),
  SK('Linux', ['linux', 'bash', 'shell'], ['Learn 25 core commands and write 2 shell scripts', 'Understand permissions and processes'], 'A shell script you use'),
  SK('AWS', ['aws', 'ec2', 's3', 'lambda'], ['Deploy a static site on S3 and an API on Lambda or EC2', 'Learn IAM basics'], 'A deployed service on AWS free tier'),
  SK('Azure', ['azure'], ['Deploy a web app on the free tier', 'Learn resource groups and app services'], 'A deployed Azure app'),
  SK('GCP', ['gcp', 'google cloud'], ['Deploy to Cloud Run', 'Learn IAM and storage buckets'], 'A Cloud Run service'),
  SK('CI/CD', ['ci/cd', 'github actions', 'jenkins', 'ci cd'], ['Add a GitHub Actions workflow that tests and builds', 'Learn deploy on merge'], 'A repo with a passing workflow badge'),
  SK('REST APIs', ['rest', 'rest api', 'restful', 'api', 'apis'], ['Design resources, status codes and pagination for one API', 'Document it'], 'An API with docs'),
  SK('GraphQL', ['graphql'], ['Build one schema with queries and mutations', 'Know GraphQL vs REST trade-offs'], 'A small GraphQL server'),
  SK('Data Structures & Algorithms', ['dsa', 'data structures', 'algorithms', 'algorithm'], ['Do 50 problems across arrays, trees, graphs and DP', 'Practice explaining time complexity out loud'], 'A tracked problem-solving log'),
  SK('System Design', ['system design', 'scalability', 'distributed systems', 'microservices'], ['Study 5 classic designs (URL shortener, chat, feed)', 'Practice the steps: requirements, API, data, scale'], 'A design write-up for one system'),
  SK('Machine Learning', ['machine learning', 'ml', 'scikit-learn', 'sklearn'], ['Train 2 models on a public dataset', 'Learn train/test split and metrics'], 'A notebook with data, model and metrics'),
  SK('Deep Learning', ['deep learning', 'tensorflow', 'pytorch', 'keras', 'neural network', 'neural networks'], ['Train a small CNN on a standard dataset', 'Learn loss, optimizers and overfitting'], 'A trained model with results'),
  SK('NLP', ['nlp', 'natural language processing', 'llm', 'llms', 'transformers'], ['Build a text classifier', 'Try a small LLM app with a prompt and an evaluation'], 'An NLP mini project'),
  SK('Pandas/NumPy', ['pandas', 'numpy'], ['Clean one messy CSV end to end', 'Learn groupby, merge and vectorized operations'], 'A cleaning notebook'),
  SK('Data Analysis', ['data analysis', 'data analytics', 'analytics', 'statistics', 'excel', 'power bi', 'tableau', 'dashboard', 'dashboards'], ['Take a public dataset and answer 5 business questions', 'Build one dashboard'], 'A dashboard or a short analysis write-up'),
  SK('Computer Vision', ['computer vision', 'opencv'], ['Build an image classifier or face detector', 'Learn convolution basics'], 'A CV mini project'),
  SK('Android', ['android', 'kotlin'], ['Build a 2-screen app with a list and an API call', 'Learn the activity lifecycle'], 'An APK or Play Store listing'),
  SK('Flutter', ['flutter', 'dart', 'react native'], ['Build a cross-platform app with a list and API', 'Learn state management'], 'An app running on a device'),
  SK('Firebase', ['firebase'], ['Add auth and Firestore to a small app'], 'An app using Firebase auth'),
  SK('Redis', ['redis', 'caching', 'cache'], ['Cache one slow endpoint with Redis', 'Learn TTL and invalidation'], 'An endpoint with a measured speedup'),
  SK('Testing', ['unit testing', 'testing', 'jest', 'pytest', 'junit', 'selenium', 'qa', 'test automation'], ['Write unit tests for one module and aim for the edge cases', 'Learn mocking'], 'A repo with passing tests'),
  SK('Agile/Scrum', ['agile', 'scrum', 'jira', 'kanban'], ['Learn sprints, standups and backlog refinement', 'Describe how you worked in one team'], 'A story about a team sprint'),
  SK('Communication', ['communication', 'communicate', 'presentation', 'stakeholder', 'stakeholders'], ['Record yourself explaining a project in 2 minutes', 'Practise with SharpAI and cut filler words'], 'A clear 2-minute project pitch'),
  SK('Teamwork', ['teamwork', 'team player', 'collaborate', 'collaboration', 'cross-functional'], ['Prepare 2 STAR stories about working in a team'], 'Two STAR stories'),
  SK('Leadership', ['leadership', 'lead a team', 'mentor', 'mentoring', 'ownership'], ['Prepare a STAR story where you took initiative', 'Volunteer to lead one small piece of a project'], 'A STAR story with a measurable result'),
  SK('Problem Solving', ['problem solving', 'problem-solving', 'analytical', 'critical thinking'], ['Practise thinking aloud on 10 problems', 'State the approach before coding'], 'A think-aloud practice habit'),
  SK('Figma/UI Design', ['figma', 'ui/ux', 'ux', 'ui design', 'wireframes'], ['Design one 3-screen flow in Figma', 'Learn spacing, hierarchy and contrast'], 'A Figma file'),
  SK('Digital Marketing', ['seo', 'digital marketing', 'content marketing', 'social media', 'google ads'], ['Run one small campaign or grow one page', 'Learn the basic metrics (CTR, CPC, conversion)'], 'A campaign with numbers'),
  SK('Sales', ['sales', 'lead generation', 'crm', 'business development'], ['Practise a 60-second pitch and objection handling', 'Learn how a CRM pipeline works'], 'A mock pitch you can describe'),
  SK('Finance', ['financial modeling', 'financial modelling', 'accounting', 'valuation', 'tally'], ['Build a 3-statement model for a listed company', 'Learn the key ratios'], 'A model spreadsheet'),
]

const hasTerm = (lower, alias) => new RegExp(`(^|[^a-z0-9+#.])${esc(alias)}($|[^a-z0-9+#])`).test(lower)
const NICE = /(preferred|nice to have|nice-to-have|good to have|plus\b|bonus|desirable|optional|familiarity|exposure)/i

export function extractSkills(text) {
  const lines = String(text || '').split(/\n+/)
  const found = new Map()
  for (const sk of SKILLS) {
    let mentions = 0
    let nice = 0
    for (const line of lines) {
      const l = line.toLowerCase()
      const n = sk.aliases.filter((a) => hasTerm(l, a)).length
      if (n) { mentions += 1; if (NICE.test(line)) nice += 1 }
    }
    if (mentions) found.set(sk.label, { skill: sk, mentions, importance: nice === mentions ? 'nice' : 'required' })
  }
  return found
}

export function gapAnalysis(jd, resume) {
  const need = extractSkills(jd)
  const have = extractSkills(resume)
  const matched = []
  const missing = []
  for (const [label, v] of need) {
    const entry = { skill: label, importance: v.importance, mentions: v.mentions }
    if (have.has(label)) matched.push(entry)
    else missing.push({ ...entry, how: v.skill.how, proof: v.skill.proof })
  }
  const weight = (e) => (e.importance === 'required' ? 2 : 1) * (1 + Math.min(e.mentions, 3) * 0.15)
  const rank = (a, b) => (a.importance === b.importance ? b.mentions - a.mentions : a.importance === 'required' ? -1 : 1)
  matched.sort(rank)
  missing.sort(rank)
  const tw = [...matched, ...missing].reduce((a, e) => a + weight(e), 0)
  const mw = matched.reduce((a, e) => a + weight(e), 0)
  const matchPct = tw ? Math.round((mw / tw) * 100) : null
  const extras = [...have.keys()].filter((k) => !need.has(k)).slice(0, 8)
  const focusQuestions = missing.slice(0, 3).map((m) => ({
    category: m.skill === 'Communication' || m.skill === 'Teamwork' || m.skill === 'Leadership' ? 'behavioral' : 'situational',
    text: `The role asks for ${m.skill}, and it is not on your resume. How would you get productive with it in your first two weeks, and what have you already tried?`,
    tip: `Be honest about the gap. Describe a plan and any small thing you have already done with ${m.skill}.`,
    keywords: [m.skill.toLowerCase(), 'learn', 'build', 'practice', 'first', 'project'],
  }))
  const reqMissing = missing.filter((m) => m.importance === 'required')
  const summary = !tw ? 'No recognizable skills were found in the job description. Paste the full requirements section.'
    : matchPct >= 80 ? `Strong match: your resume covers ${matched.length} of ${matched.length + missing.length} skills the posting mentions.`
    : `Your resume covers ${matched.length} of ${matched.length + missing.length} skills in the posting. ${reqMissing.length ? `Close these first: ${reqMissing.slice(0, 3).map((m) => m.skill).join(', ')}.` : 'The gaps are all nice-to-haves.'}`
  return { matchPct, matched, missing, extras, focusQuestions, summary, jdSkills: need.size, resumeSkills: have.size }
}

// ---------------------------------------------------------------- SharpAI Score
export function scoreBand(score) {
  if (score >= 85) return 'Elite'
  if (score >= 70) return 'Strong'
  if (score >= 55) return 'Rising'
  if (score >= 40) return 'Building'
  return 'Starting'
}

const to100 = (v) => (v == null ? null : Math.round(v * 10))
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null)
const sd = (a) => { if (a.length < 2) return null; const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))) }

// Built only from the finished report. Each dimension is 0-100; missing ones are left out and the rest are re-weighted.
export function computeSharpScore(report) {
  if (!report || !report.scores) return null
  const answers = report.answers || []
  const main = answers.filter((a) => !a.followUp).map((a) => a.score).filter((x) => typeof x === 'number')
  const fu = answers.filter((a) => a.followUp).map((a) => a.score).filter((x) => typeof x === 'number')
  const spread = sd(main)
  const dims = [
    { key: 'answers', label: 'Answer quality', score: to100(report.scores.answer), weight: 40 },
    { key: 'communication', label: 'Communication', score: to100(report.scores.voice), weight: 20 },
    { key: 'presence', label: 'Presence', score: to100(report.scores.face), weight: 15 },
    { key: 'consistency', label: 'Consistency', score: spread == null ? null : Math.round(Math.max(0, 10 - spread * 1.6) * 10), weight: 10 },
    { key: 'followups', label: report.mode === 'stress' ? 'Composure under pressure' : 'Follow-up handling', score: fu.length ? Math.round(mean(fu) * 10) : null, weight: report.mode === 'stress' ? 25 : 15 },
  ]
  let s = 0
  let w = 0
  for (const d of dims) if (d.score != null) { s += d.score * d.weight; w += d.weight }
  if (!w) return null
  const score = Math.round(s / w)
  const live = dims.filter((d) => d.score != null)
  const best = [...live].sort((a, b) => b.score - a.score)[0]
  const weak = [...live].sort((a, b) => a.score - b.score)[0]
  return {
    score,
    band: scoreBand(score),
    dims: live.map(({ key, label, score: sc }) => ({ key, label, score: sc })),
    strongest: best?.label || null,
    weakest: live.length > 1 ? weak?.label : null,
    answered: answers.length,
  }
}

export { scoreCardSvg }

// ---------------------------------------------------------------- Hinglish / Hindi banks
const HQ = (id, category, text, keywords, tip) => ({ id, role: 'custom', category, text, keywords, tip })
export const HINGLISH_BANK = [
  HQ('h1', 'intro', 'Apne baare mein batao. Aap kya padh rahe ho aur kis cheez mein interest hai?', ['student', 'project', 'skill', 'interest', 'internship', 'seekh', 'banaya'], '60 second mein: abhi kya padh rahe ho, kya banaya hai, aage kya chahiye.'),
  HQ('h2', 'behavioral', 'Apne sabse achhe project ke baare mein batao. Kya banaya, sabse mushkil part kya tha aur tumne personally kya kiya?', ['project', 'banaya', 'challenge', 'result', 'learned', 'maine'], 'Problem, apna role, ek mushkil cheez aur result batao.'),
  HQ('h3', 'behavioral', 'Ek baar ka example do jab tumhe kisi problem mein phans gaye the. Tumne usse kaise solve kiya?', ['problem', 'solution', 'try', 'debug', 'seekha', 'result'], 'STAR use karo: situation, task, action, result.'),
  HQ('h4', 'behavioral', 'Team mein kabhi disagreement hua hai? Kya hua aur tumne kya kiya?', ['disagree', 'baat', 'listen', 'compromise', 'result', 'team'], 'Dikhao ki tumne suna aur goal pe focus kiya.'),
  HQ('h5', 'behavioral', 'Koi nayi cheez tumne bahut jaldi seekhi ho, uska example do.', ['seekha', 'learn', 'tutorial', 'practice', 'banaya', 'deadline', 'result'], 'Seekhne ka process batao: kya padha, kya banaya, kitna time laga.'),
  HQ('h6', 'behavioral', 'Aisa koi time batao jab tum fail hue. Usse kya seekha?', ['fail', 'galti', 'seekha', 'badla', 'next time', 'improve'], 'Galti maano, phir kya badla woh batao.'),
  HQ('h7', 'situational', 'Deadline paas hai aur teammate apna kaam nahi kar raha. Tum kya karoge?', ['baat', 'help', 'samajh', 'deadline', 'communicate', 'plan'], 'Pehle baat karo, phir help ya escalate karo.'),
  HQ('h8', 'situational', 'Ek bug pe kai ghante se atke ho aur kuch samajh nahi aa raha. Tumhara approach kya hoga?', ['debug', 'reproduce', 'logs', 'isolate', 'google', 'poochna', 'break down'], 'Reproduce, isolate, logs, phir madad maango.'),
  HQ('h9', 'behavioral', 'Tum hume kyun hire karein? Ek internee se tum kya value dogे?', ['skill', 'learn', 'project', 'contribute', 'jaldi', 'team'], 'Ek skill ko ek team ki need se jodo.'),
  HQ('h10', 'technical', 'Apne resume ka koi ek technical project explain karo, jaise kisi non-technical dost ko batate ho.', ['project', 'banaya', 'database', 'frontend', 'backend', 'users', 'kyunki'], 'Simple bhasha, pehle problem, phir solution.'),
  HQ('h11', 'technical', 'Array aur linked list mein kya difference hai? Kab kaunsa use karoge?', ['array', 'linked list', 'memory', 'insert', 'access', 'o(1)', 'o(n)', 'kyunki'], 'Access aur insert ki complexity compare karo.'),
  HQ('h12', 'technical', 'Tumhare project mein data kahan store hota hai aur tumne wahi database kyun chuna?', ['database', 'sql', 'mongodb', 'kyunki', 'table', 'schema', 'trade-off'], 'Choice ka reason aur ek trade-off batao.'),
  HQ('h13', 'situational', 'Tumhe pehle hafte mein ek aisa kaam mila jo tumne kabhi nahi kiya. Pehle ghante mein kya karoge?', ['poochna', 'break down', 'plan', 'test', 'documentation', 'chhota'], 'Clarify karo, chhote parts mein todo, ek precise sawaal pucho.'),
  HQ('h14', 'behavioral', 'Tight deadline aur kai tasks ho to tum kaise prioritize karte ho?', ['prioritize', 'plan', 'deadline', 'important', 'communicate', 'focus'], 'Ek real example ke saath apna system batao.'),
  HQ('h15', 'behavioral', 'Kisi ne tumhe criticize kiya ho to tumne kaise react kiya? Ek example do.', ['feedback', 'suna', 'improve', 'badla', 'result'], 'Dikhao ki feedback ke baad kya badla.'),
  HQ('h16', 'behavioral', 'Paanch saal baad khud ko kahan dekhte ho?', ['seekhna', 'grow', 'skill', 'engineer', 'contribute', 'goal'], 'Honest raho aur seekhne se jodo.'),
]
export const HINDI_BANK = [
  HQ('d1', 'intro', 'अपने बारे में बताइए। आप क्या पढ़ रहे हैं और किस चीज़ में दिलचस्पी है?', ['student', 'project', 'skill', 'प्रोजेक्ट', 'इंटर्नशिप', 'सीखा', 'बनाया'], '60 सेकंड में: अभी क्या पढ़ रहे हैं, क्या बनाया है, आगे क्या चाहिए।'),
  HQ('d2', 'behavioral', 'अपने सबसे अच्छे प्रोजेक्ट के बारे में बताइए। आपने क्या बनाया, सबसे मुश्किल हिस्सा क्या था और आपने खुद क्या किया?', ['project', 'प्रोजेक्ट', 'बनाया', 'चुनौती', 'नतीजा', 'सीखा', 'मैंने'], 'समस्या, आपकी भूमिका, एक मुश्किल चीज़ और नतीजा बताइए।'),
  HQ('d3', 'behavioral', 'एक ऐसा उदाहरण दीजिए जब आप किसी समस्या में फँस गए थे। आपने उसे कैसे सुलझाया?', ['समस्या', 'हल', 'कोशिश', 'सीखा', 'नतीजा', 'problem'], 'STAR का इस्तेमाल कीजिए: स्थिति, काम, कदम, नतीजा।'),
  HQ('d4', 'behavioral', 'क्या कभी टीम में किसी बात पर असहमति हुई? क्या हुआ और आपने क्या किया?', ['असहमति', 'बात', 'सुना', 'समझौता', 'नतीजा', 'टीम'], 'दिखाइए कि आपने सुना और लक्ष्य पर ध्यान दिया।'),
  HQ('d5', 'behavioral', 'कोई नई चीज़ जो आपने बहुत जल्दी सीखी हो, उसका उदाहरण दीजिए।', ['सीखा', 'practice', 'बनाया', 'deadline', 'नतीजा', 'tutorial'], 'सीखने का तरीका बताइए: क्या पढ़ा, क्या बनाया, कितना समय लगा।'),
  HQ('d6', 'behavioral', 'ऐसा कोई समय बताइए जब आप असफल हुए। उससे आपने क्या सीखा?', ['असफल', 'गलती', 'सीखा', 'बदला', 'सुधार'], 'गलती मानिए, फिर क्या बदला वह बताइए।'),
  HQ('d7', 'situational', 'डेडलाइन पास है और आपका टीममेट अपना काम नहीं कर रहा। आप क्या करेंगे?', ['बात', 'मदद', 'समझ', 'deadline', 'plan', 'टीम'], 'पहले बात कीजिए, फिर मदद या एस्केलेट कीजिए।'),
  HQ('d8', 'situational', 'आप कई घंटों से एक बग पर अटके हैं। आपका तरीका क्या होगा?', ['debug', 'logs', 'अलग', 'पूछ', 'google', 'तोड़'], 'दोहराइए, अलग कीजिए, लॉग देखिए, फिर मदद माँगिए।'),
  HQ('d9', 'behavioral', 'हम आपको क्यों चुनें? एक इंटर्न के तौर पर आप क्या वैल्यू देंगे?', ['skill', 'सीख', 'project', 'प्रोजेक्ट', 'योगदान', 'जल्दी', 'टीम'], 'एक स्किल को टीम की ज़रूरत से जोड़िए।'),
  HQ('d10', 'technical', 'अपने रिज़्यूमे का कोई एक प्रोजेक्ट ऐसे समझाइए जैसे किसी नॉन-टेक्निकल दोस्त को समझा रहे हों।', ['project', 'प्रोजेक्ट', 'बनाया', 'database', 'users', 'क्योंकि'], 'आसान भाषा में: पहले समस्या, फिर समाधान।'),
  HQ('d11', 'technical', 'ऐरे और लिंक्ड लिस्ट में क्या अंतर है? कब कौन सा इस्तेमाल करेंगे?', ['array', 'linked list', 'memory', 'insert', 'access', 'o(1)', 'o(n)', 'क्योंकि'], 'एक्सेस और इंसर्ट की कॉम्प्लेक्सिटी की तुलना कीजिए।'),
  HQ('d12', 'technical', 'आपके प्रोजेक्ट में डेटा कहाँ स्टोर होता है और आपने वही डेटाबेस क्यों चुना?', ['database', 'sql', 'mongodb', 'क्योंकि', 'table', 'schema', 'डेटाबेस'], 'चुनाव की वजह और एक ट्रेड-ऑफ बताइए।'),
]
export const bankFor = (lang) => (lang === 'hindi' ? HINDI_BANK : lang === 'hinglish' ? HINGLISH_BANK : null)
export const LANGS = ['en', 'hinglish', 'hindi']
export const cleanLang = (l) => (LANGS.includes(l) ? l : 'en')

export function pickLangQuestions(lang, count) {
  const bank = bankFor(lang)
  if (!bank) return []
  const intro = bank.filter((q) => q.category === 'intro')
  const rest = bank.filter((q) => q.category !== 'intro')
  // alternate categories so the set is varied
  const by = {}
  for (const q of rest) (by[q.category] ||= []).push(q)
  const order = []
  for (let i = 0; Object.values(by).some((l) => i < l.length); i++) for (const l of Object.values(by)) if (i < l.length) order.push(l[i])
  return [intro[0], ...order].slice(0, count).map((q, i) => ({ ...q, id: 'l' + (i + 1) }))
}

// ---------------------------------------------------------------- stress mode
const hash = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h }
export function stressPushback({ question, transcript, lang = 'en' }) {
  const text = String(transcript || '').replace(/\s+/g, ' ').trim()
  const words = text ? text.split(' ').length : 0
  const hasNum = /\d/.test(text)
  const h = hash(text + (question?.id || ''))
  const pick = (a) => a[h % a.length]
  if (lang === 'hindi') {
    if (words < 20) return 'बस इतना? हर उम्मीदवार यही कहता है। मुझे एक ठोस उदाहरण दीजिए, वरना मैं आगे बढ़ता हूँ।'
    if (!hasNum) return 'यह सब सुनने में अच्छा लगता है, पर इसका सबूत क्या है? कोई नंबर या नतीजा बताइए जो मैं जाँच सकूँ।'
    return pick(['मुझे यक़ीन नहीं हुआ। यह तो किताबी जवाब लगता है। अगर यह प्रोडक्शन में फेल हो जाए तो आप क्या करेंगे?', 'मान लीजिए आप गलत हैं। मुझे एक वजह बताइए कि मैं किसी और को क्यों न चुनूँ।', 'इसमें आपका अपना योगदान कितना था? टीम को हटा दें तो आपने क्या किया?'])
  }
  if (lang === 'hinglish') {
    if (words < 20) return 'Bas itna? Har candidate yahi bolta hai. Ek solid example do, warna hum aage badhte hain.'
    if (!hasNum) return 'Sunne mein achha lagta hai, par proof kya hai? Koi number ya result batao jo main check kar sakoon.'
    return pick(['Mujhe convince nahi hua. Ye textbook answer lag raha hai. Agar ye production mein fail ho jaye to tum kya karoge?', 'Maan lo tum galat ho. Ek reason batao ki main kisi aur ko kyun na chunun.', 'Isme tumhara apna contribution kitna tha? Team hata do to tumne kya kiya?'])
  }
  if (words < 20) return pick(['That is it? Every candidate says that. Give me one concrete example or we move on.', 'I need more than that. Convince me, with a real example.'])
  if (!hasNum) return 'That sounds good on paper, but where is the proof? Give me a number or a result I could actually check.'
  return pick([
    'I am not convinced. That sounds like a textbook answer. What happens when it fails in production?',
    'Suppose you are wrong. Give me one reason I should hire someone else instead.',
    'How much of that was really your work? Take your team away. What did you do?',
    'Why that approach and not the simpler one? Defend it.',
  ])
}

// ---------------------------------------------------------------- Hinglish follow-up (built-in interviewer)
export function langFollowUp({ question, transcript, lang }) {
  const words = String(transcript || '').trim().split(/\s+/).filter(Boolean).length
  const hindi = lang === 'hindi'
  if (words < 8) return hindi ? 'मुझे इसमें ज़्यादा कुछ समझ नहीं आया। क्या आप एक असली उदाहरण के साथ दोबारा बता सकते हैं?' : 'Isme mujhe kuch khaas samajh nahi aaya. Ek real example ke saath dobara batao?'
  if (words < 35) return hindi ? 'यह थोड़ा छोटा था। पूरी कहानी बताइए: आपने ठीक-ठीक क्या किया और नतीजा क्या रहा?' : 'Ye thoda chhota tha. Poori kahani batao: tumne exactly kya kiya aur result kya raha?'
  if (!/\d/.test(String(transcript))) return hindi ? 'इसका असली नतीजा क्या था? कोई नंबर या ऐसी चीज़ बताइए जिसे जाँचा जा सके।' : 'Iska asli result kya tha? Koi number ya aisi cheez batao jo check ho sake.'
  return hindi ? 'आपने यह तरीका ही क्यों चुना, और अगर दोबारा करें तो क्या बदलेंगे?' : 'Tumne ye approach kyun chuna, aur dobara karo to kya badloge?'
}

// ---------------------------------------------------------------- Interviewer (HR) mode
const COMP = (id, name, weight, desc, a1, a3, a5) => ({ id, name, weight, description: desc, anchors: { 1: a1, 3: a3, 5: a5 } })
export function defaultRubric(jd, skills = []) {
  const technical = skills.length ? `Depth in ${skills.slice(0, 3).join(', ')}` : 'Depth in the core skills for the role'
  const out = [
    COMP('technical', 'Technical depth', 30, technical, 'Cannot explain basics; only buzzwords', 'Solid on fundamentals; some depth, gaps under follow-up', 'Explains trade-offs and internals; has built real things'),
    COMP('problem', 'Problem solving', 25, 'Breaks a problem down and reasons aloud', 'Jumps to answers; no clear method', 'Clear method; gets to a workable approach with hints', 'Structured, tests assumptions, considers edge cases unprompted'),
    COMP('communication', 'Communication', 20, 'Clear, concise, answers the question asked', 'Rambles or too short; hard to follow', 'Mostly clear with some drift', 'Crisp, structured, easy to follow, checks understanding'),
    COMP('ownership', 'Ownership & initiative', 15, 'Says what THEY did and what changed', 'Only "we"; no personal contribution', 'Some clear personal actions', 'Specific personal actions with measurable results'),
    COMP('fit', 'Role fit & learning agility', 10, 'Motivation for the role and speed of learning', 'Generic motivation; no learning evidence', 'Reasonable fit; some learning examples', 'Strong match to the role; learns fast with proof'),
  ]
  if (/(lead|manage|stakeholder|mentor)/i.test(jd)) out.push(COMP('leadership', 'Leadership & stakeholders', 10, 'Influences others and handles stakeholders', 'No examples of leading or influencing', 'Led small pieces; some influence', 'Led people or outcomes with clear results'))
  return out
}

export function hrTemplateQuestions(jd, count = 8, lang = 'en') {
  const sk = [...extractSkills(jd).entries()].sort((a, b) => b[1].mentions - a[1].mentions).map(([k]) => k)
  const hi = lang !== 'en'
  const out = []
  const add = (competency, text, looksFor, redFlags, followUps) => out.push({ competency, text, looksFor, redFlags, followUps })
  for (const s of sk.filter((k) => !['Communication', 'Teamwork', 'Leadership', 'Problem Solving', 'Agile/Scrum'].includes(k)).slice(0, 4)) {
    add('technical',
      hi ? `${s} mein sabse complex cheez kaunsi banayi hai? Kaunse decisions liye aur kyun?` : `What is the most complex thing you have built or done with ${s}? Which decisions did you make and why?`,
      ['Specific scope and scale', `Real use of ${s}, not tutorial-level`, 'Names a trade-off and the reason', 'Clear personal contribution'],
      ['Only follows tutorials', 'Cannot say why they chose it', 'Vague about what they built'],
      [hi ? 'Agar ye 10x load pe chale to pehle kya toot-ta?' : 'What would break first at 10x load?', hi ? 'Kya alternative consider kiya tha?' : 'What alternative did you consider?'])
  }
  add('problem', hi ? 'Ek aisa bug ya problem batao jisme kaafi time laga. Kaise debug kiya?' : 'Tell me about a bug or problem that took you a long time. How did you approach it?',
    ['Reproduces and isolates the issue', 'Forms and tests hypotheses', 'Learns something reusable'], ['Random trial and error', 'Blames tools or others'], [hi ? 'Dobara ho to kaise jaldi pakdoge?' : 'How would you catch it sooner next time?'])
  add('problem', hi ? 'Maan lo tumhe pehle hafte mein ek naya kaam mila jo tumne kabhi nahi kiya. Pehle ghante mein kya karoge?' : 'Imagine you get a task in week one that you have never done before. What do you do in the first hour?',
    ['Clarifies the goal', 'Breaks it down', 'Asks a precise question', 'Starts small and checks'], ['Freezes or waits for instructions', 'Starts building with no questions'], [])
  add('communication', hi ? 'Apne ek project ko kisi non-technical manager ko 90 second mein samjhao.' : 'Explain one of your projects to a non-technical manager in 90 seconds.',
    ['Starts with the problem and the user', 'Plain words', 'Ends with the result'], ['Jargon dump', 'No clear point'], [hi ? 'Sabse important number kaunsa hai?' : 'What is the single most important number?'])
  add('ownership', hi ? 'Ek aisa time batao jab tumne bina bole kuch initiative liya.' : 'Tell me about a time you took initiative without being asked.',
    ['Spotted the problem themselves', 'Specific actions', 'Measurable result'], ['Only "we"', 'Result is unclear'], [hi ? 'Isme tumhara exact role kya tha?' : 'What exactly was your part?'])
  add('ownership', hi ? 'Ek galti batao jo tumse hui aur tumne uske baad kya badla.' : 'Tell me about a mistake you made and what you changed afterwards.',
    ['Owns it without excuses', 'Concrete change after'], ['Blames others', 'Non-answer or fake weakness'], [])
  add('fit', hi ? 'Is role mein tumhe kya excite karta hai aur tum pehle 3 mahine mein kya deliver karoge?' : 'What excites you about this role, and what would you deliver in your first three months?',
    ['References the actual role', 'Realistic first goals'], ['Generic answer that fits any company'], [])
  if (/(lead|manage|stakeholder|mentor)/i.test(jd)) add('leadership', hi ? 'Ek example do jab tumne dusron ko kisi decision ke liye convince kiya.' : 'Give an example of when you convinced others to follow your decision.', ['Listened first', 'Used evidence', 'Clear outcome'], ['Pushed through by authority'], [])
  while (out.length < count) add('communication', hi ? 'Koi ek sawaal jo tum humse poochna chahoge?' : 'What is one question you would ask us about the role or the team?', ['Thoughtful and specific'], ['No questions at all'], [])
  return out.slice(0, count).map((q, i) => ({ id: 'q' + (i + 1), ...q }))
}

export function normalizeHrPack(raw, jd, count, lang = 'en') {
  const comps = new Set()
  const rubric = []
  for (const c of Array.isArray(raw?.rubric) ? raw.rubric : []) {
    const name = clip(c?.name, 60).trim()
    if (!name) continue
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'c' + rubric.length
    if (comps.has(id)) continue
    comps.add(id)
    const a = c.anchors || {}
    rubric.push({ id, name, weight: Math.max(5, Math.min(60, Number(c.weight) || 15)), description: clip(c.description, 160), anchors: { 1: clip(a['1'] || a[1], 140), 3: clip(a['3'] || a[3], 140), 5: clip(a['5'] || a[5], 140) } })
    if (rubric.length >= 7) break
  }
  const questions = []
  for (const q of Array.isArray(raw?.questions) ? raw.questions : []) {
    const text = clip(q?.text, 320).trim()
    if (text.length < 12) continue
    const cname = clip(q.competency, 60).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24)
    const arr = (x, n) => (Array.isArray(x) ? x.slice(0, n).map((s) => clip(s, 160)).filter(Boolean) : [])
    questions.push({ id: 'q' + (questions.length + 1), competency: comps.has(cname) ? cname : rubric[0]?.id, text, looksFor: arr(q.looks_for || q.looksFor, 5), redFlags: arr(q.red_flags || q.redFlags, 4), followUps: arr(q.follow_ups || q.followUps, 3) })
    if (questions.length >= count) break
  }
  if (rubric.length >= 3 && questions.length >= 5) return { rubric, questions, source: 'ai' }
  const skills = [...extractSkills(jd).keys()]
  return { rubric: defaultRubric(jd, skills), questions: hrTemplateQuestions(jd, count, lang), source: 'template' }
}

export function scoreCandidate(rubric, questions, ratings) {
  const r = ratings || {}
  const byComp = {}
  let rated = 0
  for (const q of questions) {
    const v = Number(r[q.id]?.score)
    if (!Number.isFinite(v) || v < 1 || v > 5) continue
    rated++
    ;(byComp[q.competency] ||= []).push(v)
  }
  const comps = rubric.map((c) => ({ id: c.id, name: c.name, weight: c.weight, avg: byComp[c.id] ? round1(mean(byComp[c.id])) : null, n: byComp[c.id]?.length || 0 }))
  let s = 0
  let w = 0
  for (const c of comps) if (c.avg != null) { s += c.avg * c.weight; w += c.weight }
  const overall = w ? round1(s / w) : null
  const recommendation = overall == null ? null : overall >= 4.2 ? 'Strong hire' : overall >= 3.5 ? 'Hire' : overall >= 2.8 ? 'Maybe' : 'No hire'
  return { overall, percent: overall == null ? null : Math.round(((overall - 1) / 4) * 100), recommendation, comps, rated, total: questions.length, coverage: questions.length ? Math.round((rated / questions.length) * 100) : 0 }
}

export function compareCandidates(role, candidates) {
  const rows = candidates.map((c) => ({ id: c.id, name: c.name, decision: c.decision || null, notes: c.notes || '', ...scoreCandidate(role.rubric, role.questions, c.ratings) }))
  rows.sort((a, b) => (b.overall ?? -1) - (a.overall ?? -1))
  rows.forEach((r, i) => { r.rank = r.overall == null ? null : i + 1 })
  for (const r of rows) {
    const live = r.comps.filter((c) => c.avg != null)
    r.strongest = live.length ? [...live].sort((a, b) => b.avg - a.avg)[0].name : null
    const lo = live.length > 1 ? [...live].sort((a, b) => a.avg - b.avg)[0] : null
    const hi = live.length ? [...live].sort((a, b) => b.avg - a.avg)[0] : null
    r.weakest = lo && hi && lo.avg < hi.avg ? lo.name : null
  }
  // per competency: who leads
  const leaders = role.rubric.map((c) => {
    const best = rows.filter((r) => r.comps.find((x) => x.id === c.id)?.avg != null).sort((a, b) => b.comps.find((x) => x.id === c.id).avg - a.comps.find((x) => x.id === c.id).avg)[0]
    return { id: c.id, name: c.name, leader: best ? best.name : null }
  })
  return { candidates: rows, leaders }
}

// Heuristic suggestion for a dictated answer, based on the question's "looks for" list and answer structure.
export function suggestRating({ question, transcript, content }) {
  const words = String(transcript || '').trim().split(/\s+/).filter(Boolean).length
  if (words < 6) return { suggested: 1, reason: 'Almost no answer was captured.' }
  const base = content?.score
  const s = base == null ? 3 : Math.max(1, Math.min(5, Math.round(1 + (base / 10) * 4)))
  const hits = content?.keywordsHit?.length || 0
  return { suggested: s, reason: `Content score ${base ?? 'n/a'}/10, ${words} words${hits ? `, touched ${hits} expected idea${hits === 1 ? '' : 's'}` : ''}. This is a hint, you decide.` }
}

// ---------------------------------------------------------------- Answer authenticity signal
// A signal built from measurable text and input behaviour. It is a prompt for a human to look closer, never a verdict.
export const AUTH_DISCLAIMER = 'This is a signal, not proof. Good candidates sometimes prepare well or write formally. Use it to decide where to probe, not who to reject.'
const AI_PHRASES = ['delve', 'tapestry', 'furthermore', 'moreover', 'in conclusion', 'it is important to note', 'it is worth noting', 'leverage', 'robust', 'seamless', 'holistic', 'paradigm', 'multifaceted', 'testament to', 'in today\'s fast-paced', 'ever-evolving', 'cutting-edge', 'synergy', 'foster', 'pivotal', 'comprehensive understanding', 'plays a crucial role', 'navigate the complexities', 'underscores', 'game-changer']
const LISTY = /\b(firstly|secondly|thirdly|first and foremost|lastly|in summary|to summarize|overall,)\b/gi
const SELF_REPAIR = /\b(i mean|sorry|let me think|actually|wait|um+|uh+|you know|like i said|how do i put it|matlab|मतलब)\b/gi

export function authenticity({ transcript, input = 'typed', durationSec, meta = {} }) {
  const text = String(transcript || '').replace(/\s+/g, ' ').trim()
  const words = text ? text.split(' ').length : 0
  if (words < 25) return { score: null, level: 'not enough text', signals: [], words, disclaimer: AUTH_DISCLAIMER }
  const lower = text.toLowerCase()
  const signals = []
  let score = 86
  const push = (label, detail, delta) => { signals.push({ label, detail, effect: delta < 0 ? 'concern' : 'natural' }); score += delta }

  const phraseHits = AI_PHRASES.filter((p) => lower.includes(p))
  if (phraseHits.length) push('Stock phrases', `Uses wording common in generated or scripted text: ${phraseHits.slice(0, 4).map((x) => `"${x}"`).join(', ')}.`, -Math.min(32, phraseHits.length * 9))
  const listy = (text.match(LISTY) || []).length
  if (listy >= 2) push('Rigid list structure', 'Walks through "firstly / secondly / lastly" like a prepared script.', -8)

  if (input === 'typed') {
    const chars = text.length
    if (meta.pasted) push('Text was pasted', 'The answer box received pasted text instead of typing.', -35)
    const typedMs = Number(meta.typedMs)
    if (typedMs > 0 && chars > 200) {
      const cps = chars / (typedMs / 1000)
      if (cps > 12 && !meta.pasted) push('Typed unusually fast', `About ${Math.round(cps)} characters per second, faster than people type while thinking.`, -22)
    }
  } else {
    const dur = Number(durationSec) || 0
    const wpm = dur > 0 ? (words / dur) * 60 : 0
    const fillers = (text.match(SELF_REPAIR) || []).length
    if (words > 110 && wpm > 175 && fillers === 0) push('Delivery like reading aloud', `${Math.round(wpm)} words per minute with no hesitation at all across ${words} words.`, -15)
  }

  const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.split(' ').length > 2)
  if (sentences.length >= 5) {
    const lens = sentences.map((s) => s.split(' ').length)
    const m = mean(lens)
    const v = sd(lens)
    if (m > 0 && v / m < 0.22) push('Very even sentences', 'Sentence lengths are almost identical, which is common in generated text.', -10)
  }

  const iCount = (lower.match(/\b(i|i'm|i've|i'd|maine|मैंने|मैंने|मैं|main)\b/g) || []).length
  if (words > 60 && iCount === 0) push('No personal voice', 'Nothing in the answer says what the candidate personally did.', -12)
  else if (iCount >= 3) push('Personal ownership', 'Describes actions in the first person.', 4)

  const nums = (text.match(/\b\d[\d,.]*%?/g) || []).length
  const names = (text.slice(1).match(/(?<![.!?]\s)\b[A-Z][a-z]{2,}\b/g) || []).length
  if (nums + names === 0 && words > 70) push('No concrete specifics', 'No numbers, names or tools that could be checked.', -8)
  else if (nums + names >= 3) push('Checkable specifics', 'Mentions numbers, names or tools that can be verified in a follow-up.', 5)

  const repairs = (text.match(SELF_REPAIR) || []).length
  if (repairs >= 2) push('Natural speech patterns', 'Self-corrections and hesitations typical of thinking aloud.', 5)

  score = Math.round(Math.max(5, Math.min(98, score)))
  const level = score >= 70 ? 'Reads as natural' : score >= 45 ? 'Mixed signals' : 'Review suggested'
  return { score, level, signals, words, disclaimer: AUTH_DISCLAIMER }
}

const shingles = (t) => {
  const w = String(t || '').toLowerCase().match(/[a-z0-9\u0900-\u097F']+/g) || []
  const out = new Set()
  for (let i = 0; i + 3 <= w.length; i++) out.add(w.slice(i, i + 3).join(' '))
  return out
}
export function similarity(a, b) {
  const A = shingles(a)
  const B = shingles(b)
  if (A.size < 8 || B.size < 8) return 0
  let inter = 0
  for (const x of A) if (B.has(x)) inter++
  return inter / (A.size + B.size - inter)
}

// ---------------------------------------------------------------- Leaderboard reasoning (built-in, from real scorecard data)
export function reasonFor(row, total) {
  if (row.overall == null) return 'Not scored yet. Rate at least one answer, or wait for the candidate to finish the screening.'
  const parts = [`Scores ${row.overall}/5 across ${row.rated} of ${row.total} questions (${row.coverage}% coverage).`]
  if (row.strongest) parts.push(`Strongest on ${row.strongest}${row.comps.find((c) => c.name === row.strongest)?.avg != null ? ` (${row.comps.find((c) => c.name === row.strongest).avg}/5)` : ''}.`)
  if (row.weakest) parts.push(`Weakest on ${row.weakest} (${row.comps.find((c) => c.name === row.weakest).avg}/5), worth probing in the next round.`)
  if (row.flagged) parts.push(`${row.flagged} answer${row.flagged === 1 ? '' : 's'} show weaker authenticity signals, so ask for a live example.`)
  if (row.coverage < 60) parts.push('Low coverage, so treat the rank as provisional.')
  return parts.join(' ')
}
