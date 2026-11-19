-- Camisa XX · banco D1 (SQLite no Cloudflare)
-- Fotos ficam no KV (binding FOTOS), aqui só a referência e a ordem.
-- owner_id já existe pra quando virar marketplace (hoje é sempre 'dono').

CREATE TABLE IF NOT EXISTS camisas (
  id              TEXT PRIMARY KEY,
  numero          INTEGER NOT NULL,
  owner_id        TEXT NOT NULL DEFAULT 'dono',

  clube           TEXT NOT NULL,
  temporada       TEXT,
  ano             INTEGER,
  modelo          TEXT CHECK (modelo IN ('titular','reserva','terceira','goleiro','treino','comemorativa','outra')),
  marca           TEXT,
  patrocinio      TEXT,
  tamanho         TEXT,
  manga           TEXT CHECK (manga IN ('curta','longa')),
  jogador         TEXT,
  numero_camisa   TEXT,

  tipo            TEXT CHECK (tipo IN ('torcedor','jogador','jogo')),
  codigo_produto  TEXT,
  procedencia     TEXT,
  certificado     INTEGER NOT NULL DEFAULT 0,

  conservacao     TEXT CHECK (conservacao IN ('nova','excelente','muito_boa','boa','regular','ruim')),
  defeitos        TEXT,

  data_compra     TEXT,
  valor_compra    REAL,
  custos_extras   REAL,
  origem          TEXT,

  status          TEXT NOT NULL DEFAULT 'estoque' CHECK (status IN ('estoque','anunciada','reservada','vendida','colecao')),
  preco_pedido    REAL,
  data_venda      TEXT,
  valor_venda     REAL,
  canal_venda     TEXT,
  comprador       TEXT,

  observacoes     TEXT,
  publicada       INTEGER NOT NULL DEFAULT 0,

  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS camisas_numero_idx ON camisas (owner_id, numero);
CREATE INDEX IF NOT EXISTS camisas_criadas_idx ON camisas (created_at);

CREATE TABLE IF NOT EXISTS fotos (
  id          TEXT PRIMARY KEY,
  camisa_id   TEXT NOT NULL REFERENCES camisas(id) ON DELETE CASCADE,
  ordem       INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS fotos_camisa_idx ON fotos (camisa_id, ordem);
