// Modo demonstração: tudo no IndexedDB deste navegador (fotos incluídas).
// Mesma interface do store do Supabase.

const DB_NOME = 'manto';
const DB_VERSAO = 1;

function abrir() {
  return new Promise((ok, erro) => {
    const r = indexedDB.open(DB_NOME, DB_VERSAO);
    r.onupgradeneeded = () => {
      const db = r.result;
      db.createObjectStore('camisas', { keyPath: 'id' });
      const f = db.createObjectStore('fotos', { keyPath: 'id' });
      f.createIndex('camisa_id', 'camisa_id');
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => erro(r.error);
  });
}

const pedido = (r) => new Promise((ok, erro) => { r.onsuccess = () => ok(r.result); r.onerror = () => erro(r.error); });

export async function criarStoreLocal() {
  const db = await abrir();
  const urls = new Map(); // cache de object URLs das fotos

  const os = (nome, modo = 'readonly') => db.transaction(nome, modo).objectStore(nome);
  const todos = (nome) => pedido(os(nome).getAll());
  const um = (nome, id) => pedido(os(nome).get(id));
  const gravar = (nome, v) => pedido(os(nome, 'readwrite').put(v));
  const apagar = (nome, id) => pedido(os(nome, 'readwrite').delete(id));
  const fotosDe = (camisaId) => pedido(os('fotos').index('camisa_id').getAll(camisaId));

  const urlDe = (chave, blob) => {
    if (!blob) return null;
    if (!urls.has(chave)) urls.set(chave, URL.createObjectURL(blob));
    return urls.get(chave);
  };
  const liberar = (fotoId) => {
    for (const k of [fotoId, fotoId + '_t']) {
      if (urls.has(k)) { URL.revokeObjectURL(urls.get(k)); urls.delete(k); }
    }
  };
  const fotoSaida = (f) => ({
    id: f.id, camisa_id: f.camisa_id, ordem: f.ordem,
    url: urlDe(f.id, f.full), thumb: urlDe(f.id + '_t', f.thumb || f.full),
  });
  const porOrdem = (a, b) => a.ordem - b.ordem;

  return {
    modo: 'demo',

    async usuario() { return { id: 'demo', email: 'Modo demonstração' }; },
    async entrar() {},
    async sair() {},
    aoMudarLogin() {},

    async listar() {
      const [camisas, fotos] = await Promise.all([todos('camisas'), todos('fotos')]);
      const por = {};
      for (const f of fotos) (por[f.camisa_id] ||= []).push(f);
      return camisas
        .map((c) => ({ ...c, fotos: (por[c.id] || []).sort(porOrdem).map(fotoSaida) }))
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
    },

    async obter(id) {
      const c = await um('camisas', id);
      if (!c) return null;
      const fotos = (await fotosDe(id)).sort(porOrdem).map(fotoSaida);
      return { ...c, fotos };
    },

    async salvar(dados) {
      const { fotos, ...campos } = dados;
      const agora = new Date().toISOString();
      let base = {};
      if (campos.id) {
        base = (await um('camisas', campos.id)) || {};
      } else {
        const existentes = await todos('camisas');
        base = {
          id: crypto.randomUUID(),
          owner_id: 'demo',
          numero: existentes.reduce((m, c) => Math.max(m, c.numero || 0), 0) + 1,
          created_at: agora,
        };
        delete campos.id;
      }
      const registro = { ...base, ...campos, updated_at: agora };
      await gravar('camisas', registro);
      return registro;
    },

    async excluir(id) {
      for (const f of await fotosDe(id)) { liberar(f.id); await apagar('fotos', f.id); }
      await apagar('camisas', id);
    },

    async adicionarFoto(camisaId, { full, thumb }, ordem) {
      const f = { id: crypto.randomUUID(), camisa_id: camisaId, ordem, full, thumb, created_at: new Date().toISOString() };
      await gravar('fotos', f);
      return fotoSaida(f);
    },

    async removerFoto(foto) {
      liberar(foto.id);
      await apagar('fotos', foto.id);
    },

    async ordenarFotos(camisaId, ids) {
      const fotos = await fotosDe(camisaId);
      for (const f of fotos) {
        const i = ids.indexOf(f.id);
        if (i >= 0 && f.ordem !== i) await gravar('fotos', { ...f, ordem: i });
      }
    },

    async limparTudo() {
      for (const k of urls.keys()) URL.revokeObjectURL(urls.get(k));
      urls.clear();
      await pedido(os('fotos', 'readwrite').clear());
      await pedido(os('camisas', 'readwrite').clear());
    },
  };
}
