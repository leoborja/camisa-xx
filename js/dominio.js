// Vocabulário do negócio: listas, rótulos e contas (custo, lucro, tempo em estoque).
import { diasEntre, hojeISO } from './ui.js';

export const STATUS = [
  { v: 'estoque', l: 'Em estoque' },
  { v: 'anunciada', l: 'Anunciada' },
  { v: 'reservada', l: 'Reservada' },
  { v: 'vendida', l: 'Vendida' },
  { v: 'colecao', l: 'Coleção pessoal' },
];

export const TIPOS = [
  { v: 'torcedor', l: 'Torcedor', d: 'Versão vendida em loja' },
  { v: 'jogador', l: 'De jogador', d: 'Player issue — feita pro elenco' },
  { v: 'jogo', l: 'Usada em jogo', d: 'Match worn — vestida em partida' },
];

export const MODELOS = [
  { v: 'titular', l: 'Titular' },
  { v: 'reserva', l: 'Reserva' },
  { v: 'terceira', l: 'Terceira' },
  { v: 'goleiro', l: 'Goleiro' },
  { v: 'treino', l: 'Treino' },
  { v: 'comemorativa', l: 'Comemorativa' },
  { v: 'outra', l: 'Outra' },
];

export const CONSERVACAO = [
  { v: 'nova', l: 'Nova com etiqueta' },
  { v: 'excelente', l: 'Excelente' },
  { v: 'muito_boa', l: 'Muito boa' },
  { v: 'boa', l: 'Boa' },
  { v: 'regular', l: 'Regular' },
  { v: 'ruim', l: 'Precisa de reparo' },
];

export const MANGAS = [{ v: 'curta', l: 'Curta' }, { v: 'longa', l: 'Longa' }];
export const TAMANHOS = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XGG', 'Infantil'];
export const CANAIS = ['Instagram', 'WhatsApp', 'Mercado Livre', 'Enjoei', 'OLX', 'Evento / feira', 'Indicação', 'Outro'];
export const MARCAS = ['Adidas', 'Nike', 'Puma', 'Umbro', 'Penalty', 'Topper', 'Kappa', 'Lotto', 'Le Coq Sportif', 'Diadora', 'Reebok', 'Finta', 'Rainha', 'Athleta', 'Olympikus', 'Rhumell', 'Dellerba', 'Super Bolla', 'Mizuno', 'Fila'];

export const rotulo = (lista, v) => lista.find((x) => x.v === v)?.l ?? (v || '');

export function anoDe(temporada) {
  const m = String(temporada || '').match(/(19|20)\d{2}/);
  return m ? Number(m[0]) : null;
}
export function decada(ano) {
  if (!ano) return null;
  return ano < 2000 ? `Anos ${Math.floor((ano % 100) / 10) * 10}` : `Anos ${Math.floor(ano / 10) * 10}`;
}

export const numeroFmt = (n) => (n ? `#${String(n).padStart(4, '0')}` : '');

export function custo(c) {
  if (c.valor_compra == null && c.custos_extras == null) return null;
  return (Number(c.valor_compra) || 0) + (Number(c.custos_extras) || 0);
}
export function lucro(c) {
  if (c.status !== 'vendida' || c.valor_venda == null) return null;
  return Number(c.valor_venda) - (custo(c) || 0);
}
// lucro sobre o custo (quanto o dinheiro rendeu)
export function retorno(c, valor) {
  const k = custo(c);
  if (!k || valor == null) return null;
  return (valor - k) / k;
}
export function diasNoAcervo(c) {
  const fim = c.status === 'vendida' && c.data_venda ? c.data_venda : hojeISO();
  return diasEntre(c.data_compra, fim);
}

export const titulo = (c) => [c.clube, c.temporada].filter(Boolean).join(' ');
export function subtitulo(c) {
  const jog = [c.jogador, c.numero_camisa && `#${c.numero_camisa}`].filter(Boolean).join(' ');
  return [rotulo(MODELOS, c.modelo), c.tamanho, jog].filter(Boolean).join(' · ');
}
