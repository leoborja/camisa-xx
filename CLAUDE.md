# Camisa XX — contexto pro Claude

Sistema do tio do Leo, que vende e troca camisas de futebol de colecionador. **Leia o `README.md` antes de mexer**: ele tem a arquitetura, a operação e as pendências.

- Produção:
  - loja https://camisaxx.com.br;
  - admin https://admin.camisaxx.com.br;
  - Cloudflare Pages `camisa-xx` e `camisa-xx-loja`, D1 `camisa-xx`, KV `camisa-xx-fotos`.
- A senha do admin fica em `ACESSO.local.md`, que nunca vai pro git. É a mesma do admin da Dorê Joias (`~/dore-joias`).
- Regras do Leo:
  - **marca sem azul**;
  - nada de Supabase;
  - tudo no plano grátis;
  - testar localmente antes de publicar (`wrangler pages dev`), em porta livre, porque 8080, 8081, 8090, 8095, 8788 e 8789 costumam estar ocupadas;
  - responder curto, em português.
- Banco: mudança só por migração em `cloudflare/`, sempre só acrescentando. As camisas de exemplo saem com `cloudflare/remover-exemplos.sql` (por id). A #0001 é real.
- DNS e domínios: usar o token `~/.cf-token-dns` (nunca imprimir). O OAuth do wrangler não edita DNS.
- Depois de mudar algo: `./deploy.sh` (admin) e/ou `loja/deploy.sh` (loja), depois commit e push.
