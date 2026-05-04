-- Executar no SQL Editor do Supabase (projeto Mi Casa Su Casa).
-- Catálogo de quartos: site + reservas + painel leem daqui via anon key.

create table if not exists public.quartos_catalog (
  id text primary key,
  titulo text not null default '',
  tipo text not null default '',
  descricao text not null default '',
  capacidade integer not null default 2,
  preco_display text not null default 'R$ 0',
  preco_label text not null default 'Noite',
  imagem_principal text not null default '',
  imagem_alt text not null default '',
  ordem integer not null default 0,
  amenities jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists quartos_catalog_ordem_idx on public.quartos_catalog (ordem);

alter table public.quartos_catalog enable row level security;

-- Aviso: qualquer pessoa com a URL do site pode alterar/apagar quartos.
-- Para produção, restrinja com auth ou Edge Function com service_role.
drop policy if exists "quartos_catalog_select" on public.quartos_catalog;
drop policy if exists "quartos_catalog_insert" on public.quartos_catalog;
drop policy if exists "quartos_catalog_update" on public.quartos_catalog;
drop policy if exists "quartos_catalog_delete" on public.quartos_catalog;

create policy "quartos_catalog_select" on public.quartos_catalog for select using (true);
create policy "quartos_catalog_insert" on public.quartos_catalog for insert with check (true);
create policy "quartos_catalog_update" on public.quartos_catalog for update using (true) with check (true);
create policy "quartos_catalog_delete" on public.quartos_catalog for delete using (true);
