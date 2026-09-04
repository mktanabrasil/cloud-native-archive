import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const espiao = vi.hoisted(() => ({
  uploads: [] as string[],
  removidos: [] as string[][],
  toasts: { error: vi.fn(), success: vi.fn() },
}));

const URL_BASE = 'https://x.supabase.co/storage/v1/object/public/event-attachments/';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: (caminho: string) => {
          espiao.uploads.push(caminho);
          return Promise.resolve({ data: { path: caminho }, error: null });
        },
        getPublicUrl: (caminho: string) => ({ data: { publicUrl: `${URL_BASE}${caminho}` } }),
        remove: (caminhos: string[]) => {
          espiao.removidos.push(caminhos);
          return Promise.resolve({ data: null, error: null });
        },
      }),
    },
  },
}));
vi.mock('sonner', () => ({ toast: espiao.toasts }));

const { FileUpload } = await import('./FileUpload');

const arquivo = (name: string, size: number, type: string) => {
  const f = new File(['x'], name, { type });
  Object.defineProperty(f, 'size', { value: size });
  return f;
};

const escolher = (files: File[]) => {
  const input = screen.getByLabelText('Escolher arquivos') as HTMLInputElement;
  fireEvent.change(input, { target: { files } });
};

beforeEach(() => {
  espiao.uploads = [];
  espiao.removidos = [];
  espiao.toasts.error.mockClear();
  espiao.toasts.success.mockClear();
  vi.spyOn(crypto, 'randomUUID').mockReturnValue('11111111-2222-3333-4444-555555555555');
});

describe('anexos do evento', () => {
  it('um rótulo só, e diz o que aceita', () => {
    render(<FileUpload mode="multiple" attachments={[]} onChange={vi.fn()} />);

    expect(screen.getAllByText(/anexos/i)).toHaveLength(1);
    expect(screen.getByText(/PDF, imagem, planilha ou documento · até 10 MB/)).toBeInTheDocument();
  });

  it('aceita PDF e guarda nome, tamanho e tipo', async () => {
    const onChange = vi.fn();
    render(<FileUpload mode="multiple" attachments={[]} onChange={onChange} />);

    escolher([arquivo('Ofício Secretaria.pdf', 312 * 1024, 'application/pdf')]);

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(espiao.uploads[0]).toMatch(/^anexos\/\d{4}\/\d{2}\/11111111-2222-3333-4444-555555555555-Oficio-Secretaria\.pdf$/);
    expect(onChange.mock.calls[0][0]).toEqual([
      { url: `${URL_BASE}${espiao.uploads[0]}`, name: 'Ofício Secretaria.pdf', size: 312 * 1024, type: 'application/pdf' },
    ]);
    expect(espiao.toasts.success).toHaveBeenCalledWith('“Ofício Secretaria.pdf” anexado');
  });

  it('recusa acima de 10 MB pelo nome, e sobe o resto', async () => {
    const onChange = vi.fn();
    render(<FileUpload mode="multiple" attachments={[]} onChange={onChange} />);

    escolher([arquivo('video.mp4', 11 * 1024 * 1024, 'video/mp4'), arquivo('foto.jpg', 1000, 'image/jpeg')]);

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(espiao.toasts.error).toHaveBeenCalledWith('Arquivo não enviado', { description: expect.stringMatching(/“video.mp4” tem 11 MB/) });
    expect(espiao.uploads).toHaveLength(1);
    expect(onChange.mock.calls[0][0][0].name).toBe('foto.jpg');
  });

  it('mostra nome e tamanho, não "Anexo 1"', () => {
    render(
      <FileUpload
        mode="multiple"
        attachments={[
          { url: 'u1', name: 'cardapio-cafe.jpg', size: 1.4 * 1024 * 1024, type: 'image/jpeg' },
          `${URL_BASE}2rdksrr22q.png`,
        ]}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText('cardapio-cafe.jpg')).toBeInTheDocument();
    expect(screen.getByText('1,4 MB')).toBeInTheDocument();
    expect(screen.getByText('2rdksrr22q.png')).toBeInTheDocument();
    expect(screen.queryByText(/anexo 1/i)).not.toBeInTheDocument();
  });

  it('remover o que subiu agora apaga do balde; o que já estava, só sai da lista', async () => {
    const onChange = vi.fn();
    const antigo = `${URL_BASE}velho.png`;
    const { rerender } = render(<FileUpload mode="multiple" attachments={[antigo]} onChange={onChange} />);

    escolher([arquivo('novo.pdf', 10, 'application/pdf')]);
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const lista = onChange.mock.calls[0][0];
    rerender(<FileUpload mode="multiple" attachments={lista} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Remover novo.pdf' }));
    await waitFor(() => expect(espiao.removidos).toHaveLength(1));
    expect(espiao.removidos[0][0]).toMatch(/novo\.pdf$/);

    fireEvent.click(screen.getByRole('button', { name: 'Remover velho.png' }));
    expect(espiao.removidos).toHaveLength(1);
    expect(onChange).toHaveBeenLastCalledWith(lista.filter((a: any) => a !== antigo));
  });
});
