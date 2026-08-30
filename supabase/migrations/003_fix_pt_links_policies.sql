-- 003_fix_pt_links_policies.sql
--
-- Problema corrigido: a policy de UPDATE do PT em public.pt_links era
-- permissiva de mais — permitia ao PT alterar scope_* e mudar status para
-- 'revogado' (ou de volta a 'ativo'), diretamente via API com o seu token.
--
-- Regra de negócio a impor na BD:
--   * O PT só pode responder a um pedido PENDENTE: 'pendente' -> 'ativo' | 'recusado'.
--     Não pode tocar em scope_*, não pode revogar, não pode trocar pt_id/student_id.
--   * O ALUNO (student_id) mantém controlo TOTAL sobre os scope_* e sobre revogar
--     / reabrir a ligação.
--   * pt_id, student_id e created_at são imutáveis via API para toda a gente.
--
-- Uma policy RLS não consegue comparar a linha nova com a antiga (WITH CHECK só
-- "vê" a linha nova), por isso o "o que pode mudar" é imposto por um trigger
-- BEFORE UPDATE, que tem acesso a OLD e NEW. As policies RLS ficam a decidir
-- apenas QUEM pode sequer tentar o UPDATE.

begin;

-- ---------------------------------------------------------------------------
-- 1. Remover TODAS as policies de UPDATE existentes em public.pt_links
--    (não sabemos os nomes originais; recriamos o conjunto correto a seguir).
-- ---------------------------------------------------------------------------
do $mig$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'pt_links'
      and cmd = 'UPDATE'
  loop
    execute format('drop policy %I on public.pt_links', pol.policyname);
    raise notice 'pt_links: policy de UPDATE removida -> %', pol.policyname;
  end loop;

  -- Aviso: uma policy FOR ALL também concede UPDATE. Se existir alguma,
  -- é preciso tratá-la à mão (não é removida aqui para não afetar
  -- SELECT/INSERT/DELETE que ela também cobre).
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'pt_links' and cmd = 'ALL'
  loop
    raise warning 'pt_links: existe uma policy FOR ALL (%) que ainda concede UPDATE ao PT — rever manualmente', pol.policyname;
  end loop;
end
$mig$;

-- ---------------------------------------------------------------------------
-- 2. Policy do ALUNO — controlo total sobre a sua própria ligação.
--    (scopes, revogar, reabrir; a imutabilidade de pt_id/student_id fica
--    garantida pelo trigger do ponto 4.)
-- ---------------------------------------------------------------------------
create policy "pt_links_update_student"
  on public.pt_links
  for update
  to authenticated
  using (auth.uid() = student_id)
  with check (auth.uid() = student_id);

-- ---------------------------------------------------------------------------
-- 3. Policy do PT — só toca em pedidos PENDENTES e o resultado tem de ficar
--    'ativo' ou 'recusado'. O detalhe (não mexer em scope_*, não trocar ids)
--    é imposto pelo trigger.
-- ---------------------------------------------------------------------------
create policy "pt_links_update_pt_respond"
  on public.pt_links
  for update
  to authenticated
  using (auth.uid() = pt_id and status = 'pendente')
  with check (auth.uid() = pt_id and status in ('ativo', 'recusado'));

-- ---------------------------------------------------------------------------
-- 4. Trigger BEFORE UPDATE — valida O QUE mudou conforme QUEM faz o update.
-- ---------------------------------------------------------------------------
create or replace function public.pt_links_guard_update()
returns trigger
language plpgsql
security invoker
as $fn$
declare
  uid uuid := auth.uid();
begin
  -- Operações de backend de confiança (service_role / postgres) não têm
  -- auth.uid() — não interferir.
  if uid is null then
    return new;
  end if;

  -- Identidade da ligação: imutável via API para toda a gente.
  if new.pt_id is distinct from old.pt_id
     or new.student_id is distinct from old.student_id
     or new.created_at is distinct from old.created_at then
    raise exception 'pt_links: pt_id, student_id e created_at são imutáveis';
  end if;

  -- O ALUNO manda na sua ligação: scope_*, status (incl. revogado / reabrir)
  -- e requested_by.
  if uid = old.student_id then
    return new;
  end if;

  -- O PT só pode responder a um pedido pendente, sem tocar em mais nada.
  if uid = old.pt_id then
    if old.status <> 'pendente' then
      raise exception 'pt_links: o PT só pode agir sobre pedidos pendentes (estado atual: %)', old.status;
    end if;
    if new.status not in ('ativo', 'recusado') then
      raise exception 'pt_links: o PT só pode mudar o estado para ativo ou recusado';
    end if;
    if new.scope_treinos   is distinct from old.scope_treinos
       or new.scope_evolucao is distinct from old.scope_evolucao
       or new.scope_videos   is distinct from old.scope_videos
       or new.scope_metricas is distinct from old.scope_metricas then
      raise exception 'pt_links: o PT não pode alterar as permissões (scope_*)';
    end if;
    if new.requested_by is distinct from old.requested_by then
      raise exception 'pt_links: o PT não pode alterar requested_by';
    end if;
    return new;
  end if;

  -- Qualquer outra pessoa (a RLS já devia ter bloqueado).
  raise exception 'pt_links: sem permissão para atualizar esta ligação';
end
$fn$;

drop trigger if exists trg_pt_links_guard_update on public.pt_links;
create trigger trg_pt_links_guard_update
  before update on public.pt_links
  for each row
  execute function public.pt_links_guard_update();

commit;

-- ---------------------------------------------------------------------------
-- Notas
-- ---------------------------------------------------------------------------
-- * INSERT, SELECT e DELETE de pt_links não são tocados por esta migração:
--   continua a não haver policy de DELETE (revogar = mudar status), e o INSERT
--   continua a exigir student_id = auth.uid().
-- * pt_has_scope(p_pt, p_student, p_scope) não muda — passa a false assim que
--   o aluno revoga, como antes.
