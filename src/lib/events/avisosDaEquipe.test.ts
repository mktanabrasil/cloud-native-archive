import { describe, expect, it } from 'vitest';
import {
  configDaEquipeDaLeitura, destinatarios, destinatariosDaEquipe, equipeSemMudanca, mudancaDosFuncionarios, mudancaDosVoluntarios,
} from '../../../supabase/functions/eventos-aviso/fila';
import { assuntoDaEquipe, atencaoDoRh, corpoDaEquipeHtml, corpoDaEquipeTexto, linkDoPainel, quandoDaEquipe } from '../../../supabase/functions/eventos-aviso/equipe';
import { listaDeDestinatarios, sugestoesDaEquipe } from './avisosConfig';
import { ROTULO_DO_TIPO, ehAvisoDaEquipe } from './avisos';

/** Os e-mails da equipe do dia para o RH e o Voluntariado (18/11/2026, PR 5). */

const LANCADO = { pre_lancamento: false, extras: [] as string[], excluidos: [] as string[] };
const evento = {
  id: 'e1', title: 'Karatê<br>no Santana', unit: 'Santana', location: 'Unidade Santana', start_datetime: '2026-11-22T12:00:00Z', end_datetime: '2026-11-22T15:00:00Z',
  created_by: 'Gestora Santana', submitted_at: '2026-11-17T13:00:00Z',
  equipe_funcionarios: ['Rafael Souza', 'Bruna Lima'],
  equipe_voluntarios: [{ nome: 'Lívia Martins', whatsapp: '21987650001' }, { nome: 'Caio <Reis>', whatsapp: '21987650002' }],
};

describe('as listas do Painel', () => {
  it('lidas em minúsculas, só e-mails válidos, sem repetir; sem linha, vazias', () => {
    expect(configDaEquipeDaLeitura({ value: { rh: ['RH@ana.org ', 'rh@ana.org', 'lixo'], voluntariado: ['vol@ana.org'] } })).toMatchObject({ rh: ['rh@ana.org'], voluntariado: ['vol@ana.org'] });
    expect(configDaEquipeDaLeitura(null)).toMatchObject({ rh: [], voluntariado: [] });
  });
  it('cada aviso vai para a lista do seu setor; no pré-lançamento, para ninguém', () => {
    const eq = { rh: ['rh@ana.org'], voluntariado: ['vol@ana.org'], financeiro: [] };
    expect(destinatariosDaEquipe('equipe_rh', eq, LANCADO)).toEqual(['rh@ana.org']);
    expect(destinatariosDaEquipe('equipe_voluntariado', eq, LANCADO)).toEqual(['vol@ana.org']);
    expect(destinatariosDaEquipe('equipe_rh', eq, { ...LANCADO, pre_lancamento: true })).toEqual([]);
  });
  it('quem está nas listas da equipe continua no aviso geral (cancelamento e nova data)', () => {
    expect(destinatarios({ unit: 'DIC', created_by: null }, [], { ...LANCADO, extras: ['rh@ana.org'] })).toContain('rh@ana.org');
  });
});

describe('quem entrou e quem saiu', () => {
  it('funcionários pelo nome, sem olhar acento nem maiúscula', () => {
    expect(mudancaDosFuncionarios(['Rafael Souza', 'Bruna Lima'], ['rafael souza', 'Tiago Rocha'])).toEqual({ atual: ['rafael souza', 'Tiago Rocha'], entraram: ['Tiago Rocha'], sairam: ['Bruna Lima'] });
  });
  it('voluntários pelo nome e pelo WhatsApp (o irmão com o mesmo número é outra pessoa)', () => {
    const m = mudancaDosVoluntarios([{ nome: 'Ana', whatsapp: '21999990001' }], [{ nome: 'Ana', whatsapp: '(21) 99999-0001' }, { nome: 'Pedro', whatsapp: '21999990001' }]);
    expect(m.entraram.map(v => v.nome)).toEqual(['Pedro']);
    expect(m.sairam).toEqual([]);
  });
  it('só a ordem ou a grafia mudou: sem e-mail', () => {
    expect(equipeSemMudanca('equipe_rh', { equipe_funcionarios: ['A', 'B'] }, { equipe_funcionarios: ['b', 'a'] })).toBe(true);
    expect(equipeSemMudanca('equipe_rh', { equipe_funcionarios: ['A'] }, { equipe_funcionarios: ['A', 'C'] })).toBe(false);
    expect(equipeSemMudanca('equipe_rh', null, { equipe_funcionarios: ['A'] })).toBe(false);
  });
});

describe('o e-mail', () => {
  it('o assunto diz o setor e se a lista mudou', () => {
    expect(assuntoDaEquipe({ tipo: 'equipe_rh', evento, antes: null })).toBe('Equipe do dia: Karatê no Santana · 22/11 · Santana');
    expect(assuntoDaEquipe({ tipo: 'equipe_rh', evento, antes: evento })).toBe('Equipe alterada: Karatê no Santana · 22/11 · Santana');
    expect(assuntoDaEquipe({ tipo: 'equipe_voluntariado', evento, antes: null })).toBe('Voluntários do dia: Karatê no Santana · 22/11 · Santana');
  });
  it('o botão abre o painel do setor no mês do evento', () => {
    expect(linkDoPainel({ tipo: 'equipe_rh', evento, antes: null }, 'https://app')).toBe('https://app/administracao/rh?tela=eventos&mes=2026-11');
    expect(linkDoPainel({ tipo: 'equipe_voluntariado', evento, antes: null }, 'https://app')).toBe('https://app/administracao/voluntariado?mes=2026-11');
  });
  it('quando, e o aviso de fim de semana ou vários dias para o RH', () => {
    expect(quandoDaEquipe(evento)).toBe('Domingo, 22/11 · 09:00 às 12:00');
    expect(atencaoDoRh(evento)).toBe('Domingo: fora do expediente');
    expect(atencaoDoRh({ ...evento, start_datetime: '2026-11-24T12:00:00Z', end_datetime: '2026-11-24T15:00:00Z' })).toBeNull();
    expect(atencaoDoRh({ ...evento, end_datetime: '2026-11-23T20:00:00Z' })).toMatch(/vários dias/);
  });
  it('os nomes em destaque, com o HTML escapado; o voluntário não confirmado leva o selo', () => {
    const html = corpoDaEquipeHtml({ tipo: 'equipe_voluntariado', evento, antes: null }, 'https://app', new Set(['21987650001|livia martins']));
    expect(html).toContain('VOLUNTÁRIOS · 2');
    expect(html).toContain('Caio &lt;Reis&gt;');
    expect(html).not.toContain('Caio <Reis>');
    expect(html.match(/a confirmar<\/b>/g)).toHaveLength(1);
    expect(html).toContain('(21) 98765-0001');
  });
  it('equipe alterada mostra quem entrou e quem saiu; o texto puro também', () => {
    const a = { tipo: 'equipe_rh' as const, evento: { ...evento, equipe_funcionarios: ['Rafael Souza', 'Tiago Rocha'] }, antes: evento };
    const html = corpoDaEquipeHtml(a, 'https://app');
    expect(html).toContain('ENTRARAM · 1');
    expect(html).toContain('SAÍRAM · 1');
    expect(html).toContain('FUNCIONÁRIOS ESCALADOS AGORA · 2');
    const texto = corpoDaEquipeTexto(a, 'https://app');
    expect(texto).toContain('+ Tiago Rocha');
    expect(texto).toContain('- Bruna Lima');
    expect(texto.split('\n')[0]).toBe('1 entrou, 1 saiu · agora 2 funcionários · Domingo, 22/11 · 09:00 às 12:00');
  });
  it('lista esvaziada: diz que não há ninguém agora', () => {
    const html = corpoDaEquipeHtml({ tipo: 'equipe_rh', evento: { ...evento, equipe_funcionarios: [] }, antes: evento }, 'https://app');
    expect(html).toContain('Nenhum funcionário escalado agora.');
    expect(html).toContain('SAÍRAM · 2');
  });
});

describe('o Painel', () => {
  const perfis = [
    { email: 'RH@ana.org', name: 'Rosa', unit: 'Administração', is_active: true, permission_level: 'gestor_unidade', bond_type: 'rh' },
    { email: 'vol@ana.org', name: 'Vera', unit: 'Administração', is_active: true, permission_level: 'usuario_padrao', bond_type: 'voluntariado' },
    { email: 'off@ana.org', name: 'Inativa', unit: 'Administração', is_active: false, permission_level: 'gestor_unidade', bond_type: 'rh' },
  ];
  it('sugere quem tem o vínculo, ativo, que ainda não está na lista', () => {
    expect(sugestoesDaEquipe(perfis, { rh: [], voluntariado: [], financeiro: [] }, 'rh')).toEqual([{ email: 'rh@ana.org', nome: 'Rosa' }]);
    expect(sugestoesDaEquipe(perfis, { rh: ['rh@ana.org'], voluntariado: [], financeiro: [] }, 'rh')).toEqual([]);
    expect(sugestoesDaEquipe(perfis, { rh: [], voluntariado: [], financeiro: [] }, 'voluntariado')).toEqual([{ email: 'vol@ana.org', nome: 'Vera' }]);
  });
  it('o avulso que também está numa lista da equipe segue recebendo o geral', () => {
    const linhas = listaDeDestinatarios([], { ...LANCADO, extras: ['rh@ana.org'] });
    expect(linhas.find(l => l.email === 'rh@ana.org')?.estado).toBe('recebe');
  });
  it('os tipos novos têm rótulo e correm à parte', () => {
    expect(ROTULO_DO_TIPO.equipe_rh).toMatch(/RH/);
    expect(ehAvisoDaEquipe('equipe_voluntariado')).toBe(true);
    expect(ehAvisoDaEquipe('confirmado')).toBe(false);
  });
});
