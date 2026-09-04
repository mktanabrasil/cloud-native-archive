-- "Será necessário levar equipamentos/materiais volumosos" passa a ser gravado.
--
-- O interruptor existia no formulário, ligava o aviso de veículo de apoio e
-- morria ao salvar: era estado da tela, não coluna. Quem abria o evento
-- depois não sabia que precisava de apoio (achado nº 8 do Raio-X).

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS transport_extra_equipment boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.events.transport_extra_equipment IS 'Leva equipamentos/materiais volumosos no transporte: pede veículo de apoio.';
