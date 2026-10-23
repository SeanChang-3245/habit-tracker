// 所有日期都用本地時間的 YYYY-MM-DD 字串表示

const pad = (n: number) => String(n).padStart(2, '0')

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parse(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const today = () => toISO(new Date())

export function addDays(s: string, n: number): string {
  const d = parse(s)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

/** 週一為一週的第一天 */
export function startOfWeek(s: string): string {
  const d = parse(s)
  return addDays(s, -((d.getDay() + 6) % 7))
}

export const endOfWeek = (s: string) => addDays(startOfWeek(s), 6)

export const startOfMonth = (s: string) => s.slice(0, 8) + '01'

export function endOfMonth(s: string): string {
  const d = parse(s)
  return toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0))
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parse(b).getTime() - parse(a).getTime()) / 86400000)
}

const WEEKDAYS = '日一二三四五六'

export function formatDate(s: string): string {
  const d = parse(s)
  return `${d.getMonth() + 1}月${d.getDate()}日（週${WEEKDAYS[d.getDay()]}）`
}

export function formatShort(s: string): string {
  const d = parse(s)
  return `${d.getMonth() + 1}/${d.getDate()}`
}
