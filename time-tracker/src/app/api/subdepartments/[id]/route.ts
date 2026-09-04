import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// PATCH /api/subdepartments/[id]
// Body: { isActive?, name?, sortOrder? }
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))
  const data: { isActive?: boolean; name?: string; sortOrder?: number } = {}
  if (typeof body.isActive === 'boolean') data.isActive = body.isActive
  if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim()
  if (typeof body.sortOrder === 'number') data.sortOrder = body.sortOrder
  const sub = await db.subdepartment.update({ where: { id }, data })
  return NextResponse.json({ subdepartment: sub })
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const sub = await db.subdepartment.findUnique({ where: { id } })
  if (!sub) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const entryCount = await db.entry.count({ where: { subdepartmentId: id } })
  if (entryCount > 0) {
    const archived = await db.subdepartment.update({ where: { id }, data: { isActive: false } })
    return NextResponse.json({ subdepartment: archived, archived: true })
  }
  await db.subdepartment.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
