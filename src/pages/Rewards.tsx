import { useState, type FormEvent } from 'react'
import { btn, card, EmojiPicker, EmptyState, Field, input, Modal, parseIntInput } from '../components/ui'
import { balance } from '../lib/calc'
import { getUserId, newId, save, useStore } from '../lib/store'
import type { Reward } from '../lib/types'

export function Rewards() {
  const { data } = useStore()
  const [editing, setEditing] = useState<Reward | 'new' | null>(null)
  const b = balance(data)
  const rewards = Object.values(data.rewards)
    .filter((r) => !r.deleted)
    .sort((a, c) => a.cost - c.cost)
  const history = Object.values(data.redemptions)
    .filter((r) => !r.deleted)
    .sort((a, c) => c.redeemed_at.localeCompare(a.redeemed_at))

  function redeem(r: Reward) {
    if (!confirm(`要花 ${r.cost} 分兌換「${r.name}」嗎？`)) return
    save('redemptions', {
      id: newId(),
      user_id: getUserId(),
      reward_id: r.id,
      name: `${r.icon} ${r.name}`,
      cost: r.cost,
      redeemed_at: new Date().toISOString(),
      deleted: false,
      updated_at: '',
    })
  }

  return (
    <div className="space-y-4">
      <div className={`${card} bg-gradient-to-br from-emerald-500 to-teal-600 p-5 text-white ring-0`}>
        <div className="text-sm opacity-90">可用分數</div>
        <div className="text-4xl font-bold tabular-nums">{b.available}</div>
        <div className="mt-1 text-xs opacity-80">
          習慣得分 {b.earned}　目標加分 {b.bonus}　已兌換 −{b.spent}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">獎勵商店</h2>
        <button className={btn.primary} onClick={() => setEditing('new')}>
          ＋ 新增
        </button>
      </div>

      {rewards.length === 0 ? (
        <EmptyState icon="🎁" title="還沒有獎勵">
          <p className="text-sm text-zinc-500">把想給自己的獎勵放進來，設定需要幾分才能兌換。例如：手搖飲 50 分、新遊戲 1000 分。</p>
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {rewards.map((r) => {
            const affordable = b.available >= r.cost
            return (
              <li key={r.id} className={`${card} flex flex-col p-3`}>
                <button className="flex-1 text-left" onClick={() => setEditing(r)}>
                  <div className="text-3xl">{r.icon}</div>
                  <div className="mt-1 font-medium">{r.name}</div>
                  <div className="text-sm text-zinc-500 tabular-nums">{r.cost} 分</div>
                </button>
                <button className={`${btn.primary} mt-2 py-2 text-sm`} disabled={!affordable} onClick={() => redeem(r)}>
                  {affordable ? '兌換' : `還差 ${r.cost - b.available} 分`}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {history.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-medium text-zinc-500">兌換紀錄</h3>
          <ul className={`${card} divide-y divide-zinc-100 dark:divide-zinc-800`}>
            {history.slice(0, 30).map((h) => (
              <li key={h.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="flex-1 truncate">{h.name}</span>
                <span className="text-zinc-500">{new Date(h.redeemed_at).toLocaleDateString('zh-TW')}</span>
                <span className="w-14 text-right tabular-nums">−{h.cost}</span>
                <button
                  className="text-xs text-zinc-400 hover:text-red-500"
                  onClick={() => confirm(`撤銷「${h.name}」的兌換，退回 ${h.cost} 分？`) && save('redemptions', { ...h, deleted: true })}
                >
                  撤銷
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {editing && <RewardForm reward={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function RewardForm({ reward, onClose }: { reward: Reward | null; onClose: () => void }) {
  const [name, setName] = useState(reward?.name ?? '')
  const [icon, setIcon] = useState(reward?.icon ?? '🎁')
  const [cost, setCost] = useState(reward ? String(reward.cost) : '')
  const costNum = parseIntInput(cost)
  const valid = name.trim() !== '' && costNum !== null && costNum >= 1

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!valid) return
    save('rewards', {
      id: reward?.id ?? newId(),
      user_id: reward?.user_id ?? getUserId(),
      name: name.trim(),
      icon,
      cost: costNum!,
      deleted: false,
      updated_at: '',
    })
    onClose()
  }

  return (
    <Modal title={reward ? '編輯獎勵' : '新增獎勵'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="獎勵名稱">
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：喝一杯手搖飲" autoFocus={!reward} required />
        </Field>
        <Field label="圖示">
          <EmojiPicker value={icon} onChange={setIcon} />
        </Field>
        <Field label="需要幾分">
          <input className={input} type="number" inputMode="numeric" min={1} value={cost} onChange={(e) => setCost(e.target.value)} required />
        </Field>
        <button className={`${btn.primary} w-full`} disabled={!valid}>
          儲存
        </button>
        {reward && (
          <button
            type="button"
            className={`${btn.danger} w-full`}
            onClick={() => {
              if (!confirm(`確定要刪除「${reward.name}」嗎？兌換紀錄會保留。`)) return
              save('rewards', { ...reward, deleted: true })
              onClose()
            }}
          >
            刪除
          </button>
        )}
      </form>
    </Modal>
  )
}
