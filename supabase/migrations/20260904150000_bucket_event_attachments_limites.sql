-- Limites do balde `event-attachments`.
--
-- O balde não tinha limite de tamanho nem lista de tipos: qualquer pessoa
-- logada subia qualquer coisa, de qualquer tamanho. Ele guarda os anexos de
-- evento, as capas/banners e as fotos do Jornal (`jornal/`, `news/`).
--
-- Medido em 04/09/2026 antes de aplicar: 145 objetos, todos imagem
-- (png 89, jpeg 50, svg 6). Quatro SVGs — as Formas ANA do Jornal — passam
-- de 10 MB (o maior tem 16 MB). Por isso o limite do balde é 25 MB; os
-- 10 MB dos anexos de evento ficam no cliente (`src/lib/events/anexos.ts`).
--
-- Tipos: imagens (o que já existe), mais o que o campo "Anexos" passou a
-- aceitar — PDF, documento, planilha, apresentação, texto.

UPDATE storage.buckets
SET
  file_size_limit = 26214400, -- 25 MB
  allowed_mime_types = ARRAY[
    'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/csv',
    'text/plain'
  ]
WHERE id = 'event-attachments';
