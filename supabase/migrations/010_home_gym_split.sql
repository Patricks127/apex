-- 010_home_gym_split.sql
--
-- "Casa + Ginásio" (location = 'hibrido') passa a ser alternância REAL: alguns
-- dias da semana no ginásio, os restantes em casa com o que o utilizador tem.
-- Até aqui o motor aplicava um único conjunto de equipamento a todos os dias.
--
--   gym_days_per_week — quantos dos `days_per_week` são no ginásio.
--                       Só faz sentido em 'hibrido'; NULL nos outros locais.
--   home_equipment    — o que o utilizador tem em casa. Vocabulário igual ao
--                       do motor v2 (src/lib/motor2/tipos.ts · EQUIPAMENTOS).
--                       '{}' = não declarado (o motor assume o conjunto por
--                       omissão: halteres, banda, peso corporal, barra fixa).
--
-- São preferências na própria linha do utilizador, como `goal`/`level`/
-- `split_format`. A RLS de `profiles` é por linha (só o dono edita a sua) e a
-- migração 007 tranca as colunas de sistema — estas não precisam de guarda extra.

alter table public.profiles
  add column if not exists gym_days_per_week int,
  add column if not exists home_equipment text[] not null default '{}'::text[];

-- Os CHECK são adicionados à parte: `add constraint` não aceita `if not exists`.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass and conname = 'profiles_gym_days_range'
  ) then
    alter table public.profiles
      add constraint profiles_gym_days_range
      check (gym_days_per_week is null or gym_days_per_week between 0 and 6);
  end if;

  -- Não se pode treinar no ginásio mais dias do que os dias de treino.
  -- (O onboarding grava sempre as duas colunas na mesma UPDATE.)
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass and conname = 'profiles_gym_days_lte_total'
  ) then
    alter table public.profiles
      add constraint profiles_gym_days_lte_total
      check (
        gym_days_per_week is null
        or days_per_week is null
        or gym_days_per_week <= days_per_week
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass and conname = 'profiles_home_equipment_vocab'
  ) then
    alter table public.profiles
      add constraint profiles_home_equipment_vocab
      check (
        home_equipment <@ array[
          'barra', 'halteres', 'maquina', 'cabos', 'peso_corporal', 'kettlebell',
          'banda', 'trx', 'barra_fixa', 'paralelas', 'banco', 'caixa',
          'corda_saltar', 'sled', 'remo_ergometro', 'bicicleta', 'passadeira',
          'wall_ball', 'skierg'
        ]::text[]
      );
  end if;
end
$$;

comment on column public.profiles.gym_days_per_week is
  'Casa+Ginásio: quantos dos days_per_week são no ginásio (os restantes são em casa). NULL fora de location=hibrido.';
comment on column public.profiles.home_equipment is
  'Equipamento disponível em casa (vocabulário do motor v2). {} = usar o conjunto por omissão.';
