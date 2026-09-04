-- O campo "Tipo": tira "cobertura", traduz o vocabulário antigo, apaga as
-- cópias da importação dupla e passa a exigir um dos seis valores.
--
-- Medido em 04/09/2026, antes de aplicar (108 eventos):
--   * nenhum evento usava os valores da tela; o banco tinha só os do sistema
--     antigo: outro=38, externo=36, interno=34;
--   * 36 dos 38 "outro" eram CÓPIAS de um interno/externo (mesmo título, mesma
--     data) -- a importação de 21/05/2026 rodou duas vezes;
--   * "cobertura" não é tipo de evento, é o pedido de marketing
--     (`marketing_coverage`); saiu da lista.
--
-- Decisão dele (04/09): manter os nomes atuais menos "cobertura", apagar as
-- cópias. Cópia dos 36 registros guardada antes de aplicar
-- (`memory/backup-copias-event-type-outro-2026-09-04.json`). Os anexos das
-- cópias apontam para os mesmos arquivos dos originais -- não apagar no balde.

-- 1. Apaga as cópias (mesmo predicado da consulta do backup) ------------------

DELETE FROM public.events o
WHERE o.event_type = 'outro'
  AND EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.event_type IN ('interno', 'externo')
      AND lower(trim(e.title)) = lower(trim(o.title))
      AND e.start_datetime::date = o.start_datetime::date
  );

-- 2. Traduz o vocabulário antigo ---------------------------------------------
--
-- "interno"/"externo" era a visibilidade do sistema anterior; o par mais
-- próximo na lista atual é "programação interna"/"ação externa".

UPDATE public.events SET event_type = 'programação interna' WHERE event_type = 'interno';
UPDATE public.events SET event_type = 'ação externa'        WHERE event_type = 'externo';
UPDATE public.events SET event_type = 'outro'               WHERE event_type = 'cobertura';

-- 3. Só os seis valores da tela entram daqui em diante ----------------------

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_event_type_check;
ALTER TABLE public.events
  ADD CONSTRAINT events_event_type_check
  CHECK (event_type IN ('reunião', 'evento institucional', 'apresentação', 'ação externa', 'programação interna', 'outro'));
