-- Store the passenger's explicit fare offer separately from the route estimate.
alter table public.ride_requests
  add column if not exists passenger_offer integer;

-- Keep existing ride rows readable; new requests require a passenger-entered offer.
update public.ride_requests
set passenger_offer = estimated_fare
where passenger_offer is null;

alter table public.ride_requests
  alter column passenger_offer set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ride_requests_passenger_offer_positive'
      and conrelid = 'public.ride_requests'::regclass
  ) then
    alter table public.ride_requests
      add constraint ride_requests_passenger_offer_positive
      check (passenger_offer > 0);
  end if;
end $$;
