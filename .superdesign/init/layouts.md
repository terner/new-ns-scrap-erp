# Shared Layouts

The application uses a persistent desktop sidebar, top bar, breadcrumb/workspace content region, mobile bottom navigation, and light/dark theme toggle.

## `apps/next/src/app/layout.tsx`

```tsx
import type { Metadata, Viewport } from 'next'
import { AppShell } from '@/components/layout/AppShell'
import { ThemeProvider } from '@/components/theme-provider'
import './globals.css'

export const metadata: Metadata = {
  title: 'NS Scrap ERP',
  description: 'NS Scrap ERP Next.js application shell',
  icons: {
    icon: '/favicon.svg',
  },
}

export const viewport: Viewport = {
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  width: 'device-width',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="system" disableTransitionOnChange enableSystem>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  )
}

```

## `apps/next/src/components/layout/AppShell.tsx`

```tsx
'use client'

import type { FocusEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Menu, Search, X } from 'lucide-react'
import { AppNavigation } from '@/components/layout/AppNavigation'
import { AuthStatus } from '@/components/layout/AuthStatus'
import { MobileBottomNavigation } from '@/components/layout/MobileBottomNavigation'
import { ThemeModeToggle } from '@/components/layout/ThemeModeToggle'
import { breadcrumbsForPath, canAccessPath, navigationItems, navigationSections, pageTitleForPath, type NavigationItem } from '@/lib/navigation'

type AppShellProps = {
  children: React.ReactNode
}

type AuthContextSummary = {
  authUserEmail: string
  mustChangePassword: boolean
  permissions: string[]
  roles: Array<{ code: string; id: string; name: string }>
}

type MenuSearchResult = {
  href: string
  icon: string
  label: string
  parentLabel?: string
  sectionLabel: string
}

const PAGE_TITLE_EVENT = 'ns-scrap-erp-page-title'

function normalizeAuthRoles(value: unknown): AuthContextSummary['roles'] {
  if (!Array.isArray(value)) return []
  return value
    .map((role) => {
      if (!role || typeof role !== 'object') return null
      const candidate = role as Record<string, unknown>
      return typeof candidate.id === 'string'
        && typeof candidate.code === 'string'
        && typeof candidate.name === 'string'
        ? { code: candidate.code, id: candidate.id, name: candidate.name }
        : null
    })
    .filter((role): role is AuthContextSummary['roles'][number] => role !== null)
}

function flattenSearchItems(items: NavigationItem[], authContext: AuthContextSummary): MenuSearchResult[] {
  const sectionLabelByKey = new Map(navigationSections.map((section) => [section.key, section.label]))

  return items.flatMap((item) => {
    const visibleChildren = item.children?.filter((child) => canAccessPath(child.href, authContext)) ?? []
    const parentVisible = canAccessPath(item.href, authContext) || visibleChildren.length > 0
    if (!parentVisible) return []

    const sectionLabel = sectionLabelByKey.get(item.section) ?? item.section
    const parentResult: MenuSearchResult[] = !item.children?.length || canAccessPath(item.href, authContext)
      ? [{
          href: item.href,
          icon: item.icon,
          label: item.label,
          sectionLabel,
        }]
      : []

    const childResults = visibleChildren.map((child) => ({
      href: child.href,
      icon: child.icon,
      label: child.label,
      parentLabel: item.label,
      sectionLabel: sectionLabelByKey.get(child.section) ?? sectionLabel,
    }))

    return [...parentResult, ...childResults]
  })
}

export function AppShell({ children }: AppShellProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [desktopSidebarExpanded, setDesktopSidebarExpanded] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarUserMenuOpen, setSidebarUserMenuOpen] = useState(false)
  const [authContext, setAuthContext] = useState<AuthContextSummary | null>(null)
  const [authLoadError, setAuthLoadError] = useState<string | null>(null)
  const [breadcrumbLabelOverride, setBreadcrumbLabelOverride] = useState<string | null>(null)
  const [menuSearch, setMenuSearch] = useState('')
  const [menuSearchFocused, setMenuSearchFocused] = useState(false)
  const [titleOverride, setTitleOverride] = useState<string | null>(null)
  const lastActivityPathRef = useRef<string | null>(null)
  const title = titleOverride ?? pageTitleForPath(pathname)
  const breadcrumbs = breadcrumbsForPath(pathname)
  const renderedBreadcrumbs = breadcrumbLabelOverride && breadcrumbs.length > 0
    ? breadcrumbs.map((breadcrumb, index) => (index === breadcrumbs.length - 1 ? { ...breadcrumb, label: breadcrumbLabelOverride } : breadcrumb))
    : breadcrumbs
  const isAuthPage = pathname === '/login' || pathname === '/forgot-password' || pathname === '/reset-password'
  const showMobileBottomNav = !isAuthPage
  const menuSearchResults = useMemo(() => {
    const query = menuSearch.trim().toLowerCase()
    if (!query || !authContext) return []

    return flattenSearchItems(navigationItems, authContext)
      .filter((item) => `${item.label} ${item.href} ${item.parentLabel ?? ''} ${item.sectionLabel}`.toLowerCase().includes(query))
      .slice(0, 10)
  }, [authContext, menuSearch])
  const authStatusProfile = useMemo(() => ({
    roles: authContext?.roles ?? [],
    userEmail: authContext?.authUserEmail ?? '',
  }), [authContext])

  useEffect(() => {
    setBreadcrumbLabelOverride(null)
    setTitleOverride(null)
  }, [pathname])

  useEffect(() => {
    function handlePageTitle(event: Event) {
      const detail = (event as CustomEvent<{ breadcrumbLabel?: string | null; title?: string | null }>).detail
      const nextBreadcrumbLabel = detail?.breadcrumbLabel
      const nextTitle = detail?.title
      setBreadcrumbLabelOverride(nextBreadcrumbLabel || null)
      setTitleOverride(nextTitle || null)
    }

    window.addEventListener(PAGE_TITLE_EVENT, handlePageTitle)
    return () => window.removeEventListener(PAGE_TITLE_EVENT, handlePageTitle)
  }, [])

  useEffect(() => {
    if (isAuthPage || lastActivityPathRef.current === pathname) return
    lastActivityPathRef.current = pathname

    void fetch('/api/activity', {
      body: JSON.stringify({
        key: 'page.view',
        metadata: { pageTitle: title },
        referrer: document.referrer || null,
        routePath: pathname,
        title,
        type: 'page_view',
      }),
      cache: 'no-store',
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    }).catch(() => {
      // Activity logging is best-effort and must not block normal navigation.
    })
  }, [isAuthPage, pathname, title])

  useEffect(() => {
    if (isAuthPage) return

    let mounted = true

    async function loadAuthContext() {
      try {
        const response = await fetch('/api/auth/me', { cache: 'no-store', credentials: 'include' })
        const payload = await response.json().catch(() => null)

        if (mounted && response.ok) {
          setAuthLoadError(null)
          setAuthContext({
            authUserEmail: typeof payload?.authUser?.email === 'string' ? payload.authUser.email : '',
            mustChangePassword: payload?.appUser?.mustChangePassword === true,
            permissions: Array.isArray(payload?.permissions) ? payload.permissions : [],
            roles: normalizeAuthRoles(payload?.roles),
          })
        } else if (mounted && response.status === 401) {
          const redirect = `${pathname}${window.location.search}`
          router.replace(`/login?redirect=${encodeURIComponent(redirect)}`)
        } else if (mounted) {
          setAuthContext(null)
          setAuthLoadError(
            typeof payload?.error === 'string'
              ? payload.error
              : response.status === 403
                ? 'บัญชีนี้ไม่มีสิทธิ์ใช้งานระบบ'
                : 'โหลดข้อมูลบัญชีและสิทธิ์ไม่สำเร็จ',
          )
        }
      } catch {
        if (mounted) {
          setAuthContext(null)
          setAuthLoadError('เชื่อมต่อระบบบัญชีและสิทธิ์ไม่สำเร็จ')
        }
      }
    }

    void loadAuthContext()

    return () => {
      mounted = false
    }
  }, [isAuthPage, pathname, router])

  useEffect(() => {
    if (isAuthPage || pathname === '/admin/change-password') return
    if (authContext?.mustChangePassword === true) {
      router.replace(`/admin/change-password?redirect=${encodeURIComponent(pathname)}`)
    }
  }, [authContext?.mustChangePassword, isAuthPage, pathname, router])

  function handleSidebarBlur(event: FocusEvent<HTMLElement>) {
    if (event.currentTarget.contains(event.relatedTarget)) return
    if (sidebarUserMenuOpen) return
    setDesktopSidebarExpanded(false)
  }

  function handleSidebarMouseLeave() {
    if (sidebarUserMenuOpen) return
    setDesktopSidebarExpanded(false)
  }

  function handleMenuSearchBlur(event: FocusEvent<HTMLDivElement>) {
    if (event.currentTarget.contains(event.relatedTarget)) return
    setMenuSearchFocused(false)
  }

  function clearMenuSearch() {
    setMenuSearch('')
    setMenuSearchFocused(false)
  }

  if (isAuthPage) {
    return <div className="h-dvh overflow-y-auto bg-slate-100 text-slate-900">{children}</div>
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-slate-100 text-slate-900">
      <aside
        className={`${sidebarOpen ? 'fixed inset-0 z-50 flex w-full' : 'hidden'} flex-shrink-0 flex-col overflow-hidden bg-slate-900 text-slate-200 transition-[width] duration-200 ease-out lg:relative lg:flex ${desktopSidebarExpanded ? 'lg:w-64' : 'lg:w-16'}`}
        onBlur={handleSidebarBlur}
        onFocus={() => setDesktopSidebarExpanded(true)}
        onMouseEnter={() => setDesktopSidebarExpanded(true)}
        onMouseLeave={handleSidebarMouseLeave}
      >
        <div className={`flex min-h-[72px] items-center border-b border-slate-700 px-4 py-3.5 dark:border-[var(--ns-dark-border-strong)] ${desktopSidebarExpanded ? 'gap-5' : 'gap-3 lg:justify-center lg:gap-0'}`}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-blue-500 to-indigo-600 font-bold text-white">NS</div>
          <div className={`min-w-0 flex-1 pl-1 ${desktopSidebarExpanded ? '' : 'lg:hidden'}`.trim()}>
            <div className="truncate font-bold text-white">NS Scrap ERP</div>
            <div className="truncate text-xs text-slate-400">ระบบบริหารจัดการ</div>
          </div>
          <button
            aria-label="ปิดเมนู"
            className="ml-auto inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-700 bg-slate-800 text-slate-200 outline-none transition hover:bg-slate-700 focus:ring-2 focus:ring-blue-400/30 lg:hidden"
            type="button"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="relative border-b border-slate-800 p-3 lg:hidden" onBlur={handleMenuSearchBlur}>
          <label className="relative block">
            <span className="sr-only">ค้นหาเมนู</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
            <input
              className="h-9 w-full rounded-md border border-[#282828] bg-[#343434] pl-9 pr-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 disabled:cursor-wait disabled:text-slate-500"
              disabled={!authContext}
              placeholder={authContext ? 'ค้นหาเมนู...' : 'กำลังโหลดเมนู...'}
              type="search"
              value={menuSearch}
              onChange={(event) => {
                setMenuSearch(event.target.value)
                setMenuSearchFocused(true)
              }}
              onFocus={() => setMenuSearchFocused(true)}
            />
          </label>
          {menuSearchFocused && menuSearch.trim() ? (
            <div className="absolute left-3 right-3 top-full z-50 mt-2 max-h-[min(60vh,24rem)] overflow-y-auto rounded-md border border-slate-700 bg-slate-950 py-1 shadow-xl">
              {!authContext ? (
                <div className="px-3 py-4 text-center text-sm text-slate-400">กำลังโหลดเมนู</div>
              ) : menuSearchResults.length ? menuSearchResults.map((item) => (
                <Link
                  className="flex min-w-0 items-center gap-3 px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-800 hover:text-white focus:bg-slate-800 focus:outline-none"
                  href={item.href}
                  key={`${item.href}-${item.label}-mobile`}
                  onClick={() => {
                    clearMenuSearch()
                    setSidebarOpen(false)
                  }}
                >
                  <span className="w-5 shrink-0 text-center">{item.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{item.label}</span>
                    <span className="block truncate text-xs text-slate-500">{item.parentLabel ? `${item.parentLabel} / ` : ''}{item.sectionLabel}</span>
                  </span>
                </Link>
              )) : (
                <div className="px-3 py-4 text-center text-sm text-slate-400">ไม่พบเมนูที่ค้นหา</div>
              )}
            </div>
          ) : null}
        </div>

        <AppNavigation authContext={authContext} compact={!desktopSidebarExpanded} onNavigate={() => setSidebarOpen(false)} />
        <div className="border-t border-slate-800 p-2">
          <AuthStatus
            compact={!desktopSidebarExpanded}
            profile={authStatusProfile}
            variant="sidebar"
            onMenuOpenChange={(open) => {
              setSidebarUserMenuOpen(open)
              if (open) setDesktopSidebarExpanded(true)
            }}
          />
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex min-h-[72px] items-center justify-between border-b border-[#e2e8f0] bg-[#ffffff] px-4 py-3 text-slate-800 dark:border-[rgb(148_163_184_/_0.12)] dark:bg-[var(--ns-dark-surface-soft)] dark:text-[#e2e8f0] lg:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {!showMobileBottomNav && (
              <button
                aria-label="เปิดเมนู"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 dark:text-[#cbd5e1] dark:hover:bg-[#1e293b] dark:hover:text-white dark:focus-visible:ring-blue-400/50 lg:hidden"
                type="button"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                <Menu aria-hidden="true" className="h-7 w-7 stroke-[2.4]" />
              </button>
            )}
            <div className="min-w-0">
              <h1 className="min-w-0 break-words text-sm font-semibold leading-snug text-slate-800 dark:text-[#f8fafc] sm:text-base lg:text-lg">{title}</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative hidden w-[min(360px,38vw)] min-w-64 shrink-0 lg:block" onBlur={handleMenuSearchBlur}>
              <label className="relative block">
                <span className="sr-only">ค้นหาเมนู</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#64748b] dark:text-[#94a3b8]" />
                <input
                  className="h-9 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm text-[#172033] outline-none transition placeholder:text-[#64748b] disabled:cursor-wait disabled:text-[#64748b] dark:text-[#f1f5f9] dark:placeholder:text-[#94a3b8] dark:disabled:text-[#94a3b8]"
                  disabled={!authContext}
                  placeholder={authContext ? 'ค้นหาเมนู...' : 'กำลังโหลดเมนู...'}
                  type="search"
                  value={menuSearch}
                  onChange={(event) => {
                    setMenuSearch(event.target.value)
                    setMenuSearchFocused(true)
                  }}
                  onFocus={() => setMenuSearchFocused(true)}
                />
              </label>
              {menuSearchFocused && menuSearch.trim() ? (
                <div className="absolute right-0 top-full z-50 mt-2 max-h-[min(70vh,28rem)] w-full overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg shadow-slate-950/15 dark:border-[#334155] dark:bg-[#1e293b] dark:shadow-slate-950/35">
                  {!authContext ? (
                    <div className="px-3 py-4 text-center text-sm text-slate-500 dark:text-[#94a3b8]">กำลังโหลดเมนู</div>
                  ) : menuSearchResults.length ? menuSearchResults.map((item) => (
                    <Link
                      className="flex min-w-0 items-center gap-3 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 hover:text-slate-900 focus:bg-slate-100 focus:outline-none dark:text-[#e2e8f0] dark:hover:bg-[#334155] dark:hover:text-white dark:focus:bg-[#334155]"
                      href={item.href}
                      key={`${item.href}-${item.label}`}
                      onClick={clearMenuSearch}
                    >
                      <span className="w-5 shrink-0 text-center">{item.icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{item.label}</span>
                        <span className="block truncate text-xs text-slate-500 dark:text-[#94a3b8]">{item.parentLabel ? `${item.parentLabel} / ` : ''}{item.sectionLabel}</span>
                      </span>
                    </Link>
                  )) : (
                    <div className="px-3 py-4 text-center text-sm text-slate-500 dark:text-[#94a3b8]">ไม่พบเมนูที่ค้นหา</div>
                  )}
                </div>
              ) : null}
            </div>

            <ThemeModeToggle />
          </div>
        </header>

        {renderedBreadcrumbs.length > 0 ? (
          <nav aria-label="Breadcrumb" className="bg-slate-50 px-4 py-2 text-xs text-slate-500 lg:px-6">
            <ol className="flex min-w-0 flex-wrap items-center gap-1.5">
              {renderedBreadcrumbs.map((breadcrumb, index) => {
                const isLast = index === renderedBreadcrumbs.length - 1
                return (
                  <li className="flex min-w-0 items-center gap-1.5" key={`${breadcrumb.label}-${index}`}>
                    {breadcrumb.href && !isLast ? (
                      <Link className="max-w-52 truncate font-medium text-slate-600 hover:text-blue-700 hover:underline" href={breadcrumb.href}>
                        {breadcrumb.label}
                      </Link>
                    ) : (
                      <span className={isLast ? 'max-w-[36rem] truncate font-semibold text-slate-700' : 'max-w-52 truncate'}>{breadcrumb.label}</span>
                    )}
                    {!isLast ? <span className="text-slate-300">/</span> : null}
                  </li>
                )
              })}
            </ol>
          </nav>
        ) : null}

        <main className={`min-h-0 flex-1 overflow-y-auto p-4 lg:p-6 ${showMobileBottomNav ? 'pb-20 lg:pb-6' : ''}`}>
          {authLoadError ? (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900/70 dark:bg-red-950/50 dark:text-red-200" role="alert">
              {authLoadError}
            </div>
          ) : null}
          {children}
        </main>
      </div>
      {showMobileBottomNav && !sidebarOpen ? (
        <MobileBottomNavigation authContext={authContext} onOpenSidebar={() => setSidebarOpen(true)} />
      ) : null}
    </div>
  )
}

```

## `apps/next/src/components/layout/AppNavigation.tsx`

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { canAccessPath, navigationItems, navigationSections, sidebarNavigationPath, type NavigationSectionKey } from '@/lib/navigation'

type AppNavigationProps = {
  authContext: { permissions: string[] } | null
  compact?: boolean
  onNavigate?: () => void
}

const SIDEBAR_SCROLL_KEY = 'ns-scrap-erp-sidebar-scroll-top'

function normalizeNavigationPath(path: string) {
  return path.endsWith('/') && path !== '/' ? path.slice(0, -1) : path
}

function isNavigationPathActive(pathname: string, href: string) {
  const normalizedPath = normalizeNavigationPath(pathname)
  const normalizedHref = normalizeNavigationPath(href)
  return normalizedPath === normalizedHref || normalizedPath.startsWith(`${normalizedHref}/`)
}

export function AppNavigation({ authContext, compact = false, onNavigate }: AppNavigationProps) {
  const pathname = usePathname()
  const activePathname = sidebarNavigationPath(pathname)
  const navRef = useRef<HTMLElement | null>(null)
  const hasRestoredScrollRef = useRef(false)
  const manualSectionSelectionRef = useRef(false)
  const suppressScrollSaveRef = useRef(false)
  const lastActivePathnameRef = useRef(activePathname)
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null)
  const [expandedSection, setExpandedSection] = useState<NavigationSectionKey | null>(null)

  const visibleItems = useMemo(() => {
    if (!authContext) return []
    return navigationItems
      .map((item) => ({
        ...item,
        children: item.children?.filter((child) => canAccessPath(child.href, authContext)),
      }))
      .filter((item) => canAccessPath(item.href, authContext) || Boolean(item.children?.length))
  }, [authContext])

  useEffect(() => {
    if (lastActivePathnameRef.current !== activePathname) {
      lastActivePathnameRef.current = activePathname
      manualSectionSelectionRef.current = false
    }

    if (manualSectionSelectionRef.current) return

    const activeItem = visibleItems.find((item) => {
      if (isNavigationPathActive(activePathname, item.href)) return true
      return item.children?.some((child) => isNavigationPathActive(activePathname, child.href)) ?? false
    })

    if (!activeItem) return

    setExpandedSection(activeItem.section)
    setExpandedMenu(activeItem.children?.some((child) => isNavigationPathActive(activePathname, child.href)) ? activeItem.href : null)
  }, [activePathname, visibleItems])

  useEffect(() => {
    const nav = navRef.current
    if (!nav) return
    if (hasRestoredScrollRef.current) return
    hasRestoredScrollRef.current = true

    const savedScrollTop = window.sessionStorage.getItem(SIDEBAR_SCROLL_KEY)
    if (savedScrollTop === null) return

    const parsedScrollTop = Number(savedScrollTop)
    if (!Number.isFinite(parsedScrollTop)) return

    const frame = requestAnimationFrame(() => {
      suppressScrollSaveRef.current = true
      nav.scrollTop = parsedScrollTop
      requestAnimationFrame(() => {
        suppressScrollSaveRef.current = false
      })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    const nav = navRef.current
    if (!nav) return

    const frame = requestAnimationFrame(() => {
      const activeItem = nav.querySelector<HTMLElement>('[data-active-nav="true"]')
      if (!activeItem) return

      const navRect = nav.getBoundingClientRect()
      const activeRect = activeItem.getBoundingClientRect()
      const isVisible = activeRect.top >= navRect.top && activeRect.bottom <= navRect.bottom
      if (!isVisible) {
        suppressScrollSaveRef.current = true
        activeItem.scrollIntoView({ block: 'nearest' })
        requestAnimationFrame(() => {
          window.sessionStorage.setItem(SIDEBAR_SCROLL_KEY, String(nav.scrollTop))
          suppressScrollSaveRef.current = false
        })
      }
    })

    return () => window.cancelAnimationFrame(frame)
  }, [expandedMenu, expandedSection, pathname, visibleItems])

  function rememberSidebarScroll() {
    if (suppressScrollSaveRef.current) return
    const nav = navRef.current
    if (!nav) return
    window.sessionStorage.setItem(SIDEBAR_SCROLL_KEY, String(nav.scrollTop))
  }

  function toggleMenu(href: string) {
    setExpandedMenu((current) => current === href ? null : href)
  }

  function toggleSection(sectionKey: NavigationSectionKey) {
    manualSectionSelectionRef.current = true
    setExpandedSection((current) => current === sectionKey ? null : sectionKey)
    setExpandedMenu(null)
  }

  return (
    <nav ref={navRef} className="flex-1 overflow-y-auto py-3 text-sm custom-scrollbar-dark" aria-label="Main navigation" onScroll={rememberSidebarScroll}>
      {!authContext ? (
        <div className={`space-y-3 px-4 py-4 text-slate-400 ${compact ? 'lg:px-2' : ''}`} aria-live="polite">
          <div className={`h-3 rounded-md bg-slate-700/70 ${compact ? 'lg:mx-auto lg:w-5' : 'w-24'}`} />
          <div className={`h-8 rounded-md bg-slate-800/80 ${compact ? 'lg:mx-auto lg:w-8' : 'w-full'}`} />
          <div className={`h-8 rounded-md bg-slate-800/60 ${compact ? 'lg:mx-auto lg:w-8' : 'w-10/12'}`} />
          <span className="sr-only">กำลังโหลดเมนู</span>
        </div>
      ) : null}
      {navigationSections.map((section) => {
        const items = visibleItems.filter((item) => item.section === section.key)
        if (!items.length) return null
        const sectionExpanded = expandedSection === section.key
        const sectionPanelId = `sidebar-section-${section.key}`

        return (
          <div key={section.key}>
            <button
              aria-controls={sectionPanelId}
              aria-expanded={sectionExpanded}
              className={`flex w-full items-center justify-between px-4 pb-1 pt-4 text-left text-xs uppercase tracking-wider text-slate-500 transition hover:text-slate-300 ${compact ? 'lg:justify-center lg:px-2' : ''}`}
              title={compact ? section.label : undefined}
              type="button"
              onClick={() => toggleSection(section.key)}
            >
              <span className={compact ? 'lg:hidden' : ''}>{section.label}</span>
              <span className={compact ? 'text-xs lg:hidden' : 'text-xs'}>{sectionExpanded ? '▾' : '▸'}</span>
              {compact ? <span className="hidden size-1.5 rounded-full bg-slate-500 lg:block" /> : null}
            </button>
            {sectionExpanded ? <div id={sectionPanelId}>{items.map((item) => {
              const childActive = item.children?.some((child) => isNavigationPathActive(activePathname, child.href)) ?? false
              const active = isNavigationPathActive(activePathname, item.href) || childActive
              const expanded = expandedMenu === item.href
              const childPanelId = `sidebar-menu-${item.href.replace(/[^a-z0-9]+/gi, '-')}`
              const itemControlClass = `flex min-w-0 flex-1 items-center gap-3 px-4 py-2 text-left transition hover:bg-slate-800/60 ${active ? 'text-white' : 'text-slate-300'} ${compact ? 'lg:justify-center lg:px-2' : ''}`

              return (
                <div key={item.href}>
                  <div className="flex">
                    {item.children?.length ? (
                      <button
                        aria-controls={childPanelId}
                        aria-current={active ? 'page' : undefined}
                        aria-expanded={expanded}
                        className={itemControlClass}
                        data-active-nav={active ? 'true' : undefined}
                        title={compact ? item.label : undefined}
                        type="button"
                        onClick={() => {
                          rememberSidebarScroll()
                          toggleMenu(item.href)
                        }}
                      >
                        <span className="w-5 text-center leading-none">{item.icon}</span>
                        <span className={compact ? 'truncate lg:hidden' : 'truncate'}>{item.label}</span>
                      </button>
                    ) : (
                      <Link
                        aria-current={active ? 'page' : undefined}
                        className={itemControlClass}
                        data-active-nav={active ? 'true' : undefined}
                        href={item.href}
                        title={compact ? item.label : undefined}
                        onClick={() => {
                          rememberSidebarScroll()
                          onNavigate?.()
                        }}
                      >
                        <span className="w-5 text-center leading-none">{item.icon}</span>
                        <span className={compact ? 'truncate lg:hidden' : 'truncate'}>{item.label}</span>
                      </Link>
                    )}
                    {item.children?.length ? (
                      <button
                        aria-controls={childPanelId}
                        aria-expanded={expanded}
                        aria-label={`${expanded ? 'ยุบ' : 'ขยาย'}เมนู ${item.label}`}
                        className={`px-3 text-xs text-slate-400 hover:text-white ${compact ? 'lg:hidden' : ''}`}
                        type="button"
                        onClick={() => toggleMenu(item.href)}
                      >
                        {expanded ? '▾' : '▸'}
                      </button>
                    ) : null}
                  </div>
                  {item.children?.length && expanded ? (
                    <div id={childPanelId} className="bg-slate-950/30 py-1">
                      {item.children.map((child) => {
                        const childIsActive = isNavigationPathActive(activePathname, child.href)

                        return (
                          <Link
                            key={child.href}
                            aria-current={childIsActive ? 'page' : undefined}
                            className={`flex items-center gap-3 py-2 pl-11 pr-4 text-left transition hover:bg-slate-800/60 ${
                              childIsActive ? 'text-white' : 'text-slate-400'
                            } ${compact ? 'lg:justify-center lg:px-2' : ''}`}
                            data-active-nav={childIsActive ? 'true' : undefined}
                            href={child.href}
                            title={compact ? child.label : undefined}
                            onClick={() => {
                              rememberSidebarScroll()
                              onNavigate?.()
                            }}
                          >
                            <span className="w-5 text-center leading-none">{child.icon}</span>
                            <span className={compact ? 'truncate lg:hidden' : 'truncate'}>{child.label}</span>
                          </Link>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              )
            })}</div> : null}
          </div>
        )
      })}
    </nav>
  )
}

```

## `apps/next/src/components/layout/MobileBottomNavigation.tsx`

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  User,
  Menu,
  LayoutDashboard,
  ClipboardList,
} from 'lucide-react'
import { canAccessPath, navigationItems, sidebarNavigationPath } from '@/lib/navigation'

type MobileBottomNavigationProps = {
  authContext: { permissions: string[] } | null
  onOpenSidebar?: () => void
}

const dailyCandidates = [
  '/daily/weight-ticket-list',
  '/daily-report',
  '/daily/expense',
]

const dashboardCandidates = [
  '/dashboard-overview',
  '/production/dashboard',
  '/finance-accounting/financial-dashboard',
  '/daily/expense-dashboard',
  '/trading/dashboard',
  '/analytics-dashboard',
]

export function MobileBottomNavigation({ authContext, onOpenSidebar }: MobileBottomNavigationProps) {
  const pathname = usePathname()

  if (!authContext) {
    return (
      <nav className="fixed bottom-0 left-0 right-0 z-40 h-16 border-t border-slate-200/80 bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.03)] pb-safe lg:hidden">
        <div className="mx-auto flex h-full max-w-lg items-center justify-around px-2 animate-pulse">
          <div className="h-10 w-12 rounded bg-slate-100" />
          <div className="h-10 w-12 rounded bg-slate-100" />
          <div className="h-10 w-12 rounded bg-slate-100" />
          <div className="h-10 w-12 rounded bg-slate-100" />
        </div>
      </nav>
    )
  }

  const dashboardHref = authContext
    ? dashboardCandidates.find((href) => canAccessPath(href, authContext))
    : null
  const dailyHref = authContext
    ? dailyCandidates.find((href) => canAccessPath(href, authContext))
    : null
  const activeNavigationPath = sidebarNavigationPath(pathname)
  const activeSection = navigationItems.find((item) => (
    item.href === activeNavigationPath || item.children?.some((child) => child.href === activeNavigationPath)
  ))?.section

  const rawTabs = [
    {
      icon: Menu,
      key: 'menu',
      label: 'เมนู',
      onClick: onOpenSidebar,
    },
    dailyHref ? {
      href: dailyHref,
      icon: ClipboardList,
      isActive: activeSection === 'daily' || activeNavigationPath === '/daily-report',
      key: 'daily',
      label: 'ประจำวัน',
    } : null,
    dashboardHref ? {
      href: dashboardHref,
      icon: LayoutDashboard,
      isActive: pathname === dashboardHref || pathname.startsWith(`${dashboardHref}/`),
      key: 'dashboard',
      label: 'แดชบอร์ด',
    } : null,
    {
      href: '/profile',
      icon: User,
      isActive: pathname === '/profile' || pathname.startsWith('/profile/'),
      key: 'account',
      label: 'บัญชี',
    },
  ]
  const displayedTabs = rawTabs.filter((tab): tab is Exclude<(typeof rawTabs)[number], null> => Boolean(tab)).slice(0, 4)

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 h-16 border-t border-slate-200/80 bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.03)] pb-safe lg:hidden">
      <div className="mx-auto flex h-full max-w-lg items-center justify-around px-2">
        {displayedTabs.map((tab) => {
          const Icon = tab.icon

          if ('onClick' in tab) {
            return (
              <button
                key={tab.key}
                aria-label={tab.label}
                onClick={tab.onClick}
                type="button"
                className="flex h-full flex-1 flex-col items-center justify-center gap-1 text-slate-400 outline-none transition-all duration-200 hover:text-slate-600"
              >
                <Icon className="size-[22px] transition-transform stroke-[2px]" />
                <span className="w-full overflow-hidden text-ellipsis whitespace-nowrap text-center text-xs font-medium leading-none">
                  {tab.label}
                </span>
              </button>
            )
          }

          const isActive = tab.isActive

          return (
            <Link
              href={tab.href!}
              key={tab.key}
              className={`flex h-full flex-1 flex-col items-center justify-center gap-1 outline-none transition-all duration-200 ${
                isActive
                  ? 'text-blue-600 scale-105'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Icon className={`size-[22px] transition-transform ${isActive ? 'stroke-[2.5px]' : 'stroke-[2px]'}`} />
              <span className={`w-full overflow-hidden text-ellipsis whitespace-nowrap text-center text-xs font-medium leading-none ${isActive ? 'font-bold' : ''}`}>
                {tab.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

```

## `apps/next/src/components/layout/PageTitleOverride.tsx`

```tsx
'use client'

import { useEffect } from 'react'

const PAGE_TITLE_EVENT = 'ns-scrap-erp-page-title'

type PageTitleOverrideProps = {
  breadcrumbLabel?: string
  title: string
}

export function PageTitleOverride({ breadcrumbLabel, title }: PageTitleOverrideProps) {
  useEffect(() => {
    const detail = { breadcrumbLabel, title }
    window.dispatchEvent(new CustomEvent(PAGE_TITLE_EVENT, { detail }))
    const timer = window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent(PAGE_TITLE_EVENT, { detail }))
    }, 0)

    return () => {
      window.clearTimeout(timer)
      window.dispatchEvent(new CustomEvent(PAGE_TITLE_EVENT, { detail: { breadcrumbLabel: null, title: null } }))
    }
  }, [breadcrumbLabel, title])

  return null
}

```

## `apps/next/src/components/layout/ThemeModeToggle.tsx`

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'

export function ThemeModeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = mounted && resolvedTheme === 'dark'
  const nextTheme = isDark ? 'light' : 'dark'
  const actionLabel = !mounted
    ? 'สลับธีม'
    : nextTheme === 'dark'
      ? 'เปิดโหมดมืด'
      : 'เปิดโหมดสว่าง'

  function toggleTheme() {
    if (!mounted) return

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!('startViewTransition' in document) || prefersReducedMotion) {
      setTheme(nextTheme)
      return
    }

    const rect = buttonRef.current?.getBoundingClientRect()
    const originX = rect ? rect.left + rect.width / 2 : window.innerWidth
    const originY = rect ? rect.top + rect.height / 2 : 0
    const radius = Math.hypot(
      Math.max(originX, window.innerWidth - originX),
      Math.max(originY, window.innerHeight - originY),
    )
    const transition = document.startViewTransition(() => setTheme(nextTheme))

    transition.ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${originX}px ${originY}px)`, `circle(${radius}px at ${originX}px ${originY}px)`] },
        {
          duration: 420,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          pseudoElement: '::view-transition-new(root)',
        },
      )
    }).catch(() => {})
  }

  return (
    <button
      aria-label={actionLabel}
      aria-checked={isDark}
      data-state={isDark ? 'checked' : 'unchecked'}
      ref={buttonRef}
      className="inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent bg-[#e5e5e5] p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#737373]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#ffffff] dark:focus-visible:ring-offset-[#0f172a]"
      role="switch"
      title={actionLabel}
      type="button"
      onClick={toggleTheme}
    >
      <span
        className="pointer-events-none flex size-5 items-center justify-center rounded-full bg-white text-[#525252] shadow-lg ring-0 transition-transform duration-200 data-[state=checked]:translate-x-5 data-[state=checked]:bg-[#171717] data-[state=checked]:text-[#fafafa]"
        data-state={isDark ? 'checked' : 'unchecked'}
      >
        {mounted && isDark ? <Moon className="size-3" aria-hidden="true" /> : <Sun className="size-3" aria-hidden="true" />}
      </span>
    </button>
  )
}

```
