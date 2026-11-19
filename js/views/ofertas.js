// Ofertas que chegam pela loja ("Tem uma camisa guardada?"): curadoria do tio.
// Rotas: #ofertas · #oferta-<id>
import { esc, fmtBRL0, fmtData, toast, confirmar, linkWhats, fmtWhats } from '../ui.js';
import { CONSERVACAO, rotulo } from '../dominio.js';
import { ICONE } from '../icones.js';

export const tela = 'detalhe';

const STATUS_OFERTA = { nova: 'Nova', em_conversa: 'Em conversa', aceita: 'Aceita', recusada: 'Recusada' };
const INTENCAO = { vender: 'Quer vender', trocar: 'Quer trocar', tanto_faz: 'Vender ou trocar' };

async function lista(root, { store, ehAtual }) {
  root.innerHTML = '<div class="carregando"><span class="girando"></span></div>';
  const ofertas = await store.ofertas();
  if (!ehAtual()) return;
  root.innerHTML = `
    <div class="barra-topo">
      <a class="btn-icone" href="#contatos" aria-label="Voltar">${ICONE.voltar}</a>
      <span class="barra-titulo">Ofertas</span><span class="btn-texto fantasma"></span>
    </div>
    <p class="suave" style="margin:4px 0 14px">Camisas que as pessoas mandaram pela loja, no "Tem uma camisa guardada?".</p>
    <ul class="lista-ofertas">${ofertas.length ? ofertas.map((o) => `
      <li><a href="#oferta-${o.id}" class="${o.status}">
        <span class="of-foto">${o.fotos ? `<img src="${esc(store.fotoOferta(o.id, 0, true))}" alt="" loading="lazy">` : ICONE.camisa}</span>
        <span class="of-info"><b>${esc([o.clube, o.temporada].filter(Boolean).join(' '))}</b>
          <small>${esc(o.nome)} · ${esc(INTENCAO[o.intencao] || '')}${o.preco_desejado ? ` · ${fmtBRL0(o.preco_desejado)}` : ''}</small>
          <small>${fmtData(o.created_at)}</small></span>
        <span class="selo" data-s="${o.status === 'nova' ? 'anunciada' : o.status === 'aceita' ? 'vendida' : o.status === 'em_conversa' ? 'reservada' : 'estoque'}">${STATUS_OFERTA[o.status]}</span>
      </a></li>`).join('') : '<li class="vazio pequeno"><p>Nenhuma oferta ainda. Elas chegam pelo formulário da loja.</p></li>'}</ul>`;
}

async function detalhe(root, { store, id, ehAtual }) {
  root.innerHTML = '<div class="carregando"><span class="girando"></span></div>';
  const o = await store.obterOferta(id);
  if (!ehAtual()) return;
  const fotos = Array.from({ length: o.fotos }, (_, n) => n);
  const wa = linkWhats(o.whatsapp, `Olá, ${o.nome.split(' ')[0]}! Aqui é da Camisa XX. Vi sua camisa ${[o.clube, o.temporada].filter(Boolean).join(' ')} que você mandou pelo site.`);
  root.innerHTML = `
    <div class="barra-topo">
      <a class="btn-icone" href="#ofertas" aria-label="Voltar">${ICONE.voltar}</a>
      <span class="barra-titulo">Oferta</span><span class="btn-texto fantasma"></span>
    </div>
    ${fotos.length ? `<div class="galeria-wrap"><div class="galeria">${fotos.map((n) => `<a class="galeria-item" href="${esc(store.fotoOferta(o.id, n))}" target="_blank"><img src="${esc(store.fotoOferta(o.id, n))}" alt=""></a>`).join('')}</div></div>` : ''}
    <div class="conteudo">
      <div class="cabecalho-camisa">
        <h1>${esc([o.clube, o.temporada].filter(Boolean).join(' '))}</h1>
        <p class="sub">${esc([o.tamanho && `Tamanho ${o.tamanho}`, rotulo(CONSERVACAO, o.conservacao)].filter(Boolean).join(' · '))}</p>
        <div class="linha-selos"><span class="selo grande" data-s="anunciada">${esc(INTENCAO[o.intencao])}</span>${o.preco_desejado ? `<span class="na-loja-tag sim">Pede ${fmtBRL0(o.preco_desejado)}</span>` : ''}</div>
      </div>
      <section class="cartao"><h3>Quem mandou</h3>
        <dl class="ficha"><div><dt>Nome</dt><dd>${esc(o.nome)}</dd></div><div><dt>WhatsApp</dt><dd>${esc(fmtWhats(o.whatsapp))}</dd></div>
        ${o.cidade ? `<div><dt>Cidade</dt><dd>${esc(o.cidade)}</dd></div>` : ''}<div><dt>Recebida</dt><dd>${fmtData(o.created_at)}</dd></div></dl>
        ${o.mensagem ? `<p class="texto-livre" style="margin-top:12px">${esc(o.mensagem)}</p>` : ''}
      </section>
      ${o.camisa_id ? `<a class="btn" href="#c-${o.camisa_id}">Ver a camisa no acervo</a>` : ''}
    </div>
    <div class="barra-acao">
      ${wa ? `<a class="btn" id="conversar" href="${esc(wa)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
      ${o.status !== 'aceita' ? '<button class="btn btn-primario" id="aceitar" type="button">Aceitar</button>' : ''}
      ${o.status !== 'recusada' && o.status !== 'aceita' ? '<button class="btn btn-icone-texto" id="recusar" type="button">Recusar</button>' : ''}
    </div>`;

  root.querySelector('#conversar')?.addEventListener('click', () => { if (o.status === 'nova') store.statusOferta(o.id, 'em_conversa').catch(() => {}); });
  root.querySelector('#aceitar')?.addEventListener('click', async () => {
    if (!(await confirmar('Aceitar a oferta? A camisa entra no acervo (fora da loja) com as fotos, e a pessoa vira um contato fornecedor.', { ok: 'Aceitar e criar camisa' }))) return;
    const r = await store.aceitarOferta(o.id);
    toast('Camisa criada. Complete o valor que você pagou.');
    location.hash = `#editar-${r.camisa_id}`;
  });
  root.querySelector('#recusar')?.addEventListener('click', async () => {
    const r = await confirmar('Marcar como recusada?', { ok: 'Recusar' });
    if (!r) return;
    await store.statusOferta(o.id, 'recusada');
    toast('Oferta recusada');
    detalhe(root, { store, id, ehAtual });
  });
}

export async function render(root, ctx) {
  if (!ctx.store.ofertas) { root.innerHTML = '<div class="vazio"><p>Disponível no sistema oficial.</p></div>'; return; }
  const m = location.hash.match(/^#oferta-([\w-]+)$/);
  return m ? detalhe(root, { ...ctx, id: m[1] }) : lista(root, ctx);
}
