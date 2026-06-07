-- Rótulo de preço: diária por pessoa (todos os quartos)
update public.quartos_catalog
set
  preco_label = 'diária por pessoa',
  updated_at = now();
