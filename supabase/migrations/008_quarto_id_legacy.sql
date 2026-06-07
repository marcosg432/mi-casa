-- Normaliza quarto_id legado nas reservas (suite-confort → soco, etc.)
update public.reservas set quarto_id = 'tem-tem' where quarto_id in ('triplo-superior', 'triplo_superior');
update public.reservas set quarto_id = 'soco' where quarto_id in ('suite-confort', 'suite_confort');
update public.reservas set quarto_id = 'sabia' where quarto_id in ('suite-premium', 'suite_premium');
update public.reservas set quarto_id = 'ararajuba' where quarto_id in ('quarto-familia', 'quarto_familia');
