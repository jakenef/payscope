import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)

function shapeUser(supaUser) {
  if (!supaUser) return null
  const meta = supaUser.user_metadata || {}
  const email = supaUser.email || ''
  const name =
    meta.name ||
    meta.full_name ||
    (email.split('@')[0] || 'You')
      .replace(/[._-]+/g, ' ')
      .split(' ')
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ')

  return {
    id: supaUser.id,
    email,
    name,
    plan: 'Free',
    specialty: meta.specialty || null,
    state: meta.state || null,
  }
}

const DEV_USER = { id: 'dev', email: 'dev@local', name: 'Dev User', plan: 'Free' }
const BYPASS = import.meta.env.VITE_DEV_BYPASS_AUTH === 'true'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(BYPASS ? DEV_USER : null)
  const [loading, setLoading] = useState(!BYPASS)

  useEffect(() => {
    if (BYPASS) return

    let mounted = true

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return
      setUser(shapeUser(session?.user))
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(shapeUser(session?.user))
    })

    return () => {
      mounted = false
      sub?.subscription?.unsubscribe()
    }
  }, [])

  const signIn = useCallback(async ({ email, password }) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  const signUp = useCallback(async ({ email, password, name, specialty, state }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, specialty, state } },
    })
    if (error) throw error
    // Supabase silently "succeeds" when an email already exists (security-by-obscurity).
    // The tell: the returned user has an empty identities array. Surface a real error.
    if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw new Error('An account with this email already exists. Sign in instead.')
    }
  }, [])

  const updateProfile = useCallback(async ({ specialty, state, name }) => {
    const { error } = await supabase.auth.updateUser({
      data: { specialty, state, ...(name !== undefined ? { name } : {}) },
    })
    if (error) throw error
  }, [])

  const updateEmail = useCallback(async (newEmail) => {
    const { error } = await supabase.auth.updateUser({ email: newEmail })
    if (error) throw error
  }, [])

  const updatePassword = useCallback(async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  return (
    <AuthContext.Provider value={{
      user, isAuthed: !!user, loading,
      signIn, signUp, signOut,
      updateProfile, updateEmail, updatePassword,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
