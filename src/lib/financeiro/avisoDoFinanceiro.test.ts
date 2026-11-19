import { describe, expect, it } from 'vitest';
import { COPIA_DOS_SETORES, copiaDosSetores, configDaEquipeDaLeitura, destinatariosDoFinanceiro, listasNoCancelamento, ehAvisoDaEquipe as ehDaEquipeNaFuncao, ehAvisoDoFinanceiro, listasParaGravar } from '../../../supabase/functions/eventos-aviso/fila';
import {
  assuntoDoFinanceiro, corpoDoFinanceiroHtml, corpoDoFinanceiroTexto, itensDeCompra, linkDoFinanceiro, mudancaDoPedido, pedidoSemMudanca, previaDoFinanceiro,
} from '../../../supabase/functions/eventos-aviso/financeiro';
import { itensDoEvento, type EventoDoFinanceiro } from './compras';
import { COPIA_DOS_SETORES as COPIA_DO_APP, ROTULO_DO_TIPO, ehAvisoDaEquipe } from '@/lib/events/avisos';

/** O e-mail do Financeiro: as compras de cada evento (19/11/2026, PR 2 do Financeiro). */

const LANCADO = { pre_lancamento: false, extras: [] as string[], excluidos: [] as string[] };
const evento = {
  id: 'n', title: 'Natal<br>Feliz', unit: 'Grupo ANA Brasil', location: 'Sede', status: 'confirmado',
  start_datetime: '2026-12-08T11:00:00Z', end_datetime: '2026-12-08T20:00:00Z', created_by: 'Gestora DIC', submitted_at: '2026-11-17T13:00:00Z',
  food_items: [
    { item: 'Almoço', cardapio: 'Marmita na quadra', alimentos: [{ nome: 'Marmitex', quantidade: '400', fornecedor: 'ANA' }, { nome: 'Salada', quantidade: '20 kg', fornecedor: 'Doação', quem: 'Hortifruti' }] },
    { item: 'Lanche', alimentos: [{ nome: 'Suco <caixinha>', quantidade: '500', fornecedor: 'ANA' }, { nome: 'Água', quantidade: '100', fornecedor: 'ANA' }, { nome: 'Água', quantidade: '50', fornecedor: 'ANA' }] },
    { item: 'Café', detalhes: 'texto antigo' },
  ],
  transport_external_support: true, transport_passengers: 120, transport_extra_equipment: true, transport_support_vehicle: 'utilitario', transport_vehicle: null,
};
const depois = {
  ...evento, updated_by: 'Gestora DIC', updated_at: '2026-11-20T14:30:00Z',
  food_items: [
    { item: 'Almoço', cardapio: 'Marmita na quadra', alimentos: [{ nome: 'Marmitex', quantidade: '450', fornecedor: 'ANA' }] },
    { item: 'Lanche', alimentos: [{ nome: 'Água', quantidade: '100', fornecedor: 'ANA' }, { nome: 'Água', quantidade: '50', fornecedor: 'ANA' }, { nome: 'Pipoca', quantidade: '60', fornecedor: 'ANA' }] },
  ],
  transport_external_support: false,
};

describe('as compras no e-mail são as mesmas da página', () => {
  it('mesma chave, mesmo nome e mesma quantidade (alimento) que a página do Financeiro', () => {
    for (const e of [evento, depois]) {
      const pagina = itensDoEvento({ ...(e as unknown as EventoDoFinanceiro), itens: [] });
      const email = itensDeCompra(e);
      expect(email.map(i => i.chave)).toEqual(pagina.map(i => i.chave));
      expect(email.map(i => `${i.grupo}|${i.nome}`)).toEqual(pagina.map(i => `${i.grupo}|${i.nome}`));
      expect(email.filter(i => i.tipo === 'alimentacao').map(i => i.quantidade)).toEqual(pagina.filter(i => i.tipo === 'alimentacao').map(i => i.quantidade));
    }
  });
  it('só a comida da ANA e o transporte de fora; formatos estranhos não quebram', () => {
    expect(itensDeCompra(evento).map(i => i.nome)).toEqual(['Marmitex', 'Suco <caixinha>', 'Água', 'Água', 'Ônibus ou van fretados', 'Veículo de apoio']);
    expect(itensDeCompra({ food_items: 'lixo', transport_external_support: false })).toEqual([]);
    expect(itensDeCompra({ food_items: [null, 3, { item: 'x', alimentos: 'y' }] })).toEqual([]);
    expect(itensDeCompra(null)).toEqual([]);
  });
});

describe('o que mudou no pedido', () => {
  it('entrou, saiu e mudou de quantidade', () => {
    const m = mudancaDoPedido(evento, depois);
    expect(m.entraram.map(i => i.nome)).toEqual(['Pipoca']);
    expect(m.sairam.map(i => i.nome)).toEqual(['Suco <caixinha>', 'Ônibus ou van fretados']);
    expect(m.mudaram.map(x => `${x.agora.nome}: ${x.antes.quantidade} → ${x.agora.quantidade}`)).toEqual(['Marmitex: 400 → 450']);
  });
  it('a mesma chave com outra grafia do nome também conta como mudança', () => {
    const grafia = { ...evento, food_items: [{ ...evento.food_items[0], alimentos: [{ nome: 'marmitex!', quantidade: '400', fornecedor: 'ANA' }] }, evento.food_items[1]] };
    expect(pedidoSemMudanca(evento, grafia)).toBe(false);
    expect(corpoDoFinanceiroTexto({ evento: grafia, antes: evento }, 'https://x')).toContain('~ marmitex! (Almoço): Marmitex · 400 → marmitex! · 400');
  });
  it('só o cardápio ou um alimento de doação mudou: sem e-mail', () => {
    const soCardapio = { ...evento, food_items: evento.food_items.map(r => ({ ...r, cardapio: 'outro' })) };
    expect(pedidoSemMudanca(evento, soCardapio)).toBe(true);
    expect(pedidoSemMudanca(evento, depois)).toBe(false);
    expect(pedidoSemMudanca(null, evento)).toBe(false);
  });
});

describe('quem recebe', () => {
  it('a lista do Financeiro no Painel; no pré-lançamento, ninguém', () => {
    const eq = configDaEquipeDaLeitura({ value: { rh: ['rh@ana.org'], voluntariado: [], financeiro: ['FIN@ana.org ', 'lixo'] } });
    expect(destinatariosDoFinanceiro(eq, LANCADO)).toEqual(['fin@ana.org']);
    expect(destinatariosDoFinanceiro(eq, { ...LANCADO, pre_lancamento: true })).toEqual([]);
    expect(configDaEquipeDaLeitura({ value: { rh: [], voluntariado: [] } }).financeiro).toEqual([]);
  });
  it('o app de antes salva só RH e Voluntariado: a lista do Financeiro fica como estava', () => {
    const atual = { rh: ['rh@ana.org'], voluntariado: [], financeiro: ['fin@ana.org'] };
    expect(listasParaGravar({ rh: [], voluntariado: ['v@ana.org'] }, atual)).toEqual({ rh: [], voluntariado: ['v@ana.org'], financeiro: ['fin@ana.org'] });
    expect(listasParaGravar({ rh: [], voluntariado: [], financeiro: [] }, atual).financeiro).toEqual([]);
  });
  it('cancelado: o mesmo e-mail para as listas dos setores que o evento envolvia', () => {
    const eq = { rh: ['rh@ana.org'], voluntariado: ['vol@ana.org'], financeiro: ['fin@ana.org'] };
    expect(listasNoCancelamento({ funcionarios: true, voluntarios: false, compras: true }, eq, LANCADO)).toEqual(['rh@ana.org', 'fin@ana.org']);
    expect(listasNoCancelamento({ funcionarios: true, voluntarios: true, compras: true }, eq, { ...LANCADO, pre_lancamento: true })).toEqual([]);
    expect(listasNoCancelamento({ funcionarios: true, voluntarios: true, compras: true }, null, LANCADO)).toEqual([]);
  });
  it('em cópia: adm@ e financeiro@, sem repetir quem já está no Para; app e função iguais', () => {
    expect([...COPIA_DO_APP]).toEqual(COPIA_DOS_SETORES);
    expect(copiaDosSetores(['financeiro3@anabrasil.org'])).toEqual(['adm@anabrasil.org', 'financeiro@anabrasil.org']);
    expect(copiaDosSetores(['Financeiro@anabrasil.org ', 'rh@anabrasil.org'])).toEqual(['adm@anabrasil.org']);
  });
  it('o tipo novo é reconhecido, corre à parte do aviso do evento e tem rótulo', () => {
    expect(ehAvisoDoFinanceiro('financeiro')).toBe(true);
    expect(ehDaEquipeNaFuncao('financeiro')).toBe(false);
    expect(ehAvisoDaEquipe('financeiro')).toBe(true);
    expect(ROTULO_DO_TIPO.financeiro).toBe('Compras do evento · Financeiro');
  });
});

describe('o e-mail', () => {
  const SITE = 'https://app.anabrasil.org';
  it('confirmado: assunto, prévia, lista agrupada e o link no mês certo', () => {
    const a = { evento, antes: null };
    expect(assuntoDoFinanceiro(a)).toBe('Compras do evento: Natal Feliz · 08/12 · Grupo ANA Brasil');
    expect(previaDoFinanceiro(a)).toMatch(/^6 itens para cotar · /);
    expect(linkDoFinanceiro(a, SITE)).toBe('https://app.anabrasil.org/administracao/financeiro?mes=2026-12');
    const html = corpoDoFinanceiroHtml(a, SITE);
    expect(html).toContain('A ANA COMPRA · 6');
    expect(html).toContain('Suco &lt;caixinha&gt;');
    expect(html).not.toContain('Salada');
    expect(html).not.toContain('<caixinha>');
    expect(corpoDoFinanceiroTexto(a, SITE)).toContain('- Almoço: Marmitex · 400');
  });
  it('pedido alterado: entrou, mudou e saiu, com a lista de agora', () => {
    const a = { evento: depois, antes: evento };
    expect(assuntoDoFinanceiro(a)).toBe('Pedido alterado: Natal Feliz · 08/12 · Grupo ANA Brasil');
    expect(previaDoFinanceiro(a)).toMatch(/^1 entrou, 2 saíram, 1 mudou · agora 5 itens/);
    const html = corpoDoFinanceiroHtml(a, SITE);
    expect(html).toContain('ENTROU · 1');
    expect(html).toContain('SAIU · 2');
    expect(html).toContain('MUDOU · 1');
    expect(html).toContain('O PEDIDO AGORA · 5');
    const texto = corpoDoFinanceiroTexto(a, SITE);
    expect(texto).toContain('~ Marmitex (Almoço): 400 → 450');
    expect(texto).toContain('+ Pipoca · 60 (Lanche)');
    expect(texto).toContain('- Ônibus ou van fretados · 120 passageiros (Transporte de fora)');
  });
  it('tudo saiu do pedido: o e-mail diz que não há compra agora', () => {
    const vazio = { ...evento, food_items: [], transport_external_support: false, transport_extra_equipment: false };
    expect(corpoDoFinanceiroTexto({ evento: vazio, antes: evento }, SITE)).toContain('Nenhuma compra da ANA neste evento agora.');
  });
});
