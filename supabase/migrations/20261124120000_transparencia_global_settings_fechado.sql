-- Portal Transparência: o token do Google Drive fica só para a função (24/11/2026).
--
-- global_settings guarda a chave google_drive_refresh_token, usada apenas pela
-- função google-drive-proxy, que entra como service_role. Do jeito antigo, a
-- política "Admins can manage global settings" tinha WITH CHECK (true) e o
-- anon tinha GRANT ALL: qualquer pessoa conseguia gravar uma chave nova, por
-- exemplo o próprio token, logo depois de uma desconexão. O app (navegador)
-- não lê nem grava essa tabela.

DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'global_settings' LOOP
    EXECUTE format('DROP POLICY %I ON public.global_settings', p.policyname);
  END LOOP;
END $$;

ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.global_settings FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.global_settings TO service_role;

-- Conferência: políticas 0, anon_grava false, authenticated_le false, token_guardado true.
SELECT
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'global_settings') AS politicas,
  has_table_privilege('anon', 'public.global_settings', 'INSERT') AS anon_grava,
  has_table_privilege('authenticated', 'public.global_settings', 'SELECT') AS authenticated_le,
  EXISTS (SELECT 1 FROM public.global_settings WHERE key = 'google_drive_refresh_token') AS token_guardado;
