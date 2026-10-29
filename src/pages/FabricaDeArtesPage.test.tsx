import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import FabricaDeArtesPage from './FabricaDeArtesPage';

vi.mock('@/assets/ana-brasil-logo.svg?raw', () => ({ default: '<svg viewBox="0 0 10 10"></svg>' }));

const abrir = () => render(<MemoryRouter><FabricaDeArtesPage /></MemoryRouter>);
const clicar = (nome: RegExp | string) => fireEvent.click(screen.getByRole('button', { name: nome }));

/** O fluxo da gestora, de ponta a ponta, sem banco: só o motor e os moldes. */
describe('Fábrica de Artes', () => {
  it('plastificar "não" basta para continuar; a família sai do motor com a explicação e a prévia', () => {
    abrir();
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled();
    clicar(/^Impressa/); clicar('Não');
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled();
    clicar('Continuar');
    clicar(/Um evento com dia e hora/); clicar('Pessoas idosas');
    fireEvent.change(screen.getByLabelText('Unidade'), { target: { value: 'dic' } });
    clicar('Ver o padrão escolhido');

    expect(screen.getByText('Convite de evento', { selector: 'div' })).toBeInTheDocument();
    expect(screen.getByText(/fica em 1º com 12 pontos/)).toBeInTheDocument();
    const previa = screen.getByRole('img', { name: 'Prévia da arte' });
    expect(previa.querySelector('.arte')).not.toBeNull();
    expect(previa.textContent).toContain('Unidade DIC');
    expect(screen.getByRole('group', { name: 'Formato da prévia' })).toHaveTextContent('A4 em pé');
  });

  it('gera a frase de apoio no tom do público e deixa trocar de padrão', () => {
    abrir();
    clicar(/^Só digital/); clicar('Continuar');
    clicar(/Vários dias ou atividades/); clicar('Famílias e comunidade');
    fireEvent.change(screen.getByLabelText('Unidade'), { target: { value: 'bemquerer' } });
    clicar('Ver o padrão escolhido');
    expect(screen.getByText('Cronograma', { selector: 'div' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/O que você quer dizer/), { target: { value: 'semana da infância com brincadeiras' } });
    clicar(/Gerar frase no padrão/);
    expect((screen.getByLabelText(/^Frase de apoio/) as HTMLTextAreaElement).value).toMatch(/Convidamos as famílias para semana da infância/);

    fireEvent.click(screen.getByText('Trocar padrão'));
    clicar(/Convite infantil/);
    expect(screen.getByText('Convite infantil', { selector: 'div' })).toBeInTheDocument();
  });

  it('o resumo traz a ficha de impressão e o e-mail para o marketing', () => {
    abrir();
    clicar(/^Impressa/); clicar('Sim'); clicar('30'); clicar('Continuar');
    clicar(/Uma frase por placa/); clicar('Crianças');
    fireEvent.change(screen.getByLabelText('Unidade'), { target: { value: 'nilopolis' } });
    clicar('Ver o padrão escolhido');
    expect(screen.getByText('Placa de ambiente', { selector: 'div' })).toBeInTheDocument();
    clicar('Ver resumo e enviar');
    const resumo = screen.getByRole('region', { name: /Resumo do pedido/ });
    expect(within(resumo).getAllByText('A4 deitado').length).toBeGreaterThanOrEqual(1);
    expect(within(resumo).getByText('Sim', { selector: 'dd' })).toBeInTheDocument();
    expect(within(resumo).getByText(/Ajustar à área de impressão/)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /Enviar ao marketing/ }) as HTMLAnchorElement;
    expect(link.href).toMatch(/^mailto:mkt@anabrasil\.org\?subject=/);
    expect(decodeURIComponent(link.href)).toContain('Padrão: Placa de ambiente');
  });
});
