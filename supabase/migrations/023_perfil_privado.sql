-- 023_perfil_privado.sql — POR APLICAR (rever antes)
--
-- PROBLEMA: a policy de SELECT de `profiles` é USING (true) — qualquer
-- sessão lê TODAS as colunas de TODOS os perfis via API. Provado em
-- 2026-09-28 com a sessão de um atleta de teste: 188 perfis de outros
-- legíveis, incluindo 4 telemóveis, 2 listas de lesões, 2 notas de lesão
-- (texto livre de saúde), 8 sexos. A RLS é por linha, não por coluna.
--
-- SOLUÇÃO (opção 1, aprovada): as colunas privadas saem de `profiles` para
-- uma tabela 1:1 nova, `perfil_privado`, com RLS "só o dono". `profiles`
-- fica só com o que é legitimamente público (nome, foto, cidade, bio,
-- objetivo/headline, currículo do PT, código de PT, role…) e continua
-- legível a qualquer sessão, como hoje — é o que o feed, o descobrir e os
-- perfis públicos precisam.
--
-- O PT NÃO tem policy nesta tabela. Lê os dados de TREINO do aluno só pela
-- função dados_treino_do_aluno(), que (1) exige ligação ATIVA com o scope
-- 'treinos' (pt_has_scope) e (2) devolve só colunas de treino — nunca o
-- telemóvel nem o sexo. Uma policy de tabela daria ao PT TODAS as colunas.
--
-- ATÓMICA: cria, copia, verifica que a cópia bate certo coluna a coluna
-- (aborta se não bater) e só então remove as colunas de `profiles`. Se
-- qualquer passo falhar, nada fica aplicado — nenhum dado se perde.
--
-- ORDEM DE APLICAÇÃO: esta migração e o deploy do código que lê a tabela
-- nova têm de ir juntos (o código atual lê profiles.goal/sex/…; depois
-- desta migração essas colunas deixam de existir). Aplicar → avisar →
-- push imediato (~30 s de build na Vercel).

begin;

-- ---------------------------------------------------------------------------
-- 1. A tabela nova — mesmos tipos, defaults e CHECKs que as colunas tinham
--    em `profiles` (copiados de pg_get_constraintdef em 2026-09-28).
-- ---------------------------------------------------------------------------
create table public.perfil_privado (
  id uuid primary key references public.profiles (id) on delete cascade,
  phone text unique,
  sex text check (sex = any (array['homem', 'mulher'])),
  level text check (level = any (array['iniciante', 'intermedio', 'avancado'])),
  goal text check (goal = any (array['hipertrofia', 'powerlifting', 'hibrido', 'hyrox', 'corrida', 'calistenia'])),
  days_per_week integer check (days_per_week >= 3 and days_per_week <= 6),
  location text check (location = any (array['ginasio', 'casa', 'hibrido', 'parque', 'outro'])),
  location_note text,
  injuries text[] default '{}',
  injury_note text,
  focus_muscles text[] default '{}',
  split_format text default 'auto' check (split_format = any (array['frequencia', 'muscular', 'auto'])),
  gym_days_per_week integer check (gym_days_per_week is null or (gym_days_per_week >= 0 and gym_days_per_week <= 6)),
  home_equipment text[] not null default '{}' check (home_equipment <@ array[
    'barra', 'halteres', 'maquina', 'cabos', 'peso_corporal', 'kettlebell', 'banda', 'trx', 'barra_fixa',
    'paralelas', 'banco', 'caixa', 'corda_saltar', 'sled', 'remo_ergometro', 'bicicleta', 'passadeira',
    'wall_ball', 'skierg']),
  constraint perfil_privado_gym_days_lte_total check (
    gym_days_per_week is null or days_per_week is null or gym_days_per_week <= days_per_week)
);

comment on table public.perfil_privado is
  'Dados privados do utilizador (contacto e saúde/treino). Só o dono lê/escreve. O PT lê os de treino SÓ via dados_treino_do_aluno() (scope treinos). Nunca expor por policy de tabela a terceiros.';

-- ---------------------------------------------------------------------------
-- 2. Acesso: anónimo nada; autenticado só pelas policies (só o dono).
-- ---------------------------------------------------------------------------
alter table public.perfil_privado enable row level security;
revoke all on public.perfil_privado from anon, authenticated;
grant select, insert, update on public.perfil_privado to authenticated;

create policy "dono lê os seus dados privados" on public.perfil_privado
  for select to authenticated using (auth.uid() = id);
create policy "dono cria os seus dados privados" on public.perfil_privado
  for insert to authenticated with check (auth.uid() = id);
create policy "dono edita os seus dados privados" on public.perfil_privado
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
-- Sem DELETE: a linha vai com a conta (on delete cascade).
-- Sem policy para o PT: ver a função do passo 5.

-- ---------------------------------------------------------------------------
-- 3. Mover os dados — TODAS as linhas de profiles (189 em 2026-09-28).
-- ---------------------------------------------------------------------------
insert into public.perfil_privado (
  id, phone, sex, level, goal, days_per_week, location, location_note, injuries, injury_note,
  focus_muscles, split_format, gym_days_per_week, home_equipment)
select
  id, phone, sex, level, goal, days_per_week, location, location_note, injuries, injury_note,
  focus_muscles, split_format, gym_days_per_week, home_equipment
from public.profiles;

-- Verificação: linha a linha, coluna a coluna. Se UMA diferença existir,
-- aborta e nada desta migração fica aplicado.
do $$
declare
  n_perfis int;
  n_privados int;
  n_diferentes int;
begin
  select count(*) into n_perfis from public.profiles;
  select count(*) into n_privados from public.perfil_privado;
  if n_perfis <> n_privados then
    raise exception 'cópia incompleta: % perfis, % linhas em perfil_privado', n_perfis, n_privados;
  end if;

  select count(*) into n_diferentes
  from public.profiles p join public.perfil_privado v using (id)
  where (p.phone, p.sex, p.level, p.goal, p.days_per_week, p.location, p.location_note, p.injuries,
         p.injury_note, p.focus_muscles, p.split_format, p.gym_days_per_week, p.home_equipment)
    is distinct from
        (v.phone, v.sex, v.level, v.goal, v.days_per_week, v.location, v.location_note, v.injuries,
         v.injury_note, v.focus_muscles, v.split_format, v.gym_days_per_week, v.home_equipment);
  if n_diferentes > 0 then
    raise exception 'cópia com % linha(s) diferente(s) — abortado, nada aplicado', n_diferentes;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Registo: o telemóvel do signup passa a ir para perfil_privado. Mesmo
--    comportamento (incl. UNIQUE do telemóvel a falhar o registo repetido).
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.profiles (id, name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', 'Utilizador'),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'atleta')
  );
  insert into public.perfil_privado (id, phone)
  values (new.id, new.raw_user_meta_data->>'phone');
  return new;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 5. O PT lê os dados de TREINO do aluno — só com ligação ATIVA e scope
--    'treinos' (sempre ligado numa ligação ativa: é o consentimento base de
--    ser acompanhado). Devolve só o que é preciso para prescrever com
--    segurança (objetivo, nível, disponibilidade, local/equipamento, foco,
--    LESÕES). NUNCA o telemóvel nem o sexo. Sem ligação/scope: zero linhas.
-- ---------------------------------------------------------------------------
create or replace function public.dados_treino_do_aluno(p_aluno uuid)
returns table (
  goal text, level text, days_per_week integer, location text, location_note text,
  injuries text[], injury_note text, focus_muscles text[], split_format text,
  gym_days_per_week integer, home_equipment text[])
language sql
stable
security definer
set search_path to 'public'
as $function$
  select v.goal, v.level, v.days_per_week, v.location, v.location_note,
         v.injuries, v.injury_note, v.focus_muscles, v.split_format,
         v.gym_days_per_week, v.home_equipment
  from public.perfil_privado v
  where v.id = p_aluno
    and public.pt_has_scope(auth.uid(), p_aluno, 'treinos');
$function$;

revoke all on function public.dados_treino_do_aluno(uuid) from public, anon;
grant execute on function public.dados_treino_do_aluno(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Remover as colunas de profiles — só chega aqui se a cópia bateu certo.
--    Os CHECKs/UNIQUE destas colunas saem com elas (já recriados acima).
-- ---------------------------------------------------------------------------
alter table public.profiles
  drop column phone,
  drop column sex,
  drop column level,
  drop column goal,
  drop column days_per_week,
  drop column location,
  drop column location_note,
  drop column injuries,
  drop column injury_note,
  drop column focus_muscles,
  drop column split_format,
  drop column gym_days_per_week,
  drop column home_equipment;

commit;
