-- 004_onboarding_fields.sql
--
-- Campos recolhidos no /onboarding e usados pelo motor de treino para gerar
-- o plano. Vivem no PERFIL do utilizador (não no plano). Todos nullable — o
-- onboarding preenche-os depois do registo.
--
-- As policies de profiles já cobrem estas colunas (não são precisas novas).

alter table public.profiles
  add column if not exists goal text
    check (goal in ('hipertrofia', 'powerlifting', 'hibrido', 'hyrox', 'corrida', 'calistenia')),
  add column if not exists sex text
    check (sex in ('homem', 'mulher')),
  add column if not exists level text
    check (level in ('iniciante', 'intermedio', 'avancado')),
  add column if not exists days_per_week int
    check (days_per_week between 3 and 6),
  add column if not exists location text
    check (location in ('ginasio', 'casa', 'hibrido', 'parque', 'outro')),
  add column if not exists location_note text,
  add column if not exists injuries text[] default '{}'::text[],
  add column if not exists injury_note text,
  add column if not exists focus_muscles text[] default '{}'::text[];

comment on column public.profiles.goal is 'Objetivo de treino (onboarding)';
comment on column public.profiles.days_per_week is 'Dias de treino por semana, 3–6 (onboarding)';
comment on column public.profiles.injuries is 'Zonas lesionadas: ombro, cotovelo, pulso, joelho, lombar, anca, tornozelo, pescoco';
comment on column public.profiles.focus_muscles is 'Grupos a reforçar (hipertrofia): gluteo, peito, costas, ombros, bracos, core';
