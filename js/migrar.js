// Transferência: camisas cadastradas no site de demonstração (dados só no aparelho)
// → site oficial (Cloudflare). Roda no navegador de quem cadastrou, porque só ele
// enxerga esses dados. É incremental: o que já foi enviado fica anotado e não duplica.
import { esc, sheet, toast } from './ui.js';
import { criarStoreCloudflare } from './store/cloudflare.js';

export const SITE_OFICIAL = location.hostname === 'localhost' ? 'http://localhost:8788' : 'https://camisa-xx.pages.dev';
const CHAVE = 'cxx:transferencia';

export const ehExemplo = (c) => c.observacoes === 'Exemplo de demonstração';
// Banner só aparece no site de demonstração (não no oficial)
export const deveOferecer = (store) => store.modo === 'demo' && !location.hostname.endsWith('pages.dev');

function lerMapa() { try { return JSON.parse(localStorage.getItem(CHAVE) || '{}'); } catch { return {}; } }
function gravarMapa(m) { try { localStorage.setItem(CHAVE, JSON.stringify(m)); } catch {} }

export async function pendentes(store) {
  const mapa = lerMapa();
  const minhas = (await store.listar()).filter((c) => !ehExemplo(c));
  const falta = minhas.filter((c) => !mapa[c.id] || c.fotos.some((f) => !mapa[c.id].fotos?.[f.id]));
  return { total: minhas.length, falta: falta.length };
}

async function transferir(storeLocal, senha, aoProgredir) {
  const remoto = await criarStoreCloudflare({ base: SITE_OFICIAL, senha });
  try { await remoto.verificar(); } catch (e) {
    throw new Error(/Entre de novo/.test(e.message) ? 'Senha incorreta.' : e.message);
  }
  const mapa = lerMapa();
  const minhas = (await storeLocal.listar()).filter((c) => !ehExemplo(c))
    .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
  let feitas = 0;
  for (const c of minhas) {
    aoProgredir(feitas, minhas.length, c.clube);
    if (!mapa[c.id]) {
      const { id, fotos, numero, created_at, updated_at, owner_id, _busca, ...campos } = c;
      const nova = await remoto.salvar(campos);
      mapa[c.id] = { id: nova.id, fotos: {} };
      gravarMapa(mapa);
    }
    const destino = mapa[c.id];
    destino.fotos ||= {};
    for (let i = 0; i < c.fotos.length; i++) {
      const f = c.fotos[i];
      if (destino.fotos[f.id]) continue;
      const full = await (await fetch(f.url)).blob();
      const thumb = await (await fetch(f.thumb)).blob();
      const enviada = await remoto.adicionarFoto(destino.id, { full, thumb }, i);
      destino.fotos[f.id] = enviada.id;
      gravarMapa(mapa);
    }
    feitas++;
  }
  aoProgredir(feitas, minhas.length, '');
  return feitas;
}

// Bloco que aparece no topo do acervo do site de demonstração
export async function blocoTransferencia(store) {
  const { total, falta } = await pendentes(store);
  if (!total) {
    return `<div class="aviso-transferir"><p><b>Este é o site de teste.</b> O site oficial, onde as camisas ficam guardadas na nuvem, é
      <a href="${SITE_OFICIAL}">${esc(SITE_OFICIAL.replace(/^https?:\/\//, ''))}</a>.</p></div>`;
  }
  if (!falta) {
    return `<div class="aviso-transferir ok"><p><b>${total === 1 ? 'Sua camisa já está' : `Suas ${total} camisas já estão`} no site oficial.</b> Continue cadastrando por lá.</p>
      <a class="btn btn-primario btn-cheio" href="${SITE_OFICIAL}">Abrir o site oficial</a></div>`;
  }
  return `<div class="aviso-transferir"><p><b>Este é o site de teste:</b> as camisas ficam só neste celular.
      Passe ${falta === 1 ? 'a camisa' : `as ${falta} camisas`} (com as fotos) pro site oficial.</p>
    <button class="btn btn-primario btn-cheio" id="transferir">Passar pro site oficial</button></div>`;
}

export function ligarTransferencia(root, store, aoTerminar) {
  root.querySelector('#transferir')?.addEventListener('click', () => {
    sheet({
      titulo: 'Passar pro site oficial',
      html: `
        <form id="f-transf" class="form-sheet">
          <p class="suave">Digite a senha do site oficial. As camisas e fotos deste celular vão ser copiadas pra lá. Os exemplos ficam de fora.</p>
          <label class="campo"><span>Senha</span><input type="password" name="senha" required autocomplete="current-password"></label>
          <p class="erro-msg" id="t-erro" hidden></p>
          <div class="progresso" id="t-prog" hidden><i></i></div>
          <p class="suave" id="t-msg" hidden></p>
          <button class="btn btn-primario btn-cheio" type="submit" id="t-btn">Transferir</button>
        </form>`,
      aoMontar: (el, fechar) => {
        const f = el.querySelector('#f-transf');
        const btn = el.querySelector('#t-btn');
        const erro = el.querySelector('#t-erro');
        const prog = el.querySelector('#t-prog');
        const msg = el.querySelector('#t-msg');
        f.addEventListener('submit', async (ev) => {
          ev.preventDefault();
          btn.disabled = true; btn.textContent = 'Transferindo…'; erro.hidden = true;
          prog.hidden = false; msg.hidden = false;
          try {
            const n = await transferir(store, f.senha.value, (feitas, total, clube) => {
              prog.querySelector('i').style.width = `${total ? Math.round((feitas / total) * 100) : 100}%`;
              msg.textContent = clube ? `Enviando ${feitas + 1} de ${total}: ${clube}` : `${feitas} de ${total} enviadas`;
            });
            fechar(true);
            toast(`${n} ${n === 1 ? 'camisa transferida' : 'camisas transferidas'}`);
            aoTerminar();
          } catch (e) {
            erro.textContent = e.message.includes('Senha') ? e.message : `Parou no meio: ${e.message}. Toque de novo pra continuar de onde parou.`;
            erro.hidden = false;
            btn.disabled = false; btn.textContent = 'Tentar de novo';
          }
        });
      },
    });
  });
}
