# Decisões e princípios

Registo de decisões de produto/arquitetura que não são óbvias a partir do
código nem do histórico do git — coisas que foram pesadas conscientemente e
podem precisar de ser reavaliadas quando o contexto do produto mudar.

## RLS de `training_plans` — PT atual vê o historial completo do aluno (migração 019)

A partir da migração 019, a policy de SELECT de `training_plans` deixa de
exigir `owner_id = auth.uid()` no ramo do PT — passa a bastar
`student_id = <aluno>` + `pt_has_scope(PT, aluno, 'treinos')` ativo,
independentemente de quem é o `owner_id`. Isto foi feito para resolver um
buraco real: um plano que o aluno gerou para si próprio via motor
(`owner_id = student_id`) era invisível ao PT mesmo com scope ativo.

**Efeito secundário, aceite conscientemente**: a RLS de `training_plans`
permite ao PT atual ler TODO o historial de planos do aluno, incluindo os
criados por PTs anteriores cuja ligação já foi revogada. Se a Ana teve um PT
antigo que lhe criou planos, e hoje tem um PT novo com `scope_treinos`
ativo, o PT novo consegue, via RLS, ler os planos que o PT antigo escreveu —
`owner_id` não filtra nada nesse ramo.

Aceite porque o consentimento que conta é o da Ana (o dono dos dados de
treino é ela, não quem os escreveu) — mas a policy **não filtra por
`is_active`** (nunca filtrou, mesmo antes da 019), portanto isto não é só
"o PT novo vê o plano que a Ana segue agora" — é "o PT novo consegue, se
quiser, ler todo o historial de planos que ela já teve, de qualquer PT".

**Salvaguarda no código, não na RLS**: `carregarPlanoAtivo`
(`src/lib/treino/perfil.ts`) devolve sempre UM plano só — o apontado por
`active_plans`, ou por fallback o mais recente `owner_id=aluno AND
is_active=true`. Nenhum ecrã (verificado: `/plano`, `/pt/aluno/[id]`,
`/painel`, `/treino/[dia]`) lista "todos os planos que este aluno já teve
com outros PTs" — a única listagem múltipla existente é em `/plano/page.tsx`,
e essa é sempre o PRÓPRIO aluno a ver os planos dele (`student_id =
auth.uid()`), nunca um PT a ver os de outro PT.

**Se algum ecrã futuro quiser expor historial de planos** (ex.: um PT a
rever "planos anteriores da Ana" numa ficha), isto tem de voltar a ser
discutido antes de construir — o conteúdo de um plano é, na prática,
propriedade intelectual de programação de outro profissional, e hoje só não
é exposto porque nenhuma UI o lista, não porque a RLS o impeça.

É uma decisão de produto, não técnica — pode ter de mudar quando houver PTs
reais a concorrer entre si na mesma plataforma.

**Verificação** (`scripts/training-plans-rls-019-login-test.ts`, login com
contas reais confirmadas — sem desligar "Confirm email" — 7/7 PASS): PT vê o
plano self-made do aluno; PT não o edita; revogar corta tudo, incluindo o
self-made. O caso "PT atual vê plano de um PT antigo revogado" não foi
montado ao vivo (só há uma conta de PT confirmada disponível para teste) —
fechado por prova lógica sobre o texto confirmado em `pg_policies`: a
cláusula `pt_has_scope(auth.uid(), student_id, 'treinos')` nunca referencia
`owner_id`, e o teste ao vivo já percorre esse mesmo ramo com um `owner_id`
diferente do PT (o do próprio aluno) — um `owner_id` de um PT antigo passa
pelo mesmo código, sem distinção possível. Aceite pelo utilizador em vez de
criar uma segunda conta de PT só para este caso.

## /onboarding e /ligar ficam ESCUROS de propósito (Fase 2, 2026-09-27)

Na Fase 2, /entrar e /registar passaram a modo claro (`_ui/auth-claro.tsx`,
commit `8cbe6fc`). **/onboarding e /ligar ficaram escuros de propósito** —
não é um esquecimento nem uma dívida a corrigir. Não os passar a claro.

Porquê: está previsto passar a app toda a tema escuro depois do teste com a
Daniela; converter estes dois ecrãs agora seria trabalho deitado fora daqui
a semanas. A testadora foi avisada do salto de tema temporário (registo
claro → onboarding escuro).

Consequência no código: `_ui/cartao-auth.tsx` e `_ui/campos.tsx` (escuros)
continuam vivos só para estes dois ecrãs — não os apagar como "código
morto", e não os trocar pelos componentes claros de `_ui/auth-claro.tsx`.

A reavaliar quando se decidir o tema da app depois do teste.
