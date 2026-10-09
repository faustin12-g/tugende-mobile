alter table public.profiles
  add column if not exists email text;

alter table public.profiles
  alter column phone drop not null;

create unique index if not exists profiles_email_key
  on public.profiles (email)
  where email is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profile_contact_required'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profile_contact_required
      check (email is not null or phone is not null);
  end if;
end
$$;
