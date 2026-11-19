// Painel: quanto tem parado em estoque, quanto vendeu, quanto lucrou, o que está encalhado.
import { esc, fmtBRL0, fmtPct, hojeISO } from '../ui.js';
import { STATUS, rotulo, custo, lucro, diasNoAcervo, titulo, numeroFmt } from '../dominio.js';
import { ICONE } from '../icones.js';

export const tela = 'painel';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const ENCALHE_DIAS = 90;

const kpi = (rotuloTxt, valor, extra = '', classe = '') =>
  `<div class="kpi ${classe}"><span>${rotuloTxt}</span><b>${valor}</b>${extra ? `<small>${extra}</small>` : ''}</div>`;

export async function render(root, { store, ehAtual }) {
  root.innerHTML = '<div class="carregando"><span class="girando"></span></div>';
  const todas = await store.listar();
  if (!ehAtual()) return;

  const hoje = hojeISO();
  const mesAtual = hoje.slice(0, 7);
  const vendidas = todas.filter((c) => c.status === 'vendida');
  const paraVenda = todas.filter((c) => ['estoque', 'anunciada', 'reservada'].includes(c.status));
  const colecao = todas.filter((c) => c.status === 'colecao');

  const investido = paraVenda.reduce((s, c) => s + (custo(c) || 0), 0);
  const potencial = paraVenda.reduce((s, c) => s + (Number(c.preco_pedido) || 0), 0);
  const semPreco = paraVenda.filter((c) => c.preco_pedido == null).length;

  // Últimos 6 meses
  const meses = [];
  const [a, m] = mesAtual.split('-').map(Number);
  for (let i = 5; i >= 0; i--) {
    const d = new Date(a, m - 1 - i, 1);
    meses.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  const porMes = Object.fromEntries(meses.map((k) => [k, { n: 0, receita: 0, lucro: 0, custo: 0 }]));
  for (const c of vendidas) {
    const k = (c.data_venda || '').slice(0, 7);
    if (!porMes[k]) continue;
    porMes[k].n++;
    porMes[k].receita += Number(c.valor_venda) || 0;
    porMes[k].lucro += lucro(c) || 0;
    porMes[k].custo += custo(c) || 0;
  }
  const doMes = porMes[mesAtual];
  const maxReceita = Math.max(1, ...meses.map((k) => porMes[k].receita));

  // Totais históricos
  const receitaTotal = vendidas.reduce((s, c) => s + (Number(c.valor_venda) || 0), 0);
  const lucroTotal = vendidas.reduce((s, c) => s + (lucro(c) || 0), 0);
  const custoVendidas = vendidas.reduce((s, c) => s + (custo(c) || 0), 0);
  const diasVenda = vendidas.map(diasNoAcervo).filter((d) => d != null);
  const giro = diasVenda.length ? Math.round(diasVenda.reduce((s, d) => s + d, 0) / diasVenda.length) : null;

  const encalhadas = paraVenda
    .map((c) => ({ c, dias: diasNoAcervo(c) }))
    .filter((x) => x.dias != null && x.dias >= ENCALHE_DIAS)
    .sort((x, y) => y.dias - x.dias)
    .slice(0, 8);

  const clubes = {};
  for (const c of todas) (clubes[c.clube] ||= { n: 0, vendidas: 0 }).n++;
  for (const c of vendidas) clubes[c.clube].vendidas++;
  const topClubes = Object.entries(clubes).sort((x, y) => y[1].n - x[1].n).slice(0, 6);

  const nomeMes = (k) => MESES[Number(k.slice(5)) - 1];

  root.innerHTML = `
    <header class="topo"><div><h1>Painel</h1><p class="sub">${todas.length} camisas cadastradas</p></div></header>

    <div class="conteudo">
      <section class="cartao">
        <h3>Estoque à venda</h3>
        <div class="kpis">
          ${kpi('Peças', paraVenda.length, colecao.length ? `+ ${colecao.length} na coleção` : '')}
          ${kpi('Investido', fmtBRL0(investido), 'custo das peças paradas')}
          ${kpi('Se vender tudo', fmtBRL0(potencial), semPreco ? `${semPreco} sem preço definido` : 'pelo preço pedido')}
          ${kpi('Lucro previsto', fmtBRL0(potencial - paraVenda.filter((c) => c.preco_pedido != null).reduce((s, c) => s + (custo(c) || 0), 0)), 'das peças com preço')}
        </div>
      </section>

      <section class="cartao">
        <h3>Este mês <em>${nomeMes(mesAtual)}</em></h3>
        <div class="kpis">
          ${kpi('Vendas', doMes.n)}
          ${kpi('Receita', fmtBRL0(doMes.receita))}
          ${kpi('Lucro', fmtBRL0(doMes.lucro), doMes.custo ? `${fmtPct(doMes.lucro / doMes.custo)} sobre o custo` : '', doMes.lucro < 0 ? 'neg' : '')}
        </div>
      </section>

      <section class="cartao">
        <h3>Últimos 6 meses</h3>
        <div class="meses">
          ${meses.map((k) => {
            const p = porMes[k];
            return `<div class="mes ${k === mesAtual ? 'atual' : ''}">
              <span class="mes-nome">${nomeMes(k)}</span>
              <span class="mes-barra"><i style="width:${Math.round((p.receita / maxReceita) * 100)}%"></i></span>
              <span class="mes-val">${p.n ? `${fmtBRL0(p.receita)}<small>${p.n} ${p.n === 1 ? 'venda' : 'vendas'} · lucro ${fmtBRL0(p.lucro)}</small>` : '<small>—</small>'}</span>
            </div>`;
          }).join('')}
        </div>
      </section>

      <section class="cartao">
        <h3>Desde o início</h3>
        <div class="kpis">
          ${kpi('Vendidas', vendidas.length)}
          ${kpi('Receita', fmtBRL0(receitaTotal))}
          ${kpi('Lucro', fmtBRL0(lucroTotal), custoVendidas ? `${fmtPct(lucroTotal / custoVendidas)} sobre o custo` : '', lucroTotal < 0 ? 'neg' : '')}
          ${kpi('Tempo até vender', giro != null ? `${giro} dias` : '—', 'média da compra à venda')}
        </div>
      </section>

      ${encalhadas.length ? `
      <section class="cartao">
        <h3>Paradas há mais de ${ENCALHE_DIAS} dias</h3>
        <ul class="lista-simples">
          ${encalhadas.map(({ c, dias }) => `
            <li><a href="#c-${c.id}">
              <span><b>${esc(titulo(c))}</b><small>${numeroFmt(c.numero)} · ${esc(rotulo(STATUS, c.status))}</small></span>
              <span class="dir">${dias} dias${ICONE.voltar.replace('<svg', '<svg class="seta-dir"')}</span>
            </a></li>`).join('')}
        </ul>
      </section>` : ''}

      ${topClubes.length ? `
      <section class="cartao">
        <h3>Clubes no acervo</h3>
        <ul class="lista-simples">
          ${topClubes.map(([nome, v]) => `<li><span><b>${esc(nome)}</b></span><span class="dir suave">${v.n} ${v.n === 1 ? 'camisa' : 'camisas'}${v.vendidas ? ` · ${v.vendidas} vendida${v.vendidas > 1 ? 's' : ''}` : ''}</span></li>`).join('')}
        </ul>
      </section>` : ''}
    </div>`;
}
