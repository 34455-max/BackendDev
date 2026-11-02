-- Private per-user GitHub credentials. Tokens are encrypted by BackendDev before storage.
create table if not exists public.github_connections (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  token_iv text not null,
  token_tag text not null,
  token_ciphertext text not null,
  updated_at timestamptz not null default now()
);
alter table public.github_connections enable row level security;
revoke all on table public.github_connections from anon, authenticated;
