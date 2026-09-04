-- 009_split_format.sql
--
-- Formato do split de hipertrofia, escolhido pelo utilizador no onboarding /
-- definições do plano.
--
--   'frequencia' — Superior/Inferior · PPL, cada músculo ~2×/semana (o atual)
--   'muscular'   — split clássico por grupo (Peito+Tríceps, Costas+Bíceps…),
--                  cada músculo 1×/semana
--   'auto'       — o motor decide (hoje = 'frequencia')
--
-- É uma preferência na própria linha do utilizador, como `goal`/`level`/
-- `focus_muscles`. A RLS de `profiles` é por linha (só o dono edita a sua) e a
-- migração 007 já tranca as colunas de sistema (role/is_verified/pt_code) — esta
-- coluna não precisa de guarda extra.

alter table public.profiles
  add column if not exists split_format text
    not null default 'auto'
    check (split_format in ('frequencia', 'muscular', 'auto'));

comment on column public.profiles.split_format is
  'Formato do split de hipertrofia: frequencia (2×/músculo) | muscular (1×/músculo) | auto.';
