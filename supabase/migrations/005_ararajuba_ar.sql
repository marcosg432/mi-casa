-- Quarto ARARAJUBA: ar-condicionado (sem ventilador)
-- Executar no SQL Editor do Supabase se o catálogo já estiver populado.

update public.quartos_catalog
set
  descricao = 'Quarto Duplo. Confortável para casais ou viajantes: cama de casal, ar-condicionado, vista para o jardim e banheiro compartilhado com chuveiro. Até 2 pessoas · 20 m².',
  amenities = (amenities - 'ventilador') || '{"arCondicionado": true}'::jsonb,
  updated_at = now()
where id = 'ararajuba';
