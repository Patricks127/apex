-- 014_training_plans_progress_only.sql
--
-- Correção à 013: o trigger deixava o aluno mudar `days` (não só
-- `progression`) num plano do PT — permitia reescrever os exercícios que o
-- PT prescreveu. Apanhado antes de construir a funcionalidade, ao ser
-- questionado se a 013 restringia mesmo só a `progression` (não restringia).
--
-- Correção de desenho, não só de trigger: a progressão de um plano de PT não
-- precisa de escrever `days` — calcula-se em leitura, a partir do `days`
-- base (o que o PT prescreveu) + `progression` (multiplicador/estado do
-- aluno), tal como o motor já faz para os planos gerados (nunca muta a
-- seleção guardada, só recalcula cargas a partir do progression). Por isso
-- `days` passa a estar tão protegido como `name`/`split_style`/`is_active`
-- nesta via: só o dono (o PT) o pode mudar.

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
  -- pode mudar `progression`. `days` (os exercícios) só o dono muda.
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
    if new.days is distinct from old.days then
      raise exception 'training_plans: só o dono do plano pode mudar os exercícios (days) — a progressão só grava em progression';
    end if;
  end if;

  return new;
end
$fn$;

commit;
