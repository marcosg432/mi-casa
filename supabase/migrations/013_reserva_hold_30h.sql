-- Reserva via WhatsApp: trava datas por 30h (pendente).
-- Dono confirma no painel → confirmada (trava permanente).
-- Sem confirmação em 30h → cancelada automática → datas reabertas.

alter table public.reservas
  add column if not exists hold_expires_at timestamptz;

comment on column public.reservas.hold_expires_at is
  'Prazo da reserva pendente (site/WhatsApp). Após expirar, status vira cancelada e as datas libertam.';

update public.reservas
set hold_expires_at = coalesce(created_at, now()) + interval '30 hours'
where lower(trim(coalesce(status, ''))) = 'pendente'
  and hold_expires_at is null;

-- Expira pendentes vencidas (liberta período no EXCLUDE)
create or replace function public.expirar_reservas_pendentes()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.reservas
  set status = 'cancelada'
  where lower(trim(coalesce(status, ''))) = 'pendente'
    and coalesce(hold_expires_at, created_at + interval '30 hours') < now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.reserva_bloqueia_periodo(r public.reservas)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when lower(trim(coalesce(r.status, ''))) in ('cancelada', '') then false
    when lower(trim(coalesce(r.status, ''))) in ('confirmada', 'ativa') then true
    when lower(trim(coalesce(r.status, ''))) = 'pendente' then
      coalesce(r.hold_expires_at, r.created_at + interval '30 hours') > now()
    else false
  end;
$$;

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
  perform public.expirar_reservas_pendentes();

  if p_data_saida <= p_data_entrada then
    return true;
  end if;

  v_quarto := public.normalize_quarto_id(p_quarto_id);

  if v_quarto is not null then
    if exists (
      select 1
      from public.reservas r
      where public.normalize_quarto_id(r.quarto_id) = v_quarto
        and public.reserva_bloqueia_periodo(r)
        and r.periodo && daterange(p_data_entrada, p_data_saida, '[)')
    ) then
      return true;
    end if;
  else
    if exists (
      select 1
      from public.reservas r
      where public.reserva_bloqueia_periodo(r)
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

create or replace function public.reservas_set_hold_expires()
returns trigger
language plpgsql
as $$
begin
  if lower(trim(coalesce(new.status, ''))) in ('confirmada', 'ativa') then
    new.hold_expires_at := null;
  elsif lower(trim(coalesce(new.status, ''))) = 'pendente' and new.hold_expires_at is null then
    new.hold_expires_at := now() + interval '30 hours';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_reservas_hold_expires on public.reservas;
create trigger trg_reservas_hold_expires
  before insert or update of status, hold_expires_at on public.reservas
  for each row
  execute function public.reservas_set_hold_expires();

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
  v_status text;
begin
  perform public.expirar_reservas_pendentes();

  v_quarto := public.normalize_quarto_id(p_quarto_id);
  v_status := lower(trim(coalesce(nullif(trim(p_status), ''), 'pendente')));

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
    quarto_id, plataforma, status, requer_orcamento, metodo_pagamento,
    hold_expires_at
  ) values (
    p_codigo, p_nome, p_email, p_telefone, p_pessoas,
    p_adultos, p_criancas, p_data_entrada, p_data_saida, p_noites,
    p_valor_total, p_valor_diaria, p_valor_adicional,
    v_quarto,
    coalesce(nullif(trim(p_plataforma), ''), 'site'),
    v_status,
    coalesce(p_requer_orcamento, false),
    coalesce(nullif(trim(p_metodo_pagamento), ''), 'whatsapp'),
    case when v_status = 'pendente' then now() + interval '30 hours' else null end
  )
  returning * into v_row;

  return v_row;

exception
  when exclusion_violation then
    raise exception 'CONFLITO_DATAS' using errcode = 'P0001';
end;
$$;

revoke all on function public.expirar_reservas_pendentes from public;
revoke all on function public.reserva_bloqueia_periodo from public;
grant execute on function public.expirar_reservas_pendentes to service_role;
grant execute on function public.reserva_bloqueia_periodo to service_role;
