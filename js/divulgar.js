// Ferramentas de divulgação de uma camisa: legenda pronta pro Instagram e etiqueta com QR code.
import { esc, fmtBRL0, sheet, toast } from './ui.js';
import { TIPOS, MODELOS, CONSERVACAO, MANGAS, rotulo, numeroFmt, slugLoja } from './dominio.js';
import { CONFIG } from './config.js';

const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const hashtag = (s) => semAcento(s).toLowerCase().replace(/[^a-z0-9]/g, '');
const whatsFmt = (n) => {
  const d = String(n || '').replace(/\D/g, '').replace(/^55/, '');
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d;
};
export const urlLoja = (c) => `${CONFIG.LOJA_URL}/camisa/${slugLoja(c)}`;

export function legendaInstagram(c) {
  const linhas = [];
  linhas.push(`${c.clube.toUpperCase()} ${c.temporada || ''}`.trim() + (c.modelo ? ` · ${rotulo(MODELOS, c.modelo)}` : ''));
  linhas.push('');
  const ficha = [
    c.marca && `Marca: ${c.marca}`,
    c.tamanho && `Tamanho: ${c.tamanho}`,
    c.manga && `Manga ${rotulo(MANGAS, c.manga).toLowerCase()}`,
    (c.jogador || c.numero_camisa) && `Jogador: ${[c.jogador, c.numero_camisa && `#${c.numero_camisa}`].filter(Boolean).join(' ')}`,
    c.patrocinio && `Patrocínio: ${c.patrocinio}`,
    c.tipo && `Tipo: ${rotulo(TIPOS, c.tipo)}`,
    c.certificado && 'Com certificado de autenticidade',
    c.conservacao && `Estado: ${rotulo(CONSERVACAO, c.conservacao)}${c.defeitos ? ` (${c.defeitos})` : ''}`,
  ].filter(Boolean);
  linhas.push(...ficha.map((x) => `▪️ ${x}`));
  linhas.push('');
  if (c.status === 'vendida') linhas.push('✅ VENDIDA');
  else if (c.status === 'reservada') linhas.push('⏳ RESERVADA');
  else linhas.push(c.preco_pedido != null ? `💰 ${fmtBRL0(c.preco_pedido)}` : '💰 Preço sob consulta');
  if (c.status !== 'vendida') {
    linhas.push(`📲 Chama no direct${CONFIG.WHATSAPP ? ` ou no WhatsApp ${whatsFmt(CONFIG.WHATSAPP)}` : ''}`);
    if (c.publicada) linhas.push(`🔗 ${urlLoja(c).replace(/^https?:\/\//, '')}`);
  }
  linhas.push(`Código ${numeroFmt(c.numero)}`);
  linhas.push('');
  const tags = ['camisaxx', 'camisadefutebol', 'camisaretro', 'futebolretro', 'colecionador', 'mantosagrado',
    hashtag(c.clube), c.ano && `${hashtag(c.clube)}${c.ano}`, c.ano && `anos${String(c.ano).slice(2, 3)}0`].filter(Boolean);
  linhas.push([...new Set(tags)].map((t) => `#${t}`).join(' '));
  return linhas.join('\n');
}

export async function mostrarLegenda(c) {
  const texto = legendaInstagram(c);
  await sheet({
    titulo: 'Legenda pro Instagram',
    html: `<div class="form-sheet">
      <textarea class="legenda" rows="14" readonly>${esc(texto)}</textarea>
      <button class="btn btn-primario btn-cheio" type="button" id="copiar">Copiar legenda</button>
      ${!c.publicada ? '<p class="suave">Dica: ligue "Mostrar na loja" pra legenda levar o link da camisa.</p>' : ''}
    </div>`,
    aoMontar: (el, fechar) => el.querySelector('#copiar').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(texto); toast('Legenda copiada. Agora é só colar no post.'); fechar(); }
      catch { const t = el.querySelector('textarea'); t.removeAttribute('readonly'); t.focus(); t.select(); toast('Selecionei o texto: toque em Copiar'); }
    }),
  });
}

// ---------- Etiqueta com QR ----------
let qrPronto;
function carregarQR() {
  // qrcode-generator (MIT, kazuhikoarase) — versão fixa
  qrPronto ||= new Promise((ok, erro) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js';
    s.onload = () => ok(window.qrcode);
    s.onerror = () => { qrPronto = null; erro(new Error('Sem internet pra gerar o QR code.')); };
    document.head.appendChild(s);
  });
  return qrPronto;
}

export async function imprimirEtiqueta(c) {
  let qrSvg = '';
  try {
    const qrcode = await carregarQR();
    const qr = qrcode(0, 'M');
    qr.addData(urlLoja(c));
    qr.make();
    qrSvg = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
  } catch (e) { toast(e.message, { erro: true }); return; }

  const preco = c.status === 'vendida' ? 'VENDIDA' : c.preco_pedido != null ? fmtBRL0(c.preco_pedido) : '';
  const etiqueta = `
    <div class="etiqueta">
      <div class="etiqueta-qr">${qrSvg}</div>
      <div class="etiqueta-info">
        <img src="icons/marca-64.png" alt="" width="22" height="22">
        <b class="etiqueta-num">${numeroFmt(c.numero)}</b>
        <span class="etiqueta-tit">${esc(c.clube)} ${esc(c.temporada || '')}</span>
        <span class="etiqueta-sub">${esc([rotulo(MODELOS, c.modelo), c.tamanho && `Tam. ${c.tamanho}`].filter(Boolean).join(' · '))}</span>
        ${preco ? `<b class="etiqueta-preco">${esc(preco)}</b>` : ''}
      </div>
    </div>`;

  await sheet({
    titulo: 'Etiqueta com QR code',
    html: `<div class="form-sheet">
      <div class="etiqueta-previa">${etiqueta}</div>
      <p class="suave">Quem apontar a câmera pro QR abre a página da camisa na loja${c.publicada ? '' : ' (ligue "Mostrar na loja" antes)'}.</p>
      <button class="btn btn-primario btn-cheio" type="button" id="imprimir">Imprimir</button>
    </div>`,
    aoMontar: (el) => el.querySelector('#imprimir').addEventListener('click', () => {
      const area = document.createElement('div');
      area.className = 'area-impressao';
      area.innerHTML = etiqueta;
      document.body.appendChild(area);
      document.body.classList.add('imprimindo');
      const limpar = () => { area.remove(); document.body.classList.remove('imprimindo'); window.removeEventListener('afterprint', limpar); };
      window.addEventListener('afterprint', limpar);
      setTimeout(() => { window.print(); setTimeout(limpar, 1500); }, 150);
    }),
  });
}
