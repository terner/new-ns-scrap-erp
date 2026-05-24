'use client'

import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase'

export function AuthStatus() {
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = getSupabaseClient()

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false)
      return
    }

    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      setIsLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setIsLoading(false)
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [supabase])

  async function logout() {
    if (!supabase) return
    await supabase.auth.signOut()
    setSession(null)
    router.push('/login')
  }

  if (isLoading) {
    return <span className="rounded-md px-3 py-1.5 text-sm text-slate-400">กำลังตรวจ session</span>
  }

  if (!session) {
    return (
      <Link className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100" href="/login">
        Login
      </Link>
    )
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="hidden max-w-48 truncate text-sm text-slate-600 sm:inline">{session.user.email}</span>
      <button className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100" type="button" onClick={logout}>
        Logout
      </button>
    </div>
  )
}
