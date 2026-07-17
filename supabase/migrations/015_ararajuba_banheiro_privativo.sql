-- ARARAJUBA: banheiro privativo (corrige dado antigo "compartilhado")
update public.quartos_catalog
set
  tipo = 'Quarto Duplo com Banheiro Privativo',
  descricao = 'Quarto Duplo com Banheiro Privativo. Confortável para casais ou viajantes: cama de casal, uma cama de solteiro, ar-condicionado, ventilador, vista para o jardim e banheiro privativo com chuveiro. Até 3 pessoas · 20 m².',
  amenities = coalesce(amenities, '{}'::jsonb)
    - 'banheiroCompartilhado'
    || '{"banheiroPrivativo": true}'::jsonb,
  updated_at = now()
where id = 'ararajuba';
