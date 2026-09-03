-- 007_profiles_guard_update.sql
--
-- A policy de UPDATE de `profiles` está bem limitada a `id = auth.uid()`
-- (ninguém mexe na linha de outro — verificado), mas NÃO restringe colunas.
-- Testado com tokens reais: um utilizador conseguia, no SEU perfil,
--   (a) mudar `role` de atleta para pt,
--   (b) pôr `is_verified` a true,
--   (c) reivindicar um `pt_code` livre sendo atleta.
-- Juntando (a)+(c): qualquer atleta tornava-se um "PT falso" funcional.
--
-- Este trigger BEFORE UPDATE fecha isso. Operações de backend de confiança
-- (service_role / postgres — sem `auth.uid()`) passam à frente sem restrições.
--
-- Colunas geridas pelo sistema: id, created_at, role, is_verified, pt_code.
-- (`profiles` não tem email/updated_at/is_admin/verified_at/stripe/etc.
--  `phone` é UNIQUE mas não é usado para login — fica editável pelo dono.
--  Os campos do currículo público — headline, bio, city, experience,
--  specialties, certs, services, price, contact_*, instagram, gym,
--  show_contacts, avatar_url — e os do onboarding continuam livres.)

begin;

create or replace function public.profiles_guard_update()
returns trigger
language plpgsql
security invoker
as $fn$
begin
  -- Backend de confiança (service_role / postgres): sem restrições.
  if auth.uid() is null then
    return new;
  end if;

  -- (4) id e created_at: imutáveis.
  if new.id is distinct from old.id then
    raise exception 'profiles: o id não pode ser alterado';
  end if;
  if new.created_at is distinct from old.created_at then
    raise exception 'profiles: created_at não pode ser alterado';
  end if;

  -- (1) role: imutável via API, em qualquer sentido (atleta <-> pt).
  --     É definido no signup pelo handle_new_user.
  if new.role is distinct from old.role then
    raise exception 'profiles: o role não pode ser alterado (contacta o suporte)';
  end if;

  -- (2) is_verified: só o backend/admin (service_role) o altera.
  if new.is_verified is distinct from old.is_verified then
    raise exception 'profiles: is_verified só pode ser alterado pelo suporte';
  end if;

  -- (3) pt_code: só NULL -> valor, só para um PT; nunca valor -> outro valor,
  --     nunca -> NULL.
  if new.pt_code is distinct from old.pt_code then
    if old.pt_code is not null then
      raise exception 'profiles: o pt_code não pode ser alterado depois de definido';
    end if;
    if new.pt_code is null then
      raise exception 'profiles: o pt_code não pode ser removido';
    end if;
    if old.role <> 'pt' then
      raise exception 'profiles: só um personal trainer pode ter pt_code';
    end if;
  end if;

  return new;
end
$fn$;

drop trigger if exists trg_profiles_guard_update on public.profiles;
create trigger trg_profiles_guard_update
  before update on public.profiles
  for each row
  execute function public.profiles_guard_update();

commit;

-- ---------------------------------------------------------------------------
-- (5) auth.uid() IS NULL passa à frente — coberto pelo primeiro `if` acima.
--     Compatibilidade: garantirCodigoPt faz `UPDATE ... SET pt_code = X
--     WHERE id = me AND pt_code IS NULL` num perfil `role = 'pt'` → NULL->valor,
--     role = 'pt' → permitido. O onboarding e a edição do currículo não tocam
--     em nenhuma das colunas geridas.
-- ---------------------------------------------------------------------------
