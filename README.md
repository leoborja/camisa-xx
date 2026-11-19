# Camisa XX — acervo de camisas

Site mobile-first (feito pro iPhone) pra gerir um acervo de camisas de futebol de colecionador: o que foi comprado, quando, por quanto, fotos, autenticidade, status de venda e lucro.

**Marca:** logo 02 "número nas costas" (azul royal `#1d3fa6` + branco). Vetor em `icons/marca.svg` e em `js/icones.js` (`marcaIcone`, `marcaCompleta`); ícones do iPhone em `icons/`.

**Fase 1 (agora):** gestão do acervo. **Fase 2:** loja pública lendo do mesmo banco. **Fase 3:** marketplace (cada camisa já tem `owner_id`).

## Como funciona

- HTML + CSS + JavaScript puro (módulos ES), sem build. Roda em qualquer hospedagem estática (GitHub Pages).
- **Modo demonstração** (padrão enquanto `js/config.js` estiver vazio): os dados ficam só no aparelho (IndexedDB), sem login, e a primeira visita já abre com 6 camisas de exemplo.
- **Modo real**: com o Supabase configurado, os dados e as fotos ficam na nuvem e o acesso exige login.

## Telas

| Rota | Tela |
|---|---|
| `#acervo` | Grade de camisas: busca, filtro por status, ordenação |
| `#nova` / `#editar-<id>` | Cadastro: fotos primeiro, só o clube é obrigatório; o rascunho fica salvo enquanto digita |
| `#c-<id>` | Detalhe: galeria, preço/custo/lucro, ficha, mudança rápida de status, registrar venda |
| `#painel` | Estoque investido, vendas e lucro do mês, últimos 6 meses, peças paradas há mais de 90 dias |
| `#ajustes` | Conta, exportar planilha (CSV pro Excel), instruções pra instalar no iPhone |

As fotos são reduzidas no próprio celular antes de salvar: a versão grande tem 1600px e a miniatura 480px, ambas em JPEG.

## Ativar o banco (Supabase)

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
