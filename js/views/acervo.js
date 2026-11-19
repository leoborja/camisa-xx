// Lista do acervo: busca, filtro por status, ordenação, grade de fotos.
import { esc, fmtBRL0, normalizar, toast } from '../ui.js';
import { STATUS, MODELOS, rotulo, custo, numeroFmt, decada } from '../dominio.js';
import { ICONE, arteCamisa } from '../icones.js';
import { carregarExemplos } from '../exemplos.js';
import { deveOferecer, blocoTransferencia, ligarTransferencia } from '../migrar.js';

export const tela = 'lista';

// Fica entre navegações: voltar do detalhe mantém busca, filtro e rolagem.
const estado = { q: '', filtro: 'acervo', ordem: 'recentes', scroll: 0 };

const FILTROS = [
  { v: 'acervo', l: 'No acervo', f: (c) => c.status !== 'vendida' },
  { v: 'estoque', l: 'Em estoque', f: (c) => c.status === 'estoque' },
  { v: 'anunciada', l: 'Anunciadas', f: (c) => c.status === 'anunciada' },
  { v: 'reservada', l: 'Reservadas', f: (c) => c.status === 'reservada' },
  { v: 'vendida', l: 'Vendidas', f: (c) => c.status === 'vendida' },
  { v: 'colecao', l: 'Coleção', f: (c) => c.status === 'colecao' },
  { v: 'todas', l: 'Todas', f: () => true },
];

const ORDENS = [
  { v: 'recentes', l: 'Mais recentes', f: (a, b) => (b.created_at || '').localeCompare(a.created_at || '') },
  { v: 'clube', l: 'Clube (A–Z)', f: (a, b) => a.clube.localeCompare(b.clube, 'pt-BR') || (a.ano || 0) - (b.ano || 0) },
  { v: 'antigas', l: 'Mais antigas', f: (a, b) => (a.ano || 9999) - (b.ano || 9999) },
  { v: 'preco', l: 'Maior preço', f: (a, b) => (Number(b.preco_pedido) || 0) - (Number(a.preco_pedido) || 0) },
];

const textoBusca = (c) => normalizar([
  c.clube, c.temporada, c.jogador, c.numero_camisa, c.marca, c.patrocinio, c.tamanho, numeroFmt(c.numero),
  c.codigo_produto, c.origem, c.comprador, c.observacoes, rotulo(MODELOS, c.modelo), decada(c.ano),
].filter(Boolean).join(' '));

function precoCartao(c) {
  if (c.status === 'vendida') return `<span class="preco vendido">${fmtBRL0(c.valor_venda)}</span>`;
  if (c.preco_pedido != null) return `<span class="preco">${fmtBRL0(c.preco_pedido)}</span>`;
  const k = custo(c);
  return k != null ? `<span class="preco suave">custo ${fmtBRL0(k)}</span>` : '<span class="preco suave">sem preço</span>';
}

function cartao(c) {
  const capa = c.fotos?.[0];
  const sub = [c.temporada, rotulo(MODELOS, c.modelo), c.tamanho].filter(Boolean).join(' · ');
  return `
    <a class="cartao-camisa" href="#c-${c.id}">
      <div class="cartao-foto">
        ${capa ? `<img src="${esc(capa.thumb)}" alt="" loading="lazy" decoding="async">` : arteCamisa(c)}
        <span class="selo" data-s="${c.status}">${esc(rotulo(STATUS, c.status))}</span>
      </div>
      <div class="cartao-info">
        <div class="cartao-titulo">${esc(c.clube)}</div>
        <div class="cartao-sub">${esc(sub) || '&nbsp;'}</div>
        <div class="cartao-rodape">${precoCartao(c)}<span class="codigo">${numeroFmt(c.numero)}</span></div>
      </div>
    </a>`;
}

export async function render(root, { store, ehAtual }) {
  root.innerHTML = '<div class="carregando"><span class="girando"></span></div>';
  const todas = (await store.listar()).map((c) => ({ ...c, _busca: textoBusca(c) }));
  const transf = deveOferecer(store) ? await blocoTransferencia(store) : '';
  if (!ehAtual()) return;
  const recarregar = () => render(root, { store, ehAtual });

  if (!todas.length) {
    root.innerHTML = `
      <header class="topo"><div><h1>Acervo</h1></div></header>
      ${transf}
      <div class="vazio">
        <div class="vazio-icone">${ICONE.camisa}</div>
        <h2>Nenhuma camisa ainda</h2>
        <p>Cadastre a primeira: tire as fotos, preencha o que souber e complete depois.</p>
        <a class="btn btn-primario" href="#nova">Cadastrar camisa</a>
        ${store.modo === 'demo' ? '<button class="btn btn-link" id="exemplos">ou carregar exemplos pra testar</button>' : ''}
      </div>`;
    root.querySelector('#exemplos')?.addEventListener('click', async () => {
      await carregarExemplos(store);
      toast('Exemplos carregados');
      render(root, { store, ehAtual });
    });
    return;
  }

  const noAcervo = todas.filter((c) => c.status !== 'vendida');
  const investido = noAcervo.reduce((s, c) => s + (custo(c) || 0), 0);

  root.innerHTML = `
    <header class="topo">
      <div>
        <h1>Acervo</h1>
        <p class="sub">${noAcervo.length} ${noAcervo.length === 1 ? 'camisa' : 'camisas'} · ${fmtBRL0(investido)} investidos</p>
      </div>
    </header>
    ${transf}
    <div class="fixo-busca">
      <label class="busca">${ICONE.busca}
        <input type="search" id="q" placeholder="Clube, ano, jogador, código…" value="${esc(estado.q)}" enterkeyhint="search" autocomplete="off" autocorrect="off">
      </label>
      <div class="chips" id="chips"></div>
    </div>
    <div class="linha-ordem">
      <span id="contagem" class="suave"></span>
      <label class="ordem">
        <select id="ordem">${ORDENS.map((o) => `<option value="${o.v}" ${o.v === estado.ordem ? 'selected' : ''}>${o.l}</option>`).join('')}</select>
      </label>
    </div>
    <div class="grade" id="grade"></div>`;

  const elChips = root.querySelector('#chips');
  const elGrade = root.querySelector('#grade');
  const elContagem = root.querySelector('#contagem');

  function desenhar() {
    const termos = normalizar(estado.q).split(/\s+/).filter(Boolean);
    const daBusca = todas.filter((c) => termos.every((t) => c._busca.includes(t)));

    elChips.innerHTML = FILTROS.map((f) => {
      const n = daBusca.filter(f.f).length;
      if (!n && f.v !== estado.filtro && !['acervo', 'todas'].includes(f.v)) return '';
      return `<button class="chip ${f.v === estado.filtro ? 'ativo' : ''}" data-v="${f.v}">${f.l} <b>${n}</b></button>`;
    }).join('');

    const filtro = FILTROS.find((f) => f.v === estado.filtro) || FILTROS[0];
    const ordem = ORDENS.find((o) => o.v === estado.ordem) || ORDENS[0];
    const lista = daBusca.filter(filtro.f).sort(ordem.f);

    elContagem.textContent = `${lista.length} ${lista.length === 1 ? 'resultado' : 'resultados'}`;
    elGrade.innerHTML = lista.length
      ? lista.map(cartao).join('')
      : `<div class="vazio pequeno"><p>Nada encontrado${estado.q ? ` para “${esc(estado.q)}”` : ''}.</p></div>`;
  }

  root.querySelector('#q').addEventListener('input', (e) => { estado.q = e.target.value; desenhar(); });
  root.querySelector('#q').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });
  root.querySelector('#ordem').addEventListener('change', (e) => { estado.ordem = e.target.value; desenhar(); });
  elChips.addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    estado.filtro = b.dataset.v;
    desenhar();
  });

  ligarTransferencia(root, store, recarregar);
  desenhar();
  requestAnimationFrame(() => window.scrollTo(0, estado.scroll));
  return () => { estado.scroll = window.scrollY; };
}
