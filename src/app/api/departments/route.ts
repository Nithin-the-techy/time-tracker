import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { DEPARTMENTS } from '@/lib/constants'
import { DEPARTMENT_MODULES, type DepartmentModuleKey } from '@/lib/department-modules'

// GET /api/departments
export async function GET() {
  const depts = await db.department.findMany({
    orderBy: { sortOrder: 'asc' },
    include: {
      subdepartments: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
  })

  // If no departments yet (fresh DB), seed them.
  if (depts.length === 0) {
    await seedDepartments()
    const fresh = await db.department.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        subdepartments: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    })
    return NextResponse.json({ departments: fresh })
  }
  return NextResponse.json({ departments: depts })
}

// Custom areas use the same goal engine as the original departments.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const name = String(body.name ?? '').trim().slice(0, 100)
  const requestedModule = String(body.moduleKey ?? 'generic') as DepartmentModuleKey
  const moduleKey = DEPARTMENT_MODULES[requestedModule] ? requestedModule : 'generic'
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })
  const baseSlug = slugify(name.replace(/^Department of\s+/i, '')) || 'department'
  let slug = baseSlug
  let suffix = 2
  while (await db.department.findUnique({ where: { slug } })) slug = `${baseSlug}-${suffix++}`
  const maxOrder = await db.department.aggregate({ _max: { sortOrder: true } })
  const department = await db.department.create({
    data: { name, slug, moduleKey, subType: 'freeform', sortOrder: (maxOrder._max.sortOrder ?? 0) + 1 },
  })
  return NextResponse.json({ department })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const id = String(body.id ?? '')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const data: { name?: string; moduleKey?: DepartmentModuleKey } = {}
  if (body.name !== undefined) {
    const name = String(body.name).trim().slice(0, 100)
    if (!name) return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 })
    data.name = name
  }
  if (body.moduleKey !== undefined) {
    const key = String(body.moduleKey) as DepartmentModuleKey
    if (!DEPARTMENT_MODULES[key]) return NextResponse.json({ error: 'invalid module' }, { status: 400 })
    data.moduleKey = key
  }
  const department = await db.department.update({ where: { id }, data })
  return NextResponse.json({ department })
}

async function seedDepartments() {
  for (const d of DEPARTMENTS) {
    const dept = await db.department.create({
      data: {
        name: d.name,
        slug: d.slug,
        sortOrder: d.sortOrder,
        subType: d.subType,
        moduleKey: d.moduleKey,
      },
    })
    for (let i = 0; i < d.subdepartments.length; i++) {
      // Sleep sub-department gets a lower default weight (0.3) to reflect
      // "slightly positive, health-supporting" rather than equal to real work.
      const isSleep = d.slug === 'health' && d.subdepartments[i] === 'Sleep'
      await db.subdepartment.create({
        data: {
          departmentId: dept.id,
          name: d.subdepartments[i],
          sortOrder: i,
          isActive: true,
          valueWeight: isSleep ? 0.3 : 1.0,
        },
      })
    }
  }
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
