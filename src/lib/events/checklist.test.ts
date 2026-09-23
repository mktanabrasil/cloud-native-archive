import { describe, expect, it } from 'vitest';
import type { AppEvent } from '@/types';
import { montarChecklist, resumoDoEvento, tamanhoDoChecklist } from './checklist';
import { linhaDoEvento, nomeDoArquivo } from './checklistPdf';

const festa: Partial<AppEvent> = {
  title: 'Festa da <br>Primavera',
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
      ],
      cardapio: 'Arroz, feijão, frango e salada. 12h30.',
    },
    { item: 'Café da manhã / da tarde', detalhes: '', alimentos: [{ nome: 'Bolo de cenoura', quantidade: '4', fornecedor: 'ANA' }] },
  ],
  equipment_items: [{ item: 'Som', detalhes: '' }, { item: 'Projetor', detalhes: 'HDMI' }],
  marketing_request: true,
  marketing_coverage: true,
  marketing_confirmed: true,
  marketing_items: [
    { type: 'arte_whatsapp', item: 'Arte para o WhatsApp', description: '', legenda: 'Vem!', conteudo: 'Título' },
    { type: 'cartaz_a4', item: 'Cartaz A4', description: '', legenda: 'Vem!', conteudo: 'Título', quantidade: 6 },
  ],
  partners: [{ type: 'empresa', name: 'Padaria Sol' }],
};

describe('montarChecklist', () => {
  it('cada campo preenchido vira itens fixos, nas três colunas', () => {
    const c = montarChecklist(festa);
    expect(c.antes).toEqual([
      'Confirmar VAN para 13 pessoas (frota da ANA)',
      'Providenciar: Arroz e feijão (120 porções), Bolo de cenoura (4)',
      'Confirmar com Parceiro · Padaria Sol: Frango assado, 25 kg',
      'Reservar som, projetor (temos 1) — HDMI',
      'Receber a arte do marketing e mandar nos grupos das famílias',
      'Imprimir 6 cartazes A4 e plastificar',
      'Confirmar com Padaria Sol (parceiro)',
      'Avisar as famílias do dia e do horário',
      'Confirmar quem ajuda no dia: voluntários',
    ]);
    expect(c.noDia).toEqual([
      'Receber e servir almoço (cardápio: Arroz, feijão, frango e salada. 12h30.)',
      'Receber e servir café da manhã / da tarde',
      'Montar e testar som, projetor antes de começar',
      'Recolher os equipamentos ao fim',
      'Registrar com fotos e vídeos pelo celular (a unidade registra, mesmo com o marketing presente)',
      'Colar os cartazes na unidade',
      'Lista de presença',
    ]);
    expect(c.depois).toEqual(['Devolver os equipamentos', 'Mandar as fotos e os vídeos para o marketing', 'Registrar no relatório da unidade']);
    expect(tamanhoDoChecklist(c)).toBe(19);
  });

  it('evento sem nada marcado: só o relatório da unidade', () => {
    const c = montarChecklist({ title: 'Reunião', food_items: [{ item: 'Nenhum', detalhes: '' }], equipment_items: [{ item: 'Nenhum', detalhes: '' }] });
    expect(c).toEqual({ antes: [], noDia: [], depois: ['Registrar no relatório da unidade'] });
  });

  it('refeição do modelo antigo, só com texto, entra no dia com o texto', () => {
    const c = montarChecklist({ food_items: [{ item: 'Jantar', detalhes: 'pizza pra 30' }] });
    expect(c.noDia).toContain('Receber e servir jantar (pizza pra 30)');
    expect(c.antes).toEqual([]);
  });

  it('cobertura sem confirmação: o registro é da unidade', () => {
    const c = montarChecklist({ marketing_request: true, marketing_coverage: true, marketing_confirmed: null });
    expect(c.noDia).toContain('Registrar com fotos e vídeos pelo celular (o registro é da unidade)');
  });
});

describe('resumoDoEvento', () => {
  it('linhas curtas, só do que foi preenchido', () => {
    expect(resumoDoEvento(festa)).toEqual([
      ['Transporte', 'VAN 13/14 · 12 + 1 marketing'],
      ['Alimentação', 'almoço, café da manhã / da tarde · 2 a providenciar'],
      ['Equipamentos', 'som, projetor'],
      ['Marketing', 'cobertura + arte WhatsApp + 6 cartazes'],
    ]);
    expect(resumoDoEvento({ title: 'x' })).toEqual([]);
  });
});

describe('a linha e o nome do PDF', () => {
  it('data, horário, local, endereço e responsável', () => {
    const l = linhaDoEvento(festa);
    expect(l).toMatch(/27 de setembro de 2026/);
    expect(l).toMatch(/14:00 às 18:00/);
    expect(l).toContain('Unidade Nilópolis');
    expect(l).toContain('R. Ana Arruda de Camargo, 344');
    expect(l).toContain('Responsável: Carla Mendes');
  });

  it('o nome do arquivo vem do slug, ou do título sem acento', () => {
    expect(nomeDoArquivo(festa)).toBe('checklist-festa-da-primavera.pdf');
    expect(nomeDoArquivo({ title: 'Ação de Natal' })).toBe('checklist-acao-de-natal.pdf');
  });
});
