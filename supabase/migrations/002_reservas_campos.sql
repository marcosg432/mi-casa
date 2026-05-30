-- Campos adicionais para reservas (adultos, crianças, quarto, status ampliado)

alter table public.reservas
  add column if not exists quarto_id text,
  add column if not exists adultos integer,
  add column if not exists criancas integer default 0,
  add column if not exists noites integer,
  add column if not exists requer_orcamento boolean default false;

-- Novas reservas do site entram como pendente
alter table public.reservas alter column status set default 'pendente';
