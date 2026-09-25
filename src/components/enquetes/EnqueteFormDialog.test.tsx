import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Enquete } from '@/lib/enquetes/modelo';

const espiao = vi.hoisted(() => ({ atualizadas: [] as unknown[], criadas: [] as unknown[] }));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/lib/enquetes/api', () => ({
  atualizarEnquete: async (id: string, c: unknown) => { espiao.atualizadas.push([id, c]); },
  criarEnquete: async (n: Record<string, unknown>) => { espiao.criadas.push(n); return { ...n, id: 'nova', created_at: '2026-09-25T12:00:00Z', deleted_at: null, encerrada_em: null }; },
}));

const { EnqueteFormDialog, formularioDe } = await import('./EnqueteFormDialog');

const daqui = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();

const enquete: Enquete = {
  id: 'e1',
  slug: 'qual-folga-voce-prefere',
  pergunta: 'Qual folga você prefere?',
  texto: 'Teremos um feriado.',
  opcoes: [
    { id: 'a', titulo: 'Folgar 12/10 e 13/10', subtitulo: 'Segunda e terça', cor: 'azul' },
    { id: 'b', titulo: 'Folgar 15/10 e 16/10', subtitulo: 'Quinta e sexta', cor: 'coral' },
    { id: 'c', titulo: 'Não folgar', subtitulo: '', cor: 'amarelo' },
  ],
  dias: [],
  mostrar_resultado: true,
  identificar: true,
  permitir_troca: true,
  encerra_em: daqui(-2),
  encerrada_em: null,
  criada_por: 'Marketing',
  created_at: '2026-09-23T12:00:00Z',
  deleted_at: null,
};

beforeEach(() => { espiao.atualizadas = []; espiao.criadas = []; });

describe('editar', () => {
  it('abre com os dados, trava remover opção com voto, salva sem mudar o link, mesmo com prazo vencido intacto', async () => {
    const salva = vi.fn();
    render(<EnqueteFormDialog open onOpenChange={() => {}} criadaPor="Leo" onSalva={salva} modo="editar" enquete={enquete} votosPorOpcao={{ a: 3, b: 0 }} />);

    expect(screen.getByRole('heading', { name: 'Editar enquete' })).toBeInTheDocument();
    expect((screen.getByLabelText('Pergunta *') as HTMLInputElement).value).toBe('Qual folga você prefere?');
    expect(screen.getByRole('button', { name: 'Remover opção 1' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remover opção 2' })).not.toBeDisabled();

    fireEvent.change(screen.getByLabelText('Título da opção 1'), { target: { value: 'Segunda e terça, 12 e 13/10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() => expect(espiao.atualizadas).toHaveLength(1));
    const [id, c] = espiao.atualizadas[0] as [string, { opcoes: Array<{ id: string; titulo: string }>; encerra_em: string }];
    expect(id).toBe('e1');
    expect(c.opcoes[0]).toMatchObject({ id: 'a', titulo: 'Segunda e terça, 12 e 13/10' });
    expect(espiao.criadas).toHaveLength(0);
    expect(salva).toHaveBeenCalledWith(expect.objectContaining({ slug: 'qual-folga-voce-prefere' }));
  });
});

describe('duplicar', () => {
  it('mesmo conteúdo, ids novos nas opções, prazo novo, cria outra enquete', async () => {
    const f = formularioDe(enquete, 'duplicar');
    expect(f.opcoes.map(o => o.titulo)).toEqual(enquete.opcoes.map(o => o.titulo));
    expect(f.opcoes.map(o => o.id)).not.toContain('a');
    expect(new Date(f.encerra_em!).getTime()).toBeGreaterThan(Date.now());

    render(<EnqueteFormDialog open onOpenChange={() => {}} criadaPor="Leo" onSalva={() => {}} modo="duplicar" enquete={enquete} />);
    expect(screen.getByRole('heading', { name: 'Duplicar enquete' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Criar enquete' }));
    await waitFor(() => expect(espiao.criadas).toHaveLength(1));
    expect(espiao.criadas[0]).toMatchObject({ slug: 'qual-folga-voce-prefere', pergunta: 'Qual folga você prefere?', criada_por: 'Leo' });
    expect(espiao.atualizadas).toHaveLength(0);
  });
});

describe('negrito', () => {
  it('põe asteriscos em volta da seleção', () => {
    render(<EnqueteFormDialog open onOpenChange={() => {}} criadaPor="Leo" onSalva={() => {}} />);
    const texto = screen.getByLabelText(/texto de contexto/i) as HTMLTextAreaElement;
    fireEvent.change(texto, { target: { value: 'feriado no dia 12' } });
    texto.setSelectionRange(0, 7);
    fireEvent.click(screen.getByTestId('botao-negrito'));
    expect(texto.value).toBe('**feriado** no dia 12');
  });
});
