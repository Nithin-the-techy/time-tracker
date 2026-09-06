import Iron from '@hapi/iron'
import { cookies } from 'next/headers'

// Simple password gate. No users, no per-row auth. One password gates the whole app.
//
// ENV:
//   APP_PASSWORD  — the password the user must enter
//   AUTH_SECRET   — secret used to sign the session cookie (auto-generated in dev
//                   from APP_PASSWORD if missing; must be set in production)
//
// Cookie name: 'op-session'
// Cookie value: Iron-sealed JSON `{ authenticated: true, at: <iso> }`

const COOKIE_NAME = 'op-session'
const MAX_AGE = 60 * 60 * 24 * 30 // 30 days

async function getAuthSecret(): Promise<string> {
  const secret = process.env.AUTH_SECRET
  if (secret && secret.length >= 32) return secret
  // Dev fallback: derive from APP_PASSWORD. Iron needs ≥32 chars, so we
  // pad with a fixed salt if the password is short. This is dev-only — for
  // production, set AUTH_SECRET to a real 32+ char random string.
  const pw = process.env.APP_PASSWORD ?? 'dev-only'
  const derived = `op-derived-secret::${pw}::salt-DO-NOT-USE-IN-PROD-0000`
  return derived.slice(0, 64)
}

export function isDevMode(): boolean {
  return !process.env.APP_PASSWORD
}

export async function sealSession(): Promise<string> {
  const data = { authenticated: true, at: new Date().toISOString() }
  return Iron.seal(data, await getAuthSecret(), {
    ...Iron.defaults,
    ttl: MAX_AGE * 1000,
  })
}

export async function unsealSession(seal: string): Promise<{ authenticated: boolean; at: string } | null> {
  try {
    const data = await Iron.unseal(seal, await getAuthSecret(), {
      ...Iron.defaults,
      ttl: MAX_AGE * 1000,
    })
    return data as { authenticated: boolean; at: string }
  } catch {
    return null
  }
}

export function getCookieName(): string {
  return COOKIE_NAME
}

export function getCookieOptions(isHttps = false) {
  return {
    httpOnly: true,
    // Over HTTPS we use SameSite=None + Secure so the session cookie also works
    // inside embedded frames (e.g. the workspace preview panel), where browsers
    // reject Lax cookies. Plain HTTP (local dev) keeps SameSite=Lax — None is
    // invalid without Secure and would be dropped.
    secure: isHttps,
    sameSite: (isHttps ? 'none' : 'lax') as 'none' | 'lax',
    path: '/',
    maxAge: MAX_AGE,
  }
}

export function verifyPassword(pw: string): boolean {
  const expected = process.env.APP_PASSWORD
  if (!expected) {
    // Dev mode — any password works.
    return true
  }
  return pw === expected
}

// Read the session from next/headers cookies (server components / route handlers).
export async function getServerSession(): Promise<{ authenticated: boolean } | null> {
  const cookieStore = await cookies()
  const seal = cookieStore.get(COOKIE_NAME)?.value
  if (!seal) return null
  const data = await unsealSession(seal)
  if (!data || !data.authenticated) return null
  return { authenticated: true }
}
