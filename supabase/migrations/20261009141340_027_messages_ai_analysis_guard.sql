-- 027_messages_ai_analysis_guard.sql — APLICADA a 2026-10-09 (versão 20261009141340)
--
-- Cache da análise IA de uma foto de evolução (server action
-- analisarFotoEvolucao em src/app/actions/chat.ts).
--
-- (1) Coluna nova `messages.ai_analysis` (text, null = ainda não analisada).
--
-- (2) O trigger de imutabilidade da 006 lista as colunas que bloqueia — uma
--     coluna nova ficaria livre para QUALQUER membro da ligação (o aluno
--     podia escrever uma "análise" falsa). Passa a valer:
--       · ai_analysis só pode ser escrita UMA vez (null → texto),
--       · só pelo PT da ligação,
--       · só numa foto de evolução.
--
-- ORDEM: aplicar a migração ANTES do push do código — as páginas do chat já
-- pedem `ai_analysis` no select e falham sem a coluna.

begin;

alter table public.messages add column if not exists ai_analysis text;

create or replace function public.messages_guard_update()
returns trigger
language plpgsql
security invoker
as $fn$
begin
  -- Operações de backend de confiança (service_role / postgres) não interferem.
  if auth.uid() is null then
    return new;
  end if;

  if new.link_id      is distinct from old.link_id
     or new.sender_id    is distinct from old.sender_id
     or new.body         is distinct from old.body
     or new.media_path   is distinct from old.media_path
     or new.media_kind   is distinct from old.media_kind
     or new.is_evolution is distinct from old.is_evolution
     or new.weight_kg    is distinct from old.weight_kg
     or new.measurement  is distinct from old.measurement
     or new.created_at   is distinct from old.created_at then
    raise exception 'messages: depois de enviada, só o read_at pode ser alterado';
  end if;

  if new.ai_analysis is distinct from old.ai_analysis then
    if old.ai_analysis is not null then
      raise exception 'messages: a análise IA já existe e não pode ser alterada';
    end if;
    if not old.is_evolution or old.media_kind is distinct from 'image' then
      raise exception 'messages: só fotos de evolução têm análise IA';
    end if;
    if not exists (
      select 1 from public.pt_links l
      where l.id = old.link_id
        and l.pt_id = auth.uid()
        and l.status = 'ativo'
    ) then
      raise exception 'messages: só o PT da ligação pode gravar a análise IA';
    end if;
  end if;

  return new;
end
$fn$;

commit;
