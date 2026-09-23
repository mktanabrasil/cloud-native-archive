import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { Enquete } from '@/lib/enquetes/modelo';

const espiao = vi.hoisted(() => ({
  enquete: null as Enquete | null,
  resultado: { total: 18, por_opcao: { a: 7, b: 11 } as Record<string, number>, votantes: [] as never[], ultimo_voto_em: null as string | null, oculto: false },
  votos: [] as unknown[],
  respostaDoVoto: { ok: true, opcao_id: 'b', trocou: false } as unknown,
  meuVoto: { ok: false } as unknown,
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/enquetes/api', async () => {
  const real = await vi.importActual<typeof import('@/lib/enquetes/api')>('@/lib/enquetes/api');
  return {
    ...real,
    buscarEnquete: async () => espiao.enquete,
    resultado: async () => espiao.resultado,
    votar: async (...args: unknown[]) => { espiao.votos.push(args); return espiao.respostaDoVoto; },
    meuVoto: async () => espiao.meuVoto,
  };
});

const { default: EnquetePublicaPage, textoDoPrazo } = await import('./EnquetePublicaPage');

const daqui = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();

const enquete = (over: Partial<Enquete> = {}): Enquete => ({
  id: 'e1',
  slug: 'qual-folga',
  pergunta: 'Qual folga você prefere?',
  texto: 'Teremos um **feriado no dia 12/10**.',
  opcoes: [
    { id: 'a', titulo: 'Folgar 12/10 e 13/10', subtitulo: 'Segunda e terça', cor: 'azul' },
    { id: 'b', titulo: 'Folgar 15/10 e 16/10', subtitulo: 'Quinta e sexta', cor: 'coral' },
  ],
  dias: [{ data: '2026-10-12', rotulo: 'Feriado', cor: 'azul' }],
  mostrar_resultado: true,
  identificar: true,
  permitir_troca: true,
  encerra_em: daqui(3),
  encerrada_em: null,
  criada_por: 'Marketing',
  created_at: '2026-09-23T12:00:00.000Z',
  deleted_at: null,
  ...over,
});

const montar = () =>
  render(
    <MemoryRouter initialEntries={['/enquete/qual-folga']}>
      <Routes><Route path="/enquete/:slug" element={<EnquetePublicaPage />} /></Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  localStorage.clear();
  espiao.votos = [];
  espiao.enquete = enquete();
  espiao.respostaDoVoto = { ok: true, opcao_id: 'b', trocou: false };
  espiao.meuVoto = { ok: false };
});

describe('a página de voto', () => {
  it('mostra pergunta, texto com negrito, dias e opções sem contagem antes de votar', async () => {
    montar();
    expect(await screen.findByRole('heading', { name: 'Qual folga você prefere?' })).toBeInTheDocument();
    expect(screen.getByText('feriado no dia 12/10').tagName).toBe('B');
    expect(screen.getByTestId('dias-em-destaque')).toHaveTextContent('Feriado');
    expect(screen.getByTestId('opcao-a')).not.toHaveTextContent('%');
    expect(screen.getByText(/toque numa opção para votar/i)).toBeInTheDocument();
  });

  it('tocar numa opção abre a folha; confirmar manda número normalizado e PIN, e mostra o voto com contagem', async () => {
    montar();
    fireEvent.click(await screen.findByTestId('opcao-b'));
    const folha = screen.getByTestId('folha-identidade');
    expect(folha).toHaveTextContent('Folgar 15/10 e 16/10');

    fireEvent.click(screen.getByTestId('confirmar-voto'));
    expect(screen.getByRole('alert')).toHaveTextContent(/diga seu nome/i);

    fireEvent.change(screen.getByLabelText(/seu nome/i), { target: { value: 'Ana Paula' } });
    fireEvent.change(screen.getByLabelText(/seu whatsapp/i), { target: { value: '19 99876 5432' } });
    expect((screen.getByLabelText(/seu whatsapp/i) as HTMLInputElement).value).toBe('(19) 99876-5432');
    fireEvent.change(screen.getByLabelText(/crie um pin/i), { target: { value: '2026' } });
    fireEvent.click(screen.getByTestId('confirmar-voto'));

    await waitFor(() => expect(espiao.votos).toHaveLength(1));
    expect(espiao.votos[0]).toEqual(['qual-folga', 'b', { nome: 'Ana Paula', telefone: '19998765432', pin: '2026' }]);
    expect(await screen.findByTestId('meu-voto')).toHaveTextContent('Ana Paula');
    expect(screen.getByTestId('meu-voto')).toHaveTextContent('(19) •••••-5432');
    expect(screen.getByTestId('opcao-b')).toHaveTextContent('61%');
    expect(screen.queryByTestId('folha-identidade')).not.toBeInTheDocument();
    // O aparelho lembra
    expect(JSON.parse(localStorage.getItem('enquete-identidade:qual-folga')!)).toMatchObject({ telefone: '19998765432', pin: '2026' });
  });

  it('PIN errado: avisa e não troca', async () => {
    localStorage.setItem('enquete-identidade:qual-folga', JSON.stringify({ nome: 'Ana', telefone: '19998765432', pin: '1111' }));
    espiao.meuVoto = { ok: true, opcao_id: 'a', nome: 'Ana' };
    espiao.respostaDoVoto = { ok: false, motivo: 'pin_incorreto' };
    montar();
    expect(await screen.findByTestId('meu-voto')).toHaveTextContent('Folgar 12/10');

    fireEvent.click(screen.getByTestId('opcao-b'));
    await waitFor(() => expect(espiao.votos).toHaveLength(1));
    expect(await screen.findByRole('alert')).toHaveTextContent(/pin não confere/i);
  });

  it('passou o prazo: congelada, sem toque, com o resultado final', async () => {
    espiao.enquete = enquete({ encerra_em: daqui(-1) });
    montar();
    expect(await screen.findByTestId('encerrada')).toHaveTextContent(/encerrada/i);
    expect(screen.getByTestId('encerrada')).toHaveTextContent('Folgar 15/10 e 16/10');
    expect(screen.getByTestId('encerrada')).toHaveTextContent('11 de 18 votos');
    // Sem rádio: as opções são só leitura, com a contagem
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.getByTestId('opcao-b')).toHaveTextContent('61%');
    expect(espiao.votos).toHaveLength(0);
  });

  it('resultado oculto até o fim: depois de votar, sem contagem', async () => {
    espiao.enquete = enquete({ mostrar_resultado: false });
    espiao.resultado = { ...espiao.resultado, oculto: true, por_opcao: {} };
    localStorage.setItem('enquete-identidade:qual-folga', JSON.stringify({ nome: 'Ana', telefone: '19998765432', pin: '1111' }));
    espiao.meuVoto = { ok: true, opcao_id: 'a', nome: 'Ana' };
    montar();
    expect(await screen.findByTestId('meu-voto')).toBeInTheDocument();
    expect(screen.getByTestId('opcao-a')).not.toHaveTextContent('%');
    expect(screen.getByText(/o resultado aparece quando a enquete encerrar/i)).toBeInTheDocument();
    espiao.resultado = { total: 18, por_opcao: { a: 7, b: 11 }, votantes: [], ultimo_voto_em: null, oculto: false };
  });
});

describe('textoDoPrazo', () => {
  it('hoje, amanhã e data', () => {
    const agora = new Date('2026-09-23T15:00:00-03:00');
    expect(textoDoPrazo('2026-09-23T18:00:00-03:00', agora)).toBe('hoje às 18h');
    expect(textoDoPrazo('2026-09-24T18:30:00-03:00', agora)).toBe('amanhã às 18h30');
    expect(textoDoPrazo('2026-10-02T18:00:00-03:00', agora)).toMatch(/sexta-feira, 02\/10 às 18h/);
  });
});
