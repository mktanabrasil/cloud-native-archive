-- Trabalhe Conosco, passo 7 do roteiro (21/10/2026): modelos de e-mail.
--
-- Decisões dele: só os modelos de e-mail (as etapas continuam fixas:
-- Recebida › Análise › Entrevista › Resultado); quem edita é o RH (e o
-- admin), com as versões guardadas; cobre todos os e-mails do Trabalhe
-- Conosco, os do candidato e o da equipe ("Responsável nomeado").
--
-- Cada modelo tem assunto, título e texto, com campos entre chaves
-- ({nome}, {vaga}…). A identidade do e-mail (logo, botão, fio de cores, o
-- quadro do protocolo e o da entrevista) é fixa. Os textos de hoje entram
-- como o "texto original" (padrao_*), para o "Voltar ao texto original".
-- Quem lê os modelos para mandar é a função candidatura-confirmacao; se a
-- linha sumir, ela usa o mesmo texto embutido.

-- 1. Os modelos ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.email_modelos (
  chave           text PRIMARY KEY,
  assunto         text NOT NULL,
  titulo          text NOT NULL,
  texto           text NOT NULL,
  padrao_assunto  text NOT NULL,
  padrao_titulo   text NOT NULL,
  padrao_texto    text NOT NULL,
  atualizado_por  text,
  atualizado_em   timestamptz,
  CONSTRAINT email_modelos_chave_check CHECK (chave IN (
    'confirmacao', 'analise', 'entrevista', 'aprovado', 'nao_selecionado',
    'convite', 'pergunta', 'recado', 'responsavel'
  )),
  CONSTRAINT email_modelos_tamanho_check CHECK (
    length(btrim(assunto)) BETWEEN 1 AND 150 AND length(btrim(titulo)) BETWEEN 1 AND 150 AND length(btrim(texto)) BETWEEN 1 AND 2000
  )
);

CREATE TABLE IF NOT EXISTS public.email_modelos_versoes (
  id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  chave     text NOT NULL REFERENCES public.email_modelos (chave) ON DELETE CASCADE,
  assunto   text NOT NULL,
  titulo    text NOT NULL,
  texto     text NOT NULL,
  por       text,
  em        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_modelos_versoes_idx ON public.email_modelos_versoes (chave, em DESC);

ALTER TABLE public.email_modelos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_modelos_versoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS email_modelos_rh ON public.email_modelos;
CREATE POLICY email_modelos_rh ON public.email_modelos FOR SELECT TO authenticated
  USING (public.is_rh_or_admin(auth.uid()));
DROP POLICY IF EXISTS email_modelos_versoes_rh ON public.email_modelos_versoes;
CREATE POLICY email_modelos_versoes_rh ON public.email_modelos_versoes FOR SELECT TO authenticated
  USING (public.is_rh_or_admin(auth.uid()));

-- Ninguém escreve direto: salvar passa pela função abaixo, que guarda a versão anterior.
REVOKE ALL ON public.email_modelos, public.email_modelos_versoes FROM anon, authenticated;
GRANT SELECT ON public.email_modelos, public.email_modelos_versoes TO authenticated;
GRANT ALL ON public.email_modelos, public.email_modelos_versoes TO service_role;

-- 2. Os textos de hoje como ponto de partida -----------------------------------------------

INSERT INTO public.email_modelos (chave, assunto, titulo, texto, padrao_assunto, padrao_titulo, padrao_texto)
SELECT chave, assunto, titulo, texto, assunto, titulo, texto FROM (VALUES
  ('confirmacao',
   $t$Candidatura recebida · {vaga} · {protocolo}$t$,
   $t$Recebemos sua candidatura, {nome}.$t$,
   $t${vaga}

Próximos passos: o RH analisa as candidaturas. Se você avançar, avisamos pelo app e por e-mail.$t$),
  ('analise',
   $t$Sua candidatura está em análise · {vaga}$t$,
   $t${nome}, sua candidatura está em análise.$t$,
   $t$O RH começou a analisar a sua candidatura para {vaga} (protocolo {protocolo}).

Se você avançar, avisamos por aqui de novo.$t$),
  ('entrevista',
   $t$Você avançou para a entrevista · {vaga}$t$,
   $t$Boa notícia, {nome}: você avançou para a entrevista.$t$,
   $t$Sua candidatura para {vaga} (protocolo {protocolo}) passou para a etapa de entrevista.

O RH vai entrar em contato pelo WhatsApp do seu perfil para combinar dia e horário. Confira se o número está certo.$t$),
  ('aprovado',
   $t$Você foi aprovado(a) · {vaga}$t$,
   $t$Parabéns, {nome}! Você foi aprovado(a).$t$,
   $t$Você foi aprovado(a) no processo para {vaga} (protocolo {protocolo}).

O RH vai entrar em contato com os próximos passos.$t$),
  ('nao_selecionado',
   $t$Resultado da sua candidatura · {vaga}$t$,
   $t${nome}, obrigado por se candidatar.$t$,
   $t$Desta vez você não foi selecionado(a) para {vaga} (protocolo {protocolo}).

Seu perfil continua no Trabalhe Conosco, e você pode se candidatar a outras vagas quando quiser.$t$),
  ('convite',
   $t$Convite para entrevista · {vaga}$t$,
   $t${nome}, você foi convidado(a) para uma entrevista.$t$,
   $t${mensagem}

Confirme sua presença pelo app (ou avise se não puder nesse horário).$t$),
  ('pergunta',
   $t$O RH tem uma pergunta · {vaga}$t$,
   $t${nome}, o RH precisa de uma informação.$t$,
   $t${mensagem}

Responda pelo app, na sua candidatura.$t$),
  ('recado',
   $t$Mensagem do RH · {vaga}$t$,
   $t${nome}, uma mensagem sobre sua candidatura.$t$,
   $t${mensagem}$t$),
  ('responsavel',
   $t$Você é responsável pelo processo · {vaga}$t$,
   $t${nome}, você é responsável por um processo seletivo.$t$,
   $t$O RH nomeou você responsável pelo processo {vaga} ({codigo}). Prazo do processo: {prazo}.

No app, os candidatos aparecem em Vagas › Meus processos: você abre as fichas, vê o currículo e move até a entrevista. O resultado final fica com o RH.$t$)
) AS m (chave, assunto, titulo, texto)
ON CONFLICT (chave) DO UPDATE
  SET padrao_assunto = EXCLUDED.padrao_assunto, padrao_titulo = EXCLUDED.padrao_titulo, padrao_texto = EXCLUDED.padrao_texto;

-- 3. Salvar (só o RH): guarda a versão anterior e grava a nova -----------------------------

CREATE OR REPLACE FUNCTION public.salvar_email_modelo(p_chave text, p_assunto text, p_titulo text, p_texto text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  atual record;
BEGIN
  IF NOT public.is_rh_or_admin(auth.uid()) THEN RAISE EXCEPTION 'sem_permissao'; END IF;
  SELECT * INTO atual FROM public.email_modelos WHERE chave = p_chave FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'modelo_nao_encontrado'; END IF;
  -- Os modelos de mensagem precisam do lugar onde entra o texto que o RH escreveu.
  IF p_chave IN ('convite', 'pergunta', 'recado') AND position('{mensagem}' IN p_texto) = 0 THEN
    RAISE EXCEPTION 'falta_mensagem';
  END IF;
  IF atual.assunto = btrim(p_assunto) AND atual.titulo = btrim(p_titulo) AND atual.texto = btrim(p_texto) THEN RETURN; END IF;
  INSERT INTO public.email_modelos_versoes (chave, assunto, titulo, texto, por, em)
  VALUES (atual.chave, atual.assunto, atual.titulo, atual.texto, coalesce(atual.atualizado_por, 'texto original'), coalesce(atual.atualizado_em, now()));
  UPDATE public.email_modelos
     SET assunto = btrim(p_assunto), titulo = btrim(p_titulo), texto = btrim(p_texto),
         atualizado_por = public.nome_de_quem_age(), atualizado_em = now()
   WHERE chave = p_chave;
END;
$$;

REVOKE ALL ON FUNCTION public.salvar_email_modelo(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salvar_email_modelo(text, text, text, text) TO authenticated;
