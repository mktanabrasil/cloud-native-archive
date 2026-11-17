import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { Semanario } from '@/lib/semanario/regras';

/**
 * /educacao/semanario (17/11/2026): a professora preenche o dela; a
 * orientadora e o marketing só leem; mais ninguém entra. O banco é simulado.
 */
const estado = vi.hoisted(() => ({
  auth: { isAuthenticated: true, loading: false, user: { id: 'prof-1', user_metadata: {} } as unknown },
  papel: { isMarketing: false, isProfessora: true, isOrientadora: false, temSemanario: true, unit: 'Anísio', loading: false },
  linhas: [] as Semanario[],
  salvos: [] as { id: string; campos: Record<string, unknown> }[],
  enviados: [] as string[],
  cheios: [] as string[],
  devolutivas: [] as string[],
  larga: false,
  avisos: [] as string[],
  aviso: { enviado: true } as { enviado: boolean; motivo?: string } | 'erro',
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => estado.auth }));
vi.mock('@/hooks/useUserRole', () => ({ useUserRole: () => estado.papel }));
vi.mock('@/components/AppLayout', () => ({ default: ({ children }: { children: React.ReactNode }) => <div data-testid="app">{children}</div> }));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn() }) }));
// O PDF de verdade precisa das fontes; aqui só a conta do que não coube.
vi.mock('@/lib/semanario/pdf/gerar', () => ({
  gerarPdfDoSemanario: vi.fn(async () => ({ blob: new Blob(['%PDF']), cheios: estado.cheios, tamanho: 13.11 })),
  nomeDoArquivo: () => 'Semanário.pdf',
}));
vi.mock('@/hooks/useTelaLarga', () => ({ useTelaLarga: () => estado.larga }));
vi.mock('pdfjs-dist', () => ({ GlobalWorkerOptions: {}, getDocument: () => ({ promise: new Promise(() => {}), destroy: async () => {} }) }));
vi.mock('@/lib/semanario/api', () => ({
  lerMeus: async () => estado.linhas,
  lerDaSemana: async () => estado.linhas,
  lerUm: async (id: string) => estado.linhas.find(l => l.id === id) ?? null,
  criar: vi.fn(async (semana: string) => { const l = linha({ id: 'nova', semana }); estado.linhas.push(l); return l; }),
  salvar: vi.fn(async (id: string, campos: Record<string, unknown>) => {
    estado.salvos.push({ id, campos });
    const l = estado.linhas.find(x => x.id === id)!;
    Object.assign(l, campos, { atualizado_em: '2026-11-17T13:42:00Z' });
    return { ...l };
  }),
  enviar: vi.fn(async (id: string) => {
    estado.enviados.push(id);
    const l = estado.linhas.find(x => x.id === id)!;
    Object.assign(l, { status: 'enviado', enviado_em: '2026-11-17T19:20:00Z' });
    return { ...l };
  }),
  desfazerEnvio: vi.fn(async (id: string) => { const l = estado.linhas.find(x => x.id === id)!; l.status = 'preenchimento'; return { ...l }; }),
  apagar: vi.fn(async () => {}),
  avisarPorEmail: vi.fn(async (id: string, tipo: string) => {
    estado.avisos.push(`${tipo}:${id}`);
    if (estado.aviso === 'erro') throw new Error('Edge Function returned a non-2xx status code');
    return estado.aviso;
  }),
  darDevolutiva: vi.fn(async (id: string, texto: string) => {
    estado.devolutivas.push(texto);
    const l = estado.linhas.find(x => x.id === id)!;
    const t = texto.trim() || null;
    Object.assign(l, { devolutiva: t, status: t ? 'com_devolutiva' : 'enviado', devolutiva_por: t ? 'Orientação' : null, devolutiva_em: t ? '2026-11-19T13:05:00Z' : null });
    return { ...l };
  }),
}));

const dia = { projeto: 'Identidade', proposta: 'Roda', objetivo: 'Conversar', desenvolvimento: 'Em roda, com espelho' };
function linha(campos: Partial<Semanario> = {}): Semanario {
  return {
    id: 's1', professora_id: 'prof-1', professora_nome: 'Professora Teste', unidade: 'Anísio', semana: '2026-11-23',
    agrupamento: 'AG I B', dias: {}, formas_registro: '', materiais: '', avaliacao: '', status: 'preenchimento',
    enviado_em: null, devolutiva: null, devolutiva_por: null, devolutiva_por_id: null, devolutiva_em: null,
    criado_em: '2026-11-17T10:00:00Z', atualizado_em: '2026-11-17T10:00:00Z', ...campos,
  };
}

const { default: SemanarioPage } = await import('./SemanarioPage');
const Onde = () => { const l = useLocation(); return <p data-testid="onde">{l.pathname}</p>; };
const abrir = (url = '/educacao/semanario') => render(
  <MemoryRouter initialEntries={[url]}>
    <Routes>
      <Route path="/educacao/semanario" element={<SemanarioPage />} />
      <Route path="/educacao/semanario/:id" element={<SemanarioPage />} />
      <Route path="*" element={<Onde />} />
    </Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-17T12:00:00'));
  estado.auth = { isAuthenticated: true, loading: false, user: { id: 'prof-1', user_metadata: {} } };
  estado.papel = { isMarketing: false, isProfessora: true, isOrientadora: false, temSemanario: true, unit: 'Anísio', loading: false };
  estado.linhas = [];
  estado.salvos = [];
  estado.enviados = [];
  estado.cheios = [];
  estado.devolutivas = [];
  estado.larga = false;
  estado.avisos = [];
  estado.aviso = { enviado: true };
});
afterEach(() => { vi.useRealTimers(); });
/** O relógio inteiro falso (o do beforeEach só finge a data), para o salvamento automático. */
function relogioFalso() {
  vi.useRealTimers();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-17T12:00:00'));
}

describe('quem entra', () => {
  it('sem sessão: o login, que volta para cá', () => {
    estado.auth = { isAuthenticated: false, loading: false, user: null };
    abrir();
    expect(screen.getByTestId('onde')).toHaveTextContent('/login');
  });

  it('quem não é da Educação nem do marketing volta para o início', () => {
    estado.papel = { ...estado.papel, isProfessora: false, temSemanario: false };
    abrir();
    expect(screen.getByTestId('onde')).toHaveTextContent(/^\/$/);
  });
});

describe('a professora', () => {
  it('sem nenhum semanário: a próxima semana e o botão de começar', async () => {
    abrir();
    expect(await screen.findByText('23 a 27 de novembro')).toBeInTheDocument();
    expect(screen.getByText(/quarta, 18\/11/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Começar/ }));
    expect(await screen.findByText('Semana de 23 a 27 de novembro')).toBeInTheDocument();
  });

  it('a semana em andamento com os dias feitos, e as anteriores em lista', async () => {
    estado.linhas = [linha({ dias: { seg: dia, ter: dia } }), linha({ id: 's0', semana: '2026-11-09', status: 'com_devolutiva', devolutiva: 'Muito bom', devolutiva_em: '2026-11-05T13:05:00Z', devolutiva_por: 'Orientação' })];
    abrir();
    expect(await screen.findByText(/2 de 5 dias preenchidos/)).toBeInTheDocument();
    expect(screen.getByText('Semanas anteriores')).toBeInTheDocument();
    expect(screen.getByText('9 a 13 de novembro')).toBeInTheDocument();
    expect(screen.getByText('Muito bom')).toBeInTheDocument();
  });

  it('o que ela escreve salva sozinho', async () => {
    estado.linhas = [linha()];
    abrir('/educacao/semanario/s1');
    const projeto = await screen.findByLabelText('PROJETO');
    relogioFalso();
    fireEvent.change(projeto, { target: { value: 'Natureza no CEI' } });
    expect(screen.getByRole('status')).toHaveTextContent('Salvando');
    await act(async () => { vi.advanceTimersByTime(1000); });
    vi.useRealTimers();
    await waitFor(() => expect(estado.salvos.at(-1)?.campos).toMatchObject({ dias: { seg: { projeto: 'Natureza no CEI' } } }));
  });

  it('não envia com dias faltando: diz o que falta', async () => {
    estado.linhas = [linha({ dias: { seg: dia } })];
    abrir('/educacao/semanario/s1');
    fireEvent.click(await screen.findByRole('button', { name: /Enviar à orientadora/ }));
    expect(await screen.findByText(/3ª FEIRA, 4ª FEIRA, 5ª FEIRA, 6ª FEIRA, Formas de registro, Materiais/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Enviar$/ })).not.toBeInTheDocument();
  });

  it('completo, envia; depois só a avaliação fica aberta', async () => {
    estado.linhas = [linha({ dias: { seg: dia, ter: dia, qua: dia, qui: dia, sex: dia }, formas_registro: 'Fotos', materiais: 'Papel' })];
    abrir('/educacao/semanario/s1');
    fireEvent.click(await screen.findByRole('button', { name: /Enviar à orientadora/ }));
    fireEvent.click(await screen.findByRole('button', { name: /^Enviar$/ }));
    await waitFor(() => expect(estado.enviados).toEqual(['s1']));
    expect(await screen.findByRole('button', { name: /Desfazer o envio/ })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Agrupamento' })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'AVALIAÇÃO DAS PROPOSTAS' })).toBeInTheDocument();
  });

  it('enviado em outra aba: o planejamento volta ao que está no banco, com aviso', async () => {
    const api = await import('@/lib/semanario/api');
    const { toast } = await import('sonner');
    estado.linhas = [linha({ dias: { seg: dia } })];
    vi.mocked(api.salvar).mockImplementationOnce(async (id: string) => {
      const l = estado.linhas.find(x => x.id === id)!;
      Object.assign(l, { status: 'enviado' }); // o banco descarta os campos travados
      return { ...l };
    });
    abrir('/educacao/semanario/s1');
    fireEvent.click(await screen.findByRole('button', { name: /2ª FEIRA/ }));
    const projeto = await screen.findByLabelText('PROJETO');
    relogioFalso();
    fireEvent.change(projeto, { target: { value: 'Texto que não entrou' } });
    await act(async () => { vi.advanceTimersByTime(1000); });
    vi.useRealTimers();
    await waitFor(() => expect(toast.info).toHaveBeenCalledWith('Este semanário já tinha sido enviado', expect.anything()));
    expect(screen.queryByText('Texto que não entrou')).not.toBeInTheDocument();
    expect(screen.getByText('Identidade')).toBeInTheDocument();
  });

  it('o envio espera a gravação que está no ar', async () => {
    const api = await import('@/lib/semanario/api');
    estado.linhas = [linha({ dias: { seg: dia, ter: dia, qua: dia, qui: dia, sex: dia }, formas_registro: 'Fotos', materiais: 'Papel' })];
    let soltar: () => void = () => {};
    vi.mocked(api.salvar).mockImplementationOnce((id: string, campos: Record<string, unknown>) => new Promise(r => {
      soltar = () => { const l = estado.linhas.find(x => x.id === id)!; Object.assign(l, campos); estado.salvos.push({ id, campos }); r({ ...l }); };
    }));
    abrir('/educacao/semanario/s1');
    const agrupamento = await screen.findByLabelText('Agrupamento');
    relogioFalso();
    fireEvent.change(agrupamento, { target: { value: 'AG I C' } });
    await act(async () => { vi.advanceTimersByTime(1000); });
    vi.useRealTimers();
    fireEvent.click(screen.getByRole('button', { name: /Enviar à orientadora/ }));
    fireEvent.click(await screen.findByRole('button', { name: /^Enviar$/ }));
    await new Promise(r => setTimeout(r, 50));
    expect(estado.enviados).toEqual([]);
    await act(async () => { soltar(); });
    await waitFor(() => expect(estado.enviados).toEqual(['s1']));
    expect(estado.salvos.at(-1)?.campos).toMatchObject({ agrupamento: 'AG I C' });
  });

  it('completo, mas um dia não cabe na folha: diz qual e não envia', async () => {
    estado.linhas = [linha({ dias: { seg: dia, ter: dia, qua: dia, qui: dia, sex: dia }, formas_registro: 'Fotos', materiais: 'Papel' })];
    estado.cheios = ['3ª FEIRA'];
    abrir('/educacao/semanario/s1');
    fireEvent.click(await screen.findByRole('button', { name: /Enviar à orientadora/ }));
    expect(await screen.findByText(/Não cabe na folha:/)).toHaveTextContent('3ª FEIRA');
    expect(screen.queryByRole('button', { name: /^Enviar$/ })).not.toBeInTheDocument();
  });

  it('escreveu demais enquanto conferia: o envio confere de novo e não sai', async () => {
    estado.linhas = [linha({ dias: { seg: dia, ter: dia, qua: dia, qui: dia, sex: dia }, formas_registro: 'Fotos', materiais: 'Papel' })];
    abrir('/educacao/semanario/s1');
    fireEvent.click(await screen.findByRole('button', { name: /Enviar à orientadora/ }));
    const enviarBotao = await screen.findByRole('button', { name: /^Enviar$/ });
    estado.cheios = ['4ª FEIRA'];
    fireEvent.click(enviarBotao);
    expect(await screen.findByText(/Não cabe na folha:/)).toHaveTextContent('4ª FEIRA');
    expect(estado.enviados).toEqual([]);
  });

  it('a prévia mostra as duas páginas e o botão de baixar', async () => {
    estado.linhas = [linha()];
    abrir('/educacao/semanario/s1');
    fireEvent.click(await screen.findByRole('button', { name: /Ver a prévia/ }));
    expect(await screen.findByText('Prévia do semanário · 2 páginas')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Baixar PDF/ })).toBeInTheDocument();
  });

  it('com devolutiva: ela aparece no topo e o envio não se desfaz', async () => {
    estado.linhas = [linha({ status: 'com_devolutiva', devolutiva: 'Pense numa proposta ao ar livre.', devolutiva_por: 'Orientação', devolutiva_em: '2026-11-19T13:05:00Z' })];
    abrir('/educacao/semanario/s1');
    expect(await screen.findByText('Pense numa proposta ao ar livre.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Desfazer o envio/ })).not.toBeInTheDocument();
  });
});

describe('quem só lê', () => {
  it('a orientadora vê os do CEI dela e abre um: só a devolutiva se escreve', async () => {
    estado.papel = { ...estado.papel, isProfessora: false, isOrientadora: true };
    estado.auth = { ...estado.auth, user: { id: 'ori-1', user_metadata: {} } };
    estado.linhas = [linha({ status: 'enviado', enviado_em: '2026-11-17T19:20:00Z', dias: { seg: dia } })];
    abrir();
    expect(await screen.findByText('Semanários · Anísio')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Professora Teste'));
    expect(await screen.findByText('Semana de 23 a 27 de novembro')).toBeInTheDocument();
    // O único campo é o da devolutiva: o planejamento é só para ler.
    expect(screen.getAllByRole('textbox')).toEqual([screen.getByLabelText('Devolutiva')]);
    expect(screen.queryByRole('button', { name: /Enviar à orientadora/ })).not.toBeInTheDocument();
  });

  it('o marketing vê as unidades', async () => {
    estado.papel = { ...estado.papel, isProfessora: false, isMarketing: true };
    estado.auth = { ...estado.auth, user: { id: 'mkt-1', user_metadata: {} } };
    estado.linhas = [linha()];
    abrir();
    expect(await screen.findByText('Semanários das unidades')).toBeInTheDocument();
    expect(screen.getByText(/Anísio · AG I B/)).toBeInTheDocument();
  });
});

describe('a devolutiva da orientadora', () => {
  const orientadora = (unit = 'Anísio') => {
    estado.papel = { ...estado.papel, isProfessora: false, isOrientadora: true, unit };
    estado.auth = { ...estado.auth, user: { id: 'ori-1', user_metadata: {} } };
  };

  it('no semanário enviado do CEI dela: escreve, envia e o botão vira "Atualizar"', async () => {
    orientadora();
    estado.linhas = [linha({ status: 'enviado', enviado_em: '2026-11-17T19:20:00Z' })];
    abrir('/educacao/semanario/s1');
    const campo = await screen.findByLabelText('Devolutiva');
    expect(screen.getByRole('button', { name: /Enviar devolutiva/ })).toBeDisabled();
    fireEvent.change(campo, { target: { value: 'Muito bom o projeto Identidade!' } });
    fireEvent.click(screen.getByRole('button', { name: /Enviar devolutiva/ }));
    await waitFor(() => expect(estado.devolutivas).toEqual(['Muito bom o projeto Identidade!']));
    expect(await screen.findByRole('button', { name: /Atualizar devolutiva/ })).toBeDisabled();
    expect(screen.getByText('Com devolutiva')).toBeInTheDocument();
  });

  it('apagar a devolutiva pede confirmação e volta a aguardar', async () => {
    orientadora();
    estado.linhas = [linha({ status: 'com_devolutiva', devolutiva: 'Boa semana.', devolutiva_por: 'Orientação', devolutiva_em: '2026-11-19T13:05:00Z' })];
    abrir('/educacao/semanario/s1');
    fireEvent.click(await screen.findByRole('button', { name: /Apagar a devolutiva/ }));
    fireEvent.click(await screen.findByRole('button', { name: /^Apagar$/ }));
    await waitFor(() => expect(estado.devolutivas).toEqual(['']));
    expect(await screen.findByText('Aguardando devolutiva')).toBeInTheDocument();
  });

  it('ainda em preenchimento: a devolutiva espera o envio', async () => {
    orientadora();
    estado.linhas = [linha()];
    abrir('/educacao/semanario/s1');
    expect(await screen.findByText(/A devolutiva abre quando a professora enviar/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Devolutiva')).not.toBeInTheDocument();
  });

  it('orientadora de outro CEI e o marketing não escrevem devolutiva', async () => {
    orientadora('Calmon');
    estado.linhas = [linha({ status: 'enviado' })];
    const { unmount } = abrir('/educacao/semanario/s1');
    expect(await screen.findByText('Semana de 23 a 27 de novembro')).toBeInTheDocument();
    expect(screen.queryByLabelText('Devolutiva')).not.toBeInTheDocument();
    unmount();
    estado.papel = { ...estado.papel, isOrientadora: false, isMarketing: true, unit: 'Administração' };
    abrir('/educacao/semanario/s1');
    expect(await screen.findByText('Semana de 23 a 27 de novembro')).toBeInTheDocument();
    expect(screen.queryByLabelText('Devolutiva')).not.toBeInTheDocument();
  });

  it('no computador: os que aguardam vêm primeiro e o escolhido abre ao lado, com a devolutiva', async () => {
    orientadora();
    estado.larga = true;
    estado.linhas = [
      linha({ id: 'a', professora_nome: 'Carla Dias', status: 'com_devolutiva', devolutiva: 'Ok.' }),
      linha({ id: 'b', professora_nome: 'Paula Lima', status: 'enviado', enviado_em: '2026-11-16T15:00:00Z' }),
      linha({ id: 'c', professora_nome: 'Juliana Rocha' }),
    ];
    abrir();
    expect(await screen.findByText('1 semanário aguardando devolutiva')).toBeInTheDocument();
    const nomes = screen.getAllByRole('listitem').map(li => li.querySelector('b')?.textContent);
    expect(nomes).toEqual(['Paula Lima', 'Juliana Rocha', 'Carla Dias']);
    expect(await screen.findByRole('heading', { name: 'Paula Lima' })).toBeInTheDocument();
    expect(screen.getByLabelText('Devolutiva')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Carla Dias/ }));
    expect(await screen.findByRole('heading', { name: 'Carla Dias' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Atualizar devolutiva/ })).toBeInTheDocument();
  });

  it('salvar sem ?ver= não pula para outra professora', async () => {
    orientadora();
    estado.larga = true;
    estado.linhas = [
      linha({ id: 'b', professora_nome: 'Paula Lima', status: 'enviado', enviado_em: '2026-11-16T15:00:00Z' }),
      linha({ id: 'c', professora_nome: 'Juliana Rocha', status: 'enviado', enviado_em: '2026-11-17T15:00:00Z' }),
    ];
    abrir();
    expect(await screen.findByRole('heading', { name: 'Paula Lima' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Devolutiva'), { target: { value: 'Boa semana.' } });
    fireEvent.click(screen.getByRole('button', { name: /Enviar devolutiva/ }));
    await waitFor(() => expect(estado.devolutivas).toEqual(['Boa semana.']));
    expect(await screen.findByRole('button', { name: /Atualizar devolutiva/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Paula Lima' })).toBeInTheDocument();
  });

  it('o rascunho não some ao trocar de professora na lista', async () => {
    orientadora();
    estado.larga = true;
    estado.linhas = [
      linha({ id: 'r1', professora_nome: 'Paula Lima', status: 'enviado', enviado_em: '2026-11-16T15:00:00Z' }),
      linha({ id: 'r2', professora_nome: 'Juliana Rocha', status: 'enviado', enviado_em: '2026-11-17T15:00:00Z' }),
    ];
    abrir();
    fireEvent.change(await screen.findByLabelText('Devolutiva'), { target: { value: 'Rascunho para a Paula' } });
    fireEvent.click(screen.getByRole('button', { name: /Juliana Rocha/ }));
    expect(await screen.findByRole('heading', { name: 'Juliana Rocha' })).toBeInTheDocument();
    expect(screen.getByLabelText('Devolutiva')).toHaveValue('');
    fireEvent.click(screen.getByRole('button', { name: /Paula Lima/ }));
    expect(await screen.findByRole('heading', { name: 'Paula Lima' })).toBeInTheDocument();
    expect(screen.getByLabelText('Devolutiva')).toHaveValue('Rascunho para a Paula');
  });

  it('a professora desfez o envio enquanto ela escrevia: avisa e guarda o texto', async () => {
    const api = await import('@/lib/semanario/api');
    const { toast } = await import('sonner');
    orientadora();
    estado.linhas = [linha({ id: 'd1', status: 'enviado', enviado_em: '2026-11-17T19:20:00Z' })];
    vi.mocked(api.darDevolutiva).mockImplementationOnce(async (id: string) => {
      estado.linhas.find(x => x.id === id)!.status = 'preenchimento';
      throw new Error('A devolutiva vem depois do envio.');
    });
    abrir('/educacao/semanario/d1');
    fireEvent.change(await screen.findByLabelText('Devolutiva'), { target: { value: 'Texto guardado' } });
    fireEvent.click(screen.getByRole('button', { name: /Enviar devolutiva/ }));
    await waitFor(() => expect(toast.info).toHaveBeenCalledWith('A professora desfez o envio', expect.anything()));
    expect(await screen.findByText(/O seu rascunho está guardado/)).toBeInTheDocument();
  });
});

describe('os avisos por e-mail', () => {
  const completo = () => linha({ dias: { seg: dia, ter: dia, qua: dia, qui: dia, sex: dia }, formas_registro: 'Fotos', materiais: 'Tinta', avaliacao: '' });
  const enviarPelaFicha = async () => {
    abrir('/educacao/semanario/s1');
    fireEvent.click(await screen.findByRole('button', { name: /^Enviar/ }));
    fireEvent.click(await screen.findByRole('button', { name: /^Enviar$/ }));
    await waitFor(() => expect(estado.enviados).toEqual(['s1']));
  };

  it('enviar pede o e-mail para a orientadora', async () => {
    estado.linhas = [completo()];
    await enviarPelaFicha();
    await waitFor(() => expect(estado.avisos).toEqual(['envio:s1']));
  });

  it('sem orientadora no CEI: avisa a professora, sem erro', async () => {
    const { toast } = await import('sonner');
    estado.linhas = [completo()];
    estado.aviso = { enviado: false, motivo: 'sem orientadora' };
    await enviarPelaFicha();
    await waitFor(() => expect(toast.info).toHaveBeenCalledWith('O CEI ainda não tem orientadora no app', expect.anything()));
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('e-mail que não sai não desfaz o envio', async () => {
    const { toast } = await import('sonner');
    estado.linhas = [completo()];
    estado.aviso = 'erro';
    await enviarPelaFicha();
    await waitFor(() => expect(toast.info).toHaveBeenCalledWith('O e-mail para a orientadora não saiu', expect.anything()));
    expect(estado.linhas[0].status).toBe('enviado');
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('a devolutiva pede o e-mail para a professora; apagar não', async () => {
    estado.papel = { ...estado.papel, isProfessora: false, isOrientadora: true, unit: 'Anísio' };
    estado.auth = { ...estado.auth, user: { id: 'ori-1', user_metadata: {} } };
    estado.linhas = [linha({ status: 'enviado', enviado_em: '2026-11-17T19:20:00Z' })];
    abrir('/educacao/semanario/s1');
    fireEvent.change(await screen.findByLabelText('Devolutiva'), { target: { value: 'Muito bom!' } });
    fireEvent.click(screen.getByRole('button', { name: /Enviar devolutiva/ }));
    await waitFor(() => expect(estado.avisos).toEqual(['devolutiva:s1']));
    fireEvent.click(await screen.findByRole('button', { name: /Apagar a devolutiva/ }));
    fireEvent.click(await screen.findByRole('button', { name: /^Apagar$/ }));
    await waitFor(() => expect(estado.devolutivas).toEqual(['Muito bom!', '']));
    expect(estado.avisos).toEqual(['devolutiva:s1']);
  });
});
