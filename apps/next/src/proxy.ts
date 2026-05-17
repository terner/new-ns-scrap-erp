import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const publicPaths = new Set(['/login', '/api/health'])

function isPublicPath(pathname: string) {
  return publicPaths.has(pathname) || pathname.startsWith('/_next') || pathname.startsWith('/favicon')
}

function loginRedirect(request: NextRequest) {
  const redirectUrl = request.nextUrl.clone()
  redirectUrl.pathname = '/login'
  redirectUrl.searchParams.set('redirect', `${request.nextUrl.pathname}${request.nextUrl.search}`)
  return NextResponse.redirect(redirectUrl)
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

function metadataRole(user: { app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> }) {
  return String(user.app_metadata?.role ?? user.user_metadata?.role ?? '').toLowerCase()
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  let response = NextResponse.next({
    request,
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return pathname.startsWith('/api/') ? jsonError('Supabase Auth is not configured.', 500) : loginRedirect(request)
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value)
          response.cookies.set(name, value, options)
        })
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value))
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return pathname.startsWith('/api/') ? jsonError('กรุณาเข้าสู่ระบบ', 401) : loginRedirect(request)
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, active')
    .eq('user_id', user.id)
    .maybeSingle<{ role: string; active: boolean | null }>()

  const role = String(profile?.role ?? metadataRole(user)).toLowerCase()
  const isActive = profile?.active !== false

  if (role !== 'admin' || !isActive) {
    return pathname.startsWith('/api/') ? jsonError('ต้องใช้สิทธิ์ admin', 403) : NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)'],
}
