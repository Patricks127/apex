#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Teste de RLS da ligação PT <-> Aluno (tabela public.pt_links).
#
# Cria 2 contas novas (1 pt, 1 atleta) a cada execução e corre todos os casos
# contra o PostgREST, cada um com o token do respetivo utilizador (portanto a
# RLS está a ser exercida a sério).
#
# Requisitos:
#   * "Confirm email" DESLIGADO no Supabase Auth (senão o signup não devolve
#     sessão e o teste não pode correr).
#   * Migração 003_fix_pt_links_policies.sql aplicada — sem ela, os casos de
#     segurança (N1/N2) falham de propósito.
#
# Uso:  bash scripts/rls-pt-links-test.sh
# Saída: código != 0 se algum caso falhar.
# ---------------------------------------------------------------------------
set -u

ENV_FILE="$(dirname "$0")/../.env.local"
SUPABASE_URL="${SUPABASE_URL:-$(grep -E '^NEXT_PUBLIC_SUPABASE_URL=' "$ENV_FILE" | cut -d= -f2-)}"
ANON_KEY="${ANON_KEY:-$(grep -E '^NEXT_PUBLIC_SUPABASE_ANON_KEY=' "$ENV_FILE" | cut -d= -f2-)}"
REST="$SUPABASE_URL/rest/v1"
AUTH="$SUPABASE_URL/auth/v1"

PASS=0
FAIL=0
ok()   { PASS=$((PASS+1)); printf '  \033[32mPASS\033[0m  %s\n' "$1"; }
ko()   { FAIL=$((FAIL+1)); printf '  \033[31mFAIL\033[0m  %s\n' "$1"; [ -n "${2:-}" ] && printf '        %s\n' "$2"; }
section() { printf '\n\033[1m%s\033[0m\n' "$1"; }

jget() { python3 -c "import sys,json;d=json.load(sys.stdin);print($1)" 2>/dev/null; }

TS=$(date +%s)
PT_EMAIL="patrick00santos+ptrls${TS}@gmail.com"
AT_EMAIL="patrick00santos+atrls${TS}@gmail.com"
PW="Testpass123!"
CODE="QAT-$(printf '%04d' $((TS % 10000)))"

section "Setup — criar contas"
PT_JSON=$(curl -s -H "apikey: $ANON_KEY" -H "Content-Type: application/json" -X POST "$AUTH/signup" \
  -d "{\"email\":\"$PT_EMAIL\",\"password\":\"$PW\",\"data\":{\"name\":\"Rui Teste PT\",\"role\":\"pt\"}}")
AT_JSON=$(curl -s -H "apikey: $ANON_KEY" -H "Content-Type: application/json" -X POST "$AUTH/signup" \
  -d "{\"email\":\"$AT_EMAIL\",\"password\":\"$PW\",\"data\":{\"name\":\"Ana Atleta\",\"role\":\"atleta\"}}")

PT_TOKEN=$(echo "$PT_JSON" | jget "d['access_token']")
AT_TOKEN=$(echo "$AT_JSON" | jget "d['access_token']")
PT_ID=$(echo "$PT_JSON" | jget "d['user']['id']")
AT_ID=$(echo "$AT_JSON" | jget "d['user']['id']")

if [ -z "$PT_TOKEN" ] || [ -z "$AT_TOKEN" ]; then
  echo "ERRO: signup não devolveu sessão. Confirma que 'Confirm email' está DESLIGADO."
  echo "PT: $PT_JSON"
  exit 2
fi
echo "  PT_ID=$PT_ID"
echo "  AT_ID=$AT_ID  code=$CODE"

pt() { curl -s -H "apikey: $ANON_KEY" -H "Authorization: Bearer $PT_TOKEN" "$@"; }
at() { curl -s -H "apikey: $ANON_KEY" -H "Authorization: Bearer $AT_TOKEN" "$@"; }
link_field() { at "$REST/pt_links?id=eq.$LINK&select=$1" | jget "d[0]['$1']"; }

# ===========================================================================
section "8 casos originais"
# ===========================================================================

# T1 — trigger handle_new_user criou os profiles
PT_P=$(pt "$REST/profiles?id=eq.$PT_ID&select=name,role")
AT_P=$(at "$REST/profiles?id=eq.$AT_ID&select=name,role")
[ "$(echo "$PT_P" | jget "d[0]['role']")" = "pt" ] && [ "$(echo "$PT_P" | jget "d[0]['name']")" = "Rui Teste PT" ] \
  && [ "$(echo "$AT_P" | jget "d[0]['role']")" = "atleta" ] \
  && ok "T1  trigger criou profiles com name+role certos" \
  || ko "T1  trigger criou profiles" "PT=$PT_P AT=$AT_P"

# T2 — PT define o próprio pt_code
R=$(pt -X PATCH "$REST/profiles?id=eq.$PT_ID&pt_code=is.null" -H "Content-Type: application/json" \
  -H "Prefer: return=representation" -d "{\"pt_code\":\"$CODE\"}")
[ "$(echo "$R" | jget "d[0]['pt_code']")" = "$CODE" ] \
  && ok "T2  PT gera o seu pt_code (UPDATE self)" || ko "T2  PT gera pt_code" "$R"

# T3 — atleta resolve o PT pelo código
R=$(at "$REST/profiles?pt_code=eq.$CODE&role=eq.pt&select=id,name")
[ "$(echo "$R" | jget "d[0]['id']")" = "$PT_ID" ] \
  && ok "T3  atleta lê o PT pelo código" || ko "T3  atleta resolve por código" "$R"

# T4 — atleta procura PT por nome
R=$(at "$REST/profiles?role=eq.pt&pt_code=not.is.null&name=ilike.%25rui%25&select=id")
echo "$R" | grep -q "$PT_ID" \
  && ok "T4  atleta procura PT por nome (ilike)" || ko "T4  procura por nome" "$R"

# T5 — atleta cria o pedido (evolucao=on, videos=off, metricas=on)
R=$(at -X POST "$REST/pt_links" -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d "{\"pt_id\":\"$PT_ID\",\"student_id\":\"$AT_ID\",\"status\":\"pendente\",\"requested_by\":\"$AT_ID\",\"scope_treinos\":true,\"scope_evolucao\":true,\"scope_videos\":false,\"scope_metricas\":true}")
LINK=$(echo "$R" | jget "d[0]['id']")
[ -n "$LINK" ] \
  && [ "$(echo "$R" | jget "d[0]['status']")" = "pendente" ] \
  && [ "$(echo "$R" | jget "d[0]['scope_evolucao']")" = "True" ] \
  && [ "$(echo "$R" | jget "d[0]['scope_videos']")" = "False" ] \
  && [ "$(echo "$R" | jget "d[0]['scope_metricas']")" = "True" ] \
  && [ "$(echo "$R" | jget "d[0]['requested_by']")" = "$AT_ID" ] \
  && ok "T5  atleta cria pedido pendente com os scopes exatos" || ko "T5  criar pedido" "$R"

# T6 — atleta NÃO pode forjar linha em nome de outro
R=$(at -X POST "$REST/pt_links" -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d "{\"pt_id\":\"$PT_ID\",\"student_id\":\"$PT_ID\",\"status\":\"pendente\",\"requested_by\":\"$AT_ID\",\"scope_treinos\":true}")
[ "$(echo "$R" | jget "d['code']")" = "42501" ] \
  && ok "T6  atleta a forjar student_id de outro -> bloqueado (42501)" || ko "T6  forjar student_id" "$R"

# T7 — constraint única (pt_id, student_id)
R=$(at -X POST "$REST/pt_links" -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d "{\"pt_id\":\"$PT_ID\",\"student_id\":\"$AT_ID\",\"status\":\"pendente\",\"requested_by\":\"$AT_ID\",\"scope_treinos\":true}")
[ "$(echo "$R" | jget "d['code']")" = "23505" ] \
  && ok "T7  2ª linha para o mesmo par PT/aluno -> bloqueado (23505)" || ko "T7  constraint única" "$R"

# T8 — PT lê o pedido pendente + nome do aluno (embed)
R=$(pt "$REST/pt_links?pt_id=eq.$PT_ID&status=eq.pendente&select=id,aluno:profiles!student_id(name)")
[ "$(echo "$R" | jget "d[0]['aluno']['name']")" = "Ana Atleta" ] \
  && ok "T8  PT vê o pedido pendente e o nome do aluno" || ko "T8  PT lê pendentes+nome" "$R"

# ===========================================================================
section "Casos novos (dependem da migração 003)"
# ===========================================================================

# N3 — PT aceita: pendente -> ativo  (tem de PASSAR)
R=$(pt -X PATCH "$REST/pt_links?id=eq.$LINK" -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d '{"status":"ativo"}')
[ "$(link_field status)" = "ativo" ] \
  && ok "N3  PT aceita pedido pendente->ativo -> PASSOU" || ko "N3  PT aceita pendente->ativo" "$R / estado=$(link_field status)"

# N4 — aluno desliga scope_evolucao  (tem de PASSAR)
R=$(at -X PATCH "$REST/pt_links?id=eq.$LINK" -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d '{"scope_evolucao":false}')
[ "$(link_field scope_evolucao)" = "False" ] \
  && ok "N4  aluno altera scope_evolucao (on->off) -> PASSOU" || ko "N4  aluno altera scope_evolucao" "$R"

# N1 — PT tenta ligar scope_evolucao numa ligação ativa  (tem de FALHAR)
R=$(pt -X PATCH "$REST/pt_links?id=eq.$LINK" -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d '{"scope_evolucao":true}')
[ "$(link_field scope_evolucao)" = "False" ] \
  && ok "N1  PT a ligar scope_evolucao numa ligação ativa -> BLOQUEADO" \
  || ko "N1  PT NÃO devia poder alterar scope_*" "resposta=$R / scope_evolucao=$(link_field scope_evolucao)"

# N2 — PT tenta revogar (ativo -> revogado)  (tem de FALHAR)
R=$(pt -X PATCH "$REST/pt_links?id=eq.$LINK" -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d '{"status":"revogado"}')
[ "$(link_field status)" = "ativo" ] \
  && ok "N2a PT a mudar status ativo->revogado -> BLOQUEADO" \
  || ko "N2a PT NÃO devia poder revogar" "resposta=$R / status=$(link_field status)"

# N2 — PT tenta reabrir/forçar (ativo -> pendente e ativo -> ativo)  (tem de FALHAR)
R=$(pt -X PATCH "$REST/pt_links?id=eq.$LINK" -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d '{"status":"pendente"}')
[ "$(link_field status)" = "ativo" ] \
  && ok "N2b PT a mexer no status de uma ligação já ativa -> BLOQUEADO" \
  || ko "N2b PT NÃO devia poder mexer numa ligação ativa" "resposta=$R / status=$(link_field status)"

# N5 — aluno revoga  (tem de PASSAR)
R=$(at -X PATCH "$REST/pt_links?id=eq.$LINK" -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d '{"status":"revogado"}')
[ "$(link_field status)" = "revogado" ] \
  && ok "N5  aluno revoga (status=revogado) -> PASSOU" || ko "N5  aluno revoga" "$R"

# ===========================================================================
section "Verificações finais"
# ===========================================================================

# a linha continua a existir (revogar não apaga)
[ -n "$(link_field id)" ] \
  && ok "F1  a linha revogada continua na BD (dados não apagados)" || ko "F1  linha preservada" ""

# pt_has_scope passa a false depois de revogar
R=$(pt -X POST "$REST/rpc/pt_has_scope" -H "Content-Type: application/json" \
  -d "{\"p_pt\":\"$PT_ID\",\"p_student\":\"$AT_ID\",\"p_scope\":\"treinos\"}")
[ "$R" = "false" ] \
  && ok "F2  pt_has_scope(...,'treinos') = false após revogar" || ko "F2  pt_has_scope pós-revogação" "$R"

# aluno NÃO pode apagar (revogar é por status, nunca DELETE)
at -X DELETE "$REST/pt_links?id=eq.$LINK&student_id=eq.$AT_ID" >/dev/null
[ -n "$(link_field id)" ] \
  && ok "F3  aluno a fazer DELETE -> bloqueado pela RLS (linha mantém-se)" || ko "F3  DELETE bloqueado" ""

# PT depois de revogado tenta reativar (revogado -> ativo)  (tem de FALHAR)
pt -X PATCH "$REST/pt_links?id=eq.$LINK" -H "Content-Type: application/json" -d '{"status":"ativo"}' >/dev/null
[ "$(link_field status)" = "revogado" ] \
  && ok "F4  PT a reativar uma ligação revogada -> BLOQUEADO" || ko "F4  PT reativa revogada" "status=$(link_field status)"

# ---------------------------------------------------------------------------
section "Limpeza"
pt -X PATCH "$REST/profiles?id=eq.$PT_ID" -H "Content-Type: application/json" -d '{"pt_code":null}' >/dev/null
echo "  pt_code do PT limpo. (As contas auth de teste não podem ser apagadas sem service_role.)"
echo "  Linha pt_links de teste fica com status=revogado (RLS não permite DELETE)."

# ---------------------------------------------------------------------------
printf '\n\033[1mResultado: %d PASS / %d FAIL\033[0m\n' "$PASS" "$FAIL"
exit $((FAIL > 0 ? 1 : 0))
