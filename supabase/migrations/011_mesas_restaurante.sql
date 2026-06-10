-- Sistema de reserva de mesas — restaurante Mi Casa, Su Casa
-- Execute após as migrations anteriores (001–010).

-- Mesas físicas do restaurante (10 mesas)
create table if not exists public.mesas (
  id smallint primary key check (id between 1 and 10),
  numero text not null,
  status_manual text not null default 'disponivel'
    check (status_manual in ('disponivel', 'bloqueada')),
  updated_at timestamptz not null default now()
);

insert into public.mesas (id, numero) values
  (1, '01'), (2, '02'), (3, '03'), (4, '04'), (5, '05'),
  (6, '06'), (7, '07'), (8, '08'), (9, '09'), (10, '10')
on conflict (id) do nothing;

-- Reservas de mesa
create table if not exists public.reservas_mesa (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  telefone text not null,
  data date not null,
  horario time not null,
  pessoas smallint not null check (pessoas between 1 and 12),
  mesas_utilizadas smallint not null default 1 check (mesas_utilizadas between 1 and 10),
  mesa_ids smallint[] not null default '{}',
  status text not null default 'pendente'
    check (status in ('pendente', 'confirmada', 'cancelada')),
  created_at timestamptz not null default now()
);

create index if not exists idx_reservas_mesa_data_horario
  on public.reservas_mesa (data, horario);

create index if not exists idx_reservas_mesa_status
  on public.reservas_mesa (status);

-- RLS: acesso somente via service_role (Express)
alter table public.mesas enable row level security;
alter table public.reservas_mesa enable row level security;
