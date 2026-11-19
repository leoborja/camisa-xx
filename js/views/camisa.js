// Detalhe de uma camisa: galeria, preço/lucro, ficha completa, ações rápidas.
import { esc, fmtBRL, fmtPct, fmtData, hojeISO, lerBRL, valorCampo, toast, acoes, confirmar, sheet } from '../ui.js';
import { STATUS, TIPOS, MODELOS, CONSERVACAO, MANGAS, CANAIS, rotulo, custo, lucro, retorno, diasNoAcervo, titulo, subtitulo, numeroFmt, slugLoja } from '../dominio.js';
import { CONFIG } from '../config.js';
import { mostrarLegenda, imprimirEtiqueta } from '../divulgar.js';
import { ICONE, arteCamisa } from '../icones.js';

export const tela = 'detalhe';

function linhas(pares) {
  const visiveis = pares.filter(([, v]) => v !== null && v !== undefined && v !== '' && v !== false);
  if (!visiveis.length) return '';
  return `<dl class="ficha">${visiveis.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v === true ? 'Sim' : esc(v)}</dd></div>`).join('')}</dl>`;
}
const secao = (nome, corpo) => (corpo ? `<section class="cartao"><h3>${esc(nome)}</h3>${corpo}</section>` : '');

function blocoValores(c) {
  const k = custo(c);
  const dias = diasNoAcervo(c);
  if (c.status === 'vendida') {
    const l = lucro(c);
    return `
      <div class="valores">
        <div><span>Vendida por</span><b>${fmtBRL(c.valor_venda)}</b></div>
        <div><span>Custo</span><b>${fmtBRL(k)}</b></div>
        <div class="${l != null && l < 0 ? 'neg' : 'pos'}"><span>Lucro</span><b>${fmtBRL(l)}</b><small>${fmtPct(retorno(c, Number(c.valor_venda)))}</small></div>
      </div>
      <p class="suave nota">Vendida em ${fmtData(c.data_venda)}${c.canal_venda ? ` · ${esc(c.canal_venda)}` : ''}${dias != null ? ` · ${dias} dias no acervo` : ''}</p>`;
  }
  const potencial = c.preco_pedido != null && k != null ? Number(c.preco_pedido) - k : null;
  return `
    <div class="valores">
      <div><span>Preço pedido</span><b>${fmtBRL(c.preco_pedido)}</b></div>
      <div><span>Custo</span><b>${fmtBRL(k)}</b></div>
      <div class="${potencial != null && potencial < 0 ? 'neg' : 'pos'}"><span>Lucro previsto</span><b>${fmtBRL(potencial)}</b><small>${fmtPct(retorno(c, c.preco_pedido == null ? null : Number(c.preco_pedido)))}</small></div>
    </div>
    ${dias != null ? `<p class="suave nota">${dias} dias no acervo (comprada em ${fmtData(c.data_compra)})</p>` : ''}`;
}

function galeria(fotos, c) {
  if (!fotos.length) return `<div class="galeria vazia">${arteCamisa(c)}</div>`;
  return `
    <div class="galeria-wrap">
      <div class="galeria" id="galeria">
        ${fotos.map((f, i) => `<button class="galeria-item" data-i="${i}"><img src="${esc(f.url)}" alt="" ${i ? 'loading="lazy"' : ''} decoding="async"></button>`).join('')}
      </div>
      ${fotos.length > 1 ? `<span class="galeria-contador" id="contador">1/${fotos.length}</span>` : ''}
    </div>`;
}

function abrirVisor(fotos, inicio) {
  const v = document.createElement('div');
  v.className = 'visor';
  v.innerHTML = `
    <button class="visor-fechar" aria-label="Fechar">${ICONE.fechar}</button>
    <div class="visor-trilho">${fotos.map((f) => `<div class="visor-item"><img src="${esc(f.url)}" alt=""></div>`).join('')}</div>`;
  document.body.appendChild(v);
  document.body.classList.add('travado');
  const trilho = v.querySelector('.visor-trilho');
  trilho.scrollLeft = inicio * trilho.clientWidth;
  v.querySelector('.visor-fechar').addEventListener('click', () => { v.remove(); document.body.classList.remove('travado'); });
}

async function registrarVenda(store, c) {
  const r = await sheet({
    titulo: 'Registrar venda',
    html: `
      <form id="f-venda" class="form-sheet">
        <label class="campo"><span>Valor da venda</span>
          <div class="com-prefixo"><i>R$</i><input name="valor" inputmode="decimal" value="${esc(valorCampo(c.preco_pedido))}" required></div></label>
        <label class="campo"><span>Data</span><input type="date" name="data" value="${hojeISO()}" required></label>
        <label class="campo"><span>Onde vendeu</span>
          <select name="canal"><option value="">—</option>${CANAIS.map((x) => `<option ${x === c.canal_venda ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
        <label class="campo"><span>Comprador <em>opcional</em></span><input name="comprador" value="${esc(c.comprador || '')}" autocomplete="off"></label>
        <button class="btn btn-primario btn-cheio" type="submit">Confirmar venda</button>
      </form>`,
    aoMontar: (el, fechar) => el.querySelector('#f-venda').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const f = ev.target;
      const valor = lerBRL(f.valor.value);
      if (valor == null) { f.valor.focus(); return; }
      fechar({ valor_venda: valor, data_venda: f.data.value, canal_venda: f.canal.value || null, comprador: f.comprador.value.trim() || null });
    }),
  });
  if (!r) return false;
  await store.salvar({ id: c.id, status: 'vendida', ...r });
  toast('Venda registrada');
  return true;
}

export async function render(root, { store, params, ehAtual }) {
  root.innerHTML = '<div class="carregando"><span class="girando"></span></div>';
  const c = await store.obter(params[0]);
  if (!ehAtual()) return;
  if (!c) {
    root.innerHTML = '<div class="vazio"><h2>Camisa não encontrada</h2><a class="btn" href="#acervo">Voltar ao acervo</a></div>';
    return;
  }
  const recarregar = () => render(root, { store, params, ehAtual });

  root.innerHTML = `
    <div class="barra-topo flutuante">
      <a class="btn-icone" href="#acervo" aria-label="Voltar">${ICONE.voltar}</a>
      <span class="barra-titulo">${numeroFmt(c.numero)}</span>
      <button class="btn-icone" id="mais" aria-label="Mais opções">${ICONE.maisOpcoes}</button>
    </div>
    ${galeria(c.fotos, c)}
    <div class="conteudo">
      <div class="cabecalho-camisa">
        <h1>${esc(titulo(c))}</h1>
        <p class="sub">${esc(subtitulo(c))}</p>
        <div class="linha-selos">
          <button class="selo grande" data-s="${c.status}" id="status">${esc(rotulo(STATUS, c.status))} <span class="seta">▾</span></button>
          <span class="na-loja-tag ${c.publicada ? 'sim' : ''}">${c.publicada ? 'Na loja' : 'Fora da loja'}</span>
        </div>
      </div>

      <section class="cartao">${blocoValores(c)}</section>

      ${secao('A camisa', linhas([
        ['Marca', c.marca], ['Modelo', rotulo(MODELOS, c.modelo)], ['Manga', rotulo(MANGAS, c.manga)], ['Tamanho', c.tamanho],
        ['Jogador', c.jogador], ['Número', c.numero_camisa], ['Patrocínio', c.patrocinio],
      ]))}
      ${secao('Autenticidade', linhas([
        ['Tipo', c.tipo ? `${rotulo(TIPOS, c.tipo)} — ${TIPOS.find((t) => t.v === c.tipo)?.d}` : null],
        ['Código da etiqueta', c.codigo_produto], ['Procedência', c.procedencia], ['Certificado', c.certificado],
      ]))}
      ${secao('Estado', linhas([['Conservação', rotulo(CONSERVACAO, c.conservacao)], ['Defeitos', c.defeitos]]))}
      ${secao('Compra', linhas([
        ['Data', c.data_compra && fmtData(c.data_compra)], ['Valor pago', c.valor_compra != null && fmtBRL(c.valor_compra)],
        ['Custos extras', c.custos_extras != null && fmtBRL(c.custos_extras)], ['Comprou de', c.origem],
      ]))}
      ${c.status === 'vendida' ? secao('Venda', linhas([['Comprador', c.comprador], ['Canal', c.canal_venda]])) : ''}
      ${secao('Observações', c.observacoes ? `<p class="texto-livre">${esc(c.observacoes)}</p>` : '')}
    </div>

    <div class="barra-acao">
      <a class="btn" href="#editar-${c.id}">${ICONE.editar} Editar</a>
      ${c.status !== 'vendida' ? `<button class="btn btn-primario" id="vender">${ICONE.check} Registrar venda</button>` : ''}
    </div>`;

  // barra do topo ganha fundo quando a foto sai da tela
  const barra = root.querySelector('.barra-topo.flutuante');
  const aoRolar = () => barra.classList.toggle('solida', window.scrollY > 160);
  window.addEventListener('scroll', aoRolar, { passive: true });

  // galeria: contador + visor em tela cheia
  const gal = root.querySelector('#galeria');
  if (gal) {
    const cont = root.querySelector('#contador');
    gal.addEventListener('scroll', () => {
      if (cont) cont.textContent = `${Math.round(gal.scrollLeft / gal.clientWidth) + 1}/${c.fotos.length}`;
    }, { passive: true });
    gal.addEventListener('click', (e) => {
      const b = e.target.closest('.galeria-item');
      if (b) abrirVisor(c.fotos, Number(b.dataset.i));
    });
  }

  root.querySelector('#status').addEventListener('click', async () => {
    const novo = await acoes('Mudar status', STATUS.map((s) => ({ valor: s.v, rotulo: s.l, ativo: s.v === c.status })));
    if (!novo || novo === c.status) return;
    if (novo === 'vendida') { if (await registrarVenda(store, c)) recarregar(); return; }
    await store.salvar({ id: c.id, status: novo });
    toast(`Agora: ${rotulo(STATUS, novo)}`);
    recarregar();
  });

  root.querySelector('#vender')?.addEventListener('click', async () => {
    if (await registrarVenda(store, c)) recarregar();
  });

  root.querySelector('#mais').addEventListener('click', async () => {
    const r = await acoes(titulo(c), [
      ...(c.publicada
        ? [{ valor: 'compartilhar', rotulo: 'Compartilhar link da loja' }, { valor: 'ver-loja', rotulo: 'Ver na loja' }, { valor: 'tirar-loja', rotulo: 'Tirar da loja' }]
        : [{ valor: 'por-loja', rotulo: 'Mostrar na loja' }]),
      { valor: 'legenda', rotulo: 'Legenda pro Instagram' },
      { valor: 'etiqueta', rotulo: 'Etiqueta com QR code' },
      { valor: 'editar', rotulo: 'Editar' },
      { valor: 'duplicar', rotulo: 'Duplicar (camisa parecida)' },
      { valor: 'excluir', rotulo: 'Excluir camisa', perigo: true },
    ]);
    const urlLoja = `${CONFIG.LOJA_URL}/camisa/${slugLoja(c)}`;
    if (r === 'ver-loja') window.open(urlLoja, '_blank', 'noopener');
    if (r === 'legenda') mostrarLegenda(c);
    if (r === 'etiqueta') imprimirEtiqueta(c);
    if (r === 'compartilhar') {
      const dados = { title: titulo(c), text: `${titulo(c)}${c.preco_pedido != null && c.status !== 'vendida' ? ` · ${fmtBRL(c.preco_pedido)}` : ''}`, url: urlLoja };
      if (navigator.share) { try { await navigator.share(dados); } catch {} }
      else { try { await navigator.clipboard.writeText(urlLoja); toast('Link copiado'); } catch { toast(urlLoja, { ms: 8000 }); } }
    }
    if (r === 'por-loja' || r === 'tirar-loja') {
      await store.salvar({ id: c.id, publicada: r === 'por-loja' });
      toast(r === 'por-loja' ? 'Agora aparece na loja' : 'Saiu da loja');
      recarregar();
    }
    if (r === 'editar') location.hash = `#editar-${c.id}`;
    if (r === 'duplicar') {
      const { id, numero, fotos, created_at, updated_at, owner_id, ...resto } = c;
      const nova = await store.salvar({
        ...resto, status: 'estoque', data_venda: null, valor_venda: null, canal_venda: null, comprador: null,
        codigo_produto: null, defeitos: null,
      });
      toast('Cópia criada — ajuste o que for diferente');
      location.hash = `#editar-${nova.id}`;
    }
    if (r === 'excluir') {
      if (!(await confirmar('Excluir esta camisa e todas as fotos? Não dá pra desfazer.', { ok: 'Excluir', perigo: true }))) return;
      await store.excluir(c.id);
      toast('Camisa excluída');
      location.hash = '#acervo';
    }
  });

  return () => window.removeEventListener('scroll', aoRolar);
}
