import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, type AuthUser } from './api'

type AuthState = {
  user: AuthUser | null
  needsSetup: boolean
  ready: boolean
  setUser: (u: AuthUser | null) => void
  logout: () => Promise<void>
}

const AuthCtx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [ready, setReady] = useState(false)

  const refresh = useCallback(() => {
    api.get<{ needs_setup: boolean; user: AuthUser | null }>('/auth/status')
      .then((s) => { setUser(s.user); setNeedsSetup(s.needs_setup) })
      .catch(() => setUser(null))
      .finally(() => setReady(true))
  }, [])

  useEffect(() => {
    refresh()
    const onExpired = () => setUser(null)
    window.addEventListener('auth:expired', onExpired)
    return () => window.removeEventListener('auth:expired', onExpired)
  }, [refresh])

  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => {})
    setUser(null)
  }, [])

  const set = useCallback((u: AuthUser | null) => { setUser(u); if (u) setNeedsSetup(false) }, [])

  return <AuthCtx.Provider value={{ user, needsSetup, ready, setUser: set, logout }}>{children}</AuthCtx.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
