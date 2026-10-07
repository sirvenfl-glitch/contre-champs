-- Contrechamp : profils, table docs et règles RLS. Additif. Rollback : 001_auth_docs.down.sql

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'Un membre' check (char_length(name) between 1 and 40),
  avatar_url text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy profiles_select on public.profiles for select to authenticated using (true);
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, name)
  values (new.id, left(coalesce(nullif(trim(new.raw_user_meta_data->>'name'), ''), split_part(new.email, '@', 1), 'Un membre'), 40));
  return new;
end $$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.docs (
  collection text not null check (collection in ('entries','films','videos','passeurs')),
  id text not null check (char_length(id) between 1 and 200),
  owner uuid references auth.users(id) on delete set null default auth.uid(),
  data jsonb not null default '{}'::jsonb check (octet_length(data::text) < 5000),
  updated_at timestamptz not null default now(),
  primary key (collection, id)
);
create index docs_owner_idx on public.docs (owner);
alter table public.docs enable row level security;

create policy docs_select on public.docs for select to authenticated using (true);

-- passeurs : lecture seule depuis l'app (géré en base)
create policy docs_insert on public.docs for insert to authenticated with check (
  collection in ('entries','films','videos')
  and owner = (select auth.uid())
  and (collection <> 'entries' or (
        id like (select auth.uid())::text || '\_\_%'
        and data->>'uid' = (select auth.uid())::text))
);
create policy docs_update on public.docs for update to authenticated
  using (owner = (select auth.uid()) and collection in ('entries','films','videos'))
  with check (
    owner = (select auth.uid()) and collection in ('entries','films','videos')
    and (collection <> 'entries' or (
          id like (select auth.uid())::text || '\_\_%'
          and data->>'uid' = (select auth.uid())::text))
  );
create policy docs_delete on public.docs for delete to authenticated
  using (owner = (select auth.uid()) and collection in ('entries','films','videos'));

create function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;
create trigger docs_touch before update on public.docs for each row execute function public.touch_updated_at();

alter publication supabase_realtime add table public.docs;
