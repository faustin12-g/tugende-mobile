create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  phone text not null unique,
  full_name text not null,
  role text not null check (role in ('passenger', 'driver')),
  bicycle_number text,
  created_at timestamptz not null default now(),
  constraint driver_bicycle_number_required
    check (role <> 'driver' or nullif(trim(bicycle_number), '') is not null)
);

alter table public.profiles enable row level security;

create policy "Users can read their own profile"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "Users can create their own profile"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
