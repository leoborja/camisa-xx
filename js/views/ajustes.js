// Ajustes: conta, backup em planilha, instalar no iPhone, dados de demonstração.
import { esc, toast, confirmar, fmtData } from '../ui.js';
import { STATUS, TIPOS, MODELOS, CONSERVACAO, MANGAS, rotulo, custo, lucro, numeroFmt } from '../dominio.js';
import { carregarExemplos } from '../exemplos.js';

export const tela = 'ajustes';

const COLUNAS = [
  ['Código', (c) => numeroFmt(c.numero)], ['Clube', (c) => c.clube], ['Temporada', (c) => c.temporada],
  ['Modelo', (c) => rotulo(MODELOS, c.modelo)], ['Marca', (c) => c.marca], ['Tamanho', (c) => c.tamanho],
  ['Manga', (c) => rotulo(MANGAS, c.manga)], ['Jogador', (c) => c.jogador], ['Número', (c) => c.numero_camisa],
  ['Patrocínio', (c) => c.patrocinio], ['Tipo', (c) => rotulo(TIPOS, c.tipo)], ['Código etiqueta', (c) => c.codigo_produto],
  ['Procedência', (c) => c.procedencia], ['Certificado', (c) => (c.certificado ? 'Sim' : '')],
  ['Conservação', (c) => rotulo(CONSERVACAO, c.conservacao)], ['Defeitos', (c) => c.defeitos],
  ['Data compra', (c) => c.data_compra && fmtData(c.data_compra)], ['Valor pago', (c) => c.valor_compra],
  ['Custos extras', (c) => c.custos_extras], ['Custo total', (c) => custo(c)], ['Comprou de', (c) => c.origem],
  ['Status', (c) => rotulo(STATUS, c.status)], ['Preço pedido', (c) => c.preco_pedido],
  ['Data venda', (c) => c.data_venda && fmtData(c.data_venda)], ['Valor venda', (c) => c.valor_venda],
  ['Lucro', (c) => lucro(c)], ['Canal venda', (c) => c.canal_venda], ['Comprador', (c) => c.comprador],
  ['Fotos', (c) => c.fotos?.length || 0], ['Observações', (c) => c.observacoes],
];

// CSV no padrão do Excel brasileiro: ; como separador e vírgula decimal
function celula(v) {
  if (v == null) return '';
  if (typeof v === 'number') return String(v).replace('.', ',');
  const s = String(v);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function exportar(store) {
  if (window.self !== window.top) { toast('Na versão de demonstração por link a planilha não baixa. Funciona no site oficial.'); return; }
  const todas = await store.listar();
  const linhas = [COLUNAS.map(([n]) => n).join(';'), ...todas.map((c) => COLUNAS.map(([, f]) => celula(f(c))).join(';'))];
  const blob = new Blob(['﻿' + linhas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `camisa-xx-acervo-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  toast(`${todas.length} camisas exportadas`);
}

export async function render(root, { store, usuario }) {
  const demo = store.modo === 'demo';
  const instalado = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;

  root.innerHTML = `
    <header class="topo"><div><h1>Ajustes</h1></div></header>
    <div class="conteudo">
      <section class="cartao">
        <h3>Conta</h3>
        ${demo
          ? `<p><b>Modo demonstração.</b> As camisas ficam salvas só neste aparelho. Quando o banco de dados estiver conectado, os dados passam a ficar na nuvem e dá pra acessar de qualquer lugar.</p>`
          : `<p>Conectado como <b>${esc(usuario?.email)}</b></p><button class="btn" id="sair">Sair</button>`}
      </section>

      ${!instalado ? `
      <section class="cartao">
        <h3>Colocar na tela do iPhone</h3>
        <ol class="passos">
          <li>Abra este site no <b>Safari</b></li>
          <li>Toque em <b>Compartilhar</b> (o quadrado com a seta pra cima)</li>
          <li>Escolha <b>Adicionar à Tela de Início</b></li>
        </ol>
        <p class="suave">Ele abre em tela cheia, como um aplicativo.</p>
      </section>` : ''}

      <section class="cartao">
        <h3>Backup</h3>
        <p>Baixa uma planilha (abre no Excel ou no Google Sheets) com todas as camisas e valores.</p>
        <button class="btn" id="exportar">Exportar planilha</button>
      </section>

      ${demo ? `
      <section class="cartao">
        <h3>Demonstração</h3>
        <div class="botoes">
          <button class="btn" id="exemplos">Carregar exemplos</button>
          <button class="btn btn-perigo" id="limpar">Apagar tudo</button>
        </div>
      </section>` : ''}

      <p class="rodape-versao">Camisa XX · v0.1</p>
    </div>`;

  root.querySelector('#exportar').addEventListener('click', () => exportar(store));
  root.querySelector('#sair')?.addEventListener('click', async () => {
    if (await confirmar('Sair da conta?', { ok: 'Sair' })) await store.sair();
  });
  root.querySelector('#exemplos')?.addEventListener('click', async () => {
    const n = await carregarExemplos(store);
    toast(`${n} exemplos carregados`);
  });
  root.querySelector('#limpar')?.addEventListener('click', async () => {
    if (!(await confirmar('Apagar todas as camisas deste aparelho?', { ok: 'Apagar tudo', perigo: true }))) return;
    await store.limparTudo();
    toast('Tudo apagado');
  });
}
