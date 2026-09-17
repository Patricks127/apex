-- 018_notifications.sql
--
-- NOTA HISTÓRICA (para quem reaplicar isto do zero): a versão que
-- realmente ficou na BD, da primeira vez, tinha o `with_check` de
-- `notifications_insert_interacao` sem os joins a post_likes/
-- post_comments (só confirmava que o post era do destinatário — não que
-- eu tinha mesmo gostado/comentado). Só foi apanhado ao correr
-- scripts/social-notif-test.ts e confirmar a linha forjada a existir de
-- verdade na conta de teste (não bastou confirmar "a policy existe" no
-- dashboard — o nome era igual nas duas versões). Corrigido ao vivo com
-- `drop policy` + `create policy` (um `alter policy ... with check`
-- tentado primeiro não pegou, causa não isolada). O texto abaixo é já a
-- versão corrigida, confirmada por pg_policies depois do fix.
--
-- Notificações — geradas só por eventos do servidor que já acontecem
-- (PT atribui plano, nova mensagem, novo comentário/gosto, novo recorde
-- MANUAL, treino concluído). Nada de payload livre: título/corpo são
-- texto já composto pela Server Action, ref_id é opcional (aponta para a
-- origem do evento — post, sessão, etc., sem FK declarada porque a
-- tabela de destino varia consoante `tipo`).
--
-- Regra da casa aplicada, verificada ANTES de construir qualquer ecrã
-- (scripts/social-notif-test.ts):
--   - SELECT: só o dono (user_id = auth.uid()).
--   - INSERT: NUNCA "qualquer autenticado insere para qualquer um" — uma
--     policy PERMISSIVA por tipo de evento, cada uma a exigir a MESMA
--     relação de confiança que a ação que gera esse evento já exige.
--     Múltiplas policies PERMISSIVE no INSERT ficam em OR.
--       plano_atribuido — só um PT com pt_has_scope(..., 'treinos') sobre
--         o destinatário (mesma condição que atribuirPlanoPt já verifica).
--       mensagem — só entre duas pessoas com pt_links ativo entre elas
--         (mesma condição que linkPertenceAoUtilizador já verifica).
--       comentario / gosto — **corrigido antes de aplicar**: a primeira
--         versão só confirmava que o post referenciado era do
--         destinatário — não confirmava que EU próprio tinha mesmo
--         gostado/comentado. Isso deixaria forjar "fulano comentou" sem
--         nunca ter comentado. Agora exige uma linha REAL em
--         post_likes/post_comments, minha, nesse post exato, cujo autor
--         é o destinatário — a notificação só nasce de uma interação que
--         já aconteceu, nunca isolada.
--       recorde / treino_concluido — autodirigidas, user_id = auth.uid()
--         (celebras o teu próprio recorde/treino, não podes gerar isto
--         para outra pessoa). `recorde` só entra pela Server Action
--         quando source='manual' — isso é disciplina de aplicação
--         (registarRecorde nunca chama o helper para um recorde 'auto'),
--         não uma restrição que a RLS consiga expressar sozinha (RLS não
--         vê o personal_records de onde o recorde veio, só o que a
--         notificação já diz).
--   - UPDATE: só o dono, e só o campo `lida` — um trigger bloqueia
--     qualquer alteração a user_id/tipo/titulo/corpo/ref_id/created_at.
--     Sem isto seria o MESMO buraco da 017 (posts): qual sem with_check
--     suficiente deixaria o dono reescrever o conteúdo da notificação.
--   - Sem policy de DELETE (não pedido nesta fase).
--
-- O cliente não tem forma de "criar notificação" isolada: o insert vive
-- num helper simples (src/lib/social/notificar.ts), NUNCA num ficheiro
-- "use server" nem exportado como Server Action própria — só é chamado
-- de dentro de atribuirPlanoPt/enviarMensagem/comentar/alternarGosto/
-- gravarTreino/registarRecorde, depois de a ação real já ter tido
-- sucesso. A RLS é a rede de segurança final caso alguém tente contornar
-- a app e escrever direto na tabela.

begin;

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  tipo       text not null check (tipo in (
               'plano_atribuido', 'mensagem', 'comentario', 'gosto',
               'recorde', 'treino_concluido'
             )),
  titulo     text not null,
  corpo      text,
  ref_id     uuid,
  lida       boolean not null default false,
  created_at timestamptz not null default now(),
  check (char_length(titulo) <= 200),
  check (corpo is null or char_length(corpo) <= 500)
);

comment on table public.notifications is
  'Notificações geradas só por eventos reais do servidor. título/corpo já vêm compostos pela Server Action — sem template no cliente.';

create index notifications_user_id_created_at_idx on public.notifications (user_id, created_at desc);
create index notifications_user_id_lida_idx on public.notifications (user_id) where not lida;

alter table public.notifications enable row level security;

create policy notifications_select on public.notifications
  for select using (user_id = auth.uid());

create policy notifications_insert_plano on public.notifications
  for insert with check (
    tipo = 'plano_atribuido'
    and public.pt_has_scope(auth.uid(), user_id, 'treinos')
  );

create policy notifications_insert_mensagem on public.notifications
  for insert with check (
    tipo = 'mensagem'
    and exists (
      select 1 from public.pt_links
      where status = 'ativo'
        and ((pt_id = auth.uid() and student_id = notifications.user_id)
          or (student_id = auth.uid() and pt_id = notifications.user_id))
    )
  );

-- Exige uma interação REAL minha (post_likes/post_comments) nesse post
-- exato, cujo autor é o destinatário — não basta o post existir e ser
-- dele; tem de haver mesmo um gosto/comentário meu lá.
create policy notifications_insert_interacao on public.notifications
  for insert with check (
    auth.uid() <> user_id
    and (
      (tipo = 'gosto' and exists (
        select 1
        from public.post_likes pl
        join public.posts p on p.id = pl.post_id
        where pl.post_id = notifications.ref_id
          and pl.user_id = auth.uid()
          and p.author_id = notifications.user_id
      ))
      or
      (tipo = 'comentario' and exists (
        select 1
        from public.post_comments pc
        join public.posts p on p.id = pc.post_id
        where pc.post_id = notifications.ref_id
          and pc.user_id = auth.uid()
          and p.author_id = notifications.user_id
      ))
    )
  );

create policy notifications_insert_propria on public.notifications
  for insert with check (
    tipo in ('recorde', 'treino_concluido')
    and user_id = auth.uid()
  );

create policy notifications_update_marcar_lida on public.notifications
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.notifications_block_update_exceto_lida()
returns trigger
language plpgsql
as $$
begin
  if new.user_id <> old.user_id
     or new.tipo <> old.tipo
     or new.titulo <> old.titulo
     or coalesce(new.corpo, '') <> coalesce(old.corpo, '')
     or new.ref_id is distinct from old.ref_id
     or new.created_at <> old.created_at
  then
    raise exception 'notifications: só o campo lida pode ser alterado';
  end if;
  return new;
end;
$$;

drop trigger if exists notifications_no_update_exceto_lida on public.notifications;
create trigger notifications_no_update_exceto_lida
  before update on public.notifications
  for each row execute function public.notifications_block_update_exceto_lida();

commit;
