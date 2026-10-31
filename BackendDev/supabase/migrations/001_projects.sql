-- Run in Supabase SQL editor. Authenticated users can only access their own projects.
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  language text not null,
  framework text not null default 'Custom',
  description text not null default '',
  files jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.projects enable row level security;
create policy "Users read their projects" on public.projects for select to authenticated using ((select auth.uid()) = owner_id);
create policy "Users create their projects" on public.projects for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "Users update their projects" on public.projects for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "Users delete their projects" on public.projects for delete to authenticated using ((select auth.uid()) = owner_id);
create index if not exists projects_owner_updated on public.projects(owner_id, updated_at desc);
