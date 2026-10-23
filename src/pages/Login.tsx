import { useState, type FormEvent } from 'react'
import { btn, card, Field, input } from '../components/ui'
import { supabase } from '../lib/supabase'

function translate(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'Email 或密碼錯誤'
  if (/email not confirmed/i.test(message)) return '這個 Email 還沒驗證，請先到信箱點確認連結'
  if (/already registered/i.test(message)) return '這個 Email 已經註冊過了，請直接登入'
  if (/password should be at least/i.test(message)) return '密碼至少要 6 個字元'
  if (/signups not allowed/i.test(message)) return '目前不開放註冊'
  if (/failed to fetch|network/i.test(message)) return '連不上伺服器，請檢查網路'
  return message
}

export function Login() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setNotice(null)
    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(translate(error.message))
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin + import.meta.env.BASE_URL },
      })
      if (error) setError(translate(error.message))
      else if (!data.session) setNotice('註冊成功！請到信箱點確認連結，再回來登入。')
    }
    setBusy(false)
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <form onSubmit={submit} className={`${card} w-full max-w-sm space-y-4 p-6`}>
        <div className="text-center">
          <div className="text-5xl">🌱</div>
          <h1 className="mt-2 text-2xl font-bold">習慣養成</h1>
          <p className="mt-1 text-sm text-zinc-500">{mode === 'signin' ? '登入後手機與電腦會自動同步' : '建立你的帳號'}</p>
        </div>
        <Field label="Email">
          <input className={input} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="密碼">
          <input
            className={input}
            type="password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            minLength={6}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/50 dark:text-red-400">{error}</p>}
        {notice && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">{notice}</p>}
        <button className={`${btn.primary} w-full`} disabled={busy}>
          {busy ? '請稍候…' : mode === 'signin' ? '登入' : '註冊'}
        </button>
        <button
          type="button"
          className={`${btn.ghost} w-full text-sm`}
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin')
            setError(null)
            setNotice(null)
          }}
        >
          {mode === 'signin' ? '第一次使用？建立帳號' : '已經有帳號？登入'}
        </button>
      </form>
    </div>
  )
}
