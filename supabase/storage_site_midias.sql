-- Bucket público para fotos enviadas pelo painel (capas de quarto).
-- Executar no SQL Editor do Supabase. Se o bucket já existir, o insert é ignorado.
-- Em produção restrinja INSERT a utilizadores autenticados.

insert into storage.buckets (id, name, public)
values ('site-midias', 'site-midias', true)
on conflict (id) do update set public = true;

drop policy if exists "site_midias_leitura_publica" on storage.objects;
drop policy if exists "site_midias_upload_anonimo" on storage.objects;
drop policy if exists "site_midias_update_anonimo" on storage.objects;
drop policy if exists "site_midias_delete_anonimo" on storage.objects;

create policy "site_midias_leitura_publica"
  on storage.objects for select
  using (bucket_id = 'site-midias');

create policy "site_midias_upload_anonimo"
  on storage.objects for insert
  with check (bucket_id = 'site-midias');

create policy "site_midias_update_anonimo"
  on storage.objects for update
  using (bucket_id = 'site-midias');

create policy "site_midias_delete_anonimo"
  on storage.objects for delete
  using (bucket_id = 'site-midias');
