// Escolhe a camada de dados: Supabase (se configurado) ou demonstração local.
// As duas expõem a MESMA interface — as telas não sabem qual está rodando.
import { CONFIG } from '../config.js';

let store;
export async function obterStore() {
  if (store) return store;
  if (CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY) {
    const m = await import('./supabase.js');
    store = await m.criarStoreSupabase(CONFIG);
  } else {
    const m = await import('./local.js');
    store = await m.criarStoreLocal();
  }
  return store;
}
