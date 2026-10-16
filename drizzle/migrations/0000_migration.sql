create type public.app_role as enum ('admin','operador','planejamento','consulta');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null default '',
  email text not null default '',
  unidade text not null default '',
  ativo boolean not null default true,
  ultimo_acesso timestamptz,
  created_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select, insert, update, delete on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "admin profile update" on public.profiles for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "own role read" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "admin role insert" on public.user_roles for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "admin role delete" on public.user_roles for delete to authenticated using (public.has_role(auth.uid(),'admin'));

-- users may record their own last access only
create or replace function public.registrar_acesso()
returns void language sql security definer set search_path = public
as $$ update public.profiles set ultimo_acesso = now() where id = auth.uid() $$;
grant execute on function public.registrar_acesso() to authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare primeiro boolean;
begin
  select not exists (select 1 from public.user_roles) into primeiro;
  insert into public.profiles (id, nome, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)), coalesce(new.email,''));
  insert into public.user_roles (user_id, role) values (new.id, case when primeiro then 'admin'::public.app_role else 'consulta'::public.app_role end);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();