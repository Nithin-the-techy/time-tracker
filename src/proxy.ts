import { NextRequest, NextResponse } from 'next/server'
import Iron from '@hapi/iron'

// Next.js 16 renamed middleware → proxy. We use the Node runtime (not Edge)
// because @hapi/iron uses Node's crypto/stream modules.

const COOKIE_NAME = 'op-session'
const MAX_AGE = 60 * 60 * 24 * 30 // 30 days

async function getAuthSecret(): Promise<string> {
  const secret = process.env.AUTH_SECRET
  if (secret && secret.length >= 32) return secret
  const pw = process.env.APP_PASSWORD ?? 'dev-only'
  return `op-derived-secret::${pw}::salt-DO-NOT-USE-IN-PROD-0000`.slice(0, 64)
}

async function isAuthed(req: NextRequest): Promise<boolean> {
  // Dev mode — no APP_PASSWORD set → let everything through.
  if (!process.env.APP_PASSWORD) return true

  const seal = req.cookies.get(COOKIE_NAME)?.value
  if (!seal) return false
  try {
    const data = await Iron.unseal(seal, await getAuthSecret(), {
      ...Iron.defaults,
      ttl: MAX_AGE * 1000,
    })
    return !!(data as { authenticated?: boolean })?.authenticated
  } catch {
    return false
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (
    pathname === '/login' ||
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon') ||
    pathname === '/robots.txt'
  ) {
    return NextResponse.next()
  }

  if (await isAuthed(req)) {
    return NextResponse.next()
  }

  // APIs get a clean 401 (never a redirect to HTML — keeps client JSON
  // parsing sane when a session expires mid-use).
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const loginUrl = new URL('/login', req.url)
  loginUrl.searchParams.set('next', pathname)
  return NextResponse.redirect(loginUrl)
}

// Next.js 16 proxy always runs on Node.js runtime — no runtime config needed.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
