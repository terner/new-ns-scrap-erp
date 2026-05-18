'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { canAccessPath, navigationItems, navigationSections } from '@/lib/navigation'

type AppNavigationProps = {
  onNavigate?: () => void
}

export function AppNavigation({ onNavigate }: AppNavigationProps) {
  const pathname = usePathname()
  const [authContext, setAuthContext] = useState<{ isAdmin: boolean; permissions: string[] } | null>(null)

  useEffect(() => {
    let mounted = true

    async function loadAuthContext() {
      try {
        const response = await fetch('/api/auth/me', { cache: 'no-store' })
        const payload = await response.json().catch(() => null)

        if (mounted && response.ok) {
          setAuthContext({
            isAdmin: payload?.isAdmin === true,
            permissions: Array.isArray(payload?.permissions) ? payload.permissions : [],
          })
        }
      } catch {
        if (mounted) {
          setAuthContext({ isAdmin: false, permissions: [] })
        }
      }
    }

    void loadAuthContext()

    return () => {
      mounted = false
    }
  }, [])

  const visibleItems = useMemo(() => {
    if (!authContext) return navigationItems
    return navigationItems.filter((item) => canAccessPath(item.href, authContext))
  }, [authContext])

  return (
    <nav className="flex-1 overflow-y-auto py-3 text-sm" aria-label="Main navigation">
      {navigationSections.map((section) => {
        const items = visibleItems.filter((item) => item.section === section.key)
        if (!items.length) return null

        return (
          <div key={section.key}>
            <div className="px-4 pb-1 pt-4 text-xs uppercase tracking-wider text-slate-500">{section.label}</div>
            {items.map((item) => {
              const active = pathname === item.href

              return (
                <Link
                  key={item.href}
                  className={`flex w-full items-center gap-3 border-l-4 px-4 py-2 text-left transition hover:bg-slate-800 ${
                    active ? 'border-blue-500 bg-slate-800 text-white' : 'border-transparent text-slate-300'
                  }`}
                  href={item.href}
                  onClick={onNavigate}
                >
                  <span className="w-5 text-center">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </div>
        )
      })}
    </nav>
  )
}
