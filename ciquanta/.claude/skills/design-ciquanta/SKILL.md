---
name: design-ciquanta
description: Sistema visual do CIQUANTA CRM (editorial e científico, sem caixas nem selos). Use antes de criar ou alterar qualquer tela, componente, estilo ou movimento do CRM, e rode a revisão de design ao terminar.
---

# Sistema visual do CIQUANTA CRM

O CRM tem uma linguagem própria, editorial e científica: papel e tinta, filetes no lugar de caixas, texto no lugar de selos. A elegância vem da tipografia, do alinhamento e do espaço, não de enfeites. Toda tela nova segue estas regras. O código de referência é `css/app.css`.

## Fundamentos

- **Tipografia.** Hanken Grotesk na interface (13 a 14 px no corpo). Newsreader nos títulos de página (38 px, peso 400), nos números de indicadores (38 a 44 px), nas datas da agenda e nos nomes de pessoas. Itálico da Newsreader para rótulos de grupo do menu, datas por extenso e ênfases pontuais. Nada de outras fontes; as duas ficam em `assets/fonts/` (licença OFL).
- **Cor.** Papel `--papel`, tinta `--tinta` (marinho quase preto), tinta secundária `--tinta-2` e `--tinta-3`, filetes `--filete` e `--filete-forte`. Azul CIQUANTA `--acento` só como acento: link, marcador ativo, um número ou uma palavra em destaque. Verde, ocre e vermelho (`--ok`, `--warn`, `--bad`) só para estado; vermelho apenas para erro ou perda.
- **Estrutura.** Blocos são separados por um filete superior (`.card` desenha um filete de 1 px, sem fundo, borda ou sombra). Tabelas e listas usam linhas finas entre itens. Caixas com fundo e borda ficam para o que é de fato um objeto: campos de formulário, cartões arrastáveis do funil, janelas e a busca rápida.
- **Raios.** 8 px em campos e botões, 12 px em janelas. Nunca cantos de pílula.
- **Sombra.** Só em camadas sobrepostas (janela, busca rápida, aviso, menu aberto no celular).

## Marcadores sem caixa

| Informação | Como mostrar |
|---|---|
| Estado, tipo, categoria | Texto (`.badge`), colorido só quando o estado importa; nunca com fundo |
| Relacionamento e etapa do funil | Ponto de 6 px e texto (`relBadge`, `funilBadge`, classe `.marca`) |
| Nível de evidência | Três traços como um sinal e texto curto (`evBadge`, classe `.nivel`) |
| Prioridade A | Letra em itálico da Newsreader (`.prio`) |
| Filtros e alternâncias | Texto sublinhado quando ativo (`button.chip`, `.seg-mini`, `.tabs`) |
| Indicadores | Rótulo pequeno, número grande em Newsreader e linha de contexto (`.kpi`; em Hoje, `.regua`) |
| Pessoa | Nome em Newsreader, cargo ou temas abaixo, ações à direita (`.pessoa`) |

## Proibido

- Pílulas: rótulos com fundo colorido ou contorno e cantos totalmente arredondados.
- Cartões com fundo, borda e sombra para agrupar conteúdo comum.
- Faixas de destaque em degradê, órbitas, brilhos, partículas e ícones decorativos em quadrados coloridos.
- Rótulos pequenos em caixa-alta com espaçamento largo como padrão de título.
- Ícones no menu lateral. O menu é tipográfico; o item ativo ganha peso e o marcador de 2 px desliza até ele.
- Logotipos de terceiros na interface. O CRM mostra só a marca do CIQUANTA; documentos oficiais (propostas, cartas, apresentações) seguem o modelo institucional.
- Textos explicativos dentro das telas. Instruções vão para o manual em PDF (`docs/manual/`).
- Emojis.

## Movimento

Movimento serve para orientar, nunca para enfeitar.

- Na entrada de uma tela, os filetes se desenham da esquerda para a direita, em sequência, e os blocos sobem 8 px enquanto aparecem.
- Números de indicadores contam até o valor (`data-contar`).
- Em Hoje, a frase de abertura entra palavra por palavra (`palavras()` em `js/motion.js`).
- O marcador do menu desliza até o item ativo, e as abas desenham o sublinhado.
- Tudo respeita `prefers-reduced-motion`. Use `var(--ease)` e durações de 0,3 a 1,2 s.

## Responsivo e temas

- Abaixo de 860 px o menu vira gaveta, as grades viram uma coluna e a régua de Hoje vira duas. Nenhuma tela pode rolar na horizontal (só tabelas, dentro de `.table-wrap`).
- Tema escuro: todas as cores vêm dos tokens. Nunca escreva cor fixa em estilo inline. Use `var(--tinta)`, `var(--acento)` e similares, para que o tema escuro funcione.

## Revisão obrigatória

Depois de qualquer mudança visual, rode a ferramenta de revisão e leia as imagens:

```bash
node tools/design/revisar.mjs                         # todas as telas, computador e celular
node tools/design/revisar.mjs --telas painel,parceiros --escuro
node tools/design/revisar.mjs --so-verificar          # só a verificação automática
```

A verificação acusa pílulas, degradês, sombras fora de janelas, fontes fora do sistema, texto menor que 11 px, rolagem horizontal e erros de página. As imagens ficam em `tools/design/saida/`. Uma mudança só está pronta com a verificação limpa e as imagens conferidas.
