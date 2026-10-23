import { useState, type FormEvent } from 'react'
import { btn, card, EmptyState, Field, input, Modal, parseIntInput, ProgressBar } from '../components/ui'
import { GOAL_TYPES, goalProgress, goalState, goalUnit, sortedHabits, type GoalState } from '../lib/calc'
import { addDays, daysBetween, endOfMonth, endOfWeek, formatShort, startOfMonth, startOfWeek, today } from '../lib/date'
import { getUserId, newId, save, useStore } from '../lib/store'
import type { Goal, GoalType } from '../lib/types'

const SECTIONS: { state: GoalState; title: string }[] = [
  { state: 'achieved', title: '🎉 已達成，可以領獎勵了' },
  { state: 'active', title: '進行中' },
  { state: 'upcoming', title: '尚未開始' },
  { state: 'claimed', title: '已完成' },
  { state: 'expired', title: '未達成' },
]

export function Goals() {
  const { data } = useStore()
  const [editing, setEditing] = useState<Goal | 'new' | null>(null)
  const now = today()
  const goals = Object.values(data.goals)
    .filter((g) => !g.deleted)
    .map((g) => {
      const progress = goalProgress(data, g, now)
      return { g, progress, state: goalState(g, progress, now) }
    })
    .sort((a, b) => a.g.end_date.localeCompare(b.g.end_date))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">目標</h2>
        <button className={btn.primary} onClick={() => setEditing('new')}>
          ＋ 新增
        </button>
      </div>

      {goals.length === 0 && (
        <EmptyState icon="🎯" title="還沒有目標">
          <p className="text-sm text-zinc-500">例如：「這週累積 100 分，就去看一場電影」或「這個月運動 15 天，獎勵 50 分」。</p>
        </EmptyState>
      )}

      {SECTIONS.map(({ state, title }) => {
        const items = goals.filter((x) => x.state === state)
        if (!items.length) return null
        const list = (
          <ul className="space-y-2.5">
            {items.map(({ g, progress, state }) => {
              const unit = goalUnit(data, g)
              const habit = g.habit_id ? data.habits[g.habit_id] : undefined
              const left = daysBetween(now, g.end_date)
              return (
                <li key={g.id} className={`${card} space-y-2.5 p-4 ${state === 'achieved' ? 'ring-2 ring-amber-400' : ''}`}>
                  <button className="block w-full space-y-2.5 text-left" onClick={() => setEditing(g)}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold">{g.name}</div>
                        <div className="text-xs text-zinc-500">
                          {GOAL_TYPES[g.type].label}
                          {habit && ` · ${habit.icon} ${habit.name}`} · {formatShort(g.start_date)}–{formatShort(g.end_date)}
                          {state === 'active' && ` · 剩 ${left + 1} 天`}
                        </div>
                      </div>
                      <div className="shrink-0 text-right text-sm tabular-nums">
                        <span className="font-semibold">{Math.min(progress, g.target)}</span>
                        <span className="text-zinc-500">
                          /{g.target} {unit}
                        </span>
                      </div>
                    </div>
                    <ProgressBar value={progress} max={g.target} />
                    {(g.reward || g.bonus_points > 0) && (
                      <div className="text-sm text-zinc-600 dark:text-zinc-400">
                        🎁 {[g.reward, g.bonus_points > 0 && `+${g.bonus_points} 分`].filter(Boolean).join('　')}
                      </div>
                    )}
                  </button>
                  {state === 'achieved' && (
                    <button className={`${btn.primary} w-full bg-amber-500 hover:bg-amber-600`} onClick={() => save('goals', { ...g, claimed_at: new Date().toISOString() })}>
                      領取獎勵{g.bonus_points > 0 && `（+${g.bonus_points} 分）`}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )
        return (
          <section key={state} className="space-y-2">
            {state === 'claimed' || state === 'expired' ? (
              <details>
                <summary className="cursor-pointer text-sm font-medium text-zinc-500">
                  {title}（{items.length}）
                </summary>
                <div className="mt-2">{list}</div>
              </details>
            ) : (
              <>
                <h3 className="text-sm font-medium text-zinc-500">{title}</h3>
                {list}
              </>
            )}
          </section>
        )
      })}

      {editing && <GoalForm goal={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

type Period = 'week' | 'month' | 'custom'

function GoalForm({ goal, onClose }: { goal: Goal | null; onClose: () => void }) {
  const { data } = useStore()
  const habits = sortedHabits(data)
  const now = today()
  const [name, setName] = useState(goal?.name ?? '')
  const [type, setType] = useState<GoalType>(goal?.type ?? 'points')
  const [habitId, setHabitId] = useState(goal?.habit_id ?? habits[0]?.id ?? '')
  const [target, setTarget] = useState(String(goal?.target ?? ''))
  const [period, setPeriod] = useState<Period>(goal ? 'custom' : 'week')
  const [start, setStart] = useState(goal?.start_date ?? startOfWeek(now))
  const [end, setEnd] = useState(goal?.end_date ?? endOfWeek(now))
  const [reward, setReward] = useState(goal?.reward ?? '')
  const [bonus, setBonus] = useState(goal?.bonus_points ? String(goal.bonus_points) : '')

  const needsHabit = GOAL_TYPES[type].needsHabit
  const targetNum = parseIntInput(target)
  const bonusNum = bonus === '' ? 0 : parseIntInput(bonus)
  const valid =
    name.trim() !== '' &&
    targetNum !== null &&
    targetNum >= 1 &&
    bonusNum !== null &&
    bonusNum >= 0 &&
    start <= end &&
    (!needsHabit || !!data.habits[habitId])

  function pickPeriod(p: Period) {
    setPeriod(p)
    if (p === 'week') {
      setStart(startOfWeek(now))
      setEnd(endOfWeek(now))
    } else if (p === 'month') {
      setStart(startOfMonth(now))
      setEnd(endOfMonth(now))
    } else if (start === end) {
      setEnd(addDays(start, 29))
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!valid) return
    save('goals', {
      id: goal?.id ?? newId(),
      user_id: goal?.user_id ?? getUserId(),
      name: name.trim(),
      type,
      habit_id: needsHabit ? habitId : null,
      target: targetNum!,
      start_date: start,
      end_date: end,
      reward: reward.trim(),
      bonus_points: bonusNum!,
      claimed_at: goal?.claimed_at ?? null,
      deleted: false,
      updated_at: '',
    })
    onClose()
  }

  const unit = type === 'points' ? '分' : type === 'count' ? data.habits[habitId]?.unit || '次' : '天'

  return (
    <Modal title={goal ? '編輯目標' : '新增目標'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="目標名稱">
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：這週好好運動" autoFocus={!goal} required />
        </Field>
        <Field label="目標類型" hint={GOAL_TYPES[type].hint}>
          <div className="grid grid-cols-4 gap-1.5">
            {(Object.keys(GOAL_TYPES) as GoalType[]).map((t) => (
              <button
                type="button"
                key={t}
                onClick={() => setType(t)}
                className={`rounded-xl px-1 py-2 text-sm ${type === t ? 'bg-emerald-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800'}`}
              >
                {GOAL_TYPES[t].label}
              </button>
            ))}
          </div>
        </Field>
        {needsHabit &&
          (habits.length ? (
            <Field label="哪個習慣">
              <select className={input} value={habitId} onChange={(e) => setHabitId(e.target.value)}>
                {habits.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.icon} {h.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <p className="text-sm text-red-500">請先到「習慣」頁新增習慣。</p>
          ))}
        <Field label={`目標數值（${unit}）`}>
          <input className={input} type="number" inputMode="numeric" min={1} value={target} onChange={(e) => setTarget(e.target.value)} required />
        </Field>
        <Field label="期間">
          <div className="mb-2 grid grid-cols-3 gap-1.5">
            {(
              [
                ['week', '本週'],
                ['month', '本月'],
                ['custom', '自訂'],
              ] as [Period, string][]
            ).map(([p, label]) => (
              <button
                type="button"
                key={p}
                onClick={() => pickPeriod(p)}
                className={`rounded-xl py-2 text-sm ${period === p ? 'bg-emerald-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800'}`}
              >
                {label}
              </button>
            ))}
          </div>
          {period === 'custom' && (
            <div className="grid grid-cols-2 gap-2">
              <input className={input} type="date" value={start} onChange={(e) => setStart(e.target.value)} aria-label="開始日期" />
              <input className={input} type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} aria-label="結束日期" />
            </div>
          )}
          <span className="mt-1 block text-xs text-zinc-500">
            {formatShort(start)} – {formatShort(end)}，共 {daysBetween(start, end) + 1} 天
          </span>
        </Field>
        <Field label="達成後的獎勵（選填）">
          <input className={input} value={reward} onChange={(e) => setReward(e.target.value)} placeholder="例如：看一場電影" />
        </Field>
        <Field label="額外加分（選填）" hint="領取獎勵時加進可用分數，可以拿去獎勵商店兌換。">
          <input className={input} type="number" inputMode="numeric" min={0} value={bonus} onChange={(e) => setBonus(e.target.value)} placeholder="0" />
        </Field>
        <button className={`${btn.primary} w-full`} disabled={!valid}>
          儲存
        </button>
        {goal && (
          <div className="grid grid-cols-2 gap-3">
            {goal.claimed_at ? (
              <button
                type="button"
                className={btn.secondary}
                onClick={() => {
                  save('goals', { ...goal, claimed_at: null })
                  onClose()
                }}
              >
                取消領取
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              className={btn.danger}
              onClick={() => {
                if (!confirm(`確定要刪除目標「${goal.name}」嗎？`)) return
                save('goals', { ...goal, deleted: true })
                onClose()
              }}
            >
              刪除
            </button>
          </div>
        )}
      </form>
    </Modal>
  )
}
