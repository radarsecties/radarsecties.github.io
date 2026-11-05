# Radar SECTIES 2.0

Clipping diário de ciência, tecnologia, inovação e ensino superior para a SECTIES-PB e a FAPESQ.
Site público, sem login, feito para ser lido no celular e compartilhado no WhatsApp.

Este repositório faz três coisas sozinho, todo dia:

1. **Coleta** notícias de 117 fontes (Paraíba, Brasil e mundo) e tenta ler o Diário Oficial do Estado.
2. **Classifica** cada notícia em um tipo de cartão (edital, evento, política e norma, quântica, IA e governo digital, inovação, ensino superior, ciência, patrimônio, inclusão digital, segurança digital, SECTIES e FAPESQ) e nos temas do Radar (CIQUANTA, SecretarIA 2030, Cidade da Astronomia, etc.).
3. **Monta e publica** o site: página do dia com as 14 últimas edições, imagem de capa para o WhatsApp e a mensagem institucional pronta para colar.

A tarefa agendada roda no GitHub às 7h40 e às 8h40 (horário de Fortaleza) e o GitHub Pages publica o resultado em 1 a 2 minutos.

---

## 1. Como publicar (tudo no GitHub, uma vez só, uns 10 minutos)

O Radar fica inteiro no repositório que você já tem, **radarsecties/radarsecties.github.io**. O GitHub monta a edição todo dia e publica sozinho em https://radarsecties.github.io. Não há outra plataforma.

1. Descompacte o zip e abra a pasta.
2. No Mac, aperte **Cmd + Shift + ponto** no Finder para aparecerem as pastas escondidas (`.github`). Elas precisam ir junto.
3. Em github.com, entre na conta **radarsecties** e abra o repositório **radarsecties.github.io**.
4. Clique em **Add file > Upload files**, selecione **tudo o que está dentro da pasta** e arraste. Clique em **Commit changes**.

Pronto. Em 1 a 2 minutos o site novo aparece em https://radarsecties.github.io. No mesmo envio, a rotina diária é ligada e já monta a primeira edição automática (uns 5 minutos). A partir daí, roda sozinha todo dia às 7h40 e às 8h40.

Se em **Actions** aparecer um botão verde pedindo para habilitar as rotinas, clique nele. Se a rotina falhar com "Permission denied", vá em **Settings > Actions > General > Workflow permissions**, marque **Read and write permissions** e salve.

### Ligar o domínio do governo (ex.: radar.secties.pb.gov.br)

1. Peça à CODATA (ou a quem administra o domínio) um registro **CNAME** de `radar.secties.pb.gov.br` apontando para `radarsecties.github.io`.
2. No repositório, vá em **Settings > Pages**, escreva o domínio em **Custom domain**, salve e marque **Enforce HTTPS** quando a opção liberar.

O Radar percebe o domínio sozinho: a partir da edição seguinte, o link da mensagem do WhatsApp e a capa já usam o endereço novo. O endereço antigo continua funcionando e redireciona.

## 2. O que o Victor faz todo dia (1 minuto)

1. Abra o site e toque em **Compartilhar no WhatsApp**, no topo. O texto institucional da edição já vai pronto, com o link que mostra a capa do dia.

Se quiser conferir antes, abra o site e veja as **Prioridades do dia**.

---

## 3. Como o site é organizado

- **Abertura:** a bandeira: número e data da edição no preto, manchete e leitura do dia no vermelho, com o botão de compartilhar.
- **Física de bolso:** logo abaixo da abertura, com o botão "Outra curiosidade" que passeia pelo banco de 30.
- **Prioridades do dia:** até 5 notícias que pedem atenção (prazos, editais, decisões), misturando Paraíba, Brasil e mundo.
- **Todas as notícias:** uma barra de temas (toque em um tema para filtrar) e o seletor Paraíba/Brasil/Mundo; lista limpa, só texto.
- **Diário Oficial do Estado:** atos revisados (quando há edição editorial) e, abaixo, as menções encontradas automaticamente no texto do Diário, com link para a edição.
- **SECTIES e FAPESQ na comunicação do governo:** pautas novas nos portais oficiais e na imprensa.
- **Ideias para debate:** propostas apoiadas nas notícias. Só entram quando há revisão editorial (ver item 5).
- **De onde vêm as notícias:** todas as fontes por grupo, com um ponto verde nas que responderam naquele dia. Serve para ver de relance se alguma fonte parou.

Seletor **Ver outra edição** no topo: navega pelas 14 edições mais recentes. O endereço `#2026-11-05` abre uma edição específica.

---

## 4. Mapa das pastas

| Pasta/arquivo | O que é | Mexer? |
|---|---|---|
| `fontes/fontes.json` | Lista de fontes (nome, endereço RSS, abrangência, peso) | Sim, para adicionar ou tirar fontes |
| `radar/classificar.py` | Regras de classificação (palavras-chave por tipo e tema) | Sim, com cuidado, para ajustar temas |
| `radar/modelo.html` | Visual do site (cores, fontes, seções) | Sim, para ajustar o visual |
| `radar/montar.py` | Monta o site, a capa e o WhatsApp | Não precisa |
| `radar/coletar.py`, `radar/doe.py`, `radar/main.py`, `radar/editorial.py` | Motor da coleta | Não precisa |
| `ferramentas/curiosidades.json` | Banco da Física de bolso (30 itens) | Sim, para trocar curiosidades |
| `ferramentas/` (marcas, foto, fontes) | Imagens usadas na capa e na Física de bolso | Copie as do repositório antigo |
| `edicoes/AAAA-MM-DD.json` | Uma edição por dia (gravada pela rotina) | Só para revisão editorial |
| `data/noticias.json` | Base das notícias coletadas nos últimos 60 dias (evita repetir) | Não |
| `doe/AAAA-MM-DD.txt` | Texto completo do Diário Oficial, quando o download funcionou | Não |
| `index.html`, `capa.png`, `whatsapp.txt` | O site pronto, na raiz, publicado pelo GitHub Pages | Não (é gerado) |
| `.github/workflows/radar.yml` | A tarefa agendada | Só para mudar o horário |
| `exemplos/edicao-exemplo.json` | Exemplo de edição com todas as seções preenchidas | Referência |

---

## 5. Dois modos de edição

**Modo automático (padrão).** Sem nenhuma configuração, o Radar publica todo dia uma edição com os títulos e resumos originais das fontes, classificados e ordenados por relevância. Manchete = a notícia de mais pontos. Não há "Ideias para debate" nesse modo, porque propostas exigem revisão.

**Modo editorial.** Se existir um arquivo `edicoes/HOJE.json` escrito por uma revisão (o formato é o mesmo das edições antigas do Radar, com `destaque`, `leitura`, `itens`, `doe`, `secom`, `propostas`), a rotina respeita esse arquivo: mantém seus itens e textos, calcula o tipo de cartão de cada um e só completa com até 10 notícias automáticas marcadas como "radar". É assim que a tarefa editorial antiga (a que pesquisava e escrevia) continua funcionando: basta ela gravar o JSON neste repositório; a rotina daqui monta e publica.

**Revisão automática de texto (opcional).** Se o segredo `RADAR_CHAVE_EDITORIAL` for cadastrado em **Settings > Secrets and variables > Actions**, a rotina reescreve em português simples a manchete, a leitura e os resumos, e sugere as Ideias para debate, seguindo a regra de conteúdo oficial. Sem o segredo, nada muda: o modo automático funciona igual.

---

## 6. Regras de conteúdo que o código respeita

- Nunca cita o fornecedor de nenhum serviço de IA no site, na capa ou no WhatsApp.
- Só programas oficiais com divulgação pública (CIQUANTA, Cidade da Astronomia; exceção: SecretarIA 2030).
- Menções do Diário Oficial a atos de pessoal (nomeação, exoneração, férias, diárias) são descartadas automaticamente.
- Mensagem do WhatsApp: sem emojis, sem propostas, até 1.300 caracteres, um único link no fim. Se passar do limite, o montador corta em etapas (também nesta edição, 3 prioridades, frase da leitura, Física de bolso, 2 prioridades).
- Notícias de futebol, polícia, celebridades, apostas e ofertas de produtos perdem pontos e ficam de fora.

---

## 7. Ajustes comuns

**Adicionar uma fonte.** Em `fontes/fontes.json`, copie um bloco e preencha. Na dúvida sobre o endereço do RSS, coloque só o site em `feeds` e em `site`: o coletor tenta descobrir o feed sozinho. Depois, veja em "De onde vêm as notícias" se o ponto ficou verde.

**Cores.** Branco como base, com o vermelho `#B3242D` e o preto `#111114` da bandeira da Paraíba. A abertura e a capa do WhatsApp repetem a estrutura da bandeira (um terço preto, dois terços vermelho). Tudo fica em `:root`, no começo de `radar/modelo.html`; a capa usa os mesmos códigos em `radar/montar.py` (função `gerar_capa`).

**Imagens nos cartões.** Só as Prioridades do dia usam foto, e só quando o portal de origem oferece uma no feed. A foto entra em duotone vermelho (a cor do estado) e ganha cor ao passar o mouse; se não carregar, o cartão fica com o número da prioridade sobre o vermelho. As demais notícias são só texto, de propósito.

**Botão de compartilhar.** "Compartilhar no WhatsApp" fica na barra fixa do topo (visível o tempo todo, inclusive no celular) e na abertura. Abre o WhatsApp com o mesmo texto institucional do `whatsapp.txt`, já com o link da edição. "Copiar o texto", ao lado, copia esse texto para colar onde quiser.

**Marcas.** A FapesQ-PB fica à esquerda e a SECTIES/Governo da Paraíba à direita, na mesma linha, no site e na capa. Os arquivos estão em `ferramentas/`.

**Horário da rotina.** Em `.github/workflows/radar.yml`, as linhas `cron`. O horário é em UTC: Fortaleza + 3 horas.

**Quantidade de notícias.** Em `radar/main.py`: `MIN_ITENS`, `MAX_ITENS` e `COTAS`.

**Rodar no seu computador.** Com Python 3.12: `pip install -r requirements.txt` e `python3 -m radar.main --sem-doe`. O site fica em `index.html`.

---

## 8. Se algo der errado

| Sintoma | O que ver |
|---|---|
| O site não mudou hoje | Aba **Actions**: a última execução está verde? Se vermelha, abra e leia a linha em vermelho. Se não rodou, o GitHub pausa agendamentos em repositórios sem atividade por 60 dias: clique em **Run workflow** para reativar. |
| Poucas fontes com ponto verde | Normal haver algumas cinzas (sites que bloqueiam). Se quase todas estiverem cinzas, a execução pode ter ficado sem internet: rode de novo. |
| Diário Oficial "não foi possível abrir a lista" | O site do A União bloqueou o acesso naquele dia. A rotina tenta de novo às 8h40 e nos dias seguintes. |
| Mensagem do WhatsApp sem a frase da leitura | O texto passou de 1.300 caracteres e o montador cortou. Encurte a manchete ou os títulos das prioridades na edição. |
| Erro "push rejected" ou "Permission denied" no Actions | Settings > Actions > General > Workflow permissions > Read and write permissions. |
