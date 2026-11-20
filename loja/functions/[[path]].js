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
// Camisas de exemplo (pra mostrar a loja) ficam marcadas e sem botão de compra
const ehExemplo = (c) => c.observacoes === 'Exemplo de demonstração';
// "Chegou agora": cadastrada nos últimos 7 dias e ainda à venda
const novidade = (c) => disponivel(c) && Date.now() - Date.parse(c.created_at) < 7 * 86400000;
const precoTxt = (c) => (c.status === 'vendida' ? 'Vendida' : c.preco_pedido != null ? brl.format(c.preco_pedido) : 'Sob consulta');

function seloStatus(c) {
  if (ehExemplo(c)) return `<span class="selo exemplo">Exemplo${c.status === 'vendida' ? ' · vendida' : c.status === 'reservada' ? ' · reservada' : ''}</span>`;
  if (c.status === 'vendida') return '<span class="selo vendida">Vendida</span>';
  if (c.status === 'reservada') return '<span class="selo reservada">Reservada</span>';
  if (novidade(c)) return '<span class="selo novo">Chegou agora</span>';
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
${env.GA4_ID ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${esc(env.GA4_ID)}"></script>
<script>
window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('js',new Date());gtag('config','${esc(env.GA4_ID)}');
document.addEventListener('click',function(e){
  var a=e.target.closest&&e.target.closest('a[href*="wa.me"]'); if(!a) return;
  gtag('event','generate_lead',{method:'whatsapp',origem:a.dataset.origem||'contato',item_id:a.dataset.camisa||'',value:Number(a.dataset.valor)||undefined,currency:'BRL',transport_type:'beacon'});
});
</script>` : ''}
</head>
<body class="${classe}">
<header class="topo"><div class="faixa">
  <a class="marca" href="/"><img src="/icons/marca-64.png" alt="" width="34" height="34"><span>Camisa XX</span></a>
  ${whats ? `<a class="topo-contato" data-origem="topo" href="${esc(whats)}" target="_blank" rel="noopener">Fale com a gente</a>` : ''}
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

function cartao(c, fotos, i) {
  const sub = [rotulo(MODELOS, c.modelo), c.tamanho && `Tam. ${c.tamanho}`].filter(Boolean).join(' · ');
  const dados = `data-i="${i}" data-preco="${disponivel(c) && c.preco_pedido != null ? c.preco_pedido : ''}" data-status="${c.status}" data-decada="${esc(decada(c.ano) || '')}" data-tamanho="${esc((c.tamanho || '').toUpperCase())}" data-busca="${esc(semAcento([c.clube, c.temporada, c.jogador, c.marca].filter(Boolean).join(' ')).toLowerCase())}"`;
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
        <select id="f-ordem" aria-label="Ordenar"><option value="">Mais recentes</option><option value="menor">Menor preço</option><option value="maior">Maior preço</option></select>
        ${tamanhos.length > 1 ? `<select id="f-tamanho" aria-label="Tamanho"><option value="">Todos os tamanhos</option>${tamanhos.map((t) => `<option>${esc(t)}</option>`).join('')}</select>` : ''}
      </div>
    </div>
    <div class="grade" id="grade">${camisas.map((c, i) => cartao(c, fotos[c.id] || [], i)).join('')}</div>
    <p class="nada" id="nada" hidden>Nenhuma camisa com esses filtros.</p>`
    : `<p class="nada">As primeiras camisas chegam em breve.</p>`}
  </div></section>
  ${env.WHATSAPP ? `
  <section class="procuro"><div class="faixa">
    <div class="procuro-caixa">
      <div>
        <h2>Procura uma camisa específica?</h2>
        <p>Diz qual é que a gente vai atrás. Muita coisa boa chega antes de entrar no site.</p>
      </div>
      <form id="f-procuro" data-whats="${esc(String(env.WHATSAPP).replace(/\D/g, ''))}">
        <label><span>Clube ou seleção</span><input name="clube" required placeholder="Ex.: Flamengo" autocomplete="off"></label>
        <div class="procuro-duas">
          <label><span>Ano ou década</span><input name="ano" placeholder="Ex.: 1981 ou anos 90" autocomplete="off"></label>
          <label><span>Tamanho</span><input name="tamanho" placeholder="Ex.: G" autocomplete="off"></label>
        </div>
        <label><span>Detalhes <em>opcional</em></span><input name="obs" placeholder="Ex.: titular, com número 10" autocomplete="off"></label>
        <button type="submit" class="btn-comprar">Pedir pelo WhatsApp</button>
      </form>
    </div>
  </div></section>` : ''}
  <section class="guardada" id="guardada"><div class="faixa">
    <div class="guardada-caixa">
      <div class="guardada-texto">
        <h2>Tem uma camisa guardada?</h2>
        <p>Venda ou troque com a gente. Manda as fotos e os detalhes, a gente avalia e te chama no WhatsApp.</p>
      </div>
      <form id="f-guardada" novalidate data-whats="${esc(String(env.WHATSAPP || '').replace(/\D/g, ''))}">
        <input type="text" name="site" tabindex="-1" autocomplete="off" class="pote" aria-hidden="true">
        <div class="procuro-duas">
          <label><span>Seu nome</span><input name="nome" required autocomplete="name"></label>
          <label><span>Seu WhatsApp</span><input name="whatsapp" required inputmode="tel" autocomplete="tel" placeholder="(31) 99999-9999"></label>
        </div>
        <div class="procuro-duas">
          <label><span>Clube ou seleção</span><input name="clube" required autocomplete="off"></label>
          <label><span>Ano / temporada</span><input name="temporada" autocomplete="off" placeholder="Ex.: 1994"></label>
        </div>
        <div class="procuro-duas">
          <label><span>Tamanho</span><input name="tamanho" autocomplete="off"></label>
          <label><span>Estado</span><select name="conservacao"><option value="">—</option>${CONSERVACAO.map((x) => `<option value="${x.v}">${esc(x.l)}</option>`).join('')}</select></label>
        </div>
        <div class="escolha-intencao" role="radiogroup" aria-label="O que você quer">
          <label><input type="radio" name="intencao" value="vender" checked><span>Vender</span></label>
          <label><input type="radio" name="intencao" value="trocar"><span>Trocar</span></label>
          <label><input type="radio" name="intencao" value="tanto_faz"><span>Tanto faz</span></label>
        </div>
        <label><span>Quanto quer por ela <em>opcional</em></span><input name="preco" inputmode="decimal" placeholder="R$"></label>
        <label><span>Conta a história dela <em>opcional</em></span><textarea name="mensagem" rows="3" placeholder="De onde veio, se tem etiqueta, defeitos…"></textarea></label>
        <label class="fotos-campo"><span>Fotos (até 5): frente, costas e etiqueta</span>
          <input type="file" name="fotos" accept="image/*" multiple></label>
        <div class="fotos-previa" id="g-previa"></div>
        <p class="g-erro" id="g-erro" hidden></p>
        <button type="submit" class="btn-comprar" id="g-enviar">Enviar camisa</button>
      </form>
      <div class="guardada-ok" id="g-ok" hidden>
        <h3>Recebemos sua camisa!</h3>
        <p>Pra agilizar, avisa a gente no WhatsApp. As fotos vão junto no link.</p>
        <a class="btn-comprar" id="g-whats" href="#" target="_blank" rel="noopener" data-origem="guardada">Avisar no WhatsApp</a>
      </div>
    </div>
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
    var o=document.getElementById('f-ordem');
    function ordenar(){
      var v=o.value, lista=cards.slice();
      lista.sort(function(x,y){
        if(!v) return x.dataset.i-y.dataset.i;
        var px=x.dataset.preco, py=y.dataset.preco;
        if(px===''&&py==='') return x.dataset.i-y.dataset.i;
        if(px==='') return 1; if(py==='') return -1;
        return v==='menor'? px-py : py-px;
      });
      lista.forEach(function(c){ g.appendChild(c); });
    }
    o.addEventListener('input',ordenar);
    [b,s,d,t].forEach(function(el){ if(el) el.addEventListener('input',f); });
    f();
  })();
  (function(){
    var p=document.getElementById('f-procuro'); if(!p) return;
    p.addEventListener('submit',function(e){
      e.preventDefault();
      var v=function(n){return (p.elements[n].value||'').trim();};
      var partes=['Olá! Estou procurando uma camisa:', '• Clube: '+v('clube')];
      if(v('ano')) partes.push('• Ano: '+v('ano'));
      if(v('tamanho')) partes.push('• Tamanho: '+v('tamanho'));
      if(v('obs')) partes.push('• Detalhes: '+v('obs'));
      if(window.gtag) gtag('event','generate_lead',{method:'whatsapp',origem:'procuro',transport_type:'beacon'});
      location.href='https://wa.me/'+p.dataset.whats+'?text='+encodeURIComponent(partes.join('\\n'));
    });
  })();
  (function(){
    var f=document.getElementById('f-guardada'); if(!f) return;
    var arquivos=[], previa=document.getElementById('g-previa'), erro=document.getElementById('g-erro'), btn=document.getElementById('g-enviar');
    function reduzir(file,max,q){
      return new Promise(function(ok,falha){
        var url=URL.createObjectURL(file), img=new Image();
        img.onload=function(){
          var k=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight)), c=document.createElement('canvas');
          c.width=Math.round(img.naturalWidth*k); c.height=Math.round(img.naturalHeight*k);
          c.getContext('2d').drawImage(img,0,0,c.width,c.height); URL.revokeObjectURL(url);
          c.toBlob(function(b){ b?ok(b):falha(new Error('foto')); },'image/jpeg',q);
        };
        img.onerror=function(){ URL.revokeObjectURL(url); falha(new Error('foto')); };
        img.src=url;
      });
    }
    f.fotos.addEventListener('change',function(){
      arquivos=[].slice.call(f.fotos.files,0,5);
      previa.innerHTML=arquivos.map(function(a){ return '<img src="'+URL.createObjectURL(a)+'" alt="">'; }).join('');
    });
    function falhou(m){ erro.textContent=m; erro.hidden=false; btn.disabled=false; btn.textContent='Enviar camisa'; }
    f.addEventListener('submit',function(e){
      e.preventDefault(); erro.hidden=true;
      var zap=(f.whatsapp.value||'').replace(/[^0-9]/g,'');
      if(!f.nome.value.trim()) return falhou('Preencha seu nome.');
      if(zap.length<10) return falhou('Confira seu WhatsApp com DDD.');
      if(!f.clube.value.trim()) return falhou('Qual é o clube ou seleção?');
      if(!arquivos.length) return falhou('Manda pelo menos uma foto da camisa.');
      btn.disabled=true; btn.textContent='Enviando…';
      var fd=new FormData(f); fd.delete('fotos');
      Promise.all(arquivos.map(function(a){ return Promise.all([reduzir(a,1400,.82),reduzir(a,420,.75)]); }))
        .then(function(pares){
          pares.forEach(function(p,i){ fd.append('full'+i,p[0],'f'+i+'.jpg'); fd.append('thumb'+i,p[1],'t'+i+'.jpg'); });
          return fetch('/oferta',{method:'POST',body:fd});
        })
        .then(function(r){ return r.json().then(function(d){ if(!r.ok) throw new Error(d.erro||'Não deu pra enviar.'); return d; }); })
        .then(function(d){
          if(window.gtag) gtag('event','generate_lead',{method:'formulario',origem:'tem-camisa-guardada'});
          var txt='Oi! Mandei pelo site uma camisa '+f.clube.value.trim()+(f.temporada.value.trim()?' '+f.temporada.value.trim():'')+' pra '+({vender:'vender',trocar:'trocar',tanto_faz:'vender ou trocar'})[f.intencao.value]+'. Fotos: '+location.origin+'/oferta/'+d.id;
          document.getElementById('g-whats').href='https://wa.me/'+(f.dataset.whats||'')+'?text='+encodeURIComponent(txt);
          f.hidden=true; document.getElementById('g-ok').hidden=false;
          document.getElementById('guardada').scrollIntoView({behavior:'smooth',block:'start'});
        })
        .catch(function(err){ falhou(err.message==='foto'?'Uma das fotos não abriu. Tente outra.':err.message); });
    });
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
        ${ehExemplo(c) ? '<p class="aviso exemplo">Camisa de exemplo, pra mostrar como a loja vai ficar. As camisas de verdade chegam em breve.</p>' : ''}
        ${disponivel(c) && whats ? `<a class="btn-comprar" data-origem="quero-essa" data-camisa="${c.numero}" data-valor="${c.preco_pedido ?? ''}" href="${esc(whats)}" target="_blank" rel="noopener">Quero essa camisa</a>` : ''}
        ${c.status === 'reservada' && whats ? `<a class="btn-sec" data-origem="avise-me" data-camisa="${c.numero}" href="${esc(whats)}" target="_blank" rel="noopener">Avise-me se liberar</a>` : ''}
        ${!ehExemplo(c) && c.status === 'vendida' ? '<p class="aviso">Essa já foi pra coleção de alguém. Veja as disponíveis ou peça uma parecida.</p>' : ''}
        <button class="btn-sec" type="button" id="compartilhar">Compartilhar</button>
        <dl class="ficha">${ficha.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
        ${c.observacoes && c.observacoes !== 'Exemplo de demonstração' ? `<p class="obs">${esc(c.observacoes)}</p>` : ''}
      </div>
    </div>
  </div></article>
  <script>
  if(window.gtag) gtag('event','view_item',{currency:'BRL',value:${c.preco_pedido ?? 0},items:[{item_id:'${c.numero}',item_name:${JSON.stringify(titulo(c)).replace(/</g, '\\u003c')},item_category:'${esc(c.status)}'}]});
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


// ---------- "Tem uma camisa guardada?" ----------
const INTENCOES = ['vender', 'trocar', 'tanto_faz'];
const ehJpeg = (buf) => { const b = new Uint8Array(buf, 0, 3); return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff; };
const json = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

async function receberOferta(request, env) {
  let fd;
  try { fd = await request.formData(); } catch { return json({ erro: 'Envio inválido.' }, 400); }
  if (String(fd.get('site') || '').trim()) return json({ id: crypto.randomUUID() }); // robô caiu no pote
  const txt = (k, max) => String(fd.get(k) || '').trim().slice(0, max) || null;
  const nome = txt('nome', 80), clube = txt('clube', 80);
  const whatsapp = String(fd.get('whatsapp') || '').replace(/\D/g, '').slice(0, 13);
  if (!nome || !clube || whatsapp.length < 10) return json({ erro: 'Preencha nome, WhatsApp e clube.' }, 400);
  const intencao = INTENCOES.includes(fd.get('intencao')) ? fd.get('intencao') : 'vender';
  const precoTxt = String(fd.get('preco') || '').replace(/[^\d,.]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.');
  const preco = precoTxt && Number.isFinite(Number(precoTxt)) ? Number(precoTxt) : null;

  // limite simples: 5 envios por IP por dia
  const ip = request.headers.get('cf-connecting-ip') || 'x';
  const chaveLim = `lim:${ip}:${new Date().toISOString().slice(0, 10)}`;
  const usados = Number(await env.FOTOS.get(chaveLim)) || 0;
  if (usados >= 5) return json({ erro: 'Muitos envios hoje. Fala direto com a gente no WhatsApp.' }, 429);

  const fotos = [];
  for (let i = 0; i < 5; i++) {
    const full = fd.get(`full${i}`);
    if (!full || typeof full === 'string') break;
    const thumb = fd.get(`thumb${i}`);
    const bf = await full.arrayBuffer();
    if (bf.byteLength > 3 * 1024 * 1024 || !ehJpeg(bf)) return json({ erro: 'Uma das fotos é grande demais ou não é imagem.' }, 400);
    const bt = thumb && typeof thumb !== 'string' ? await thumb.arrayBuffer() : null;
    fotos.push([bf, bt && bt.byteLength < 600 * 1024 && ehJpeg(bt) ? bt : null]);
  }
  if (!fotos.length) return json({ erro: 'Manda pelo menos uma foto.' }, 400);

  const id = crypto.randomUUID();
  await Promise.all(fotos.flatMap(([bf, bt], n) => [env.FOTOS.put(`o:${id}:${n}`, bf), bt ? env.FOTOS.put(`ot:${id}:${n}`, bt) : null].filter(Boolean)));
  const t = new Date().toISOString();
  const cons = ['nova', 'excelente', 'muito_boa', 'boa', 'regular', 'ruim'].includes(fd.get('conservacao')) ? fd.get('conservacao') : null;
  await env.DB.prepare(`INSERT INTO ofertas (id, nome, whatsapp, cidade, clube, temporada, tamanho, conservacao, intencao, preco_desejado, mensagem, fotos, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, nome, whatsapp, txt('cidade', 80), clube, txt('temporada', 20), txt('tamanho', 12), cons, intencao, preco, txt('mensagem', 1000), fotos.length, t, t).run();
  await env.FOTOS.put(chaveLim, String(usados + 1), { expirationTtl: 86400 });
  return json({ id });
}

// Página pública da oferta (só fotos e dados da camisa, nunca nome/telefone) — vira prévia com foto no WhatsApp.
async function paginaOferta(env, origem, id) {
  const o = await env.DB.prepare('SELECT id, clube, temporada, tamanho, conservacao, intencao, fotos FROM ofertas WHERE id = ?').bind(id).first();
  if (!o) return null;
  const tit = [o.clube, o.temporada].filter(Boolean).join(' ');
  const intencao = { vender: 'pra vender', trocar: 'pra trocar', tanto_faz: 'pra vender ou trocar' }[o.intencao];
  const corpo = `<section class="vitrine"><div class="faixa">
    <p class="codigo">Camisa oferecida ${esc(intencao)}</p>
    <h1 class="oferta-tit">${esc(tit)}</h1>
    <p class="produto-sub">${esc([o.tamanho && `Tamanho ${o.tamanho}`, rotulo(CONSERVACAO, o.conservacao)].filter(Boolean).join(' · '))}</p>
    <div class="oferta-fotos">${Array.from({ length: o.fotos }, (_, n) => `<a href="/oferta/${o.id}/foto/${n}" target="_blank" rel="noopener"><img src="/oferta/${o.id}/foto/${n}" alt="Foto ${n + 1}" loading="lazy"></a>`).join('')}</div>
  </div></section>`;
  return pagina(env, {
    tituloPag: `${tit} · oferta recebida · Camisa XX`, descricao: `Camisa ${tit} oferecida ${intencao} pela Camisa XX.`,
    url: `${origem}/oferta/${o.id}`, imagem: o.fotos ? `${origem}/oferta/${o.id}/foto/0` : `${origem}/icons/logo-560.jpg`, corpo, classe: 'pag-oferta',
  }).replace('<head>', '<head>\n<meta name="robots" content="noindex">');
}
async function fotoDaOferta(env, id, n) {
  const corpo = await env.FOTOS.get(`o:${id}:${n}`, { type: 'stream' });
  if (!corpo) return new Response('Foto não encontrada', { status: 404 });
  return new Response(corpo, { headers: { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=86400' } });
}

const html = (corpo, status = 200) => new Response(corpo, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=60' } });

export async function onRequest(ctx) {
  const { request, env } = ctx;
  const url = new URL(request.url);
  const p = url.pathname;
  if (p.startsWith('/css/') || p.startsWith('/icons/')) return ctx.next();
  if (p === '/oferta' && request.method === 'POST') {
    try { return await receberOferta(request, env); } catch (e) { return json({ erro: 'Não deu pra enviar agora. Tente de novo.' }, 500); }
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Método não permitido', { status: 405 });
  // Endereço antigo da loja (pages.dev) manda pro domínio oficial, pra não duplicar no Google
  if (url.hostname === 'camisa-xx-loja.pages.dev') return Response.redirect(`https://camisaxx.com.br${p}${url.search}`, 301);
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
    m = p.match(/^\/oferta\/([\w-]+)\/foto\/(\d)$/);
    if (m) return fotoDaOferta(env, m[1], Number(m[2]));
    m = p.match(/^\/oferta\/([\w-]+)\/?$/);
    if (m) { const r = await paginaOferta(env, origem, m[1]); if (r) return html(r); }
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
