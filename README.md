# Recurring Task Manager

A lightweight recurring-task web app that can sync across devices using Supabase.

## Features

- Add recurring tasks (days, weeks, months)
- Mark a task complete and auto-calculate the next due date
- Delete tasks
- Local storage fallback
- Optional cloud sync across devices using a shared sync key

## 1) Supabase setup (for cross-device sync)

Create a project in Supabase, then run this SQL in the SQL editor:

```sql
create table if not exists recurring_tasks (
  id text primary key,
  sync_key text not null,
  name text not null,
  interval integer not null,
  unit text not null check (unit in ('day', 'week', 'month')),
  last_completed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table recurring_tasks enable row level security;

create policy "Allow public read/write with sync key"
on recurring_tasks
for all
using (true)
with check (true);
```

> Note: This is intentionally simple for MVP use. For production security, replace with real user auth + strict RLS policies.

## 2) Run locally

```bash
python -m http.server 8000
```

Open <http://localhost:8000>.

## 3) Enable sync in the app

In the app UI, fill:

- Supabase URL
- Supabase anon key
- Sync key (same value on all devices)

Then click **Save Sync Settings**.

