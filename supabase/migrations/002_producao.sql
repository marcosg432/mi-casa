-- Produção: schema completo, RLS restritivo, RPC atômica de reserva.
-- Executar no SQL Editor do Supabase APÓS 001_reservas.sql e quartos_catalog.sql

-- ---------------------------------------------------------------------------
-- Reservas: colunas em falta
-- ---------------------------------------------------------------------------
alter table public.reservas add column if not exists quarto_id text;
alter table public.reservas add column if not exists adultos integer;
alter table public.reservas add column if not exists criancas integer not null default 0;
alter table public.reservas add column if not exists noites integer;
alter table public.reservas add column if not exists requer_orcamento boolean not null default false;
alter table public.reservas add column if not exists metodo_pagamento text not null default 'whatsapp';

alter table public.reservas alter column status set default 'pendente';

create index if not exists reservas_quarto_id_idx on public.reservas (quarto_id);
create index if not exists reservas_datas_idx on public.reservas (data_entrada, data_saida);
create index if not exists reservas_status_idx on public.reservas (status);

-- ---------------------------------------------------------------------------
-- Bloqueios de datas (painel admin)
-- ---------------------------------------------------------------------------
create table if not exists public.bloqueios (
  id uuid primary key default gen_random_uuid(),
  data_inicio date not null,
  data_fim date not null check (data_fim > data_inicio),
  motivo text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists bloqueios_datas_idx on public.bloqueios (data_inicio, data_fim);

alter table public.bloqueios enable row level security;

-- ---------------------------------------------------------------------------
-- Remover políticas perigosas (acesso anónimo directo)
-- ---------------------------------------------------------------------------
drop policy if exists reservas_select_anon on public.reservas;
drop policy if exists reservas_insert_anon on public.reservas;
drop policy if exists reservas_update_anon on public.reservas;

drop policy if exists "quartos_catalog_insert" on public.quartos_catalog;
drop policy if exists "quartos_catalog_update" on public.quartos_catalog;
drop policy if exists "quartos_catalog_delete" on public.quartos_catalog;

-- Leitura pública só do catálogo de quartos (site)
drop policy if exists "quartos_catalog_select" on public.quartos_catalog;
create policy "quartos_catalog_select" on public.quartos_catalog
  for select using (true);

-- Reservas e bloqueios: sem políticas para anon/authenticated — só service_role (API)

-- ---------------------------------------------------------------------------
-- Função: verifica sobreposição de datas por quarto
-- ---------------------------------------------------------------------------
create or replace function public.datas_tem_conflito(
  p_quarto_id text,
  p_data_entrada date,
  p_data_saida date
) returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_conflito_reserva boolean;
  v_conflito_bloqueio boolean;
begin
  if p_data_saida <= p_data_entrada then
    return true;
  end if;

  select exists (
    select 1
    from public.reservas r
    where lower(coalesce(r.status, '')) <> 'cancelada'
      and (
        p_quarto_id is null
        or r.quarto_id is null
        or r.quarto_id = p_quarto_id
      )
      and daterange(r.data_entrada, r.data_saida, '[)') &&
          daterange(p_data_entrada, p_data_saida, '[)')
  ) into v_conflito_reserva;

  if v_conflito_reserva then
    return true;
  end if;

  select exists (
    select 1
    from public.bloqueios b
    where daterange(b.data_inicio, b.data_fim, '[)') &&
          daterange(p_data_entrada, p_data_saida, '[)')
  ) into v_conflito_bloqueio;

  return coalesce(v_conflito_bloqueio, false);
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: criar reserva com verificação atómica de conflito
-- ---------------------------------------------------------------------------
create or replace function public.criar_reserva_segura(
  p_codigo text,
  p_nome text,
  p_email text,
  p_telefone text,
  p_pessoas integer,
  p_adultos integer,
  p_criancas integer,
  p_data_entrada date,
  p_data_saida date,
  p_noites integer,
  p_valor_total numeric,
  p_valor_diaria numeric,
  p_valor_adicional numeric,
  p_quarto_id text,
  p_plataforma text,
  p_status text,
  p_requer_orcamento boolean,
  p_metodo_pagamento text
) returns public.reservas
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.reservas;
begin
  if public.datas_tem_conflito(p_quarto_id, p_data_entrada, p_data_saida) then
    raise exception 'CONFLITO_DATAS' using errcode = 'P0001';
  end if;

  insert into public.reservas (
    codigo, nome, email, telefone, pessoas,
    adultos, criancas, data_entrada, data_saida, noites,
    valor_total, valor_diaria, valor_adicional,
    quarto_id, plataforma, status, requer_orcamento, metodo_pagamento
  ) values (
    p_codigo, p_nome, p_email, p_telefone, p_pessoas,
    p_adultos, p_criancas, p_data_entrada, p_data_saida, p_noites,
    p_valor_total, p_valor_diaria, p_valor_adicional,
    nullif(trim(p_quarto_id), ''), coalesce(nullif(trim(p_plataforma), ''), 'site'),
    coalesce(nullif(trim(p_status), ''), 'pendente'),
    coalesce(p_requer_orcamento, false),
    coalesce(nullif(trim(p_metodo_pagamento), ''), 'whatsapp')
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.criar_reserva_segura from public;
revoke all on function public.datas_tem_conflito from public;
grant execute on function public.criar_reserva_segura to service_role;
grant execute on function public.datas_tem_conflito to service_role;
