-- 011_training_plans_rls_hardening.sql
--
-- training_plans era a última tabela com policy de UPDATE ampla
-- (owner_id = auth.uid(), sem mais nada). Sondagem contra a BD real
-- (scripts/training-plans-rls-probe.ts) — feita ANTES de construir "PT
-- atribui plano" — confirmou 3 falhas:
--
--   1. student_id é livremente mutável pelo dono da linha: um atleta muda o
--      student_id do seu próprio plano para outra pessoa; um PT com um
--      plano legítimo para O SEU aluno consegue redirecioná-lo para uma
--      vítima com quem não tem ligação NENHUMA.
--   2. Consequência direta: já existe (e faz sentido manter) uma policy de
--      SELECT que deixa student_id = auth.uid() ler a linha — confirmado
--      que a vítima do ponto 1 conseguia LER o plano injetado.
--   3. Um PT revogado mantinha UPDATE e SELECT sobre os planos que tinha
--      criado — a policy nunca reconsultava a ligação depois da criação.
--
-- O que já estava certo (não mexido no espírito, só tornado explícito):
--   - PT sem ligação não insere plano para um aluno;
--   - aluno não edita o plano que o PT lhe atribuiu;
--   - dono não muda o próprio owner_id.
--
-- Correção:
--   - id, created_at, owner_id, student_id ficam IMUTÁVEIS (trigger, mesmo
--     padrão de profiles_guard_update / pt_links_guard_update). Reatribuir
--     um plano é sempre uma linha NOVA — a app já trata planos como
--     histórico (is_active:false na antiga + INSERT da nova), nunca apaga.
--   - SELECT/UPDATE de uma linha de PT (owner_id <> student_id) passam a
--     reconsultar pt_has_scope(owner_id, student_id, 'treinos') em CADA
--     acesso, não só na criação — revogar corta imediatamente.
--   - O aluno continua a ver sempre as suas próprias linhas (student_id =
--     auth.uid()), mesmo que o PT que as criou tenha sido entretanto
--     revogado — perder a visibilidade do PRÓPRIO plano não é uma questão
--     de segurança; o que importa é o PT (ex-)PT perder acesso.

begin;

-- 1. imutabilidade de id/created_at/owner_id/student_id ---------------------

create or replace function public.training_plans_guard_update()
returns trigger
language plpgsql
security invoker
as $fn$
begin
  -- Backend de confiança (service_role / postgres): sem restrições.
  if auth.uid() is null then
    return new;
  end if;

  if new.id is distinct from old.id then
    raise exception 'training_plans: o id não pode ser alterado';
  end if;
  if new.created_at is distinct from old.created_at then
    raise exception 'training_plans: created_at não pode ser alterado';
  end if;
  if new.owner_id is distinct from old.owner_id then
    raise exception 'training_plans: owner_id não pode ser alterado';
  end if;
  if new.student_id is distinct from old.student_id then
    raise exception 'training_plans: student_id não pode ser alterado — cria um plano novo em vez de reatribuir este';
  end if;

  return new;
end
$fn$;

drop trigger if exists trg_training_plans_guard_update on public.training_plans;
create trigger trg_training_plans_guard_update
  before update on public.training_plans
  for each row
  execute function public.training_plans_guard_update();

-- 2. substituir TODAS as policies existentes por um conjunto explícito ------
--    (em vez de tentar adivinhar/alterar a(s) policy(ies) atual(is) pelo
--    nome, remove-se tudo o que existir em training_plans e recria-se do
--    zero — fica claro e auto-contido o que a tabela permite.)

do $$
declare
  pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'training_plans'
  loop
    execute format('drop policy %I on public.training_plans', pol.policyname);
    raise notice 'training_plans: policy removida -> %', pol.policyname;
  end loop;
end
$$;

alter table public.training_plans enable row level security;

-- SELECT: o aluno vê sempre as linhas que são para ele; o dono só as vê
-- enquanto a ligação com o aluno se mantiver (um plano próprio, onde
-- owner_id = student_id, está sempre coberto).
create policy "training_plans_select"
  on public.training_plans
  for select
  using (
    student_id = auth.uid()
    or (
      owner_id = auth.uid()
      and (owner_id = student_id or public.pt_has_scope(auth.uid(), student_id, 'treinos'))
    )
  );

-- INSERT: só em nome próprio, ou como PT com ligação ativa + scope
-- 'treinos' ao aluno-alvo.
create policy "training_plans_insert"
  on public.training_plans
  for insert
  with check (
    owner_id = auth.uid()
    and (
      student_id = auth.uid()
      or public.pt_has_scope(auth.uid(), student_id, 'treinos')
    )
  );

-- UPDATE: a mesma regra do lado do dono que a SELECT. owner_id/student_id
-- são imutáveis (trigger acima); esta condição cobre as restantes colunas
-- (days, progression, is_active, name, split_style) e — por reconsultar
-- pt_has_scope em cada acesso, não só no INSERT — corta o PT assim que a
-- ligação ou o scope 'treinos' deixarem de estar ativos.
create policy "training_plans_update"
  on public.training_plans
  for update
  using (
    owner_id = auth.uid()
    and (owner_id = student_id or public.pt_has_scope(auth.uid(), student_id, 'treinos'))
  )
  with check (
    owner_id = auth.uid()
    and (owner_id = student_id or public.pt_has_scope(auth.uid(), student_id, 'treinos'))
  );

commit;
