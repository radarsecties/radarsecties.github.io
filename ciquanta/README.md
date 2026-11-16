# CIQuanta · Relações Institucionais

Central de operações institucionais do **CIQuanta-PB** (Centro Internacional de Computação e Tecnologias Quânticas da Paraíba / SECTIES).

Endereço: `https://radarsecties.github.io/ciquanta/` (e `https://radar.secties.pb.gov.br/ciquanta/` no servidor espelho).

## O que faz

| Módulo | Para quê |
|---|---|
| **Painel** | Indicadores, funil de parcerias, mapa do Brasil por UF, envios e respostas, follow-ups, próximas agendas e notícias quânticas. |
| **Organizações / Contatos / Funil** | CRM de empresas, fomentadores, autoridades e ICTs: estágios, histórico, tarefas, mecanismos associados, importação e exportação em CSV. |
| **Busca ativa** | Consulta de CNPJ na Receita (BrasilAPI, Minha Receita, CNPJ.ws), CNPJs em lote, prospecção guiada por setor/UF/mecanismo, base de referência com 140 organizações e descoberta de contatos nas conversas do Gmail. |
| **Campanhas Gmail** | Disparo personalizado pela conta Gmail do usuário: variáveis, layout institucional, materiais (link ou anexo), modo rascunho, envio de teste, agendamento, ritmo controlado, limite diário, lista de descadastro e verificação de respostas. |
| **Modelos / Materiais** | Modelos de e-mail para empresas, autoridades e fomentadores; biblioteca de materiais; gerador de one-pager em PDF. |
| **Mecanismos e leis / Simulador** | 22 instrumentos (Lei do Bem, Lei de TICs, PPI, ZFM, Brasil Semicon, MOVER, PD&I ANEEL e ANP, REDATA, Marco Legal de CT&I, ETEC, Marco das Startups, Finep, BNDES, EMBRAPII, FUNTTEL, BNB, FAPs, SEBRAE, IBQuântica, NIB etc.), com o encaixe do CIQuanta e simuladores. |
| **Agenda setorial / Radar quântico** | Calendário com exportação `.ics` e Google Agenda, convite por campanha; notícias quânticas do Radar SECTIES (`../data/noticias.json`). |

## Configurar o Gmail (uma vez)

1. No [Google Cloud Console](https://console.cloud.google.com/), crie um projeto e ative a **Gmail API** (e a **Google Drive API**, para backup).
2. Configure a tela de consentimento OAuth (**Interno** se a conta for Google Workspace).
3. Crie um **ID do cliente OAuth** do tipo *Aplicativo da Web* com as origens JavaScript `https://radarsecties.github.io` e `https://radar.secties.pb.gov.br`.
4. Cole o Client ID em **Configurações → Integração Gmail** e clique em *Conectar Gmail*.

Não há chave secreta nem servidor: o login usa o Google Identity Services no navegador e o token fica só na memória da aba.

Permissões: `gmail.send` (obrigatória); `gmail.compose` (rascunhos), `gmail.readonly` (respostas e contatos) e `drive.file` (backup) são opcionais.

## Dados e privacidade

- Organizações, contatos, campanhas e histórico ficam no **navegador de quem usa** (localStorage; arquivos anexos em IndexedDB). Nada disso é publicado no repositório.
- Use **Configurações → Baixar backup** com frequência, ou o backup no Google Drive, para levar a base a outro computador.
- A base de referência (`data/organizacoes.json`) traz só dados públicos (nome, setor, sede, site), sem e-mails nem pessoas.
- Campanhas respeitam a lista de descadastro e incluem rodapé com opção de remoção (LGPD).

## Manutenção

- Mecanismos de fomento: `data/mecanismos.json` (revise percentuais e prazos quando a legislação mudar).
- Base de referência: `data/organizacoes.json` · Agenda inicial: `data/agenda.json` · Modelos padrão: `data/modelos.json`.
- Site estático, sem etapa de build. Para testar localmente: `python3 -m http.server` na raiz do repositório e abrir `http://localhost:8000/ciquanta/`.
- A rotina do Radar (`.github/workflows/doe.yml`) não altera esta pasta.
