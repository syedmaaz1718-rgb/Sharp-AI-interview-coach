import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { api, clientId, setAuthToken, getAuthToken } from './api.js'

const Ctx = createContext({ user: null, ready: true, signIn: async () => {}, signOut: async () => {} })
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(!getAuthToken())

  useEffect(() => {
    if (!getAuthToken()) return
    api.me().then((r) => setUser(r.user)).catch(() => setAuthToken(null)).finally(() => setReady(true))
  }, [])

  const signIn = useCallback(async (credential) => {
    const r = await api.googleLogin(credential, clientId())
    setAuthToken(r.token)
    setUser(r.user)
    return r.user
  }, [])
  const signOut = useCallback(async () => {
    try { await api.logout() } catch {}
    setAuthToken(null)
    setUser(null)
  }, [])

  return <Ctx.Provider value={{ user, ready, signIn, signOut }}>{children}</Ctx.Provider>
}

// Google Identity Services script, loaded once on demand.
let gsiPromise = null
export function loadGsi() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google)
  if (gsiPromise) return gsiPromise
  gsiPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = () => resolve(window.google)
    s.onerror = () => { gsiPromise = null; reject(new Error('Could not load Google sign-in. Check your connection or ad blocker.')) }
    document.head.appendChild(s)
  })
  return gsiPromise
}
