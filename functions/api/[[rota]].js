// API do Camisa XX — Cloudflare Pages Functions.
// Bindings: DB (D1, dados) · FOTOS (KV, imagens) · segredos APP_SENHA e SESSAO_SEGREDO.
//
// Rotas (todas sob /api):
//   GET  /saude                       público — o site usa pra saber que tem banco
//   POST /login {senha}               público — cria a sessão (cookie)
//   POST /logout
//   GET  /fotos/:id[?t=1]             público — imagem (t=1 = miniatura)
//   GET  /eu                          sessão
//   GET  /camisas · POST /camisas
//   GET|PUT|DELETE /camisas/:id
//   POST /camisas/:id/fotos (multipart full, thumb, ordem)
//   PUT  /camisas/:id/fotos/ordem {ids}
//   DELETE /fotos/:id

const CAMPOS = [
  'clube', 'temporada', 'ano', 'modelo', 'marca', 'patrocinio', 'tamanho', 'manga', 'jogador', 'numero_camisa',
  'tipo', 'codigo_produto', 'procedencia', 'certificado',
  'conservacao', 'defeitos',
  'data_compra', 'valor_compra', 'custos_extras', 'origem',
  'status', 'preco_pedido', 'data_venda', 'valor_venda', 'canal_venda', 'comprador',
  'observacoes', 'publicada', 'fornecedor_id', 'comprador_id',
];
const NUMEROS = new Set(['ano', 'valor_compra', 'custos_extras', 'preco_pedido', 'valor_venda']);
const BOOLEANOS = new Set(['certificado', 'publicada']);
const COOKIE = 'cxx_sessao';
const SESSAO_DIAS = 180;
const MAX_FOTO = 4 * 1024 * 1024;
// Origens que podem chamar a API de fora (site de demonstração transferindo camisas pro oficial)
const ORIGENS_TRANSFERENCIA = new Set(['https://leoborja.github.io', 'http://localhost:8095']);
const CABECALHO_SENHA = 'x-camisa-senha';

function comCors(resp, origem) {
  if (!ORIGENS_TRANSFERENCIA.has(origem)) return resp;
  const r = new Response(resp.body, resp);
  r.headers.set('access-control-allow-origin', origem);
  r.headers.set('access-control-allow-methods', 'GET, POST, PUT, DELETE, OPTIONS');
  r.headers.set('access-control-allow-headers', `content-type, ${CABECALHO_SENHA}`);
  r.headers.set('access-control-max-age', '600');
  r.headers.append('vary', 'origin');
  return r;
}

const json = (dados, status = 200, extra = {}) => new Response(JSON.stringify(dados), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra },
});
const erro = (mensagem, status = 400) => json({ erro: mensagem }, status);
const agora = () => new Date().toISOString();

// ---------- sessão (cookie assinado com HMAC; trocar a senha derruba todas as sessões) ----------
const enc = new TextEncoder();
async function hmac(segredo, msg) {
  const chave = await crypto.subtle.importKey('raw', enc.encode(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', chave, enc.encode(msg)));
  let s = '';
  for (const b of sig) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function iguais(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
const segredoSessao = (env) => `${env.SESSAO_SEGREDO}|${env.APP_SENHA}`;
async function novaSessao(env) {
  const exp = String(Date.now() + SESSAO_DIAS * 86400000);
  return `${exp}.${await hmac(segredoSessao(env), exp)}`;
}
async function sessaoValida(request, env) {
  const m = (request.headers.get('cookie') || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (!m) return false;
  const [exp, sig] = m[1].split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return iguais(sig, await hmac(segredoSessao(env), exp));
}
const cookie = (valor, maxAge) => `${COOKIE}=${valor}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;

// ---------- conversões ----------
function limpar(corpo) {
  const linha = {};
  for (const k of CAMPOS) {
    if (!(k in corpo)) continue;
    let v = corpo[k];
    if (BOOLEANOS.has(k)) v = v ? 1 : 0;
    else if (v === '' || v === undefined) v = null;
    else if (NUMEROS.has(k) && v !== null) { v = Number(v); if (!Number.isFinite(v)) v = null; }
    else if (v !== null) v = String(v).trim().slice(0, 4000) || null;
    linha[k] = v;
  }
  return linha;
}
const saida = (c, fotos = []) => ({ ...c, certificado: !!c.certificado, publicada: !!c.publicada, fotos });

async function fotosPorCamisa(env, ids) {
  if (!ids.length) return {};
  const { results } = await env.DB.prepare('SELECT id, camisa_id, ordem FROM fotos ORDER BY ordem').all();
  const por = {};
  for (const f of results) (por[f.camisa_id] ||= []).push(f);
  return por;
}

// ---------- handlers ----------
async function listar(env) {
  const { results } = await env.DB.prepare('SELECT * FROM camisas ORDER BY created_at DESC').all();
  const por = await fotosPorCamisa(env, results.map((c) => c.id));
  return json(results.map((c) => saida(c, por[c.id] || [])));
}

async function obter(env, id) {
  const c = await env.DB.prepare('SELECT * FROM camisas WHERE id = ?').bind(id).first();
  if (!c) return erro('Camisa não encontrada.', 404);
  const { results } = await env.DB.prepare('SELECT id, camisa_id, ordem FROM fotos WHERE camisa_id = ? ORDER BY ordem').bind(id).all();
  const extra = {};
  const nomeDe = async (cid) => (cid ? (await env.DB.prepare('SELECT id, nome, whatsapp FROM contatos WHERE id = ?').bind(cid).first()) : null);
  extra.fornecedor = await nomeDe(c.fornecedor_id);
  extra.comprador_contato = await nomeDe(c.comprador_id);
  for (const [campo, chave] of [['troca_entrada_id', 'troca_entrada'], ['troca_saida_id', 'troca_saida']]) {
    if (!c[campo]) continue;
    const t = await env.DB.prepare('SELECT * FROM trocas WHERE id = ?').bind(c[campo]).first();
    if (!t) continue;
    const { results: outras } = await env.DB.prepare('SELECT id, numero, clube, temporada, valor_compra, valor_venda, troca_entrada_id, troca_saida_id FROM camisas WHERE (troca_entrada_id = ?1 OR troca_saida_id = ?1) AND id <> ?2').bind(t.id, c.id).all();
    extra[chave] = { ...t, contato: await nomeDe(t.contato_id), outras };
  }
  return json({ ...saida(c, results), ...extra });
}

async function criar(env, corpo) {
  const linha = limpar(corpo);
  if (!linha.clube) return erro('Preencha o clube ou seleção.');
  const id = crypto.randomUUID();
  const t = agora();
  const cols = Object.keys(linha);
  const sql = `INSERT INTO camisas (id, numero, created_at, updated_at${cols.map((k) => `, ${k}`).join('')})
    VALUES (?, (SELECT COALESCE(MAX(numero), 0) + 1 FROM camisas WHERE owner_id = 'dono'), ?, ?${cols.map(() => ', ?').join('')})`;
  await env.DB.prepare(sql).bind(id, t, t, ...cols.map((k) => linha[k])).run();
  return obter(env, id);
}

async function atualizar(env, id, corpo) {
  const linha = limpar(corpo);
  if ('clube' in linha && !linha.clube) return erro('Preencha o clube ou seleção.');
  const cols = Object.keys(linha);
  if (cols.length) {
    const r = await env.DB.prepare(`UPDATE camisas SET ${cols.map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`)
      .bind(...cols.map((k) => linha[k]), agora(), id).run();
    if (!r.meta.changes) return erro('Camisa não encontrada.', 404);
  }
  return obter(env, id);
}

async function apagarImagens(env, ids) {
  await Promise.all(ids.flatMap((id) => [env.FOTOS.delete(`f:${id}`), env.FOTOS.delete(`t:${id}`)]));
}

async function excluir(env, id) {
  const { results } = await env.DB.prepare('SELECT id FROM fotos WHERE camisa_id = ?').bind(id).all();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM fotos WHERE camisa_id = ?').bind(id),
    env.DB.prepare('DELETE FROM camisas WHERE id = ?').bind(id),
  ]);
  await apagarImagens(env, results.map((f) => f.id));
  return json({ ok: true });
}

async function adicionarFoto(env, camisaId, request) {
  const existe = await env.DB.prepare('SELECT 1 FROM camisas WHERE id = ?').bind(camisaId).first();
  if (!existe) return erro('Camisa não encontrada.', 404);
  const form = await request.formData();
  const full = form.get('full');
  const thumb = form.get('thumb');
  if (!full || typeof full === 'string') return erro('Foto não recebida.');
  if (full.size > MAX_FOTO) return erro('Foto grande demais.');
  const id = crypto.randomUUID();
  await env.FOTOS.put(`f:${id}`, await full.arrayBuffer());
  if (thumb && typeof thumb !== 'string') await env.FOTOS.put(`t:${id}`, await thumb.arrayBuffer());
  const ordem = Number(form.get('ordem')) || 0;
  await env.DB.prepare('INSERT INTO fotos (id, camisa_id, ordem, created_at) VALUES (?, ?, ?, ?)').bind(id, camisaId, ordem, agora()).run();
  return json({ id, camisa_id: camisaId, ordem });
}

async function removerFoto(env, id) {
  await env.DB.prepare('DELETE FROM fotos WHERE id = ?').bind(id).run();
  await apagarImagens(env, [id]);
  return json({ ok: true });
}

async function ordenarFotos(env, camisaId, corpo) {
  const ids = Array.isArray(corpo.ids) ? corpo.ids.slice(0, 50) : [];
  if (ids.length) {
    await env.DB.batch(ids.map((id, i) => env.DB.prepare('UPDATE fotos SET ordem = ? WHERE id = ? AND camisa_id = ?').bind(i, String(id), camisaId)));
  }
  return json({ ok: true });
}

async function servirFoto(env, id, miniatura) {
  let corpo = miniatura ? await env.FOTOS.get(`t:${id}`, { type: 'stream' }) : null;
  if (!corpo) corpo = await env.FOTOS.get(`f:${id}`, { type: 'stream' });
  if (!corpo) return new Response('Foto não encontrada', { status: 404 });
  return new Response(corpo, {
    headers: { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=31536000, immutable' },
  });
}

const senhaConfere = async (senha, env) =>
  typeof senha === 'string' && senha.length > 0 && iguais(await hmac('cmp', senha), await hmac('cmp', env.APP_SENHA));

// Sessão do navegador (cookie) ou senha no cabeçalho (usada só pela transferência do site de demonstração)
async function autorizado(request, env) {
  if (await sessaoValida(request, env)) return true;
  const senha = request.headers.get(CABECALHO_SENHA);
  if (senha === null) return false;
  if (await senhaConfere(senha, env)) return true;
  await new Promise((r) => setTimeout(r, 600));
  return false;
}


// ---------- contatos (clientes e fornecedores) ----------
const CAMPOS_CONTATO = ['nome', 'whatsapp', 'instagram', 'cidade', 'tipo', 'interesses', 'observacoes'];
const soDigitos = (v) => String(v || '').replace(/\D/g, '') || null;
const normaliza = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const anoDe = (t) => { const m = String(t || '').match(/(19|20)\d{2}/); return m ? Number(m[0]) : null; };

function limparContato(corpo) {
  const l = {};
  for (const k of CAMPOS_CONTATO) {
    if (!(k in corpo)) continue;
    let v = corpo[k] == null || corpo[k] === '' ? null : String(corpo[k]).trim().slice(0, 2000) || null;
    if (k === 'whatsapp') v = soDigitos(v);
    if (k === 'instagram' && v) v = v.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/[/?#].*$/, '') || null;
    if (k === 'tipo' && !['cliente', 'fornecedor', 'ambos'].includes(v)) v = 'cliente';
    l[k] = v;
  }
  return l;
}
function insertContato(env, id, l, t) {
  const cols = Object.keys(l);
  return env.DB.prepare(`INSERT INTO contatos (id, created_at, updated_at${cols.map((k) => `, ${k}`).join('')}) VALUES (?, ?, ?${cols.map(() => ', ?').join('')})`)
    .bind(id, t, t, ...cols.map((k) => l[k]));
}

async function listarContatos(env) {
  const { results } = await env.DB.prepare(`SELECT c.*,
      (SELECT COUNT(*) FROM camisas WHERE comprador_id = c.id) AS compras,
      (SELECT COUNT(*) FROM camisas WHERE fornecedor_id = c.id) AS fornecidas,
      (SELECT COUNT(*) FROM trocas WHERE contato_id = c.id) AS trocas
    FROM contatos c ORDER BY c.nome COLLATE NOCASE`).all();
  return json(results);
}
async function obterContato(env, id) {
  const c = await env.DB.prepare('SELECT * FROM contatos WHERE id = ?').bind(id).first();
  if (!c) return erro('Contato não encontrado.', 404);
  const { results: camisas } = await env.DB.prepare(`SELECT id, numero, clube, temporada, status, valor_venda, valor_compra, data_venda, data_compra,
      comprador_id, fornecedor_id, troca_entrada_id, troca_saida_id
    FROM camisas WHERE comprador_id = ?1 OR fornecedor_id = ?1 ORDER BY COALESCE(data_venda, data_compra, created_at) DESC`).bind(id).all();
  const { results: trocas } = await env.DB.prepare('SELECT * FROM trocas WHERE contato_id = ? ORDER BY data DESC').bind(id).all();
  return json({ ...c, camisas, trocas });
}
async function criarContato(env, corpo) {
  const l = limparContato(corpo);
  if (!l.nome) return erro('Preencha o nome.');
  const id = crypto.randomUUID();
  await insertContato(env, id, l, agora()).run();
  return obterContato(env, id);
}
async function atualizarContato(env, id, corpo) {
  const l = limparContato(corpo);
  if ('nome' in l && !l.nome) return erro('Preencha o nome.');
  const cols = Object.keys(l);
  if (cols.length) {
    const r = await env.DB.prepare(`UPDATE contatos SET ${cols.map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`).bind(...cols.map((k) => l[k]), agora(), id).run();
    if (!r.meta.changes) return erro('Contato não encontrado.', 404);
  }
  return obterContato(env, id);
}
async function excluirContato(env, id) {
  await env.DB.batch([
    env.DB.prepare('UPDATE camisas SET comprador_id = NULL WHERE comprador_id = ?').bind(id),
    env.DB.prepare('UPDATE camisas SET fornecedor_id = NULL WHERE fornecedor_id = ?').bind(id),
    env.DB.prepare('UPDATE trocas SET contato_id = NULL WHERE contato_id = ?').bind(id),
    env.DB.prepare('DELETE FROM contatos WHERE id = ?').bind(id),
  ]);
  return json({ ok: true });
}

// Quem pode querer esta camisa: curte o clube (campo interesses) ou já levou camisa do mesmo clube.
async function interessados(env, camisaId) {
  const c = await env.DB.prepare('SELECT clube FROM camisas WHERE id = ?').bind(camisaId).first();
  if (!c) return erro('Camisa não encontrada.', 404);
  const alvo = normaliza(c.clube);
  const { results } = await env.DB.prepare(`SELECT ct.id, ct.nome, ct.whatsapp, ct.interesses,
      (SELECT GROUP_CONCAT(cm.clube, '|') FROM camisas cm WHERE cm.comprador_id = ct.id) AS levou
    FROM contatos ct WHERE ct.whatsapp IS NOT NULL`).all();
  const lista = [];
  for (const ct of results) {
    const motivos = [];
    if (ct.interesses && normaliza(ct.interesses).includes(alvo)) motivos.push(`curte ${c.clube}`);
    if ((ct.levou || '').split('|').some((x) => normaliza(x) === alvo)) motivos.push(`já levou ${c.clube}`);
    if (motivos.length) lista.push({ id: ct.id, nome: ct.nome, whatsapp: ct.whatsapp, motivos });
  }
  return json(lista);
}

// ---------- trocas ----------
// saidas: [{id, valor}] (camisas dele que saem) · entradas: [{clube, temporada, tamanho, modelo, valor}] (que chegam)
// dinheiro > 0 = ele pagou a diferença; < 0 = ele recebeu.
async function registrarTroca(env, corpo) {
  const saidas = Array.isArray(corpo.saidas) ? corpo.saidas.slice(0, 20) : [];
  const entradas = Array.isArray(corpo.entradas) ? corpo.entradas.slice(0, 20) : [];
  if (!saidas.length || !entradas.length) return erro('Uma troca precisa de pelo menos uma camisa saindo e uma entrando.');
  if (entradas.some((e) => !String(e.clube || '').trim())) return erro('Toda camisa que entra precisa do clube.');
  const data = /^\d{4}-\d{2}-\d{2}$/.test(corpo.data || '') ? corpo.data : agora().slice(0, 10);
  const t = agora();
  const stmts = [];
  let contatoId = corpo.contato_id || null;
  let nomeContato = null;
  if (contatoId) {
    nomeContato = (await env.DB.prepare('SELECT nome FROM contatos WHERE id = ?').bind(contatoId).first())?.nome || null;
    if (!nomeContato) contatoId = null;
  } else if (corpo.contato_novo?.nome) {
    contatoId = crypto.randomUUID();
    const l = limparContato({ ...corpo.contato_novo, tipo: 'ambos' });
    nomeContato = l.nome;
    stmts.push(insertContato(env, contatoId, l, t));
  }
  const trocaId = crypto.randomUUID();
  const dinheiro = Number(corpo.dinheiro) || 0;
  stmts.push(env.DB.prepare('INSERT INTO trocas (id, data, contato_id, dinheiro, observacoes, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(trocaId, data, contatoId, dinheiro, String(corpo.observacoes || '').trim().slice(0, 2000) || null, t));
  for (const sd of saidas) {
    const v = Number(sd.valor);
    stmts.push(env.DB.prepare(`UPDATE camisas SET status = 'vendida', valor_venda = ?, data_venda = ?, canal_venda = 'Troca',
        comprador = ?, comprador_id = ?, troca_saida_id = ?, updated_at = ? WHERE id = ?`)
      .bind(Number.isFinite(v) ? v : null, data, nomeContato, contatoId, trocaId, t, String(sd.id)));
  }
  const novas = [];
  for (const e of entradas) {
    const l = limpar({
      clube: e.clube, temporada: e.temporada, tamanho: e.tamanho, modelo: e.modelo || null, ano: anoDe(e.temporada),
      valor_compra: e.valor, data_compra: data, origem: nomeContato ? `Troca com ${nomeContato}` : 'Troca', status: 'estoque', publicada: false,
    });
    const id = crypto.randomUUID();
    novas.push(id);
    const cols = Object.keys(l);
    stmts.push(env.DB.prepare(`INSERT INTO camisas (id, numero, created_at, updated_at, fornecedor_id, troca_entrada_id${cols.map((k) => `, ${k}`).join('')})
      VALUES (?, (SELECT COALESCE(MAX(numero), 0) + 1 FROM camisas WHERE owner_id = 'dono'), ?, ?, ?, ?${cols.map(() => ', ?').join('')})`)
      .bind(id, t, t, contatoId, trocaId, ...cols.map((k) => l[k])));
  }
  await env.DB.batch(stmts);
  return json({ id: trocaId, entradas: novas, contato_id: contatoId });
}

// ---------- ofertas recebidas pela loja ----------
async function listarOfertas(env) {
  const { results } = await env.DB.prepare(`SELECT * FROM ofertas ORDER BY CASE status WHEN 'nova' THEN 0 WHEN 'em_conversa' THEN 1 ELSE 2 END, created_at DESC`).all();
  return json(results);
}
async function obterOferta(env, id) {
  const o = await env.DB.prepare('SELECT * FROM ofertas WHERE id = ?').bind(id).first();
  return o ? json(o) : erro('Oferta não encontrada.', 404);
}
async function atualizarOferta(env, id, corpo) {
  if (!['nova', 'em_conversa', 'aceita', 'recusada'].includes(corpo.status)) return erro('Status inválido.');
  await env.DB.prepare('UPDATE ofertas SET status = ?, updated_at = ? WHERE id = ?').bind(corpo.status, agora(), id).run();
  return obterOferta(env, id);
}
async function excluirOferta(env, id) {
  const o = await env.DB.prepare('SELECT fotos FROM ofertas WHERE id = ?').bind(id).first();
  if (o) await Promise.all(Array.from({ length: o.fotos }, (_, n) => [env.FOTOS.delete(`o:${id}:${n}`), env.FOTOS.delete(`ot:${id}:${n}`)]).flat());
  await env.DB.prepare('DELETE FROM ofertas WHERE id = ?').bind(id).run();
  return json({ ok: true });
}
async function fotoOferta(env, id, n, mini) {
  let corpo = mini ? await env.FOTOS.get(`ot:${id}:${n}`, { type: 'stream' }) : null;
  if (!corpo) corpo = await env.FOTOS.get(`o:${id}:${n}`, { type: 'stream' });
  if (!corpo) return new Response('Foto não encontrada', { status: 404 });
  return new Response(corpo, { headers: { 'content-type': 'image/jpeg', 'cache-control': 'private, max-age=86400' } });
}
// Aceitar: vira contato (fornecedor) + camisa no acervo (fora da loja), com as fotos copiadas.
async function aceitarOferta(env, id) {
  const o = await env.DB.prepare('SELECT * FROM ofertas WHERE id = ?').bind(id).first();
  if (!o) return erro('Oferta não encontrada.', 404);
  if (o.camisa_id) return json({ camisa_id: o.camisa_id, contato_id: o.contato_id });
  const t = agora();
  let contato = await env.DB.prepare('SELECT id FROM contatos WHERE whatsapp = ?').bind(o.whatsapp).first();
  const stmts = [];
  if (!contato) {
    contato = { id: crypto.randomUUID() };
    stmts.push(insertContato(env, contato.id, limparContato({ nome: o.nome, whatsapp: o.whatsapp, cidade: o.cidade, tipo: 'fornecedor' }), t));
  }
  const camisaId = crypto.randomUUID();
  const cons = ['nova', 'excelente', 'muito_boa', 'boa', 'regular', 'ruim'].includes(o.conservacao) ? o.conservacao : null;
  const l = limpar({ clube: o.clube, temporada: o.temporada, ano: anoDe(o.temporada), tamanho: o.tamanho, conservacao: cons,
    origem: `Oferta pelo site (${o.nome})`, status: 'estoque', publicada: false, observacoes: o.mensagem });
  const cols = Object.keys(l);
  stmts.push(env.DB.prepare(`INSERT INTO camisas (id, numero, created_at, updated_at, fornecedor_id${cols.map((k) => `, ${k}`).join('')})
    VALUES (?, (SELECT COALESCE(MAX(numero), 0) + 1 FROM camisas WHERE owner_id = 'dono'), ?, ?, ?${cols.map(() => ', ?').join('')})`)
    .bind(camisaId, t, t, contato.id, ...cols.map((k) => l[k])));
  for (let n = 0; n < o.fotos; n++) {
    const full = await env.FOTOS.get(`o:${id}:${n}`, { type: 'arrayBuffer' });
    if (!full) continue;
    const thumb = await env.FOTOS.get(`ot:${id}:${n}`, { type: 'arrayBuffer' });
    const fid = crypto.randomUUID();
    await env.FOTOS.put(`f:${fid}`, full);
    if (thumb) await env.FOTOS.put(`t:${fid}`, thumb);
    stmts.push(env.DB.prepare('INSERT INTO fotos (id, camisa_id, ordem, created_at) VALUES (?, ?, ?, ?)').bind(fid, camisaId, n, t));
  }
  stmts.push(env.DB.prepare(`UPDATE ofertas SET status = 'aceita', contato_id = ?, camisa_id = ?, updated_at = ? WHERE id = ?`).bind(contato.id, camisaId, t, id));
  await env.DB.batch(stmts);
  return json({ camisa_id: camisaId, contato_id: contato.id });
}

// ---------- roteador ----------
export async function onRequest(contexto) {
  const origem = contexto.request.headers.get('origin') || '';
  if (contexto.request.method === 'OPTIONS') return comCors(new Response(null, { status: 204 }), origem);
  return comCors(await rotear(contexto), origem);
}

async function rotear({ request, env, params }) {
  const partes = [].concat(params.rota || []);
  const metodo = request.method;
  const corpoJson = async () => { try { return await request.json(); } catch { return {}; } };

  try {
    if (!env.DB || !env.FOTOS || !env.APP_SENHA || !env.SESSAO_SEGREDO) return erro('Servidor sem configuração.', 500);
    const [a, b, c, d] = partes;

    if (a === 'saude' && metodo === 'GET') return json({ app: 'camisa-xx', ok: true });

    if (a === 'login' && metodo === 'POST') {
      const { senha } = await corpoJson();
      const ok = await senhaConfere(senha, env);
      if (!ok) {
        await new Promise((r) => setTimeout(r, 600)); // freia tentativa de adivinhar
        return erro('Senha incorreta.', 401);
      }
      return json({ id: 'dono', email: 'Acesso do dono' }, 200, { 'set-cookie': cookie(await novaSessao(env), SESSAO_DIAS * 86400) });
    }
    if (a === 'logout' && metodo === 'POST') return json({ ok: true }, 200, { 'set-cookie': cookie('', 0) });

    if (a === 'fotos' && b && metodo === 'GET') return servirFoto(env, b, new URL(request.url).searchParams.has('t'));

    if (!(await autorizado(request, env))) return erro('Entre de novo pra continuar.', 401);

    if (a === 'eu' && metodo === 'GET') return json({ id: 'dono', email: 'Acesso do dono' });

    if (a === 'camisas') {
      if (!b && metodo === 'GET') return listar(env);
      if (!b && metodo === 'POST') return criar(env, await corpoJson());
      if (b && !c && metodo === 'GET') return obter(env, b);
      if (b && !c && metodo === 'PUT') return atualizar(env, b, await corpoJson());
      if (b && !c && metodo === 'DELETE') return excluir(env, b);
      if (b && c === 'fotos' && !d && metodo === 'POST') return adicionarFoto(env, b, request);
      if (b && c === 'fotos' && d === 'ordem' && metodo === 'PUT') return ordenarFotos(env, b, await corpoJson());
    }
    if (a === 'fotos' && b && metodo === 'DELETE') return removerFoto(env, b);

    if (a === 'contatos') {
      if (!b && metodo === 'GET') return listarContatos(env);
      if (!b && metodo === 'POST') return criarContato(env, await corpoJson());
      if (b && metodo === 'GET') return obterContato(env, b);
      if (b && metodo === 'PUT') return atualizarContato(env, b, await corpoJson());
      if (b && metodo === 'DELETE') return excluirContato(env, b);
    }
    if (a === 'interessados' && b && metodo === 'GET') return interessados(env, b);
    if (a === 'trocas' && !b && metodo === 'POST') return registrarTroca(env, await corpoJson());
    if (a === 'ofertas') {
      if (!b && metodo === 'GET') return listarOfertas(env);
      if (b && !c && metodo === 'GET') return obterOferta(env, b);
      if (b && !c && metodo === 'PUT') return atualizarOferta(env, b, await corpoJson());
      if (b && !c && metodo === 'DELETE') return excluirOferta(env, b);
      if (b && c === 'aceitar' && metodo === 'POST') return aceitarOferta(env, b);
      if (b && c === 'foto' && d !== undefined && metodo === 'GET') return fotoOferta(env, b, Number(d), new URL(request.url).searchParams.has('t'));
    }

    return erro('Rota não encontrada.', 404);
  } catch (e) {
    const msg = String(e?.message || e);
    if (/CHECK constraint/i.test(msg)) return erro('Algum campo veio com valor inválido.');
    return erro(`Erro no servidor: ${msg}`, 500);
  }
}
