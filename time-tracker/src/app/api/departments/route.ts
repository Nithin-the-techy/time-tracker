import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { DEPARTMENTS } from '@/lib/constants'

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

async function seedDepartments() {
  for (const d of DEPARTMENTS) {
    const dept = await db.department.create({
      data: {
        name: d.name,
        slug: d.slug,
        sortOrder: d.sortOrder,
        subType: d.subType,
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
