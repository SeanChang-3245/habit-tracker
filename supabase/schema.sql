-- 習慣養成器資料表
-- 使用方式：Supabase 後台 → SQL Editor → New query → 貼上全部內容 → Run
-- 重複執行是安全的。

create table if not exists public.habits (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  icon text not null default '✅',
  points integer not null default 1 check (points >= 1),
  unit text not null default '次',
  daily_target integer check (daily_target is null or daily_target >= 1),
  sort_order integer not null default 0,
  archived boolean not null default false,
  deleted boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.habit_logs (
  habit_id uuid not null references public.habits on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  date date not null,
  count integer not null default 0 check (count >= 0),
  points integer not null default 1 check (points >= 1),
  updated_at timestamptz not null default now(),
  primary key (habit_id, date)
);

create table if not exists public.goals (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  type text not null check (type in ('points', 'count', 'days', 'streak')),
  habit_id uuid references public.habits on delete set null,
  target integer not null check (target >= 1),
  start_date date not null,
  end_date date not null,
  reward text not null default '',
  bonus_points integer not null default 0 check (bonus_points >= 0),
  claimed_at timestamptz,
  deleted boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.rewards (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  icon text not null default '🎁',
  cost integer not null check (cost >= 1),
  deleted boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.redemptions (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  reward_id uuid references public.rewards on delete set null,
  name text not null,
  cost integer not null check (cost >= 1),
  redeemed_at timestamptz not null default now(),
  deleted boolean not null default false,
  updated_at timestamptz not null default now()
);

-- 每個人只能讀寫自己的資料
do $$
declare t text;
begin
  foreach t in array array['habits', 'habit_logs', 'goals', 'rewards', 'redemptions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;
