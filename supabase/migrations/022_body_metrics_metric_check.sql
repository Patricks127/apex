-- 022_body_metrics_metric_check.sql
--
-- body_metrics.metric era TEXTO LIVRE: a lista de medidas válidas só
-- existia na Server Action (src/lib/treino/metricas.ts → registarMetrica).
-- Quem chamasse a API do Supabase diretamente (a própria conta, com o seu
-- JWT — a RLS deixa o dono inserir) conseguia gravar qualquer coisa: há uma
-- linha 'xyz_nonsense' de 2026-09-13 na conta de teste 'edu graça'. Não era
-- uma fuga de privacidade (a RLS limita sempre à própria conta; os ecrãs
-- ignoram tipos desconhecidos), era falta de integridade. Esta CHECK põe a
-- regra onde as outras tabelas já a têm: na base de dados.
--
-- Valores confirmados ANTES de escrever isto (SELECT metric, count(*)
-- GROUP BY metric em produção, 2026-09-28): só existem os 8 tipos atuais —
-- nenhum tipo antigo a preservar — e UMA linha inválida ('xyz_nonsense',
-- id 4d70ac1c-e508-4c9b-8e19-2eaf7e45c6c2), a apagar ANTES desta migração
-- (DELETE à parte, confirmado pelo utilizador).
--
-- A lista tem de ficar igual a METRICAS em src/lib/treino/metricas.ts —
-- src/lib/treino/metricas.test.ts falha se as duas divergirem.
--
-- Só isto muda: uma CHECK nova em body_metrics.metric. Não mexe em RLS,
-- policies, grants, nem em nenhuma outra coluna; a tabela continua
-- insert-only (sem policy de UPDATE/DELETE). VALIDADA (não NOT VALID): com
-- a linha inválida apagada, a regra fica garantida para todas as linhas,
-- antigas e novas.

begin;

-- Guarda: se ainda houver alguma linha fora da lista (o DELETE não foi
-- corrido, ou apareceu outra entretanto), aborta com uma mensagem clara em
-- vez do erro genérico da CHECK — e nada desta migração fica aplicado.
do $$
declare
  n_invalidas int;
begin
  select count(*) into n_invalidas
  from public.body_metrics
  where metric not in ('weight_kg', 'height_cm', 'waist_cm', 'abdomen_cm', 'hip_cm', 'chest_cm', 'arm_cm', 'thigh_cm');
  if n_invalidas > 0 then
    raise exception 'body_metrics tem % linha(s) com metric fora da lista — corre primeiro o DELETE de limpeza', n_invalidas;
  end if;
end $$;

alter table public.body_metrics add constraint body_metrics_metric_check
  check (metric = any (array[
    'weight_kg'::text,
    'height_cm'::text,
    'waist_cm'::text,
    'abdomen_cm'::text,
    'hip_cm'::text,
    'chest_cm'::text,
    'arm_cm'::text,
    'thigh_cm'::text
  ]));

commit;
