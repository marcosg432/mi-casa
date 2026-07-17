-- Ordem do catálogo: SABIÁ → ARARAJUBA → TEM-TEM → SOCÓ
-- ARARAJUBA: banheiro privativo (não compartilhado)

update public.quartos_catalog
set
  ordem = 0,
  capacidade = 4,
  descricao = 'Quarto família com suíte privativa exclusiva para os hóspedes deste quarto. Ambiente amplo, ar-condicionado, ventilador, cozinha compacta privativa e vista para o jardim. Até 4 pessoas · 40 m².',
  amenities = coalesce(amenities, '{}'::jsonb)
    - 'destaques'
    || '{"camasCasal": 0, "camasSolteiro": 2, "banheiroPrivativo": true}'::jsonb,
  updated_at = now()
where id = 'sabia';

update public.quartos_catalog
set
  ordem = 1,
  capacidade = 3,
  tipo = 'Quarto Duplo com Banheiro Privativo',
  descricao = 'Quarto Duplo com Banheiro Privativo. Confortável para casais ou viajantes: cama de casal, uma cama de solteiro, ar-condicionado, ventilador, vista para o jardim e banheiro privativo com chuveiro. Até 3 pessoas · 20 m².',
  amenities = coalesce(amenities, '{}'::jsonb)
    - 'banheiroCompartilhado'
    || '{"banheiroPrivativo": true, "camasCasal": 1, "camasSolteiro": 1}'::jsonb,
  updated_at = now()
where id = 'ararajuba';

update public.quartos_catalog
set
  ordem = 2,
  descricao = 'Quarto Duplo com Banheiro Compartilhado. Quarto duplo aconchegante, ideal para casais: cama de casal, uma cama de solteiro, ar-condicionado, ventilador, vista para o jardim e banheiro compartilhado. Até 3 pessoas · 20 m².',
  amenities = coalesce(amenities, '{}'::jsonb)
    || '{"camasCasal": 1, "camasSolteiro": 1}'::jsonb,
  updated_at = now()
where id = 'tem-tem';

update public.quartos_catalog
set
  ordem = 3,
  updated_at = now()
where id = 'soco';
