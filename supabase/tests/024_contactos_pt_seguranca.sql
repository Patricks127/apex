-- Teste de segurança da migração 024 (contactos_pt). Corre-se ANTES e
-- DEPOIS — é o mesmo teste. Antes tem de FALHAR (os contactos de um PT em
-- "só alunos" legíveis por qualquer sessão); depois tem de PASSAR tudo.
-- Não grava nada: termina em ROLLBACK.
--
--   PT      cb54131b-… — PT com telefone e email, 1 aluno ativo
--   ALUNO   487818f9-… — aluno ATIVO desse PT
--   ESTRANHA 84ff7854-… — atleta sem ligação a esse PT

begin;
create temp table resultado (n int, teste text, obtido text, esperado text);
grant all on resultado to authenticated, anon;

-- quantos contactos do PT o utilizador atual consegue ler (onde quer que vivam)
create or replace function pg_temp.contactos_do_pt_visiveis() returns int language plpgsql as $f$
declare n int := 0; m int := 0;
begin
  select count(*) into n from public.profiles p
  where p.id = 'cb54131b-20fb-46c0-b3e7-bf671b694b77'
    and (to_jsonb(p)->>'contact_phone' is not null or to_jsonb(p)->>'contact_email' is not null);
  if to_regclass('public.contactos_pt') is not null then
    begin
      execute $q$select count(*) from public.contactos_pt where id='cb54131b-20fb-46c0-b3e7-bf671b694b77'
        and (contact_phone is not null or contact_email is not null)$q$ into m;
    exception when insufficient_privilege then m := 0;
    end;
  end if;
  return n + m;
end $f$;
grant execute on function pg_temp.contactos_do_pt_visiveis() to authenticated, anon;

-- O PT escolhe "só alunos" (como ele próprio faria no editor)
select set_config('request.jwt.claims', '{"sub":"cb54131b-20fb-46c0-b3e7-bf671b694b77","role":"authenticated"}', true);
set local role authenticated;
update public.profiles set show_contacts = 'alunos' where id = 'cb54131b-20fb-46c0-b3e7-bf671b694b77';
insert into resultado select 1, 'o próprio PT vê os seus contactos', least(pg_temp.contactos_do_pt_visiveis(), 1)::text, '1';
reset role;

select set_config('request.jwt.claims', '{"sub":"84ff7854-6a3a-4adf-9061-024b17c7c1cd","role":"authenticated"}', true);
set local role authenticated;
insert into resultado select 2, '"só alunos": atleta sem ligação vê os contactos', pg_temp.contactos_do_pt_visiveis()::text, '0';
reset role;

select set_config('request.jwt.claims', '{"sub":"487818f9-f61a-4595-87fb-5083e1e15b99","role":"authenticated"}', true);
set local role authenticated;
insert into resultado select 3, '"só alunos": aluno ATIVO vê os contactos', least(pg_temp.contactos_do_pt_visiveis(), 1)::text, '1';
reset role;

select set_config('request.jwt.claims', '', true);
set local role anon;
insert into resultado select 4, 'anónimo vê os contactos', pg_temp.contactos_do_pt_visiveis()::text, '0';
reset role;

-- O PT muda para "todos" → qualquer sessão vê
select set_config('request.jwt.claims', '{"sub":"cb54131b-20fb-46c0-b3e7-bf671b694b77","role":"authenticated"}', true);
set local role authenticated;
update public.profiles set show_contacts = 'todos' where id = 'cb54131b-20fb-46c0-b3e7-bf671b694b77';
reset role;
select set_config('request.jwt.claims', '{"sub":"84ff7854-6a3a-4adf-9061-024b17c7c1cd","role":"authenticated"}', true);
set local role authenticated;
insert into resultado select 5, '"todos": atleta sem ligação vê os contactos', least(pg_temp.contactos_do_pt_visiveis(), 1)::text, '1';
-- e continua sem poder ALTERAR os contactos do PT
do $$ declare m int := -1; begin
  if to_regclass('public.contactos_pt') is not null then
    execute $q$with u as (update public.contactos_pt set contact_phone='000' where id='cb54131b-20fb-46c0-b3e7-bf671b694b77' returning 1) select count(*) from u$q$ into m;
  end if;
  insert into resultado values (6, 'atleta altera os contactos do PT', m::text, '0');
end $$;
reset role;

select n, teste, obtido, esperado, case when obtido = esperado then 'OK' else 'FALHA' end as veredito
from resultado order by n;
rollback;
