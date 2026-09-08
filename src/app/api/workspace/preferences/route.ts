import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isValidTimeZone } from '@/lib/dates'

const SINGLETON_ID = 1

export async function GET(req: NextRequest) {
  const requested = new URL(req.url).searchParams.get('timezone')
  const existing = await db.workspacePreference.findUnique({ where: { id: SINGLETON_ID } })
  const timezone = existing?.timezone ?? (requested && isValidTimeZone(requested) ? requested : 'UTC')
  const preference = existing ?? await db.workspacePreference.create({ data: { id: SINGLETON_ID, timezone } })
  return NextResponse.json({ preference })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const timezone = String(body.timezone ?? '').trim()
  if (!isValidTimeZone(timezone)) return NextResponse.json({ error: 'timezone must be a valid IANA timezone' }, { status: 400 })
  const preference = await db.workspacePreference.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, timezone },
    update: { timezone },
  })
  return NextResponse.json({ preference })
}
