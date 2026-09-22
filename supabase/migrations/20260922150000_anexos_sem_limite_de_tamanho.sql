-- Anexos de evento sem limite de tamanho por arquivo (decisão de 22/09/2026).
--
-- O front deixou de recusar por tamanho; o balde precisa acompanhar, senão o
-- Storage devolve "Payload too large" e a tela mostra um erro sem explicação.
-- Os tipos aceitos continuam os mesmos (PDF, imagem, planilha, documento).
--
-- Atenção: além do limite do balde, o serviço de Storage tem um teto global
-- (variável FILE_SIZE_LIMIT do container `supabase-storage` no Coolify; no
-- self-hosted o padrão é 50 MB). Se um arquivo maior que isso for recusado,
-- o ajuste é lá, não aqui.
--
-- Aplicar no SQL Editor do Studio (supabase.anabrasil.org) antes de publicar
-- o front.

UPDATE storage.buckets
SET file_size_limit = NULL
WHERE id = 'event-attachments';
