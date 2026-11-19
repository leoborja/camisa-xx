// Ponto de entrada: escolhe o store, cuida do login e das rotas.
// Rotas são hashes simples (#acervo, #nova, #c-<id>, #editar-<id>, #painel, #ajustes).
import { obterStore } from './store/index.js';
import { esc } from './ui.js';
import { ICONE } from './icones.js';
import { carregarExemplos } from './exemplos.js';
import * as acervo from './views/acervo.js';
import * as camisa from './views/camisa.js';
import * as formulario from './views/formulario.js';
import * as painel from './views/painel.js';
import * as ajustes from './views/ajustes.js';
import * as login from './views/login.js';
import * as contatos from './views/contatos.js';
import * as troca from './views/troca.js';
import * as ofertas from './views/ofertas.js';

const ROTAS = [
  [/^acervo$/, acervo],
  [/^nova$/, formulario],
  [/^c-([\w-]+)$/, camisa],
  [/^editar-([\w-]+)$/, formulario],
  [/^painel$/, painel],
  [/^ajustes$/, ajustes],
  [/^contatos$/, contatos],
  [/^contato-[\w-]+$/, contatos],
  [/^troca(?:-[\w-]+)?$/, troca],
  [/^ofertas$/, ofertas],
  [/^oferta-[\w-]+$/, ofertas],
];

const app = document.getElementById('app');
let store;
let usuario;
let limpar;
let navegacao = 0;

function montarTabbar() {
  document.getElementById('tabbar').innerHTML = `
    <a href="#acervo" data-tab="acervo">${ICONE.camisa}<span>Acervo</span></a>
    <a href="#nova" data-tab="nova" class="tab-nova"><span class="tab-nova-bola">${ICONE.mais}</span><span>Nova</span></a>
    <a href="#contatos" data-tab="contatos">${ICONE.pessoas}<span>Contatos</span></a>
    <a href="#painel" data-tab="painel">${ICONE.grafico}<span>Painel</span></a>
    <a href="#ajustes" data-tab="ajustes">${ICONE.ajustes}<span>Ajustes</span></a>`;
}

async function navegar() {
  const minha = ++navegacao;
  const caminho = location.hash.replace(/^#/, '') || 'acervo';
  if (limpar) { try { limpar(); } catch {} limpar = null; }

  if (store.exigeLogin && !usuario) {
    document.body.dataset.tela = 'login';
    return login.render(app, { store });
  }

  for (const [re, view] of ROTAS) {
    const m = caminho.match(re);
    if (!m) continue;
    document.body.dataset.tela = view.tela;
    document.querySelectorAll('#tabbar a').forEach((a) => a.classList.toggle('ativo', a.dataset.tab === caminho));
    window.scrollTo(0, 0);
    try {
      const r = await view.render(app, { store, params: m.slice(1), usuario, ehAtual: () => minha === navegacao });
      if (minha === navegacao) limpar = r; else r?.();
    } catch (e) {
      console.error(e);
      if (minha === navegacao) app.innerHTML = `<div class="vazio"><h2>Algo deu errado</h2><p>${esc(e.message || e)}</p><a class="btn" href="#acervo">Voltar ao acervo</a></div>`;
    }
    return;
  }
  location.replace('#acervo');
}

// No modo demonstração, a primeira visita já abre com camisas de exemplo.
async function semearDemo() {
  const CHAVE = 'cxx:demo-semeado';
  try { if (localStorage.getItem(CHAVE)) return; } catch {}
  if (!(await store.listar()).length) await carregarExemplos(store);
  try { localStorage.setItem(CHAVE, '1'); } catch {}
}

async function iniciar() {
  montarTabbar();
  store = await obterStore();
  document.body.classList.toggle('modo-demo', store.modo === 'demo');
  if (store.modo === 'demo') await semearDemo();
  usuario = await store.usuario();
  store.aoMudarLogin((u) => {
    const mudou = (u?.id || null) !== (usuario?.id || null);
    usuario = u;
    if (mudou) navegar();
  });
  window.addEventListener('hashchange', navegar);
  navegar();
}

iniciar().catch((e) => {
  console.error(e);
  app.innerHTML = `<div class="vazio"><h2>Não consegui abrir o acervo</h2><p>${esc(e.message || e)}</p></div>`;
});
