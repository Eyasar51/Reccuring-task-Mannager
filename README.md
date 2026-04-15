# Recurring Task Manager

A recurring task app with Supabase Auth so users can log in on a dedicated login page and sync tasks across devices.

## Features

- Separate login page (`login.html`) and task dashboard page (`index.html`)
- Email/password sign up and login
- Per-user task data (private by user account)
- Add, complete, and delete recurring tasks
- One-time or recurring tasks (day/week/month) with next-due date calculation
- Planning modes: none, timeboxing (duration), and time blocking (time range)

## 1) Supabase setup

Create a Supabase project.

### Table + RLS SQL

Run this in Supabase SQL editor:

```sql
create table if not exists public.recurring_tasks (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  interval integer not null check (interval > 0),
  unit text not null check (unit in ('once', 'day', 'week', 'month')),
  planning_mode text not null default 'none' check (planning_mode in ('none', 'timebox', 'timeblock')),
  timebox_minutes integer,
  block_start text,
  block_end text,
  last_completed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.recurring_tasks enable row level security;

create policy "Users can read their own tasks"
on public.recurring_tasks
for select
using (auth.uid() = user_id);

create policy "Users can insert their own tasks"
on public.recurring_tasks
for insert
with check (auth.uid() = user_id);

create policy "Users can update their own tasks"
on public.recurring_tasks
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own tasks"
on public.recurring_tasks
for delete
using (auth.uid() = user_id);
```

If your table already exists, run this migration:

```sql
alter table public.recurring_tasks
  drop constraint if exists recurring_tasks_unit_check;

alter table public.recurring_tasks
  add constraint recurring_tasks_unit_check
  check (unit in ('once', 'day', 'week', 'month'));

alter table public.recurring_tasks
  add column if not exists planning_mode text not null default 'none';

alter table public.recurring_tasks
  add column if not exists timebox_minutes integer;

alter table public.recurring_tasks
  add column if not exists block_start text;

alter table public.recurring_tasks
  add column if not exists block_end text;

alter table public.recurring_tasks
  drop constraint if exists recurring_tasks_planning_mode_check;

alter table public.recurring_tasks
  add constraint recurring_tasks_planning_mode_check
  check (planning_mode in ('none', 'timebox', 'timeblock'));
```

## 2) Add Supabase credentials to the app

Open both files and set:

- `auth.js` -> `SUPABASE_URL`, `SUPABASE_ANON_KEY`
- `app.js` -> `SUPABASE_URL`, `SUPABASE_ANON_KEY`

You can find values in **Supabase Dashboard -> Settings -> API Keys**.

## 3) Run locally

```bash
python -m http.server 8000
```

Then open <http://localhost:8000/login.html>.

## Troubleshooting

- If you see `Database schema needs update...`, run the migration SQL shown above once in Supabase SQL editor.
- For recurring tasks, the dashboard shows both **last completed** and **next due** timestamps so completion changes are visible immediately.
