# Camisa XX — acervo de camisas

Site mobile-first (feito pro iPhone) pra gerir um acervo de camisas de futebol de colecionador: o que foi comprado, quando, por quanto, fotos, autenticidade, status de venda e lucro.

**Marca:** carimbo de colecionador "CAMISA XX · 1983" com camisa listrada verde e creme. Paleta: carvão `#1E1A17`, verde-garrafa `#1F4632`, creme `#EFE2C4`, papel `#F4EEE2`. **Nunca azul.** Originais em `logo/final/` (fora do git); ícones em `icons/`.

**Fase 1 (agora):** gestão do acervo. **Fase 2:** loja pública lendo do mesmo banco. **Fase 3:** marketplace (cada camisa já tem `owner_id`).

## Como funciona

- HTML + CSS + JavaScript puro (módulos ES), sem build. Roda em qualquer hospedagem estática (GitHub Pages).
- **Modo demonstração** (padrão enquanto `js/config.js` estiver vazio): os dados ficam só no aparelho (IndexedDB), sem login, e a primeira visita já abre com 6 camisas de exemplo.
- **Produção: Cloudflare** — https://camisa-xx.pages.dev. Pages serve o site; `functions/api/[[rota]].js` é a API; dados no **D1** (`camisa-xx`), fotos no **KV** (`camisa-xx-fotos`); login por senha (segredos `APP_SENHA` e `SESSAO_SEGREDO`). Tudo no plano gratuito.
- O site descobre sozinho onde está: se `/api/saude` responde, usa o Cloudflare; senão, cai no modo demonstração (local, GitHub Pages). O Supabase (`supabase/`, `js/store/supabase.js`) ficou como alternativa, desligado.

## Telas

| Rota | Tela |
|---|---|
| `#acervo` | Grade de camisas: busca, filtro por status, ordenação |
| `#nova` / `#editar-<id>` | Cadastro: fotos primeiro, só o clube é obrigatório; o rascunho fica salvo enquanto digita |
| `#c-<id>` | Detalhe: galeria, preço/custo/lucro, ficha, mudança rápida de status, registrar venda |
| `#painel` | Estoque investido, vendas e lucro do mês, últimos 6 meses, peças paradas há mais de 90 dias |
| `#ajustes` | Conta, exportar planilha (CSV pro Excel), instruções pra instalar no iPhone |

As fotos são reduzidas no próprio celular antes de salvar: a versão grande tem 1600px e a miniatura 480px, ambas em JPEG.

## Publicar no Cloudflare

```bash
./deploy.sh
```

Banco: `cloudflare/schema.sql` (já aplicado). Senha e como trocá-la: `ACESSO.local.md` (só local, fora do git). Testar local com banco de mentira: `npx wrangler pages dev dist --port 8788` (senha em `.dev.vars`).

## Alternativa: Supabase (desligado)

1. Crie um projeto em supabase.com (região São Paulo).
2. No **SQL Editor**, rode o arquivo `supabase/schema.sql` inteiro. Ele cria as tabelas, as regras de segurança (RLS) e o bucket `fotos`.
3. Em **Authentication → Users**, crie o usuário do tio (e-mail e senha) e desative "Allow new users to sign up" pra ninguém mais criar conta.
4. Em **Settings → API**, copie a URL e a `anon key` e coloque em `js/config.js`.
5. Publique. A partir daí o site pede login.

## Rodar local

```bash
python3 -m http.server 8095
```

Depois abra http://localhost:8095.
