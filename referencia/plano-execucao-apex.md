# APEX — Plano de execução completo

Catálogo de **todos** os pontos do teu prompt (as 30 secções + o módulo Cardio),
cada um com estado atual, classificação e fase. Nada foi omitido. O que recomendo
adiar está marcado como tal **com a razão**, não cortado.

**Direção confirmada:** corrigir e melhorar o que existe + acrescentar o que
falta. Não reconstruir. A lógica, a base de dados, a autenticação, a segurança
e a maioria dos ecrãs mantêm-se — mexemos na interface e acrescentamos peças.

**Legenda de estado:**
✅ já feito · 🟡 feito mas precisa de ajuste · ❌ falta · 🔵 novo (não existe)

---

## Inventário — os 30 pontos + Cardio

| # | Item do prompt | Estado | O que fazer | Esforço |
|---|---|---|---|---|
| 1 | Objetivo: áreas reais (dashboard, treino, evolução, feed, mensagens, perfil) para atleta e PT | 🟡 | Quase tudo existe; falta perfil do atleta e polir | médio |
| 2 | Regra de design: claro, premium, minimalista, mobile-first | ✅ | Sistema de design já é este. Manter | — |
| 3 | Corrigir "o teu plano é um PDF" a dominar o dashboard | ❌ | Refazer dashboard do aluno; PDF vira um card | **fácil** |
| 4 | Dashboard do atleta (saudação, treino de hoje, progresso, atividade) | 🟡 | Reorganizar com as secções certas | médio |
| 5 | Área de treino (exercícios, séries, treino ao vivo) | ✅ | Já existe e funciona (treino ao vivo, discos, RPE) | — |
| 6 | Evolução com filtros 7d/30d/3m/6m/1a | 🟡 | Gráficos existem; falta o seletor de período | médio |
| 7 | Feed social (imagem, vídeo, treino, gostar, comentar) | 🟡 | Existe; falta foto no feed (já identificado) | fácil |
| 8 | Mensagens (conversas / grupos / avisos) | 🟡 | Chat 1-a-1 existe; grupos e avisos são novos | difícil |
| 9 | Perfil da atleta (foto, stats, publicações, editar) | ❌ | Não existe. Construir | médio |
| 10 | Interface do PT (dashboard + gestão de atletas) | ✅ | Já existe (painel, lista, sparklines, alertas) | — |
| 11 | Planos do PT (ativos, rascunhos, modelos, criar, atribuir) | 🟡 | Criar/atribuir existe; falta rascunhos/modelos/arquivo | médio |
| 12 | Navegação inferior própria (não footer), ícones, estado ativo | 🟡 | Existe; confirmar que não está no footer e polir | fácil |
| 13 | Responsive mobile-first, sem overflow, safe areas iPhone | 🟡 | **O problema real do telemóvel.** Corrigir a sério | médio |
| 14 | Tipografia com hierarquia (sem títulos gigantes) | 🟡 | Ajustar tamanhos no mobile | fácil |
| 15 | Espaçamento consistente (escala 8/12/16/20/24/32) | ✅ | Já é a escala do sistema. Confirmar aplicação | fácil |
| 16 | Sistema de cards consistente | 🟡 | Existem; uniformizar linguagem | fácil |
| 17 | Botões proporcionais (CTA não domina) | 🟡 | Reduzir os CTA gigantes | fácil |
| 18 | PDF integrado no plano, não no dashboard | ❌ | Parte do ponto 3 | fácil |
| 19 | Sessão/logout num menu de perfil, não gigante no topo | ❌ | Mover para menu de perfil | fácil |
| 20 | Notificações no header com badge | ✅ | Sino já existe e funciona | — |
| 21 | Permissões dentro de Perfil → Definições | ❌ | Mover para menu, tirar do dashboard | fácil |
| 22 | Footer só para termos/privacidade, não navegação | 🟡 | Confirmar que a navegação não está no footer | fácil |
| 23 | Analisar código antes de mexer; reutilizar; separar UI/dados | ✅ | É como trabalhamos. Manter | — |
| 24 | Autenticação e roles (atleta ≠ PT) | ✅ | Já funciona, testado | — |
| 25 | Dados reais; estados loading/empty/error/success | 🟡 | Nada falso já é regra; falta uniformizar estados | médio |
| 26 | Sensação de produto comercial (microinterações, transições) | 🟡 | Polimento transversal, no fim | médio |
| 27 | Design system nomeado (Button, Card, Avatar, etc.) | 🟡 | Componentes existem; formalizar/nomear | médio |
| 28 | Corrigir discrepâncias (alinhamentos, tamanhos) | 🟡 | Varrimento de polimento | médio |
| 29 | NÃO FAZER (dark, landing, títulos gigantes, PDF a dominar) | ✅ | Regras que já seguimos. Respeitar | — |
| 30 | Critério de conclusão (checklist final) | — | É a régua para dar por terminado | — |
| **C** | **Módulo Cardio completo** (BD, 5 modalidades, registo, sessão ao vivo, histórico, evolução, prescrição PT) | 🔵 | **Não existe. Projeto grande por si só** | **muito difícil** |

---

## O que já está feito e NÃO precisa de tocar

Para teres a noção do que já tens (e não deitamos fora):

- Sistema de design claro, premium, mobile-first (pontos 2, 15, 29)
- Área de treino completa: treino ao vivo, discos, RPE, descanso (ponto 5)
- Dashboard do PT com KPIs, alertas, sparklines de adesão (ponto 10)
- Feed social com gostos, comentários, filtros (ponto 7, quase todo)
- Chat 1-a-1 em tempo real (ponto 8, a base)
- Notificações com sino e badge (ponto 20)
- Autenticação e roles separados (ponto 24)
- Segurança testada, 5 buracos fechados (base de tudo)

---

## O que NÃO faz sentido fazer agora — e porquê

**Módulo Cardio completo (ponto C):** é o maior item do prompt inteiro — base
de dados nova, 5 modalidades, registo, sessão ao vivo com cronómetro, histórico,
evolução, prescrição pelo PT. São **semanas** de trabalho, tanto como várias das
outras fases juntas.

**A minha recomendação: adiar para depois do teste**, e por uma razão concreta:
o plano da Daniela já tem cardio (passadeira, bicicleta, corrida) descrito no
PDF, e ela já o pode registar no **registo livre** que construímos. O teste do
mês vai dizer-te se ela precisa mesmo de um módulo dedicado ou se registar "fiz
30 min de passadeira" chega. Construir semanas de módulo antes de saber isso é
adivinhar — e contraria o "acabar o mais rápido possível" que pediste.

Não está cortado. Está na **Fase 6**, marcado para depois do teste decidir.

**Mensagens com grupos e avisos (ponto 8, a parte nova):** o chat 1-a-1 já
funciona e chega para o teste (tu + Daniela). Grupos fazem sentido quando
tiveres vários alunos — que não é o caso do teste. Fase 5, depois do essencial.

**Planos: rascunhos/modelos/arquivados (ponto 11):** criar e atribuir já
funciona. Rascunhos e modelos são conforto para um PT com muitos alunos. Fase 5.

---

## As fases — do mais fácil para o mais difícil

### FASE 1 — O dashboard do aluno e o PDF (o que mais te incomoda) · FÁCIL
Pontos 3, 4 (parcial), 18.
- Refazer o dashboard do atleta: saudação + treino de hoje + progresso resumido
  + atividade recente
- O PDF passa a ser um card na área do plano, não o ecrã todo
- Estados vazios claros (sem treino hoje, sem dados)
**Porquê primeiro:** é o problema que te fez abrir o prompt, e é rápido.

### FASE 2 — Responsive e tipografia no telemóvel · FÁCIL-MÉDIO
Pontos 13, 14, 17, 19, 21, 22.
- Corrigir o que parte no telemóvel: fontes gigantes, overflow, safe areas iPhone
- Hierarquia de tipografia (nomes deixam de ocupar o ecrã todo)
- Botões proporcionais (CTA deixa de dominar)
- Logout e permissões movidos para um menu de perfil
- Confirmar navegação fora do footer
**Porquê aqui:** a Daniela usa no telemóvel; isto é o que faz a app parecer
acabada ou improvisada.

### FASE 3 — Perfil do atleta · MÉDIO
Ponto 9.
- Ecrã de perfil do atleta: foto, nome, stats, publicações, objetivos
- Botão editar perfil
- Menu de definições (onde entram logout e permissões da Fase 2)
**Porquê:** peça que falta por inteiro, e a Daniela vai querer um.

### FASE 4 — As peças pequenas em falta · FÁCIL cada
Pontos 7 (foto no feed), 6 (filtros de período na evolução), + as que
identificaste ontem: PT desligar aluno, pré-visualizar plano antes de seguir,
notificação de novo seguidor.
**Porquê:** rápidas, independentes, fecham a lista do que descobriste a usar.

### FASE 5 — Polimento e consolidação · MÉDIO
Pontos 16, 25, 26, 27, 28, 30.
- Uniformizar cards, estados (loading/empty/error), microinterações
- Formalizar o design system nomeado
- Varrimento final contra o critério de conclusão (ponto 30)
**Porquê no fim:** polir antes de ter as peças todas seria repetir trabalho.

### FASE 6 — Depois do teste, se o teste pedir · GRANDE
Módulo Cardio (ponto C), mensagens-grupo e avisos (ponto 8), planos com
rascunhos/modelos (ponto 11).
**Porquê depois:** são funcionalidades grandes que o teste do mês vai validar
como necessárias ou não. Construí-las antes é adivinhar.

---

## Regras que valem em todas as fases (do teu prompt)

- Modo claro sempre, nunca dark (ponto 29)
- Não partir o que funciona; reutilizar a lógica (pontos 23, 29)
- Dados reais, nada falso; estados vazios claros (ponto 25)
- Atleta e PT com experiências próprias (ponto 24)
- Uma fase de cada vez, testada no telemóvel, deploy a seguir, antes da próxima
- A régua de "terminado" é o ponto 30

---

## O que precisas de decidir

1. **Concordas com esta ordem de fases?** (fácil → difícil, como pediste)
2. **O Cardio na Fase 6 (depois do teste) — aceitas, ou queres já?** Se queres
   já, é semanas antes de a Daniela poder testar o resto.
3. **Começamos pela Fase 1** (dashboard do aluno), ou preferes outra primeiro?
