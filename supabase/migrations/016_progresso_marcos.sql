-- 016_progresso_marcos.sql
--
-- PASSO 7 (progresso — gráficos e histórico): duas colunas aditivas para os
-- "marcos" que os gráficos precisam de distinguir, sem migrar imutabilidade
-- (personal_records e body_metrics já são insert-only por ausência de
-- policy de UPDATE/DELETE — confirmado ao vivo, RLS nega ambas as ações e
-- devolve 0 linhas afetadas; nenhuma das duas precisa de trigger novo).
--
-- 1) personal_records.source — distingue um 1RM testado a sério no ginásio
--    ('manual') de uma estimativa calculada a partir do treino ao vivo
--    ('auto', via RIR-ajustado + Epley em gravarTreino). Precisa de existir
--    porque:
--      - o gráfico marca a FORMA do ponto por origem (nunca cor — a cor
--        fica reservada ao marco de novo recorde/descarga);
--      - o motor (maxesFromPRs → baseLifts) tem de preferir SEMPRE o manual
--        quando existir, e só cair para o auto na ausência de manual — uma
--        estimativa inflacionada nunca pode empurrar as cargas prescritas
--        para cima de um 1RM real testado.
--    Default 'manual': todas as linhas que já existem hoje foram escritas
--    à mão (nenhum código escrevia em personal_records antes desta fase).
--
-- 2) workout_sessions.is_deload — se a sessão aconteceu numa semana de
--    descarga da progressão ativa no momento em que foi gravada. Sem isto
--    não há forma fiável de, meses depois, saber que uma quebra de volume
--    foi intencional (descarga) e não um treino saltado — reconstruir isto
--    a posteriori a partir do histórico da progressão seria frágil (o
--    algoritmo de progressão de um plano de PT é outro, distinto do motor).
--    Default false: sessões antigas ficam sem marca (limitação honesta,
--    não inventamos o passado).

begin;

alter table public.personal_records
  add column if not exists source text not null default 'manual'
  check (source in ('manual', 'auto'));

comment on column public.personal_records.source is
  '''manual'' = testado a sério e registado à mão; ''auto'' = estimado a partir de uma série do treino ao vivo (RIR-ajustado + Epley, reps efetivas ≤8). O motor só usa ''auto'' na ausência de um ''manual'' para o mesmo levantamento.';

alter table public.workout_sessions
  add column if not exists is_deload boolean not null default false;

comment on column public.workout_sessions.is_deload is
  'true quando a sessão foi gravada durante uma semana de descarga da progressão ativa nesse momento. Só sessões gravadas depois desta migração têm o valor correto.';

commit;
