-- Elimina overbooking concorrente: EXCLUDE CONSTRAINT (GiST) + RPC actualizada.
-- Executar APÓS 001_reservas.sql, quartos_catalog.sql e 002_producao.sql
--
-- Porquê EXCLUDE e não só SELECT + INSERT?
-- Dois pedidos simultâneos podem passar num EXISTS antes de qualquer INSERT.
-- O EXCLUDE é verificado de forma atómica no INSERT/UPDATE pelo PostgreSQL,
-- usando índice GiST — a segunda transacção falha com exclusion_violation (23P01).

-- ---------------------------------------------------------------------------
-- Extensão necessária: operador = em text + operador && em daterange no GiST
-- ---------------------------------------------------------------------------
create extension if not exists btree_gist;

-- ---------------------------------------------------------------------------
-- Coluna gerada: intervalo [entrada, saída) alinhado ao calendário do site
-- ---------------------------------------------------------------------------
alter table public.reservas
  add column if not exists periodo daterange
  generated always as (daterange(data_entrada, data_saida, '[)')) stored;

-- ---------------------------------------------------------------------------
-- Pré-validação: não é possível criar EXCLUDE se já houver sobreposição
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1
    from public.reservas r1
    inner join public.reservas r2
      on r1.id < r2.id
      and r1.quarto_id is not null
      and r2.quarto_id is not null
      and r1.quarto_id = r2.quarto_id
    where lower(coalesce(r1.status, '')) <> 'cancelada'
      and lower(coalesce(r2.status, '')) <> 'cancelada'
      and r1.periodo && r2.periodo
  ) then
    raise exception
      'MIGRACAO_003_ABORTADA: existem reservas activas sobrepostas no mesmo quarto. Corrija os dados antes de continuar.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Garantia a nível de base de dados (produção)
-- Reservas canceladas ficam fora do índice parcial → libertam o período.
-- ---------------------------------------------------------------------------
alter table public.reservas
  drop constraint if exists reservas_sem_sobreposicao_quarto;

alter table public.reservas
  add constraint reservas_sem_sobreposicao_quarto
  exclude using gist (
    quarto_id with =,
    periodo with &&
  )
  where (
    quarto_id is not null
    and lower(trim(coalesce(status, ''))) <> 'cancelada'
  );

comment on constraint reservas_sem_sobreposicao_quarto on public.reservas is
  'Impede duas reservas activas no mesmo quarto com períodos sobrepostos (anti overbooking concorrente).';

-- ---------------------------------------------------------------------------
-- Bloqueios: coluna periodo + EXCLUDE global (propriedade inteira)
-- ---------------------------------------------------------------------------
alter table public.bloqueios
  add column if not exists periodo daterange
  generated always as (daterange(data_inicio, data_fim, '[)')) stored;

alter table public.bloqueios
  drop constraint if exists bloqueios_sem_sobreposicao;

alter table public.bloqueios
  add constraint bloqueios_sem_sobreposicao
  exclude using gist (periodo with &&);

-- ---------------------------------------------------------------------------
-- datas_tem_conflito: mantida para leitura rápida (calendário / pré-check API)
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
  v_quarto text;
begin
  if p_data_saida <= p_data_entrada then
    return true;
  end if;

  v_quarto := nullif(trim(p_quarto_id), '');

  if v_quarto is not null then
    if exists (
      select 1
      from public.reservas r
      where r.quarto_id = v_quarto
        and lower(trim(coalesce(r.status, ''))) <> 'cancelada'
        and r.periodo && daterange(p_data_entrada, p_data_saida, '[)')
    ) then
      return true;
    end if;
  else
    -- Quarto não informado: qualquer reserva activa no período conta como conflito
    if exists (
      select 1
      from public.reservas r
      where lower(trim(coalesce(r.status, ''))) <> 'cancelada'
        and r.periodo && daterange(p_data_entrada, p_data_saida, '[)')
    ) then
      return true;
    end if;
  end if;

  if exists (
    select 1
    from public.bloqueios b
    where b.periodo && daterange(p_data_entrada, p_data_saida, '[)')
  ) then
    return true;
  end if;

  return false;
end;
$$;

-- ---------------------------------------------------------------------------
-- criar_reserva_segura: INSERT directo; EXCLUDE garante atomicidade concorrente
-- Advisory lock por quarto serializa verificação de bloqueios vs nova reserva
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
  v_quarto text;
begin
  v_quarto := nullif(trim(p_quarto_id), '');

  if p_data_saida <= p_data_entrada then
    raise exception 'CONFLITO_DATAS' using errcode = 'P0001';
  end if;

  if v_quarto is null then
    raise exception 'QUARTO_OBRIGATORIO' using errcode = 'P0001';
  end if;

  -- Serializa operações de booking do mesmo quarto (bloqueios + reserva)
  perform pg_advisory_xact_lock(891234, hashtext(v_quarto));
  -- Lock global para leitura consistente de bloqueios da propriedade
  perform pg_advisory_xact_lock(891234, 0);

  if public.datas_tem_conflito(v_quarto, p_data_entrada, p_data_saida) then
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
    v_quarto,
    coalesce(nullif(trim(p_plataforma), ''), 'site'),
    coalesce(nullif(trim(p_status), ''), 'pendente'),
    coalesce(p_requer_orcamento, false),
    coalesce(nullif(trim(p_metodo_pagamento), ''), 'whatsapp')
  )
  returning * into v_row;

  return v_row;

exception
  when exclusion_violation then
    raise exception 'CONFLITO_DATAS' using errcode = 'P0001';
end;
$$;

revoke all on function public.datas_tem_conflito from public;
revoke all on function public.criar_reserva_segura from public;
grant execute on function public.datas_tem_conflito to service_role;
grant execute on function public.criar_reserva_segura to service_role;
