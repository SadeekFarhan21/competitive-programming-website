-- Codeforces, LeetCode and AtCoder history, mirrored from data/submissions.json by scripts/sync-supabase.mjs
-- after every refresh. lib/store.ts reads the 200 newest rows and merges them
-- over the bundled JSON.
create table if not exists public.submissions (
  key text primary key,          -- "<platform>:<id ?? epoch>", same dedupe key as lib/store.ts
  id text,                       -- judge submission id; null for rows keyed by epoch
  platform text not null,
  epoch bigint not null,
  problem text not null,
  problem_id text,               -- CSES task id
  url text,
  verdict text not null,
  ac boolean,
  language text,
  runtime_ms integer,
  memory_bytes bigint,
  synced_at timestamptz not null default now()
);

create index if not exists submissions_epoch_idx on public.submissions (epoch desc);

-- Public, read-only: the site reads with the publishable key, and only the
-- refresh workflow's service-role key (which bypasses RLS) can write.
alter table public.submissions enable row level security;

drop policy if exists "Submissions are publicly readable" on public.submissions;
create policy "Submissions are publicly readable"
  on public.submissions for select
  to anon, authenticated
  using (true);
