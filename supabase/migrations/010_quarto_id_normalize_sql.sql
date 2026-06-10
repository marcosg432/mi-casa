-- Normaliza quarto_id em SQL (impede reserva duplicada com IDs legados diferentes)
-- Ex.: suite-confort e soco passam a ser o mesmo quarto para conflito e EXCLUDE.

create or replace function public.normalize_quarto_id(p_raw text)
returns text
language plpgsql
immutable
as $$
declare
  s text;
begin
  s := lower(trim(coalesce(p_raw, '')));
  s := replace(s, '_', '-');
  s := regexp_replace(s, '\s+', '-', 'g');
  s := regexp_replace(s, '[^a-z0-9-]', '', 'g');
  s := regexp_replace(s, '-+', '-', 'g');
  s := trim(both '-' from s);
  if s = '' then
    return null;
  end if;
  if s in ('triplo-superior') then return 'tem-tem'; end if;
  if s in ('suite-confort') then return 'soco'; end if;
  if s in ('suite-premium') then return 'sabia'; end if;
  if s in ('quarto-familia') then return 'ararajuba'; end if;
  return s;
end;
$$;

-- Dados existentes
update public.reservas
set quarto_id = public.normalize_quarto_id(quarto_id)
where quarto_id is not null
  and quarto_id <> public.normalize_quarto_id(quarto_id);

-- Sempre gravar ID canónico
create or replace function public.reservas_normalize_quarto_id()
returns trigger
language plpgsql
as $$
begin
  new.quarto_id := public.normalize_quarto_id(new.quarto_id);
  return new;
end;
$$;

drop trigger if exists trg_reservas_normalize_quarto on public.reservas;
create trigger trg_reservas_normalize_quarto
  before insert or update of quarto_id on public.reservas
  for each row
  execute function public.reservas_normalize_quarto_id();

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

  v_quarto := public.normalize_quarto_id(p_quarto_id);

  if v_quarto is not null then
    if exists (
      select 1
      from public.reservas r
      where public.normalize_quarto_id(r.quarto_id) = v_quarto
        and lower(trim(coalesce(r.status, ''))) <> 'cancelada'
        and r.periodo && daterange(p_data_entrada, p_data_saida, '[)')
    ) then
      return true;
    end if;
  else
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
  v_quarto := public.normalize_quarto_id(p_quarto_id);

  if p_data_saida <= p_data_entrada then
    raise exception 'CONFLITO_DATAS' using errcode = 'P0001';
  end if;

  if v_quarto is null then
    raise exception 'QUARTO_OBRIGATORIO' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(891234, hashtext(v_quarto));
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

revoke all on function public.normalize_quarto_id from public;
revoke all on function public.datas_tem_conflito from public;
revoke all on function public.criar_reserva_segura from public;
grant execute on function public.normalize_quarto_id to service_role;
grant execute on function public.datas_tem_conflito to service_role;
grant execute on function public.criar_reserva_segura to service_role;
