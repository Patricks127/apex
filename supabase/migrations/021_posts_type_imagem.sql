-- 021_posts_type_imagem.sql
--
-- PASSO 8 (rede social) fechou com 5 tipos de post: treino, recorde,
-- conquista, video, texto. Esta fase acrescenta "imagem" (foto anexada
-- diretamente no composer, não copiada de um recurso privado existente
-- como o vídeo) — mas `posts.type` tem uma CHECK CONSTRAINT que ainda só
-- conhece os 5 tipos antigos. Sem esta migração, qualquer tentativa de
-- publicar uma foto falha em silêncio do lado da BD (23514, check
-- violation) depois do upload já ter tido sucesso — confirmado ao vivo
-- durante esta fase, não hipotético.
--
-- Texto atual confirmado via pg_get_constraintdef antes de escrever isto:
--   CHECK ((type = ANY (ARRAY['treino'::text, 'recorde'::text,
--     'conquista'::text, 'video'::text, 'texto'::text])))
--
-- Só isto muda: a lista de valores aceites em `type` ganha 'imagem'. Não
-- mexe em RLS, em `media_kind` (essa já aceitava 'image' desde sempre,
-- só nunca tinha um `type` que a acompanhasse), nem em nenhuma outra
-- constraint ou policy da tabela.

begin;

alter table public.posts drop constraint posts_type_check;

alter table public.posts add constraint posts_type_check
  check (type = any (array['treino'::text, 'recorde'::text, 'conquista'::text, 'video'::text, 'imagem'::text, 'texto'::text]));

commit;
