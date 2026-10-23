import { rotuloDaAjuda, rotuloDoHorario, rotuloDoVinculo } from './modelo';
import type { Inscricao } from './api';

/**
 * A planilha das inscrições (CSV) para a coordenação do Natal Feliz montar as
 * equipes e chamar cada um para o termo de voluntariado. Ponto e vírgula e
 * BOM de UTF-8, como as outras, para o Excel em português abrir certo.
 */

const campo = (v: string): string => (/[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

const dataHora = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** "(19) 99355-8242" */
export const whatsappLegivel = (d: string) =>
  d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : d;

export function csvDasInscricoes(linhas: Inscricao[]): string {
  // As mesmas colunas da planilha do Google (23/10/2026).
  const cabecalho = ['Protocolo', 'Quando', 'Nome', 'WhatsApp', 'Vínculo', 'Unidade', 'Indicado por', 'Igreja', 'Horário', '1ª opção', '2ª opção'];
  const corpo = linhas.map((i) => [
    i.protocolo, dataHora(i.created_at), i.nome, whatsappLegivel(i.whatsapp), rotuloDoVinculo(i.vinculo), i.unidade_nome ?? '',
    i.indicado_por ?? '', i.igreja ?? '', rotuloDoHorario(i.horario), rotuloDaAjuda(i.opcao1), i.opcao2 ? rotuloDaAjuda(i.opcao2) : '',
  ].map(campo).join(';'));
  return '﻿' + [cabecalho.join(';'), ...corpo].join('\r\n') + '\r\n';
}

/** "voluntariado-natal-feliz-todas-20-10-2026.csv" */
export function nomeDaPlanilha(unidadeId: string | null, agora: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `voluntariado-natal-feliz-${unidadeId ?? 'todas'}-${p(agora.getDate())}-${p(agora.getMonth() + 1)}-${agora.getFullYear()}.csv`;
}
