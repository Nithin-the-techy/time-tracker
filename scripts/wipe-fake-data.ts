// One-time cleanup: remove ALL fake/seeded data so the user starts tracking
// for real. Keeps the department framework (9 departments + sub-departments)
// and resets the seed-touched Sleep weight back to 1.0.
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  const before = {
    entries: await db.entry.count(),
    blocks: await db.unproductiveBlock.count(),
    neutral: await db.neutralEntry.count(),
    rivals: await db.rival.count(),
    estimates: await db.rivalSectorEstimate.count(),
    allowances: await db.dayAllowance.count(),
    reviews: await db.weeklyReview.count(),
  }
  console.log('before:', JSON.stringify(before))

  await db.entry.deleteMany({})
  await db.unproductiveBlock.deleteMany({})
  await db.neutralEntry.deleteMany({})
  await db.rivalSectorEstimate.deleteMany({})
  await db.rival.deleteMany({})
  await db.dayAllowance.deleteMany({})
  await db.weeklyReview.deleteMany({})

  // Seed set Sleep's weight to 0.3 — GPP runs on plain hours, weights are
  // reference-only; put it back to the neutral default.
  await db.subdepartment.updateMany({ where: { name: 'Sleep', valueWeight: 0.3 }, data: { valueWeight: 1.0 } })

  const after = {
    entries: await db.entry.count(),
    blocks: await db.unproductiveBlock.count(),
    neutral: await db.neutralEntry.count(),
    rivals: await db.rival.count(),
    departments: await db.department.count(),
    subdepartments: await db.subdepartment.count(),
  }
  console.log('after:', JSON.stringify(after))
}

main().finally(() => db.$disconnect())
