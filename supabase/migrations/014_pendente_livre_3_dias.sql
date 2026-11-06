-- Pendente não fecha datas. Só confirmada/ativa entra no bloqueio.
-- Sem resposta em 3 dias, a pendente vira cancelada.

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
    and coalesce(hold_expires_at, created_at + interval '3 days') < now();

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
  select lower(trim(coalesce(r.status, ''))) in ('confirmada', 'ativa');
$$;

create or replace function public.reservas_set_hold_expires()
returns trigger
language plpgsql
as $$
begin
  if lower(trim(coalesce(new.status, ''))) in ('confirmada', 'ativa') then
    new.hold_expires_at := null;
  elsif lower(trim(coalesce(new.status, ''))) = 'pendente' and new.hold_expires_at is null then
    new.hold_expires_at := now() + interval '3 days';
  end if;
  return new;
end;
$$;

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
    and lower(trim(coalesce(status, ''))) in ('confirmada', 'ativa')
  );
