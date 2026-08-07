create table if not exists public.submissions (
  id text primary key,
  platform text not null,
  epoch bigint not null,
  problem text not null,
  verdict text not null,
  ac boolean,
  language text,
  runtime_ms integer,
  memory_bytes bigint
);

create index if not exists submissions_epoch_idx on public.submissions (epoch desc);
create index if not exists submissions_platform_idx on public.submissions (platform);

alter table public.submissions enable row level security;
