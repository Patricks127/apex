-- 015_legal_acceptances.sql
--
-- Regista a aceitação dos Termos+Privacidade e do aviso de saúde no registo
-- (data, hora, versão do documento aceite). Tabela própria, não colunas em
-- profiles — decisão:
--
--   - É um EVENTO, não estado atual. profiles é a linha "agora" de cada
--     utilizador; se os documentos mudarem de versão e pedirmos para
--     reaceitar, colunas em profiles só guardam a aceitação mais recente e
--     perde-se o histórico — exatamente o que é preciso poder provar mais
--     tarde ("aceitaste a versão X, em Y").
--   - Mesma filosofia que workout_checkins/messages já usam nesta base:
--     dados que servem de registo/prova ficam INSERT-only, nunca UPDATE/
--     DELETE.
--   - `kind` distingue os dois consentimentos pedidos separadamente (termos+
--     privacidade vs aviso de saúde) — são caixas distintas no registo,
--     ficam como linhas distintas.
--
-- Como se preenche: o trigger abaixo lê `raw_user_meta_data` (o mesmo
-- mecanismo que já cria a linha em profiles via handle_new_user) — NÃO
-- mexe em handle_new_user (cuja definição atual não está neste repo,
-- criada antes de haver controlo de migrações; alterá-la às cegas arrisca
-- partir a criação do perfil). Em vez disso, um trigger independente,
-- também em auth.users, específico para isto.
--
-- user_id referencia auth.users diretamente (não public.profiles): dois
-- triggers AFTER INSERT em auth.users correm por ordem alfabética do nome
-- do trigger, que não controlo (não sei o nome do trigger que cria
-- profiles). Um AFTER trigger só corre depois de a linha já existir na
-- tabela — por isso referenciar auth.users(id) é seguro seja qual for essa
-- ordem; referenciar profiles(id) só seria seguro SE handle_new_user
-- corresse sempre primeiro, o que não está garantido.

begin;

create table if not exists public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('termos_privacidade', 'aviso_saude')),
  version text not null,
  accepted_at timestamptz not null default now()
);

comment on table public.legal_acceptances is
  'Registo de aceitação dos documentos legais no registo — insert-only, uma linha por evento de aceitação (nunca por utilizador). kind: termos_privacidade | aviso_saude.';

create index if not exists legal_acceptances_user_id_idx on public.legal_acceptances (user_id);

alter table public.legal_acceptances enable row level security;

-- O dono lê o seu próprio histórico de aceitações.
create policy "legal_acceptances_select"
  on public.legal_acceptances
  for select
  using (user_id = auth.uid());

-- O dono pode inserir uma aceitação nova (ex.: reaceitar uma versão
-- atualizada, no futuro) — sempre em seu próprio nome.
create policy "legal_acceptances_insert"
  on public.legal_acceptances
  for insert
  with check (user_id = auth.uid());

-- Sem policy de UPDATE/DELETE: é um registo, não se corrige nem se apaga
-- (mesmo padrão de workout_checkins/messages).

-- ---------------------------------------------------------------------------
-- Trigger: regista a aceitação feita no ecrã de registo, a partir do que o
-- signUp() passou em options.data (terms_accepted/terms_version,
-- health_accepted/health_version). Independente de handle_new_user.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user_legal_acceptance()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if (new.raw_user_meta_data->>'terms_accepted') = 'true' then
    insert into public.legal_acceptances (user_id, kind, version)
    values (new.id, 'termos_privacidade', coalesce(new.raw_user_meta_data->>'terms_version', '1.0'));
  end if;

  if (new.raw_user_meta_data->>'health_accepted') = 'true' then
    insert into public.legal_acceptances (user_id, kind, version)
    values (new.id, 'aviso_saude', coalesce(new.raw_user_meta_data->>'health_version', '1.0'));
  end if;

  return new;
end;
$fn$;

drop trigger if exists trg_handle_new_user_legal_acceptance on auth.users;
create trigger trg_handle_new_user_legal_acceptance
  after insert on auth.users
  for each row
  execute function public.handle_new_user_legal_acceptance();

commit;
