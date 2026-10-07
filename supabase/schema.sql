create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique,
  phone text unique,
  full_name text not null,
  role text not null check (role in ('passenger', 'driver')),
  bicycle_number text,
  created_at timestamptz not null default now(),
  constraint driver_bicycle_number_required
    check (role <> 'driver' or nullif(trim(bicycle_number), '') is not null),
  constraint profile_contact_required
    check (email is not null or phone is not null)
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

-- ─── Enable PostGIS ─────────────────────────────────────────────
create extension if not exists postgis schema extensions;

-- ─── Ride Requests ──────────────────────────────────────────────
create table if not exists public.ride_requests (
  id uuid primary key default gen_random_uuid(),
  passenger_id uuid not null references public.profiles(id) on delete cascade,
  pickup_address text not null,
  pickup_lat double precision not null,
  pickup_lng double precision not null,
  pickup_location geography(Point, 4326) generated always as (
    st_setsrid(st_makepoint(pickup_lng, pickup_lat), 4326)::geography
  ) stored,
  destination_address text not null,
  destination_lat double precision not null,
  destination_lng double precision not null,
  distance_km numeric(6,2),
  duration_min integer,
  estimated_fare integer not null,
  passenger_offer integer not null check (passenger_offer > 0),
  status text not null default 'pending'
    check (status in ('pending', 'bidding', 'accepted', 'in_progress', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '5 minutes')
);

alter table public.ride_requests enable row level security;

-- Passengers can read their own requests
create policy "Passengers read own requests"
  on public.ride_requests for select
  to authenticated
  using ((select auth.uid()) = passenger_id);

-- Passengers can create their own requests
create policy "Passengers create requests"
  on public.ride_requests for insert
  to authenticated
  with check ((select auth.uid()) = passenger_id);

-- Passengers can cancel their own requests
create policy "Passengers update own requests"
  on public.ride_requests for update
  to authenticated
  using ((select auth.uid()) = passenger_id);

-- Drivers can read pending/bidding requests (for nearby query)
create policy "Drivers read pending requests"
  on public.ride_requests for select
  to authenticated
  using (
    status in ('pending', 'bidding')
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'driver'
    )
  );

-- Spatial index for nearby queries
create index if not exists idx_ride_requests_pickup_location
  on public.ride_requests using gist (pickup_location);

create index if not exists idx_ride_requests_status
  on public.ride_requests (status)
  where status in ('pending', 'bidding');
