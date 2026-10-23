import { addDays, today as todayISO } from './date'
import type { Data, Goal, GoalType, Habit } from './types'

export const GOAL_TYPES: Record<GoalType, { label: string; needsHabit: boolean; hint: string }> = {
  points: { label: '累積分數', needsHabit: false, hint: '期間內所有習慣得到的分數加總' },
  count: { label: '完成次數', needsHabit: true, hint: '期間內某個習慣的完成次數加總' },
  days: { label: '達標天數', needsHabit: true, hint: '期間內某個習慣有幾天達到每日目標' },
  streak: { label: '連續達標', needsHabit: true, hint: '期間內某個習慣最長連續達標幾天' },
}

export function sortedHabits(data: Data, archived = false): Habit[] {
  return Object.values(data.habits)
    .filter((h) => !h.deleted && h.archived === archived)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
}

export function getCount(data: Data, habitId: string, date: string): number {
  return data.habit_logs[`${habitId}|${date}`]?.count ?? 0
}

/** 每天至少要做幾次才算達標 */
export const dailyThreshold = (h: Habit) => Math.max(1, h.daily_target ?? 1)

export const isDone = (data: Data, h: Habit, date: string) => getCount(data, h.id, date) >= dailyThreshold(h)

// data 每次修改都會換成新物件，所以可以用 WeakMap 快取計算結果
const pointsCache = new WeakMap<Data, Map<string, number>>()

/** 每天的得分 */
export function pointsByDate(data: Data): Map<string, number> {
  let m = pointsCache.get(data)
  if (m) return m
  m = new Map()
  for (const l of Object.values(data.habit_logs)) {
    const h = data.habits[l.habit_id]
    if (!h || h.deleted || l.count <= 0) continue
    m.set(l.date, (m.get(l.date) ?? 0) + l.count * l.points)
  }
  pointsCache.set(data, m)
  return m
}

export const dayPoints = (data: Data, date: string) => pointsByDate(data).get(date) ?? 0

export function pointsInRange(data: Data, start: string, end: string): number {
  let sum = 0
  for (const [d, p] of pointsByDate(data)) if (d >= start && d <= end) sum += p
  return sum
}

export function balance(data: Data) {
  let earned = 0
  for (const p of pointsByDate(data).values()) earned += p
  let bonus = 0
  for (const g of Object.values(data.goals)) if (!g.deleted && g.claimed_at) bonus += g.bonus_points
  let spent = 0
  for (const r of Object.values(data.redemptions)) if (!r.deleted) spent += r.cost
  return { earned, bonus, spent, available: earned + bonus - spent }
}

function streakEndingAt(data: Data, h: Habit, date: string): number {
  let n = 0
  while (isDone(data, h, date)) {
    n++
    date = addDays(date, -1)
  }
  return n
}

/** 目前連續天數；今天還沒做也不會中斷，從昨天往回算 */
export function currentStreak(data: Data, h: Habit, today = todayISO()): number {
  return isDone(data, h, today) ? streakEndingAt(data, h, today) : streakEndingAt(data, h, addDays(today, -1))
}

function doneDates(data: Data, h: Habit, start = '0000-00-00', end = '9999-99-99'): string[] {
  const threshold = dailyThreshold(h)
  return Object.values(data.habit_logs)
    .filter((l) => l.habit_id === h.id && l.count >= threshold && l.date >= start && l.date <= end)
    .map((l) => l.date)
    .sort()
}

function longestRun(dates: string[]): number {
  let best = 0
  let run = 0
  for (let i = 0; i < dates.length; i++) {
    run = i > 0 && addDays(dates[i - 1], 1) === dates[i] ? run + 1 : 1
    best = Math.max(best, run)
  }
  return best
}

export const longestStreak = (data: Data, h: Habit) => longestRun(doneDates(data, h))

export function goalProgress(data: Data, g: Goal, today = todayISO()): number {
  const end = g.end_date < today ? g.end_date : today
  if (g.start_date > end) return 0
  if (g.type === 'points') return pointsInRange(data, g.start_date, end)
  const h = g.habit_id ? data.habits[g.habit_id] : undefined
  if (!h) return 0
  switch (g.type) {
    case 'count':
      return Object.values(data.habit_logs)
        .filter((l) => l.habit_id === h.id && l.date >= g.start_date && l.date <= end)
        .reduce((s, l) => s + l.count, 0)
    case 'days':
      return doneDates(data, h, g.start_date, end).length
    case 'streak':
      return longestRun(doneDates(data, h, g.start_date, end))
  }
}

export type GoalState = 'claimed' | 'achieved' | 'active' | 'upcoming' | 'expired'

export function goalState(g: Goal, progress: number, today = todayISO()): GoalState {
  if (g.claimed_at) return 'claimed'
  if (progress >= g.target) return 'achieved'
  if (g.start_date > today) return 'upcoming'
  if (g.end_date < today) return 'expired'
  return 'active'
}

export function goalUnit(data: Data, g: Goal): string {
  if (g.type === 'points') return '分'
  if (g.type === 'count') return (g.habit_id && data.habits[g.habit_id]?.unit) || '次'
  return '天'
}
