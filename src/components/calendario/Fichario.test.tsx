import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { AlteracaoDoCalendario, AnoDoCalendario, ItemDoCalendario } from '@/lib/calendario/regras';
import { atividadeEhMinha } from '@/lib/calendario/regras';

/** O fichário digital (19/11/2026): depois de aprovado e impresso, só o mês a mês segue aberto. */
const api = vi.hoisted(() => ({ acrescentarItem: vi.fn(), apagarItem: vi.fn(), editarItem: vi.fn(), salvarAno: vi.fn(), enviarAoMarketing: vi.fn(), linkDoArquivo: vi.fn(async () => 'https://x') }));
vi.mock('@/lib/calendario/api', () => api);

import { MesAMes } from './MesAMes';
import { InicioDoCalendario } from './InicioDoCalendario';

const ano: AnoDoCalendario = {
  ano: 2027, tema: 'Cultivar para florescer', percursos: [{ mes: 3, tema: 'Pequenas atitudes', sugestoes: '' }], textos: {}, meses_revisados: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  capa_url: 'c.jpg', status: 'aprovado', observacao: null, enviado_em: null, enviado_por: null, aprovado_em: '2026-11-30T15:00:00Z', aprovado_por: 'MKT',
  pdf_url: '2027/a.pdf', pdf_impresso_url: '2027/a.pdf', impresso_em: '2026-11-30T15:00:00Z', atualizado_em: '', atualizado_por: null,
};
const it_ = (o: Partial<ItemDoCalendario>): ItemDoCalendario => ({ id: Math.random().toString(36), ano: 2027, dia: '2027-03-01', texto: 'X', tipo: 'atividade', unidades: [], destaque: true, oculto: false, fonte: null, criado_em: '2026-11-20T10:00:00Z', ...o });
const itens = [
  it_({ id: 'dic', texto: 'Reunião DIC', unidades: ['DIC'], criado_por: 'mkt@x' }),
  it_({ id: 'nil', texto: 'Passeio Nil', unidades: ['Nilópolis'], criado_por: 'nil@x', criado_em: '2027-03-02T10:00:00Z' }),
  it_({ id: 'todas', texto: 'Acampamento', unidades: [], criado_por: 'nil@x' }),
];
const alteracoes: AlteracaoDoCalendario[] = [
  { id: 'a1', ano: 2027, mes: 3, dia: '2027-03-01', acao: 'entrou', tipo: 'atividade', texto: 'Passeio Nil', unidades: ['Nilópolis'], item_id: 'nil', quem: 'Gestão Nilópolis', em: '2027-03-02T10:00:00Z' },
  { id: 'a2', ano: 2027, mes: 6, dia: '2027-06-18', acao: 'saiu', tipo: 'atividade', texto: 'Festa junina', unidades: [], item_id: null, quem: 'Gestão DIC', em: '2027-03-03T10:00:00Z' },
];
const podeApagar = (i: ItemDoCalendario) => atividadeEhMinha(i, { email: 'dic@x', unidade: 'DIC' });

describe('o mês a mês no fichário', () => {
  const abrir = () => render(<MesAMes ano={ano} itens={itens} editavel editavelDoMes={false} fichario alteracoes={alteracoes} podeApagar={podeApagar} mes={3} onMes={() => {}} onAno={() => {}} onItens={() => {}} />);
  it('o tema do mês fica fechado e o "revisado" some; acrescentar continua', () => {
    abrir();
    expect(screen.getAllByTestId('tema-fechado')[0]).toHaveTextContent('Pequenas atitudes');
    expect(screen.queryByLabelText(/tema do mês/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('mes-revisado')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^acrescentar$/i }).length).toBeGreaterThan(0);
  });
  it('mostra o que mudou no mês e marca o que entrou depois da impressão', () => {
    abrir();
    expect(screen.getByTestId('mudancas-do-mes')).toHaveTextContent('1 mudança desde a impressão');
    expect(screen.getAllByTestId('lista-de-mudancas')[0]).toHaveTextContent('01/03 · Passeio Nil · Nilópolis');
    const grade = screen.getByTestId('grade-do-mes');
    expect(within(grade).getByText('Passeio Nil').closest('[data-nova]')).not.toBeNull();
    expect(within(grade).getByText('Reunião DIC').closest('[data-nova]')).toBeNull();
  });
  it('a Gestão DIC apaga só as suas: a só da DIC sim; a de Nilópolis e a de todas criada por outra, não', () => {
    abrir();
    const painel = screen.getAllByTestId('painel-do-dia')[0];
    expect(within(painel).getByRole('button', { name: 'Apagar Reunião DIC' })).toBeInTheDocument();
    expect(within(painel).queryByRole('button', { name: 'Apagar Passeio Nil' })).not.toBeInTheDocument();
    expect(within(painel).queryByRole('button', { name: 'Apagar Acampamento' })).not.toBeInTheDocument();
  });
});

describe('o início no fichário', () => {
  it('quatro passos, os meses que mudaram e as partes fechadas', () => {
    const abrir = vi.fn();
    render(<InicioDoCalendario ano={ano} editavel={false} marketing={false} alteracoes={alteracoes} onAno={() => {}} abrir={abrir} />);
    expect(screen.getByText('Fichário digital')).toBeInTheDocument();
    const card = screen.getByTestId('mes-a-mes-fichario');
    expect(card).toHaveTextContent('2 meses mudaram desde a impressão');
    expect(within(card).getByRole('button', { name: /Mar\s*1 mudança/ })).toBeInTheDocument();
    expect(screen.getAllByTestId('parte-fechada')).toHaveLength(3);
    fireEvent.click(within(card).getByRole('button', { name: /abrir o mês a mês/i }));
    expect(abrir).toHaveBeenCalledWith('mes', 3);
  });
});
