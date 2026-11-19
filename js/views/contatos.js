// Contatos: clientes (quem compra) e fornecedores (de quem ele compra), com histórico
// de compras, vendas e trocas. Rotas: #contatos · #contato-<id> · #contato-novo · #contato-editar-<id>
import { esc, fmtBRL0, fmtData, normalizar, toast, confirmar, linkWhats, fmtWhats } from '../ui.js';
import { numeroFmt } from '../dominio.js';
import { ICONE } from '../icones.js';

export const tela = 'contatos';

const TIPOS_CONTATO = [
  { v: 'cliente', l: 'Cliente' },
  { v: 'fornecedor', l: 'Fornecedor' },
  { v: 'ambos', l: 'Cliente e fornecedor' },
];
const rotuloTipo = (v) => TIPOS_CONTATO.find((t) => t.v === v)?.l || 'Cliente';
const estado = { q: '', tipo: '' };

function semSuporte(root) {
  root.innerHTML = `<header class="topo"><div><h1>Contatos</h1></div></header>
    <div class="vazio"><p>Os contatos ficam disponíveis no sistema oficial (com banco de dados).</p></div>`;
}

// ---------- lista ----------
async function lista(root, { store, ehAtual }) {
  root.innerHTML = '<div class="carregando"><span class="girando"></span></div>';
  const [contatos, ofertas] = await Promise.all([store.contatos(), store.ofertas().catch(() => [])]);
  if (!ehAtual()) return;
  const novas = ofertas.filter((o) => o.status === 'nova').length;

  root.innerHTML = `
    <header class="topo">
      <div><h1>Contatos</h1><p class="sub">${contatos.length} ${contatos.length === 1 ? 'pessoa' : 'pessoas'}</p></div>
      <a class="btn btn-primario btn-peq" href="#contato-novo">${ICONE.mais} Novo</a>
    </header>
    <a class="cartao-link ofertas-link ${novas ? 'tem' : ''}" href="#ofertas">
      <span><b>Ofertas recebidas pela loja</b><small>${novas ? `${novas} ${novas === 1 ? 'nova esperando resposta' : 'novas esperando resposta'}` : `${ofertas.length} no total`}</small></span>
      ${novas ? `<span class="bolinha">${novas}</span>` : ''}
    </a>
    <div class="fixo-busca">
      <label class="busca">${ICONE.busca}<input type="search" id="q" placeholder="Nome, cidade, clube que curte…" value="${esc(estado.q)}" autocomplete="off"></label>
      <div class="chips" id="chips"></div>
    </div>
    <ul class="lista-contatos" id="lista"></ul>`;

  const elLista = root.querySelector('#lista');
  const elChips = root.querySelector('#chips');
  const texto = (c) => normalizar([c.nome, c.cidade, c.interesses, c.instagram, c.whatsapp].filter(Boolean).join(' '));

  function desenhar() {
    const termos = normalizar(estado.q).split(/\s+/).filter(Boolean);
    const daBusca = contatos.filter((c) => termos.every((t) => texto(c).includes(t)));
    const filtros = [['', 'Todos'], ['cliente', 'Clientes'], ['fornecedor', 'Fornecedores']];
    const passa = (c, f) => !f || c.tipo === f || c.tipo === 'ambos';
    elChips.innerHTML = filtros.map(([v, l]) => `<button class="chip ${estado.tipo === v ? 'ativo' : ''}" data-v="${v}">${l} <b>${daBusca.filter((c) => passa(c, v)).length}</b></button>`).join('');
    const vis = daBusca.filter((c) => passa(c, estado.tipo));
    elLista.innerHTML = vis.length ? vis.map((c) => {
      const hist = [c.compras && `${c.compras} ${c.compras === 1 ? 'compra' : 'compras'}`, c.fornecidas && `vendeu ${c.fornecidas} pra você`, c.trocas && `${c.trocas} ${c.trocas === 1 ? 'troca' : 'trocas'}`].filter(Boolean).join(' · ');
      return `<li><a href="#contato-${c.id}">
        <span class="avatar">${esc((c.nome || '?').trim()[0].toUpperCase())}</span>
        <span class="ct-info"><b>${esc(c.nome)}</b><small>${esc([rotuloTipo(c.tipo), c.cidade, hist].filter(Boolean).join(' · '))}</small>
          ${c.interesses ? `<small class="ct-int">Curte: ${esc(c.interesses)}</small>` : ''}</span>
      </a></li>`;
    }).join('') : `<li class="vazio pequeno"><p>${contatos.length ? 'Ninguém encontrado.' : 'Cadastre quem compra e quem vende pra você. Dá pra avisar essas pessoas quando chegar camisa do time delas.'}</p></li>`;
  }
  root.querySelector('#q').addEventListener('input', (e) => { estado.q = e.target.value; desenhar(); });
  elChips.addEventListener('click', (e) => { const b = e.target.closest('.chip'); if (b) { estado.tipo = b.dataset.v; desenhar(); } });
  desenhar();
}

// ---------- detalhe ----------
async function detalhe(root, { store, id, ehAtual }) {
  root.innerHTML = '<div class="carregando"><span class="girando"></span></div>';
  let c;
  try { c = await store.obterContato(id); } catch (e) {
    if (!ehAtual()) return;
    root.innerHTML = `<div class="vazio"><h2>Contato não encontrado</h2><a class="btn" href="#contatos">Voltar</a></div>`;
    return;
  }
  if (!ehAtual()) return;
  const wa = linkWhats(c.whatsapp, `Olá, ${c.nome.split(' ')[0]}! Aqui é da Camisa XX.`);
  const comprou = c.camisas.filter((x) => x.comprador_id === c.id);
  const vendeu = c.camisas.filter((x) => x.fornecedor_id === c.id);
  const totalComprou = comprou.reduce((s, x) => s + (Number(x.valor_venda) || 0), 0);
  const linhaCamisa = (x, valor, data) => `<li><a href="#c-${x.id}"><span><b>${esc([x.clube, x.temporada].filter(Boolean).join(' '))}</b><small>${numeroFmt(x.numero)}${data ? ` · ${fmtData(data)}` : ''}${x.troca_entrada_id || x.troca_saida_id ? ' · troca' : ''}</small></span><span class="dir">${fmtBRL0(valor)}</span></a></li>`;

  root.innerHTML = `
    <div class="barra-topo">
      <a class="btn-icone" href="#contatos" aria-label="Voltar">${ICONE.voltar}</a>
      <span class="barra-titulo">Contato</span>
      <a class="btn-icone" href="#contato-editar-${c.id}" aria-label="Editar">${ICONE.editar}</a>
    </div>
    <div class="conteudo">
      <div class="cabecalho-camisa">
        <h1>${esc(c.nome)}</h1>
        <p class="sub">${esc([rotuloTipo(c.tipo), c.cidade].filter(Boolean).join(' · '))}</p>
      </div>
      <div class="botoes">
        ${wa ? `<a class="btn btn-primario" href="${esc(wa)}" target="_blank" rel="noopener">WhatsApp ${esc(fmtWhats(c.whatsapp))}</a>` : ''}
        ${c.instagram ? `<a class="btn" href="https://instagram.com/${esc(c.instagram)}" target="_blank" rel="noopener">@${esc(c.instagram)}</a>` : ''}
      </div>
      ${c.interesses || c.observacoes ? `<section class="cartao"><h3>Sobre</h3>
        ${c.interesses ? `<p><b>Curte:</b> ${esc(c.interesses)}</p>` : ''}
        ${c.observacoes ? `<p class="texto-livre">${esc(c.observacoes)}</p>` : ''}</section>` : ''}
      <section class="cartao"><h3>Comprou de você <em>${comprou.length ? fmtBRL0(totalComprou) : ''}</em></h3>
        ${comprou.length ? `<ul class="lista-simples">${comprou.map((x) => linhaCamisa(x, x.valor_venda, x.data_venda)).join('')}</ul>` : '<p class="suave">Nada ainda.</p>'}</section>
      <section class="cartao"><h3>Vendeu pra você</h3>
        ${vendeu.length ? `<ul class="lista-simples">${vendeu.map((x) => linhaCamisa(x, x.valor_compra, x.data_compra)).join('')}</ul>` : '<p class="suave">Nada ainda.</p>'}</section>
      ${c.trocas.length ? `<section class="cartao"><h3>Trocas</h3><ul class="lista-simples">${c.trocas.map((t) => `<li><span><b>${fmtData(t.data)}</b><small>${t.dinheiro > 0 ? `você pagou ${fmtBRL0(t.dinheiro)}` : t.dinheiro < 0 ? `você recebeu ${fmtBRL0(-t.dinheiro)}` : 'sem dinheiro'}</small></span></li>`).join('')}</ul></section>` : ''}
      <a class="btn" href="#troca-contato-${c.id}">Registrar troca com ${esc(c.nome.split(' ')[0])}</a>
      <button class="btn btn-link perigo-link" id="excluir" type="button">Excluir contato</button>
    </div>`;

  root.querySelector('#excluir').addEventListener('click', async () => {
    if (!(await confirmar(`Excluir ${c.nome}? As camisas continuam, só perdem o vínculo.`, { ok: 'Excluir', perigo: true }))) return;
    await store.excluirContato(c.id);
    toast('Contato excluído');
    location.hash = '#contatos';
  });
}

// ---------- formulário ----------
async function formulario(root, { store, id, ehAtual }) {
  document.body.dataset.tela = 'form';
  const c = id ? await store.obterContato(id) : { tipo: 'cliente' };
  if (!ehAtual()) return;
  root.innerHTML = `
    <div class="barra-topo">
      <a class="btn-texto" href="${id ? `#contato-${id}` : '#contatos'}">Cancelar</a>
      <span class="barra-titulo">${id ? 'Editar contato' : 'Novo contato'}</span>
      <span class="btn-texto fantasma"></span>
    </div>
    <form id="f" class="form" novalidate autocomplete="off">
      <section class="cartao">
        <label class="campo"><span>Nome <b class="obrig">*</b></span><input name="nome" value="${esc(c.nome || '')}" autocapitalize="words" required></label>
        <div class="duas" style="margin-top:14px">
          <label class="campo"><span>WhatsApp</span><input name="whatsapp" value="${esc(fmtWhats(c.whatsapp))}" inputmode="tel" placeholder="(31) 99999-9999"></label>
          <label class="campo"><span>Instagram</span><input name="instagram" value="${esc(c.instagram || '')}" autocapitalize="off" autocorrect="off" placeholder="@perfil"></label>
        </div>
        <label class="campo"><span>Cidade</span><input name="cidade" value="${esc(c.cidade || '')}" autocapitalize="words"></label>
        <div class="campo" style="margin-top:14px"><span>É</span>
          <div class="segmentado">${TIPOS_CONTATO.map((t) => `<label><input type="radio" name="tipo" value="${t.v}" ${c.tipo === t.v ? 'checked' : ''}><span>${t.l.replace('Cliente e fornecedor', 'Os dois')}</span></label>`).join('')}</div></div>
        <label class="campo"><span>Curte <em>clubes, seleções, épocas, separados por vírgula</em></span>
          <input name="interesses" value="${esc(c.interesses || '')}" placeholder="Flamengo, Seleção, anos 90"></label>
        <label class="campo"><span>Observações</span><textarea name="observacoes" rows="3">${esc(c.observacoes || '')}</textarea></label>
      </section>
    </form>
    <div class="barra-acao"><button class="btn btn-primario btn-cheio" id="salvar" type="button">Salvar contato</button></div>`;

  root.querySelector('#salvar').addEventListener('click', async () => {
    const f = root.querySelector('#f');
    const fd = new FormData(f);
    const dados = Object.fromEntries(['nome', 'whatsapp', 'instagram', 'cidade', 'tipo', 'interesses', 'observacoes'].map((k) => [k, (fd.get(k) || '').toString().trim()]));
    if (!dados.nome) { f.nome.focus(); toast('Preencha o nome', { erro: true }); return; }
    const btn = root.querySelector('#salvar');
    btn.disabled = true; btn.textContent = 'Salvando…';
    try {
      const salvo = await store.salvarContato({ ...dados, id });
      toast('Contato salvo');
      location.hash = `#contato-${salvo.id}`;
    } catch (e) {
      toast(`Não salvou: ${e.message}`, { erro: true });
      btn.disabled = false; btn.textContent = 'Salvar contato';
    }
  });
}

export async function render(root, ctx) {
  if (!ctx.store.temContatos) return semSuporte(root);
  const rota = location.hash.replace(/^#/, '');
  if (rota === 'contatos') return lista(root, ctx);
  if (rota === 'contato-novo') return formulario(root, { ...ctx, id: null });
  let m = rota.match(/^contato-editar-([\w-]+)$/);
  if (m) return formulario(root, { ...ctx, id: m[1] });
  m = rota.match(/^contato-([\w-]+)$/);
  if (m) return detalhe(root, { ...ctx, id: m[1] });
}
