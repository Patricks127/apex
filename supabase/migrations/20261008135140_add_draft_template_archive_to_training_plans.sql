
ALTER TABLE public.training_plans
  ADD COLUMN IF NOT EXISTS is_draft     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_template  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at  timestamptz DEFAULT NULL;

COMMENT ON COLUMN public.training_plans.is_draft    IS 'Plano ainda não partilhado com o atleta';
COMMENT ON COLUMN public.training_plans.is_template IS 'Modelo reutilizável (não atribuído a nenhum atleta)';
COMMENT ON COLUMN public.training_plans.archived_at IS 'Data em que o plano foi arquivado; NULL = ativo';

-- Index to quickly list non-archived plans
CREATE INDEX IF NOT EXISTS training_plans_archived_at_idx ON public.training_plans (archived_at) WHERE archived_at IS NULL;
