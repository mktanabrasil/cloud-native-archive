import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const envio = vi.hoisted(() => ({ falhar: new Set<number>() }));
vi.mock('@/lib/journal/enviarFotos', () => ({
  enviarJpegs: async (arquivos: Blob[], aoProgredir?: (a: number, b: number) => void) => {
    aoProgredir?.(arquivos.length, arquivos.length);
    return arquivos.map((a, i) => (envio.falhar.has(i) ? null : `https://fotos/${(a as File).name}`));
  },
}));

const { JournalEsbocoDialog } = await import('./JournalEsbocoDialog');
type DadosDoEsboco = import('./JournalEsbocoDialog').DadosDoEsboco;

const ESBOCO = {
  unidade: { nome: 'CEI Bem Querer Prof. Anísio Spínola' },
  mes: 'Setembro de 2026',
  fundo: 'off_white',
  formas: { elemento: 'elemento_01', cores: { superior_esquerdo: 'coral' } },
  fotos: [{ n: 1 }, { n: 2 }, { n: 3 }],
  paginas: [{ tipo: 'capa', pecas: [
    { kind: 'text', style: 'titulo_capa', span: 6, content: 'Pequenos investigadores da natureza' },
    { kind: 'image', span: 3, foto: 1 },
    { kind: 'image', span: 3, foto: 2 },
  ] }],
};

const arquivo = (caminho: string, conteudo = 'x') => {
  const f = new File([conteudo], caminho.split('/').pop()!, { type: caminho.endsWith('.json') ? 'application/json' : 'image/jpeg' });
  Object.defineProperty(f, 'webkitRelativePath', { value: caminho });
  return f;
};

function abrir(onCriar = vi.fn(async (_dados: DadosDoEsboco): Promise<string | null> => 'j1'), onPronto = vi.fn()) {
  render(<JournalEsbocoDialog aberto onAberto={() => {}} sugerirNome={(_, m) => `Jornal Anísio — ${m}`} onCriar={onCriar} onPronto={onPronto} />);
  return { onCriar, onPronto };
}

const escolher = (arquivos: File[]) => fireEvent.change(screen.getByTestId('pasta-do-esboco'), { target: { files: arquivos } });

describe('Criar a partir de esboço', () => {
  it('confere a pasta e cria o rascunho com cada foto no seu quadro', async () => {
    envio.falhar = new Set();
    const { onCriar, onPronto } = abrir();
    escolher([
      arquivo('2026-10 Anísio/esboco.json', JSON.stringify(ESBOCO)),
      arquivo('2026-10 Anísio/fotos/foto-01.jpg'),
      arquivo('2026-10 Anísio/fotos/foto-02.jpg'),
      arquivo('2026-10 Anísio/fotos/foto-03.jpg'),
      arquivo('2026-10 Anísio/paginas/pagina-1.jpg'),
    ]);
    expect(await screen.findByText('Conferir o esboço')).toBeInTheDocument();
    expect(screen.getByText('CEI Bem Querer Prof. Anísio Spínola')).toBeInTheDocument();
    expect(screen.getByText('Fica de fora a foto 3, como no esboço.')).toBeInTheDocument();
    expect(screen.getByText(/Jornal Anísio — Setembro 2026/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Criar rascunho com 2 fotos' }));
    expect(await screen.findByText('Rascunho pronto')).toBeInTheDocument();

    const dados = onCriar.mock.calls[0][0];
    expect(dados).toMatchObject({ name: 'Jornal Anísio — Setembro 2026', unitId: 'cei-anisio-spinola', referenceMonth: 'Setembro 2026', paper: 'off_white' });
    const urls = dados.pages[0].blocks.flatMap((b) => (b.kind === 'image' ? [b.url] : []));
    expect(urls).toEqual(['https://fotos/foto-01.jpg', 'https://fotos/foto-02.jpg']);
    expect(dados.pages[0].decorations).toEqual([{ element: 'elemento_01', corner: 'superior_esquerdo', color: 'coral' }]);

    fireEvent.click(screen.getByRole('button', { name: 'Abrir no editor' }));
    expect(onPronto).toHaveBeenCalledWith('j1');
  });

  it('foto que falta trava o botão e diz qual é', async () => {
    abrir();
    escolher([arquivo('X/esboco.json', JSON.stringify(ESBOCO)), arquivo('X/fotos/foto-01.jpg')]);
    expect(await screen.findByText(/a foto 2 não está na pasta/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Criar rascunho/ })).toBeDisabled();
  });

  it('pasta sem esboco.json explica o que escolher', async () => {
    abrir();
    escolher([arquivo('Jornal - Esboço/LEIA-ME.md')]);
    expect(await screen.findByRole('alert')).toHaveTextContent('não tem esboco.json');
  });

  it('foto que não subiu vira quadro vazio, e o pronto avisa', async () => {
    envio.falhar = new Set([1]);
    const { onCriar } = abrir();
    escolher([arquivo('A/esboco.json', JSON.stringify(ESBOCO)), arquivo('A/fotos/foto-01.jpg'), arquivo('A/fotos/foto-02.jpg')]);
    fireEvent.click(await screen.findByRole('button', { name: 'Criar rascunho com 2 fotos' }));
    expect(await screen.findByText(/1 foto não subiu/)).toBeInTheDocument();
    await waitFor(() => expect(onCriar).toHaveBeenCalled());
    const urls = onCriar.mock.calls[0][0].pages[0].blocks.flatMap((b) => (b.kind === 'image' ? [b.url] : []));
    expect(urls).toEqual(['https://fotos/foto-01.jpg', '']);
  });
});
