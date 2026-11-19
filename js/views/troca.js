// Registrar troca (escambo): camisas que saem + camisas que entram + diferença em dinheiro.
// Rotas: #troca · #troca-<camisaId> (já com essa camisa saindo) · #troca-contato-<contatoId>
// Conta: valor das que saem + dinheiro que ele paga = valor das que entram (ou − o que ele recebe).
import { esc, fmtBRL, lerBRL, valorCampo, hojeISO, toast, sheet, normalizar, fmtWhats } from '../ui.js';
import { STATUS, rotulo, custo, titulo, numeroFmt } from '../dominio.js';
import { ICONE, arteCamisa } from '../icones.js';

export const tela = 'form';

export async function render(root, { store, ehAtual }) {
  if (!store.registrarTroca) {
    root.innerHTML = '<div class="vazio"><p>Trocas ficam disponíveis no sistema oficial.</p><a class="btn" href="#acervo">Voltar</a></div>';
    return;
  }
  root.innerHTML = '<div class="carregando"><span class="girando"></span></div>';
  const rota = location.hash.replace(/^#/, '');
  const [camisas, contatos] = await Promise.all([store.listar(), store.contatos()]);
  if (!ehAtual()) return;

  const disponiveis = camisas.filter((c) => c.status !== 'vendida');
  const valorSugerido = (c) => (c.preco_pedido != null ? Number(c.preco_pedido) : custo(c) ?? 0);
  const estado = {
    saidas: [], // {c, valor}
    entradas: [{ clube: '', temporada: '', tamanho: '', valor: null, manual: false }],
    modo: 'nenhum', // nenhum | pago | recebo
    dinheiro: 0,
    contatoId: null,
  };
  let m = rota.match(/^troca-([\w-]+)$/);
  if (m && !rota.startsWith('troca-contato-')) {
    const c = disponiveis.find((x) => x.id === m[1]);
    if (c) estado.saidas.push({ c, valor: valorSugerido(c) });
  }
  m = rota.match(/^troca-contato-([\w-]+)$/);
  const contatoInicial = m ? contatos.find((x) => x.id === m[1]) : null;

  root.innerHTML = `
    <div class="barra-topo">
      <button class="btn-texto" id="cancelar" type="button">Cancelar</button>
      <span class="barra-titulo">Registrar troca</span>
      <span class="btn-texto fantasma"></span>
    </div>
    <form id="f" class="form" novalidate autocomplete="off">
      <section class="cartao">
        <h3>Com quem</h3>
        <label class="campo"><span>Nome</span>
          <input name="contato" list="dl-contatos" value="${esc(contatoInicial?.nome || '')}" autocapitalize="words" placeholder="Busque ou digite um nome novo"></label>
        <label class="campo" id="campo-whats"><span>WhatsApp <em>pra salvar o contato</em></span><input name="whatsapp" inputmode="tel" placeholder="(31) 99999-9999"></label>
        <datalist id="dl-contatos">${contatos.map((c) => `<option value="${esc(c.nome)}">${esc(fmtWhats(c.whatsapp) || '')}</option>`).join('')}</datalist>
        <label class="campo"><span>Data</span><input type="date" name="data" value="${hojeISO()}"></label>
      </section>

      <section class="cartao">
        <h3>Você entrega <em>sai do acervo</em></h3>
        <div id="saidas" class="troca-lista"></div>
        <button class="btn btn-cheio" type="button" id="add-saida">${ICONE.mais} Escolher camisa do acervo</button>
      </section>

      <section class="cartao">
        <h3>Você recebe <em>entra no acervo</em></h3>
        <div id="entradas" class="troca-lista"></div>
        <button class="btn btn-cheio" type="button" id="add-entrada">${ICONE.mais} Outra camisa recebida</button>
        <p class="suave nota">Depois de salvar, você completa as fotos e os detalhes de cada camisa que chegou.</p>
      </section>

      <section class="cartao">
        <h3>Diferença em dinheiro</h3>
        <div class="segmentado" id="modo">
          <label><input type="radio" name="modo" value="nenhum" checked><span>Sem dinheiro</span></label>
          <label><input type="radio" name="modo" value="pago"><span>Eu pago</span></label>
          <label><input type="radio" name="modo" value="recebo"><span>Eu recebo</span></label>
        </div>
        <label class="campo" id="campo-dinheiro" hidden style="margin-top:14px"><span>Quanto</span>
          <div class="com-prefixo"><i>R$</i><input name="dinheiro" inputmode="decimal" placeholder="0"></div></label>
        <div class="troca-resumo" id="resumo"></div>
      </section>

      <section class="cartao">
        <h3>Observações</h3>
        <textarea name="observacoes" rows="2" placeholder="Ex.: troca combinada na feira de domingo"></textarea>
      </section>
    </form>
    <div class="barra-acao"><button class="btn btn-primario btn-cheio" id="salvar" type="button">Registrar troca</button></div>`;

  const f = root.querySelector('#f');
  const elSaidas = root.querySelector('#saidas');
  const elEntradas = root.querySelector('#entradas');
  const elResumo = root.querySelector('#resumo');
  const campoWhats = root.querySelector('#campo-whats');

  const totalSaidas = () => estado.saidas.reduce((s, x) => s + (Number(x.valor) || 0), 0);
  const totalEntradas = () => estado.entradas.reduce((s, x) => s + (Number(x.valor) || 0), 0);
  const dinheiroAssinado = () => (estado.modo === 'pago' ? estado.dinheiro : estado.modo === 'recebo' ? -estado.dinheiro : 0);

  function contatoAtual() {
    const nome = f.contato.value.trim();
    const achado = contatos.find((c) => normalizar(c.nome) === normalizar(nome));
    campoWhats.hidden = !nome || Boolean(achado);
    return { nome, achado };
  }

  // Se só tem uma camisa entrando e o valor dela não foi digitado à mão, ela fecha a conta sozinha.
  function autoBalancear() {
    const auto = estado.entradas.filter((e) => !e.manual);
    if (auto.length === 1) {
      const outras = estado.entradas.filter((e) => e !== auto[0]).reduce((s, e) => s + (Number(e.valor) || 0), 0);
      auto[0].valor = Math.max(0, totalSaidas() + dinheiroAssinado() - outras);
      const inp = elEntradas.querySelector(`[data-i="${estado.entradas.indexOf(auto[0])}"] input[name="valor"]`);
      if (inp && document.activeElement !== inp) inp.value = valorCampo(auto[0].valor);
    }
  }

  function resumo() {
    autoBalancear();
    const s = totalSaidas();
    const d = dinheiroAssinado();
    const e = totalEntradas();
    const dif = Math.round((s + d - e) * 100) / 100;
    elResumo.innerHTML = `
      <div><span>Você entrega em camisas</span><b>${fmtBRL(s)}</b></div>
      ${d ? `<div><span>${d > 0 ? '+ você paga' : '− você recebe'}</span><b>${fmtBRL(Math.abs(d))}</b></div>` : ''}
      <div class="total"><span>Valor das camisas que chegam</span><b>${fmtBRL(e)}</b></div>
      ${Math.abs(dif) > 0.009 ? `<p class="aviso-dif">A conta não fecha: sobram ${fmtBRL(Math.abs(dif))} ${dif > 0 ? 'do seu lado' : 'do lado dele'}. Ajuste os valores ou o dinheiro.</p>` : '<p class="ok-dif">A conta fecha ✓</p>'}`;
  }

  function desenharSaidas() {
    elSaidas.innerHTML = estado.saidas.length ? estado.saidas.map((x, i) => `
      <div class="troca-item" data-i="${i}">
        <div class="troca-capa">${x.c.fotos?.[0] ? `<img src="${esc(x.c.fotos[0].thumb)}" alt="">` : arteCamisa(x.c)}</div>
        <div class="troca-txt"><b>${esc(titulo(x.c))}</b><small>${numeroFmt(x.c.numero)} · custo ${fmtBRL(custo(x.c))}</small>
          <label class="valor-troca"><span>Vale na troca</span><div class="com-prefixo"><i>R$</i><input name="valor" inputmode="decimal" value="${esc(valorCampo(x.valor))}"></div></label></div>
        <button class="btn-icone peq" type="button" data-remover="${i}" aria-label="Tirar">${ICONE.fechar}</button>
      </div>`).join('') : '<p class="suave">Nenhuma camisa escolhida.</p>';
  }
  function desenharEntradas() {
    elEntradas.innerHTML = estado.entradas.map((x, i) => `
      <div class="troca-item entrada" data-i="${i}">
        <div class="troca-txt">
          <div class="duas"><label class="campo"><span>Clube</span><input name="clube" value="${esc(x.clube)}" autocapitalize="words" list="dl-clubes"></label>
            <label class="campo"><span>Temporada</span><input name="temporada" value="${esc(x.temporada)}" placeholder="1994"></label></div>
          <div class="duas"><label class="campo"><span>Tamanho</span><input name="tamanho" value="${esc(x.tamanho)}" autocapitalize="characters"></label>
            <label class="campo"><span>Vale na troca</span><div class="com-prefixo"><i>R$</i><input name="valor" inputmode="decimal" value="${esc(valorCampo(x.valor))}"></div></label></div>
        </div>
        ${estado.entradas.length > 1 ? `<button class="btn-icone peq" type="button" data-remover-e="${i}" aria-label="Tirar">${ICONE.fechar}</button>` : ''}
      </div>`).join('') + `<datalist id="dl-clubes">${[...new Set(camisas.map((c) => c.clube))].map((c) => `<option value="${esc(c)}">`).join('')}</datalist>`;
  }

  elSaidas.addEventListener('input', (e) => {
    const item = e.target.closest('.troca-item');
    if (!item) return;
    estado.saidas[Number(item.dataset.i)].valor = lerBRL(e.target.value) ?? 0;
    resumo();
  });
  elSaidas.addEventListener('click', (e) => {
    const b = e.target.closest('[data-remover]');
    if (!b) return;
    estado.saidas.splice(Number(b.dataset.remover), 1);
    desenharSaidas(); resumo();
  });
  elEntradas.addEventListener('input', (e) => {
    const item = e.target.closest('.troca-item');
    if (!item) return;
    const x = estado.entradas[Number(item.dataset.i)];
    if (e.target.name === 'valor') { x.valor = lerBRL(e.target.value); x.manual = e.target.value.trim() !== ''; }
    else x[e.target.name] = e.target.value;
    resumo();
  });
  elEntradas.addEventListener('click', (e) => {
    const b = e.target.closest('[data-remover-e]');
    if (!b) return;
    estado.entradas.splice(Number(b.dataset.removerE), 1);
    desenharEntradas(); resumo();
  });
  root.querySelector('#add-entrada').addEventListener('click', () => {
    estado.entradas.push({ clube: '', temporada: '', tamanho: '', valor: null, manual: false });
    desenharEntradas(); resumo();
  });
  root.querySelector('#add-saida').addEventListener('click', async () => {
    const ja = new Set(estado.saidas.map((x) => x.c.id));
    const opcoes = disponiveis.filter((c) => !ja.has(c.id));
    const escolhida = await sheet({
      titulo: 'Qual camisa sai?',
      html: `<div class="form-sheet">
        <label class="busca">${ICONE.busca}<input type="search" id="q-troca" placeholder="Buscar no acervo" autocomplete="off"></label>
        <ul class="lista-simples escolha" id="op">${opcoes.map((c) => `<li><button type="button" data-id="${c.id}"><span><b>${esc(titulo(c))}</b><small>${numeroFmt(c.numero)} · ${esc(rotulo(STATUS, c.status))}</small></span><span class="dir">${fmtBRL(c.preco_pedido)}</span></button></li>`).join('') || '<li class="suave">Nenhuma camisa disponível.</li>'}</ul>
      </div>`,
      aoMontar: (el, fechar) => {
        el.querySelector('#q-troca').addEventListener('input', (e) => {
          const t = normalizar(e.target.value);
          el.querySelectorAll('#op li').forEach((li) => { li.hidden = !normalizar(li.textContent).includes(t); });
        });
        el.querySelector('#op').addEventListener('click', (e) => { const b = e.target.closest('[data-id]'); if (b) fechar(b.dataset.id); });
      },
    });
    const c = opcoes.find((x) => x.id === escolhida);
    if (!c) return;
    estado.saidas.push({ c, valor: valorSugerido(c) });
    desenharSaidas(); resumo();
  });
  root.querySelector('#modo').addEventListener('change', (e) => {
    estado.modo = e.target.value;
    root.querySelector('#campo-dinheiro').hidden = estado.modo === 'nenhum';
    resumo();
  });
  f.dinheiro.addEventListener('input', () => { estado.dinheiro = lerBRL(f.dinheiro.value) || 0; resumo(); });
  f.contato.addEventListener('input', contatoAtual);
  root.querySelector('#cancelar').addEventListener('click', () => history.length > 1 ? history.back() : (location.hash = '#acervo'));

  root.querySelector('#salvar').addEventListener('click', async () => {
    if (!estado.saidas.length) { toast('Escolha a camisa que sai', { erro: true }); return; }
    if (estado.entradas.some((x) => !x.clube.trim())) { toast('Preencha o clube de cada camisa que entra', { erro: true }); return; }
    const dif = totalSaidas() + dinheiroAssinado() - totalEntradas();
    if (Math.abs(dif) > 0.009) { toast('A conta da troca não fecha: ajuste os valores', { erro: true }); return; }
    const { nome, achado } = contatoAtual();
    const btn = root.querySelector('#salvar');
    btn.disabled = true; btn.textContent = 'Registrando…';
    try {
      const r = await store.registrarTroca({
        data: f.data.value,
        contato_id: achado?.id || null,
        contato_novo: !achado && nome ? { nome, whatsapp: f.whatsapp.value } : null,
        dinheiro: dinheiroAssinado(),
        observacoes: f.observacoes.value,
        saidas: estado.saidas.map((x) => ({ id: x.c.id, valor: Number(x.valor) || 0 })),
        entradas: estado.entradas.map((x) => ({ clube: x.clube.trim(), temporada: x.temporada.trim(), tamanho: x.tamanho.trim(), valor: Number(x.valor) || 0 })),
      });
      toast('Troca registrada. Agora complete a camisa que chegou.');
      location.hash = `#editar-${r.entradas[0]}`;
    } catch (e) {
      toast(`Não registrou: ${e.message}`, { erro: true, ms: 6000 });
      btn.disabled = false; btn.textContent = 'Registrar troca';
    }
  });

  desenharSaidas(); desenharEntradas(); contatoAtual(); resumo();
}
