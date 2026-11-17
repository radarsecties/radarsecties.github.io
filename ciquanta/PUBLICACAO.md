# Como publicar o CRM do CIQUANTA

O sistema é um site estático: não tem servidor, banco de dados nem etapa de compilação. Publicar é colocar o conteúdo desta pasta em um endereço HTTPS e ligar a ponte do e-mail na conta do CIQUANTA.

## 1. Escolha onde hospedar

| Opção | Endereço resultante | Quando usar |
|---|---|---|
| **A. Repositório próprio no GitHub Pages** (recomendada) | `https://<organização>.github.io/<repositório>/` ou domínio próprio | Publicação independente, com atualização a cada envio de código. |
| **B. Servidor da SECTIES** | por exemplo `https://crm.ciquanta.secties.pb.gov.br/` | Quando a equipe de TI já hospeda o site e o Painel CIQUANTA. |
| **C. Repositório atual** | `https://radarsecties.github.io/ciquanta/` | Só para homologação rápida: o endereço fica sob o nome de outro projeto. |

### Opção A: repositório próprio

1. Crie um repositório no GitHub (por exemplo `ciquanta-crm`), em uma organização do CIQUANTA ou da SECTIES.
2. Copie **o conteúdo** desta pasta `ciquanta/` para a raiz do novo repositório, incluindo `.nojekyll`, e envie para a branch `main`.
3. No repositório, abra **Settings → Pages**, escolha **Deploy from a branch**, branch `main`, pasta `/ (root)`, e salve. Em um ou dois minutos o endereço aparece no topo da página.
4. Domínio próprio (opcional): peça à TI um registro DNS `CNAME` de `crm.ciquanta.secties.pb.gov.br` para `<organização>.github.io`. Depois informe o domínio em **Settings → Pages → Custom domain** e marque **Enforce HTTPS**.

### Opção B: servidor da SECTIES

Entregue à TI a pasta `ciquanta/` inteira. Requisitos: servir os arquivos como estão, com **HTTPS** e `index.html` como página inicial. Não há PHP, Node ou banco. Arquivos `.webmanifest` devem sair com o tipo `application/manifest+json` e `.js` com `text/javascript`.

### Opção C: repositório atual

Ao incorporar a branch `claude/affectionate-meitner-dd73e8` à `main` deste repositório, o sistema passa a responder em `https://radarsecties.github.io/ciquanta/`.

## 2. Conecte o e-mail do CIQUANTA (uma vez, cerca de 10 minutos)

A conexão usa uma ponte no Google Apps Script, dentro da própria conta ciquanta@secties.pb.gov.br. Não é preciso Google Cloud, projeto nem ID de cliente.

1. Abra o endereço publicado e vá em **Configurações** (engrenagem no rodapé do menu).
2. Clique em **Copiar código da ponte**. O código já vem com uma chave de acesso exclusiva.
3. Com a conta do CIQUANTA, abra [script.google.com](https://script.google.com/home/projects/create), apague o conteúdo de `Código.gs` e cole o código.
4. Em **Serviços** (+), adicione **Gmail API** e **Google Calendar API**.
5. **Implantar → Nova implantação → App da Web**, com **Executar como: Eu** e **Quem pode acessar: Qualquer pessoa**. Autorize com a conta do CIQUANTA (em "O Google não verificou este app", use **Avançado → Acessar**).
6. Copie o endereço que termina em `/exec`, cole no passo 03 de Configurações e clique em **Conectar**. A base compartilhada é ligada automaticamente.
7. Nos outros computadores, use **Link para a equipe** no computador já conectado. Quem abrir o link vê a tela **Entrar**: o CRM envia um código de seis dígitos para ciquanta@secties.pb.gov.br e, com ele, libera aquele computador por 30 dias. O link não contém a chave.

Se a conta for do Google Workspace e a opção "Qualquer pessoa" não aparecer na implantação, o administrador do domínio precisa permitir apps da Web do Apps Script com acesso externo (Admin → Apps → Google Workspace → Apps Script).

## 3. Feche o acesso ao CRM

O acesso tem duas camadas, ambas ligadas à conta ciquanta@secties.pb.gov.br.

**Camada 1, no próprio CRM (já incluída).** Todo computador sem sessão vê só a tela **Entrar**. O código vai para a caixa do CIQUANTA, vale 10 minutos e uma única entrada; cinco tentativas erradas invalidam o código, e a ponte limita os pedidos. A sessão dura 30 dias. Em Configurações → **Acesso ao CRM** aparecem os computadores com acesso, com o botão **Encerrar** para cada um; **Sair**, no menu da conta (rodapé do menu lateral), encerra a sessão e pode apagar os dados daquele computador (útil em máquinas compartilhadas). Sem sessão, a ponte não devolve nenhum contato, conversa, oportunidade ou arquivo.

Para que qualquer visitante caia na tela de entrada, publique o arquivo `data/acesso.json` com o endereço da ponte: em Configurações → Acesso ao CRM, clique em **Baixar acesso.json** e envie o arquivo para a pasta `data/` do repositório (ou peça a quem mantém o sistema). O endereço da ponte não é segredo: sozinho, ele só permite pedir um código, que chega ao e-mail do CIQUANTA.

**Camada 2, no domínio (recomendada ao publicar em secties.pb.gov.br).** A camada 1 protege os dados, mas os arquivos do programa e as bases públicas (mapeamento, notícias, canais institucionais) continuam abertos a quem souber o endereço. Para fechar também a página, a TI coloca uma porta na frente do domínio. O domínio da SECTIES já passa pela Cloudflare, que faz isso sem custo para equipes pequenas (Cloudflare Zero Trust, até 50 usuários):

1. Em **Zero Trust → Access → Applications → Add an application → Self-hosted**, informe o endereço do CRM (por exemplo, `crm.ciquanta.secties.pb.gov.br`).
2. Em **Policies**, crie uma regra **Allow** com **Include → Emails: ciquanta@secties.pb.gov.br** (e, se quiser, os e-mails individuais da equipe ou **Emails ending in: @secties.pb.gov.br**).
3. Em **Login methods**, use **One-time PIN**: quem abrir o endereço recebe um PIN no e-mail autorizado. Com o Google Workspace da SECTIES configurado como provedor, o login pode ser o próprio Google.
4. Em **Session duration**, use 24 horas ou 7 dias.
5. Libere sem porta só o que precisa ser público: `apresentacao.html` e a pasta `assets/` (as apresentações setoriais têm link público nos e-mails).

Sem Cloudflare, o mesmo resultado vem de um proxy de autenticação no servidor da SECTIES (por exemplo, oauth2-proxy com o Google, restrito à conta do CIQUANTA). No GitHub Pages não há como pôr porta: lá vale só a camada 1.

## 4. Configure o sistema no primeiro acesso

1. Preencha **Remetente e assinatura**. Em **Endereço público do sistema**, informe o endereço publicado: ele é usado nas imagens dos e-mails e nos links das apresentações.
2. Em **Busca ativa**, importe o mapeamento. Em **Captação**, defina as metas. Em **Parceiros**, revise os valores e benefícios das cotas.

## 5. Ligue a atualização automática

A coleta diária roda no GitHub Actions do repositório publicado, sem servidor próprio.

1. No repositório, abra **Actions** e, se o GitHub pedir, autorize os fluxos de trabalho.
2. Confirme que o arquivo do fluxo está no lugar certo:
   - repositório próprio (opção A): `.github/workflows/coleta.yml`, que já vem nesta pasta;
   - repositório atual (opção C): `.github/workflows/ciquanta-coleta.yml`, na raiz.
3. Em **Settings → Actions → General → Workflow permissions**, marque **Read and write permissions**: a coleta grava as bases atualizadas no próprio repositório.
4. Rode a primeira vez em **Actions → CIQUANTA · Coleta diária → Run workflow**. Depois disso ela roda sozinha às 6h17 todos os dias e às 15h47 nos dias úteis. O GitHub só agenda fluxos que estão na branch principal.
5. (Opcional) Etapas com IA (descoberta de oportunidades nas notícias e busca de e-mails de diretorias na web): em **Settings → Secrets and variables → Actions**, crie o segredo `ANTHROPIC_API_KEY` com uma chave da [Anthropic](https://console.anthropic.com/). Sem ela, essas etapas são apenas ignoradas. A variável `CIQUANTA_LOTE_IA` define quantas organizações a busca de diretorias pesquisa por execução (padrão 12). O modelo padrão é o Claude Opus 5.5; para usar outro, crie a variável `CIQUANTA_MODELO` (por exemplo `claude-fable-5-2`).
6. (Opcional) Pessoas de P&D: a etapa funciona sem chave. Para uma cota maior na OpenAlex, crie o segredo `OPENALEX_API_KEY` (gratuito em openalex.org). A variável `CIQUANTA_LOTE_PESQUISA` define quantas organizações são pesquisadas por execução (padrão 45). Para rodar uma etapa isolada, use **Run workflow** e informe, por exemplo, `pesquisadores`.
7. No sistema, abra **Central de automação** e confira o resultado da coleta. Para que a abordagem também seja automática, preencha o remetente em Configurações, ligue as cadências e o **piloto automático**, e deixe um computador da equipe com o sistema aberto no horário comercial.

## 6. Confira depois de publicar

- [ ] O endereço abre com cadeado (HTTPS) e o painel carrega.
- [ ] Em Configurações, o cartão do e-mail mostra a conta conectada, a cota diária e se as reuniões terão Meet.
- [ ] Numa janela anônima, o endereço publicado mostra só a tela **Entrar**, e o código chega a ciquanta@secties.pb.gov.br.
- [ ] Um e-mail de teste (Campanhas → Enviar teste) chega com o logotipo no cabeçalho.
- [ ] Uma reunião de teste aparece no Google Agenda com link do Meet.
- [ ] "Visitas e cadastros" lê as planilhas do Painel CIQUANTA.
- [ ] Um segundo computador, com a base compartilhada ativa, mostra os mesmos dados.
- [ ] A Central de automação mostra a última coleta diária sem falhas.
- [ ] O navegador oferece "Instalar aplicativo" (opcional).

Se a conexão falhar, as causas mais comuns são: implantação sem "Qualquer pessoa" em quem pode acessar, serviço Gmail API não adicionado, ou código colado de outro computador (com outra chave). O manual traz a lista completa.

## 7. Quem enxerga o quê

- O site publicado contém só o programa, as bases públicas (mapeamento, notícias, editais, canais institucionais publicados pelas próprias organizações, dados da Receita e totais do Painel CIQUANTA) e as apresentações. **Nenhum dado do CRM fica no site.**
- Contatos, oportunidades, histórico e e-mails ficam no navegador de quem usa e, com a base compartilhada, em um arquivo no Google Drive da conta do CIQUANTA. Só quem entra com essa conta tem acesso.
- O site pede aos buscadores que não o indexem. Sem sessão aberta com o código enviado ao e-mail do CIQUANTA, o CRM mostra só a tela de entrada; para fechar também os arquivos do site, veja a camada 2 na seção 3.
- Cadências e respostas em tempo real funcionam enquanto o sistema estiver aberto em algum computador com a ponte conectada. Convém manter um computador da equipe com a aba aberta no horário comercial.

## 8. Atualizações

Toda mudança enviada à branch publicada entra no ar em seguida; os usuários recebem a versão nova na próxima abertura. Antes de publicar alterações nas bases de `data/`, rode `node tools/validar-dados.mjs`.
