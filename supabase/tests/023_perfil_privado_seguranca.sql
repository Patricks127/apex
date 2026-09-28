-- Teste de segurança da migração 023 (perfil_privado). Corre-se ANTES e
-- DEPOIS da migração — é o mesmo teste. Antes tem de FALHAR (prova que a
-- fuga existe e que o teste a apanha); depois tem de PASSAR tudo.
-- Não grava nada: tudo numa transação que termina em ROLLBACK.
--
-- Lê as colunas de forma dinâmica (to_jsonb / to_regclass), para funcionar
-- quer as colunas privadas ainda estejam em `profiles` (antes), quer já
-- estejam em `perfil_privado` (depois).
--
-- Utilizadores (contas de teste reais, 2026-09-28):
--   ALUNA  d1988764-… — tem PT ativo F5C4 (scope treinos)
--   PT     f5c4501e-… — PT ativo da ALUNA
--   OUTRA  84ff7854-… — outra atleta, sem relação com a ALUNA
--   OUTROPT 5be102df-… — PT de outras pessoas, sem ligação à ALUNA

begin;

create temp table resultado (n int, teste text, obtido text, esperado text);
grant all on resultado to authenticated, anon;

-- Preparar: a ALUNA escreve dados privados conhecidos (como ela própria),
-- onde quer que eles vivam (profiles antes, perfil_privado depois).
select set_config('request.jwt.claims', '{"sub":"d1988764-3000-4dd2-9e2c-c58de38ac8f2","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  if to_regclass('public.perfil_privado') is not null then
    execute $q$update public.perfil_privado set phone='919999001', sex='mulher', level='intermedio',
      injuries='{ombro}', injury_note='dor no ombro (teste)' where id='d1988764-3000-4dd2-9e2c-c58de38ac8f2'$q$;
  else
    execute $q$update public.profiles set phone='919999001', sex='mulher', level='intermedio',
      injuries='{ombro}', injury_note='dor no ombro (teste)' where id='d1988764-3000-4dd2-9e2c-c58de38ac8f2'$q$;
  end if;
end $$;
reset role;

-- Conta, para o utilizador ATUAL, quantos campos privados da ALUNA consegue
-- ler — por profiles E por perfil_privado.
create or replace function pg_temp.privados_da_aluna_visiveis() returns int language plpgsql as $f$
declare n int := 0; m int := 0;
begin
  select count(*) into n from public.profiles p
  where p.id = 'd1988764-3000-4dd2-9e2c-c58de38ac8f2'
    and (to_jsonb(p) ? 'phone' and (to_jsonb(p)->>'phone' is not null
      or to_jsonb(p)->>'sex' is not null or to_jsonb(p)->>'injury_note' is not null));
  if to_regclass('public.perfil_privado') is not null then
    begin
      execute $q$select count(*) from public.perfil_privado where id='d1988764-3000-4dd2-9e2c-c58de38ac8f2'
        and (phone is not null or sex is not null or injury_note is not null)$q$ into m;
    exception when insufficient_privilege then
      m := 0; -- o anónimo nem tem privilégio na tabela: recusado = não vê nada
    end;
  end if;
  return n + m;
end $f$;
grant execute on function pg_temp.privados_da_aluna_visiveis() to authenticated, anon;

-- 1) OUTRA atleta — não pode ler nada privado da ALUNA
select set_config('request.jwt.claims', '{"sub":"84ff7854-6a3a-4adf-9061-024b17c7c1cd","role":"authenticated"}', true);
set local role authenticated;
insert into resultado select 1, 'outra atleta lê telemóvel/sexo/lesão da aluna', pg_temp.privados_da_aluna_visiveis()::text, '0';
reset role;

-- 2) OUTRO PT sem ligação — idem
select set_config('request.jwt.claims', '{"sub":"5be102df-6032-41d5-89aa-e072b98d451f","role":"authenticated"}', true);
set local role authenticated;
insert into resultado select 2, 'PT sem ligação lê dados privados da aluna', pg_temp.privados_da_aluna_visiveis()::text, '0';
reset role;

-- 3) anónimo — idem
select set_config('request.jwt.claims', '', true);
set local role anon;
insert into resultado select 3, 'anónimo lê dados privados da aluna', pg_temp.privados_da_aluna_visiveis()::text, '0';
reset role;

-- 4) a própria ALUNA — lê os seus (em perfil_privado)
select set_config('request.jwt.claims', '{"sub":"d1988764-3000-4dd2-9e2c-c58de38ac8f2","role":"authenticated"}', true);
set local role authenticated;
do $$ declare m int := 0; begin
  if to_regclass('public.perfil_privado') is not null then
    execute $q$select count(*) from public.perfil_privado where id='d1988764-3000-4dd2-9e2c-c58de38ac8f2'
      and phone='919999001' and injury_note='dor no ombro (teste)'$q$ into m;
  end if;
  insert into resultado values (4, 'a própria lê os seus (perfil_privado)', m::text, '1');
end $$;
reset role;

-- 5) PT ATIVO da aluna (scope treinos) — lê as LESÕES pela função, nunca
--    telemóvel nem sexo (a função nem tem essas colunas)
select set_config('request.jwt.claims', '{"sub":"f5c4501e-8603-4ad1-96aa-39eaa352f813","role":"authenticated"}', true);
set local role authenticated;
do $$ declare m int := 0; tem_privado boolean := false; begin
  if to_regprocedure('public.dados_treino_do_aluno(uuid)') is not null then
    execute $q$select count(*) from public.dados_treino_do_aluno('d1988764-3000-4dd2-9e2c-c58de38ac8f2')
      where injury_note='dor no ombro (teste)'$q$ into m;
    execute $q$select exists (select 1 from jsonb_object_keys((select to_jsonb(d) from public.dados_treino_do_aluno('d1988764-3000-4dd2-9e2c-c58de38ac8f2') d limit 1)) k where k in ('phone','sex'))$q$ into tem_privado;
  end if;
  insert into resultado values (5, 'PT ativo (scope treinos) lê as lesões da aluna', m::text, '1');
  insert into resultado values (6, 'a função do PT devolve telemóvel ou sexo', tem_privado::text, 'false');
  -- e pela tabela direta, o PT continua sem ver nada
  insert into resultado select 7, 'PT ativo lê a tabela privada diretamente', pg_temp.privados_da_aluna_visiveis()::text, '0';
end $$;
reset role;

-- 8) a aluna REVOGA → o PT deixa de ler
select set_config('request.jwt.claims', '{"sub":"d1988764-3000-4dd2-9e2c-c58de38ac8f2","role":"authenticated"}', true);
set local role authenticated;
update public.pt_links set status='revogado'
  where pt_id='f5c4501e-8603-4ad1-96aa-39eaa352f813' and student_id='d1988764-3000-4dd2-9e2c-c58de38ac8f2';
reset role;
select set_config('request.jwt.claims', '{"sub":"f5c4501e-8603-4ad1-96aa-39eaa352f813","role":"authenticated"}', true);
set local role authenticated;
do $$ declare m int := -1; begin
  if to_regprocedure('public.dados_treino_do_aluno(uuid)') is not null then
    execute $q$select count(*) from public.dados_treino_do_aluno('d1988764-3000-4dd2-9e2c-c58de38ac8f2')$q$ into m;
  end if;
  insert into resultado values (8, 'PT depois de revogado lê as lesões', m::text, '0');
end $$;
reset role;

-- 9) OUTRA atleta tenta ESCREVER nos dados privados da aluna
select set_config('request.jwt.claims', '{"sub":"84ff7854-6a3a-4adf-9061-024b17c7c1cd","role":"authenticated"}', true);
set local role authenticated;
do $$ declare m int := -1; begin
  if to_regclass('public.perfil_privado') is not null then
    execute $q$with u as (update public.perfil_privado set injury_note='x' where id='d1988764-3000-4dd2-9e2c-c58de38ac8f2' returning 1) select count(*) from u$q$ into m;
  end if;
  insert into resultado values (9, 'outra atleta altera dados privados da aluna', m::text, '0');
end $$;
reset role;

select n, teste, obtido, esperado, case when obtido = esperado then 'OK' else 'FALHA' end as veredito
from resultado order by n;

rollback;
