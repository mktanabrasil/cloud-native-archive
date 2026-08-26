-- Acesso das gestoras ao Jornal, por unidade.
--
-- Duas mudanças independentes, na ordem em que o fluxo acontece:
--   1. o cadastro volta a guardar o nível e a unidade que a pessoa pediu;
--   2. a tabela `journals` passa a distinguir ler de escrever.
--
-- ATENÇÃO: arquivo em migração não é banco. Rode isto no SQL Editor do
-- Supabase; e antes de rodar a parte 1, compare com a `handle_new_user` que
-- está de fato instalada (Database → Functions) — a versão abaixo foi escrita
-- a partir da última migração do repositório, que pode não ser a que roda.

-- ---------------------------------------------------------------------------
-- 1. O cadastro para de descartar o que a pessoa escolheu
-- ---------------------------------------------------------------------------
--
-- A versão anterior gravava a solicitação com `requested_role` fixo em
-- 'usuario_padrao' e `requested_unit` NULL — ou seja, os dois campos do
-- formulário morriam aqui, e a aprovação chutava a unidade.
--
-- O que **não** muda: o perfil continua nascendo como 'usuario_padrao', sem
-- unidade. O que a pessoa pede é declaração, não credencial; quem concede é a
-- aprovação. Gravar o nível pedido direto no perfil seria deixar qualquer um
-- se promover no cadastro.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    full_name TEXT;
    is_whitelisted BOOLEAN;
    final_role public.app_role;
    final_permission_level TEXT;
    final_active BOOLEAN;
    pedido_papel TEXT;
    pedido_nivel TEXT;
    pedido_unidade TEXT;
BEGIN
    is_whitelisted := LOWER(NEW.email) IN (
      'mkt@anabrasil.org','adm@anabrasil.org','admin@anabrasil.org',
      'financeiro@anabrasil.org','alyson-viana@hotmail.com'
    );
    full_name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1), 'Usuário');

    IF is_whitelisted THEN
        final_role := 'admin'::public.app_role;
        final_permission_level := 'admin_geral';
        final_active := true;
    ELSE
        final_role := 'usuario_padrao'::public.app_role;
        final_permission_level := 'usuario_padrao';
        final_active := true;
    END IF;

    INSERT INTO public.profiles (user_id, email, name, is_active, unit, permission_level)
    VALUES (NEW.id, NEW.email, full_name, final_active,
        CASE WHEN is_whitelisted THEN 'Administração' ELSE NULL END,
        final_permission_level)
    ON CONFLICT (user_id) DO UPDATE SET
        email = EXCLUDED.email,
        permission_level = CASE WHEN is_whitelisted THEN 'admin_geral' ELSE public.profiles.permission_level END,
        is_active = CASE WHEN is_whitelisted THEN true ELSE public.profiles.is_active END,
        unit = CASE WHEN is_whitelisted THEN 'Administração' ELSE public.profiles.unit END;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, final_role)
    ON CONFLICT (user_id) DO UPDATE SET
        role = CASE WHEN is_whitelisted THEN 'admin'::public.app_role ELSE public.user_roles.role END;

    IF NOT is_whitelisted THEN
        -- O que a pessoa escolheu no formulário, validado. Valor estranho vira
        -- o padrão mais restrito, nunca um erro que derrubaria o cadastro.
        pedido_papel := NEW.raw_user_meta_data->>'requested_role';
        IF pedido_papel IS NULL OR pedido_papel NOT IN ('admin', 'editor', 'viewer', 'criador') THEN
            pedido_papel := 'viewer';
        END IF;

        pedido_nivel := NEW.raw_user_meta_data->>'requested_permission_level';
        IF pedido_nivel IS NULL OR pedido_nivel NOT IN ('admin_geral', 'gestor_unidade', 'eventos_parceiros', 'editor', 'visualizador') THEN
            pedido_nivel := 'visualizador';
        END IF;

        pedido_unidade := NULLIF(TRIM(NEW.raw_user_meta_data->>'requested_unit'), '');

        INSERT INTO public.access_requests (
            user_id, requested_role, requested_permission_level, requested_unit, status, name, email
        )
        VALUES (
            NEW.id, pedido_papel::public.app_role, pedido_nivel, pedido_unidade, 'pending', full_name, NEW.email
        )
        ON CONFLICT (user_id) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 2. `journals`: ler é amplo, escrever é da unidade
-- ---------------------------------------------------------------------------
--
-- A ponte entre pessoa e jornal é textual e já existe: `journals.profile_unit`
-- guarda o mesmo rótulo de `profiles.unit` (o app grava os dois juntos, via
-- `profileUnitForNewsUnit`). Comparar os dois evita repetir aqui o catálogo de
-- 20 unidades que vive em `src/lib/news/units.ts`.

-- Unidade de quem pode gerir jornal, ou NULL. Devolve valor só para gestora
-- ativa **com** unidade: a função responde "quem é ela" e "de onde ela é" de
-- uma vez, e é o único lugar onde essa regra mora.
CREATE OR REPLACE FUNCTION public.journal_unit_of(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NULLIF(TRIM(p.unit), '')
  FROM public.profiles p
  WHERE p.user_id = _user_id
    AND p.is_active IS NOT FALSE
    AND p.permission_level = 'gestor_unidade'
$$;

DROP POLICY IF EXISTS "Marketing pode ver jornais" ON public.journals;
DROP POLICY IF EXISTS "Marketing pode criar jornais" ON public.journals;
DROP POLICY IF EXISTS "Marketing pode editar jornais" ON public.journals;
DROP POLICY IF EXISTS "Marketing pode excluir jornais" ON public.journals;

-- Ler: marketing e admin veem tudo. A gestora vê a unidade dela inteira, e
-- das outras só o que já ficou pronto — rascunho alheio é trabalho pela metade.
CREATE POLICY "Ver jornais"
ON public.journals FOR SELECT TO authenticated
USING (
  public.is_marketing_user(auth.uid())
  OR (
    public.journal_unit_of(auth.uid()) IS NOT NULL
    AND (
      profile_unit = public.journal_unit_of(auth.uid())
      OR status = 'finalizado'
    )
  )
);

-- Criar: só dentro da própria unidade.
CREATE POLICY "Criar jornais"
ON public.journals FOR INSERT TO authenticated
WITH CHECK (
  public.is_marketing_user(auth.uid())
  OR profile_unit = public.journal_unit_of(auth.uid())
);

-- Editar: `USING` diz de qual linha ela pode partir; `WITH CHECK` diz em que
-- linha ela pode chegar. Sem o segundo, mudar `profile_unit` num UPDATE
-- moveria o jornal de dono — dela para outra unidade, ou de outra para a dela.
CREATE POLICY "Editar jornais"
ON public.journals FOR UPDATE TO authenticated
USING (
  public.is_marketing_user(auth.uid())
  OR profile_unit = public.journal_unit_of(auth.uid())
)
WITH CHECK (
  public.is_marketing_user(auth.uid())
  OR profile_unit = public.journal_unit_of(auth.uid())
);

-- Excluir: idem. (A exclusão do app é lógica, via `deleted_at`, e passa pela
-- política de UPDATE; esta cobre o DELETE de verdade.)
CREATE POLICY "Excluir jornais"
ON public.journals FOR DELETE TO authenticated
USING (
  public.is_marketing_user(auth.uid())
  OR profile_unit = public.journal_unit_of(auth.uid())
);
