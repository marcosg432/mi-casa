-- =============================================================================
-- Storage: bucket «site-midias» (fotos de quartos enviadas pelo painel)
-- =============================================================================
-- 1) No Supabase: Project → SQL → New query → colar este ficheiro → Run.
-- 2) Se preferires criar o bucket à mão: Storage → New bucket → id «site-midias»
--    → marcar «Public bucket» → Create. Depois corre só a parte «Policies» abaixo.
--
-- O painel (js/painel.js) usa a chave «anon»; as políticas têm de permitir
-- INSERT para o role «anon» (e «authenticated» se no futuro houver login).
-- =============================================================================

-- Criar bucket público (id = nome visível na API)
insert into storage.buckets (id, name, public)
values ('site-midias', 'site-midias', true)
on conflict (id) do update set public = excluded.public;

-- Remover políticas antigas com o mesmo nome (re-execução segura)
drop policy if exists "site_midias_leitura_publica" on storage.objects;
drop policy if exists "site_midias_upload_anonimo" on storage.objects;
drop policy if exists "site_midias_update_anonimo" on storage.objects;
drop policy if exists "site_midias_delete_anonimo" on storage.objects;

-- Leitura: qualquer pessoa pode ver ficheiros deste bucket (URLs públicas)
create policy "site_midias_leitura_publica"
  on storage.objects
  for select
  to public
  using (bucket_id = 'site-midias');

-- Upload / alterar / apagar: anon + authenticated (o painel usa anon por defeito)
create policy "site_midias_upload_anonimo"
  on storage.objects
  for insert
  to anon, authenticated
  with check (bucket_id = 'site-midias');

create policy "site_midias_update_anonimo"
  on storage.objects
  for update
  to anon, authenticated
  using (bucket_id = 'site-midias');

create policy "site_midias_delete_anonimo"
  on storage.objects
  for delete
  to anon, authenticated
  using (bucket_id = 'site-midias');
