-- Quarto SABIÁ: suíte privativa, 5 pessoas, camas e destaques
update public.quartos_catalog
set
  tipo = 'Quarto Família com Suíte Privativa',
  descricao = 'Quarto família com suíte privativa exclusiva para os hóspedes deste quarto. Ambiente amplo, ar-condicionado, ventilador, cozinha compacta privativa e vista para o jardim. Até 5 pessoas · 40 m².',
  capacidade = 5,
  amenities = coalesce(amenities, '{}'::jsonb)
    - 'banheiroCompartilhado'
    || '{"banheiroPrivativo": true, "camasCasal": 1, "camasSolteiro": 3, "destaques": ["Banheiro privativo (suíte), exclusivo para os hóspedes deste quarto", "1 cama de casal e 3 camas de solteiro", "Capacidade máxima para 5 pessoas"]}'::jsonb,
  updated_at = now()
where id = 'sabia';
