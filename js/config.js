// Configuração do Supabase (Settings → API no dashboard do projeto).
// Enquanto estiver vazio, o site roda em MODO DEMONSTRAÇÃO: os dados
// ficam só neste aparelho/navegador (IndexedDB), sem login.
// A anon key é pública por design — a proteção real é o RLS (supabase/schema.sql).
export const CONFIG = {
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
};
