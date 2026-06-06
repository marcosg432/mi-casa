-- Quarto SOCÓ: ventilador (sem ar-condicionado)
-- Executar no SQL Editor do Supabase se o catálogo já estiver populado.

update public.quartos_catalog
set
  descricao = 'Quarto Família (4 Camas de Solteiro). Espaçoso, com quatro camas de solteiro, ventilador, cozinha compacta privativa, vista para o jardim e banheiro compartilhado. Até 4 pessoas · 40 m².',
  amenities = (amenities - 'arCondicionado') || '{"ventilador": true}'::jsonb,
  updated_at = now()
where id = 'soco';
