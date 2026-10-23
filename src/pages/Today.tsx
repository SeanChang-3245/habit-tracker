import { useState } from 'react'
import { btn, card, EmptyState } from '../components/ui'
import { balance, dailyThreshold, dayPoints, getCount, sortedHabits } from '../lib/calc'
import { addDays, formatDate, today } from '../lib/date'
import { getUserId, save, useStore } from '../lib/store'
import type { Habit } from '../lib/types'

export function Today({ onAddHabit }: { onAddHabit: () => void }) {
  const { data } = useStore()
  const now = today()
  const [date, setDate] = useState(now)
  const habits = sortedHabits(data)
  const points = dayPoints(data, date)
  const doneCount = habits.filter((h) => getCount(data, h.id, date) >= dailyThreshold(h)).length

  function setCount(h: Habit, count: number) {
    save('habit_logs', {
      habit_id: h.id,
      user_id: getUserId(),
      date,
      count: Math.max(0, count),
      points: h.points,
      updated_at: '',
    })
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
        <button className={btn.ghost} onClick={() => setDate(addDays(date, 1))} disabled={date >= now} aria-label="後一天">
          ›
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label={date === now ? '今日得分' : '當日得分'} value={points} />
        <Stat label="已達標" value={`${doneCount}/${habits.length}`} />
        <Stat label="可用分數" value={balance(data).available} accent />
      </div>

      {habits.length === 0 ? (
        <EmptyState icon="🌱" title="還沒有任何習慣">
          <p className="text-sm text-zinc-500">先新增一個想養成的習慣，並設定完成一次可以得幾分。</p>
          <button className={btn.primary} onClick={onAddHabit}>
            ＋ 新增習慣
          </button>
        </EmptyState>
      ) : (
        <ul className="space-y-2.5">
          {habits.map((h) => {
            const count = getCount(data, h.id, date)
            const target = dailyThreshold(h)
            const done = count >= target
            return (
              <li
                key={h.id}
                className={`${card} flex items-center gap-3 p-3 transition ${
                  done ? 'bg-emerald-50 ring-emerald-300 dark:bg-emerald-950/40 dark:ring-emerald-800' : ''
                }`}
              >
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-zinc-100 text-2xl dark:bg-zinc-800">{h.icon}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">
                    {h.name} {done && <span className="text-emerald-600">✓</span>}
                  </div>
                  <div className="text-xs text-zinc-500">
                    每{h.unit} {h.points} 分{h.daily_target ? ` · 目標 ${count}/${target} ${h.unit}` : ''}
                  </div>
                </div>
                <button
                  className="grid h-10 w-10 place-items-center rounded-full bg-zinc-100 text-xl active:scale-90 disabled:opacity-30 dark:bg-zinc-800"
                  onClick={() => setCount(h, count - 1)}
                  disabled={count === 0}
                  aria-label={`${h.name} 減一`}
                >
                  −
                </button>
                <div className="w-12 text-center">
                  <div className="text-xl font-semibold tabular-nums">{count}</div>
                  <div className="text-[10px] text-zinc-500">{count * h.points} 分</div>
                </div>
                <button
                  className="grid h-10 w-10 place-items-center rounded-full bg-emerald-600 text-xl text-white active:scale-90"
                  onClick={() => setCount(h, count + 1)}
                  aria-label={`${h.name} 加一`}
                >
                  ＋
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className={`${card} p-3 text-center`}>
      <div className={`text-2xl font-bold tabular-nums ${accent ? 'text-emerald-600' : ''}`}>{value}</div>
      <div className="text-xs text-zinc-500">{label}</div>
    </div>
  )
}
