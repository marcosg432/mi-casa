create extension if not exists pgcrypto;

create table if not exists public.reservas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null,
  email text not null,
  telefone text not null,
  pessoas integer not null check (pessoas > 0),
  data_entrada date not null,
  data_saida date not null check (data_saida > data_entrada),
  valor_total numeric(12,2) not null default 0,
  valor_diaria numeric(12,2) not null default 600,
  valor_adicional numeric(12,2) not null default 0,
  plataforma text not null default 'site',
  status text not null default 'ativa',
  created_at timestamptz not null default now()
);

alter table public.reservas enable row level security;

drop policy if exists reservas_select_anon on public.reservas;
create policy reservas_select_anon
  on public.reservas
  for select
  to anon
  using (true);

drop policy if exists reservas_insert_anon on public.reservas;
create policy reservas_insert_anon
  on public.reservas
  for insert
  to anon
  with check (true);

drop policy if exists reservas_update_anon on public.reservas;
create policy reservas_update_anon
  on public.reservas
  for update
  to anon
  using (true)
  with check (true);
