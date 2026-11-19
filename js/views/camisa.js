// Detalhe de uma camisa: galeria, preço/lucro, ficha completa, ações rápidas.
import { esc, fmtBRL, fmtPct, fmtData, hojeISO, lerBRL, valorCampo, toast, acoes, confirmar, sheet, normalizar, linkWhats, fmtWhats } from '../ui.js';
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

function blocoTroca(t, lado) {
  if (!t) return '';
  const quem = t.contato ? `<a href="#contato-${t.contato.id}"><b>${esc(t.contato.nome)}</b></a>` : 'alguém';
  const outras = (t.outras || []).filter((x) => (lado === 'entrada' ? x.troca_saida_id === t.id : x.troca_entrada_id === t.id));
  const dinheiro = t.dinheiro > 0 ? ` + você pagou ${fmtBRL(t.dinheiro)}` : t.dinheiro < 0 ? ` e você recebeu ${fmtBRL(-t.dinheiro)}` : '';
  const lista = outras.map((x) => `<a href="#c-${x.id}">${esc([x.clube, x.temporada].filter(Boolean).join(' '))}</a>`).join(', ') || 'outra camisa';
  return `<section class="cartao"><h3>Troca <em>${fmtData(t.data)}</em></h3><p class="texto-troca">${lado === 'entrada'
    ? `Chegou numa troca com ${quem}: saiu ${lista}${dinheiro}.`
    : `Saiu numa troca com ${quem}: entrou ${lista}${dinheiro}.`}</p></section>`;
}

async function avisarInteressados(store, c) {
  const lista = await store.interessados(c.id);
  const url = `${CONFIG.LOJA_URL}/camisa/${slugLoja(c)}`;
  const msg = (nome) => `Fala, ${nome.split(' ')[0]}! Chegou uma camisa que é a sua cara: ${titulo(c)}${c.tamanho ? `, tamanho ${c.tamanho}` : ''}${c.preco_pedido != null && c.status !== 'vendida' ? ` por ${fmtBRL(c.preco_pedido)}` : ''}.${c.publicada ? ` Dá uma olhada: ${url}` : ''}`;
  await sheet({
    titulo: `Avisar quem curte ${c.clube}`,
    html: lista.length ? `<div class="form-sheet"><p class="suave">Toque em cada um pra abrir o WhatsApp com a mensagem pronta.</p>
      <ul class="lista-simples escolha">${lista.map((p) => `<li><a href="${esc(linkWhats(p.whatsapp, msg(p.nome)))}" target="_blank" rel="noopener" class="enviado-toggle">
        <span><b>${esc(p.nome)}</b><small>${esc(p.motivos.join(' · '))} · ${esc(fmtWhats(p.whatsapp))}</small></span><span class="dir">Enviar →</span></a></li>`).join('')}</ul></div>`
      : `<div class="form-sheet"><p>Ninguém ligado a ${esc(c.clube)} ainda.</p><p class="suave">Quando você registra uma venda com o WhatsApp do comprador, ou preenche o campo "Curte" de um contato, ele passa a aparecer aqui.</p><a class="btn" href="#contatos">Ver contatos</a></div>`,
    aoMontar: (el) => el.querySelectorAll('.enviado-toggle').forEach((a) => a.addEventListener('click', () => a.classList.add('enviado'))),
  });
}

async function registrarVenda(store, c) {
  const contatos = store.contatos ? await store.contatos().catch(() => []) : [];
  const r = await sheet({
    titulo: 'Registrar venda',
    html: `
      <form id="f-venda" class="form-sheet">
        <label class="campo"><span>Valor da venda</span>
          <div class="com-prefixo"><i>R$</i><input name="valor" inputmode="decimal" value="${esc(valorCampo(c.preco_pedido))}" required></div></label>
        <label class="campo"><span>Data</span><input type="date" name="data" value="${hojeISO()}" required></label>
        <label class="campo"><span>Onde vendeu</span>
          <select name="canal"><option value="">—</option>${CANAIS.map((x) => `<option ${x === c.canal_venda ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
        <label class="campo"><span>Comprador <em>opcional</em></span><input name="comprador" value="${esc(c.comprador || '')}" autocomplete="off" list="dl-comp" autocapitalize="words"></label>
        <datalist id="dl-comp">${contatos.map((x) => `<option value="${esc(x.nome)}">`).join('')}</datalist>
        ${store.contatos ? '<label class="campo" id="whats-comp" hidden><span>WhatsApp do comprador <em>vira contato pra você avisar quando chegar camisa do time dele</em></span><input name="whats" inputmode="tel" placeholder="(31) 99999-9999"></label>' : ''}
        <button class="btn btn-primario btn-cheio" type="submit">Confirmar venda</button>
      </form>`,
    aoMontar: (el, fechar) => {
      const f = el.querySelector('#f-venda');
      const achar = () => contatos.find((x) => normalizar(x.nome) === normalizar(f.comprador.value.trim()));
      const ver = () => { const w = el.querySelector('#whats-comp'); if (w) w.hidden = !f.comprador.value.trim() || Boolean(achar()); };
      f.comprador.addEventListener('input', ver); ver();
      f.addEventListener('submit', (ev) => {
        ev.preventDefault();
        const valor = lerBRL(f.valor.value);
        if (valor == null) { f.valor.focus(); return; }
        fechar({ valor_venda: valor, data_venda: f.data.value, canal_venda: f.canal.value || null, comprador: f.comprador.value.trim() || null,
          _contato: achar() || null, _whats: f.whats?.value || '' });
      });
    },
  });
  if (!r) return false;
  const { _contato, _whats, ...venda } = r;
  let comprador_id = _contato?.id || null;
  if (!comprador_id && venda.comprador && store.salvarContato) {
    const novo = await store.salvarContato({ nome: venda.comprador, whatsapp: _whats, tipo: 'cliente', interesses: c.clube });
    comprador_id = novo.id;
  }
  await store.salvar({ id: c.id, status: 'vendida', ...venda, ...(comprador_id ? { comprador_id } : {}) });
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
        ['Custos extras', c.custos_extras != null && fmtBRL(c.custos_extras)], ['Comprou de', c.fornecedor ? null : c.origem],
      ]) + (c.fornecedor ? `<a class="link-contato" href="#contato-${c.fornecedor.id}">Comprou de <b>${esc(c.fornecedor.nome)}</b> →</a>` : ''))}
      ${blocoTroca(c.troca_entrada, 'entrada')}${blocoTroca(c.troca_saida, 'saida')}
      ${c.status === 'vendida' ? secao('Venda', linhas([['Comprador', c.comprador_contato ? null : c.comprador], ['Canal', c.canal_venda]])
        + (c.comprador_contato ? `<a class="link-contato" href="#contato-${c.comprador_contato.id}">Vendida pra <b>${esc(c.comprador_contato.nome)}</b> →</a>` : '')) : ''}
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
      ...(store.interessados ? [{ valor: 'avisar', rotulo: 'Avisar interessados no WhatsApp' }] : []),
      ...(store.registrarTroca && c.status !== 'vendida' ? [{ valor: 'trocar', rotulo: 'Registrar troca com esta camisa' }] : []),
      { valor: 'legenda', rotulo: 'Legenda pro Instagram' },
      { valor: 'etiqueta', rotulo: 'Etiqueta com QR code' },
      { valor: 'editar', rotulo: 'Editar' },
      { valor: 'duplicar', rotulo: 'Duplicar (camisa parecida)' },
      { valor: 'excluir', rotulo: 'Excluir camisa', perigo: true },
    ]);
    const urlLoja = `${CONFIG.LOJA_URL}/camisa/${slugLoja(c)}`;
    if (r === 'ver-loja') window.open(urlLoja, '_blank', 'noopener');
    if (r === 'avisar') avisarInteressados(store, c);
    if (r === 'trocar') location.hash = `#troca-${c.id}`;
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
