# Recurring Task Manager

A recurring task app with Supabase Auth so users can log in on a dedicated login page and sync tasks across devices.

## Features

- Separate login page (`login.html`) and task dashboard page (`index.html`)
- Email/password sign up and login
- Per-user task data (private by user account)
- Add, complete, and delete recurring tasks
- Day/week/month recurrence with next-due date calculation

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
  unit text not null check (unit in ('day', 'week', 'month')),
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
