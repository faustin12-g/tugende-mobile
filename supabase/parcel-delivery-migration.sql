create table if not exists public.parcel_deliveries (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  pickup_address text not null,
  pickup_lat double precision not null,
  pickup_lng double precision not null,
  pickup_location geography(Point, 4326) generated always as (
    st_setsrid(st_makepoint(pickup_lng, pickup_lat), 4326)::geography
  ) stored,
  destination_address text not null,
  destination_lat double precision not null,
  destination_lng double precision not null,
  sender_name text not null,
  sender_phone text not null,
  recipient_name text not null,
  recipient_phone text not null,
  distance_km numeric(6,2) not null,
  duration_min integer not null,
  estimated_fare integer not null check (estimated_fare > 0),
  sender_offer integer not null check (sender_offer > 0),
  status text not null default 'pending'
    check (status in ('pending', 'bidding', 'accepted', 'in_progress', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '5 minutes')
);

alter table public.parcel_deliveries enable row level security;

drop policy if exists "Senders read own parcel deliveries" on public.parcel_deliveries;
create policy "Senders read own parcel deliveries"
  on public.parcel_deliveries for select
  to authenticated
  using ((select auth.uid()) = sender_id);

drop policy if exists "Drivers read open parcel deliveries" on public.parcel_deliveries;
create policy "Drivers read open parcel deliveries"
  on public.parcel_deliveries for select
  to authenticated
  using (
    status in ('pending', 'bidding')
    and expires_at > now()
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'driver'
    )
  );

drop policy if exists "Senders create parcel deliveries" on public.parcel_deliveries;
create policy "Senders create parcel deliveries"
  on public.parcel_deliveries for insert
  to authenticated
  with check (
    (select auth.uid()) = sender_id
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'passenger'
    )
  );

drop policy if exists "Senders cancel own parcel deliveries" on public.parcel_deliveries;
create policy "Senders cancel own parcel deliveries"
  on public.parcel_deliveries for update
  to authenticated
  using ((select auth.uid()) = sender_id)
  with check ((select auth.uid()) = sender_id and status = 'cancelled');

revoke all on public.parcel_deliveries from authenticated;
grant select (
  id, sender_id, pickup_address, pickup_lat, pickup_lng,
  destination_address, destination_lat, destination_lng,
  distance_km, duration_min, estimated_fare, sender_offer, status,
  created_at, expires_at
) on public.parcel_deliveries to authenticated;
grant insert (
  sender_id, pickup_address, pickup_lat, pickup_lng,
  destination_address, destination_lat, destination_lng,
  sender_name, sender_phone, recipient_name, recipient_phone,
  distance_km, duration_min, estimated_fare, sender_offer
) on public.parcel_deliveries to authenticated;
grant update (status) on public.parcel_deliveries to authenticated;

create index if not exists idx_parcel_deliveries_pickup_location
  on public.parcel_deliveries using gist (pickup_location);

create index if not exists idx_parcel_deliveries_status
  on public.parcel_deliveries (status)
  where status in ('pending', 'bidding');

create table if not exists public.parcel_bids (
  id uuid primary key default gen_random_uuid(),
  parcel_delivery_id uuid not null references public.parcel_deliveries(id) on delete cascade,
  driver_id uuid not null references public.profiles(id) on delete cascade,
  proposed_fare integer not null check (proposed_fare > 0),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  constraint one_parcel_bid_per_driver unique (parcel_delivery_id, driver_id)
);

alter table public.parcel_bids enable row level security;
grant select, insert on public.parcel_bids to authenticated;

drop policy if exists "Drivers submit bids on open parcels" on public.parcel_bids;
create policy "Drivers submit bids on open parcels"
  on public.parcel_bids for insert
  to authenticated
  with check (
    (select auth.uid()) = driver_id
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'driver'
    )
    and exists (
      select 1 from public.parcel_deliveries
      where id = parcel_delivery_id
        and status in ('pending', 'bidding')
        and expires_at > now()
    )
  );

drop policy if exists "Drivers and senders read relevant parcel bids" on public.parcel_bids;
create policy "Drivers and senders read relevant parcel bids"
  on public.parcel_bids for select
  to authenticated
  using (
    driver_id = (select auth.uid())
    or exists (
      select 1 from public.parcel_deliveries
      where id = parcel_delivery_id and sender_id = (select auth.uid())
    )
  );

create or replace function public.mark_parcel_delivery_as_bidding()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.parcel_deliveries
  set status = 'bidding'
  where id = new.parcel_delivery_id and status = 'pending';
  return new;
end;
$$;

drop trigger if exists parcel_bids_mark_delivery_as_bidding on public.parcel_bids;
create trigger parcel_bids_mark_delivery_as_bidding
  after insert on public.parcel_bids
  for each row execute function public.mark_parcel_delivery_as_bidding();

create or replace function public.get_parcel_bids(p_delivery_id uuid)
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
  from public.parcel_bids b
  join public.parcel_deliveries d on d.id = b.parcel_delivery_id
  join public.profiles p on p.id = b.driver_id
  where d.id = p_delivery_id
    and d.sender_id = (select auth.uid())
  order by b.created_at;
$$;

create or replace function public.respond_to_parcel_bid(p_bid_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  delivery_owner uuid;
  delivery_status text;
  bid_delivery_id uuid;
  bid_status text;
begin
  select d.sender_id, d.status, b.parcel_delivery_id, b.status
  into delivery_owner, delivery_status, bid_delivery_id, bid_status
  from public.parcel_bids b
  join public.parcel_deliveries d on d.id = b.parcel_delivery_id
  where b.id = p_bid_id
  for update of d, b;

  if delivery_owner is distinct from (select auth.uid()) then
    raise exception 'You are not allowed to respond to this parcel bid.';
  end if;

  if delivery_status not in ('pending', 'bidding') or bid_status <> 'pending' then
    raise exception 'This parcel bid is no longer available.';
  end if;

  if p_accept then
    update public.parcel_bids
    set status = case when id = p_bid_id then 'accepted' else 'rejected' end
    where parcel_delivery_id = bid_delivery_id and status = 'pending';

    update public.parcel_deliveries
    set status = 'accepted'
    where id = bid_delivery_id;
  else
    update public.parcel_bids set status = 'rejected' where id = p_bid_id;

    if not exists (
      select 1 from public.parcel_bids
      where parcel_delivery_id = bid_delivery_id and status = 'pending'
    ) then
      update public.parcel_deliveries
      set status = 'pending'
      where id = bid_delivery_id and status = 'bidding';
    end if;
  end if;
end;
$$;

revoke all on function public.get_parcel_bids(uuid) from public, anon;
grant execute on function public.get_parcel_bids(uuid) to authenticated;
revoke all on function public.respond_to_parcel_bid(uuid, boolean) from public, anon;
grant execute on function public.respond_to_parcel_bid(uuid, boolean) to authenticated;

notify pgrst, 'reload schema';
