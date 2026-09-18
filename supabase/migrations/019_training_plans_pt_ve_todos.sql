-- 019_training_plans_pt_ve_todos.sql
--
-- O PT passa a VER todos os planos dos seus alunos (criados pelo PT,
-- pelo próprio aluno via motor, ou por qualquer outra via futura) — sob
-- o mesmo consentimento 'treinos' que o aluno já dá e pode revogar a
-- qualquer momento (pt_links.scope_treinos). Só muda o SELECT.
--
-- Motivação: descoberto ao construir o painel do PT (Passo 2) — a policy
-- da 011 só deixava o PT ler linhas onde owner_id = ele próprio. Um plano
-- que o aluno gerou para si via motor (owner_id = student_id) ficava
-- invisível ao PT mesmo com scope_treinos ativo, obrigando a um
-- workaround na UI ("Sem plano teu atribuído" em vez de mostrar o plano
-- real). Isso não era intencional como limite de segurança — a 011 nunca
-- discute negar ao PT a VISÃO do plano que o aluno já segue; discute só
-- impedir edição indevida e reatribuição para outra pessoa. Este limite
-- era um efeito colateral da condição `owner_id = auth.uid()` no ramo do
-- PT, não uma decisão deliberada de a esconder.
--
-- O que MUDA: só a policy de SELECT — o ramo do PT deixa de exigir
-- owner_id = auth.uid() e passa a exigir só pt_has_scope(auth.uid(),
-- student_id, 'treinos'), independentemente de quem é o owner_id.
--
-- O que NÃO muda (mantido intacto da 011):
--   - INSERT: inalterada — só em nome próprio, ou como PT com scope
--     'treinos' ao aluno-alvo (não se cria em nome de outro dono).
--   - UPDATE: inalterada — continua a exigir owner_id = auth.uid(). Um
--     PT que passa a VER o plano que o aluno criou continua a NÃO o
--     poder editar — só quem o criou edita.
--   - Trigger de imutabilidade de id/created_at/owner_id/student_id:
--     inalterado.
--   - Revogar a ligação (ou desligar scope_treinos) continua a cortar
--     TODO o acesso do PT — SELECT reconsulta pt_has_scope em cada
--     leitura, não guarda nada da altura da concessão.
--
-- NOTA (limite que esta migração NÃO resolve, fora do pedido): a tabela
-- active_plans (migração 012, "qual plano está ativo AGORA para este
-- aluno") continua com SELECT restrito a student_id = auth.uid() — só o
-- aluno lê o seu próprio ponteiro. Se um aluno tiver vários planos e
-- escolher explicitamente um que não seja "o mais recente com owner_id=
-- ele próprio e is_active=true", carregarPlanoAtivo(supabase_do_PT, ...)
-- continua a não saber qual é esse (cai no fallback, que pode divergir
-- do que o aluno escolheu). Não é o que foi pedido nesta migração — só
-- fica registado para não ficar escondido.

begin;

drop policy "training_plans_select" on public.training_plans;

create policy "training_plans_select"
  on public.training_plans
  for select
  using (
    student_id = auth.uid()
    or owner_id = auth.uid()
    or public.pt_has_scope(auth.uid(), student_id, 'treinos')
  );

commit;
