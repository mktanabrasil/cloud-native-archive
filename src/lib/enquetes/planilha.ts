import type { Enquete } from './modelo';

/**
 * A lista de quem votou em planilha (CSV), para a chefia cobrar quem falta
 * (25/09/2026). Separador ponto e vírgula e BOM de UTF-8: é assim que o
 * Excel em português abre com acento e colunas certas, sem importar.
 */

export interface LinhaDaPlanilha {
  nome: string;
  /** Número inteiro (app) ou só o fim (link público). */
  telefone: string;
  opcao_id: string;
  em: string;
  trocou: boolean;
}

const campo = (v: string): string => (/[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

const dataHora = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

export function csvDosVotos(enquete: Pick<Enquete, 'opcoes'>, linhas: LinhaDaPlanilha[], rotuloDoTelefone = 'WhatsApp'): string {
  const titulo = (id: string) => enquete.opcoes.find(o => o.id === id)?.titulo ?? '(opção removida)';
  const cabecalho = ['Nome', rotuloDoTelefone, 'Voto', 'Quando', 'Trocou o voto'];
  const corpo = linhas.map(l => [l.nome || 'Sem nome', l.telefone, titulo(l.opcao_id), dataHora(l.em), l.trocou ? 'sim' : 'não'].map(campo).join(';'));
  return '﻿' + [cabecalho.join(';'), ...corpo].join('\r\n') + '\r\n';
}

/** "votos-qual-folga-voce-prefere-25-09-2026.csv" */
export const nomeDaPlanilha = (slug: string, agora: Date = new Date()): string => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `votos-${slug}-${p(agora.getDate())}-${p(agora.getMonth() + 1)}-${agora.getFullYear()}.csv`;
};

/** Baixa o texto como arquivo no navegador. */
export function baixarArquivo(conteudo: string, nome: string, tipo = 'text/csv;charset=utf-8'): void {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
