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
  'observacoes', 'publicada',
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
  return json(saida(c, results));
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

    return erro('Rota não encontrada.', 404);
  } catch (e) {
    const msg = String(e?.message || e);
    if (/CHECK constraint/i.test(msg)) return erro('Algum campo veio com valor inválido.');
    return erro(`Erro no servidor: ${msg}`, 500);
  }
}
