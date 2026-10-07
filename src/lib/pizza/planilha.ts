import { ROTULO_DA_AREA, SABORES, rotuloDaForma } from './modelo';
import type { Confirmacao } from './api';

/**
 * A planilha das confirmações (CSV), para a conciliação: o ADM e a
 * comunicação baixam pelo painel quando precisarem (decisão de 07/10: nada
 * de planilha automática no Drive). Ponto e vírgula e BOM de UTF-8, como a
 * das enquetes, para o Excel em português abrir certo.
 */

const campo = (v: string): string => (/[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

const dataHora = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

const dinheiro = (n: number) => n.toFixed(2).replace('.', ',');

export function csvDasConfirmacoes(linhas: Confirmacao[]): string {
  const cabecalho = ['Número', 'Quando', 'Nome', 'Unidade', 'Área', ...SABORES.map(([, r]) => r), 'Pizzas', 'Valor (R$)', 'Pagamento', 'Comprovante', 'Retirada'];
  const corpo = linhas.map((c) => [
    c.numero, dataHora(c.created_at), c.nome, c.unidade_nome, ROTULO_DA_AREA[c.area],
    ...SABORES.map(([k]) => String(c.sabores[k] ?? 0)),
    String(c.quantidade), dinheiro(c.total), rotuloDaForma(c.forma),
    c.comprovante_caminho ? 'sim' : 'não', c.retirada ? 'sim' : 'não',
  ].map(campo).join(';'));
  return '﻿' + [cabecalho.join(';'), ...corpo].join('\r\n') + '\r\n';
}

/** "pizza-da-alegria-todas-07-10-2026.csv" / "pizza-da-alegria-cei-anisio-spinola-07-10-2026.csv" */
export function nomeDaPlanilha(unidadeId: string | null, agora: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `pizza-da-alegria-${unidadeId ?? 'todas'}-${p(agora.getDate())}-${p(agora.getMonth() + 1)}-${agora.getFullYear()}.csv`;
}
