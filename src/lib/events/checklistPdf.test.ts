import { describe, expect, it } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import type { AppEvent } from '@/types';
import { gerarChecklistPdf } from './checklistPdf';
import { montarChecklist } from './checklist';

/**
 * Desenha o PDF de verdade (jsPDF roda no jsdom) e confere que sai uma folha
 * A4 com o conteúdo. Quando `CHECKLIST_PDF_SAIDA` aponta para uma pasta, o
 * arquivo é gravado lá, para olhar.
 */
const festa: Partial<AppEvent> = {
  title: 'Festa da Primavera',
  slug: 'festa-da-primavera',
  unit: 'Nilópolis',
  location: 'Unidade Nilópolis',
  start_datetime: '2026-09-27T17:00:00.000Z',
  end_datetime: '2026-09-27T21:00:00.000Z',
  created_by: 'Carla Mendes',
  target_audience: 'Os atendidos e suas famílias',
  support_team: 'Voluntários',
  transport_needed: true,
  transport_vehicle: 'van',
  transport_passengers: 12,
  food_items: [
    {
      item: 'Almoço', detalhes: '',
      alimentos: [
        { nome: 'Arroz e feijão', quantidade: '120 porções', fornecedor: 'ANA' },
        { nome: 'Frango assado', quantidade: '25 kg', fornecedor: 'Parceiro', quem: 'Padaria Sol' },
        { nome: 'Suco', quantidade: '40 L', fornecedor: 'Unidade' },
      ],
      cardapio: 'Arroz, feijão, frango assado, salada de alface e tomate. Suco de uva. Servido às 12h30, no refeitório.',
    },
    { item: 'Café da manhã / da tarde', detalhes: '', alimentos: [{ nome: 'Bolo de cenoura', quantidade: '4', fornecedor: 'ANA' }] },
  ],
  equipment_items: [{ item: 'Som', detalhes: '' }, { item: 'Projetor', detalhes: '' }],
  marketing_request: true,
  marketing_coverage: true,
  marketing_confirmed: true,
  marketing_items: [
    { type: 'arte_whatsapp', item: 'Arte para o WhatsApp', description: '', legenda: 'Vem!', conteudo: 'Título' },
    { type: 'cartaz_a4', item: 'Cartaz A4', description: '', legenda: 'Vem!', conteudo: 'Título', quantidade: 6 },
  ],
  partners: [{ type: 'empresa', name: 'Padaria Sol' }],
};

describe('gerarChecklistPdf', () => {
  it('desenha uma folha A4 com o checklist inteiro e o nome do arquivo', async () => {
    const r = await gerarChecklistPdf(festa, montarChecklist(festa), false);
    expect(r.nome).toBe('checklist-festa-da-primavera.pdf');
    expect(r.paginas).toBe(1);
    expect(r.bytes!.byteLength).toBeGreaterThan(2000);
    const cabeca = new TextDecoder().decode(new Uint8Array(r.bytes!).slice(0, 8));
    expect(cabeca).toMatch(/^%PDF-1\./);

    const pasta = process.env.CHECKLIST_PDF_SAIDA;
    if (pasta) {
      mkdirSync(pasta, { recursive: true });
      writeFileSync(`${pasta}/${r.nome}`, Buffer.from(r.bytes!));
    }
  });

  it('uma lista muito longa continua na página seguinte, sem quebrar', async () => {
    const enorme = { ...festa, partners: Array.from({ length: 60 }, (_, i) => ({ type: 'empresa' as const, name: `Parceiro ${i + 1} com nome comprido para ocupar linhas` })) };
    const r = await gerarChecklistPdf(enorme, montarChecklist(enorme), false);
    expect(r.paginas).toBeGreaterThan(1);
  });
});
