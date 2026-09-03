# APEX — Motor de Programação v2
### Especificação técnica com fundamentação científica

**Objetivo:** substituir a seleção por listas fixas por um sistema que programa
como um treinador competente — avaliando estímulo, padrão de movimento,
redundância, fadiga acumulada e distribuição semanal.

---

## 0. Aviso obrigatório

Esta especificação baseia-se em meta-análises e revisões sistemáticas atuais.
**Não substitui validação clínica.** Antes de qualquer utilizador real treinar
com base neste motor, é necessária revisão por profissional certificado —
sobretudo nos módulos de lesão, reabilitação e populações especiais.

---

## 1. O problema do motor atual

O motor v1 escolhe exercícios de listas fixas por dia. Nunca avalia:

- Se dois exercícios da mesma família estão a competir pelo mesmo estímulo
- Quanta fadiga o exercício A deixa nos músculos secundários do exercício B
- Se o volume semanal por músculo está dentro do intervalo recuperável
- Se o dia de terça sabota o dia de segunda

Exemplo real do que pode gerar hoje: supino + supino inclinado + press militar
no mesmo dia — três estímulos ao deltoide anterior, com o terceiro executado já
em fadiga. Cada exercício é bom; a combinação é má.

---

## 2. Base científica das decisões

### 2.1 Volume semanal por músculo

Meta-análise de dose-resposta (Robinson/Pelland et al., 2024; 67 estudos,
2058 participantes): os ganhos aumentam com o volume, mas com **retornos
decrescentes** — ~0,24% de hipertrofia adicional por série extra em torno das
12 séries semanais. A revisão-guarda-chuva (2022) situa o mínimo útil em
**≥10 séries por músculo por semana**.

**Regra do motor:**

| Nível | Alvo (séries diretas/músculo/semana) | Teto |
|---|---|---|
| Iniciante | 8–12 | 14 |
| Intermédio | 12–18 | 20 |
| Avançado | 14–22 | 25 |

**Contagem fracionada.** Um exercício conta 1,0 série para o motor primário e
0,5 para os secundários. É o método com melhor suporte na meta-análise citada.
Exemplo: supino conta 1,0 para peito, 0,5 para tríceps e 0,5 para deltoide
anterior.

Acima do teto: rejeitar o plano e reduzir. Não é "mais é melhor".

### 2.2 Proximidade da falha (RIR)

Robinson et al. (2024, *Sports Medicine*): a hipertrofia melhora à medida que
as séries se aproximam da falha, **com a curva a achatar depois de ~2 RIR**.
A força é praticamente indiferente ao RIR num intervalo largo.

**Regra do motor:**

| Objetivo | RIR alvo | Notas |
|---|---|---|
| Hipertrofia | 1–3 | Última série de isolamento pode ir a 0–1 |
| Força máxima | 3–5 | Falha prejudica a qualidade técnica |
| Compostos pesados | 2–4 | Nunca 0 RIR em terra ou agachamento pesado |
| Isolamentos | 0–2 | Baixo custo de fadiga, seguro perto da falha |

Nunca prescrever falha (0 RIR) em multiarticulares com carga axial.

### 2.3 Frequência

A mesma meta-análise: a frequência tem efeito **negligenciável na hipertrofia**
quando o volume é igualado, mas **melhora a força**. A vantagem prática de 2×
é permitir distribuir o volume em séries de melhor qualidade.

**Regra:** ≥2×/semana por músculo. Mantém-se do v1, mas a justificação passa a
ser gestão de volume e qualidade, não "frequência gera mais músculo".

### 2.4 Seleção de exercícios e hipertrofia regional

Estudos de hipertrofia regional (Zabaleta-Korta et al.) mostram que exercícios
diferentes produzem crescimento em regiões diferentes do mesmo músculo. E a
meta-análise sobre comprimento muscular (2025) mostra vantagem para trabalho a
**comprimentos longos** (ES 0,283).

**Regra do motor:** por músculo com volume alto, cobrir pelo menos dois perfis
de resistência diferentes — um exercício com sobrecarga na posição alongada
(ex.: supino inclinado com halteres, RDL, extensão de tríceps por cima da
cabeça) e outro na posição encurtada ou de pico médio.

Isto **não** é justificação para variedade gratuita — é cobertura de padrões.

### 2.5 Treino concorrente (interferência)

Wilson et al. (2012) e revisões posteriores: a interferência existe mas é
**menor do que se pensava**, e depende de moduladores concretos.

**Regras do motor:**
- Separar sessões de força e cardio intenso por **≥6 horas**, idealmente dias
  diferentes
- **Corrida interfere mais que bicicleta/remo** nos membros inferiores (mais
  dano excêntrico) — quando o objetivo primário é força, preferir bicicleta
- Nunca colocar corrida intensa nas 24h anteriores a um dia de pernas pesado
- Limitar volume de corrida quando força máxima é prioridade

### 2.6 Endurance — distribuição de intensidade

Meta-análise (Sports Medicine, 2024): o modelo polarizado é superior para
VO₂max sobretudo em **intervenções curtas (<12 semanas) e atletas treinados**.
Em recreativos e prazos longos, os modelos equivalem-se.

**Regra do motor:** ~75–80% do volume em Zona 1–2, 15–20% em alta intensidade,
minimizando a zona intermédia. Para principiantes, aceitar distribuição
piramidal — o que importa nesse nível é volume total e consistência.

---

## 3. Arquitetura do novo motor

### 3.1 Estrutura de dados dos exercícios

Cada exercício deixa de ser uma string e passa a ser um objeto:

```typescript
type Exercicio = {
  id: string;
  nome: string;
  familia: Familia;              // squat, hinge, horizontal_push, ...
  padrao: Padrao;                // o movimento que treina
  tier: 1 | 2 | 3;               // principal | secundário | isolamento
  primarios: { musculo: Musculo; contributo: 1.0 }[];
  secundarios: { musculo: Musculo; contributo: 0.5 }[];
  fadigaSistemica: 1 | 2 | 3;    // impacto no resto da sessão
  fadigaLocal: 1 | 2 | 3;
  exigenciaTecnica: 1 | 2 | 3;
  estabilidade: "livre" | "apoiado" | "maquina";
  perfilResistencia: "alongado" | "medio" | "encurtado";
  equipamento: Equipamento[];
  nivelMinimo: Nivel;
  contraindicacoes: Zona[];      // lesões que o excluem
  progressao: "alta" | "media" | "baixa";  // potencial de sobrecarga
};
```

### 3.2 Famílias de movimento

Exercícios da mesma família são **alternativas, não estímulos somáveis**.

| Família | Exemplos |
|---|---|
| `squat` | agachamento, hack, prensa, agachamento frontal |
| `hinge` | terra, RDL, good morning |
| `unilateral_inferior` | búlgaro, afundo, passo à frente |
| `knee_flexion` | curl deitado, curl sentado, nórdico |
| `hip_extension` | hip thrust, ponte, extensão de anca |
| `horizontal_push` | supino, supino halteres, chest press |
| `incline_push` | supino inclinado, press inclinado |
| `vertical_push` | press militar, press halteres |
| `chest_isolation` | cross-over, peck deck, aberturas |
| `vertical_pull` | elevações, pulldown |
| `horizontal_pull` | remada curvada, remada sentada, remada apoiada |
| `rear_delt_scap` | crucifixo invertido, face pull |
| `lateral_raise` | elevações laterais (todas as variantes) |
| `elbow_flexion` | rosca (todas) |
| `elbow_extension` | tríceps (todos) |
| `calf` | gémeos em pé, sentado |

### 3.3 Algoritmo de geração

Substituir "escolher exercícios para o dia X" por:

```
1. DETERMINAR ESTÍMULOS NECESSÁRIOS
   - Do objetivo + nível + dias, calcular alvo de volume por músculo
   - Distribuir esse volume pelos dias disponíveis (≥2×/semana)
   - Listar os padrões que têm de ser cobertos na semana

2. PARA CADA DIA, POR ORDEM DE PRIORIDADE:
   a) Escolher 1-2 movimentos Tier 1 (os que mais beneficiam de estar frescos)
   b) Escolher 1-3 Tier 2 que complementem sem duplicar a família
   c) Completar com Tier 3 até atingir o volume-alvo do dia

3. FILTROS APLICADOS A CADA CANDIDATO:
   - Família já usada neste dia? → penalizar fortemente
   - Padrão já coberto 2× esta semana? → penalizar
   - Contraindicado pela lesão? → excluir
   - Equipamento indisponível? → excluir
   - Nível insuficiente? → excluir
   - Fadiga secundária acumulada > limite? → penalizar

4. ORDENAR A SESSÃO:
   - Maior exigência técnica e neural primeiro
   - Compostos antes de isolamentos
   - Prioridade do utilizador antes de tudo o resto
   - Isolamentos de baixa fadiga no fim

5. VALIDAR (ver secção 4). Se falhar, ajustar e repetir (máx. 3 tentativas)
```

### 3.4 Prioridade muscular

Quando o utilizador escolhe foco (ex.: peito), o motor **não acrescenta
exercícios**. Faz cinco coisas:

1. Move o peito para primeira posição nos dias em que aparece
2. Garante frequência ≥2× (idealmente 3×)
3. Distribui o volume até ao topo do intervalo do nível
4. Cobre ≥2 perfis de resistência diferentes
5. **Reduz** volume direto de tríceps e deltoide anterior, para não
   comprometer a performance nos press

O ponto 5 é o que distingue programação de acumulação.

---

## 4. Validação obrigatória (antes de devolver o plano)

Pontuação 0–100. **<85 → rever. <75 → rejeitar e regenerar.**

| Critério | Peso | O que avalia |
|---|---|---|
| Cobertura de padrões | 15 | Todos os padrões essenciais presentes? |
| Qualidade da seleção | 20 | Tier apropriado, progressão possível? |
| Complementaridade | 15 | Exercícios somam ou repetem-se? |
| Gestão de fadiga | 15 | Ordem correta, secundários não sabotados? |
| Distribuição semanal | 15 | Volume por músculo no intervalo; ≥48h entre estímulos |
| Adequação ao objetivo | 10 | Reps, RIR e descanso batem com o objetivo? |
| Progressão | 5 | Exercícios permitem medir evolução? |
| Eficiência/tempo | 5 | Sessão executável no tempo disponível? |

**A pontuação não é mostrada ao utilizador** (salvo no analisador de planos
personalizados, que já existe e usa uma escala própria).

### 4.1 Verificações automáticas que devem falhar o plano

- Qualquer músculo abaixo de 8 séries semanais quando é alvo do objetivo
- Qualquer músculo acima do teto do nível
- Dois exercícios da mesma família no mesmo dia sem justificação
- Três ou mais compostos pesados consecutivos
- Mesmo grupo grande em dias consecutivos
- Rácio empurrar:puxar fora de 1:1 ± 30%
- Sessão estimada acima do tempo disponível do utilizador

---

## 5. Adaptação ao histórico

O motor tem acesso a `workout_sessions`, `workout_checkins` e
`personal_records`. Deve usá-los:

**Manter um exercício quando:** progressão consistente, RPE dentro do alvo,
adesão alta, sem desconforto reportado.

**Substituir por outro da mesma família quando:** estagnação ≥3 semanas,
desconforto recorrente na zona envolvida, RPE sistematicamente acima do alvo,
ou o utilizador salta esse exercício repetidamente.

**Nunca trocar exercícios por variedade.** A troca precisa de motivo, porque
mudar destrói a capacidade de comparar performance.

---

## 6. Modalidades a cobrir

| Objetivo | Estrutura | Parâmetros |
|---|---|---|
| Hipertrofia | Upper/Lower ou PPL, 2×/músculo | 6–12 reps, RIR 1–3, 60–90s |
| Powerlifting | Rotação dos 3 levantamentos | 1–5 reps, 85–92% 1RM, RIR 3–5, 3–5min |
| Híbrido | Força e cardio em dias separados | 5–8 reps força, Z2 maioritário |
| Hyrox | Compromised running + estações | Circuitos ao ritmo de prova |
| Corrida | Polarizado 80/20 | Z2 maioritário, 1–2 sessões de qualidade |
| Calistenia | Push/Pull/Legs/Skill | Progressão por alavanca e reps |

---

## 7. Ordem de implementação sugerida

1. **Base de exercícios estruturada** (~120 exercícios com todos os atributos)
2. **Calculadora de volume** com contagem fracionada
3. **Seletor com filtros e penalizações**
4. **Validador com pontuação**
5. **Integração com histórico**
6. **Migração dos objetivos restantes**

Cada passo com testes antes do seguinte.

---

## 8. Testes obrigatórios

- Volume semanal por músculo dentro do intervalo, em todas as combinações
  objetivo × nível × dias
- Nunca dois exercícios da mesma família no mesmo dia
- Rácio empurrar:puxar equilibrado
- Ordem: compostos antes de isolamentos, sempre
- Prioridade muscular: peito prioritário → peito em 1ª posição e volume no topo
- Lesão: exercícios contraindicados nunca aparecem
- Fadiga: nunca 3 compostos pesados seguidos
- Pontuação de validação ≥85 em 100 planos gerados aleatoriamente

---

## Referências principais

- Robinson ZP, Pelland JC, et al. (2024). *Exploring the Dose-Response
  Relationship Between Estimated Resistance Training Proximity to Failure,
  Strength Gain, and Muscle Hypertrophy.* Sports Medicine 54(9).
- Pelland JC, et al. (2024). *The Resistance Training Dose-Response:
  Meta-Regressions on Weekly Volume and Frequency.* SportRxiv/Sports Medicine.
- Schoenfeld BJ, Ogborn D, Krieger JW (2017). *Dose-response relationship
  between weekly resistance training volume and increases in muscle mass.*
  J Sports Sci 35(11).
- Bernárdez-Vázquez R, et al. (2022). *Resistance Training Variables for
  Optimization of Muscle Hypertrophy: An Umbrella Review.* Front Sports Act Living.
- Wilson JM, et al. (2012). *Concurrent training: a meta-analysis examining
  interference of aerobic and resistance exercises.* J Strength Cond Res.
- Sports Medicine (2024). *Comparison of Polarized Versus Other Types of
  Endurance Training Intensity Distribution.*
- Zabaleta-Korta A, et al. (2021). *The role of exercise selection in regional
  muscle hypertrophy.* J Sports Sci 39(20).
- Meta-análise (2025). *Muscle hypertrophy from partial repetition at long vs.
  short muscle length.* Sport Sciences for Health.
