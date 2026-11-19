// Fotos do iPhone chegam com 3–8 MB. Antes de guardar, reduzimos no próprio
// aparelho: uma versão grande (1600px, pro detalhe/loja) e uma miniatura (480px, pra lista).

const GRANDE = 1600;
const MINI = 480;

function carregarImagem(arquivo) {
  return new Promise((ok, erro) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => ok({ img, liberar: () => URL.revokeObjectURL(url) });
    img.onerror = () => { URL.revokeObjectURL(url); erro(new Error('Não consegui abrir essa foto.')); };
    img.src = url;
  });
}

function reduzir(img, max, qualidade) {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const k = Math.min(1, max / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * k);
  canvas.height = Math.round(h * k);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((ok, erro) => canvas.toBlob((b) => {
    canvas.width = canvas.height = 0; // libera memória (importante no iPhone)
    b ? ok(b) : erro(new Error('Falha ao comprimir a foto.'));
  }, 'image/jpeg', qualidade));
}

export async function prepararFoto(arquivo) {
  const { img, liberar } = await carregarImagem(arquivo);
  try {
    const full = await reduzir(img, GRANDE, 0.82);
    const thumb = await reduzir(img, MINI, 0.75);
    return { full, thumb };
  } finally {
    liberar();
  }
}
