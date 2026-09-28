-- 024_contactos_pt.sql — POR APLICAR (rever antes)
--
-- PROBLEMA (encontrado na mesma auditoria da 023): contact_phone e
-- contact_email dos PTs estão em `profiles`, legível por qualquer sessão.
-- O PT escolhe "só alunos" (show_contacts='alunos'), mas essa escolha só
-- era respeitada no ECRÃ (/pt/[codigo]); pela API qualquer sessão lia os
-- contactos. Documentado como limitação aceite em
-- scripts/perfil-publico-test.ts — agora fechado na base de dados.
--
-- SOLUÇÃO: os dois contactos saem para `contactos_pt` (1:1), com a MESMA
-- regra que o ecrã já usava, agora na RLS:
--   vê os contactos quem for (1) o próprio PT, (2) qualquer sessão se o PT
--   escolheu show_contacts='todos', (3) aluno com ligação ATIVA a esse PT.
-- `show_contacts` fica em profiles (é a escolha do PT, não um dado privado).
--
-- ATÓMICA como a 023: cria, copia, verifica, só então remove as colunas.
-- ORDEM: aplicar a migração → avisar → push imediato do código.

begin;

create table public.contactos_pt (
  id uuid primary key references public.profiles (id) on delete cascade,
  contact_phone text,
  contact_email text
);

comment on table public.contactos_pt is
  'Contactos profissionais do PT. Visíveis ao próprio, a todos se profiles.show_contacts=''todos'', ou a alunos com ligação ativa. Nunca voltar a pôr em profiles.';

alter table public.contactos_pt enable row level security;
revoke all on public.contactos_pt from anon, authenticated;
grant select, insert, update on public.contactos_pt to authenticated;

create policy "contactos: o próprio, alunos ativos, ou todos se o PT escolheu" on public.contactos_pt
  for select to authenticated using (
    auth.uid() = id
    or exists (select 1 from public.profiles p where p.id = contactos_pt.id and p.show_contacts = 'todos')
    or exists (
      select 1 from public.pt_links l
      where l.pt_id = contactos_pt.id and l.student_id = auth.uid() and l.status = 'ativo')
  );
create policy "o PT cria os seus contactos" on public.contactos_pt
  for insert to authenticated with check (auth.uid() = id);
create policy "o PT edita os seus contactos" on public.contactos_pt
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
-- Sem DELETE: a linha vai com a conta (on delete cascade).

-- Mover: só quem tem algum contacto preenchido (11 PTs em 2026-09-28).
insert into public.contactos_pt (id, contact_phone, contact_email)
select id, contact_phone, contact_email
from public.profiles
where contact_phone is not null or contact_email is not null;

do $$
declare
  n_com_contactos int;
  n_copiados int;
  n_diferentes int;
begin
  select count(*) into n_com_contactos from public.profiles where contact_phone is not null or contact_email is not null;
  select count(*) into n_copiados from public.contactos_pt;
  if n_com_contactos <> n_copiados then
    raise exception 'cópia incompleta: % com contactos, % copiados', n_com_contactos, n_copiados;
  end if;
  select count(*) into n_diferentes
  from public.profiles p join public.contactos_pt c using (id)
  where (p.contact_phone, p.contact_email) is distinct from (c.contact_phone, c.contact_email);
  if n_diferentes > 0 then
    raise exception 'cópia com % linha(s) diferente(s) — abortado, nada aplicado', n_diferentes;
  end if;
end $$;

alter table public.profiles
  drop column contact_phone,
  drop column contact_email;

commit;
