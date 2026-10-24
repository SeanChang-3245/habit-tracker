import type { Data, ScheduleBlock, Todo } from './types'

export const SLOTS_PER_DAY = 48

/** 第幾個半小時 → "HH:MM"；48 代表 24:00 */
export function slotTime(slot: number): string {
  const h = Math.floor(slot / 2)
  return `${String(h).padStart(2, '0')}:${slot % 2 ? '30' : '00'}`
}

export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (!h) return `${m} 分鐘`
  return m ? `${h} 小時 ${m} 分` : `${h} 小時`
}

export const ESTIMATES = [30, 60, 90, 120, 150, 180, 240, 300, 360, 480]

export function sortedTodos(data: Data, done = false): Todo[] {
  return Object.values(data.todos)
    .filter((t) => !t.deleted && t.done === done)
    .sort((a, b) =>
      done ? (b.done_at ?? '').localeCompare(a.done_at ?? '') : a.sort_order - b.sort_order || a.title.localeCompare(b.title),
    )
}

export function blocksOn(data: Data, date: string): ScheduleBlock[] {
  return Object.values(data.schedule_blocks)
    .filter((b) => !b.deleted && b.date === date)
    .sort((a, b) => a.start_slot - b.start_slot)
}

/** 每個半小時被哪個區塊佔用 */
export function occupancy(blocks: ScheduleBlock[], ignoreId?: string): (ScheduleBlock | null)[] {
  const occ: (ScheduleBlock | null)[] = Array(SLOTS_PER_DAY).fill(null)
  for (const b of blocks) {
    if (b.id === ignoreId) continue
    for (let i = b.start_slot; i < b.start_slot + b.slots && i < SLOTS_PER_DAY; i++) occ[i] = b
  }
  return occ
}

/** 從 slot 開始往後連續有幾格是空的 */
export function freeRun(occ: (ScheduleBlock | null)[], slot: number): number {
  let n = 0
  while (slot + n < SLOTS_PER_DAY && !occ[slot + n]) n++
  return n
}

export function blockTitle(data: Data, b: ScheduleBlock): string {
  const todo = b.todo_id ? data.todos[b.todo_id] : undefined
  return todo && !todo.deleted ? todo.title : b.title || '（未命名）'
}

/** todo 被排進了哪些時段，依時間排序 */
export function todoBlocks(data: Data, todoId: string): ScheduleBlock[] {
  return Object.values(data.schedule_blocks)
    .filter((b) => !b.deleted && b.todo_id === todoId)
    .sort((a, b) => a.date.localeCompare(b.date) || a.start_slot - b.start_slot)
}

export const currentSlot = () => {
  const d = new Date()
  return d.getHours() * 2 + (d.getMinutes() >= 30 ? 1 : 0)
}
