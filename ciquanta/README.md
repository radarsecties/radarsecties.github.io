# CIQUANTA · Relações Institucionais

CRM e central de operações institucionais do CIQUANTA, Centro Internacional de Computação e Tecnologias Quânticas do Estado da Paraíba.

Aplicação web autônoma, sem servidor próprio e sem dependência de outros sistemas: todo o conteúdo desta pasta pode ser copiado para um repositório próprio e publicado como site estático (GitHub Pages ou qualquer servidor HTTPS).

## Módulos

| Módulo | Função |
|---|---|
| Painel | Painel de comando: situação da conta Google, pipeline ponderado, contratado contra a meta anual, taxa de resposta, visitas à réplica, próximas ações ordenadas por impacto, agenda unificada, funil, receita por fonte, mapa por estado e potencial por setor. |
| Interações em tempo real | Acompanha a caixa da conta Google do CIQUANTA pelo histórico do Gmail; vincula cada resposta à organização, registra no histórico, encerra a cadência do contato e avisa a equipe. |
| Agenda | Marcos institucionais, eventos potenciais para participação (marcados "a confirmar"), prazos de editais, visitas à réplica e compromissos do Google Agenda; reuniões com convite e link do Meet; exportação `.ics`. |
| Visitas e cadastros | Integração com o Painel CIQUANTA (`painelciquanta.secties.pb.gov.br`): lê as planilhas de agendamentos de visita e de cadastros de perfis, mostra visitantes por dia, categorias e temas de interesse e leva pesquisadores, empreendedores e parceiros ao CRM. |
| Organizações e contatos | CRM com setor, segmento, nível de evidência de atuação quântica, relacionamento, prioridade, bloco de parceria, mecanismos, dados da Receita Federal e pontuação de potencial (0 a 100, com os motivos). A ficha reúne e-mails, arquivos do Drive e compromissos ligados à organização. |
| Oportunidades | Funil com valor, probabilidade por etapa, valor ponderado, modalidade, linha de pesquisa, mecanismo de financiamento, previsão por trimestre e proposta técnica e comercial em PDF, com cenários de custo líquido pela Lei do Bem. |
| Rede | Mapa interativo das organizações em torno dos setores ou dos mecanismos de fomento. |
| Setores e aplicações | 22 setores; dez com agenda de pesquisa aplicada e apresentação própria no formato da agenda oficial do sistema financeiro. |
| Busca ativa | Mapeamento com 471 organizações (empresas, deep techs, fornecedores quânticos, investidores, fomentadores, ICTs, autoridades), consulta e lote de CNPJ, buscas prontas para encontrar contatos e descoberta de contatos nas conversas do Gmail. |
| Cadências | Sequências automáticas de e-mails por público, em dias úteis e horário comercial, com continuação na mesma conversa. Param quando o contato responde ou pede descadastro. |
| Campanhas e modelos | Envio personalizado pela conta Google, com tratamento formal, link da apresentação do setor, materiais, rascunhos, teste, agendamento, limite diário e descadastro. |
| Apresentações | Apresentação institucional oficial (22 páginas) e apresentações setoriais no mesmo padrão, com modo apresentação, PDF e link público (`apresentacao.html?d=<setor>`); biblioteca do Google Drive. |
| Leis, editais e simulador | 39 mecanismos de fomento e incentivo (leis federais, obrigações regulatórias de PD&I, agências, bancos, fundos e instrumentos estaduais), com base legal, gestor e papel do CIQUANTA; acompanhamento de editais com prazos; simuladores. |
| Fontes | Fontes do mapeamento e das apresentações, com o critério de cada nível de evidência. |

A busca rápida (Ctrl K) localiza organizações, contatos, oportunidades e telas.

## Identidade visual

Segue a apresentação institucional oficial do CIQUANTA (`assets/docs/ciquanta-apresentacao-institucional.pdf`):

- Logotipo: `assets/logo-azul.png`, `assets/logo-branco.png`, `assets/logo-marinho.png`
- Parceiros: `assets/parceiros-marinho.png`, `assets/parceiros-branco.png`, `assets/secties-govpb*.png`
- Cores: azul-marinho `#14224A`, azul `#3056D5`, vermelho de destaque `#C8232C`, lavanda `#EEF2FB`, linhas `#D5DCEA`, texto secundário `#5B6680`
- Tipografia: Arial

## Conta Google (uma vez)

1. No [Google Cloud Console](https://console.cloud.google.com/), crie um projeto e ative Gmail API, Google Calendar API, Google Drive API e Google Sheets API.
2. Configure a tela de consentimento OAuth (Interno, se a conta for Google Workspace).
3. Crie um ID do cliente OAuth do tipo Aplicativo da Web, com o endereço do sistema como origem JavaScript autorizada.
4. Em Configurações, cole o Client ID, escolha as permissões e conecte com a conta do CIQUANTA.

Permissões: envio (`gmail.send`, obrigatória); leitura para acompanhar respostas (`gmail.readonly`); rascunhos (`gmail.compose`); agenda e reuniões (`calendar.events`); busca de arquivos e apresentações no Drive (`drive.metadata.readonly`); planilhas do Painel CIQUANTA (`spreadsheets.readonly`); cópia de segurança (`drive.file`). Não há chave secreta: o token fica só na memória da aba aberta.

O acompanhamento em tempo real e as cadências funcionam enquanto o sistema estiver aberto em alguma aba com a conta conectada.

### Painel CIQUANTA

A conta conectada precisa ter acesso de leitura às planilhas "CIQUANTA | Agendamentos de visita" e "CIQUANTA | Cadastros de perfis". Com a busca no Drive ativada elas são localizadas pelo nome; sem ela, informe os links em Configurações.

## Dados e privacidade

- Organizações, contatos, oportunidades, campanhas e histórico ficam no navegador de quem usa. Use Configurações para baixar cópias, restaurar, mesclar ou guardar no Google Drive.
- O mapeamento (`data/empresas.json`) contém apenas dados públicos de organizações e não inclui pessoas nem e-mails.
- Das planilhas do Painel CIQUANTA, o sistema guarda somente totais (visitas por dia, categorias, temas). As linhas completas ficam na memória da aba; telefone e documentos não são copiados, e quem não aceitou receber notícias entra no CRM marcado para não receber e-mails.
- Campanhas e cadências respeitam a lista de descadastro, e o rodapé dos e-mails informa como deixar de receber mensagens (LGPD).

## Manutenção

- `data/setores.json`: setores, linhas de pesquisa e conteúdo comum das apresentações setoriais.
- `data/empresas.json` e `data/fontes.json`: mapeamento e fontes.
- `data/institucional.json` e `assets/deck/institucional/`: apresentação institucional oficial.
- `data/mecanismos.json`: mecanismos de fomento (revisar percentuais e prazos quando a legislação mudar).
- `data/modelos.json` e `data/agenda.json`: modelos de e-mail e agenda iniciais. As datas dos eventos potenciais são referências e devem ser conferidas na página oficial de cada evento.

Para testar localmente: `python3 -m http.server` nesta pasta e abrir `http://localhost:8000/`.
