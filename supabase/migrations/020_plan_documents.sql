-- 020_plan_documents.sql
--
-- PASSO seguinte combinado: o PT anexa um plano em PDF ao aluno (em vez
-- de/além do plano estruturado que a app já sabe gerar/editar). É um
-- documento — a app não olha para o conteúdo, só guarda, mostra a quem
-- deve, e deixa o PT substituir/remover.
--
-- Duas peças: a tabela `plan_documents` (metadados — quem, para quem,
-- que ficheiro, quando) e o storage (os bytes do PDF). O padrão de
-- upload já estabelecido no chat (private-media) é: o browser faz o
-- upload DIRETO para o storage com o seu próprio token, depois chama uma
-- Server Action que valida o caminho e só então escreve a linha de
-- metadados — nunca ao contrário (nunca a app aceita bytes arbitrários
-- via Server Action, nunca escreve metadados sem o storage já ter algo).
--
-- Bucket NOVO ("plan-documents"), não reutiliza "private-media" de
-- propósito: em private-media, quem escreve numa pasta é sempre o
-- DONO dessa pasta (auth.uid() = 1º segmento do caminho) — todos os usos
-- de hoje são o próprio a fazer upload de algo seu (fotos de evolução,
-- media de chat). Aqui é o INVERSO: o PT escreve na pasta do ALUNO
-- (1º segmento = student_id, não o auth.uid() de quem escreve). Misturar
-- as duas regras na mesma tabela de policies do storage.objects seria
-- confuso e arriscado de mais para alargar sem review — bucket à parte,
-- regras à parte, raio de ação isolado.
--
-- Caminho: {student_id}/{document_id}.pdf — o dono da PASTA é sempre o
-- aluno (mesmo escrita por outrem), como o resto da app já trata
-- "pasta = de quem são os dados", não "pasta = quem escreveu".
--
-- Quem pode o quê:
--   - Criar (linha + ficheiro): só um PT com pt_has_scope(..., 'treinos')
--     ATIVO para esse aluno. Nunca o aluno a anexar o seu próprio (não é
--     o que foi pedido; se vier a ser, é outra policy, outra revisão).
--   - Ler: o próprio aluno (é o plano dele) OU um PT com scope 'treinos'
--     ativo para esse aluno — MESMO padrão da 019 (training_plans): o
--     scope é reconsultado em cada leitura, revogar corta na hora, e o PT
--     atual vê o que um PT anterior anexou (mesma decisão consciente já
--     registada em decisions-and-principles.md — é um documento do
--     ALUNO, o consentimento dele é o que conta).
--   - Substituir: não existe UPDATE — trocar o PDF é apagar a linha
--     antiga e criar uma nova (mesmo espírito de "reatribuir = nova
--     linha" da 011/training_plans).
--   - Apagar: só o PT que o criou (`pt_id = auth.uid()`), e só enquanto
--     tiver scope 'treinos' ativo para esse aluno.
--
-- Bucket privado, 20 MB, só PDF — validado no storage E na Server Action
-- (defesa em profundidade, mesmo padrão do `registarMedia` em
-- actions/chat.ts, que valida o prefixo do caminho antes de confiar nele).

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('plan-documents', 'plan-documents', false, 20971520, array['application/pdf'])
on conflict (id) do nothing;

create policy "plan_documents_storage_insert"
  on storage.objects
  for insert
  with check (
    bucket_id = 'plan-documents'
    and public.pt_has_scope(auth.uid(), ((storage.foldername(name))[1])::uuid, 'treinos')
  );

create policy "plan_documents_storage_select"
  on storage.objects
  for select
  using (
    bucket_id = 'plan-documents'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or public.pt_has_scope(auth.uid(), ((storage.foldername(name))[1])::uuid, 'treinos')
    )
  );

create policy "plan_documents_storage_delete"
  on storage.objects
  for delete
  using (
    bucket_id = 'plan-documents'
    and public.pt_has_scope(auth.uid(), ((storage.foldername(name))[1])::uuid, 'treinos')
  );

create table public.plan_documents (
  id           uuid primary key default gen_random_uuid(),
  pt_id        uuid not null references public.profiles(id) on delete cascade,
  student_id   uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null unique,
  file_name    text not null,
  size_bytes   integer not null,
  created_at   timestamptz not null default now()
);

alter table public.plan_documents enable row level security;

create policy "plan_documents_select"
  on public.plan_documents
  for select
  using (
    student_id = auth.uid()
    or public.pt_has_scope(auth.uid(), student_id, 'treinos')
  );

create policy "plan_documents_insert"
  on public.plan_documents
  for insert
  with check (
    pt_id = auth.uid()
    and public.pt_has_scope(auth.uid(), student_id, 'treinos')
  );

create policy "plan_documents_delete"
  on public.plan_documents
  for delete
  using (
    pt_id = auth.uid()
    and public.pt_has_scope(auth.uid(), student_id, 'treinos')
  );

commit;
