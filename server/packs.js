// Company-style question packs. These are NOT official question lists and are not affiliated with
// any company. They are practice sets inspired by the interview styles and values each company
// describes publicly. Each pack has a "lens": the qualities a strong answer tends to show.
const Q = (id, category, text, keywords, tip) => ({ id, role: 'pack', category, text, keywords, tip })

export const PACKS = [
  {
    id: 'amazon',
    rounds: [{ name: 'Online assessment', what: 'Coding and a work-style assessment' },{ name: 'Phone screen', what: 'One technical or behavioral conversation' },{ name: 'Interview loop', what: 'Several back-to-back rounds, each probing leadership principles with follow-up questions' }],
    name: 'Amazon style',
    tagline: 'Leadership-principles behavioral stories with data',
    flavor: 'Heavy on behavioral stories. Interviewers probe each story for ownership, customer impact and numbers, and keep asking "what did YOU do?".',
    lens: [
      { name: 'Customer obsession', lookFor: 'Start from what the customer or user needed.', keywords: ['customer', 'user', 'client', 'feedback', 'needs'] },
      { name: 'Ownership', lookFor: 'Show you took responsibility beyond your task.', keywords: ['owned', 'ownership', 'responsible', 'end to end', 'took charge', 'took responsibility'] },
      { name: 'Dive deep', lookFor: 'Use data, logs or root-cause analysis.', keywords: ['data', 'root cause', 'metric', 'logs', 'analyzed', 'investigated', 'measured'] },
      { name: 'Bias for action', lookFor: 'Show you moved fast with imperfect information.', keywords: ['quickly', 'decided', 'shipped', 'launched', 'prototype', 'deadline', 'immediately'] },
      { name: 'Deliver results', lookFor: 'Close every story with a measurable result.', keywords: ['result', 'delivered', 'improved', 'reduced', 'increased', 'saved', '%'] },
    ],
    questions: [
      Q('am1', 'behavioral', 'Tell me about a time you took ownership of something that was not your responsibility.', ['owned', 'responsible', 'result', 'initiative', 'customer', 'team'], 'Show why nobody else was handling it and what you delivered.'),
      Q('am2', 'behavioral', 'Describe a time you used data to make a decision or change your mind.', ['data', 'metric', 'analyzed', 'decision', 'result', 'changed'], 'Name the data, what it showed, and what you did differently.'),
      Q('am3', 'behavioral', 'Tell me about a time you went above and beyond for a customer or user.', ['customer', 'user', 'feedback', 'needs', 'extra', 'result'], 'Customer first, then your actions, then the outcome.'),
      Q('am4', 'behavioral', 'Give an example of a time you had to deliver under a very tight deadline.', ['deadline', 'prioritize', 'scope', 'delivered', 'tradeoff', 'result'], 'Explain what you cut, what you protected, and the result.'),
      Q('am5', 'behavioral', 'Tell me about a time you simplified a complicated process or system.', ['simplified', 'process', 'complex', 'automated', 'reduced', 'result', 'time'], 'Quantify the time or effort saved.'),
      Q('am6', 'behavioral', 'Describe a time you disagreed with your team and still committed to the final decision.', ['disagreed', 'data', 'listened', 'committed', 'decision', 'result'], 'Disagree with data, then commit fully.'),
      Q('am7', 'behavioral', 'Tell me about a time you failed. What did you change afterwards?', ['failed', 'mistake', 'root cause', 'learned', 'changed', 'process'], 'Own it, find the root cause, show the fix that stuck.'),
      Q('am8', 'technical', 'How would you design a simple URL shortener? Walk me through the main pieces.', ['hash', 'database', 'redirect', 'unique', 'scale', 'cache', 'collision', 'key'], 'Requirements first, then API, storage, scaling.'),
    ],
  },
  {
    id: 'flipkart',
    rounds: [{ name: 'Online coding round', what: 'Data structures and algorithms problems' },{ name: 'Technical rounds', what: 'Problem solving and design discussion' },{ name: 'Hiring manager round', what: 'Projects, ownership and fit' }],
    name: 'Flipkart style',
    tagline: 'E-commerce scale, ownership and strong problem solving',
    flavor: 'Mix of problem solving, e-commerce thinking and ownership. Expect "how would this behave at big-sale scale?" follow-ups.',
    lens: [
      { name: 'Scale thinking', lookFor: 'Mention load, peak traffic, caching or failure cases.', keywords: ['scale', 'traffic', 'load', 'cache', 'peak', 'concurrent', 'millions', 'queue'] },
      { name: 'Customer sense', lookFor: 'Tie decisions to the shopper experience.', keywords: ['customer', 'user', 'shopper', 'experience', 'conversion', 'delivery'] },
      { name: 'Ownership', lookFor: 'Show you drove the work to the end.', keywords: ['owned', 'responsible', 'end to end', 'drove', 'led', 'took'] },
      { name: 'Problem solving', lookFor: 'Break the problem down and compare options.', keywords: ['approach', 'tradeoff', 'alternative', 'complexity', 'break down', 'edge case'] },
    ],
    questions: [
      Q('fk1', 'technical', 'How would you design the cart and checkout for an e-commerce app that must handle a big-sale traffic spike?', ['cache', 'queue', 'inventory', 'scale', 'database', 'concurrent', 'consistency', 'load'], 'Inventory consistency and peak load are the heart of this.'),
      Q('fk2', 'technical', 'How would you make sure two customers cannot buy the last item in stock at the same time?', ['transaction', 'lock', 'inventory', 'atomic', 'concurrent', 'database', 'reserve', 'race'], 'Talk about atomic updates, transactions or reservations.'),
      Q('fk3', 'technical', 'How would you build search suggestions for a product catalogue?', ['prefix', 'trie', 'index', 'popular', 'cache', 'latency', 'ranking', 'typo'], 'Prefix matching, ranking and latency.'),
      Q('fk4', 'behavioral', 'Tell me about a time you owned a project end to end, from idea to launch.', ['owned', 'planned', 'built', 'launched', 'users', 'result', 'learned'], 'Cover idea, build, launch and what users did.'),
      Q('fk5', 'behavioral', 'Describe a time you made a decision with incomplete information.', ['assumption', 'decided', 'risk', 'data', 'result', 'learned', 'validate'], 'State your assumptions and how you checked them later.'),
      Q('fk6', 'technical', 'Given an array of prices over days, how would you find the best day to buy and sell once?', ['minimum', 'maximum', 'one pass', 'o(n)', 'profit', 'track', 'loop', 'brute force'], 'Brute force first, then the O(n) one-pass idea.'),
      Q('fk7', 'behavioral', 'Tell me about a time you improved something that users or teammates relied on.', ['improved', 'feedback', 'metric', 'users', 'result', 'before', 'after'], 'Give before and after numbers.'),
      Q('fk8', 'situational', 'Delivery times in your app suddenly got worse after a release. How do you investigate?', ['logs', 'metrics', 'rollback', 'compare', 'release', 'monitor', 'root cause', 'hypothesis'], 'Check what changed, roll back if needed, then find the root cause.'),
    ],
  },
  {
    id: 'google',
    rounds: [{ name: 'Phone or video screen', what: 'Coding and problem solving' },{ name: 'Onsite or virtual loop', what: 'Coding, system design for experienced roles, and a behavioral round' },{ name: 'Hiring review', what: 'Feedback from all rounds is reviewed together' }],
    name: 'Google style',
    tagline: 'Structured problem solving and thinking out loud',
    flavor: 'Interviewers care how you think: clarify the problem, talk through options and complexity, test your idea. Collaboration and humility count too.',
    lens: [
      { name: 'Clarifies the problem', lookFor: 'Ask or state assumptions before solving.', keywords: ['assume', 'assumption', 'clarify', 'constraint', 'input', 'edge case', 'requirements'] },
      { name: 'Compares approaches', lookFor: 'Mention a simple approach, then a better one.', keywords: ['brute force', 'optimize', 'tradeoff', 'alternative', 'better approach', 'instead'] },
      { name: 'Complexity awareness', lookFor: 'State time and space complexity.', keywords: ['o(n', 'o(1', 'o(log', 'complexity', 'time', 'space'] },
      { name: 'Collaboration', lookFor: 'Show you work well with others and learn from them.', keywords: ['team', 'collaborat', 'feedback', 'learned', 'together', 'listened'] },
    ],
    questions: [
      Q('go1', 'technical', 'How would you check whether a string is a palindrome? Then, how would you handle punctuation and capital letters?', ['two pointers', 'reverse', 'o(n)', 'lowercase', 'alphanumeric', 'edge case', 'compare'], 'Clarify the input, then the two-pointer approach.'),
      Q('go2', 'technical', 'You have a very large file of numbers that does not fit in memory. How do you find the top 10 largest?', ['heap', 'min heap', 'chunk', 'stream', 'memory', 'o(n log k)', 'sort', 'k'], 'A min-heap of size 10 while streaming is the classic answer.'),
      Q('go3', 'technical', 'How would you detect duplicates in a list? Compare a few approaches.', ['hash', 'set', 'sort', 'o(n)', 'brute force', 'space', 'tradeoff'], 'Brute force, sort, hash set, and the tradeoffs.'),
      Q('go4', 'technical', 'Explain how you would find the shortest path between two nodes in an unweighted graph.', ['bfs', 'breadth first', 'queue', 'visited', 'level', 'o(v+e)', 'path'], 'BFS with a visited set.'),
      Q('go5', 'behavioral', 'Tell me about a time you worked with someone whose approach was very different from yours.', ['different', 'listened', 'compromise', 'learned', 'result', 'team', 'respect'], 'Show curiosity, not conflict.'),
      Q('go6', 'behavioral', 'Describe a problem you solved that did not have an obvious solution.', ['problem', 'tried', 'approach', 'experiment', 'learned', 'solution', 'result'], 'Walk through the options you tried, including dead ends.'),
      Q('go7', 'behavioral', 'Tell me about something you built or learned entirely on your own initiative.', ['curious', 'learned', 'built', 'myself', 'project', 'resources', 'result'], 'What made you start and what changed afterwards.'),
      Q('go8', 'situational', 'You find that a feature you shipped has a bug affecting a small number of users. What do you do?', ['reproduce', 'impact', 'fix', 'communicate', 'rollback', 'test', 'postmortem', 'users'], 'Assess impact, fix, communicate, prevent.'),
    ],
  },
  {
    id: 'microsoft',
    rounds: [{ name: 'Recruiter and screen', what: 'Background and basic technical check' },{ name: 'Interview loop', what: 'Coding, design and behavioral conversations' },{ name: 'As-appropriate round', what: 'Often with a senior manager' }],
    name: 'Microsoft style',
    tagline: 'Growth mindset, collaboration and solid fundamentals',
    flavor: 'Friendly but thorough. Looks for growth mindset, working with others, and clear explanations of CS fundamentals and design choices.',
    lens: [
      { name: 'Growth mindset', lookFor: 'Show learning from mistakes and feedback.', keywords: ['learned', 'feedback', 'improve', 'mistake', 'grew', 'curious', 'growth'] },
      { name: 'Collaboration', lookFor: 'Show you lift up teammates.', keywords: ['team', 'together', 'helped', 'shared', 'collaborat', 'mentored'] },
      { name: 'Clear explanation', lookFor: 'Explain simply with an example.', keywords: ['for example', 'for instance', 'simple', 'because', 'imagine', 'so that'] },
      { name: 'Impact', lookFor: 'Say who benefited and by how much.', keywords: ['impact', 'users', 'result', 'improved', 'saved', 'benefit', '%'] },
    ],
    questions: [
      Q('ms1', 'behavioral', 'Tell me about a time you learned something from a mistake and applied it later.', ['mistake', 'learned', 'applied', 'changed', 'feedback', 'result', 'next time'], 'Show the lesson being used the second time.'),
      Q('ms2', 'behavioral', 'Describe a time you helped a teammate succeed.', ['helped', 'teammate', 'mentored', 'shared', 'together', 'result', 'team'], 'Focus on their outcome, not your credit.'),
      Q('ms3', 'technical', 'Explain the difference between a stack and a queue, and give real examples of each.', ['stack', 'queue', 'lifo', 'fifo', 'push', 'pop', 'enqueue', 'example', 'undo'], 'LIFO vs FIFO, with a real example each.'),
      Q('ms4', 'technical', 'How would you reverse a linked list? Explain the steps and the complexity.', ['pointer', 'previous', 'next', 'iterate', 'o(n)', 'o(1)', 'head', 'reverse'], 'Three pointers, one pass.'),
      Q('ms5', 'technical', 'What is the difference between an abstract class and an interface? When would you pick each?', ['abstract', 'interface', 'inherit', 'implement', 'contract', 'multiple', 'default', 'example'], 'Contract vs partial implementation.'),
      Q('ms6', 'behavioral', 'Tell me about a time you got feedback that was hard to hear.', ['feedback', 'listened', 'hard', 'changed', 'improved', 'result', 'learned'], 'Show you acted on it.'),
      Q('ms7', 'situational', 'A teammate keeps submitting code with bugs. How do you approach it?', ['talk', 'private', 'review', 'help', 'pair', 'tests', 'support', 'respect'], 'Support first, process second.'),
      Q('ms8', 'technical', 'How would you design a to-do list app used by millions of people? Keep it simple.', ['database', 'api', 'user', 'sync', 'scale', 'cache', 'authentication', 'mobile'], 'Start with core features, then scale.'),
    ],
  },
  {
    id: 'tcs',
    rounds: [{ name: 'Online test', what: 'Aptitude, reasoning and coding' },{ name: 'Technical interview', what: 'Programming basics and your project' },{ name: 'Managerial and HR rounds', what: 'Communication, relocation and attitude' }],
    name: 'TCS Ninja style',
    tagline: 'Fresher hiring: technical basics, project and HR round',
    flavor: 'Fresher-focused. Interviewers commonly check programming basics, your academic project, willingness to relocate and learn, and communication.',
    lens: [
      { name: 'Fundamentals', lookFor: 'Explain basic concepts clearly with a small example.', keywords: ['example', 'for instance', 'because', 'difference', 'used for', 'syntax'] },
      { name: 'Project depth', lookFor: 'Know your own project end to end.', keywords: ['project', 'built', 'module', 'database', 'my role', 'technology', 'result'] },
      { name: 'Learning attitude', lookFor: 'Show you are willing to learn and adapt.', keywords: ['learn', 'adapt', 'training', 'new', 'improve', 'practice', 'course'] },
      { name: 'Communication', lookFor: 'Answer clearly and honestly.', keywords: ['team', 'explained', 'communicated', 'presented', 'discussed', 'clear'] },
    ],
    questions: [
      Q('tc1', 'technical', 'What is the difference between an array and a linked list? When would you use each?', ['array', 'linked list', 'memory', 'index', 'insert', 'delete', 'traversal', 'access'], 'Compare access, insertion and memory with one use case each.'),
      Q('tc2', 'technical', 'Explain object-oriented programming. What are its four main principles?', ['encapsulation', 'inheritance', 'polymorphism', 'abstraction', 'class', 'object', 'example'], 'Name all four and give one tiny example.'),
      Q('tc3', 'technical', 'What is a primary key and what is a foreign key in a database?', ['unique', 'table', 'reference', 'relationship', 'null', 'join', 'key', 'row'], 'Define each, then show how two tables connect.'),
      Q('tc4', 'behavioral', 'Explain your final year or academic project. What was your own role?', ['project', 'built', 'role', 'technology', 'database', 'team', 'problem', 'result'], 'Problem, your part, tools, result.'),
      Q('tc5', 'behavioral', 'Are you comfortable relocating and working in shifts if the project needs it? Why?', ['relocate', 'flexible', 'ready', 'learn', 'adapt', 'family', 'growth', 'project'], 'Be honest. Give a reason, not just yes.'),
      Q('tc6', 'behavioral', 'Tell me about a time you learned something new on your own under a deadline.', ['learned', 'deadline', 'practice', 'resource', 'built', 'result', 'time'], 'Show method and outcome.'),
      Q('tc7', 'situational', 'You are given a technology you have never used and one week to deliver a small task. What do you do?', ['learn', 'documentation', 'ask', 'plan', 'prototype', 'mentor', 'deliver', 'time'], 'Plan, learn fast, ask early, deliver.'),
      Q('tc8', 'behavioral', 'Why do you want to join a large IT services company, and where do you see yourself in 3 years?', ['learn', 'growth', 'clients', 'skills', 'role', 'training', 'career', 'goal'], 'Tie your goal to what the company offers.'),
    ],
  },
  {
    id: 'startup',
    rounds: [{ name: 'Intro call', what: 'Fit and motivation' },{ name: 'Practical task or technical chat', what: 'Build something or walk through past work' },{ name: 'Founder conversation', what: 'Ownership, speed and values' }],
    name: 'Startup style',
    tagline: 'Ownership, speed and wearing many hats',
    flavor: 'Small team, big scope. Interviewers want proof you ship fast, handle ambiguity, learn on your own, and care about the product.',
    lens: [
      { name: 'Ships fast', lookFor: 'Show you built and launched quickly.', keywords: ['shipped', 'launched', 'deployed', 'built', 'weekend', 'days', 'prototype', 'live'] },
      { name: 'Handles ambiguity', lookFor: 'Show you made progress without a clear spec.', keywords: ['unclear', 'ambiguous', 'figured out', 'no spec', 'assumption', 'experiment', 'iterate'] },
      { name: 'Self-learner', lookFor: 'Show you learn new tools quickly alone.', keywords: ['learned', 'taught myself', 'documentation', 'tutorial', 'self', 'on my own'] },
      { name: 'Product sense', lookFor: 'Care about users, not only code.', keywords: ['user', 'product', 'feedback', 'customer', 'feature', 'usage'] },
    ],
    questions: [
      Q('st1', 'behavioral', 'Tell me about something you built and shipped quickly. What did you cut to make it happen?', ['shipped', 'built', 'cut', 'scope', 'deployed', 'users', 'days', 'result'], 'Name the trade-offs you made on purpose.'),
      Q('st2', 'behavioral', 'Describe a time you had to figure something out with no clear instructions.', ['unclear', 'figured', 'research', 'experiment', 'asked', 'result', 'learned'], 'Show your process for making progress.'),
      Q('st3', 'behavioral', 'What is a skill you taught yourself recently, and how did you do it?', ['learned', 'taught', 'documentation', 'project', 'practice', 'built', 'result'], 'Method plus a proof project.'),
      Q('st4', 'situational', 'You are the only engineer on a feature and the launch is in three days, but it is only 60 percent done. What do you do?', ['prioritize', 'scope', 'cut', 'mvp', 'communicate', 'launch', 'risk', 'core'], 'Cut scope, protect the core, communicate early.'),
      Q('st5', 'behavioral', 'How do you decide what to build first when everything seems important?', ['prioritize', 'impact', 'users', 'effort', 'data', 'feedback', 'mvp'], 'Use impact vs effort and user need.'),
      Q('st6', 'technical', 'You need a backend for a prototype by tomorrow. What would you pick and why?', ['simple', 'framework', 'database', 'deploy', 'free', 'tradeoff', 'fast', 'familiar'], 'Pick what you know and can deploy today.'),
      Q('st7', 'behavioral', 'Tell me about a project where you handled design, code and deployment yourself.', ['design', 'frontend', 'backend', 'deployed', 'myself', 'learned', 'users', 'project'], 'Show range across the stack.'),
      Q('st8', 'behavioral', 'Why do you want to join a small, early-stage team instead of a big company?', ['learn', 'ownership', 'impact', 'fast', 'responsibility', 'product', 'growth'], 'Be honest and specific.'),
    ],
  },
]

export const DISCLAIMER = 'Simulated from commonly reported public interview patterns. These are not official questions or the company\'s actual questions, rounds can vary by role and year, and SharpAI is not affiliated with or endorsed by any company.'
export const packById = (id) => PACKS.find((p) => p.id === id)
export const publicPack = (p) => ({ id: p.id, name: p.name, tagline: p.tagline, flavor: p.flavor, rounds: p.rounds || [], lens: p.lens.map((l) => ({ name: l.name, lookFor: l.lookFor })), questionCount: p.questions.length })

// Checks which lens qualities show up across all answers (simple keyword coverage).
export function lensCoverage(pack, transcripts) {
  const text = ' ' + transcripts.join(' ').toLowerCase() + ' '
  return pack.lens.map((l) => ({ name: l.name, lookFor: l.lookFor, hit: l.keywords.some((k) => text.includes(k.toLowerCase())) }))
}

export function pickPackQuestions(pack, intro, count = 5, rng = Math.random) {
  const shuffled = pack.questions.map((x) => [rng(), x]).sort((a, b) => a[0] - b[0]).map((x) => x[1])
  return [intro, ...shuffled.slice(0, Math.max(2, Math.min(12, count) - 1))]
}
