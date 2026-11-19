// Utilitários de interface: escape, formatação, toast, bottom sheet.

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const brl0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const vazio = (n) => n == null || n === '' || Number.isNaN(Number(n));
export const fmtBRL = (n) => (vazio(n) ? '—' : brl.format(Number(n)));
export const fmtBRL0 = (n) => (vazio(n) ? '—' : brl0.format(Math.round(Number(n))));
export const fmtPct = (n) => (vazio(n) || !Number.isFinite(n) ? '—' : `${n >= 0 ? '+' : ''}${Math.round(n * 100)}%`);

// "1.234,56" / "1234,5" / "1.500" / "R$ 80" → número
export function lerBRL(str) {
  if (str == null) return null;
  let s = String(str).trim().replace(/[R$\s]/g, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}
// número → texto pro campo de valor
export const valorCampo = (n) => (vazio(n) ? '' : Number(n).toLocaleString('pt-BR', Number.isInteger(Number(n)) ? {} : { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

// "2026-11-19" → "19/11/2026" (sem passar por Date pra não deslocar fuso)
export function fmtData(iso) {
  if (!iso) return '—';
  const [a, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}
export function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function diasEntre(isoA, isoB) {
  if (!isoA || !isoB) return null;
  const p = (s) => { const [a, m, d] = s.slice(0, 10).split('-').map(Number); return Date.UTC(a, m - 1, d); };
  return Math.round((p(isoB) - p(isoA)) / 86400000);
}

export const normalizar = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// ---------- Toast ----------
let toastTimer;
export function toast(msg, { erro = false, ms = 2600 } = {}) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.toggle('erro', erro);
  el.classList.add('show');
  clearTimeout(toastTimer);
  if (ms) toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}
export const fecharToast = () => document.getElementById('toast').classList.remove('show');

// ---------- Bottom sheet ----------
export function sheet({ titulo, html, aoMontar }) {
  return new Promise((resolver) => {
    const wrap = document.createElement('div');
    wrap.className = 'sheet-wrap';
    wrap.innerHTML = `
      <div class="sheet-fundo"></div>
      <div class="sheet" role="dialog" aria-modal="true">
        <div class="sheet-alca"></div>
        ${titulo ? `<div class="sheet-titulo">${esc(titulo)}</div>` : ''}
        <div class="sheet-corpo">${html}</div>
      </div>`;
    document.body.appendChild(wrap);
    document.body.classList.add('travado');
    requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('aberto')));
    let fechado = false;
    const fechar = (valor = null) => {
      if (fechado) return;
      fechado = true;
      wrap.classList.remove('aberto');
      document.body.classList.remove('travado');
      setTimeout(() => wrap.remove(), 250);
      resolver(valor);
    };
    wrap.querySelector('.sheet-fundo').addEventListener('click', () => fechar(null));
    aoMontar?.(wrap.querySelector('.sheet'), fechar);
  });
}

// Lista de ações estilo iOS. opcoes: [{ valor, rotulo, perigo }]
export function acoes(titulo, opcoes) {
  return sheet({
    titulo,
    html: `<div class="acoes">
      ${opcoes.map((o, i) => `<button type="button" class="acao ${o.perigo ? 'perigo' : ''} ${o.ativo ? 'ativo' : ''}" data-i="${i}">${esc(o.rotulo)}</button>`).join('')}
      <button type="button" class="acao cancelar" data-i="-1">Cancelar</button>
    </div>`,
    aoMontar: (el, fechar) => el.querySelectorAll('.acao').forEach((b) => b.addEventListener('click', () => {
      const i = Number(b.dataset.i);
      fechar(i < 0 ? null : opcoes[i].valor);
    })),
  });
}

export async function confirmar(pergunta, { ok = 'Confirmar', perigo = false } = {}) {
  const r = await acoes(pergunta, [{ valor: true, rotulo: ok, perigo }]);
  return r === true;
}

// WhatsApp: guarda só dígitos; link wa.me com DDI 55 quando faltar
export function linkWhats(numero, texto = '') {
  let d = String(numero || '').replace(/\D/g, '');
  if (!d) return null;
  if (d.length <= 11) d = `55${d}`;
  return `https://wa.me/${d}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`;
}
export function fmtWhats(numero) {
  const d = String(numero || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d;
}
