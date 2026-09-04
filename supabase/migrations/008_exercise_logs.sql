-- 008_exercise_logs.sql
--
-- Registo POR EXERCÍCIO de cada sessão de treino.
--
-- Porquê uma tabela nova:
--   `workout_sessions` guarda a sessão inteira (título, nº de séries, volume,
--   RPE médio, adesão) e `workout_checkins` o check-in da sessão (zonas de
--   desconforto, esforço, nota). Nenhuma das duas sabe QUE exercício se fez
--   com que carga / reps / RPE, nem se algum foi saltado.
--
--   O motor v2 (spec §5) decide MANTER ou SUBSTITUIR um exercício concreto a
--   partir de: estagnação de carga/RPE ≥3 semanas, RPE sistematicamente acima
--   do alvo, e o utilizador saltar o exercício repetidamente. Isso precisa do
--   detalhe por exercício, semana a semana. (O gatilho de desconforto por zona
--   já funciona só com `workout_checkins`.)
--
-- Segurança (regra da casa):
--   * INSERT-only. Sem policy de UPDATE nem de DELETE → a RLS nega ambos a
--     toda a gente, dono incluído. Um trigger BEFORE UPDATE reforça-o (como a
--     imutabilidade das mensagens na migração 006). O histórico não se
--     reescreve — se puder ser editado, perde-se a base de comparação.
--   * O DELETE em cascata a partir de `workout_sessions` continua a funcionar
--     (a ação da FK corre fora da RLS); o utilizador que apaga uma sessão
--     apaga os logs dela.
--   * SELECT: o dono e um PT LIGADO com scope 'treinos' (mesma regra dos
--     check-ins clínicos), via `pt_has_scope`.

create table if not exists public.exercise_logs (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.workout_sessions (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  exercise_id  text not null,                       -- id do exercício no motor v2
  week_number  integer not null default 1,
  ordem        integer not null default 1,
  skipped      boolean not null default false,
  load_kg      numeric(6, 2),
  reps         integer,
  sets_done    integer,
  rpe          numeric(3, 1) check (rpe is null or (rpe >= 6 and rpe <= 10)),
  created_at   timestamptz not null default now()
);

create index if not exists exercise_logs_user_ex_week_idx
  on public.exercise_logs (user_id, exercise_id, week_number);

alter table public.exercise_logs enable row level security;

-- SELECT — dono
create policy exercise_logs_select_own on public.exercise_logs
  for select
  using (user_id = auth.uid());

-- SELECT — PT ligado com scope 'treinos'
create policy exercise_logs_select_pt on public.exercise_logs
  for select
  using (public.pt_has_scope(auth.uid(), exercise_logs.user_id, 'treinos'));

-- INSERT — só linhas próprias
create policy exercise_logs_insert_own on public.exercise_logs
  for insert
  with check (user_id = auth.uid());

-- (sem policy de UPDATE nem DELETE — a RLS nega-os por omissão)

-- Reforço: imutável depois de inserido.
create or replace function public.exercise_logs_block_update()
returns trigger
language plpgsql
as $$
begin
  raise exception 'exercise_logs são imutáveis (INSERT-only)';
end;
$$;

drop trigger if exists exercise_logs_no_update on public.exercise_logs;
create trigger exercise_logs_no_update
  before update on public.exercise_logs
  for each row execute function public.exercise_logs_block_update();

comment on table public.exercise_logs is
  'Registo por exercício de cada sessão (carga/reps/RPE/saltado). INSERT-only; base do motor v2 §5 para manter/substituir exercícios.';
