// Loja pública do Camisa XX — páginas geradas no servidor (Cloudflare Pages Functions).
// Lê o MESMO banco do admin (D1 + KV), mas só colunas públicas e só camisas marcadas
// "Mostrar na loja". Custo, origem, comprador e valores de venda nunca saem daqui.
//
// Rotas:  /  ·  /camisa/<numero>-<slug>  ·  /foto/<id>[?t=1]  ·  /sitemap.xml  ·  /robots.txt
// Estáticos (css, ícones) passam direto pro Pages.
import { TIPOS, MODELOS, CONSERVACAO, MANGAS, rotulo, decada, slugLoja as slug } from '../../js/dominio.js';
import { arteCamisa } from '../../js/icones.js';

const COLUNAS = `id, numero, clube, temporada, ano, modelo, marca, patrocinio, tamanho, manga, jogador, numero_camisa,
  tipo, codigo_produto, certificado, conservacao, defeitos, status, preco_pedido, observacoes, created_at, updated_at`;
const VISIVEIS = `publicada = 1 AND status IN ('estoque','anunciada','reservada','vendida')`;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const titulo = (c) => [c.clube, c.temporada].filter(Boolean).join(' ');
const disponivel = (c) => c.status === 'estoque' || c.status === 'anunciada';
const precoTxt = (c) => (c.status === 'vendida' ? 'Vendida' : c.preco_pedido != null ? brl.format(c.preco_pedido) : 'Sob consulta');

function seloStatus(c) {
  if (c.status === 'vendida') return '<span class="selo vendida">Vendida</span>';
  if (c.status === 'reservada') return '<span class="selo reservada">Reservada</span>';
  return '';
}

function linkWhats(env, c, url) {
  const num = String(env.WHATSAPP || '').replace(/\D/g, '');
  if (!num) return null;
  const msg = c ? `Olá! Tenho interesse na camisa ${titulo(c)} (#${String(c.numero).padStart(4, '0')}) que vi no site: ${url}` : 'Olá! Vi o site da Camisa XX e queria saber mais.';
  return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
}

function pagina(env, { tituloPag, descricao, url, imagem, corpo, classe = '' }) {
  const insta = String(env.INSTAGRAM || '').replace(/^@/, '');
  const whats = linkWhats(env, null, url);
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(tituloPag)}</title>
<meta name="description" content="${esc(descricao)}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Camisa XX">
<meta property="og:title" content="${esc(tituloPag)}">
<meta property="og:description" content="${esc(descricao)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(imagem)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#f4eee2">
<link rel="icon" href="/icons/favicon-32.png" sizes="32x32">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@600;700;800&display=swap">
<link rel="stylesheet" href="/css/loja.css">
</head>
<body class="${classe}">
<header class="topo"><div class="faixa">
  <a class="marca" href="/"><img src="/icons/marca-64.png" alt="" width="34" height="34"><span>Camisa XX</span></a>
  ${whats ? `<a class="topo-contato" href="${esc(whats)}" target="_blank" rel="noopener">Fale com a gente</a>` : ''}
</div></header>
<main>${corpo}</main>
<footer class="rodape"><div class="faixa">
  <img src="/icons/logo-560.jpg" alt="Carimbo Camisa XX · 1983" width="88" height="88">
  <div>
    <p><b>Camisa XX</b> · camisas de futebol de colecionador dos anos 80, 90 e 2000.</p>
    <p class="links">${insta ? `<a href="https://instagram.com/${esc(insta)}" target="_blank" rel="noopener">Instagram @${esc(insta)}</a>` : ''}
      ${whats ? `<a href="${esc(whats)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}</p>
  </div>
</div></footer>
</body>
</html>`;
}

function capaDe(c, fotos, base) {
  const f = fotos[0];
  return f ? `<img src="/foto/${f.id}?t=1" alt="${esc(titulo(c))}" loading="lazy" decoding="async">` : arteCamisa(c);
}

function cartao(c, fotos) {
  const sub = [rotulo(MODELOS, c.modelo), c.tamanho && `Tam. ${c.tamanho}`].filter(Boolean).join(' · ');
  const dados = `data-status="${c.status}" data-decada="${esc(decada(c.ano) || '')}" data-tamanho="${esc((c.tamanho || '').toUpperCase())}" data-busca="${esc(semAcento([c.clube, c.temporada, c.jogador, c.marca].filter(Boolean).join(' ')).toLowerCase())}"`;
  return `<a class="cartao ${disponivel(c) ? '' : 'indisponivel'}" href="/camisa/${slug(c)}" ${dados}>
    <div class="cartao-foto">${capaDe(c, fotos)}${seloStatus(c)}</div>
    <div class="cartao-info">
      <span class="cartao-titulo">${esc(c.clube)}</span>
      <span class="cartao-temporada">${esc(c.temporada || '')}</span>
      <span class="cartao-sub">${esc(sub)}</span>
      <span class="cartao-preco">${esc(precoTxt(c))}</span>
    </div>
  </a>`;
}

async function carregar(env, where, ...binds) {
  const { results: camisas } = await env.DB.prepare(`SELECT ${COLUNAS} FROM camisas WHERE ${VISIVEIS} ${where}`).bind(...binds).all();
  if (!camisas.length) return { camisas, fotos: {} };
  const ids = camisas.map((c) => c.id);
  const { results } = await env.DB.prepare(`SELECT id, camisa_id, ordem FROM fotos WHERE camisa_id IN (${ids.map(() => '?').join(',')}) ORDER BY ordem`).bind(...ids).all();
  const fotos = {};
  for (const f of results) (fotos[f.camisa_id] ||= []).push(f);
  return { camisas, fotos };
}

async function inicio(env, origem) {
  const { camisas, fotos } = await carregar(env, `ORDER BY CASE status WHEN 'vendida' THEN 2 WHEN 'reservada' THEN 1 ELSE 0 END, created_at DESC`);
  const disponiveis = camisas.filter(disponivel).length;
  const decadas = [...new Set(camisas.map((c) => decada(c.ano)).filter(Boolean))].sort();
  const tamanhos = [...new Set(camisas.map((c) => (c.tamanho || '').toUpperCase()).filter(Boolean))].sort();
  const capa = camisas.find((c) => fotos[c.id]?.length);
  const corpo = `
  <section class="abertura"><div class="faixa">
    <img class="carimbo" src="/icons/logo-560.jpg" alt="Carimbo Camisa XX · 1983" width="200" height="200">
    <div class="abertura-texto">
      <h1>Camisas de futebol de colecionador</h1>
      <p>Mantos dos anos 80, 90 e 2000 — de torcedor e de jogo, escolhidos um a um e com procedência.</p>
      <p class="contagem">${disponiveis} ${disponiveis === 1 ? 'camisa disponível' : 'camisas disponíveis'}</p>
    </div>
  </div></section>

  <section class="vitrine"><div class="faixa">
    ${camisas.length ? `
    <div class="filtros" role="search">
      <label class="busca"><span class="sr">Buscar</span><input type="search" id="busca" placeholder="Buscar clube, ano, jogador…" autocomplete="off"></label>
      <div class="selects">
        <select id="f-status" aria-label="Disponibilidade"><option value="disp">Disponíveis</option><option value="">Todas</option><option value="vendida">Já vendidas</option></select>
        ${decadas.length > 1 ? `<select id="f-decada" aria-label="Década"><option value="">Todas as décadas</option>${decadas.map((d) => `<option>${esc(d)}</option>`).join('')}</select>` : ''}
        ${tamanhos.length > 1 ? `<select id="f-tamanho" aria-label="Tamanho"><option value="">Todos os tamanhos</option>${tamanhos.map((t) => `<option>${esc(t)}</option>`).join('')}</select>` : ''}
      </div>
    </div>
    <div class="grade" id="grade">${camisas.map((c) => cartao(c, fotos[c.id] || [])).join('')}</div>
    <p class="nada" id="nada" hidden>Nenhuma camisa com esses filtros.</p>`
    : `<p class="nada">As primeiras camisas chegam em breve.</p>`}
  </div></section>
  <script>
  (function(){
    var g=document.getElementById('grade'); if(!g) return;
    var cards=[].slice.call(g.children), b=document.getElementById('busca'), s=document.getElementById('f-status'),
        d=document.getElementById('f-decada'), t=document.getElementById('f-tamanho'), nada=document.getElementById('nada');
    function norm(x){return (x||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase();}
    function f(){
      var q=norm(b.value).split(/\\s+/).filter(Boolean), st=s.value, dv=d?d.value:'', tv=t?t.value:'', n=0;
      cards.forEach(function(c){
        var ok=q.every(function(p){return c.dataset.busca.indexOf(p)>=0;})
          && (st===''||(st==='disp'?c.dataset.status!=='vendida':c.dataset.status===st))
          && (!dv||c.dataset.decada===dv) && (!tv||c.dataset.tamanho===tv);
        c.hidden=!ok; if(ok) n++;
      });
      nada.hidden=n>0;
    }
    [b,s,d,t].forEach(function(el){ if(el) el.addEventListener('input',f); });
    f();
  })();
  </script>`;
  return pagina(env, {
    tituloPag: 'Camisa XX · camisas de futebol de colecionador',
    descricao: `${disponiveis} camisas de futebol de colecionador dos anos 80, 90 e 2000 — de torcedor e de jogo.`,
    url: `${origem}/`,
    imagem: capa ? `${origem}/foto/${fotos[capa.id][0].id}` : `${origem}/icons/logo-560.jpg`,
    corpo,
  });
}

async function camisa(env, origem, numero) {
  const { camisas, fotos: porCamisa } = await carregar(env, 'AND numero = ?', numero);
  const c = camisas[0];
  if (!c) return null;
  const fotos = porCamisa[c.id] || [];
  const url = `${origem}/camisa/${slug(c)}`;
  const whats = linkWhats(env, c, url);
  const tipo = TIPOS.find((t) => t.v === c.tipo);
  const ficha = [
    ['Clube', c.clube], ['Temporada', c.temporada], ['Modelo', rotulo(MODELOS, c.modelo)], ['Marca', c.marca],
    ['Patrocínio', c.patrocinio], ['Tamanho', c.tamanho], ['Manga', rotulo(MANGAS, c.manga)],
    ['Jogador', [c.jogador, c.numero_camisa && `#${c.numero_camisa}`].filter(Boolean).join(' ')],
    ['Tipo', tipo ? `${tipo.l} — ${tipo.d}` : ''], ['Código da etiqueta', c.codigo_produto],
    ['Certificado de autenticidade', c.certificado ? 'Sim' : ''],
    ['Conservação', rotulo(CONSERVACAO, c.conservacao)], ['Detalhes do estado', c.defeitos],
  ].filter(([, v]) => v);
  const galeria = fotos.length
    ? `<div class="galeria" id="galeria">${fotos.map((f, i) => `<a class="galeria-item" href="/foto/${f.id}" target="_blank" rel="noopener"><img src="/foto/${f.id}" alt="${esc(titulo(c))} — foto ${i + 1}" ${i ? 'loading="lazy"' : ''}></a>`).join('')}</div>
       ${fotos.length > 1 ? `<div class="miniaturas">${fotos.map((f, i) => `<button type="button" data-i="${i}" aria-label="Foto ${i + 1}"><img src="/foto/${f.id}?t=1" alt=""></button>`).join('')}</div>` : ''}`
    : `<div class="galeria vazia">${arteCamisa(c)}</div>`;
  const corpo = `
  <article class="produto"><div class="faixa">
    <a class="voltar" href="/">← Todas as camisas</a>
    <div class="produto-grade">
      <div class="produto-fotos">${galeria}</div>
      <div class="produto-info">
        <p class="codigo">#${String(c.numero).padStart(4, '0')}</p>
        <h1>${esc(c.clube)} <span>${esc(c.temporada || '')}</span></h1>
        <p class="produto-sub">${esc([rotulo(MODELOS, c.modelo), c.marca, c.tamanho && `Tamanho ${c.tamanho}`].filter(Boolean).join(' · '))}</p>
        <p class="produto-preco ${c.status}">${esc(precoTxt(c))}${c.status === 'reservada' ? ' <small>· reservada</small>' : ''}</p>
        ${disponivel(c) && whats ? `<a class="btn-comprar" href="${esc(whats)}" target="_blank" rel="noopener">Quero essa camisa</a>` : ''}
        ${c.status === 'reservada' && whats ? `<a class="btn-sec" href="${esc(whats)}" target="_blank" rel="noopener">Avise-me se liberar</a>` : ''}
        ${c.status === 'vendida' ? '<p class="aviso">Essa já foi pra coleção de alguém. Veja as disponíveis ou peça uma parecida.</p>' : ''}
        <button class="btn-sec" type="button" id="compartilhar">Compartilhar</button>
        <dl class="ficha">${ficha.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
        ${c.observacoes && c.observacoes !== 'Exemplo de demonstração' ? `<p class="obs">${esc(c.observacoes)}</p>` : ''}
      </div>
    </div>
  </div></article>
  <script>
  (function(){
    var g=document.getElementById('galeria');
    document.querySelectorAll('.miniaturas button').forEach(function(b){
      b.addEventListener('click',function(){ g.scrollTo({left:g.clientWidth*Number(b.dataset.i),behavior:'smooth'}); });
    });
    var c=document.getElementById('compartilhar');
    c.addEventListener('click',function(){
      var d={title:document.title,url:location.href};
      if(navigator.share){ navigator.share(d).catch(function(){}); return; }
      navigator.clipboard.writeText(location.href).then(function(){ c.textContent='Link copiado'; },function(){ prompt('Copie o link:',location.href); });
    });
  })();
  </script>`;
  const desc = [rotulo(MODELOS, c.modelo), c.marca, c.tamanho && `tamanho ${c.tamanho}`, rotulo(CONSERVACAO, c.conservacao) && `estado ${rotulo(CONSERVACAO, c.conservacao).toLowerCase()}`].filter(Boolean).join(', ');
  return pagina(env, {
    tituloPag: `${titulo(c)} · ${precoTxt(c)} · Camisa XX`,
    descricao: `Camisa ${titulo(c)}${desc ? ` — ${desc}` : ''}. ${c.status === 'vendida' ? 'Vendida.' : precoTxt(c) + '.'}`,
    url,
    imagem: fotos.length ? `${origem}/foto/${fotos[0].id}` : `${origem}/icons/logo-560.jpg`,
    corpo,
    classe: 'pag-produto',
  });
}

async function foto(env, id, mini) {
  let corpo = mini ? await env.FOTOS.get(`t:${id}`, { type: 'stream' }) : null;
  if (!corpo) corpo = await env.FOTOS.get(`f:${id}`, { type: 'stream' });
  if (!corpo) return new Response('Foto não encontrada', { status: 404 });
  return new Response(corpo, { headers: { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=31536000, immutable' } });
}

async function sitemap(env, origem) {
  const { results } = await env.DB.prepare(`SELECT numero, clube, temporada, updated_at FROM camisas WHERE ${VISIVEIS}`).all();
  const urls = [`<url><loc>${origem}/</loc></url>`, ...results.map((c) => `<url><loc>${origem}/camisa/${slug(c)}</loc><lastmod>${c.updated_at.slice(0, 10)}</lastmod></url>`)];
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`, { headers: { 'content-type': 'application/xml' } });
}

const html = (corpo, status = 200) => new Response(corpo, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=60' } });

export async function onRequest(ctx) {
  const { request, env } = ctx;
  const url = new URL(request.url);
  const p = url.pathname;
  if (p.startsWith('/css/') || p.startsWith('/icons/')) return ctx.next();
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Método não permitido', { status: 405 });
  const origem = url.origin;
  try {
    if (p === '/' || p === '') return html(await inicio(env, origem));
    let m = p.match(/^\/camisa\/(\d+)(?:-[a-z0-9-]*)?\/?$/);
    if (m) {
      const r = await camisa(env, origem, Number(m[1]));
      if (r) return html(r);
    }
    m = p.match(/^\/foto\/([\w-]+)$/);
    if (m) return foto(env, m[1], url.searchParams.has('t'));
    if (p === '/sitemap.xml') return sitemap(env, origem);
    if (p === '/robots.txt') return new Response(`User-agent: *\nAllow: /\nSitemap: ${origem}/sitemap.xml\n`, { headers: { 'content-type': 'text/plain' } });
    return html(pagina(env, {
      tituloPag: 'Página não encontrada · Camisa XX', descricao: 'Camisa XX', url: `${origem}${p}`, imagem: `${origem}/icons/logo-560.jpg`,
      corpo: '<section class="vitrine"><div class="faixa"><p class="nada">Essa página não existe (ou a camisa saiu da loja). <a href="/">Ver todas as camisas</a></p></div></section>',
    }), 404);
  } catch (e) {
    return new Response(`Erro: ${e.message}`, { status: 500 });
  }
}
