-- 013_training_plans_progress_update.sql
--
-- A 011 só deixa o DONO (owner_id = auth.uid()) fazer UPDATE a training_plans.
-- Isso está certo para o conteúdo do plano — mas "avançar semana" é uma ação
-- do ALUNO (ele é quem regista treinos e fecha a semana), mesmo quando o
-- plano ativo foi criado por um PT. A 011 não previu este caso: pensou em
-- "o PT edita o que criou" e "o aluno não edita o que o PT criou", não em
-- "o aluno avança a PRÓPRIA progressão dentro do plano do PT".
--
-- Esta migração abre exatamente essa fresta, e só essa:
--   - nova policy de UPDATE para o aluno (student_id = auth.uid());
--   - o trigger de guarda (já existente, da 011) passa a exigir que, quando
--     quem grava é o aluno e NÃO o dono, `name`, `split_style` e `is_active`
--     fiquem exatamente iguais — só `days` e `progression` podem mudar por
--     essa via. O aluno continua sem poder renomear, desativar ou tocar em
--     qualquer outra coisa num plano que não é dele.
--
-- id/created_at/owner_id/student_id continuam imutáveis para todos (regra
-- da 011, inalterada).

begin;

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

  -- O aluno avança a progressão de um plano que não é seu (dono = PT): só
  -- pode mudar days/progression, mais nada.
  if auth.uid() = old.student_id and auth.uid() <> old.owner_id then
    if new.name is distinct from old.name then
      raise exception 'training_plans: só o dono do plano pode mudar o nome';
    end if;
    if new.split_style is distinct from old.split_style then
      raise exception 'training_plans: só o dono do plano pode mudar o split_style';
    end if;
    if new.is_active is distinct from old.is_active then
      raise exception 'training_plans: só o dono do plano pode mudar is_active';
    end if;
  end if;

  return new;
end
$fn$;

-- Nova policy: o aluno também pode ser alvo de UPDATE na sua linha ativa de
-- PT — o trigger acima é quem restringe A QUE colunas isso se aplica.
create policy "training_plans_update_progress"
  on public.training_plans
  for update
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

commit;
