create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text,
  last_name text,
  dni text unique check (dni ~ '^[0-9]{8}$'),
  email extensions.citext unique,
  phone text,
  birth_date date check (birth_date <= current_date),
  photo_url text,
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'Datos de perfil de cada usuario de la intranet; 1 a 1 con auth.users.';

alter table public.profiles enable row level security;

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, first_name, last_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name'
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
