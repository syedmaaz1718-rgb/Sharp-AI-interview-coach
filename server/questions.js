// Seeded question bank. role: 'all' questions appear for every role.
// keywords: ideas a good answer usually touches (used by the heuristic scorer).
import { EXTRA_ROLES, EXTRA_QUESTIONS } from './roles_extra.js'
const Q = (id, role, category, text, keywords, tip) => ({ id, role, category, text, keywords, tip })

const BASE_ROLES = [
  { id: 'general', group: 'Everyone', icon: 'user', label: 'General / HR', blurb: 'Behavioral questions every internship interview asks' },
  { id: 'sde', group: 'Engineering', icon: 'code', label: 'Software Engineer', blurb: 'DSA, OOP, projects, problem solving' },
  { id: 'data', group: 'Data & Security', icon: 'data', label: 'Data / ML', blurb: 'ML basics, metrics, data cleaning, projects' },
  { id: 'frontend', group: 'Engineering', icon: 'layout', label: 'Frontend / Web', blurb: 'React, browser, performance, APIs' },
]

const BASE_QUESTIONS = [
  // intro (shown first)
  Q('i1', 'all', 'intro', 'Tell me about yourself.', ['student', 'project', 'skill', 'interest', 'internship', 'learn', 'building', 'looking'], 'Present, past, future in 60 seconds: what you study, what you built, what you want next.'),
  Q('i2', 'all', 'intro', 'Walk me through your resume in two minutes.', ['project', 'skill', 'internship', 'experience', 'education', 'built', 'learned'], 'Pick 2 highlights, not every line.'),
  Q('i3', 'all', 'intro', 'Why should we hire you as an intern?', ['learn', 'skill', 'project', 'contribute', 'quickly', 'passion', 'team', 'value'], 'Connect one skill to one thing the team needs.'),

  // behavioral (all roles)
  Q('b1', 'all', 'behavioral', 'Tell me about a time you faced a difficult challenge in a project and how you handled it.', ['challenge', 'problem', 'solution', 'learned', 'team', 'deadline', 'result'], 'STAR: one specific story with a result.'),
  Q('b2', 'all', 'behavioral', 'Describe a time you disagreed with a teammate. What happened?', ['disagree', 'listen', 'compromise', 'discuss', 'outcome', 'respect', 'goal'], 'Show you listened and focused on the goal, not on winning.'),
  Q('b3', 'all', 'behavioral', 'Tell me about a time you failed. What did you learn?', ['failed', 'mistake', 'learned', 'changed', 'next time', 'responsibility', 'improved'], 'Own the mistake, then show what you changed.'),
  Q('b4', 'all', 'behavioral', 'Describe a time you had to learn something new very quickly.', ['learn', 'quickly', 'documentation', 'practice', 'tutorial', 'built', 'deadline', 'result'], 'Show your learning method, not just the topic.'),
  Q('b5', 'all', 'behavioral', 'Tell me about a time you led a team or took initiative.', ['lead', 'initiative', 'team', 'organized', 'decided', 'result', 'responsibility', 'motivated'], 'Initiative does not need a title. Pick a hackathon or class project.'),
  Q('b6', 'all', 'behavioral', 'How do you handle tight deadlines and multiple tasks?', ['prioritize', 'plan', 'deadline', 'schedule', 'communicate', 'important', 'break down', 'focus'], 'Give a real example of how you prioritised.'),
  Q('b7', 'all', 'behavioral', 'Tell me about a project you are most proud of.', ['built', 'project', 'challenge', 'users', 'deployed', 'learned', 'result', 'impact'], 'Say what you built, one hard problem, and one number.'),
  Q('b8', 'all', 'behavioral', 'Describe a time you received critical feedback. How did you react?', ['feedback', 'listened', 'improved', 'changed', 'accepted', 'learned', 'result'], 'Show you changed something after the feedback.'),
  Q('b9', 'all', 'situational', 'Your teammate is not delivering their part and the deadline is close. What do you do?', ['talk', 'help', 'understand', 'communicate', 'deadline', 'escalate', 'support', 'plan'], 'Talk to them first, then escalate only if needed.'),
  Q('b10', 'all', 'situational', 'You are stuck on a bug for hours with no progress. What is your approach?', ['debug', 'reproduce', 'logs', 'google', 'ask', 'break down', 'break', 'isolate', 'rubber duck', 'documentation'], 'Show a method: reproduce, isolate, search, then ask.'),
  Q('b11', 'all', 'behavioral', 'Where do you see yourself in five years?', ['learn', 'grow', 'skill', 'engineer', 'contribute', 'responsibility', 'goal', 'lead'], 'Be honest and tie it to learning and impact.'),
  Q('b12', 'all', 'behavioral', 'Why do you want to work in tech, and why this kind of role?', ['passion', 'build', 'problem', 'interest', 'impact', 'learn', 'curious', 'project'], 'Start with a real moment that got you into tech.'),

  // sde
  Q('s1', 'sde', 'technical', 'Explain the difference between an array and a linked list. When would you use each?', ['array', 'linked list', 'memory', 'index', 'insert', 'delete', 'o(1)', 'o(n)', 'contiguous', 'pointer'], 'Compare access, insertion, memory layout.'),
  Q('s2', 'sde', 'technical', 'What is a hash map and how does it handle collisions?', ['hash', 'key', 'collision', 'chaining', 'open addressing', 'bucket', 'o(1)', 'load factor'], 'Mention hashing, collisions, average vs worst case.'),
  Q('s3', 'sde', 'technical', 'Explain the four pillars of object-oriented programming with an example.', ['encapsulation', 'inheritance', 'polymorphism', 'abstraction', 'class', 'object', 'example'], 'Use one running example, like Vehicle or Shape.'),
  Q('s4', 'sde', 'technical', 'What is the difference between a process and a thread?', ['process', 'thread', 'memory', 'shared', 'context switch', 'concurrency', 'stack', 'isolated'], 'Memory sharing is the key difference.'),
  Q('s5', 'sde', 'technical', 'How does binary search work and what is its time complexity?', ['sorted', 'middle', 'half', 'log', 'o(log n)', 'low', 'high', 'compare'], 'Say sorted input, halving, O(log n).'),
  Q('s6', 'sde', 'technical', 'What happens when you type a URL into the browser and press Enter?', ['dns', 'tcp', 'http', 'server', 'request', 'response', 'render', 'html', 'https', 'ip'], 'Walk through DNS, connection, request, response, render.'),
  Q('s7', 'sde', 'technical', 'Explain SQL vs NoSQL databases and when you would choose each.', ['sql', 'nosql', 'schema', 'relational', 'scale', 'join', 'document', 'consistency', 'transaction'], 'Talk about structure, consistency and scale.'),
  Q('s8', 'sde', 'technical', 'How would you find a cycle in a linked list?', ['slow', 'fast', 'pointer', 'floyd', 'hash', 'visited', 'o(1)', 'meet', 'tortoise'], 'Two pointers (Floyd) is the expected answer.'),
  Q('s9', 'sde', 'technical', 'What is recursion? What are its risks and how do you avoid them?', ['base case', 'recursion', 'stack', 'overflow', 'memoization', 'iteration', 'call', 'dynamic programming'], 'Base case, stack depth, memoization.'),
  Q('s10', 'sde', 'technical', 'What is a REST API? What do GET, POST, PUT and DELETE mean?', ['rest', 'api', 'get', 'post', 'put', 'delete', 'stateless', 'resource', 'status code', 'json'], 'Resources, verbs, stateless, status codes.'),

  // data / ML
  Q('d1', 'data', 'technical', 'Explain overfitting and how you would prevent it.', ['overfitting', 'training', 'validation', 'regularization', 'cross-validation', 'more data', 'dropout', 'generalize', 'test'], 'Train vs validation gap, then 2 or 3 fixes.'),
  Q('d2', 'data', 'technical', 'What is the difference between supervised and unsupervised learning? Give examples.', ['labeled', 'supervised', 'unsupervised', 'classification', 'regression', 'clustering', 'example', 'labels'], 'Labels are the key difference. Give one example each.'),
  Q('d3', 'data', 'technical', 'Precision vs recall: explain with an example and when each matters more.', ['precision', 'recall', 'false positive', 'false negative', 'f1', 'example', 'threshold', 'spam', 'disease'], 'Use a spam or disease example.'),
  Q('d4', 'data', 'technical', 'How do you handle missing values and outliers in a dataset?', ['missing', 'mean', 'median', 'drop', 'impute', 'outlier', 'iqr', 'z-score', 'domain', 'visualize'], 'Explain choices: drop, impute, cap, and why.'),
  Q('d5', 'data', 'technical', 'Explain the bias-variance tradeoff.', ['bias', 'variance', 'underfit', 'overfit', 'complexity', 'tradeoff', 'error', 'model'], 'Simple model: high bias. Complex model: high variance.'),
  Q('d6', 'data', 'technical', 'Walk me through how you would build a classification model from scratch.', ['data', 'clean', 'split', 'feature', 'train', 'evaluate', 'metric', 'baseline', 'tune', 'deploy'], 'Pipeline: data, features, baseline, evaluate, improve.'),
  Q('d7', 'data', 'technical', 'What is a confusion matrix and what can you read from it?', ['true positive', 'false positive', 'true negative', 'false negative', 'accuracy', 'precision', 'recall', 'matrix'], 'Name the four cells and what metrics come from them.'),
  Q('d8', 'data', 'technical', 'How does gradient descent work?', ['gradient', 'loss', 'learning rate', 'minimum', 'step', 'weights', 'iterate', 'derivative', 'converge'], 'Loss, gradient, learning rate, small steps downhill.'),

  // frontend
  Q('f1', 'frontend', 'technical', 'What is the virtual DOM in React and why does it help?', ['virtual dom', 'diff', 'reconciliation', 'render', 'update', 'real dom', 'performance', 'state'], 'Diffing and batching updates.'),
  Q('f2', 'frontend', 'technical', 'Explain useEffect and common mistakes people make with it.', ['useeffect', 'dependency', 'cleanup', 'render', 'side effect', 'infinite', 'array', 'mount'], 'Dependency array, cleanup, infinite loops.'),
  Q('f3', 'frontend', 'technical', 'What is the difference between let, const and var in JavaScript?', ['scope', 'hoisting', 'block', 'reassign', 'const', 'let', 'var', 'function scope'], 'Scope and hoisting.'),
  Q('f4', 'frontend', 'technical', 'How would you make a slow web page faster?', ['lazy', 'bundle', 'image', 'cache', 'cdn', 'lighthouse', 'minify', 'code splitting', 'render', 'network'], 'Measure first, then fix the biggest bottleneck.'),
  Q('f5', 'frontend', 'technical', 'Explain the CSS box model and the difference between flexbox and grid.', ['margin', 'padding', 'border', 'content', 'flexbox', 'grid', 'one dimension', 'two dimensional', 'layout', 'row'], 'Flexbox is 1D, grid is 2D.'),
  Q('f6', 'frontend', 'technical', 'What are promises and async/await? How do you handle errors?', ['promise', 'async', 'await', 'then', 'catch', 'try', 'asynchronous', 'callback', 'error', 'event loop'], 'Callbacks to promises to async/await, plus try/catch.'),
  Q('f7', 'frontend', 'technical', 'How do you make a website accessible and responsive?', ['accessibility', 'aria', 'semantic', 'keyboard', 'contrast', 'media query', 'responsive', 'mobile', 'alt', 'screen reader'], 'Semantic HTML, keyboard, contrast, media queries.'),
]

export function pickQuestions(role, count = 5, rng = Math.random) {
  const shuffle = (a) => a.map((x) => [rng(), x]).sort((x, y) => x[0] - y[0]).map((x) => x[1])
  const intro = shuffle(QUESTIONS.filter((q) => q.category === 'intro'))[0]
  const behavioral = shuffle(QUESTIONS.filter((q) => q.role === 'all' && q.category !== 'intro'))
  const technical = role === 'general' ? [] : shuffle(QUESTIONS.filter((q) => q.role === role))
  const n = Math.max(3, Math.min(12, count))
  const techCount = role === 'general' ? 0 : Math.ceil((n - 1) / 2)
  const behCount = n - 1 - techCount
  return [intro, ...behavioral.slice(0, behCount), ...technical.slice(0, techCount)]
}

export const publicQuestion = (q) => ({ id: q.id, category: q.category, text: q.text, tip: q.tip })
export const byId = (id) => QUESTIONS.find((q) => q.id === id)

const ORDER = ['Everyone', 'Engineering', 'Data & Security', 'Product & Design', 'Business']
export const ROLES = [...BASE_ROLES, ...EXTRA_ROLES].sort((a, b) => ORDER.indexOf(a.group) - ORDER.indexOf(b.group))
export const QUESTIONS = [...BASE_QUESTIONS, ...EXTRA_QUESTIONS]
