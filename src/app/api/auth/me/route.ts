import { NextResponse } from 'next/server'
import { getServerSession, isDevMode } from '@/lib/auth'

export async function GET() {
  const session = await getServerSession()
  if (!session) {
    return NextResponse.json({ authenticated: false, dev: isDevMode() }, { status: 200 })
  }
  return NextResponse.json({ authenticated: true, dev: isDevMode() })
}
