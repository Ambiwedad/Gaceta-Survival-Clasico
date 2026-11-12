// Configuración de la Gaceta Survival.
// Copia estos dos valores desde Supabase → Project Settings → API.
// La "anon public key" está pensada para ser pública: la seguridad la dan
// las reglas (RLS) del archivo supabase/schema.sql. NUNCA pongas aquí la
// "service_role key".
window.GACETA_CONFIG = {
  supabaseUrl: "https://gfapsmpvekmvfdtvhjte.supabase.co",
  supabaseAnonKey: "sb_publishable_VJWmMvkUjXo7Jjc1npAOhA_UzM4V7Xs",
};
