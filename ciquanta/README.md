# CIQUANTA CRM

CRM e central de operações institucionais do CIQUANTA, Centro Internacional de Computação e Tecnologias Quânticas do Estado da Paraíba.

Aplicação web autônoma, sem servidor próprio e sem dependência de outros sistemas ou de bibliotecas de terceiros carregadas da internet: todo o conteúdo desta pasta pode ser copiado para um repositório próprio e publicado como site estático. O passo a passo de publicação está em [PUBLICACAO.md](PUBLICACAO.md) e o manual de operação, em [docs/manual-ciquanta-crm.pdf](docs/manual-ciquanta-crm.pdf).

## Módulos

| Módulo | Função |
|---|---|
| Hoje | Tela de abertura: situação da conta Google, pipeline ponderado, contratado contra a meta anual, taxa de resposta, visitas à réplica, próximas ações ordenadas por impacto, agenda unificada, funil, receita por fonte, mapa por estado e potencial por setor. |
| Sinais do mercado | Notícias do dia ligadas às organizações do CRM, por tema, e oportunidades identificadas com IA. Organizações citadas nos últimos 30 dias ganham pontos de potencial. |
| Central de automação | Fluxo animado da coleta ao CRM, resultado de cada etapa da coleta diária, rotinas do aplicativo, piloto automático de abordagem e registro. |
| Captação | Plano de captação: meta anual e metas por frente de financiamento, contratado e pipeline ponderado, previsão por trimestre, cobertura por mecanismo de fomento (organizações elegíveis ainda sem abordagem) e relatório executivo em PDF. |
| Caixa de entrada | Acompanha a caixa da conta Google do CIQUANTA pelo histórico do Gmail; vincula cada resposta à organização, registra no histórico, encerra a cadência do contato e avisa a equipe. |
| Agenda | Marcos institucionais, eventos potenciais para participação (marcados "a confirmar"), prazos de editais, visitas à réplica e compromissos do Google Agenda; reuniões com convite e link do Meet; exportação `.ics`. Cada evento gera uma campanha com o público sugerido (setores do evento ou parceiros estratégicos). |
| Visitas e cadastros | Integração com o Painel CIQUANTA (`painelciquanta.secties.pb.gov.br`): lê as planilhas de agendamentos de visita e de cadastros de perfis, mostra visitantes por dia, categorias e temas de interesse e leva pesquisadores, empreendedores e parceiros ao CRM. |
| Organizações e contatos | CRM com setor, segmento, nível de evidência de atuação quântica, relacionamento, prioridade, bloco de parceria, mecanismos, dados da Receita Federal e pontuação de potencial (0 a 100, com os motivos). A ficha reúne e-mails, arquivos do Drive e compromissos ligados à organização. |
| Oportunidades | Funil com valor, probabilidade por etapa, valor ponderado, modalidade, linha de pesquisa, mecanismo de financiamento, previsão por trimestre e proposta técnica e comercial em PDF, com cenários de custo líquido pela Lei do Bem. |
| Programa de parceiros | Cotas anuais de parceria (valores e benefícios editáveis), adesões com carta em PDF, receita recorrente, renovações e candidatas por potencial. Cada adesão vira oportunidade no funil. |
| Rede | Mapa interativo das organizações em torno dos setores ou dos mecanismos de fomento. |
| Setores e aplicações | 22 setores; dez com agenda de pesquisa aplicada e apresentação própria no formato da agenda oficial do sistema financeiro. |
| Busca ativa | Pessoas de P&D das organizações (pesquisadores com produção científica, temas, trabalho de destaque, cargo e e-mail profissional quando públicos, lideranças de inovação citadas em fontes públicas), mapeamento com 471 organizações (empresas, deep techs, fornecedores quânticos, investidores, fomentadores, ICTs, autoridades), consulta e lote de CNPJ, buscas prontas para encontrar contatos e descoberta de contatos nas conversas do Gmail. |
| Cadências | Sequências automáticas de e-mails por público, em dias úteis e horário comercial, com continuação na mesma conversa. Param quando o contato responde ou pede descadastro. |
| Campanhas e modelos | Envio personalizado pela conta Google, com tratamento formal, link da apresentação do setor, materiais, rascunhos, teste, agendamento, limite diário e descadastro. |
| Apresentações | Apresentação institucional oficial (22 páginas) e apresentações setoriais no mesmo padrão, com modo apresentação, PDF e link público (`apresentacao.html?d=<setor>`); biblioteca do Google Drive. |
| Leis, editais e simulador | 39 mecanismos de fomento e incentivo (leis federais, obrigações regulatórias de PD&I, agências, bancos, fundos e instrumentos estaduais), com base legal, gestor e papel do CIQUANTA; acompanhamento de editais com prazos; simuladores. |
| Fontes | Fontes do mapeamento e das apresentações, com o critério de cada nível de evidência. |

A busca rápida (Ctrl K) localiza organizações, contatos, oportunidades e telas e executa ações (nova organização, nova oportunidade, relatório, cópia de segurança). A tecla `?` mostra os atalhos de teclado.

## Automação

O CRM se atualiza sozinho em duas camadas.

**Coleta diária no servidor** (`tools/coleta/`, GitHub Actions, às 6h17 todos os dias e às 15h47 nos dias úteis):

| Etapa | O que faz | Grava |
|---|---|---|
| Painel CIQUANTA | Totais públicos de cadastros e visitas à réplica, com histórico diário | `data/painel.json` |
| Notícias e editais | Notícias sobre computação quântica, P&D, deep tech e fomento (Google Notícias, EMBRAPII, Agência FAPESP), ligadas às organizações citadas; chamadas abertas com prazo quando o texto informa | `data/sinais.json`, `data/editais-auto.json` |
| Canais institucionais | Visita o site oficial de até 70 organizações por execução, descobre as páginas internas (links e sitemap) e guarda os e-mails de diretorias e setores (presidência, gabinete, reitoria, diretorias, relações institucionais, inovação, RI, imprensa), classificados pelo endereço e pelo texto em volta; também CNPJ do rodapé e LinkedIn. E-mails pessoais são descartados | `data/canais.json` |
| Pessoas de P&D | Para até 45 organizações por execução, encontra na OpenAlex quem publica pela organização nos últimos seis anos, os temas e quem trabalha com computação quântica; no ORCID, o cargo atual e o e-mail, só quando o próprio pesquisador o tornou público e o domínio é o da organização | `data/pesquisadores.json` |
| Diretorias na web com IA | Com a chave da Anthropic, o Claude procura na web (portais de transparência, governança, relatórios) os e-mails de diretorias das organizações que ainda não têm um e as lideranças de P&D e inovação citadas pelo nome (só nome, cargo e fonte). Só entra o que é conferido na própria página citada | `data/canais.json`, `data/pesquisadores.json` |
| Receita Federal | Situação cadastral, CNAE, porte, capital e e-mail cadastrado para os CNPJ conhecidos | `data/receita.json` |
| Descoberta com IA | Com a chave da Anthropic configurada, o Claude lê as notícias novas e sugere organizações e oportunidades; só entra o que está escrito no texto da notícia | `data/descobertas.json` |

Ao final, o validador confere a integridade das bases e o resultado vai para `data/coleta.json`. Uma etapa que falha não impede as outras.

**Rotinas no aplicativo** (`js/automacao.js`, ao abrir e a cada três horas): levam ao CRM as organizações novas, criam os contatos institucionais, aplicam os dados da Receita, atualizam os totais do Painel CIQUANTA e transformam em contato quem responde de um domínio mapeado. O **piloto automático** (desligado por padrão) inscreve todo dia, na cadência do segmento, as organizações de maior potencial que ainda não foram abordadas. Tudo aparece na **Central de automação**, com registro e chaves para ligar e desligar cada rotina.

Para rodar a coleta à mão: `cd tools/coleta && npm install && node coletar.mjs` (ou `node coletar.mjs sinais painel` para etapas específicas).

## Base de dados

- **Base compartilhada:** com a opção ativada em Configurações, o CRM mantém uma única base em um arquivo no Google Drive da conta do CIQUANTA. Cada computador mescla as suas mudanças com as dos demais, registro a registro. Só um computador por vez executa cadências e campanhas agendadas.
- **Várias abas:** abas abertas no mesmo navegador se atualizam entre si, e só uma conduz os envios automáticos.
- **Pontos de restauração:** uma cópia automática por dia de uso e antes de qualquer operação que substitua dados, com restauração em Configurações.
- **Desfazer:** exclusões mostram a opção "Desfazer".
- **Integridade:** os dados são verificados ao carregar e ao importar (registros repetidos ou órfãos são corrigidos).
- **Sem conexão:** depois do primeiro acesso, o sistema abre mesmo sem internet e pode ser instalado como aplicativo.

## Identidade visual

A interface segue a tipografia do portal do CIQUANTA sobre uma base sóbria de papel e tinta: filetes no lugar de caixas, texto no lugar de selos. As regras completas, com o que é proibido, estão em `.claude/skills/design-ciquanta/SKILL.md`.

- Tipografia: Libre Franklin, a mesma do portal do CIQUANTA, incluída em `assets/fonts/` (licença OFL); títulos em negrito com a barra do logotipo e rótulos em caixa-alta espaçada, como no portal
- Cores: papel `#F7F7F4`, tinta `#101934`, azul CIQUANTA `#2F55D4` só como acento; vermelho apenas para erro. Tema escuro automático
- Movimento: filetes que se desenham na entrada das telas, números que contam, frase de abertura palavra por palavra e marcador do menu que desliza; respeita a preferência do sistema por menos movimento
- Marca: a interface mostra só o logotipo do CIQUANTA (`assets/logo-marinho.png` e `assets/logo-branco.png`). Propostas, cartas, e-mails e apresentações seguem o modelo institucional oficial, com os parceiros (`assets/parceiros-*.png`, `assets/secties-govpb*.png`)

Revisão de design: `node tools/design/revisar.mjs` captura todas as telas (computador e celular, claro ou escuro, com `--escuro`) em `tools/design/saida/` e acusa pílulas, degradês, sombras fora de janelas, fontes fora do sistema, texto pequeno demais e rolagem horizontal.

## E-mail do CIQUANTA (uma vez, sem Google Cloud)

A conexão com ciquanta@secties.pb.gov.br é feita por uma **ponte** no Google Apps Script (`ponte/ponte.gs`), publicada pela própria conta como app da Web. Não há projeto no Google Cloud, tela de consentimento nem ID de cliente.

1. Em Configurações, **Copiar código da ponte**: o código já vem com uma chave de acesso gerada no computador.
2. Em [script.google.com](https://script.google.com/home/projects/create), com a conta do CIQUANTA: cole o código, adicione os serviços **Gmail API** e **Google Calendar API**, e implante como **App da Web** (Executar como: Eu; Quem pode acessar: Qualquer pessoa).
3. Cole o endereço `/exec` em Configurações e conecte. **Link para a equipe** conecta os outros computadores.

**Acesso restrito:** só o computador que instalou a ponte usa a chave. Os demais entram pela tela **Entrar**, com um código de seis dígitos enviado ao próprio ciquanta@secties.pb.gov.br, e recebem uma sessão de 30 dias, que pode ser encerrada em Configurações → Acesso ao CRM. Com `data/acesso.json` publicado, todo visitante sem sessão vê só a tela de entrada. Para fechar também os arquivos do site no domínio da SECTIES, veja a seção 3 de [PUBLICACAO.md](PUBLICACAO.md) (Cloudflare Access ou proxy de autenticação).

A ponte só atende pedidos com a chave ou uma sessão válida (comparação em tempo constante) e faz apenas o que o CRM precisa: enviar e criar rascunhos, ler as conversas para acompanhar respostas, ler e criar compromissos (com Meet), buscar arquivos e apresentações no Drive, ler as planilhas do Painel CIQUANTA sem colunas de documentos, telefone ou endereço, e guardar a base compartilhada em arquivos da pasta "CIQUANTA CRM". A chave não sai nas cópias de segurança. Detalhes e problemas comuns estão no manual.

O acompanhamento em tempo real e as cadências funcionam enquanto o sistema estiver aberto em alguma aba com a ponte conectada.

### Painel CIQUANTA

A conta conectada precisa ter acesso de leitura às planilhas "CIQUANTA | Agendamentos de visita" e "CIQUANTA | Cadastros de perfis". A ponte as localiza pelo nome; se preferir, informe os links em Configurações.

## Dados e privacidade

- Organizações, contatos, oportunidades, campanhas e histórico ficam no navegador de quem usa. Use Configurações para baixar cópias, restaurar, mesclar ou guardar no Google Drive.
- O mapeamento (`data/empresas.json`) contém apenas dados públicos de organizações e não inclui pessoas nem e-mails.
- Das planilhas do Painel CIQUANTA, o sistema guarda somente totais (visitas por dia, categorias, temas). As linhas completas ficam na memória da aba; telefone e documentos não são copiados, e quem não aceitou receber notícias entra no CRM marcado para não receber e-mails.
- Campanhas e cadências respeitam a lista de descadastro, e o rodapé dos e-mails informa como deixar de receber mensagens (LGPD).
- A coleta guarda apenas caixas institucionais publicadas pelas próprias organizações (diretoria@, gabinete@, inovacao@...). Endereços com cara de pessoa (nome.sobrenome@, iniciais) são descartados.

## Manutenção

- `data/setores.json`: setores, linhas de pesquisa e conteúdo comum das apresentações setoriais.
- `data/empresas.json` e `data/fontes.json`: mapeamento e fontes.
- `data/institucional.json` e `assets/deck/institucional/`: apresentação institucional oficial.
- `data/mecanismos.json`: mecanismos de fomento (revisar percentuais e prazos quando a legislação mudar).
- `data/modelos.json` e `data/agenda.json`: modelos de e-mail e agenda iniciais. As datas dos eventos potenciais são referências e devem ser conferidas na página oficial de cada evento.

- `tools/coleta/`: coletores da atualização diária (Node 20 ou superior; só as etapas com IA usam dependências).
- `ponte/ponte.gs`: código da ponte do e-mail. Ao mudar, aumente `VERSAO` e publique uma nova versão no Apps Script.
- `docs/manual/`: fonte do manual em PDF (HTML e capturas de tela).
- `tools/validar-dados.mjs`: verifica a integridade das bases (`node tools/validar-dados.mjs`). Rode antes de publicar alterações em `data/`.
- `js/vendor/chart.umd.js`: Chart.js 4.4.1 (licença MIT), incluída no próprio sistema.

Segurança: a página define uma política de conteúdo (CSP) que só permite programas do próprio endereço e conexões com a ponte do Apps Script e as bases públicas de CNPJ.

Para testar localmente: `python3 -m http.server` nesta pasta e abrir `http://localhost:8000/`.
