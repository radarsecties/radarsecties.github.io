# Como publicar o CRM do CIQUANTA

O sistema é um site estático: não tem servidor, banco de dados nem etapa de compilação. Publicar é colocar o conteúdo desta pasta em um endereço HTTPS e autorizar esse endereço no Google.

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

## 2. Autorize o endereço no Google (uma vez, cerca de 15 minutos)

Faça com a conta institucional do CIQUANTA.

1. Em [console.cloud.google.com](https://console.cloud.google.com/), crie um projeto, por exemplo "CIQUANTA CRM".
2. Em **APIs e serviços → Biblioteca**, ative: Gmail API, Google Calendar API, Google Drive API e Google Sheets API.
3. Em **Tela de consentimento OAuth**, escolha **Interno** se a conta for do Google Workspace da SECTIES. Com conta Gmail comum, escolha Externo e cadastre os e-mails da equipe como usuários de teste; nesse caso o Google mostra o aviso de "app não verificado" no login.
4. Em **Credenciais → Criar credenciais → ID do cliente OAuth**, tipo **Aplicativo da Web**. Em **Origens JavaScript autorizadas**, informe a origem do endereço publicado, sem caminho: por exemplo `https://crm.ciquanta.secties.pb.gov.br` ou `https://<organização>.github.io`.
5. Copie o **ID do cliente**. Não existe chave secreta a guardar.

## 3. Configure o sistema no primeiro acesso

1. Abra o endereço publicado e vá em **Configurações**.
2. Cole o ID do cliente, marque as permissões e clique em **Conectar conta Google**.
3. Preencha **Remetente e assinatura**. Em **Endereço público do sistema**, informe o endereço publicado: ele é usado nas imagens dos e-mails e nos links das apresentações.
4. Ative **Base compartilhada** para que todos os computadores trabalhem sobre os mesmos dados. Em cada computador, basta abrir o endereço, colar o mesmo ID do cliente, conectar a mesma conta e ativar a opção.
5. Em **Busca ativa**, importe o mapeamento. Em **Captação**, defina as metas. O painel mostra os "Primeiros passos" até tudo estar pronto.

## 4. Confira depois de publicar

- [ ] O endereço abre com cadeado (HTTPS) e o painel carrega.
- [ ] Em Configurações, a conta conecta e aparecem as permissões concedidas.
- [ ] Um e-mail de teste (Campanhas → Enviar teste) chega com o logotipo no cabeçalho.
- [ ] Uma reunião de teste aparece no Google Agenda com link do Meet.
- [ ] "Visitas e cadastros" lê as planilhas do Painel CIQUANTA.
- [ ] Um segundo computador, com a base compartilhada ativa, mostra os mesmos dados.
- [ ] O navegador oferece "Instalar aplicativo" (opcional).

Se o login do Google falhar depois da publicação, a causa mais comum é a origem não estar cadastrada exatamente como aparece na barra de endereços (passo 2.4).

## 5. Quem enxerga o quê

- O site publicado contém só o programa, o mapeamento público de organizações e as apresentações. **Nenhum dado do CRM fica no site.**
- Contatos, oportunidades, histórico e e-mails ficam no navegador de quem usa e, com a base compartilhada, em um arquivo no Google Drive da conta do CIQUANTA. Só quem entra com essa conta tem acesso.
- O site pede aos buscadores que não o indexem. Para restringir também a abertura da página, use um controle de acesso na frente do endereço (por exemplo, o proxy de autenticação da TI).
- Cadências e respostas em tempo real funcionam enquanto o sistema estiver aberto em algum computador com a conta conectada. Convém manter um computador da equipe com a aba aberta no horário comercial.

## 6. Atualizações

Toda mudança enviada à branch publicada entra no ar em seguida; os usuários recebem a versão nova na próxima abertura. Antes de publicar alterações nas bases de `data/`, rode `node tools/validar-dados.mjs`.
