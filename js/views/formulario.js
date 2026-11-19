// Cadastro / edição. Pensado pro iPhone: fotos primeiro, só "clube" obrigatório,
// campos agrupados, botão salvar fixo no rodapé, rascunho salvo enquanto digita.
import { esc, lerBRL, valorCampo, hojeISO, toast, fecharToast, acoes, confirmar } from '../ui.js';
import { STATUS, TIPOS, MODELOS, CONSERVACAO, MANGAS, TAMANHOS, CANAIS, MARCAS, anoDe, numeroFmt } from '../dominio.js';
import { ICONE } from '../icones.js';
import { prepararFoto } from '../imagens.js';

export const tela = 'form';

const CHAVE_RASCUNHO = 'cxx:rascunho-nova';
const DINHEIRO = ['valor_compra', 'custos_extras', 'preco_pedido', 'valor_venda'];
const TEXTO = ['clube', 'temporada', 'marca', 'patrocinio', 'tamanho', 'jogador', 'numero_camisa', 'codigo_produto',
  'procedencia', 'defeitos', 'origem', 'comprador', 'observacoes'];
const ESCOLHA = ['modelo', 'manga', 'tipo', 'conservacao', 'status', 'canal_venda', 'data_compra', 'data_venda'];

const lerRascunho = () => { try { return JSON.parse(localStorage.getItem(CHAVE_RASCUNHO) || 'null'); } catch { return null; } };
const gravarRascunho = (d) => { try { localStorage.setItem(CHAVE_RASCUNHO, JSON.stringify(d)); } catch {} };
const apagarRascunho = () => { try { localStorage.removeItem(CHAVE_RASCUNHO); } catch {} };

const opcoes = (lista, atual, vazio = '—') =>
  `<option value="">${vazio}</option>${lista.map((o) => `<option value="${esc(o.v)}" ${o.v === atual ? 'selected' : ''}>${esc(o.l)}</option>`).join('')}`;
const opcoesTexto = (lista, atual) =>
  `<option value="">—</option>${lista.map((x) => `<option ${x === atual ? 'selected' : ''}>${esc(x)}</option>`).join('')}`;
const datalist = (id, valores) => `<datalist id="${id}">${[...new Set(valores.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')).map((v) => `<option value="${esc(v)}">`).join('')}</datalist>`;

function segmentado(nome, lista, atual) {
  return `<div class="segmentado">${lista.map((o) => `
    <label><input type="radio" name="${nome}" value="${o.v}" ${o.v === atual ? 'checked' : ''}><span>${esc(o.l)}</span></label>`).join('')}</div>`;
}

function campoDinheiro(nome, rotulo, valor, dica = '') {
  return `<label class="campo"><span>${rotulo}${dica ? ` <em>${dica}</em>` : ''}</span>
    <div class="com-prefixo"><i>R$</i><input name="${nome}" inputmode="decimal" autocomplete="off" value="${esc(valorCampo(valor))}" placeholder="0"></div></label>`;
}

export async function render(root, { store, params, ehAtual }) {
  const editando = Boolean(params[0]);
  root.innerHTML = '<div class="carregando"><span class="girando"></span></div>';

  const [existente, todas] = await Promise.all([
    editando ? store.obter(params[0]) : null,
    store.listar(),
  ]);
  if (!ehAtual()) return;
  if (editando && !existente) {
    root.innerHTML = '<div class="vazio"><h2>Camisa não encontrada</h2><a class="btn" href="#acervo">Voltar</a></div>';
    return;
  }

  const rascunho = !editando ? lerRascunho() : null;
  const c = existente || { status: 'estoque', data_compra: hojeISO(), ...(rascunho || {}) };

  // Fotos: existentes (já salvas) + novas (ainda só no aparelho, já comprimindo)
  let fotos = (existente?.fotos || []).map((f) => ({ tipo: 'existente', foto: f, preview: f.thumb }));
  const removidas = [];
  let mexeu = false;

  const clubes = todas.map((x) => x.clube);
  const marcas = [...MARCAS, ...todas.map((x) => x.marca)];
  const origens = todas.map((x) => x.origem);

  root.innerHTML = `
    <div class="barra-topo">
      <button class="btn-texto" id="cancelar" type="button">Cancelar</button>
      <span class="barra-titulo">${editando ? `Editar ${numeroFmt(c.numero)}` : 'Nova camisa'}</span>
      <span class="btn-texto fantasma"></span>
    </div>

    <form id="f" class="form" novalidate autocomplete="off">
      ${rascunho ? '<p class="aviso">Recuperei o que você estava preenchendo. <button type="button" class="btn-link" id="descartar">Começar do zero</button></p>' : ''}

      <section class="cartao">
        <h3>Fotos <em>a primeira é a capa</em></h3>
        <div class="fotos-edit" id="fotos"></div>
        <input type="file" id="arquivo" accept="image/*" multiple hidden>
      </section>

      <section class="cartao">
        <h3>A camisa</h3>
        <label class="campo"><span>Clube ou seleção <b class="obrig">*</b></span>
          <input name="clube" list="dl-clubes" value="${esc(c.clube || '')}" autocapitalize="words" enterkeyhint="next" required></label>
        <div class="duas">
          <label class="campo"><span>Temporada</span>
            <input name="temporada" value="${esc(c.temporada || '')}" placeholder="1994 ou 94/95" inputmode="text" enterkeyhint="next"></label>
          <label class="campo"><span>Modelo</span><select name="modelo">${opcoes(MODELOS, c.modelo)}</select></label>
        </div>
        <div class="duas">
          <label class="campo"><span>Marca</span>
            <input name="marca" list="dl-marcas" value="${esc(c.marca || '')}" autocapitalize="words"></label>
          <label class="campo"><span>Tamanho</span>
            <input name="tamanho" list="dl-tamanhos" value="${esc(c.tamanho || '')}" autocapitalize="characters"></label>
        </div>
        <div class="campo"><span>Manga</span>${segmentado('manga', MANGAS, c.manga)}</div>
        <div class="duas">
          <label class="campo"><span>Jogador</span><input name="jogador" value="${esc(c.jogador || '')}" autocapitalize="words"></label>
          <label class="campo estreito"><span>Número</span><input name="numero_camisa" value="${esc(c.numero_camisa || '')}" inputmode="numeric"></label>
        </div>
        <label class="campo"><span>Patrocínio <em>opcional</em></span><input name="patrocinio" value="${esc(c.patrocinio || '')}"></label>
      </section>

      <section class="cartao">
        <h3>Autenticidade</h3>
        <div class="tipos">
          ${TIPOS.map((t) => `
            <label class="tipo"><input type="radio" name="tipo" value="${t.v}" ${t.v === c.tipo ? 'checked' : ''}>
              <span><b>${esc(t.l)}</b><small>${esc(t.d)}</small></span></label>`).join('')}
        </div>
        <label class="campo"><span>Código da etiqueta <em>código do produto na etiqueta interna</em></span>
          <input name="codigo_produto" value="${esc(c.codigo_produto || '')}" autocapitalize="characters" autocorrect="off"></label>
        <label class="campo"><span>Procedência <em>de onde veio, história da peça</em></span>
          <textarea name="procedencia" rows="2">${esc(c.procedencia || '')}</textarea></label>
        <label class="alternar"><input type="checkbox" name="certificado" ${c.certificado ? 'checked' : ''}><span>Tem certificado de autenticidade</span></label>
      </section>

      <section class="cartao">
        <h3>Estado</h3>
        <label class="campo"><span>Conservação</span><select name="conservacao">${opcoes(CONSERVACAO, c.conservacao)}</select></label>
        <label class="campo"><span>Defeitos <em>furos, manchas, número descolando…</em></span>
          <textarea name="defeitos" rows="2">${esc(c.defeitos || '')}</textarea></label>
      </section>

      <section class="cartao">
        <h3>Compra</h3>
        <div class="duas">
          <label class="campo"><span>Data</span><input type="date" name="data_compra" value="${esc(c.data_compra || '')}"></label>
          ${campoDinheiro('valor_compra', 'Valor pago', c.valor_compra)}
        </div>
        ${campoDinheiro('custos_extras', 'Custos extras', c.custos_extras, 'frete, lavagem, conserto')}
        <label class="campo"><span>Comprou de quem / onde</span>
          <input name="origem" list="dl-origens" value="${esc(c.origem || '')}"></label>
      </section>

      <section class="cartao">
        <h3>Venda</h3>
        <div class="duas">
          <label class="campo"><span>Status</span><select name="status">${opcoes(STATUS, c.status || 'estoque', '—').replace('<option value="">—</option>', '')}</select></label>
          ${campoDinheiro('preco_pedido', 'Preço pedido', c.preco_pedido)}
        </div>
        <div id="bloco-vendida" ${c.status === 'vendida' ? '' : 'hidden'}>
          <div class="duas">
            ${campoDinheiro('valor_venda', 'Vendida por', c.valor_venda)}
            <label class="campo"><span>Data da venda</span><input type="date" name="data_venda" value="${esc(c.data_venda || '')}"></label>
          </div>
          <div class="duas">
            <label class="campo"><span>Onde vendeu</span><select name="canal_venda">${opcoesTexto(CANAIS, c.canal_venda)}</select></label>
            <label class="campo"><span>Comprador</span><input name="comprador" value="${esc(c.comprador || '')}"></label>
          </div>
        </div>
      </section>

      <section class="cartao">
        <h3>Observações</h3>
        <textarea name="observacoes" rows="3" placeholder="Qualquer coisa que valha lembrar">${esc(c.observacoes || '')}</textarea>
      </section>

      ${datalist('dl-clubes', clubes)}${datalist('dl-marcas', marcas)}${datalist('dl-tamanhos', TAMANHOS)}${datalist('dl-origens', origens)}
    </form>

    <div class="barra-acao">
      <button class="btn btn-primario btn-cheio" id="salvar" type="button">${editando ? 'Salvar alterações' : 'Salvar camisa'}</button>
    </div>`;

  const form = root.querySelector('#f');
  const elFotos = root.querySelector('#fotos');
  const inputArquivo = root.querySelector('#arquivo');
  const blocoVendida = root.querySelector('#bloco-vendida');

  // ---------- fotos ----------
  function desenharFotos() {
    elFotos.innerHTML = fotos.map((f, i) => `
      <button type="button" class="foto-edit ${f.erro ? 'com-erro' : ''}" data-i="${i}">
        <img src="${esc(f.preview)}" alt="">
        ${i === 0 ? '<span class="tag-capa">Capa</span>' : ''}
        ${f.tipo === 'nova' && !f.pronta ? '<span class="processando"><span class="girando"></span></span>' : ''}
      </button>`).join('') + `
      <button type="button" class="foto-add" id="add-foto">${ICONE.camera}<span>${fotos.length ? 'Mais fotos' : 'Adicionar fotos'}</span></button>`;
    elFotos.querySelector('#add-foto').addEventListener('click', () => inputArquivo.click());
  }

  inputArquivo.addEventListener('change', () => {
    for (const arquivo of inputArquivo.files) {
      const item = { tipo: 'nova', preview: URL.createObjectURL(arquivo), pronta: false };
      item.preparo = prepararFoto(arquivo)
        .then((r) => {
          URL.revokeObjectURL(item.preview);
          item.preview = URL.createObjectURL(r.thumb);
          item.pronta = true;
          return r;
        })
        .catch((e) => { item.erro = e.message; item.pronta = true; return null; })
        .finally(() => { if (ehAtual()) desenharFotos(); });
      fotos.push(item);
    }
    inputArquivo.value = '';
    mexeu = true;
    desenharFotos();
  });

  elFotos.addEventListener('click', async (e) => {
    const b = e.target.closest('.foto-edit');
    if (!b) return;
    const i = Number(b.dataset.i);
    const r = await acoes(i === 0 ? 'Foto de capa' : `Foto ${i + 1}`, [
      ...(i > 0 ? [{ valor: 'capa', rotulo: 'Usar como capa' }] : []),
      ...(i > 0 ? [{ valor: 'esq', rotulo: 'Mover pra esquerda' }] : []),
      ...(i < fotos.length - 1 ? [{ valor: 'dir', rotulo: 'Mover pra direita' }] : []),
      { valor: 'remover', rotulo: 'Remover foto', perigo: true },
    ]);
    if (!r) return;
    const [item] = fotos.splice(i, 1);
    if (r === 'capa') fotos.unshift(item);
    if (r === 'esq') fotos.splice(i - 1, 0, item);
    if (r === 'dir') fotos.splice(i + 1, 0, item);
    if (r === 'remover' && item.tipo === 'existente') removidas.push(item.foto);
    mexeu = true;
    desenharFotos();
  });
  desenharFotos();

  // ---------- campos ----------
  function lerCampos() {
    const fd = new FormData(form);
    const d = {};
    for (const k of TEXTO) { const v = (fd.get(k) || '').toString().trim(); d[k] = v || null; }
    for (const k of ESCOLHA) d[k] = (fd.get(k) || '').toString() || null;
    for (const k of DINHEIRO) d[k] = lerBRL(fd.get(k));
    d.certificado = fd.get('certificado') === 'on';
    d.ano = anoDe(d.temporada);
    if (!d.status) d.status = 'estoque';
    return d;
  }

  form.addEventListener('input', () => {
    mexeu = true;
    if (!editando) gravarRascunho(lerCampos());
  });
  form.addEventListener('change', (e) => {
    if (e.target.name === 'status') {
      blocoVendida.hidden = e.target.value !== 'vendida';
      if (e.target.value === 'vendida' && !form.data_venda.value) form.data_venda.value = hojeISO();
      if (e.target.value === 'vendida' && !form.valor_venda.value) form.valor_venda.value = form.preco_pedido.value;
    }
  });
  // Enter no teclado do iPhone avança pro próximo campo em vez de enviar
  form.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.target.tagName === 'TEXTAREA') return;
    e.preventDefault();
    const campos = [...form.querySelectorAll('input:not([type=radio]):not([type=checkbox]):not([hidden]), select, textarea')]
      .filter((el) => el.offsetParent !== null);
    const prox = campos[campos.indexOf(e.target) + 1];
    prox ? prox.focus() : e.target.blur();
  });

  root.querySelector('#descartar')?.addEventListener('click', () => {
    apagarRascunho();
    render(root, { store, params, ehAtual });
  });

  root.querySelector('#cancelar').addEventListener('click', async () => {
    if (mexeu && !(await confirmar('Sair sem salvar?', { ok: 'Descartar alterações', perigo: true }))) return;
    if (!editando) apagarRascunho();
    if (editando) location.hash = `#c-${existente.id}`;
    else history.length > 1 ? history.back() : (location.hash = '#acervo');
  });

  // ---------- salvar ----------
  const btnSalvar = root.querySelector('#salvar');
  btnSalvar.addEventListener('click', async () => {
    const dados = lerCampos();
    if (!dados.clube) {
      form.clube.focus();
      form.clube.closest('.campo').classList.add('invalido');
      toast('Preencha o clube ou seleção', { erro: true });
      return;
    }
    if (dados.status !== 'vendida') {
      // não apaga dados antigos de venda, mas também não deixa lixo do formulário
      if (!existente) Object.assign(dados, { valor_venda: null, data_venda: null, canal_venda: null, comprador: null });
    }

    btnSalvar.disabled = true;
    btnSalvar.textContent = 'Salvando…';
    try {
      const salva = await store.salvar(editando ? { ...dados, id: existente.id } : dados);

      for (const f of removidas) await store.removerFoto(f);

      const novas = fotos.filter((f) => f.tipo === 'nova');
      const idsFinais = [];
      let enviadas = 0;
      for (let i = 0; i < fotos.length; i++) {
        const f = fotos[i];
        if (f.tipo === 'existente') { idsFinais.push(f.foto.id); continue; }
        const preparada = await f.preparo;
        if (!preparada) continue;
        enviadas++;
        if (novas.length > 1) toast(`Enviando fotos ${enviadas}/${novas.length}…`, { ms: 0 });
        const nova = await store.adicionarFoto(salva.id, preparada, i);
        idsFinais.push(nova.id);
      }
      if (editando && idsFinais.length) await store.ordenarFotos(salva.id, idsFinais);

      if (!editando) apagarRascunho();
      fecharToast();
      toast(editando ? 'Alterações salvas' : 'Camisa cadastrada');
      mexeu = false;
      location.hash = `#c-${salva.id}`;
    } catch (e) {
      console.error(e);
      toast(`Não salvou: ${e.message || e}`, { erro: true, ms: 6000 });
      btnSalvar.disabled = false;
      btnSalvar.textContent = editando ? 'Salvar alterações' : 'Salvar camisa';
    }
  });

  return () => {
    for (const f of fotos) if (f.tipo === 'nova' && f.preview?.startsWith('blob:')) URL.revokeObjectURL(f.preview);
  };
}
