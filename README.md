# Camisa XX

Sistema do Camisa XX: camisas de futebol de colecionador dos anos 80, 90 e 2000, vendidas e trocadas.

| | Endereço | Pasta | Projeto Cloudflare Pages |
|---|---|---|---|
| **Admin** (uso interno, com senha) | https://admin.camisaxx.com.br | raiz | `camisa-xx` |
| **Loja pública** | https://camisaxx.com.br | `loja/` | `camisa-xx-loja` |

O admin também funciona em https://camisa-xx.pages.dev. O endereço antigo da loja (camisa-xx-loja.pages.dev) redireciona pro domínio. O GitHub Pages deste repositório (branch `gh-pages`) só redireciona pro admin.

**Marca:** carimbo "CAMISA XX · 1983" com camisa listrada verde e creme (`logo/final/`). Paleta: carvão `#1E1A17`, verde-garrafa `#1F4632`, creme `#EFE2C4` e papel `#F4EEE2`. **Sem azul.**

## Como funciona

- HTML, CSS e JavaScript puro (ES modules), sem build. É mobile-first, porque o dono usa iPhone.
- Tudo roda no **plano gratuito do Cloudflare**:
  - **Pages** serve os sites;
  - **Pages Functions** é a API;
  - **D1** (banco `camisa-xx`) guarda os dados;
  - **KV** (`camisa-xx-fotos`) guarda as fotos.
- O admin descobre o backend sozinho. Se `/api/saude` responde, usa o Cloudflare. Senão, roda em **modo demonstração**, com os dados só no aparelho (IndexedDB), como acontece quando roda local sem o wrangler.
- **Login** só por senha. Os segredos `APP_SENHA` e `SESSAO_SEGREDO` ficam no projeto Pages e o cookie dura 180 dias. A senha atual está em `ACESSO.local.md` (fora do git).
- A **loja** gera as páginas no servidor (`loja/functions/[[path]].js`), o que dá SEO e prévia com foto no WhatsApp. Ela lê o mesmo D1 e KV, mas **só colunas públicas** e só camisas com `publicada = 1`. Custo, origem, comprador e valor de venda nunca saem dela.

## Funções

**Admin**
- Acervo com busca, filtros e grade de fotos. As fotos são reduzidas no celular, com 1600 px e miniatura de 480 px.
- Cadastro de camisa com clube, temporada, modelo, marca, tamanho, autenticidade, estado, compra, venda e chave "Mostrar na loja".
- Detalhe da camisa com preço, custo e lucro, mudança rápida de status e "Registrar venda". A venda cria o contato do comprador.
- No "⋯" da camisa: compartilhar o link da loja, legenda pronta pro Instagram, etiqueta com QR pra imprimir, avisar interessados no WhatsApp e registrar troca.
- **Contatos**, que são clientes e fornecedores com WhatsApp, Instagram, cidade e o campo "Curte". Cada contato tem o histórico de compras, vendas e trocas.
- **Trocas (escambo):** camisas que saem + dinheiro ± = camisas que entram. A que sai vira "vendida", com canal Troca e o valor combinado. A que entra tem como custo o valor combinado.
- **Ofertas**, que chegam pela loja: chamar no WhatsApp, recusar ou aceitar. Aceitar cria a camisa com as fotos e cria o contato fornecedor.
- **Painel:** estoque investido, vendas e lucro do mês, os últimos 6 meses e peças paradas há mais de 90 dias.
- Exportar planilha em CSV, no formato do Excel brasileiro.

**Loja**
- Vitrine com busca, filtros de disponibilidade, década e tamanho, e ordenação por preço. Tem os selos "Chegou agora", "Reservada", "Vendida" e "Exemplo".
- Página de cada camisa em `/camisa/<numero>-<slug>`, com botão **"Quero essa camisa"** que abre o WhatsApp com a mensagem pronta.
- "Procura uma camisa específica?", que monta um pedido e abre o WhatsApp.
- "Tem uma camisa guardada?": formulário com até 5 fotos, que vai pra tabela `ofertas`. Tem proteção contra robô e um limite de 5 envios por IP por dia. A página `/oferta/<id>` mostra só as fotos e os dados da camisa.
- `sitemap.xml`, `robots.txt` e tags de prévia (Open Graph).
- GA4 pronto: basta preencher `GA4_ID` em `loja/wrangler.toml`. Eventos: `generate_lead` (whatsapp, procuro e formulário) e `view_item`.

## Operação

```bash
./deploy.sh
```
Publica o admin.

```bash
loja/deploy.sh
```
Publica a loja. O WhatsApp, o Instagram e o GA4 ficam em `loja/wrangler.toml` › `[vars]`.

**Banco:** o esquema base está em `cloudflare/schema.sql`, e as mudanças vão em migrações (`cloudflare/migracao-*.sql`), sempre só acrescentando. Pra aplicar:
```bash
npx wrangler d1 execute camisa-xx --remote --file cloudflare/<arquivo>.sql
```

**Trocar a senha:** troque o segredo e publique de novo.
```bash
npx wrangler pages secret put APP_SENHA --project-name camisa-xx
```
```bash
./deploy.sh
```

**Testar local com banco de teste:** crie `.dev.vars` com `APP_SENHA` e `SESSAO_SEGREDO` de teste. Os servidores ficam assim:
- Admin: copie os arquivos pra `dist/` e rode `npx wrangler pages dev dist --port 8788`.
- Loja: dentro de `loja/`, rode `npx wrangler pages dev public --port 8789 --persist-to ../.wrangler/state`.

**DNS e domínios:** o login do `wrangler` (OAuth) **não edita DNS**. Pra isso use o token `~/.cf-token-dns`, que tem DNS Edit, Zone Read e Pages Edit e vale pra todas as zonas. Os registros são CNAMEs com proxy:
- `@` e `www` → `camisa-xx-loja.pages.dev`
- `admin` → `camisa-xx.pages.dev`

**Backup:** toda segunda às 9h, o LaunchAgent `com.camisaxx.backup` roda `~/.camisa-xx/backup.sh`, cuja cópia versionada está em `backup/backup.sh`. Ele grava no **iCloud Drive › Backups › Camisa XX**:
- o banco em `.sql`, mantendo os 12 últimos;
- todas as fotos do KV, baixando só as novas a cada vez.

Os erros vão pro `backup.log`, com uma notificação no Mac. O D1 também guarda 7 dias de histórico no próprio Cloudflare.

## Pendências

- Preencher o **ID do GA4** (G-…) e publicar a loja.
- Remover as **8 camisas de exemplo** (#0002 a #0009) quando houver camisas reais, com o arquivo `cloudflare/remover-exemplos.sql`, que apaga pelo id. A #0001 é real. Nunca apague pelo texto "Exemplo de demonstração".
- Redesenhar o carimbo em vetor. Hoje ele é uma imagem gerada por IA.
- Ideias pra depois: foto com fundo padronizado; página "Sobre"; fase 3, o marketplace, com outros vendedores (a coluna `owner_id` já existe).

## Projeto irmão

**Dorê Joias**, a loja de joias da tia, usa o mesmo código adaptado, numa instalação separada: https://dorejoias.com.br. O código fica em `~/dore-joias` (repositório `leoborja/dore-joias`).
