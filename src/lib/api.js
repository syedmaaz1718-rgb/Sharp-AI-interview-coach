const KEY = 'coach_client_id'
export function clientId() {
  let id = localStorage.getItem(KEY)
  if (!id || !/^[A-Za-z0-9_-]{8,64}$/.test(id)) {
    const a = new Uint8Array(12)
    crypto.getRandomValues(a)
    id = 'c_' + Array.from(a, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 30)
    localStorage.setItem(KEY, id)
  }
  return id
}

const TOKEN_KEY = 'sharpai_token'
export const getAuthToken = () => { try { return localStorage.getItem(TOKEN_KEY) } catch { return null } }
export const setAuthToken = (t) => { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY) } catch {} }

async function req(method, url, body) {
  let res
  try {
    const headers = {}
    if (body) headers['content-type'] = 'application/json'
    const tk = getAuthToken()
    if (tk) headers.authorization = 'Bearer ' + tk
    res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined })
  } catch {
    throw new Error('Cannot reach the server. If the app was idle, the free server may be waking up - wait 30 seconds and retry.')
  }
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`)
  return json
}

export const api = {
  me: () => req('GET', '/api/auth/me'),
  googleLogin: (credential, guestClientId) => req('POST', '/api/auth/google', { credential, guestClientId }),
  logout: () => req('POST', '/api/auth/logout', {}),
  config: () => req('GET', '/api/config'),
  startSession: (opts) => req('POST', '/api/sessions', { clientId: clientId(), ...opts }),
  tailoredQuestions: (payload) => req('POST', '/api/tailored-questions', payload),
  companies: () => req('GET', '/api/companies'),
  companyQuestions: (payload) => req('POST', '/api/company-questions', payload),
  resumeQuestions: (resume, role, count) => req('POST', '/api/resume-questions', { resume, role, count }),
  answer: (id, payload) => req('POST', `/api/sessions/${id}/answers`, { clientId: clientId(), ...payload }),
  finish: (id, early) => req('POST', `/api/sessions/${id}/finish`, { clientId: clientId(), early: !!early }),
  report: (id) => req('GET', `/api/sessions/${id}`),
  questions: (role = 'general', count = 1) => req('GET', `/api/questions?role=${encodeURIComponent(role)}&count=${count}`),
  history: () => req('GET', `/api/history?clientId=${clientId()}`),
  gap: (jd, resume) => req('POST', '/api/gap', { jd, resume }),
  score: (id) => req('GET', `/api/sessions/${id}/score`),
  share: (id, body) => req('POST', `/api/sessions/${id}/share`, { clientId: clientId(), ...body }),
  hrRoles: () => req('GET', `/api/hr/roles?clientId=${clientId()}`),
  hrCreate: (b) => req('POST', '/api/hr/roles', { clientId: clientId(), ...b }),
  hrRole: (id) => req('GET', `/api/hr/roles/${id}?clientId=${clientId()}`),
  hrUpdateRole: (id, b) => req('PUT', `/api/hr/roles/${id}`, { clientId: clientId(), ...b }),
  hrDeleteRole: (id) => req('DELETE', `/api/hr/roles/${id}?clientId=${clientId()}`),
  hrScreening: (id, open) => req('POST', `/api/hr/roles/${id}/screening`, { clientId: clientId(), open }),
  hrAddCandidate: (id, name) => req('POST', `/api/hr/roles/${id}/candidates`, { clientId: clientId(), name }),
  hrCandidate: (cid) => req('GET', `/api/hr/candidates/${cid}?clientId=${clientId()}`),
  hrUpdateCandidate: (cid, b) => req('PUT', `/api/hr/candidates/${cid}`, { clientId: clientId(), ...b }),
  hrDeleteCandidate: (cid) => req('DELETE', `/api/hr/candidates/${cid}?clientId=${clientId()}`),
  hrSuggest: (id, b) => req('POST', `/api/hr/roles/${id}/suggest`, { clientId: clientId(), ...b }),
  screenInfo: (t) => req('GET', `/api/screen/${t}`),
  screenStart: (t, b) => req('POST', `/api/screen/${t}/start`, b),
  screenAnswer: (t, b) => req('POST', `/api/screen/${t}/answer`, b),
  screenFinish: (t, b) => req('POST', `/api/screen/${t}/finish`, b),
  battleCreate: (b) => req('POST', '/api/battles', b),
  battle: (t, key) => req('GET', `/api/battle/${t}${key ? '?key=' + encodeURIComponent(key) : ''}`),
  battleJoin: (t, name) => req('POST', `/api/battle/${t}/join`, { name }),
  battleAnswer: (t, b) => req('POST', `/api/battle/${t}/answer`, b),
  battleResult: (t, key) => req('GET', `/api/battle/${t}/result${key ? '?key=' + encodeURIComponent(key) : ''}`),
  rewind: (id, b) => req('POST', `/api/sessions/${id}/rewind`, { clientId: clientId(), ...b }),
  hrAudit: () => req('GET', `/api/hr/audit?clientId=${clientId()}`),
  hrCopilot: (id, b) => req('POST', `/api/hr/roles/${id}/copilot`, { clientId: clientId(), ...b }),
  passportGet: (id) => req('GET', `/api/sessions/${id}/passport?clientId=${clientId()}`),
  passportIssue: (id, name) => req('POST', `/api/sessions/${id}/passport`, { clientId: clientId(), name }),
  passportRevoke: (id) => req('DELETE', `/api/sessions/${id}/passport?clientId=${clientId()}`),
  remove: (id) => req('DELETE', `/api/sessions/${id}?clientId=${clientId()}`),
}
