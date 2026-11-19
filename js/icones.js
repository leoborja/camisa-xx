// Ícones SVG inline (herdam currentColor).
const svg = (d, extra = '') => `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;

export const ICONE = {
  camisa: svg('<path d="M8 3 4.5 4.8 2 10l3.2 1.6L6.5 9.6V21h11V9.6l1.3 2L22 10l-2.5-5.2L16 3c-.6 1.4-2.1 2.3-4 2.3S8.6 4.4 8 3Z"/>'),
  grafico: svg('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  ajustes: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>'),
  mais: svg('<path d="M12 5v14M5 12h14"/>', 'stroke-width="2.4"'),
  voltar: svg('<path d="m15 18-6-6 6-6"/>', 'stroke-width="2.2"'),
  editar: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
  camera: svg('<path d="M14.5 4h-5L7.5 6.5H4A2 2 0 0 0 2 8.5V18a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8.5a2 2 0 0 0-2-2h-3.5Z"/><circle cx="12" cy="13" r="3.5"/>'),
  maisOpcoes: svg('<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>', 'stroke-width="2.4"'),
  busca: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  fechar: svg('<path d="M18 6 6 18M6 6l12 12"/>', 'stroke-width="2.2"'),
  check: svg('<path d="M20 6 9 17l-5-5"/>', 'stroke-width="2.4"'),
};

// Placeholder pra camisa sem foto
export const semFoto = `<div class="sem-foto">${ICONE.camisa}</div>`;

// Sem foto: desenha a camisa nas cores do clube (aproximadas) com o número, se houver.
const CORES = {
  brasil: ['#f4cf1d', '#14824a'], palmeiras: ['#0b6a3a', '#ffffff'], cruzeiro: ['#1b3c9b', '#ffffff'],
  barcelona: ['#a1003e', '#0a4a97', 'listras'], gremio: ['#1a7dc2', '#151515', 'listras'],
  'sao paulo': ['#ffffff', '#cf111a', 'faixa'], flamengo: ['#c40f2c', '#151515', 'aros'],
  corinthians: ['#ffffff', '#151515'], santos: ['#ffffff', '#151515'], vasco: ['#151515', '#ffffff', 'faixa'],
  fluminense: ['#7a1630', '#0b6a3a', 'listras'], botafogo: ['#151515', '#ffffff', 'listras'],
  internacional: ['#c8102e', '#ffffff'], 'atletico mineiro': ['#151515', '#ffffff', 'listras'],
  argentina: ['#8fc6ec', '#ffffff', 'listras'], italia: ['#1d4fa8', '#ffffff'], alemanha: ['#ffffff', '#151515'],
  franca: ['#1b2f6b', '#ffffff'], holanda: ['#f26f21', '#ffffff'], milan: ['#c8102e', '#151515', 'listras'],
  juventus: ['#ffffff', '#151515', 'listras'], 'real madrid': ['#ffffff', '#c9a227'], 'manchester united': ['#d0141f', '#ffffff'],
};
const SHIRT = 'M8 3 4.5 4.8 2 10l3.2 1.6L6.5 9.6V21h11V9.6l1.3 2L22 10l-2.5-5.2L16 3c-.6 1.4-2.1 2.3-4 2.3S8.6 4.4 8 3Z';
const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

function coresDe(clube) {
  const k = semAcento(clube);
  if (CORES[k]) return CORES[k];
  let h = 0;
  for (const ch of k) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return [`hsl(${h} 42% 38%)`, '#ffffff'];
}

export function arteCamisa(c) {
  const [base, det, padrao] = coresDe(c.clube);
  const id = `cxx-${semAcento(c.clube).replace(/[^a-z0-9]/g, '') || 'x'}`;
  let enfeite = '';
  if (padrao === 'listras') enfeite = [7.5, 11, 14.5, 18].map((x) => `<rect x="${x}" y="0" width="1.75" height="24" fill="${det}"/>`).join('');
  if (padrao === 'aros') enfeite = [8, 11.5, 15, 18.5].map((y) => `<rect x="0" y="${y}" width="24" height="1.75" fill="${det}"/>`).join('');
  if (padrao === 'faixa') enfeite = `<rect x="0" y="10" width="24" height="2.6" fill="${det}"/>`;
  const num = c.numero_camisa ? `<text x="12" y="16.6" text-anchor="middle" font-size="5.2" font-weight="700" font-family="'Big Shoulders Display',system-ui,sans-serif" fill="${padrao ? '#ffffff' : det}" stroke="${padrao ? base : 'none'}" stroke-width=".25">${String(c.numero_camisa).replace(/[^\w]/g, '').slice(0, 3)}</text>` : '';
  return `<div class="sem-foto arte"><svg viewBox="0 0 24 24" aria-hidden="true">
    <defs><clipPath id="${id}"><path d="${SHIRT}"/></clipPath></defs>
    <g clip-path="url(#${id})"><rect width="24" height="24" fill="${base}"/>${enfeite}</g>
    <path d="${SHIRT}" fill="none" stroke="rgba(0,0,0,.28)" stroke-width=".35" stroke-linejoin="round"/>
    <path d="M8 3c.6 1.4 2.1 2.3 4 2.3S15.4 4.4 16 3" fill="none" stroke="${padrao ? det : det}" stroke-width=".9"/>
    ${num}</svg></div>`;
}
