import { useSyncExternalStore } from 'react'
import { supabase } from './supabase'
import type { Data, RowMap, TableName } from './types'

// 資料流程：
// 1. 每次修改先寫進記憶體與 localStorage，畫面立刻更新（離線也能用）
// 2. 修改同時放進 pending 佇列，有網路時上傳到 Supabase（upsert）
// 3. 定期從 Supabase 拉回全部資料，再把還沒上傳的修改疊上去
// 衝突處理：最後寫入者為準。只有一個使用者，這樣就夠了。

// 依外鍵相依順序排列，上傳時要先建 habits 才能建 habit_logs
const TABLES: TableName[] = ['habits', 'habit_logs', 'goals', 'rewards', 'redemptions', 'todos', 'schedule_blocks']
const PAGE = 1000

type AnyRow = RowMap[TableName]
type PendingEntry = { table: TableName; row: AnyRow }

export interface SyncState {
  status: 'idle' | 'syncing' | 'offline' | 'error'
  pending: number
  lastSync: string | null
  error: string | null
}

const emptyData = (): Data => ({
  habits: {},
  habit_logs: {},
  goals: {},
  rewards: {},
  redemptions: {},
  todos: {},
  schedule_blocks: {},
})

function keyOf(table: TableName, row: AnyRow): string {
  if (table === 'habit_logs') {
    const log = row as RowMap['habit_logs']
    return `${log.habit_id}|${log.date}`
  }
  return (row as { id: string }).id
}

let userId: string | null = null
let data: Data = emptyData()
let pending: Record<string, PendingEntry> = {}
let sync: SyncState = { status: 'idle', pending: 0, lastSync: null, error: null }
let snapshot = { data, sync }
const listeners = new Set<() => void>()

function emit() {
  sync = { ...sync, pending: Object.keys(pending).length }
  snapshot = { data, sync }
  listeners.forEach((l) => l())
}

const storageKey = (name: string) => `habit-tracker:${userId}:${name}`

function persist() {
  if (!userId) return
  try {
    localStorage.setItem(storageKey('data'), JSON.stringify(data))
    localStorage.setItem(storageKey('pending'), JSON.stringify(pending))
    if (sync.lastSync) localStorage.setItem(storageKey('lastSync'), sync.lastSync)
  } catch {
    // 儲存空間不足或被瀏覽器封鎖時，資料仍在記憶體並會上傳到雲端
  }
}

function restore() {
  try {
    data = { ...emptyData(), ...JSON.parse(localStorage.getItem(storageKey('data')) ?? '{}') }
    pending = JSON.parse(localStorage.getItem(storageKey('pending')) ?? '{}')
    sync = { ...sync, lastSync: localStorage.getItem(storageKey('lastSync')) }
  } catch {
    data = emptyData()
    pending = {}
  }
}

export function initStore(uid: string) {
  if (userId === uid) return
  userId = uid
  restore()
  emit()
  void syncNow()
}

export function resetStore() {
  userId = null
  data = emptyData()
  pending = {}
  sync = { status: 'idle', pending: 0, lastSync: null, error: null }
  emit()
}

export function getUserId(): string {
  if (!userId) throw new Error('尚未登入')
  return userId
}

export const newId = () => crypto.randomUUID()

/** 新增或修改一筆資料 */
export function save<T extends TableName>(table: T, row: RowMap[T]) {
  const r = { ...row, updated_at: new Date().toISOString() }
  const k = keyOf(table, r)
  data = { ...data, [table]: { ...data[table], [k]: r } }
  pending = { ...pending, [`${table}:${k}`]: { table, row: r } }
  persist()
  emit()
  scheduleFlush()
}

let flushTimer: ReturnType<typeof setTimeout> | undefined
function scheduleFlush() {
  clearTimeout(flushTimer)
  flushTimer = setTimeout(() => void syncNow({ pull: false }), 800)
}

// 一張表失敗不影響其他表，例如新功能的資料表還沒建立時，習慣仍然可以同步
async function flush(): Promise<Error | null> {
  const entries = Object.entries(pending)
  if (!entries.length) return null
  let firstError: Error | null = null
  const failed = new Set<TableName>()
  for (const table of TABLES) {
    const rows = entries.filter(([, e]) => e.table === table).map(([, e]) => e.row)
    if (!rows.length) continue
    const { error } = await supabase
      .from(table)
      .upsert(rows, { onConflict: table === 'habit_logs' ? 'habit_id,date' : 'id' })
    if (error) {
      failed.add(table)
      firstError ??= new Error(`${table}: ${error.message}`)
    }
  }
  // 上傳期間若又被修改過，保留新的那筆等下次上傳
  const next = { ...pending }
  for (const [k, e] of entries) if (next[k] === e && !failed.has(e.table)) delete next[k]
  pending = next
  persist()
  return firstError
}

async function pull(): Promise<Error | null> {
  const fresh = emptyData()
  let firstError: Error | null = null
  for (const table of TABLES) {
    const order = table === 'habit_logs' ? 'date' : 'id'
    const target = fresh[table] as Record<string, AnyRow>
    for (let from = 0; ; from += PAGE) {
      const { data: rows, error } = await supabase
        .from(table)
        .select('*')
        .order(order)
        .order(table === 'habit_logs' ? 'habit_id' : 'id')
        .range(from, from + PAGE - 1)
      if (error) {
        // 拉不到就保留本機的資料
        Object.assign(target, data[table])
        firstError ??= new Error(`${table}: ${error.message}`)
        break
      }
      for (const r of rows as AnyRow[]) target[keyOf(table, r)] = r
      if (rows.length < PAGE) break
    }
  }
  for (const e of Object.values(pending)) {
    ;(fresh[e.table] as Record<string, AnyRow>)[keyOf(e.table, e.row)] = e.row
  }
  data = fresh
  persist()
  return firstError
}

let running: Promise<void> | null = null
let rerun = false

export async function syncNow({ pull: doPull = true } = {}): Promise<void> {
  if (!userId) return
  if (running) {
    rerun = rerun || doPull
    return running
  }
  if (!navigator.onLine) {
    sync = { ...sync, status: 'offline' }
    emit()
    return
  }
  const uid = userId
  running = (async () => {
    sync = { ...sync, status: 'syncing', error: null }
    emit()
    try {
      const flushError = await flush()
      const pullError = doPull ? await pull() : null
      if (userId !== uid) return
      const error = flushError ?? pullError
      if (error) throw error
      sync = { ...sync, status: 'idle', lastSync: doPull ? new Date().toISOString() : sync.lastSync }
      persist()
    } catch (err) {
      if (userId !== uid) return
      const message = err instanceof Error ? err.message : String((err as { message?: string })?.message ?? err)
      sync = { ...sync, status: navigator.onLine ? 'error' : 'offline', error: message }
    }
    emit()
  })()
  try {
    await running
  } finally {
    running = null
  }
  if (rerun || Object.keys(pending).length) {
    const again = rerun
    rerun = false
    if (again) return syncNow()
    if (sync.status === 'idle') scheduleFlush()
  }
}

// 切回 App、恢復網路時自動同步；開著的時候每分鐘同步一次
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => void syncNow())
  window.addEventListener('offline', () => {
    sync = { ...sync, status: 'offline' }
    emit()
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncNow()
  })
  setInterval(() => {
    if (document.visibilityState === 'visible') void syncNow()
  }, 60_000)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useStore() {
  return useSyncExternalStore(subscribe, () => snapshot)
}
