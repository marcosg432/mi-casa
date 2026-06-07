-- Comodidades: todos os quartos com ventilador; ar em todos exceto SOCÓ
-- Executar no SQL Editor do Supabase se o catálogo já estiver populado.

update public.quartos_catalog
set
  descricao = 'Quarto Duplo com Banheiro Compartilhado. Quarto duplo aconchegante, ideal para casais: cama de casal, ar-condicionado, ventilador, vista para o jardim e banheiro compartilhado. Até 2 pessoas · 20 m².',
  amenities = amenities || '{"arCondicionado": true, "ventilador": true}'::jsonb,
  updated_at = now()
where id = 'tem-tem';

update public.quartos_catalog
set
  descricao = 'Quarto Família (4 Camas de Solteiro). Espaçoso, com quatro camas de solteiro, ventilador, cozinha compacta privativa, vista para o jardim e banheiro compartilhado. Até 4 pessoas · 40 m².',
  amenities = (amenities - 'arCondicionado') || '{"ventilador": true}'::jsonb,
  updated_at = now()
where id = 'soco';

update public.quartos_catalog
set
  descricao = 'Quarto Família (1 Cama de Casal + 3 de Solteiro). Amplo espaço, ar-condicionado, ventilador, cozinha compacta privativa e vista para o jardim. Banheiro compartilhado. Até 4 pessoas · 40 m².',
  amenities = amenities || '{"arCondicionado": true, "ventilador": true}'::jsonb,
  updated_at = now()
where id = 'sabia';

update public.quartos_catalog
set
  descricao = 'Quarto Duplo. Confortável para casais ou viajantes: cama de casal, ar-condicionado, ventilador, vista para o jardim e banheiro compartilhado com chuveiro. Até 2 pessoas · 20 m².',
  amenities = amenities || '{"arCondicionado": true, "ventilador": true}'::jsonb,
  updated_at = now()
where id = 'ararajuba';
