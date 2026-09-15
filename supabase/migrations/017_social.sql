-- 017_social.sql
--
-- PASSO 8 (rede social) — CORREÇÃO, não criação. As tabelas posts,
-- post_likes, post_comments e follows já existiam na BD antes desta fase
-- (mesma categoria de workout_sessions/personal_records: criadas antes do
-- controlo de migrações neste repo). O desenho existente é MELHOR do que
-- o que eu tinha proposto (colunas nomeadas por tipo — workout_title,
-- workout_sets, workout_volume, workout_rpe, record_lift, record_value,
-- media_path, media_kind — em vez de um payload jsonb livre): torna
-- estruturalmente impossível gravar `checkin`/`discomfort_zones`/
-- `weight_kg`/`measurement`, porque essas colunas simplesmente não
-- existem em `posts`.
--
-- EXCEÇÃO a essa garantia, encontrada ao verificar (regra da casa) antes
-- de construir o frontend: `workout_rpe` EXISTE como coluna em `posts`.
-- A estrutura, por si só, NÃO impede gravar RPE num post público — quem
-- impede é só a Server Action (prepararPost/criarPost) nunca escrever lá.
-- Ver src/lib/social/sanitizar-post.ts.
--
-- BURACO REAL encontrado (pg_policies, confirmado pelo utilizador
-- diretamente no dashboard): `posts` tinha uma única policy de UPDATE,
-- `qual = auth.uid() = author_id`, `with_check` NULL. Isto restringe
-- corretamente QUEM pode editar (só o próprio autor — um utilizador
-- diferente não consegue localizar a linha para editar, confirmado:
-- tentativa de B sobre o post de A devolve 200 com corpo [], a linha
-- fica intacta) — mas NÃO restringe O QUE fica depois de editado.
-- Resultado: o PRÓPRIO autor conseguia reescrever qualquer coluna do seu
-- post depois de publicado, incluindo `workout_rpe` (confirmado ao vivo:
-- um post sem RPE passou a ter `workout_rpe = 9.5` via UPDATE do dono).
-- Não era "qualquer um edita o post de outro" — era "o autor edita o
-- próprio post sem limite de colunas", o que ainda assim permitia
-- introduzir depois de publicado o mesmo dado privado que a Server Action
-- nunca escreve na publicação inicial. post_likes, post_comments e
-- follows já estavam corretos (confirmado, 0 linhas afetadas em todas as
-- tentativas de UPDATE, próprias ou de outros). Esta migração remove a(s)
-- policy(ies) de UPDATE de `posts`, fique o nome que for — publicações
-- não se editam depois de publicadas (decisão confirmada: imutáveis, só
-- apagar e republicar), mesmo padrão de exercise_logs/messages/
-- personal_records/body_metrics.

-- Nome exato confirmado via pg_policies antes de remover (a versão
-- dinâmica com DO $$ ... $$ + EXECUTE FORMAT, tentada primeiro, não
-- surtiu efeito — o SELECT a pg_policies continuava a devolver a policy
-- depois de a "correr"; a causa exata não foi isolada, mas um DROP
-- POLICY direto, com o nome exato, funcionou de imediato e foi
-- confirmado por uma segunda leitura de pg_policies, zero linhas).
begin;

drop policy "editar os próprios posts" on public.posts;

commit;
