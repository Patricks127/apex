# APEX — Sistema de design

Base visual para toda a aplicação. Dois modos deliberados:
**claro e rigoroso** para navegar e ler, **escuro** para treinar.

---

## O princípio

A APEX faz duas coisas diferentes e o desenho reflete isso.

**Fora do treino** — planear, ver progresso, falar com o PT, gerir alunos —
é trabalho de consulta. Precisa de densidade, legibilidade e uma grelha que
aguente tabelas, gráficos, conversas e listas longas. Claro, preto sobre
branco, rigoroso.

**Durante o treino** é outra coisa. Estás de pé, a suar, com o telemóvel
apoiado, a olhar dois segundos entre séries. Precisa de contraste alto,
números enormes e alvos de toque generosos. Escuro, porque o ginásio tem
luz má e o ecrã branco cega.

A mudança de modo é um sinal, não uma inconsistência: **quando o ecrã
escurece, estás a treinar.**

---

## Cor

### Modo claro (base da app)

```css
--branco:        #FFFFFF;  /* fundo */
--tinta:         #0A0A0B;  /* texto principal, linhas fortes */
--cinza-texto:   #6B6B70;  /* texto secundário */
--cinza-linha:   #E2E2E4;  /* separadores */
--cinza-fundo:   #F6F6F7;  /* superfícies elevadas */
--azul:          #0047FF;  /* decisões da app */
--azul-fundo:    #EDF1FF;  /* fundo de avisos da app */
```

### Modo treino (escuro)

```css
--fundo-treino:  #0D0F13;
--superficie:    #171A20;
--linha-treino:  #262A31;
--texto-treino:  #FFFFFF;
--texto-fraco:   #8A9098;
--verde:         #5AC8A0;  /* descanso, séries feitas */
```

### Estados (comuns aos dois modos)

```css
--alerta:  #C8761A;  /* carga reduzida, desconforto reportado */
--erro:    #C0392B;  /* falhas, bloqueios */
```

### Como usar a cor

**O azul é reservado a decisões que a app tomou por ti.** Carga que subiu ou
desceu, exercício substituído, semana de descarga. Nunca decoração. Se o azul
aparece, há uma explicação a acompanhar.

**O verde só existe no modo treino**, para descanso e séries concluídas.

Fora disto, a app é preta e branca. A restrição é a identidade.

---

## Tipografia

Uma família, dois usos.

**Archivo** — corpo, títulos, interface. Neo-grotesca com carácter, boa em
pesos altos, números limpos.

**Archivo Condensed** (ou Barlow Condensed) — números grandes no modo treino.
Permite pesos enormes sem transbordar o ecrã.

```css
--sans: 'Archivo', system-ui, sans-serif;
--cond: 'Barlow Condensed', 'Archivo', sans-serif;
```

### Escala

| Uso | Tamanho | Peso | Espaçamento |
|---|---|---|---|
| Título de ecrã | 44px | 900 | −0.045em |
| Título de secção | 24px | 800 | −0.03em |
| Nome de exercício | 16px | 700 | −0.02em |
| Corpo | 15px | 400 | normal |
| Secundário | 13px | 500 | normal |
| Etiqueta | 12px | 600 | normal |
| **Carga (treino)** | **120px** | **700 cond.** | **−0.04em** |
| Número de dados | 25px | 900 | −0.04em |

**Números sempre tabulares** (`font-variant-numeric: tabular-nums`) para
alinharem em colunas.

### O que não fazer

- Maiúsculas em etiquetas (só nos números condensados do modo treino)
- Destacar uma palavra do título a cor ou itálico
- Etiquetas tipográficas por cima de conteúdo que já se explica

---

## Layout

### Grelha

Margem lateral de **20px** no telemóvel. Conteúdo alinhado à esquerda —
centrado apenas no modo treino, onde o número é o objeto.

Separadores são **linhas de 1px**, não cartões com sombra. A app não é uma
pilha de cartões; é um documento estruturado.

```
┌──────────────────────────────┐
│ APEX              S3 / SEG   │  ← barra, borda inferior 3px
├──────────────────────────────┤
│                              │
│ Peito e                      │  ← título 44px, 900
│ tríceps                      │
│                              │
├────────┬─────────┬───────────┤
│ 8      │ 24      │ 65′       │  ← dados em colunas divididas
│ exerc. │ séries  │ estimado  │
├────────┴─────────┴───────────┤
│ Supino com barra    52,5 kg  │  ← linhas de 1px entre itens
│ peito · 90s            4 × 6 │
├──────────────────────────────┤
│ ...                          │
└──────────────────────────────┘
```

### Espaçamento

Escala de 4: `4 · 8 · 12 · 16 · 20 · 24 · 32 · 48`.
Nada fora disto.

### Cantos

- **Modo claro:** 0 ou 2px. A app é angular.
- **Modo treino:** 14–16px nos botões e cartões. Mais suave porque é tátil.

---

## Componentes

### Botão principal (claro)
Fundo `--tinta`, texto branco, 20px vertical, canto 2px, peso 800.

### Botão principal (treino)
Fundo branco, texto `--fundo-treino`, **24px vertical**, canto 16px,
condensada 26px peso 700. Ocupa a largura toda.

### Aviso da app
Fundo `--azul-fundo`, borda esquerda 3px `--azul`, 16px de padding.
Sempre com explicação — nunca só um ícone.

### Linha de exercício
Nome (16px/700), etiqueta por baixo (12px, cinza), carga à direita alinhada
por tabular. Separador 1px em baixo.

---

## Movimento

Quase nenhum. Apenas:

- **Descanso** — o anel a esvaziar (é informação, não decoração)
- **Painel de RPE** — sobe de baixo, 280ms
- **Mudança de série** — o número muda sem animação

Sem entradas em fade, sem hover em cartões, sem transições decorativas.

Respeitar `prefers-reduced-motion` — nesse caso, o anel de descanso passa a
mostrar só o número.

---

## As três estruturas

### Ecrã do dia (modo claro)
O treino como linha temporal. Tempo à esquerda, marcadores ao centro,
conteúdo à direita. Vê-se onde se está, o que falta, a que horas se sai.

### Treino ao vivo (modo escuro)
Uma série de cada vez. Carga a 120px ao centro, botão a ocupar um terço do
ecrã, RPE a subir de baixo, descanso em ecrã cheio com o próximo peso já
calculado.

### Calculadora de discos (dentro do treino ao vivo)
Aparece quando o exercício usa barra. Mostra que discos pôr de cada lado,
com as cores de competição: 20 vermelho, 15 azul, 10 verde, 5 branco,
2,5 e 1,25 pretos.

---

## Acessibilidade

- Contraste mínimo 4.5:1 no texto, 3:1 em elementos gráficos
- Alvos de toque ≥44px; **≥64px no modo treino** (mãos molhadas)
- Foco de teclado visível — contorno 2px `--azul`
- Nunca só cor a transmitir informação
- Modo treino testado com brilho baixo

---

## O que evitar

Estas escolhas foram deliberadamente rejeitadas:

- Cartões arredondados idênticos com sombra cinzenta
- Gradientes decorativos
- Ícones onde uma palavra é mais clara
- Setas `→` no fim dos botões
- Etiquetas em maiúsculas por cima de tudo
- Mais de um acento de cor
- Emojis na interface
