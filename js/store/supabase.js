// Store real: Supabase (banco + login + fotos no Storage).
// Mesma interface do store local (modo demonstração).
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

const BUCKET = 'fotos';

// Colunas que o site pode gravar (o resto é do banco: id, owner_id, numero, datas).
const CAMPOS = [
  'clube', 'temporada', 'ano', 'modelo', 'marca', 'patrocinio', 'tamanho', 'manga', 'jogador', 'numero_camisa',
  'tipo', 'codigo_produto', 'procedencia', 'certificado',
  'conservacao', 'defeitos',
  'data_compra', 'valor_compra', 'custos_extras', 'origem',
  'status', 'preco_pedido', 'data_venda', 'valor_venda', 'canal_venda', 'comprador',
  'observacoes', 'publicada',
];

export async function criarStoreSupabase({ SUPABASE_URL, SUPABASE_ANON_KEY }) {
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true },
  });

  const ok = ({ data, error }) => { if (error) throw error; return data; };
  const publica = (path) => (path ? sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl : null);
  const fotoSaida = (f) => ({
    id: f.id, camisa_id: f.camisa_id, ordem: f.ordem, path: f.path, thumb_path: f.thumb_path,
    url: publica(f.path), thumb: publica(f.thumb_path || f.path),
  });
  const comFotos = (c) => ({ ...c, fotos: (c.fotos || []).sort((a, b) => a.ordem - b.ordem).map(fotoSaida) });
  const usuario = async () => (await sb.auth.getSession()).data.session?.user ?? null;

  return {
    modo: 'supabase',

    usuario,
    async entrar(email, senha) { ok(await sb.auth.signInWithPassword({ email, password: senha })); },
    async sair() { await sb.auth.signOut(); },
    aoMudarLogin(cb) { sb.auth.onAuthStateChange((_ev, sessao) => cb(sessao?.user ?? null)); },

    async listar() {
      const data = ok(await sb.from('camisas').select('*, fotos(*)').order('created_at', { ascending: false }));
      return data.map(comFotos);
    },

    async obter(id) {
      const c = ok(await sb.from('camisas').select('*, fotos(*)').eq('id', id).maybeSingle());
      return c ? comFotos(c) : null;
    },

    async salvar(dados) {
      const linha = {};
      for (const k of CAMPOS) if (k in dados) linha[k] = dados[k];
      if (dados.id) return ok(await sb.from('camisas').update(linha).eq('id', dados.id).select().single());
      return ok(await sb.from('camisas').insert(linha).select().single());
    },

    async excluir(id) {
      const fotos = ok(await sb.from('fotos').select('path, thumb_path').eq('camisa_id', id));
      const paths = fotos.flatMap((f) => [f.path, f.thumb_path]).filter(Boolean);
      if (paths.length) ok(await sb.storage.from(BUCKET).remove(paths));
      ok(await sb.from('camisas').delete().eq('id', id));
    },

    async adicionarFoto(camisaId, { full, thumb }, ordem) {
      const u = await usuario();
      const fid = crypto.randomUUID();
      const base = `${u.id}/${camisaId}/${fid}`;
      const opts = { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false };
      ok(await sb.storage.from(BUCKET).upload(`${base}.jpg`, full, opts));
      if (thumb) ok(await sb.storage.from(BUCKET).upload(`${base}_t.jpg`, thumb, opts));
      const linha = ok(await sb.from('fotos').insert({
        id: fid, camisa_id: camisaId, path: `${base}.jpg`, thumb_path: thumb ? `${base}_t.jpg` : null, ordem,
      }).select().single());
      return fotoSaida(linha);
    },

    async removerFoto(foto) {
      const paths = [foto.path, foto.thumb_path].filter(Boolean);
      if (paths.length) ok(await sb.storage.from(BUCKET).remove(paths));
      ok(await sb.from('fotos').delete().eq('id', foto.id));
    },

    async ordenarFotos(_camisaId, ids) {
      await Promise.all(ids.map(async (id, i) => ok(await sb.from('fotos').update({ ordem: i }).eq('id', id))));
    },
  };
}
