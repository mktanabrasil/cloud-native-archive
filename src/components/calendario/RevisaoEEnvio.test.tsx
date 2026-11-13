import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AnoDoCalendario, ItemDoCalendario } from '@/lib/calendario/regras';

/** O envio ao marketing e a revisão (13/11/2026). */
const api = vi.hoisted(() => ({
  enviarAoMarketing: vi.fn(),
  devolverAsCoordenadoras: vi.fn(),
  aprovarComPdf: vi.fn(),
  trocarCapa: vi.fn(),
  linkDoArquivo: vi.fn(async (caminho: string, baixarComo?: string) => `https://arquivo/${caminho}${baixarComo ? `?baixar=${baixarComo}` : ''}`),
}));
vi.mock('@/lib/calendario/api', () => api);
const gerar = vi.hoisted(() => ({ gerarPdfDoCalendario: vi.fn(async () => ({ blob: new Blob(['%PDF']), paginas: 58, paginasDeTexto: 9, celulasCheias: [] })) }));
vi.mock('@/lib/calendario/pdf/gerar', () => gerar);

import { SituacaoDoPdf, faltasParaEnviar } from './SituacaoDoPdf';
import { RevisaoDoMarketing } from './RevisaoDoMarketing';

const ano = (c: Partial<AnoDoCalendario> = {}): AnoDoCalendario => ({
  ano: 2027, tema: 'Raízes', percursos: [], textos: {}, meses_revisados: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], capa_url: null, status: 'preenchimento',
  observacao: null, enviado_em: null, enviado_por: null, aprovado_em: null, aprovado_por: null, pdf_url: null, atualizado_em: '', atualizado_por: null, ...c,
});

beforeEach(() => { Object.values(api).forEach(f => f.mockClear()); gerar.gerarPdfDoCalendario.mockClear(); });

describe('o envio ao marketing', () => {
  it('diz o que falta antes de enviar', () => {
    expect(faltasParaEnviar({ tema: ' ', meses_revisados: [1, 2] })).toEqual(['o tema do ano', 'marcar 10 meses como revisados']);
    expect(faltasParaEnviar({ tema: 'Raízes', meses_revisados: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] })).toEqual(['marcar 1 mês como revisado']);
    render(<SituacaoDoPdf ano={ano({ tema: '' })} marketing={false} editavel onAno={() => {}} />);
    expect(screen.getByRole('button', { name: /enviar ao marketing/i })).toBeDisabled();
    expect(screen.getByText(/Antes de enviar, falta: o tema do ano/)).toBeInTheDocument();
  });

  it('com tudo pronto, confirma e envia', async () => {
    const onAno = vi.fn();
    api.enviarAoMarketing.mockResolvedValue(ano({ status: 'revisao' }));
    render(<SituacaoDoPdf ano={ano()} marketing={false} editavel onAno={onAno} />);
    fireEvent.click(screen.getByRole('button', { name: /enviar ao marketing/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Enviar' }));
    await waitFor(() => expect(api.enviarAoMarketing).toHaveBeenCalledWith(2027));
    expect(onAno).toHaveBeenCalledWith(expect.objectContaining({ status: 'revisao' }));
  });

  it('em revisão: quem enviou e quando; baixar ainda travado', () => {
    render(<SituacaoDoPdf ano={ano({ status: 'revisao', enviado_por: 'Gestão DIC', enviado_em: '2026-11-14T15:00:00Z' })} marketing={false} editavel={false} onAno={() => {}} />);
    expect(screen.getByText(/Enviado ao marketing por Gestão DIC em 14\/11/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /baixar o pdf/i })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /enviar ao marketing/i })).not.toBeInTheDocument();
  });

  it('aprovado: baixa o PDF guardado, com o nome do calendário', async () => {
    render(<SituacaoDoPdf ano={ano({ status: 'aprovado', aprovado_em: '2026-11-30T15:00:00Z', pdf_url: '2027/final.pdf' })} marketing={false} editavel={false} onAno={() => {}} />);
    expect(screen.getByText(/Aprovado pelo marketing em 30\/11/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /baixar o pdf/i }));
    await waitFor(() => expect(api.linkDoArquivo).toHaveBeenCalledWith('2027/final.pdf', 'Calendário Anual 2027.pdf'));
  });
});

describe('a revisão do marketing', () => {
  const itens: ItemDoCalendario[] = [{ id: 'a', ano: 2027, dia: '2027-03-01', texto: 'Reunião', tipo: 'atividade', unidades: [], destaque: true, oculto: false, fonte: null }];

  it('mostra o que veio preenchido, com quem mexeu; sem foto da capa, não aprova', () => {
    render(<RevisaoDoMarketing ano={ano({ status: 'revisao', enviado_por: 'Gestão DIC', enviado_em: '2026-11-26T19:40:00Z', autoria: { tema: { nome: 'Gestão DIC', em: '2026-11-20T15:00:00Z' } } })} itens={itens} quem="MKT ANA" onAno={() => {}} onPrevia={() => {}} />);
    expect(screen.getByText('Enviado por Gestão DIC em 26/11 às 16:40.')).toBeInTheDocument();
    expect(screen.getByText(/“Raízes” · por Gestão DIC · 20\/11/)).toBeInTheDocument();
    expect(screen.getByText(/12 de 12 revisados · 1 atividade das unidades/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /aprovar e liberar o pdf/i })).toBeDisabled();
    expect(screen.getByText('Para aprovar, escolha antes a foto da capa.')).toBeInTheDocument();
  });

  it('devolver exige a observação', async () => {
    const onAno = vi.fn();
    api.devolverAsCoordenadoras.mockResolvedValue(ano({ status: 'preenchimento', observacao: 'Faltou março' }));
    render(<RevisaoDoMarketing ano={ano({ status: 'revisao' })} itens={[]} quem="MKT ANA" onAno={onAno} onPrevia={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /devolver com observação/i }));
    expect(screen.getByRole('button', { name: 'Devolver' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('O que as coordenadoras precisam ajustar'), { target: { value: 'Faltou março' } });
    fireEvent.click(screen.getByRole('button', { name: 'Devolver' }));
    await waitFor(() => expect(api.devolverAsCoordenadoras).toHaveBeenCalledWith(2027, 'Faltou março'));
    expect(onAno).toHaveBeenCalled();
  });

  it('aprovar gera o PDF final (sem a marca de prévia, com a capa) e guarda', async () => {
    const onAno = vi.fn();
    api.aprovarComPdf.mockResolvedValue(ano({ status: 'aprovado' }));
    const emRevisao = ano({ status: 'revisao', capa_url: '2027/capa.jpg' });
    render(<RevisaoDoMarketing ano={emRevisao} itens={itens} quem="MKT ANA" onAno={onAno} onPrevia={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /aprovar e liberar o pdf/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Aprovar e liberar' }));
    await waitFor(() => expect(api.aprovarComPdf).toHaveBeenCalled());
    expect(gerar.gerarPdfDoCalendario).toHaveBeenCalledWith(emRevisao, itens, { capaUrl: 'https://arquivo/2027/capa.jpg', previa: false });
    expect(api.aprovarComPdf.mock.calls[0][2]).toBe('MKT ANA');
    expect(onAno).toHaveBeenCalledWith(expect.objectContaining({ status: 'aprovado' }));
  });

  it('aprovado: baixa e pode reabrir para edição', async () => {
    api.devolverAsCoordenadoras.mockResolvedValue(ano());
    render(<RevisaoDoMarketing ano={ano({ status: 'aprovado', pdf_url: '2027/final.pdf', aprovado_por: 'MKT ANA', aprovado_em: '2026-11-30T15:00:00Z' })} itens={[]} quem="MKT ANA" onAno={() => {}} onPrevia={() => {}} />);
    expect(screen.getByText('Aprovado por MKT ANA em 30/11.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /baixar o pdf aprovado/i })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: /reabrir para edição/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Reabrir' }));
    await waitFor(() => expect(api.devolverAsCoordenadoras).toHaveBeenCalledWith(2027, ''));
  });
});
