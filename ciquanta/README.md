# CIQUANTA · Relações Institucionais

Sistema de relações institucionais do CIQUANTA, Centro Internacional de Computação Quântica do Estado da Paraíba.

Aplicação web autônoma, sem servidor próprio e sem dependência de outros sistemas: todo o conteúdo desta pasta pode ser copiado para um repositório próprio e publicado como site estático (GitHub Pages ou qualquer servidor HTTPS).

## Módulos

| Módulo | Função |
|---|---|
| Painel | Pipeline ponderado, contratado, mapa por estado, funil, relacionamento, mecanismos, interações recentes, próximos passos e agenda. |
| Interações em tempo real | Acompanha a caixa da conta Google do CIQUANTA pelo histórico do Gmail; vincula cada resposta à organização, registra no histórico, marca a campanha como respondida e avisa a equipe (aviso na tela e notificação na área de trabalho). |
| Agenda | Agenda institucional, prazos de mecanismos e eventos do Google Agenda; agendamento de reuniões com convite e link do Meet. |
| Organizações e contatos | CRM com setor, segmento, nível de evidência de atuação quântica, relacionamento, prioridade, bloco de parceria (institucional, industrial e tecnológico, acadêmico), mecanismos e dados da Receita Federal. |
| Oportunidades de negócio | Funil com valor estimado, probabilidade por etapa, valor ponderado, modalidade de participação, linha de pesquisa, mecanismo de financiamento e previsão por trimestre. |
| Setores e aplicações | Dez agendas de pesquisa aplicada (financeiro, saúde, agro, clima, energia, óleo e gás, logística, indústria, telecom, governo e defesa) no formato da agenda oficial do sistema financeiro. |
| Busca ativa | Mapeamento setorial com 324 organizações e nível de evidência, consulta e lote de CNPJ, buscas prontas para encontrar contatos e descoberta de contatos nas conversas do Gmail. |
| Campanhas e modelos | Envio personalizado pela conta Google, com tratamento formal (Vossa Excelência, Vossa Magnificência, Vossa Senhoria), link da apresentação do setor, materiais, rascunhos, teste, agendamento, limite diário e descadastro. |
| Apresentações | Deck institucional e decks setoriais com a identidade do CIQUANTA, modo apresentação, PDF e link público (`apresentacao.html?d=<setor>`); biblioteca das apresentações do Google Drive. |
| Mecanismos e simulador | Lei do Bem, Lei de TICs, PPI, ZFM, Brasil Semicon, MOVER, PD&I ANEEL e ANP, REDATA, Marco Legal de CT&I, ETEC, Marco das Startups, Finep, BNDES, EMBRAPII, FUNTTEL, BNB, FAPs, SEBRAE, IBQuântica e NIB, com o papel do CIQUANTA e simuladores. |
| Fontes | Todas as fontes do mapeamento e das apresentações, com o critério de cada nível de evidência. |

## Identidade visual

Extraída das apresentações oficiais do CIQUANTA (reunião executiva, 2026) e do convite de inauguração:

- Logotipo: `assets/logo-azul.png`, `assets/logo-branco.png`, `assets/logo-marinho.png`
- Parceiros: `assets/parceiros-branco.png`, `assets/parceiros-marinho.png`
- Cores: azul-marinho `#0A122D`, azul `#3056D5`, lavanda `#EBEEF7`, intermediários `#172A68` e `#233F9C`
- Tipografia: Open Sans (300 a 800)

## Conta Google (uma vez)

1. No [Google Cloud Console](https://console.cloud.google.com/), crie um projeto e ative Gmail API, Google Calendar API e Google Drive API.
2. Configure a tela de consentimento OAuth (Interno, se a conta for Google Workspace).
3. Crie um ID do cliente OAuth do tipo Aplicativo da Web, com o endereço do sistema como origem JavaScript autorizada.
4. Em Configurações, cole o Client ID, escolha as permissões e conecte com a conta do CIQUANTA.

Permissões: envio (`gmail.send`, obrigatória); leitura para acompanhar respostas (`gmail.readonly`); rascunhos (`gmail.compose`); reuniões (`calendar.events`); lista de apresentações do Drive (`drive.metadata.readonly`); cópia de segurança (`drive.file`). Não há chave secreta: o token fica só na memória da aba aberta.

O acompanhamento em tempo real funciona enquanto o sistema estiver aberto em alguma aba com a conta conectada.

## Dados

- Organizações, contatos, oportunidades, campanhas e histórico ficam no navegador de quem usa. Use Configurações para baixar cópias, restaurar, mesclar ou guardar no Google Drive.
- O mapeamento (`data/empresas.json`) contém apenas dados públicos e não inclui pessoas nem e-mails.
- Campanhas respeitam a lista de descadastro e o rodapé informa como deixar de receber mensagens (LGPD).

## Manutenção

- `data/setores.json`: setores, linhas de pesquisa e conteúdo comum dos decks.
- `data/empresas.json` e `data/fontes.json`: mapeamento e fontes.
- `data/institucional.json`: deck institucional.
- `data/mecanismos.json`: mecanismos de fomento (revisar percentuais e prazos quando a legislação mudar).
- `data/modelos.json` e `data/agenda.json`: modelos e agenda iniciais.

Para testar localmente: `python3 -m http.server` nesta pasta e abrir `http://localhost:8000/`.
