-- Private in-app feedback inbox. Only the BackendDev server's service key may access rows.
create table if not exists public.user_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email text not null,
  category text not null check (category in ('Problem', 'Account', 'AI', 'Suggestion', 'Other')),
  subject text not null check (char_length(subject) between 3 and 120),
  message text not null check (char_length(message) between 10 and 3000),
  status text not null default 'New' check (status in ('New', 'In review', 'Resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_feedback enable row level security;
revoke all on table public.user_feedback from anon, authenticated;
grant all on table public.user_feedback to service_role;
create index if not exists user_feedback_created on public.user_feedback(created_at desc);
create index if not exists user_feedback_status_created on public.user_feedback(status, created_at desc);
