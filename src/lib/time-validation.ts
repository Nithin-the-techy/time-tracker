import { db } from './db'

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/

export function isDateKey(value: string): boolean {
  if (!DATE_KEY.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

export function validMinutes(value: unknown, maximum = 1440): number | null {
  const minutes = Math.round(Number(value))
  return Number.isFinite(minutes) && minutes >= 1 && minutes <= maximum ? minutes : null
}

export async function wouldExceedDay(dateKey: string, addedMinutes: number): Promise<boolean> {
  const [entries, neutral, negative] = await Promise.all([
    db.entry.findMany({
      where: {
        entryTimestamp: {
          gte: new Date(`${dateKey}T00:00:00.000Z`),
          lte: new Date(`${dateKey}T23:59:59.999Z`),
        },
      },
      select: { durationMinutes: true },
    }),
    db.neutralEntry.aggregate({ where: { date: dateKey }, _sum: { minutes: true } }),
    db.unproductiveBlock.aggregate({ where: { date: dateKey }, _sum: { minutes: true } }),
  ])
  const used = entries.reduce((sum, entry) => sum + entry.durationMinutes, 0)
    + (neutral._sum.minutes ?? 0)
    + (negative._sum.minutes ?? 0)
  return used + addedMinutes > 1440
}

