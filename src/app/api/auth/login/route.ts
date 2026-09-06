import { NextRequest, NextResponse } from 'next/server'
import { sealSession, verifyPassword, getCookieName, getCookieOptions, isDevMode } from '@/lib/auth'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const password = String(body.password ?? '')
  if (!password) {
    return NextResponse.json({ ok: false, error: 'Password required' }, { status: 400 })
  }
  if (!verifyPassword(password)) {
    return NextResponse.json({ ok: false, error: 'Wrong password' }, { status: 401 })
  }
  const seal = await sealSession()
  const cookieStore = await cookies()
  // Detect real scheme (honors reverse proxies / preview gateways).
  const forwardedProto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
  const isHttps = forwardedProto ? forwardedProto === 'https' : req.nextUrl.protocol === 'https:'
  cookieStore.set(getCookieName(), seal, getCookieOptions(isHttps))
  return NextResponse.json({ ok: true, dev: isDevMode() })
}
