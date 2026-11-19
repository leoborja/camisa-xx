// Configuração do Supabase (Settings → API no dashboard do projeto).
// Enquanto estiver vazio, o site roda em MODO DEMONSTRAÇÃO: os dados
// ficam só neste aparelho/navegador (IndexedDB), sem login.
// A anon key é pública por design — a proteção real é o RLS (supabase/schema.sql).
export const CONFIG = {
  // Loja pública (troca pra https://camisaxx.com.br quando o domínio estiver ativo)
  LOJA_URL: 'https://camisa-xx-loja.pages.dev',
  // WhatsApp do Camisa XX (aparece na legenda do Instagram)
  WHATSAPP: '5531984149418',
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
};
