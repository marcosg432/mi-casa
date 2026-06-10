-- Aumenta limite de pessoas por reserva de mesa para 16
alter table public.reservas_mesa drop constraint if exists reservas_mesa_pessoas_check;
alter table public.reservas_mesa add constraint reservas_mesa_pessoas_check check (pessoas between 1 and 16);
