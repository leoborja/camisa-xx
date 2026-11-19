// Camisas de exemplo pro modo demonstração (sem fotos).

function diasAtras(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const EXEMPLOS = () => [
  { clube: 'Brasil', temporada: '1994', ano: 1994, modelo: 'titular', marca: 'Umbro', tamanho: 'G', manga: 'curta', jogador: 'Romário', numero_camisa: '11',
    tipo: 'torcedor', conservacao: 'muito_boa', data_compra: diasAtras(140), valor_compra: 380, custos_extras: 25, origem: 'Feira de antiguidades',
    status: 'anunciada', preco_pedido: 890, observacoes: 'Exemplo de demonstração' },
  { clube: 'Palmeiras', temporada: '1993', ano: 1993, modelo: 'titular', marca: 'Rhumell', patrocinio: 'Parmalat', tamanho: 'M', manga: 'curta',
    tipo: 'torcedor', conservacao: 'boa', defeitos: 'Pequena mancha na barra', data_compra: diasAtras(60), valor_compra: 450, origem: 'Grupo de colecionadores',
    status: 'estoque', preco_pedido: 1100, observacoes: 'Exemplo de demonstração' },
  { clube: 'Cruzeiro', temporada: '2003', ano: 2003, modelo: 'titular', marca: 'Topper', tamanho: 'G', manga: 'curta', numero_camisa: '10',
    tipo: 'jogador', codigo_produto: 'TP-03-1188', conservacao: 'excelente', procedencia: 'Veio de um ex-funcionário do clube', data_compra: diasAtras(95),
    valor_compra: 900, custos_extras: 40, status: 'vendida', preco_pedido: 1800, data_venda: diasAtras(12), valor_venda: 1650, canal_venda: 'Instagram',
    observacoes: 'Exemplo de demonstração' },
  { clube: 'Barcelona', temporada: '1999/00', ano: 1999, modelo: 'reserva', marca: 'Nike', tamanho: 'M', manga: 'longa',
    tipo: 'torcedor', conservacao: 'boa', data_compra: diasAtras(30), valor_compra: 280, origem: 'Mercado Livre', status: 'estoque',
    observacoes: 'Exemplo de demonstração' },
  { clube: 'Grêmio', temporada: '1995', ano: 1995, modelo: 'goleiro', marca: 'Penalty', tamanho: 'GG', manga: 'longa',
    tipo: 'jogo', conservacao: 'regular', certificado: true, procedencia: 'Usada na temporada, com certificado do vendedor', data_compra: diasAtras(200),
    valor_compra: 1500, status: 'colecao', observacoes: 'Exemplo de demonstração' },
  { clube: 'São Paulo', temporada: '1992', ano: 1992, modelo: 'titular', marca: 'Penalty', tamanho: 'G', manga: 'curta',
    tipo: 'torcedor', conservacao: 'muito_boa', data_compra: diasAtras(80), valor_compra: 320, custos_extras: 20,
    status: 'vendida', preco_pedido: 700, data_venda: diasAtras(40), valor_venda: 650, canal_venda: 'WhatsApp', observacoes: 'Exemplo de demonstração' },
];

export async function carregarExemplos(store) {
  const lista = EXEMPLOS();
  for (const c of lista) await store.salvar(c);
  return lista.length;
}
