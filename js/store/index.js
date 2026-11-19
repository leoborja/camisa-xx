// Escolhe a camada de dados. Todas expõem a MESMA interface — as telas não sabem qual roda.
//  1. Supabase, se configurado em config.js (legado, não usado hoje)
//  2. Cloudflare, se o site estiver hospedado junto da API (/api/saude responde)
//  3. Modo demonstração (dados só no aparelho) — ex.: rodando local ou no GitHub Pages
import { CONFIG } from '../config.js';

let store;

async function temApiCloudflare() {
  try {
    const r = await fetch('/api/saude', { cache: 'no-store' });
    if (!r.ok) return false;
    return (await r.json())?.app === 'camisa-xx';
  } catch {
    return false;
  }
}

export async function obterStore() {
  if (store) return store;
  if (CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY) {
    const m = await import('./supabase.js');
    store = await m.criarStoreSupabase(CONFIG);
  } else if (await temApiCloudflare()) {
    const m = await import('./cloudflare.js');
    store = await m.criarStoreCloudflare();
  } else {
    const m = await import('./local.js');
    store = await m.criarStoreLocal();
  }
  return store;
}
