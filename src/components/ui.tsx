import { useEffect, type ReactNode } from 'react'

export const card = 'rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200/70 dark:bg-zinc-900 dark:ring-zinc-800'

export const input =
  'w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-base outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 dark:border-zinc-700 dark:bg-zinc-800'

const btnBase =
  'inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 font-medium transition active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40'

export const btn = {
  primary: `${btnBase} bg-emerald-600 text-white hover:bg-emerald-700`,
  secondary: `${btnBase} bg-zinc-100 text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700`,
  danger: `${btnBase} bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950/50 dark:text-red-400`,
  ghost: `${btnBase} text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800`,
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className="max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:max-w-md sm:rounded-3xl dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="關閉" className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-zinc-500">{hint}</span>}
    </label>
  )
}

const EMOJIS = ['✅', '💧', '🏃', '📖', '🧘', '💪', '🥗', '😴', '✍️', '🎸', '🧹', '💊', '🚶', '🧠', '🌱', '☀️', '🎁', '🍰', '🎮', '🎬', '☕', '🛍️', '✈️', '🍜']

function lastGrapheme(s: string): string {
  const parts = [...new Intl.Segmenter().segment(s)]
  return parts.length ? parts[parts.length - 1].segment : ''
}

export function EmojiPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {EMOJIS.map((e) => (
        <button
          type="button"
          key={e}
          onClick={() => onChange(e)}
          className={`grid h-10 w-10 place-items-center rounded-xl text-xl ${
            value === e ? 'bg-emerald-100 ring-2 ring-emerald-500 dark:bg-emerald-900/50' : 'bg-zinc-100 dark:bg-zinc-800'
          }`}
        >
          {e}
        </button>
      ))}
      <input
        aria-label="自訂圖示"
        className={`${input} h-10 w-16 px-2 text-center text-xl`}
        value={EMOJIS.includes(value) ? '' : value}
        placeholder="自訂"
        onChange={(e) => onChange(lastGrapheme(e.target.value) || '✅')}
      />
    </div>
  )
}

export function EmptyState({ icon, title, children }: { icon: string; title: string; children?: ReactNode }) {
  return (
    <div className={`${card} flex flex-col items-center gap-3 px-6 py-10 text-center`}>
      <div className="text-5xl">{icon}</div>
      <div className="font-medium">{title}</div>
      {children}
    </div>
  )
}

export function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, max > 0 ? (value / max) * 100 : 0)
  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
      <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
    </div>
  )
}

/** 解析正整數輸入；空字串回傳 null */
export function parseIntInput(v: string): number | null {
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? n : null
}
