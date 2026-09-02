-- 005_progression.sql
--
-- Estado da progressão semanal (sobrecarga progressiva) do motor de treino.
--
-- Vai numa coluna jsonb em training_plans (não em profiles nem em tabela
-- própria) porque:
--   * o estado é RELATIVO a um plano concreto — `loadBonus` acumula kg sobre
--     as cargas prescritas por esse plano; se o plano muda (novo objetivo /
--     dias, via /onboarding ou "regenerar"), a progressão TEM de reiniciar;
--   * só há um plano ativo de cada vez (`is_active`), portanto "a progressão
--     do utilizador" = "a progressão do plano ativo" — sem ambiguidade;
--   * fica no mesmo sítio que o plano: sem FK extra, sem linhas órfãs, e as
--     policies de training_plans já o cobrem (dono + PT);
--   * o histórico semanal (`history[]`) mora dentro do próprio jsonb — chega
--     para o `advanceWeek` e para mostrar o registo de progressão.

alter table public.training_plans
  add column if not exists progression jsonb not null default
    '{"week":1,"loadBonus":0,"repBonus":0,"streak":0,"lastRpe":null,"deloadWeek":false,"history":[]}'::jsonb;

comment on column public.training_plans.progression is
  'Estado de progressão semanal do motor: {week, loadBonus, repBonus, streak, lastRpe, deloadWeek, history[]}';
