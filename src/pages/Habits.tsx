import { useState, type FormEvent } from 'react'
import { btn, card, EmojiPicker, EmptyState, Field, input, Modal, parseIntInput } from '../components/ui'
import { currentStreak, sortedHabits } from '../lib/calc'
import { getUserId, newId, save, useStore } from '../lib/store'
import type { Habit } from '../lib/types'

export function Habits({ adding, setAdding }: { adding: boolean; setAdding: (v: boolean) => void }) {
  const { data } = useStore()
  const [editing, setEditing] = useState<Habit | null>(null)
  const active = sortedHabits(data)
  const archived = sortedHabits(data, true)

  function move(index: number, dir: -1 | 1) {
    const list = [...active]
    const j = index + dir
    if (j < 0 || j >= list.length) return
    ;[list[index], list[j]] = [list[j], list[index]]
    list.forEach((h, i) => h.sort_order !== i && save('habits', { ...h, sort_order: i }))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">我的習慣</h2>
        <button className={btn.primary} onClick={() => setAdding(true)}>
          ＋ 新增
        </button>
      </div>

      {active.length === 0 && (
        <EmptyState icon="📝" title="還沒有習慣">
          <p className="text-sm text-zinc-500">例如：喝水（每杯 1 分）、運動（每次 5 分）、讀書（每頁 1 分）。</p>
        </EmptyState>
      )}

      <ul className="space-y-2">
        {active.map((h, i) => (
          <li key={h.id} className={`${card} flex items-center gap-3 p-3`}>
            <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setEditing(h)}>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-zinc-100 text-2xl dark:bg-zinc-800">{h.icon}</span>
              <span className="min-w-0">
                <span className="block truncate font-medium">{h.name}</span>
                <span className="block text-xs text-zinc-500">
                  每{h.unit} {h.points} 分{h.daily_target ? ` · 每日目標 ${h.daily_target} ${h.unit}` : ''}
                  {currentStreak(data, h) > 0 && ` · 🔥 連續 ${currentStreak(data, h)} 天`}
                </span>
              </span>
            </button>
            <div className="flex flex-col">
              <button className="px-2 text-zinc-400 disabled:opacity-20" disabled={i === 0} onClick={() => move(i, -1)} aria-label="上移">
                ▲
              </button>
              <button className="px-2 text-zinc-400 disabled:opacity-20" disabled={i === active.length - 1} onClick={() => move(i, 1)} aria-label="下移">
                ▼
              </button>
            </div>
          </li>
        ))}
      </ul>

      {archived.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-sm text-zinc-500">已封存（{archived.length}）</summary>
          <ul className="mt-2 space-y-2">
            {archived.map((h) => (
              <li key={h.id} className={`${card} flex items-center gap-3 p-3 opacity-70`}>
                <span className="text-2xl">{h.icon}</span>
                <span className="flex-1 truncate">{h.name}</span>
                <button className={btn.secondary} onClick={() => save('habits', { ...h, archived: false })}>
                  取消封存
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      {(adding || editing) && (
        <HabitForm
          habit={editing}
          nextOrder={active.length}
          onClose={() => {
            setAdding(false)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function HabitForm({ habit, nextOrder, onClose }: { habit: Habit | null; nextOrder: number; onClose: () => void }) {
  const [name, setName] = useState(habit?.name ?? '')
  const [icon, setIcon] = useState(habit?.icon ?? '✅')
  const [points, setPoints] = useState(String(habit?.points ?? 1))
  const [unit, setUnit] = useState(habit?.unit ?? '次')
  const [target, setTarget] = useState(habit?.daily_target ? String(habit.daily_target) : '')

  const pointsNum = parseIntInput(points)
  const targetNum = parseIntInput(target)
  const valid = name.trim() !== '' && pointsNum !== null && pointsNum >= 1 && (target === '' || (targetNum !== null && targetNum >= 1))

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!valid) return
    save('habits', {
      id: habit?.id ?? newId(),
      user_id: habit?.user_id ?? getUserId(),
      name: name.trim(),
      icon,
      points: pointsNum!,
      unit: unit.trim() || '次',
      daily_target: target === '' ? null : targetNum,
      sort_order: habit?.sort_order ?? nextOrder,
      archived: habit?.archived ?? false,
      deleted: false,
      updated_at: '',
    })
    onClose()
  }

  function remove() {
    if (!habit) return
    if (!confirm(`確定要刪除「${habit.name}」嗎？這個習慣的所有紀錄和分數都會一起移除。\n\n如果只是暫時不想看到，建議用「封存」。`)) return
    save('habits', { ...habit, deleted: true })
    onClose()
  }

  return (
    <Modal title={habit ? '編輯習慣' : '新增習慣'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="名稱">
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：喝水" autoFocus={!habit} required />
        </Field>
        <Field label="圖示">
          <EmojiPicker value={icon} onChange={setIcon} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="每次得幾分">
            <input className={input} type="number" inputMode="numeric" min={1} value={points} onChange={(e) => setPoints(e.target.value)} required />
          </Field>
          <Field label="單位">
            <input className={input} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="次、杯、頁…" />
          </Field>
        </div>
        <Field label="每日目標（選填）" hint={`每天做到幾${unit || '次'}才算達標；不填代表做 1 ${unit || '次'}就算。`}>
          <input className={input} type="number" inputMode="numeric" min={1} value={target} onChange={(e) => setTarget(e.target.value)} placeholder="例如：8" />
        </Field>
        {habit && <p className="text-xs text-zinc-500">修改分數只影響之後的紀錄，過去已記錄的分數不會變。</p>}
        <button className={`${btn.primary} w-full`} disabled={!valid}>
          儲存
        </button>
        {habit && (
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              className={btn.secondary}
              onClick={() => {
                save('habits', { ...habit, archived: !habit.archived })
                onClose()
              }}
            >
              {habit.archived ? '取消封存' : '封存'}
            </button>
            <button type="button" className={btn.danger} onClick={remove}>
              刪除
            </button>
          </div>
        )}
      </form>
    </Modal>
  )
}
