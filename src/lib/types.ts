export interface Habit {
  id: string
  user_id: string
  name: string
  icon: string
  /** 每完成一次（一個單位）得幾分，至少 1 分 */
  points: number
  unit: string
  /** 每日達標次數；null 代表做 1 次就算達標 */
  daily_target: number | null
  sort_order: number
  archived: boolean
  deleted: boolean
  updated_at: string
}

export interface HabitLog {
  habit_id: string
  user_id: string
  /** YYYY-MM-DD（本地日期） */
  date: string
  count: number
  /** 紀錄當下每次的分數 */
  points: number
  updated_at: string
}

export type GoalType = 'points' | 'count' | 'days' | 'streak'

export interface Goal {
  id: string
  user_id: string
  name: string
  type: GoalType
  habit_id: string | null
  target: number
  start_date: string
  end_date: string
  reward: string
  bonus_points: number
  claimed_at: string | null
  deleted: boolean
  updated_at: string
}

export interface Reward {
  id: string
  user_id: string
  name: string
  icon: string
  cost: number
  deleted: boolean
  updated_at: string
}

export interface Redemption {
  id: string
  user_id: string
  reward_id: string | null
  name: string
  cost: number
  redeemed_at: string
  deleted: boolean
  updated_at: string
}

export interface Todo {
  id: string
  user_id: string
  title: string
  notes: string
  /** 預估要花幾分鐘，30 的倍數 */
  estimate_minutes: number
  done: boolean
  done_at: string | null
  sort_order: number
  deleted: boolean
  updated_at: string
}

export interface ScheduleBlock {
  id: string
  user_id: string
  date: string
  /** 從 00:00 開始算的第幾個半小時，0–47 */
  start_slot: number
  /** 佔幾個半小時 */
  slots: number
  todo_id: string | null
  /** 沒有對應 todo 時顯示的名稱，例如「午餐」 */
  title: string
  deleted: boolean
  updated_at: string
}

export interface RowMap {
  habits: Habit
  habit_logs: HabitLog
  goals: Goal
  rewards: Reward
  redemptions: Redemption
  todos: Todo
  schedule_blocks: ScheduleBlock
}

export type TableName = keyof RowMap

export type Data = { [T in TableName]: Record<string, RowMap[T]> }
