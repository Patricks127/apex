-- 006_messages_realtime_immutable.sql
--
-- (1) Realtime: a tabela messages não estava na publicação supabase_realtime,
--     por isso o supabase.channel() não recebia INSERTs. Adiciona-a e põe
--     REPLICA IDENTITY FULL para o filtro `link_id=eq.…` funcionar também em
--     eventos de UPDATE (ex.: ticks de "lida").
--
-- (2) Imutabilidade: a policy de UPDATE de messages permitia a qualquer membro
--     reescrever o `body` (e o resto) de qualquer mensagem — não só o `read_at`.
--     Um trigger BEFORE UPDATE passa a bloquear tudo menos `read_at`.
--     (INSERT continua a exigir sender_id = auth.uid(); não há policy de DELETE.)

begin;

-- (1) Realtime
do $mig$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'messages'
  ) then
    execute 'alter publication supabase_realtime add table public.messages';
    raise notice 'messages adicionada à publicação supabase_realtime';
  else
    raise notice 'messages já estava na publicação supabase_realtime';
  end if;
end
$mig$;

alter table public.messages replica identity full;

-- (2) Imutabilidade — só read_at pode mudar
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

  return new;
end
$fn$;

drop trigger if exists trg_messages_guard_update on public.messages;
create trigger trg_messages_guard_update
  before update on public.messages
  for each row
  execute function public.messages_guard_update();

commit;
