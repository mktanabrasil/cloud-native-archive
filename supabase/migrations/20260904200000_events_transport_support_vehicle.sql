-- Veículo de apoio no transporte.
--
-- Quando o grupo não cabe num veículo só (a VAN leva 14 passageiros, o
-- motorista ocupa o 15º assento), a tela passa a sugerir e gravar o segundo
-- veículo. Antes só dizia "contabilize um veículo de apoio" e não guardava
-- qual. Mesmos valores de `transport_vehicle`: van, kombi, utilitario.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS transport_support_vehicle text;

COMMENT ON COLUMN public.events.transport_support_vehicle IS 'Segundo veículo quando o principal não basta (van, kombi, utilitario). Nulo = só um.';
