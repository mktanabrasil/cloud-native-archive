-- "Precisa de apoio externo para transporte" passa a ser gravado.
--
-- A frota da ANA é uma unidade de cada: VAN (14 lugares para passageiros),
-- Kombi (11) e um utilitário para carga. Acima de 25 pessoas não há veículo
-- a sugerir; a tela avisa e pede para acionar a equipe de apoio (fretado,
-- segunda viagem, carona de parceiro). Este interruptor guarda que a pessoa
-- viu o aviso e vai acionar — para o detalhe e a lista de pendentes avisarem
-- quem organiza. Decisão de 04/09/2026: só avisa, não barra o envio.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS transport_external_support boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.events.transport_external_support IS 'Vai acionar apoio externo de transporte (fretado etc.): a frota da ANA não basta.';
