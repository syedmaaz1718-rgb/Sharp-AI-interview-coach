// Searchable company list plus interview-style families.
// Everything here is a practice aid built from commonly reported, public interview patterns.
// It is not official company content and does not claim to be any company's real question bank.
import { LIST } from './companies_data.js'

export const COMPANY_DISCLAIMER = 'Based on commonly reported interview patterns for this kind of company. Not official company content, and not affiliated with any company named.'

const DROP = new Set(['boston analytics', 'wipro holmes', 'cred club', 'slack india', 'sharechat tech', 'innovaccer india', 'innovaccer health', 'ind-swift', 'cadila', 'tata medical', 'lenskart health', 'practo health', 'tata 1mg labs', 'siemens gamesa', 'shopify global', 'stripe global', 'nagarro global', 'mphasis global', 'virtusa global', 'byju\'s global', 'revolut global', 'netflix global', 'spotify global', 'huawei devices', 'bloomberg media', 'capital one consulting', 'monitor deloitte', 'wipro hi-tech', 'tesla india', 'sunstone', 'mahindra susten', 'ola cells', 'aakash byju\'s', 'zomato hyperpure', 'swiggy instamart', 'pocket fm', 'tata starbucks', 'google pay india', 'amazon pay india'])

// Style families: how companies of this kind commonly interview, per widely shared candidate write-ups.
export const STYLES = {
  amazon: { label: 'Leadership-principles behavioral', rounds: ['Online assessment (coding + work style)', 'Technical phone screen', 'Loop: 3 to 5 interviews, each with behavioral stories and one technical area', 'Bar raiser conversation'], themes: ['ownership', 'customer obsession', 'dive deep with data', 'bias for action', 'deliver results', 'disagree and commit'], mix: { behavioral: 4, technical: 3 }, push: 'Interviewers keep asking "what did YOU do?" and want numbers.' },
  bigtech: { label: 'Structured problem solving', rounds: ['Recruiter chat', 'Coding or technical screen', 'Onsite loop: coding, design or domain depth, behavioral'], themes: ['clear thinking out loud', 'complexity and trade-offs', 'testing your own code', 'collaboration', 'learning quickly', 'impact'], mix: { behavioral: 2, technical: 5 }, push: 'Explain your reasoning as you go, and name trade-offs before being asked.' },
  mass: { label: 'Aptitude, technical round, HR', rounds: ['Online aptitude and reasoning test', 'Coding or technical assessment', 'Technical interview on projects and fundamentals', 'Managerial or HR round (relocation, bond, why this company)'], themes: ['core CS fundamentals (OOP, DBMS, OS, networks)', 'your final-year project', 'basic coding and SQL', 'communication', 'flexibility and willingness to learn', 'why this company'], mix: { behavioral: 3, technical: 4 }, push: 'Fundamentals and clear communication matter more than clever tricks.' },
  consulting: { label: 'Case and fit', rounds: ['Resume and aptitude screen', 'Case interview rounds', 'Fit and behavioral round', 'Partner or senior round'], themes: ['structuring an ambiguous problem', 'estimation and quick maths', 'business judgement', 'communicating a recommendation', 'teamwork', 'why consulting'], mix: { behavioral: 3, technical: 4 }, push: 'Structure first, numbers second, recommendation last.' },
  finance: { label: 'Fundamentals, markets and judgement', rounds: ['Online test (quant, logic, domain)', 'Technical or domain interview', 'Group discussion or case in some processes', 'HR and fit round'], themes: ['finance and accounting basics', 'current markets awareness', 'risk and ethics', 'attention to detail', 'quant reasoning', 'why this firm'], mix: { behavioral: 3, technical: 4 }, push: 'Know what you list on your resume cold, and keep up with current news.' },
  product: { label: 'Product, ownership and speed', rounds: ['Recruiter or founder chat', 'Coding or take-home task', 'Technical deep dive on something you built', 'Culture and ownership conversation'], themes: ['shipping real features', 'ownership', 'product sense and user empathy', 'debugging in production', 'working with ambiguity', 'learning fast'], mix: { behavioral: 3, technical: 4 }, push: 'They want proof you built and shipped things, not only studied them.' },
  consumer: { label: 'Business, leadership and fit', rounds: ['Application and online assessment', 'Case or business discussion', 'Functional interview', 'Leadership and HR round'], themes: ['consumer insight', 'leadership in a team or club', 'analytical thinking with data', 'problem solving under constraints', 'adaptability', 'why this brand'], mix: { behavioral: 4, technical: 3 }, push: 'Link your examples to a customer or business outcome.' },
  industrial: { label: 'Core domain and practical judgement', rounds: ['Aptitude and technical test', 'Core domain technical interview', 'Plant, field or project discussion', 'HR round'], themes: ['core subject fundamentals', 'safety and quality mindset', 'projects and internships', 'practical problem solving', 'teamwork on the ground', 'willingness to relocate'], mix: { behavioral: 3, technical: 4 }, push: 'Interviewers test whether you really understand your own branch fundamentals.' },
  healthcare: { label: 'Domain knowledge, ethics and detail', rounds: ['Screening test or application review', 'Domain interview', 'Situation and ethics questions', 'HR round'], themes: ['domain fundamentals', 'compliance and quality', 'attention to detail', 'patient or user impact', 'data handling', 'teamwork under pressure'], mix: { behavioral: 3, technical: 4 }, push: 'Accuracy and responsibility matter. Say how you check your own work.' },
  media: { label: 'Technical depth with communication and scale', rounds: ['Aptitude or screening', 'Technical or domain round', 'Case or project discussion', 'HR round'], themes: ['systems at scale', 'content or customer experience', 'networking or media basics', 'creativity with constraints', 'communication', 'adaptability'], mix: { behavioral: 3, technical: 4 }, push: 'Show you can explain a technical thing simply.' },
  hardware: { label: 'Deep fundamentals and hands-on', rounds: ['Written or online technical test', 'Core technical interviews (circuits, embedded, C, VLSI or similar)', 'Project and lab discussion', 'HR round'], themes: ['digital and analog fundamentals', 'C and low-level reasoning', 'debugging methodically', 'your hardware or embedded project', 'reading datasheets', 'curiosity'], mix: { behavioral: 2, technical: 5 }, push: 'Expect to be drilled on the basics until the depth of your knowledge shows.' },
  edu: { label: 'Mission, communication and fit', rounds: ['Application or screening', 'Subject or role discussion', 'Demo or task in some processes', 'Values and fit conversation'], themes: ['mission alignment', 'clear explanation', 'initiative and community work', 'data-informed decisions', 'collaboration', 'long-term interest'], mix: { behavioral: 4, technical: 3 }, push: 'Be specific about why this mission matters to you, with an example.' },
}

// Individual company overrides, matched on the lowercased name.
const OVERRIDE = [
  [/^amazon/, 'amazon'],
  [/^(google|meta|apple|netflix|microsoft|linkedin|stripe|airbnb|uber|openai|anthropic|nvidia|adobe|atlassian)/, 'bigtech'],
  [/^(tcs|infosys|wipro|hcltech|tech mahindra|ltimindtree|accenture|cognizant|capgemini|mphasis|coforge|hexaware|persistent|zensar|birlasoft|ibm)/, 'mass'],
]

const SECTOR_LABEL = { bigtech: 'Big tech', itservices: 'IT services', consulting: 'Consulting', finance: 'Banking and finance', product: 'Startups and product', consumer: 'Consumer and retail', industrial: 'Industrial and core', healthcare: 'Healthcare and pharma', media: 'Telecom and media', hardware: 'Semiconductor and hardware', edu: 'Education, nonprofit and funds' }
const SECTOR_STYLE = { bigtech: 'bigtech', itservices: 'mass', consulting: 'consulting', finance: 'finance', product: 'product', consumer: 'consumer', industrial: 'industrial', healthcare: 'healthcare', media: 'media', hardware: 'hardware', edu: 'edu' }

const slug = (s) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

function build() {
  const seen = new Set()
  const out = []
  for (const [sector, regions] of Object.entries(LIST)) {
    for (const [reg, str] of Object.entries(regions)) {
      for (const name of str.split('|')) {
        const key = name.toLowerCase()
        if (DROP.has(key) || seen.has(key)) continue
        seen.add(key)
        const ov = OVERRIDE.find(([re]) => re.test(key))
        out.push({ id: slug(name), name, sector, sectorLabel: SECTOR_LABEL[sector], region: reg === 'IN' ? 'India' : 'Global', style: ov ? ov[1] : SECTOR_STYLE[sector] })
      }
    }
  }
  const ids = new Set()
  return out.filter((c) => (ids.has(c.id) ? false : (ids.add(c.id), true))).sort((a, b) => a.name.localeCompare(b.name))
}
export const COMPANIES = build()
export const companyById = (id) => COMPANIES.find((c) => c.id === id) || null
export const publicCompanies = () => COMPANIES.map(({ id, name, sectorLabel, region }) => ({ id, name, sector: sectorLabel, region }))

export function cleanRole(r) {
  return String(r || '').replace(/[^\p{L}\p{N} .,+#&/()\-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 80)
}

export function styleOf(c) { return STYLES[c.style] || STYLES.product }

// Built-in questions, no AI. Assembled from the style family's themes and the chosen role.
export function templateCompanyQuestions(c, role, count = 7) {
  const st = styleOf(c)
  const t = st.themes
  const R = role || 'this role'
  const q = (category, text, tip, keywords) => ({ category, text, tip, keywords })
  const pool = [
    q('behavioral', `Why do you want to work at ${c.name}, and why as a ${R}? What have you done to learn about the company?`, 'Be specific: a product, a value, a team. Avoid generic praise.', ['why', 'company', 'role', 'learn', 'product', 'interest']),
    q('technical', `For a ${R} position, walk me through the project or piece of work that best shows you can do the job. What exactly did you build?`, 'Problem, your part, what broke, result.', ['project', 'built', 'problem', 'result', 'role']),
    q('behavioral', `Tell me about a time you showed ${t[0]}. What was the situation and what did you personally do?`, 'Use one real story. Say "I", add a number.', ['situation', 'action', 'result', 'i', 'learned']),
    q('technical', `What are the core fundamentals a ${R} should be strong at in your view, and how would you rate yourself on each?`, 'Name 3 to 4 areas honestly, with evidence for each.', ['fundamentals', 'strong', 'weak', 'practice', 'example']),
    q('behavioral', `Describe a time you had to deal with ${t[1]} in a team or project. What would you do differently now?`, 'Own your part. End with the lesson.', ['team', 'challenge', 'result', 'learned', 'changed']),
    q('technical', `Pick a problem a ${R} at a company like ${c.name} could face on the job. How would you break it down and approach it step by step?`, 'Clarify, break down, state trade-offs, then solve.', ['clarify', 'approach', 'steps', 'trade-off', 'test']),
    q('situational', `You are given a task as a ${R} with unclear requirements and a tight deadline. What do you do in the first hour?`, 'Ask questions, define done, agree scope, communicate early.', ['ask', 'clarify', 'scope', 'priority', 'communicate']),
    q('behavioral', `Give an example that shows ${t[2]}. How did you know it worked?`, 'Measure the outcome, not only the effort.', ['example', 'measured', 'result', 'impact']),
    q('technical', `If you joined as a ${R}, what would you want to learn in the first 90 days, and how would you go about it?`, 'A concrete plan with people, resources and a first small deliverable.', ['learn', 'plan', 'ask', 'practice', 'deliver']),
    q('situational', `A teammate disagrees with your approach on a ${R} task. How do you handle it?`, 'Listen, use data, commit to the decision once made.', ['listen', 'data', 'discuss', 'decision', 'respect']),
    q('behavioral', `Tell me about something you taught yourself recently that relates to ${t[3]}.`, 'What, why, how long, what you made with it.', ['learned', 'self', 'project', 'resource', 'applied']),
    q('behavioral', `What is your biggest weakness for this ${R} path, and what are you doing about it right now?`, 'Real weakness, real action, honest progress.', ['weakness', 'improving', 'practice', 'progress']),
  ]
  const wantTech = Math.round(count * (st.mix.technical / (st.mix.technical + st.mix.behavioral)))
  const tech = pool.filter((p) => p.category === 'technical')
  const rest = pool.filter((p) => p.category !== 'technical')
  const out = [pool[0], ...tech.slice(0, Math.max(1, wantTech)), ...rest.slice(1)]
  const picked = []
  for (const p of out) if (!picked.includes(p)) picked.push(p)
  return picked.slice(0, count)
}
