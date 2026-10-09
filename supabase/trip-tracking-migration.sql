create extension if not exists pgcrypto;

alter table public.ride_requests
  add column if not exists assigned_driver_id uuid references public.profiles(id),
  add column if not exists completed_at timestamptz;

alter table public.parcel_deliveries
  add column if not exists assigned_driver_id uuid references public.profiles(id),
  add column if not exists completed_at timestamptz;

create table if not exists public.trip_tracking_locations (
  id uuid primary key default gen_random_uuid(),
  ride_request_id uuid references public.ride_requests(id) on delete cascade,
  parcel_delivery_id uuid references public.parcel_deliveries(id) on delete cascade,
  driver_id uuid not null references public.profiles(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  heading double precision check (heading >= 0 and heading < 360),
  updated_at timestamptz not null default now(),
  constraint one_tracking_target check (
    (ride_request_id is not null and parcel_delivery_id is null)
    or (ride_request_id is null and parcel_delivery_id is not null)
  )
);

create unique index if not exists idx_tracking_ride_unique
  on public.trip_tracking_locations (ride_request_id)
  where ride_request_id is not null;

create unique index if not exists idx_tracking_parcel_unique
  on public.trip_tracking_locations (parcel_delivery_id)
  where parcel_delivery_id is not null;

alter table public.trip_tracking_locations enable row level security;
revoke all on public.trip_tracking_locations from anon, authenticated;

create table if not exists public.trip_tracking_shares (
  id uuid primary key default gen_random_uuid(),
  ride_request_id uuid references public.ride_requests(id) on delete cascade,
  parcel_delivery_id uuid references public.parcel_deliveries(id) on delete cascade,
  token_hash text not null unique,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  constraint one_share_target check (
    (ride_request_id is not null and parcel_delivery_id is null)
    or (ride_request_id is null and parcel_delivery_id is not null)
  )
);

alter table public.trip_tracking_shares enable row level security;
revoke all on public.trip_tracking_shares from anon, authenticated;

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
  bid_driver_id uuid;
  bid_status text;
begin
  select r.passenger_id, r.status, b.ride_request_id, b.driver_id, b.status
  into request_owner, request_status, bid_request_id, bid_driver_id, bid_status
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
    set status = 'accepted', assigned_driver_id = bid_driver_id
    where id = bid_request_id;
  else
    update public.ride_bids set status = 'rejected' where id = p_bid_id;
    if not exists (
      select 1 from public.ride_bids
      where ride_request_id = bid_request_id and status = 'pending'
    ) then
      update public.ride_requests set status = 'pending'
      where id = bid_request_id and status = 'bidding';
    end if;
  end if;
end;
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
  bid_driver_id uuid;
  bid_status text;
begin
  select d.sender_id, d.status, b.parcel_delivery_id, b.driver_id, b.status
  into delivery_owner, delivery_status, bid_delivery_id, bid_driver_id, bid_status
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
    set status = 'accepted', assigned_driver_id = bid_driver_id
    where id = bid_delivery_id;
  else
    update public.parcel_bids set status = 'rejected' where id = p_bid_id;
    if not exists (
      select 1 from public.parcel_bids
      where parcel_delivery_id = bid_delivery_id and status = 'pending'
    ) then
      update public.parcel_deliveries set status = 'pending'
      where id = bid_delivery_id and status = 'bidding';
    end if;
  end if;
end;
$$;

create or replace function public.set_trip_status(p_type text, p_trip_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  changed_rows integer;
begin
  if p_status not in ('in_progress', 'completed') then
    raise exception 'Unsupported trip status.';
  end if;

  if p_type = 'ride' then
    update public.ride_requests
    set status = p_status,
        completed_at = case when p_status = 'completed' then now() else null end
    where id = p_trip_id
      and assigned_driver_id = (select auth.uid())
      and ((p_status = 'in_progress' and status = 'accepted')
        or (p_status = 'completed' and status = 'in_progress'));
  elsif p_type = 'parcel' then
    update public.parcel_deliveries
    set status = p_status,
        completed_at = case when p_status = 'completed' then now() else null end
    where id = p_trip_id
      and assigned_driver_id = (select auth.uid())
      and ((p_status = 'in_progress' and status = 'accepted')
        or (p_status = 'completed' and status = 'in_progress'));
  else
    raise exception 'Unsupported trip type.';
  end if;

  get diagnostics changed_rows = row_count;
  if changed_rows = 0 then
    raise exception 'Trip not found or no longer available for this action.';
  end if;

  if p_status = 'completed' then
    update public.trip_tracking_shares
    set expires_at = now() + interval '24 hours'
    where ((p_type = 'ride' and ride_request_id = p_trip_id)
        or (p_type = 'parcel' and parcel_delivery_id = p_trip_id))
      and revoked_at is null;
  end if;
end;
$$;

create or replace function public.publish_trip_location(
  p_type text,
  p_trip_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_heading double precision
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  assigned_driver uuid;
  trip_status text;
begin
  if p_latitude not between -90 and 90
     or p_longitude not between -180 and 180
     or (p_heading is not null and (p_heading < 0 or p_heading >= 360)) then
    raise exception 'Invalid location coordinates.';
  end if;

  if p_type = 'ride' then
    select assigned_driver_id, status into assigned_driver, trip_status
    from public.ride_requests where id = p_trip_id;
  elsif p_type = 'parcel' then
    select assigned_driver_id, status into assigned_driver, trip_status
    from public.parcel_deliveries where id = p_trip_id;
  else
    raise exception 'Unsupported trip type.';
  end if;

  if assigned_driver is distinct from (select auth.uid()) or trip_status <> 'in_progress' then
    raise exception 'Only the assigned driver can share location during an active trip.';
  end if;

  if p_type = 'ride' then
    insert into public.trip_tracking_locations (
      ride_request_id, driver_id, latitude, longitude, heading, updated_at
    ) values (p_trip_id, assigned_driver, p_latitude, p_longitude, p_heading, now())
    on conflict (ride_request_id) where ride_request_id is not null
    do update set latitude = excluded.latitude, longitude = excluded.longitude,
      heading = excluded.heading, updated_at = now();
  else
    insert into public.trip_tracking_locations (
      parcel_delivery_id, driver_id, latitude, longitude, heading, updated_at
    ) values (p_trip_id, assigned_driver, p_latitude, p_longitude, p_heading, now())
    on conflict (parcel_delivery_id) where parcel_delivery_id is not null
    do update set latitude = excluded.latitude, longitude = excluded.longitude,
      heading = excluded.heading, updated_at = now();
  end if;
end;
$$;

create or replace function public.get_trip_tracking(p_type text, p_trip_id uuid)
returns table (
  trip_type text,
  trip_id uuid,
  status text,
  pickup_address text,
  pickup_lat double precision,
  pickup_lng double precision,
  destination_address text,
  destination_lat double precision,
  destination_lng double precision,
  driver_latitude double precision,
  driver_longitude double precision,
  driver_heading double precision,
  location_updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_type = 'ride' then
    return query
    select 'ride'::text, r.id, r.status, r.pickup_address, r.pickup_lat, r.pickup_lng,
      r.destination_address, r.destination_lat, r.destination_lng,
      l.latitude, l.longitude, l.heading, l.updated_at
    from public.ride_requests r
    left join public.trip_tracking_locations l on l.ride_request_id = r.id
    where r.id = p_trip_id
      and (r.passenger_id = (select auth.uid()) or r.assigned_driver_id = (select auth.uid()));
  elsif p_type = 'parcel' then
    return query
    select 'parcel'::text, d.id, d.status, d.pickup_address, d.pickup_lat, d.pickup_lng,
      d.destination_address, d.destination_lat, d.destination_lng,
      l.latitude, l.longitude, l.heading, l.updated_at
    from public.parcel_deliveries d
    left join public.trip_tracking_locations l on l.parcel_delivery_id = d.id
    where d.id = p_trip_id
      and (d.sender_id = (select auth.uid()) or d.assigned_driver_id = (select auth.uid()));
  else
    raise exception 'Unsupported trip type.';
  end if;
end;
$$;

create or replace function public.create_trip_tracking_share(
  p_type text,
  p_trip_id uuid,
  p_token text
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  share_id uuid;
  is_owner boolean := false;
  trip_status text;
begin
  if length(p_token) < 40 then
    raise exception 'Tracking token is invalid.';
  end if;

  if p_type = 'ride' then
    select passenger_id = (select auth.uid()), status
    into is_owner, trip_status from public.ride_requests where id = p_trip_id;
  elsif p_type = 'parcel' then
    select sender_id = (select auth.uid()), status
    into is_owner, trip_status from public.parcel_deliveries where id = p_trip_id;
  else
    raise exception 'Unsupported trip type.';
  end if;

  if is_owner is distinct from true or trip_status not in ('accepted', 'in_progress') then
    raise exception 'Only the trip owner can share an accepted or active trip.';
  end if;

  update public.trip_tracking_shares
  set revoked_at = now()
  where ((p_type = 'ride' and ride_request_id = p_trip_id)
      or (p_type = 'parcel' and parcel_delivery_id = p_trip_id))
    and revoked_at is null;

  insert into public.trip_tracking_shares (
    ride_request_id, parcel_delivery_id, token_hash, created_by
  ) values (
    case when p_type = 'ride' then p_trip_id else null end,
    case when p_type = 'parcel' then p_trip_id else null end,
    encode(digest(p_token, 'sha256'), 'hex'),
    (select auth.uid())
  )
  returning id into share_id;

  return share_id;
end;
$$;

create or replace function public.revoke_trip_tracking_share(p_share_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  changed_rows integer;
begin
  update public.trip_tracking_shares
  set revoked_at = now()
  where id = p_share_id and created_by = (select auth.uid()) and revoked_at is null;
  get diagnostics changed_rows = row_count;
  if changed_rows = 0 then
    raise exception 'Share link not found or already revoked.';
  end if;
end;
$$;

create or replace function public.get_public_trip_tracking(p_token text)
returns table (
  trip_type text,
  trip_id uuid,
  status text,
  pickup_address text,
  pickup_lat double precision,
  pickup_lng double precision,
  destination_address text,
  destination_lat double precision,
  destination_lng double precision,
  driver_latitude double precision,
  driver_longitude double precision,
  driver_heading double precision,
  location_updated_at timestamptz,
  expires_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
begin
  return query
  select
    case when s.ride_request_id is not null then 'ride' else 'parcel' end,
    coalesce(r.id, d.id),
    coalesce(r.status, d.status),
    coalesce(r.pickup_address, d.pickup_address),
    coalesce(r.pickup_lat, d.pickup_lat),
    coalesce(r.pickup_lng, d.pickup_lng),
    coalesce(r.destination_address, d.destination_address),
    coalesce(r.destination_lat, d.destination_lat),
    coalesce(r.destination_lng, d.destination_lng),
    l.latitude, l.longitude, l.heading, l.updated_at, s.expires_at
  from public.trip_tracking_shares s
  left join public.ride_requests r on r.id = s.ride_request_id
  left join public.parcel_deliveries d on d.id = s.parcel_delivery_id
  left join public.trip_tracking_locations l
    on l.ride_request_id = s.ride_request_id
    or l.parcel_delivery_id = s.parcel_delivery_id
  where s.token_hash = encode(digest(p_token, 'sha256'), 'hex')
    and s.revoked_at is null
    and (s.expires_at is null or s.expires_at > now())
    and coalesce(r.status, d.status) not in ('cancelled');
end;
$$;

create or replace function public.get_driver_active_rides()
returns table (
  id uuid,
  pickup_address text,
  pickup_lat double precision,
  pickup_lng double precision,
  destination_address text,
  destination_lat double precision,
  destination_lng double precision,
  passenger_offer integer,
  status text,
  agreed_fare integer
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.pickup_address, r.pickup_lat, r.pickup_lng,
    r.destination_address, r.destination_lat, r.destination_lng,
    r.passenger_offer, r.status, b.proposed_fare
  from public.ride_requests r
  join public.profiles p on p.id = (select auth.uid()) and p.role = 'driver'
  left join public.ride_bids b
    on b.ride_request_id = r.id and b.driver_id = (select auth.uid()) and b.status = 'accepted'
  where r.assigned_driver_id = (select auth.uid())
    and r.status in ('accepted', 'in_progress')
  order by r.created_at desc;
$$;

create or replace function public.get_driver_active_parcels()
returns table (
  id uuid,
  pickup_address text,
  pickup_lat double precision,
  pickup_lng double precision,
  destination_address text,
  destination_lat double precision,
  destination_lng double precision,
  sender_offer integer,
  status text,
  agreed_fare integer
)
language sql
stable
security definer
set search_path = public
as $$
  select d.id, d.pickup_address, d.pickup_lat, d.pickup_lng,
    d.destination_address, d.destination_lat, d.destination_lng,
    d.sender_offer, d.status, b.proposed_fare
  from public.parcel_deliveries d
  join public.profiles p on p.id = (select auth.uid()) and p.role = 'driver'
  left join public.parcel_bids b
    on b.parcel_delivery_id = d.id and b.driver_id = (select auth.uid()) and b.status = 'accepted'
  where d.assigned_driver_id = (select auth.uid())
    and d.status in ('accepted', 'in_progress')
  order by d.created_at desc;
$$;

revoke all on function public.respond_to_ride_bid(uuid, boolean) from public, anon;
grant execute on function public.respond_to_ride_bid(uuid, boolean) to authenticated;
revoke all on function public.respond_to_parcel_bid(uuid, boolean) from public, anon;
grant execute on function public.respond_to_parcel_bid(uuid, boolean) to authenticated;
revoke all on function public.set_trip_status(text, uuid, text) from public, anon;
grant execute on function public.set_trip_status(text, uuid, text) to authenticated;
revoke all on function public.publish_trip_location(text, uuid, double precision, double precision, double precision) from public, anon;
grant execute on function public.publish_trip_location(text, uuid, double precision, double precision, double precision) to authenticated;
revoke all on function public.get_trip_tracking(text, uuid) from public, anon;
grant execute on function public.get_trip_tracking(text, uuid) to authenticated;
revoke all on function public.create_trip_tracking_share(text, uuid, text) from public, anon;
grant execute on function public.create_trip_tracking_share(text, uuid, text) to authenticated;
revoke all on function public.revoke_trip_tracking_share(uuid) from public, anon;
grant execute on function public.revoke_trip_tracking_share(uuid) to authenticated;
revoke all on function public.get_public_trip_tracking(text) from public;
grant execute on function public.get_public_trip_tracking(text) to anon, authenticated;
revoke all on function public.get_driver_active_parcels() from public, anon;
grant execute on function public.get_driver_active_parcels() to authenticated;
revoke all on function public.get_driver_active_rides() from public, anon;
grant execute on function public.get_driver_active_rides() to authenticated;

notify pgrst, 'reload schema';
