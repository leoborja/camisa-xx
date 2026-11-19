-- ============================================================
-- Manto · acervo de camisas — schema do Supabase
-- Rodar inteiro no SQL Editor de um projeto novo (uma vez só).
--
-- Princípio: cada camisa e cada foto têm um DONO (owner_id).
-- Hoje só existe um dono (o tio). Quando virar marketplace,
-- outros vendedores entram com a mesma estrutura, sem migração.
-- ============================================================

-- ---------- Camisas ----------
create table if not exists public.camisas (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  numero          bigint generated always as identity,   -- código humano (#0012) pra etiqueta física

  -- A camisa
  clube           text not null,
  temporada       text,              -- "1994" ou "1994/95"
  ano             int,               -- extraído da temporada (filtro por década)
  modelo          text check (modelo in ('titular','reserva','terceira','goleiro','treino','comemorativa','outra')),
  marca           text,
  patrocinio      text,
  tamanho         text,
  manga           text check (manga in ('curta','longa')),
  jogador         text,
  numero_camisa   text,

  -- Autenticidade
  tipo            text check (tipo in ('torcedor','jogador','jogo')),
  codigo_produto  text,              -- código da etiqueta interna
  procedencia     text,
  certificado     boolean not null default false,

  -- Estado
  conservacao     text check (conservacao in ('nova','excelente','muito_boa','boa','regular','ruim')),
  defeitos        text,

  -- Compra
  data_compra     date,
  valor_compra    numeric(12,2),
  custos_extras   numeric(12,2),
  origem          text,              -- de quem / onde comprou

  -- Venda
  status          text not null default 'estoque'
                  check (status in ('estoque','anunciada','reservada','vendida','colecao')),
  preco_pedido    numeric(12,2),
  data_venda      date,
  valor_venda     numeric(12,2),
  canal_venda     text,
  comprador       text,

  observacoes     text,
  publicada       boolean not null default false,   -- fase 2: aparece na loja

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists camisas_owner_idx  on public.camisas (owner_id, created_at desc);
create index if not exists camisas_status_idx on public.camisas (owner_id, status);

-- ---------- Fotos ----------
create table if not exists public.fotos (
  id          uuid primary key default gen_random_uuid(),
  camisa_id   uuid not null references public.camisas(id) on delete cascade,
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  path        text not null,        -- foto grande (até 1600px)
  thumb_path  text,                 -- miniatura (480px) pra listagem
  ordem       int  not null default 0,   -- 0 = capa
  created_at  timestamptz not null default now()
);

create index if not exists fotos_camisa_idx on public.fotos (camisa_id, ordem);

-- ---------- updated_at automático ----------
create or replace function public.tocar_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists camisas_updated_at on public.camisas;
create trigger camisas_updated_at before update on public.camisas
  for each row execute function public.tocar_updated_at();

-- ---------- Segurança (RLS): cada um só vê e mexe no que é seu ----------
alter table public.camisas enable row level security;
alter table public.fotos   enable row level security;

drop policy if exists "camisas: dono" on public.camisas;
create policy "camisas: dono" on public.camisas
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "fotos: dono" on public.fotos;
create policy "fotos: dono" on public.fotos
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- ---------- Armazenamento das fotos ----------
-- Bucket público pra LEITURA (os links têm UUID, não dá pra adivinhar) —
-- isso deixa a loja da fase 2 simples. Escrita só na pasta do próprio dono.
-- Dados de compra/margem ficam no banco, nunca nas fotos.
insert into storage.buckets (id, name, public)
values ('fotos', 'fotos', true)
on conflict (id) do nothing;

drop policy if exists "fotos storage: dono envia"  on storage.objects;
drop policy if exists "fotos storage: dono altera" on storage.objects;
drop policy if exists "fotos storage: dono apaga"  on storage.objects;

create policy "fotos storage: dono envia" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "fotos storage: dono altera" on storage.objects
  for update to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "fotos storage: dono apaga" on storage.objects
  for delete to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);
