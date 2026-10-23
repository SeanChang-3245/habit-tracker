import { card } from '../components/ui'
import { balance, currentStreak, getCount, longestStreak, pointsByDate, pointsInRange, sortedHabits, dailyThreshold } from '../lib/calc'
import { addDays, endOfMonth, formatDate, startOfMonth, startOfWeek, today } from '../lib/date'
import { useStore } from '../lib/store'

const WEEKS = 18
const LEVELS = [
  'bg-zinc-100 dark:bg-zinc-800',
  'bg-emerald-200 dark:bg-emerald-900',
  'bg-emerald-300 dark:bg-emerald-700',
  'bg-emerald-500 dark:bg-emerald-500',
  'bg-emerald-700 dark:bg-emerald-300',
]

export function Stats() {
  const { data } = useStore()
  const now = today()
  const byDate = pointsByDate(data)
  const habits = sortedHabits(data)

  const firstDay = startOfWeek(addDays(now, -(WEEKS - 1) * 7))
  const weeks: string[][] = Array.from({ length: WEEKS }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(firstDay, w * 7 + d)))
  const max = Math.max(1, ...weeks.flat().map((d) => byDate.get(d) ?? 0))
  const level = (p: number) => (p <= 0 ? 0 : Math.min(4, Math.ceil((p / max) * 4)))
  const last30 = Array.from({ length: 30 }, (_, i) => addDays(now, -i))

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">統計</h2>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="本週得分" value={pointsInRange(data, startOfWeek(now), now)} />
        <Stat label="本月得分" value={pointsInRange(data, startOfMonth(now), endOfMonth(now))} />
        <Stat label="累積得分" value={balance(data).earned} />
      </div>

      <section className={`${card} p-4`}>
        <h3 className="mb-3 text-sm font-medium text-zinc-500">最近 {WEEKS} 週每日得分</h3>
        <div className="flex gap-[3px]">
          <div className="grid shrink-0 grid-rows-7 gap-[3px] pr-1 text-[10px] leading-none text-zinc-400">
            {'一二三四五六日'.split('').map((d) => (
              <div key={d} className="flex items-center">
                {d}
              </div>
            ))}
          </div>
          {weeks.map((week) => (
            <div key={week[0]} className="grid min-w-0 flex-1 grid-rows-7 gap-[3px]">
              {week.map((d) => {
                const p = byDate.get(d) ?? 0
                return (
                  <div
                    key={d}
                    title={`${formatDate(d)}：${p} 分`}
                    className={`aspect-square w-full rounded-[3px] ${d > now ? 'opacity-0' : LEVELS[level(p)]} ${d === now ? 'ring-1 ring-zinc-500' : ''}`}
                  />
                )
              })}
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-zinc-400">
          少
          {LEVELS.map((c) => (
            <span key={c} className={`h-2.5 w-2.5 rounded-[2px] ${c}`} />
          ))}
          多
        </div>
      </section>

      {habits.length > 0 && (
        <section className={`${card} divide-y divide-zinc-100 dark:divide-zinc-800`}>
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-2 text-xs text-zinc-500">
            <span>習慣</span>
            <span className="w-14 text-right">目前連續</span>
            <span className="w-14 text-right">最長連續</span>
            <span className="w-14 text-right">近 30 天</span>
          </div>
          {habits.map((h) => (
            <div key={h.id} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-4 py-2.5 text-sm">
              <span className="truncate">
                {h.icon} {h.name}
              </span>
              <span className="w-14 text-right tabular-nums">🔥 {currentStreak(data, h, now)}</span>
              <span className="w-14 text-right tabular-nums">{longestStreak(data, h)} 天</span>
              <span className="w-14 text-right tabular-nums">{last30.filter((d) => getCount(data, h.id, d) >= dailyThreshold(h)).length} 天</span>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className={`${card} p-3 text-center`}>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-zinc-500">{label}</div>
    </div>
  )
}
