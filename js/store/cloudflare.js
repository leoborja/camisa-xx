// Store real: API própria no Cloudflare (functions/api) — D1 pros dados, KV pras fotos.
// Mesma interface do store local (modo demonstração).

export async function criarStoreCloudflare() {
  const ouvintes = [];
  let usuario = null;
  const avisar = (u) => { usuario = u; ouvintes.forEach((f) => f(u)); };

  async function api(caminho, { metodo = 'GET', corpo } = {}) {
    const opts = { method: metodo, credentials: 'same-origin', headers: {} };
    if (corpo instanceof FormData) opts.body = corpo;
    else if (corpo !== undefined) { opts.body = JSON.stringify(corpo); opts.headers['content-type'] = 'application/json'; }
    let r;
    try { r = await fetch(`/api${caminho}`, opts); } catch { throw new Error('Sem conexão com a internet.'); }
    if (r.status === 401 && caminho !== '/login') { avisar(null); throw new Error('Entre de novo pra continuar.'); }
    let dados = null;
    try { dados = await r.json(); } catch {}
    if (!r.ok) throw new Error(dados?.erro || `Erro ${r.status}`);
    return dados;
  }

  const fotoSaida = (f) => ({ ...f, url: `/api/fotos/${f.id}`, thumb: `/api/fotos/${f.id}?t=1` });
  const comFotos = (c) => ({ ...c, fotos: (c.fotos || []).map(fotoSaida) });

  return {
    modo: 'cloudflare',
    exigeLogin: true,
    soSenha: true,

    async usuario() {
      try {
        const r = await fetch('/api/eu', { credentials: 'same-origin' });
        usuario = r.ok ? await r.json() : null;
      } catch { usuario = null; }
      return usuario;
    },
    async entrar(_email, senha) { avisar(await api('/login', { metodo: 'POST', corpo: { senha } })); },
    async sair() { try { await api('/logout', { metodo: 'POST' }); } finally { avisar(null); } },
    aoMudarLogin(cb) { ouvintes.push(cb); },

    async listar() { return (await api('/camisas')).map(comFotos); },
    async obter(id) {
      try { return comFotos(await api(`/camisas/${encodeURIComponent(id)}`)); }
      catch (e) { if (/não encontrada/i.test(e.message)) return null; throw e; }
    },
    async salvar(dados) {
      const { id, fotos, numero, created_at, updated_at, owner_id, ...campos } = dados;
      const r = id
        ? await api(`/camisas/${encodeURIComponent(id)}`, { metodo: 'PUT', corpo: campos })
        : await api('/camisas', { metodo: 'POST', corpo: campos });
      return comFotos(r);
    },
    async excluir(id) { await api(`/camisas/${encodeURIComponent(id)}`, { metodo: 'DELETE' }); },

    async adicionarFoto(camisaId, { full, thumb }, ordem) {
      const fd = new FormData();
      fd.append('full', full, 'foto.jpg');
      if (thumb) fd.append('thumb', thumb, 'mini.jpg');
      fd.append('ordem', String(ordem));
      return fotoSaida(await api(`/camisas/${encodeURIComponent(camisaId)}/fotos`, { metodo: 'POST', corpo: fd }));
    },
    async removerFoto(foto) { await api(`/fotos/${encodeURIComponent(foto.id)}`, { metodo: 'DELETE' }); },
    async ordenarFotos(camisaId, ids) { await api(`/camisas/${encodeURIComponent(camisaId)}/fotos/ordem`, { metodo: 'PUT', corpo: { ids } }); },
  };
}
