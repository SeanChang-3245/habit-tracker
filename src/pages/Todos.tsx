import { useState, type FormEvent } from 'react'
import { btn, card, EmptyState, Field, input, Modal } from '../components/ui'
import { formatShort, today } from '../lib/date'
import { ESTIMATES, formatMinutes, slotTime, sortedTodos, todoBlocks } from '../lib/planner'
import { getUserId, newId, save, useStore } from '../lib/store'
import type { Data, Todo } from '../lib/types'

export function setTodoDone(todo: Todo, done: boolean) {
  save('todos', { ...todo, done, done_at: done ? new Date().toISOString() : null })
}

function deleteTodo(data: Data, todo: Todo) {
  for (const b of todoBlocks(data, todo.id)) save('schedule_blocks', { ...b, deleted: true })
  save('todos', { ...todo, deleted: true })
}

export function Todos({ onPlan }: { onPlan: () => void }) {
  const { data } = useStore()
  const [title, setTitle] = useState('')
  const [estimate, setEstimate] = useState(30)
  const [editing, setEditing] = useState<Todo | null>(null)
  const open = sortedTodos(data)
  const done = sortedTodos(data, true)
  const now = today()

  function add(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    save('todos', {
      id: newId(),
      user_id: getUserId(),
      title: title.trim(),
      notes: '',
      estimate_minutes: estimate,
      done: false,
      done_at: null,
      sort_order: open.length ? open[open.length - 1].sort_order + 1 : 0,
      deleted: false,
      updated_at: '',
    })
    setTitle('')
  }

  function move(index: number, dir: -1 | 1) {
    const list = [...open]
    const j = index + dir
    if (j < 0 || j >= list.length) return
    ;[list[index], list[j]] = [list[j], list[index]]
    list.forEach((t, i) => t.sort_order !== i && save('todos', { ...t, sort_order: i }))
  }

  return (
    <div className="space-y-4">
      <form onSubmit={add} className={`${card} flex gap-2 p-2`}>
        <input
          className={`${input} min-w-0 flex-1 border-0 focus:ring-0`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="新增待辦…"
          aria-label="待辦名稱"
        />
        <select
          className="rounded-xl bg-zinc-100 px-2 text-sm dark:bg-zinc-800"
          value={estimate}
          onChange={(e) => setEstimate(Number(e.target.value))}
          aria-label="預估時間"
        >
          {ESTIMATES.map((m) => (
            <option key={m} value={m}>
              {formatMinutes(m)}
            </option>
          ))}
        </select>
        <button className={btn.primary} disabled={!title.trim()}>
          新增
        </button>
      </form>

      {open.length === 0 ? (
        <EmptyState icon="🗒️" title={done.length ? '全部完成了！' : '還沒有待辦事項'}>
          <p className="text-sm text-zinc-500">在上面輸入要做的事，並估計大概要花多久，再到「時間表」把它排進一天裡。</p>
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {open.map((t, i) => {
            const upcoming = todoBlocks(data, t.id).filter((b) => b.date >= now)
            return (
              <li key={t.id} className={`${card} flex items-center gap-3 p-3`}>
                <button
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 border-zinc-300 hover:border-emerald-500 dark:border-zinc-600"
                  onClick={() => setTodoDone(t, true)}
                  aria-label={`完成 ${t.title}`}
                />
                <button className="min-w-0 flex-1 text-left" onClick={() => setEditing(t)}>
                  <span className="block truncate font-medium">{t.title}</span>
                  <span className="block text-xs text-zinc-500">
                    ⏱ {formatMinutes(t.estimate_minutes)}
                    {upcoming.length > 0 &&
                      ` · 📅 ${upcoming[0].date === now ? '今天' : formatShort(upcoming[0].date)} ${slotTime(upcoming[0].start_slot)}${
                        upcoming.length > 1 ? ` 等 ${upcoming.length} 段` : ''
                      }`}
                    {t.notes && ' · 📝'}
                  </span>
                </button>
                <div className="flex flex-col">
                  <button className="px-2 text-zinc-400 disabled:opacity-20" disabled={i === 0} onClick={() => move(i, -1)} aria-label="上移">
                    ▲
                  </button>
                  <button className="px-2 text-zinc-400 disabled:opacity-20" disabled={i === open.length - 1} onClick={() => move(i, 1)} aria-label="下移">
                    ▼
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {open.length > 0 && (
        <button className={`${btn.secondary} w-full`} onClick={onPlan}>
          🗓️ 去安排時間表
        </button>
      )}

      {done.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm text-zinc-500">已完成（{done.length}）</summary>
          <ul className="mt-2 space-y-2">
            {done.slice(0, 50).map((t) => (
              <li key={t.id} className={`${card} flex items-center gap-3 p-3 opacity-70`}>
                <button
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-500 text-sm text-white"
                  onClick={() => setTodoDone(t, false)}
                  aria-label={`取消完成 ${t.title}`}
                >
                  ✓
                </button>
                <span className="flex-1 truncate line-through">{t.title}</span>
                <button className="text-xs text-zinc-400 hover:text-red-500" onClick={() => deleteTodo(data, t)}>
                  刪除
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      {editing && <TodoForm todo={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function TodoForm({ todo, onClose }: { todo: Todo; onClose: () => void }) {
  const { data } = useStore()
  const [title, setTitle] = useState(todo.title)
  const [notes, setNotes] = useState(todo.notes)
  const [estimate, setEstimate] = useState(todo.estimate_minutes)
  const estimates = ESTIMATES.includes(estimate) ? ESTIMATES : [...ESTIMATES, estimate].sort((a, b) => a - b)

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    save('todos', { ...todo, title: title.trim(), notes: notes.trim(), estimate_minutes: estimate })
    onClose()
  }

  return (
    <Modal title="編輯待辦" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="名稱">
          <input className={input} value={title} onChange={(e) => setTitle(e.target.value)} required />
        </Field>
        <Field label="預估時間" hint="排進時間表時，預設會佔這麼長的時間。">
          <select className={input} value={estimate} onChange={(e) => setEstimate(Number(e.target.value))}>
            {estimates.map((m) => (
              <option key={m} value={m}>
                {formatMinutes(m)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="備註">
          <textarea className={`${input} min-h-24`} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <button className={`${btn.primary} w-full`} disabled={!title.trim()}>
          儲存
        </button>
        <button
          type="button"
          className={`${btn.danger} w-full`}
          onClick={() => {
            if (!confirm(`確定要刪除「${todo.title}」嗎？時間表上的安排也會一起移除。`)) return
            deleteTodo(data, todo)
            onClose()
          }}
        >
          刪除
        </button>
      </form>
    </Modal>
  )
}
