-- 012_active_plans.sql
--
-- "PT atribui plano ao aluno": a partir de agora um aluno pode ter mais do
-- que uma linha em training_plans à sua disposição — a que ele próprio gerou
-- (owner_id = student_id) e a(s) que um PT lhe atribuiu (owner_id = PT). A
-- pergunta "qual está ativo agora" deixa de poder viver em
-- training_plans.is_active (isso identifica o plano por DONO, não por
-- aluno) — e o aluno tem de conseguir apontar para uma linha que não é sua,
-- o que a RLS de training_plans (migração 011) deliberadamente não permite
-- (seria reabrir o mesmo buraco que a 011 fechou: mexer numa linha alheia).
--
-- Solução: um ponteiro à parte, "qual plano este aluno está a seguir agora",
-- que só o próprio aluno controla — independente de quem escreveu o
-- conteúdo do plano apontado.
--
-- Compatibilidade: sem linha aqui para um utilizador, o código de leitura
-- (src/lib/treino/perfil.ts::carregarPlanoAtivo) cai para a query antiga
-- (training_plans por owner_id + is_active=true) — ninguém com plano de
-- antes desta migração fica sem nada.

begin;

create table if not exists public.active_plans (
  student_id uuid primary key references public.profiles(id) on delete cascade,
  plan_id uuid not null references public.training_plans(id) on delete cascade,
  updated_at timestamptz not null default now()
);

comment on table public.active_plans is
  'Qual training_plans o aluno está a seguir agora. Só o aluno escreve aqui; plan_id tem de ser um plano cujo student_id seja ele próprio (dele ou atribuído por um PT com ligação ativa — a RLS de training_plans já garante isso).';

alter table public.active_plans enable row level security;

create policy "active_plans_select"
  on public.active_plans
  for select
  using (student_id = auth.uid());

create policy "active_plans_insert"
  on public.active_plans
  for insert
  with check (
    student_id = auth.uid()
    and exists (
      select 1 from public.training_plans tp
      where tp.id = plan_id and tp.student_id = auth.uid()
    )
  );

create policy "active_plans_update"
  on public.active_plans
  for update
  using (student_id = auth.uid())
  with check (
    student_id = auth.uid()
    and exists (
      select 1 from public.training_plans tp
      where tp.id = plan_id and tp.student_id = auth.uid()
    )
  );

-- Sem policy de DELETE: nunca é preciso apagar o ponteiro, só fazer upsert
-- (escolher outro plano substitui o plan_id da mesma linha).

commit;
