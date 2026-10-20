-- 执灯人 · 自动记账云收件箱（Supabase）
-- 只给 Edge Function 用 service_role 访问；不开任何 anon 策略。
create extension if not exists pgcrypto;

create table if not exists public.inbox (
  id uuid primary key default gen_random_uuid(),
  amount numeric(12,2) not null check (amount > 0),
  type text not null default 'expense' check (type in ('expense', 'income')),
  cat text not null default '日常',
  note text,
  account text,
  date date,
  source text default 'shortcut',
  created_at timestamptz not null default now()
);

create index if not exists inbox_created_at_idx on public.inbox (created_at);

alter table public.inbox enable row level security;
-- 不建 policy：anon / authenticated 都读不到，只有 service_role（Edge Function）可以。

-- 可选：只保留 90 天，避免无限增长
-- delete from public.inbox where created_at < now() - interval '90 days';
