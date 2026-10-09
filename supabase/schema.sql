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
  with check (
    (select auth.uid()) = passenger_id
    and passenger_offer > 0
  );

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
    and passenger_offer is not null
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

-- ─── Driver Bids ───────────────────────────────────────────────
create table if not exists public.ride_bids (
  id uuid primary key default gen_random_uuid(),
  ride_request_id uuid not null references public.ride_requests(id) on delete cascade,
  driver_id uuid not null references public.profiles(id) on delete cascade,
  proposed_fare integer not null check (proposed_fare > 0),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  constraint one_bid_per_driver_per_request unique (ride_request_id, driver_id)
);

alter table public.ride_bids enable row level security;

create policy "Drivers submit bids on open requests"
  on public.ride_bids for insert
  to authenticated
  with check (
    (select auth.uid()) = driver_id
    and exists (
      select 1
      from public.profiles
      where id = (select auth.uid()) and role = 'driver'
    )
    and exists (
      select 1
      from public.ride_requests
      where id = ride_request_id
        and status in ('pending', 'bidding')
        and expires_at > now()
    )
  );

create policy "Drivers and passengers read relevant bids"
  on public.ride_bids for select
  to authenticated
  using (
    driver_id = (select auth.uid())
    or exists (
      select 1 from public.ride_requests
      where id = ride_request_id and passenger_id = (select auth.uid())
    )
  );

create or replace function public.mark_ride_request_as_bidding()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.ride_requests
  set status = 'bidding'
  where id = new.ride_request_id and status = 'pending';
  return new;
end;
$$;

drop trigger if exists ride_bids_mark_request_as_bidding on public.ride_bids;
create trigger ride_bids_mark_request_as_bidding
  after insert on public.ride_bids
  for each row execute function public.mark_ride_request_as_bidding();

create or replace function public.get_ride_bids(p_request_id uuid)
returns table (
  id uuid,
  driver_id uuid,
  driver_name text,
  bicycle_number text,
  proposed_fare integer,
  status text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select b.id, b.driver_id, p.full_name, p.bicycle_number,
         b.proposed_fare, b.status, b.created_at
  from public.ride_bids b
  join public.ride_requests r on r.id = b.ride_request_id
  join public.profiles p on p.id = b.driver_id
  where r.id = p_request_id
    and r.passenger_id = (select auth.uid())
  order by b.created_at;
$$;

create or replace function public.respond_to_ride_bid(p_bid_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  request_owner uuid;
  request_status text;
  bid_request_id uuid;
  bid_status text;
begin
  select r.passenger_id, r.status, b.ride_request_id, b.status
  into request_owner, request_status, bid_request_id, bid_status
  from public.ride_bids b
  join public.ride_requests r on r.id = b.ride_request_id
  where b.id = p_bid_id
  for update of r, b;

  if request_owner is distinct from (select auth.uid()) then
    raise exception 'You are not allowed to respond to this bid.';
  end if;

  if request_status not in ('pending', 'bidding') or bid_status <> 'pending' then
    raise exception 'This bid is no longer available.';
  end if;

  if p_accept then
    update public.ride_bids
    set status = case when id = p_bid_id then 'accepted' else 'rejected' end
    where ride_request_id = bid_request_id and status = 'pending';

    update public.ride_requests
    set status = 'accepted'
    where id = bid_request_id;
  else
    update public.ride_bids set status = 'rejected' where id = p_bid_id;

    if not exists (
      select 1 from public.ride_bids
      where ride_request_id = bid_request_id and status = 'pending'
    ) then
      update public.ride_requests
      set status = 'pending'
      where id = bid_request_id and status = 'bidding';
    end if;
  end if;
end;
$$;

revoke all on function public.get_ride_bids(uuid) from public, anon;
grant execute on function public.get_ride_bids(uuid) to authenticated;
revoke all on function public.respond_to_ride_bid(uuid, boolean) from public, anon;
grant execute on function public.respond_to_ride_bid(uuid, boolean) to authenticated;
