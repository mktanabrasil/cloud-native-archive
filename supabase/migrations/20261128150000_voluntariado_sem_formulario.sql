-- Voluntariado do Natal Feliz (28/11/2026, a pedido): quem entrou sem o formulário.
--
-- Algumas pessoas foram colocadas à mão na planilha da coordenação e no grupo
-- geral do WhatsApp, e a Central do Voluntário (que só conhece o número da
-- inscrição e o dos gestores) dizia "não encontrado". Agora:
--
-- 1. Cada inscrição sabe de onde veio: formulario, painel ou planilha.
-- 2. cadastrar_voluntario_manual: a comunicação cadastra pelo painel, sem prazo
--    nem meta, em qualquer uma das 12 áreas. Ganha protocolo como o formulário.
--    O que vem do painel vai para a planilha; o que veio da planilha não volta
--    para ela (já está lá).
-- 3. voluntariado_grupo: os números do grupo geral, carregados pelo painel
--    (substituir_grupo_do_voluntariado troca a lista inteira).
-- 4. A Central reconhece quem está só no grupo: vê o cronograma e os avisos
--    para todos (perfil "grupo", sem área nem turno). Inscrição e gestor vêm antes.
--
-- ORDEM: rodar ANTES do merge (o app novo chama as funções novas).
-- Pode rodar de novo sem estragar nada.

-- 1. A origem de cada inscrição -----------------------------------------------------------------

ALTER TABLE public.voluntarios_natal ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'formulario';
ALTER TABLE public.voluntarios_natal DROP CONSTRAINT IF EXISTS voluntarios_origem_check;
ALTER TABLE public.voluntarios_natal ADD CONSTRAINT voluntarios_origem_check CHECK (origem IN ('formulario', 'painel', 'planilha'));

-- 2. O cadastro pelo painel ----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cadastrar_voluntario_manual(
  p_nome text,
  p_whatsapp text,
  p_vinculo text,
  p_opcao1 text,
  p_horario text DEFAULT NULL,
  p_opcao2 text DEFAULT NULL,
  p_unidade_id text DEFAULT NULL,
  p_unidade_nome text DEFAULT NULL,
  p_area text DEFAULT NULL,
  p_origem text DEFAULT 'painel'
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  letras constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  todas constant text[] := ARRAY['cozinha', 'montagem', 'decoracao', 'limpeza_pre', 'inflaveis', 'estacoes',
                                 'louvor_kids', 'som', 'recreacao_kids', 'presentes_kids', 'ccii', 'atipicas'];
  v_whatsapp text := public.voluntariado_whatsapp(p_whatsapp);
  v_nome text := left(btrim(regexp_replace(coalesce(p_nome, ''), '\s+', ' ', 'g')), 120);
  v_opcao2 text := nullif(btrim(coalesce(p_opcao2, '')), '');
  v_horario text := nullif(btrim(coalesce(p_horario, '')), '');
  v_protocolo text;
  tentativa integer := 0;
BEGIN
  IF NOT public.is_marketing_user(auth.uid()) THEN RAISE EXCEPTION 'sem_permissao'; END IF;
  IF coalesce(p_origem, '') NOT IN ('painel', 'planilha') THEN RAISE EXCEPTION 'origem_invalida'; END IF;
  IF char_length(v_nome) < 3 THEN RAISE EXCEPTION 'nome_invalido'; END IF;
  IF v_whatsapp !~ '^[1-9][0-9]{9,10}$' THEN RAISE EXCEPTION 'whatsapp_invalido'; END IF;
  IF coalesce(p_vinculo, '') NOT IN ('funcionario', 'alcance', 'comunidade') THEN RAISE EXCEPTION 'vinculo_invalido'; END IF;
  IF v_horario IS NOT NULL AND v_horario NOT IN ('manha', 'tarde', 'dia_anterior', 'pos_evento', 'dia_todo') THEN RAISE EXCEPTION 'horario_invalido'; END IF;
  IF v_opcao2 = p_opcao1 THEN v_opcao2 := NULL; END IF;
  IF p_opcao1 IS NULL OR NOT (p_opcao1 = ANY (todas)) OR (v_opcao2 IS NOT NULL AND NOT (v_opcao2 = ANY (todas))) THEN
    RAISE EXCEPTION 'area_invalida';
  END IF;
  IF p_vinculo = 'funcionario' AND (
       char_length(btrim(coalesce(p_unidade_id, ''))) NOT BETWEEN 1 AND 60
       OR char_length(btrim(coalesce(p_unidade_nome, ''))) NOT BETWEEN 1 AND 120
       OR coalesce(p_area, '') NOT IN ('educacao', 'social')) THEN
    RAISE EXCEPTION 'unidade_invalida';
  END IF;
  IF EXISTS (SELECT 1 FROM public.voluntarios_natal v WHERE v.whatsapp = v_whatsapp) THEN
    RAISE EXCEPTION 'ja_inscrito';
  END IF;

  LOOP
    tentativa := tentativa + 1;
    v_protocolo := 'VL-' || (
      SELECT string_agg(substr(letras, 1 + floor(random() * length(letras))::integer, 1), '')
      FROM generate_series(1, 5)
    );
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.voluntarios_natal v WHERE v.protocolo = v_protocolo);
    IF tentativa >= 20 THEN RAISE EXCEPTION 'protocolo_indisponivel'; END IF;
  END LOOP;

  INSERT INTO public.voluntarios_natal
    (protocolo, nome, whatsapp, horario, vinculo, unidade_id, unidade_nome, area, opcao1, opcao2, origem, planilha_em)
  VALUES
    (v_protocolo, v_nome, v_whatsapp, v_horario, p_vinculo,
     CASE WHEN p_vinculo = 'funcionario' THEN btrim(p_unidade_id) END,
     CASE WHEN p_vinculo = 'funcionario' THEN btrim(p_unidade_nome) END,
     CASE WHEN p_vinculo = 'funcionario' THEN p_area END,
     p_opcao1, v_opcao2, p_origem,
     -- Quem veio da planilha já está nela: não escreve de novo.
     CASE WHEN p_origem = 'planilha' THEN now() END);
  RETURN v_protocolo;
END;
$$;

REVOKE ALL ON FUNCTION public.cadastrar_voluntario_manual(text, text, text, text, text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cadastrar_voluntario_manual(text, text, text, text, text, text, text, text, text, text) TO authenticated;

-- 3. Os números do grupo geral -------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.voluntariado_grupo (
  whatsapp      text PRIMARY KEY CHECK (whatsapp ~ '^[0-9]{10,11}$'),
  nome          text,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.voluntariado_grupo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS grupo_comunicacao ON public.voluntariado_grupo;
CREATE POLICY grupo_comunicacao ON public.voluntariado_grupo FOR SELECT TO authenticated
  USING (public.is_marketing_user(auth.uid()));
REVOKE ALL ON public.voluntariado_grupo FROM anon, authenticated;
GRANT SELECT ON public.voluntariado_grupo TO authenticated;
GRANT ALL ON public.voluntariado_grupo TO service_role;

-- Troca a lista inteira: [{"whatsapp": "19999998888", "nome": "Maria"}, ...]. Devolve quantos ficaram.
CREATE OR REPLACE FUNCTION public.substituir_grupo_do_voluntariado(p_lista jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  IF NOT public.is_marketing_user(auth.uid()) THEN RAISE EXCEPTION 'sem_permissao'; END IF;
  IF p_lista IS NULL OR jsonb_typeof(p_lista) <> 'array' THEN RAISE EXCEPTION 'lista_invalida'; END IF;
  DELETE FROM public.voluntariado_grupo WHERE true;
  INSERT INTO public.voluntariado_grupo (whatsapp, nome)
  SELECT DISTINCT ON (t.tel) t.tel, t.nome
  FROM (
    SELECT public.voluntariado_whatsapp(e->>'whatsapp') AS tel,
           nullif(left(btrim(regexp_replace(coalesce(e->>'nome', ''), '\s+', ' ', 'g')), 120), '') AS nome
    FROM jsonb_array_elements(p_lista) e
  ) t
  WHERE t.tel ~ '^[1-9][0-9]{9,10}$'
  ORDER BY t.tel, t.nome NULLS LAST;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.substituir_grupo_do_voluntariado(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.substituir_grupo_do_voluntariado(jsonb) TO authenticated;

-- 4. A Central reconhece quem está só no grupo ---------------------------------------------------

CREATE OR REPLACE FUNCTION public.central_do_voluntario(p_whatsapp text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v public.voluntarios_natal;
  g public.voluntariado_gestores;
  m public.voluntariado_grupo;
  v_tel text := public.voluntariado_whatsapp(p_whatsapp);
  v_cronograma jsonb;
BEGIN
  v_cronograma := coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'id', c.id, 'dia', c.dia, 'inicio', to_char(c.inicio, 'HH24:MI'), 'fim', to_char(c.fim, 'HH24:MI'),
      'titulo', c.titulo, 'tipo', c.tipo, 'local', c.local, 'detalhe', c.detalhe, 'areas', c.areas, 'horarios', c.horarios)
      ORDER BY c.dia, c.inicio, c.titulo)
    FROM public.voluntariado_cronograma c), '[]'::jsonb);

  SELECT * INTO v FROM public.voluntarios_natal WHERE whatsapp = v_tel;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'perfil', 'voluntario',
      'voluntario', jsonb_build_object(
        'protocolo', v.protocolo, 'nome', v.nome, 'vinculo', v.vinculo, 'unidade_nome', v.unidade_nome,
        'igreja', v.igreja, 'horario', v.horario, 'opcao1', v.opcao1, 'opcao2', v.opcao2, 'inscrito_em', v.created_at),
      'presencas', coalesce((SELECT jsonb_object_agg(p.momento, p.registrado_em) FROM public.voluntariado_presencas p WHERE p.voluntario_id = v.id), '{}'::jsonb),
      'cronograma', v_cronograma,
      'avisos', coalesce((
        SELECT jsonb_agg(jsonb_build_object('id', a.id, 'titulo', a.titulo, 'texto', a.texto, 'enviado_em', a.enviado_em) ORDER BY a.enviado_em DESC)
        FROM (SELECT * FROM public.voluntariado_avisos x
              WHERE x.enviado_em IS NOT NULL AND NOT x.pulado
                AND public.voluntariado_e_para(x.areas, x.horarios, v.opcao1, v.horario)
              ORDER BY x.enviado_em DESC LIMIT 30) a), '[]'::jsonb),
      'celulares', (SELECT count(*) FROM public.voluntariado_dispositivos d WHERE d.voluntario_id = v.id)
    );
  END IF;

  -- O gestor: sem inscrição, vê tudo e recebe todos os avisos.
  SELECT * INTO g FROM public.voluntariado_gestores WHERE whatsapp = v_tel;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'perfil', 'gestor',
      'voluntario', jsonb_build_object(
        'protocolo', null, 'nome', g.nome, 'vinculo', 'gestao', 'unidade_nome', null,
        'igreja', null, 'horario', null, 'opcao1', null, 'opcao2', null, 'inscrito_em', g.criado_em),
      'presencas', '{}'::jsonb,
      'cronograma', v_cronograma,
      'avisos', coalesce((
        SELECT jsonb_agg(jsonb_build_object('id', a.id, 'titulo', a.titulo, 'texto', a.texto, 'enviado_em', a.enviado_em) ORDER BY a.enviado_em DESC)
        FROM (SELECT * FROM public.voluntariado_avisos x
              WHERE x.enviado_em IS NOT NULL AND NOT x.pulado
              ORDER BY x.enviado_em DESC LIMIT 30) a), '[]'::jsonb),
      'celulares', (SELECT count(*) FROM public.voluntariado_dispositivos d WHERE d.gestor_id = g.id)
    );
  END IF;

  -- Quem está no grupo geral do WhatsApp sem inscrição (28/11/2026): vê o
  -- cronograma e os avisos que são para todos, sem área nem turno.
  SELECT * INTO m FROM public.voluntariado_grupo WHERE whatsapp = v_tel;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'perfil', 'grupo',
      'voluntario', jsonb_build_object(
        'protocolo', null, 'nome', coalesce(m.nome, 'Voluntário(a)'), 'vinculo', 'grupo', 'unidade_nome', null,
        'igreja', null, 'horario', null, 'opcao1', null, 'opcao2', null, 'inscrito_em', m.atualizado_em),
      'presencas', '{}'::jsonb,
      'cronograma', v_cronograma,
      'avisos', coalesce((
        SELECT jsonb_agg(jsonb_build_object('id', a.id, 'titulo', a.titulo, 'texto', a.texto, 'enviado_em', a.enviado_em) ORDER BY a.enviado_em DESC)
        FROM (SELECT * FROM public.voluntariado_avisos x
              WHERE x.enviado_em IS NOT NULL AND NOT x.pulado
                AND public.voluntariado_e_para(x.areas, x.horarios, NULL, NULL)
              ORDER BY x.enviado_em DESC LIMIT 30) a), '[]'::jsonb),
      'celulares', 0
    );
  END IF;

  -- Um pouco de espera em cada número errado: tentar um atrás do outro fica lento.
  PERFORM pg_sleep(0.4);
  RAISE EXCEPTION 'nao_encontrado';
END;
$$;


GRANT EXECUTE ON FUNCTION public.central_do_voluntario(text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

-- Conferência: as linhas devem mostrar true.
SELECT 'coluna origem' AS item, EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'voluntarios_natal' AND column_name = 'origem')::text AS valor
UNION ALL SELECT 'cadastro manual', (to_regprocedure('public.cadastrar_voluntario_manual(text, text, text, text, text, text, text, text, text, text)') IS NOT NULL)::text
UNION ALL SELECT 'tabela do grupo', (to_regclass('public.voluntariado_grupo') IS NOT NULL)::text
UNION ALL SELECT 'troca da lista do grupo', (to_regprocedure('public.substituir_grupo_do_voluntariado(jsonb)') IS NOT NULL)::text
UNION ALL SELECT 'Central com o grupo', (position('voluntariado_grupo' in pg_get_functiondef('public.central_do_voluntario(text)'::regprocedure)) > 0)::text;
