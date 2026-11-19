-- Migração 002 (19/11/2026): contatos (clientes e fornecedores), trocas e ofertas recebidas pela loja.
-- Só ADICIONA tabelas e colunas; não mexe em dado existente.

CREATE TABLE IF NOT EXISTS contatos (
  id           TEXT PRIMARY KEY,
  owner_id     TEXT NOT NULL DEFAULT 'dono',
  nome         TEXT NOT NULL,
  whatsapp     TEXT,              -- só dígitos, com DDD (55 opcional)
  instagram    TEXT,
  cidade       TEXT,
  tipo         TEXT NOT NULL DEFAULT 'cliente' CHECK (tipo IN ('cliente','fornecedor','ambos')),
  interesses   TEXT,              -- clubes/épocas que a pessoa curte: "Flamengo, Seleção, anos 90"
  observacoes  TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS contatos_nome_idx ON contatos (owner_id, nome);

-- Troca (escambo): ele entrega camisa(s), recebe camisa(s), com dinheiro pra um lado ou outro.
-- dinheiro > 0 = ele pagou a diferença · dinheiro < 0 = ele recebeu a diferença
CREATE TABLE IF NOT EXISTS trocas (
  id           TEXT PRIMARY KEY,
  owner_id     TEXT NOT NULL DEFAULT 'dono',
  data         TEXT NOT NULL,
  contato_id   TEXT REFERENCES contatos(id) ON DELETE SET NULL,
  dinheiro     REAL NOT NULL DEFAULT 0,
  observacoes  TEXT,
  created_at   TEXT NOT NULL
);

ALTER TABLE camisas ADD COLUMN fornecedor_id TEXT;      -- de quem comprou (contato)
ALTER TABLE camisas ADD COLUMN comprador_id TEXT;       -- pra quem vendeu (contato)
ALTER TABLE camisas ADD COLUMN troca_entrada_id TEXT;   -- chegou numa troca
ALTER TABLE camisas ADD COLUMN troca_saida_id TEXT;     -- saiu numa troca

-- Ofertas recebidas pelo formulário "Tem uma camisa guardada?" da loja.
-- Fotos no KV: o:<id>:<n> (grande) e ot:<id>:<n> (miniatura).
CREATE TABLE IF NOT EXISTS ofertas (
  id              TEXT PRIMARY KEY,
  owner_id        TEXT NOT NULL DEFAULT 'dono',
  nome            TEXT NOT NULL,
  whatsapp        TEXT NOT NULL,
  cidade          TEXT,
  clube           TEXT NOT NULL,
  temporada       TEXT,
  tamanho         TEXT,
  conservacao     TEXT,
  intencao        TEXT NOT NULL DEFAULT 'vender' CHECK (intencao IN ('vender','trocar','tanto_faz')),
  preco_desejado  REAL,
  mensagem        TEXT,
  fotos           INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'nova' CHECK (status IN ('nova','em_conversa','aceita','recusada')),
  contato_id      TEXT,
  camisa_id       TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ofertas_status_idx ON ofertas (owner_id, status, created_at);
