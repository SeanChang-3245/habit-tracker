import { useEffect, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { btn, card, EmptyState, Field, input, Modal } from '../components/ui'
import { addDays, formatDate, today } from '../lib/date'
import {
  blocksOn,
  blockTitle,
  currentSlot,
  formatMinutes,
  freeRun,
  occupancy,
  slotTime,
  SLOTS_PER_DAY,
  sortedTodos,
} from '../lib/planner'
import { getUserId, newId, save, useStore } from '../lib/store'
import type { ScheduleBlock, Todo } from '../lib/types'
import { setTodoDone } from './Todos'

// 有安排的半小時比較高，空的半小時比較矮以節省版面
const FULL = 52
const EMPTY = 26

type DragItem = { kind: 'todo'; todo: Todo } | { kind: 'block'; block: ScheduleBlock }
interface DragState {
  item: DragItem
  label: string
  x: number
  y: number
  /** 會放在哪個時段；null 代表不在時間表上 */
  target: number | null
  /** 實際能放幾格（空間不夠時會縮短）；0 代表那裡已經有安排 */
  slots: number
}

interface Range {
  start: number
  end: number
}

const RANGE_KEY = 'habit-tracker:planner-range'
function loadRange(): Range {
  try {
    const r = JSON.parse(localStorage.getItem(RANGE_KEY) ?? '')
    if (r.start >= 0 && r.end <= SLOTS_PER_DAY && r.start < r.end) return r
  } catch {
    // 沒有存過就用預設值
  }
  return { start: 12, end: 48 }
}

const todoSlots = (t: Todo) => Math.max(1, Math.ceil(t.estimate_minutes / 30))

/** 追蹤一次按住拖曳；移動超過幾個像素才算拖曳，否則當成點擊 */
function pointerSession(
  e: ReactPointerEvent,
  handlers: { onStart?: () => void; onMove: (e: PointerEvent) => void; onDrop: () => void; onClick?: () => void; onCancel?: () => void },
) {
  const startX = e.clientX
  const startY = e.clientY
  let active = false
  const move = (ev: PointerEvent) => {
    if (!active && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 5) return
    ev.preventDefault()
    if (!active) {
      active = true
      handlers.onStart?.()
    }
    handlers.onMove(ev)
  }
  const cleanup = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', cancel)
  }
  const up = () => {
    cleanup()
    if (active) handlers.onDrop()
    else handlers.onClick?.()
  }
  const cancel = () => {
    cleanup()
    handlers.onCancel?.()
  }
  window.addEventListener('pointermove', move, { passive: false })
  window.addEventListener('pointerup', up)
  window.addEventListener('pointercancel', cancel)
}

/** 找出畫面上某一點對應到哪個半小時 */
function slotAtPoint(x: number, y: number): number | null {
  const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-slot]')
  if (!el) return null
  const start = Number(el.dataset.slot)
  const span = Number(el.dataset.span ?? 1)
  const rect = el.getBoundingClientRect()
  return start + Math.min(span - 1, Math.max(0, Math.floor(((y - rect.top) / rect.height) * span)))
}

export function Planner() {
  const { data } = useStore()
  const now = today()
  const [date, setDate] = useState(now)
  const [range, setRange] = useState(loadRange)
  const [resize, setResize] = useState<{ id: string; slots: number } | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [picker, setPicker] = useState<number | null>(null)
  const [editing, setEditing] = useState<ScheduleBlock | null>(null)
  const timelineRef = useRef<HTMLDivElement>(null)
  // 拖曳結束時瀏覽器還會送出一次 click，要忽略掉
  const suppressClick = useRef(false)

  const blocks = blocksOn(data, date).map((b) => (resize?.id === b.id ? { ...b, slots: resize.slots } : b))
  const occ = occupancy(blocks)
  const first = Math.min(range.start, ...blocks.map((b) => b.start_slot))
  const last = Math.max(range.end, ...blocks.map((b) => b.start_slot + b.slots))
  const todos = sortedTodos(data)
  const scheduledToday = new Set(blocks.map((b) => b.todo_id))
  const busy = blocks.reduce((s, b) => s + b.slots, 0)
  const nowSlot = date === now ? currentSlot() : -1

  useEffect(() => {
    try {
      localStorage.setItem(RANGE_KEY, JSON.stringify(range))
    } catch {
      // 只是偏好設定，存不了也沒關係
    }
  }, [range])

  // 打開今天的時間表時，捲到現在的時間
  useEffect(() => {
    if (date !== today()) return
    const slot = currentSlot()
    const rows = timelineRef.current?.querySelectorAll<HTMLElement>('[data-slot]') ?? []
    for (const row of rows) {
      const s = Number(row.dataset.slot)
      if (s <= slot && slot < s + Number(row.dataset.span ?? 1)) {
        row.scrollIntoView({ block: 'center' })
        break
      }
    }
  }, [date])

  // 拖到畫面上下邊緣時自動捲動；要先拖進時間表才啟動，避免從上方待辦清單一拿起來就往上捲
  const dragY = useRef<number | null>(null)
  useEffect(() => {
    if (!drag) return
    let raf = 0
    const tick = () => {
      const y = dragY.current
      if (y !== null) {
        if (y < 80) window.scrollBy(0, -8)
        else if (y > window.innerHeight - 110) window.scrollBy(0, 8)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [drag !== null]) // eslint-disable-line react-hooks/exhaustive-deps

  function computeDrop(item: DragItem, x: number, y: number): Pick<DragState, 'target' | 'slots'> {
    const target = slotAtPoint(x, y)
    if (target === null) return { target: null, slots: 0 }
    const o = occupancy(blocks, item.kind === 'block' ? item.block.id : undefined)
    const want = item.kind === 'block' ? item.block.slots : todoSlots(item.todo)
    return { target, slots: Math.min(want, freeRun(o, target)) }
  }

  function startDrag(e: ReactPointerEvent, item: DragItem) {
    if (e.button !== 0) return
    let state: DragState | null = null
    const label = item.kind === 'todo' ? item.todo.title : blockTitle(data, item.block)
    pointerSession(e, {
      onMove: (ev) => {
        state = { item, label, x: ev.clientX, y: ev.clientY, ...computeDrop(item, ev.clientX, ev.clientY) }
        if (state.target !== null || dragY.current !== null) dragY.current = ev.clientY
        setDrag(state)
      },
      onDrop: () => {
        dragY.current = null
        setDrag(null)
        suppressClick.current = true
        setTimeout(() => (suppressClick.current = false), 0)
        if (!state || state.target === null || state.slots === 0) return
        if (item.kind === 'block') save('schedule_blocks', { ...item.block, start_slot: state.target, slots: state.slots })
        else addBlock(state.target, state.slots, item.todo.id, '')
      },
      onCancel: () => {
        dragY.current = null
        setDrag(null)
      },
    })
  }

  function startResize(e: ReactPointerEvent, b: ScheduleBlock) {
    e.stopPropagation()
    if (e.button !== 0) return
    const max = freeRun(occupancy(blocks, b.id), b.start_slot)
    let slots = b.slots
    pointerSession(e, {
      onMove: (ev) => {
        slots = Math.max(1, Math.min(max, b.slots + Math.round((ev.clientY - e.clientY) / FULL)))
        setResize({ id: b.id, slots })
      },
      onDrop: () => {
        setResize(null)
        suppressClick.current = true
        setTimeout(() => (suppressClick.current = false), 0)
        if (slots !== b.slots) save('schedule_blocks', { ...b, slots })
      },
      onCancel: () => setResize(null),
    })
  }

  function addBlock(start: number, slots: number, todoId: string | null, title: string) {
    save('schedule_blocks', {
      id: newId(),
      user_id: getUserId(),
      date,
      start_slot: start,
      slots,
      todo_id: todoId,
      title,
      deleted: false,
      updated_at: '',
    })
  }

  const highlight = (slot: number) => !!drag && drag.target !== null && drag.slots > 0 && slot >= drag.target && slot < drag.target + drag.slots

  const rows: ReactNode[] = []
  for (let i = first; i < last; ) {
    const b = occ[i]
    if (b) {
      const todo = b.todo_id ? data.todos[b.todo_id] : undefined
      const done = !!todo?.done
      const isDragging = drag?.item.kind === 'block' && drag.item.block.id === b.id
      rows.push(
        <div key={b.id} className="flex" style={{ height: b.slots * FULL }} data-slot={b.start_slot} data-span={b.slots}>
          <Gutter start={b.start_slot} count={b.slots} height={FULL} nowSlot={nowSlot} />
          <div className="relative flex-1 border-t border-zinc-200 p-0.5 dark:border-zinc-800">
            <div
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && setEditing(b)}
              onPointerDown={(e) => e.pointerType === 'mouse' && startDrag(e, { kind: 'block', block: b })}
              onClick={() => !suppressClick.current && setEditing(b)}
              className={`group relative flex h-full cursor-pointer gap-2 overflow-hidden rounded-xl px-2 py-1.5 select-none ${
                todo ? 'bg-emerald-100 text-emerald-950 dark:bg-emerald-900/60 dark:text-emerald-50' : 'bg-sky-100 text-sky-950 dark:bg-sky-900/60 dark:text-sky-50'
              } ${done ? 'opacity-50' : ''} ${isDragging ? 'opacity-40' : ''}`}
            >
              <span
                className="-my-1 -ml-1 flex w-6 shrink-0 cursor-grab touch-none items-start justify-center pt-1 text-lg leading-none opacity-50"
                onPointerDown={(e) => {
                  e.stopPropagation()
                  startDrag(e, { kind: 'block', block: b })
                }}
                aria-label="拖曳移動"
              >
                ⠿
              </span>
              <div className="min-w-0 flex-1">
                <div className={`truncate text-sm font-medium ${done ? 'line-through' : ''}`}>{blockTitle(data, b)}</div>
                <div className="truncate text-xs opacity-70">
                  {slotTime(b.start_slot)}–{slotTime(b.start_slot + b.slots)} · {formatMinutes(b.slots * 30)}
                </div>
              </div>
              {todo && (
                <button
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 text-xs ${
                    done ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-current opacity-50 hover:opacity-100'
                  }`}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    setTodoDone(todo, !done)
                  }}
                  aria-label={done ? '取消完成' : '標記完成'}
                >
                  {done && '✓'}
                </button>
              )}
              <div
                className="absolute inset-x-0 bottom-0 flex h-3 cursor-ns-resize touch-none justify-center"
                onPointerDown={(e) => startResize(e, b)}
                onClick={(e) => e.stopPropagation()}
                aria-label="拖曳調整長度"
              >
                <span className="mt-1 h-1 w-8 rounded-full bg-current opacity-30 group-hover:opacity-60" />
              </div>
            </div>
          </div>
        </div>,
      )
      i = b.start_slot + b.slots
    } else {
      const slot = i
      rows.push(
        <div key={`e${slot}`} className="flex" style={{ height: EMPTY }} data-slot={slot}>
          <Gutter start={slot} count={1} height={EMPTY} nowSlot={nowSlot} />
          <button
            className={`flex-1 border-t text-left text-xs text-transparent transition hover:bg-zinc-100 hover:text-zinc-400 dark:hover:bg-zinc-800/60 ${
              slot % 2 ? 'border-dashed border-zinc-100 dark:border-zinc-800/60' : 'border-zinc-200 dark:border-zinc-800'
            } ${highlight(slot) ? 'bg-emerald-200/70 dark:bg-emerald-800/50' : ''}`}
            onClick={() => setPicker(slot)}
            aria-label={`安排 ${slotTime(slot)}`}
          >
            <span className="pl-2">＋</span>
          </button>
        </div>,
      )
      i++
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button className={btn.ghost} onClick={() => setDate(addDays(date, -1))} aria-label="前一天">
          ‹
        </button>
        <div className="text-center">
          <div className="font-semibold">{date === now ? '今天' : formatDate(date)}</div>
          {date === now ? (
            <div className="text-xs text-zinc-500">{formatDate(date)}</div>
          ) : (
            <button className="text-xs text-emerald-600" onClick={() => setDate(now)}>
              回到今天
            </button>
          )}
        </div>
        <button className={btn.ghost} onClick={() => setDate(addDays(date, 1))} aria-label="後一天">
          ›
        </button>
      </div>

      <div className="lg:grid lg:grid-cols-[16rem_1fr] lg:items-start lg:gap-4">
        <aside className="mb-3 lg:sticky lg:top-20 lg:mb-0">
          <h3 className="mb-2 text-sm font-medium text-zinc-500">
            待辦 <span className="font-normal">· 按住 ⠿ 拖到時間表</span>
          </h3>
          {todos.length === 0 ? (
            <p className="text-sm text-zinc-400">沒有未完成的待辦。到「待辦」分頁新增。</p>
          ) : (
            <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:max-h-[70vh] lg:flex-col lg:overflow-y-auto lg:px-0">
              {todos.map((t) => (
                <li
                  key={t.id}
                  onPointerDown={(e) => e.pointerType === 'mouse' && startDrag(e, { kind: 'todo', todo: t })}
                  className={`${card} flex shrink-0 cursor-grab items-center gap-1.5 py-2 pr-3 pl-1 select-none lg:shrink ${
                    drag?.item.kind === 'todo' && drag.item.todo.id === t.id ? 'opacity-40' : ''
                  }`}
                >
                  <span
                    className="flex h-8 w-6 touch-none items-center justify-center text-lg text-zinc-400"
                    onPointerDown={(e) => {
                      e.stopPropagation()
                      startDrag(e, { kind: 'todo', todo: t })
                    }}
                    aria-label={`拖曳 ${t.title}`}
                  >
                    ⠿
                  </span>
                  <span className="min-w-0">
                    <span className="block max-w-40 truncate text-sm font-medium lg:max-w-none">{t.title}</span>
                    <span className="block text-xs text-zinc-500">
                      {formatMinutes(t.estimate_minutes)}
                      {scheduledToday.has(t.id) && ' · ✓ 已排'}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className={`${card} overflow-hidden`}>
          <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-800">
            <span>
              已安排 {formatMinutes(busy * 30).replace(' 分鐘', ' 分')}
              {busy === 0 && '，點空白時段或把待辦拖進來'}
            </span>
            <span className="flex shrink-0 items-center gap-1">
              <select
                className="rounded bg-transparent"
                value={range.start}
                onChange={(e) => setRange({ ...range, start: Number(e.target.value) })}
                aria-label="顯示開始時間"
              >
                {Array.from({ length: 24 }, (_, h) => h * 2)
                  .filter((s) => s < range.end)
                  .map((s) => (
                    <option key={s} value={s}>
                      {slotTime(s)}
                    </option>
                  ))}
              </select>
              –
              <select
                className="rounded bg-transparent"
                value={range.end}
                onChange={(e) => setRange({ ...range, end: Number(e.target.value) })}
                aria-label="顯示結束時間"
              >
                {Array.from({ length: 24 }, (_, h) => (h + 1) * 2)
                  .filter((s) => s > range.start)
                  .map((s) => (
                    <option key={s} value={s}>
                      {slotTime(s)}
                    </option>
                  ))}
              </select>
            </span>
          </div>
          <div ref={timelineRef} className="pt-2 pb-1 pr-2">
            {rows}
          </div>
        </section>
      </div>

      {drag && (
        <div
          className="pointer-events-none fixed z-50 max-w-56 -translate-x-1/2 -translate-y-[130%] rounded-xl bg-zinc-900 px-3 py-2 text-sm text-white shadow-lg dark:bg-white dark:text-zinc-900"
          style={{ left: drag.x, top: drag.y }}
        >
          <div className="truncate font-medium">{drag.label}</div>
          <div className="text-xs opacity-80">
            {drag.target === null
              ? '拖到時間表上的空白時段'
              : drag.slots === 0
                ? '這個時段已經有安排'
                : `${slotTime(drag.target)}–${slotTime(drag.target + drag.slots)}`}
          </div>
        </div>
      )}

      {picker !== null && <SlotPicker slot={picker} maxSlots={freeRun(occ, picker)} todos={todos} scheduled={scheduledToday} onAdd={addBlock} onClose={() => setPicker(null)} />}
      {editing && <BlockEditor block={editing} blocks={blocks} onClose={() => setEditing(null)} />}
    </div>
  )
}

function Gutter({ start, count, height, nowSlot }: { start: number; count: number; height: number; nowSlot: number }) {
  return (
    <div className="w-12 shrink-0">
      {Array.from({ length: count }, (_, k) => {
        const s = start + k
        return (
          <div
            key={s}
            style={{ height }}
            className={`relative pr-2 text-right text-[11px] leading-none tabular-nums ${s % 2 ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-500'} ${
              s === nowSlot ? 'font-bold text-red-500 dark:text-red-400' : ''
            }`}
          >
            <span className="relative -top-1">{slotTime(s)}</span>
            {s === nowSlot && <span className="absolute top-0 right-0 h-2 w-2 -translate-y-1/2 translate-x-1/2 rounded-full bg-red-500" />}
          </div>
        )
      })}
    </div>
  )
}

function durationOptions(max: number) {
  return Array.from({ length: max }, (_, k) => k + 1).map((n) => (
    <option key={n} value={n}>
      {formatMinutes(n * 30)}
    </option>
  ))
}

function SlotPicker({
  slot,
  maxSlots,
  todos,
  scheduled,
  onAdd,
  onClose,
}: {
  slot: number
  maxSlots: number
  todos: Todo[]
  scheduled: Set<string | null>
  onAdd: (start: number, slots: number, todoId: string | null, title: string) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState('')
  const [slots, setSlots] = useState(Math.min(2, maxSlots))
  const sorted = [...todos].sort((a, b) => Number(scheduled.has(a.id)) - Number(scheduled.has(b.id)))

  function addCustom(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    onAdd(slot, slots, null, title.trim())
    onClose()
  }

  return (
    <Modal title={`安排 ${slotTime(slot)} 開始`} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-xs text-zinc-500">最多可以排到 {slotTime(slot + maxSlots)}；待辦會依照預估時間排入，空間不夠時會自動縮短。</p>
        {sorted.length === 0 ? (
          <EmptyState icon="🗒️" title="沒有未完成的待辦" />
        ) : (
          <ul className="max-h-72 space-y-1.5 overflow-y-auto">
            {sorted.map((t) => {
              const n = Math.min(todoSlots(t), maxSlots)
              return (
                <li key={t.id}>
                  <button
                    className="flex w-full items-center gap-3 rounded-xl bg-zinc-100 px-3 py-2.5 text-left hover:bg-emerald-100 dark:bg-zinc-800 dark:hover:bg-emerald-900/50"
                    onClick={() => {
                      onAdd(slot, n, t.id, '')
                      onClose()
                    }}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{t.title}</span>
                      <span className="block text-xs text-zinc-500">
                        {slotTime(slot)}–{slotTime(slot + n)}
                        {n < todoSlots(t) && `（預估 ${formatMinutes(t.estimate_minutes)}，縮短了）`}
                        {scheduled.has(t.id) && ' · 今天已排過'}
                      </span>
                    </span>
                    <span className="text-emerald-600">＋</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        <form onSubmit={addCustom} className="space-y-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300">或者直接輸入（不會加進待辦清單）</div>
          <div className="flex gap-2">
            <input className={`${input} min-w-0 flex-1`} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例如：午餐、通勤" aria-label="名稱" />
            <select className={`${input} w-auto`} value={slots} onChange={(e) => setSlots(Number(e.target.value))} aria-label="時長">
              {durationOptions(maxSlots)}
            </select>
          </div>
          <button className={`${btn.secondary} w-full`} disabled={!title.trim()}>
            加入
          </button>
        </form>
      </div>
    </Modal>
  )
}

function BlockEditor({ block, blocks, onClose }: { block: ScheduleBlock; blocks: ScheduleBlock[]; onClose: () => void }) {
  const { data } = useStore()
  const todo = block.todo_id ? data.todos[block.todo_id] : undefined
  const others = occupancy(blocks, block.id)
  const [start, setStart] = useState(block.start_slot)
  const [title, setTitle] = useState(block.title)
  const max = freeRun(others, start)
  const [slots, setSlots] = useState(block.slots)
  const effectiveSlots = Math.min(slots, max)
  const starts = Array.from({ length: SLOTS_PER_DAY }, (_, s) => s).filter((s) => !others[s])

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!todo && !title.trim()) return
    save('schedule_blocks', { ...block, start_slot: start, slots: effectiveSlots, title: todo ? block.title : title.trim() })
    onClose()
  }

  return (
    <Modal title={todo ? todo.title : '編輯安排'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {!todo && (
          <Field label="名稱">
            <input className={input} value={title} onChange={(e) => setTitle(e.target.value)} required />
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="開始時間">
            <select className={input} value={start} onChange={(e) => setStart(Number(e.target.value))}>
              {starts.map((s) => (
                <option key={s} value={s}>
                  {slotTime(s)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="時長">
            <select className={input} value={effectiveSlots} onChange={(e) => setSlots(Number(e.target.value))}>
              {durationOptions(max)}
            </select>
          </Field>
        </div>
        <p className="text-xs text-zinc-500">
          {slotTime(start)}–{slotTime(start + effectiveSlots)}
        </p>
        {todo?.notes && <p className="rounded-xl bg-zinc-100 p-3 text-sm whitespace-pre-wrap dark:bg-zinc-800">{todo.notes}</p>}
        <button className={`${btn.primary} w-full`} disabled={!todo && !title.trim()}>
          儲存
        </button>
        <div className="grid grid-cols-2 gap-3">
          {todo ? (
            <button
              type="button"
              className={btn.secondary}
              onClick={() => {
                setTodoDone(todo, !todo.done)
                onClose()
              }}
            >
              {todo.done ? '取消完成' : '✓ 標記完成'}
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            className={btn.danger}
            onClick={() => {
              save('schedule_blocks', { ...block, deleted: true })
              onClose()
            }}
          >
            從時間表移除
          </button>
        </div>
      </form>
    </Modal>
  )
}
