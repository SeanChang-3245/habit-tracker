import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { balance } from './lib/calc'
import { initStore, resetStore, syncNow, useStore } from './lib/store'
import { supabase } from './lib/supabase'
import { Goals } from './pages/Goals'
import { Habits } from './pages/Habits'
import { Login } from './pages/Login'
import { Rewards } from './pages/Rewards'
import { Stats } from './pages/Stats'
import { Today } from './pages/Today'

const TABS = [
  { id: 'today', label: '今天', icon: '☀️' },
  { id: 'habits', label: '習慣', icon: '📝' },
  { id: 'goals', label: '目標', icon: '🎯' },
  { id: 'rewards', label: '獎勵', icon: '🎁' },
  { id: 'stats', label: '統計', icon: '📊' },
] as const
type Tab = (typeof TABS)[number]['id']

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const uid = session?.user.id
  useEffect(() => {
    if (uid) initStore(uid)
    else resetStore()
  }, [uid])

  if (session === undefined) return <div className="grid min-h-dvh place-items-center text-4xl">🌱</div>
  if (!session) return <Login />
  return <Main email={session.user.email ?? ''} />
}

function Main({ email }: { email: string }) {
  const { data, sync } = useStore()
  const [tab, setTab] = useState<Tab>('today')
  const [addingHabit, setAddingHabit] = useState(false)

  const syncLabel = {
    idle: sync.pending ? '儲存中…' : '已同步',
    syncing: '同步中…',
    offline: sync.pending ? `離線，${sync.pending} 筆待上傳` : '離線',
    error: '同步失敗，點此重試',
  }[sync.status]
  const syncColor = {
    idle: sync.pending ? 'bg-amber-400' : 'bg-emerald-500',
    syncing: 'bg-sky-400 animate-pulse',
    offline: 'bg-zinc-400',
    error: 'bg-red-500',
  }[sync.status]

  return (
    <div className="mx-auto min-h-dvh max-w-2xl pb-[calc(5rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-10 flex items-center justify-between bg-zinc-50/90 px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3 backdrop-blur dark:bg-zinc-950/90">
        <h1 className="text-lg font-bold">🌱 習慣養成</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void syncNow()}
            title={sync.error ?? (sync.lastSync ? `上次同步：${new Date(sync.lastSync).toLocaleString('zh-TW')}` : '')}
            className="flex items-center gap-1.5 rounded-full px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-200/60 dark:hover:bg-zinc-800"
          >
            <span className={`h-2 w-2 rounded-full ${syncColor}`} />
            {syncLabel}
          </button>
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-sm font-semibold text-emerald-700 tabular-nums dark:bg-emerald-900/50 dark:text-emerald-300">
            💎 {balance(data).available}
          </span>
        </div>
      </header>

      <main className="px-4 pt-1">
        {tab === 'today' && (
          <Today
            onAddHabit={() => {
              setTab('habits')
              setAddingHabit(true)
            }}
          />
        )}
        {tab === 'habits' && <Habits adding={addingHabit} setAdding={setAddingHabit} />}
        {tab === 'goals' && <Goals />}
        {tab === 'rewards' && <Rewards />}
        {tab === 'stats' && (
          <div className="space-y-4">
            <Stats />
            <div className="flex items-center justify-between pt-4 text-sm text-zinc-500">
              <span className="truncate">{email}</span>
              <button className="rounded-lg px-3 py-1.5 hover:bg-zinc-200/60 dark:hover:bg-zinc-800" onClick={() => confirm('確定要登出嗎？') && void supabase.auth.signOut()}>
                登出
              </button>
            </div>
          </div>
        )}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
        <div className="mx-auto grid max-w-2xl grid-cols-5">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex flex-col items-center gap-0.5 py-2 text-xs ${tab === t.id ? 'font-semibold text-emerald-600' : 'text-zinc-500'}`}
            >
              <span className={`text-xl transition ${tab === t.id ? 'scale-110' : 'opacity-60 grayscale'}`}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
