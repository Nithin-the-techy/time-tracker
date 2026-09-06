import { NextResponse } from 'next/server'
import { getCookieName } from '@/lib/auth'
import { cookies } from 'next/headers'

export async function POST() {
  const cookieStore = await cookies()
  cookieStore.delete(getCookieName())
  return NextResponse.json({ ok: true })
}
