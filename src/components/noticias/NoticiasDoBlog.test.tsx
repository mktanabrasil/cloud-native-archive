import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Link, MemoryRouter, useLocation } from 'react-router-dom';
import type { MidiaDoPainel, NoticiaDoPainel, NoticiaNaLista } from '@/lib/noticias/painel';

const api = vi.hoisted(() => ({
  listaDoPainel: vi.fn(), noticiaDoPainel: vi.fn(), salvarNoticia: vi.fn(), excluirNoticia: vi.fn(), envioConcluido: vi.fn(), enviarArquivo: vi.fn(),
}));
const avisos = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('@/lib/noticias/painel', async (original) => ({ ...(await original<typeof import('@/lib/noticias/painel')>()), ...api }));
vi.mock('sonner', () => ({ toast: avisos }));

const { NoticiasDoBlog } = await import('./NoticiasDoBlog');

const item = (n: Partial<NoticiaNaLista>): NoticiaNaLista => ({
  pasta_id: 'P', slug: 's', erro: null, lendo: false, titulo: 'T', data: '2026-10-28', data_hora: '2026-10-28T00:02', unidade: 'ana-dic', unidades: ['ana-dic'],
  publicado: true, na_lista: true, fixada: false, capa: '/mini.jpg', fotos: 3, videos: 0, ...n,
});
const LISTA = [
  item({ pasta_id: 'P1', titulo: 'Dia das Crianças especial com o Colégio Objetivo', fotos: 4, videos: 1 }),
  item({ pasta_id: 'P2', titulo: 'ANA Santana inicia alongamento coletivo', data: '2026-10-06', unidade: 'ana-jardim-santana', unidades: ['ana-jardim-santana', 'ana-dic'] }),
  item({ pasta_id: 'P3', titulo: 'Natal Sorriso celebra famílias', data: '2025-12-13', unidade: 'institucional', unidades: ['institucional'], fixada: true }),
  item({ pasta_id: 'P4', titulo: 'Oficina de Natal com as famílias', data: '2026-11-25', publicado: false, unidade: 'ana-oziel', unidades: ['ana-oziel'] }),
];
const midia = (chave: string, tipo: 'foto' | 'video' = 'foto', alt = ''): MidiaDoPainel => ({
  tipo, chave, nome: `${chave}.jpg`, w: 1600, h: 1200, duracao: tipo === 'video' ? 75 : null, alt, mini: `/m/${chave}`, tela: `/t/${chave}`, original: `/o/${chave}`,
});
const P1: NoticiaDoPainel = {
  pasta_id: 'P1', pasta_nome: '2026-10-28 — Dia das Crianças', slug: 'dia', erro: null, atualizado_em: null, endereco_no_site: null, enviados: [],
  dados: {
    titulo: 'Dia das Crianças especial com o Colégio Objetivo', data: '2026-10-28', data_hora: '2026-10-28T00:02', unidade: 'ana-dic', unidades: ['ana-dic', 'ana-piaui'],
    texto: ['Primeiro parágrafo.', 'Segundo parágrafo.'], capa: midia('CAPA'), midias: [midia('F1', 'foto', 'Crianças no pátio'), midia('F2'), midia('V1', 'video')],
    na_lista: true, fixada: false, publicado: true,
  },
};

let local = '';
function Endereco() { const l = useLocation(); local = l.pathname + l.search; return null; }
const abrir = (url = '/marketing/noticias') => render(
  <MemoryRouter initialEntries={[url]}><Link to="/marketing/pizza">Pizza da Alegria</Link><NoticiasDoBlog /><Endereco /></MemoryRouter>,
);

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  api.listaDoPainel.mockResolvedValue({ noticias: LISTA, base: 'https://x' });
  api.noticiaDoPainel.mockResolvedValue(structuredClone(P1));
  api.salvarNoticia.mockImplementation(async (p) => ({ ...structuredClone(P1), pasta_id: p.pasta_id ?? 'NOVA', dados: { ...structuredClone(P1).dados!, publicado: p.publicado } }));
  api.excluirNoticia.mockResolvedValue({ ok: true });
});
afterEach(() => { vi.useRealTimers(); });

/** Marketing › Notícias (25/11/2026). */
describe('Notícias do blog', () => {
  it('lista: publicadas por padrão, rascunhos à parte, filtro por unidade (inclui a segunda unidade), ano e busca sem acento', async () => {
    abrir();
    expect(await screen.findByText('Dia das Crianças especial com o Colégio Objetivo')).toBeInTheDocument();
    expect(screen.queryByText('Oficina de Natal com as famílias')).not.toBeInTheDocument();
    expect(screen.getByText(/3 publicadas/)).toBeInTheDocument();
    expect(screen.getByText('Destaque')).toBeInTheDocument();
    const unidades = screen.getByRole('group', { name: 'Unidades' });
    fireEvent.click(within(unidades).getByRole('button', { name: /Ana Dic\s*2/ }));
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Dia das Crianças especial com o Colégio Objetivo', 'ANA Santana inicia alongamento coletivo']);
    fireEvent.click(within(unidades).getByRole('button', { name: /^Todas/ }));
    fireEvent.change(screen.getByLabelText('Ano'), { target: { value: '2025' } });
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Natal Sorriso celebra famílias']);
    fireEvent.change(screen.getByLabelText('Ano'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Procurar notícia'), { target: { value: 'colegio' } });
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(1);
    fireEvent.click(screen.getByRole('tab', { name: 'Rascunhos 1' }));
    fireEvent.change(screen.getByLabelText('Procurar notícia'), { target: { value: '' } });
    expect(screen.getByText('Oficina de Natal com as famílias')).toBeInTheDocument();
    expect(screen.getByText('Rascunho')).toBeInTheDocument();
  });

  it('abrir uma notícia leva ao editor no endereço dela', async () => {
    abrir();
    fireEvent.click(await screen.findByText('ANA Santana inicia alongamento coletivo'));
    expect(local).toBe('/marketing/noticias?noticia=P2');
    expect(api.noticiaDoPainel).toHaveBeenCalledWith('P2');
  });

  it('editor: troca a capa, reordena, retira, descreve e salva mantendo a hora', async () => {
    abrir('/marketing/noticias?noticia=P1');
    expect(await screen.findByDisplayValue('Dia das Crianças especial com o Colégio Objetivo')).toBeInTheDocument();
    expect(screen.getByDisplayValue('00:02')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ana Piauí' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('No site')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Usar a foto 3 como capa' }));
    fireEvent.click(screen.getByRole('button', { name: 'Passar a foto 3 para antes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Retirar o vídeo V1.jpg' }));
    fireEvent.click(screen.getByRole('button', { name: /^Foto 1/ }));
    fireEvent.change(screen.getByPlaceholderText(/Crianças do ANA Dic/), { target: { value: 'Capa antiga' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(api.salvarNoticia).toHaveBeenCalled());
    expect(api.salvarNoticia.mock.calls[0][0]).toEqual({
      pasta_id: 'P1', titulo: 'Dia das Crianças especial com o Colégio Objetivo', data: '2026-10-28', hora: '00:02', unidade: 'ana-dic', unidades: ['ana-piaui'],
      texto: ['Primeiro parágrafo.', 'Segundo parágrafo.'], na_lista: true, fixada: false, publicado: true, capa: 'F2', ordem: ['CAPA', 'F2', 'F1'], videos: [], remover: ['V1'],
      descricoes: { F1: 'Crianças no pátio', CAPA: 'Capa antiga' },
    });
    await waitFor(() => expect(avisos.success).toHaveBeenCalledWith('Notícia salva. O site já mostra.'));
  });

  it('capa que é a 1ª foto aparece uma vez; envios ainda não salvos entram como mudança', async () => {
    const semCapaPropria = structuredClone(P1);
    semCapaPropria.dados!.capa = midia('F1');
    semCapaPropria.enviados = [midia('E1'), midia('EV', 'video')];
    api.noticiaDoPainel.mockResolvedValue(semCapaPropria);
    abrir('/marketing/noticias?noticia=P1');
    await screen.findByDisplayValue('Dia das Crianças especial com o Colégio Objetivo');
    expect(screen.getByText('· 3', { exact: false })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Foto \d/ })).toHaveLength(3); // F1, F2, E1
    expect(screen.getByRole('button', { name: 'Retirar o vídeo EV.jpg' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(api.salvarNoticia).toHaveBeenCalled());
    expect(api.salvarNoticia.mock.calls[0][0]).toMatchObject({ capa: 'F1', ordem: ['F1', 'F2', 'E1'], videos: ['V1', 'EV'] });
  });

  it('nova: avisa o que falta; a primeira foto salva o rascunho (com o código do editor) e entra como capa ao salvar', async () => {
    abrir('/marketing/noticias?noticia=nova');
    fireEvent.click(await screen.findByRole('button', { name: 'Publicar' }));
    expect(avisos.error).toHaveBeenCalledWith('Falta preencher: o título, a unidade, o texto, a capa.');
    expect(api.salvarNoticia).not.toHaveBeenCalled();
    fireEvent.change(screen.getByPlaceholderText(/Oficina de Natal reúne/), { target: { value: 'Oficina nova' } });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ana-oziel' } });
    api.salvarNoticia.mockResolvedValueOnce({ pasta_id: 'NOVA', pasta_nome: 'x', slug: 'oficina-nova', erro: null, atualizado_em: null, endereco_no_site: null, enviados: [], dados: { ...P1.dados!, titulo: 'Oficina nova', capa: null, midias: [], publicado: false } });
    api.enviarArquivo.mockImplementation(async (_p, _f, progresso) => { progresso(0.5); });
    api.envioConcluido.mockResolvedValue({ ...P1, pasta_id: 'NOVA', dados: { ...P1.dados!, capa: null, midias: [], publicado: false }, enviados: [midia('N1'), midia('N2')] });
    const entrada = document.querySelector('input[type=file][accept^="image"]') as HTMLInputElement;
    fireEvent.change(entrada, { target: { files: [new File(['x'], 'IMG_1.jpg', { type: 'image/jpeg' }), new File(['y'], 'IMG_2.jpg', { type: 'image/jpeg' })] } });
    await waitFor(() => expect(api.envioConcluido).toHaveBeenCalledWith('NOVA'));
    const criar = api.salvarNoticia.mock.calls[0][0];
    expect(criar).toMatchObject({ titulo: 'Oficina nova', unidade: 'ana-oziel', publicado: false });
    expect(criar.pasta_id).toBeUndefined(); expect(criar.novo_id).toMatch(/.{8,}/);
    expect(api.enviarArquivo).toHaveBeenCalledTimes(2);
    expect(api.enviarArquivo.mock.calls[0][0]).toBe('NOVA');
    expect(local).toBe('/marketing/noticias?noticia=NOVA');
    expect(await screen.findByRole('button', { name: 'É a capa' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Oficina nova')).toBeInTheDocument();
    expect(avisos.success).toHaveBeenCalledWith('2 arquivos enviados ao Drive. Entram na notícia quando você salvar.');
    fireEvent.change(screen.getByRole('textbox', { name: /Texto/ }), { target: { value: 'Linha um\ncontinua.\n\nOutro parágrafo.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Publicar' }));
    await waitFor(() => expect(api.salvarNoticia).toHaveBeenCalledTimes(2));
    expect(api.salvarNoticia.mock.calls[1][0]).toMatchObject({ pasta_id: 'NOVA', publicado: true, capa: 'N1', ordem: ['N1', 'N2'], texto: ['Linha um continua.', 'Outro parágrafo.'] });
    expect(api.salvarNoticia.mock.calls[1][0].novo_id).toBeUndefined();
  });

  it('salvar que falhou tenta de novo com o mesmo código (não cria outra notícia); campos travados enquanto salva', async () => {
    abrir('/marketing/noticias?noticia=nova');
    fireEvent.change(await screen.findByPlaceholderText(/Oficina de Natal reúne/), { target: { value: 'Rascunho' } });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ana-dic' } });
    api.salvarNoticia.mockRejectedValueOnce(new Error('o Google Drive recusou a mudança (500)'));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    await waitFor(() => expect(avisos.error).toHaveBeenCalledWith('o Google Drive recusou a mudança (500)'));
    let soltar!: (v: unknown) => void;
    api.salvarNoticia.mockImplementationOnce(() => new Promise((r) => { soltar = r; }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    await waitFor(() => expect(api.salvarNoticia).toHaveBeenCalledTimes(2));
    expect(api.salvarNoticia.mock.calls[1][0].novo_id).toBe(api.salvarNoticia.mock.calls[0][0].novo_id);
    expect(screen.getByDisplayValue('Rascunho')).toBeDisabled();
    await act(async () => { soltar({ ...structuredClone(P1), pasta_id: 'NOVA', dados: { ...P1.dados!, titulo: 'Rascunho', publicado: false } }); });
    await waitFor(() => expect(screen.getByDisplayValue('Rascunho')).not.toBeDisabled());
  });

  it('releitura adiada: fica o que foi salvo na tela e o aviso fala dos 2 minutos', async () => {
    abrir('/marketing/noticias?noticia=P1');
    const titulo = await screen.findByDisplayValue('Dia das Crianças especial com o Colégio Objetivo');
    fireEvent.change(titulo, { target: { value: 'Título novo' } });
    api.salvarNoticia.mockResolvedValueOnce({ ...structuredClone(P1), relendo: true });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(avisos.success).toHaveBeenCalledWith('Notícia salva. O site termina de atualizar em até 2 minutos.'));
    expect(screen.getByDisplayValue('Título novo')).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Caminho' })).getByRole('button', { name: 'Notícias' }));
    expect(local).toBe('/marketing/noticias'); // nada pendente: sai sem perguntar
  });

  it('sair com mudança pergunta, inclusive pelos links do menu; excluir pede confirmação e não deixa a notícia no voltar', async () => {
    abrir('/marketing/noticias?noticia=P1');
    const titulo = await screen.findByDisplayValue('Dia das Crianças especial com o Colégio Objetivo');
    fireEvent.change(titulo, { target: { value: 'Outro título' } });
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Caminho' })).getByRole('button', { name: 'Notícias' }));
    expect(await screen.findByText('Sair sem salvar?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar editando' }));
    fireEvent.click(screen.getByRole('link', { name: 'Pizza da Alegria' }));
    expect(await screen.findByText('Sair sem salvar?')).toBeInTheDocument();
    expect(local).toBe('/marketing/noticias?noticia=P1');
    fireEvent.click(screen.getByRole('button', { name: 'Continuar editando' }));
    fireEvent.click(screen.getByRole('button', { name: /Excluir notícia/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Excluir' }));
    await waitFor(() => expect(api.excluirNoticia).toHaveBeenCalledWith('P1'));
    await waitFor(() => expect(local).toBe('/marketing/noticias'));
  });

  it('mudança não salva fica numa cópia local e pode ser recuperada ao abrir de novo', async () => {
    const primeira = abrir('/marketing/noticias?noticia=P1');
    fireEvent.change(await screen.findByDisplayValue('Dia das Crianças especial com o Colégio Objetivo'), { target: { value: 'Título que ia se perder' } });
    await waitFor(() => expect(localStorage.getItem('noticia-nao-salva:P1')).toContain('Título que ia se perder'), { timeout: 2000 });
    primeira.unmount(); // voltar do navegador, aba fechada
    abrir('/marketing/noticias?noticia=P1');
    expect(await screen.findByText(/Há mudanças desta notícia que não foram salvas/)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Dia das Crianças especial com o Colégio Objetivo')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Recuperar' }));
    expect(screen.getByDisplayValue('Título que ia se perder')).toBeInTheDocument();
    expect(screen.queryByText(/Há mudanças desta notícia/)).not.toBeInTheDocument();
  });

  it('cópia de notícia nova guarda o código: recuperar e salvar reaproveita a mesma pasta; editar com o aviso na tela continua guardando', async () => {
    const primeira = abrir('/marketing/noticias?noticia=nova');
    fireEvent.change(await screen.findByPlaceholderText(/Oficina de Natal reúne/), { target: { value: 'Nova que caiu' } });
    await waitFor(() => expect(localStorage.getItem('noticia-nao-salva:nova')).toContain('Nova que caiu'), { timeout: 2000 });
    const codigo = JSON.parse(localStorage.getItem('noticia-nao-salva:nova')!).novo_id;
    expect(codigo).toMatch(/.{8,}/);
    primeira.unmount();
    abrir('/marketing/noticias?noticia=nova');
    expect(await screen.findByText(/Há mudanças desta notícia/)).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/Oficina de Natal reúne/), { target: { value: 'Outra coisa' } });
    await waitFor(() => expect(localStorage.getItem('noticia-nao-salva:nova')).toContain('Outra coisa'), { timeout: 2000 });
    fireEvent.click(screen.getByRole('button', { name: 'Recuperar' }));
    expect(screen.getByDisplayValue('Nova que caiu')).toBeInTheDocument();
    expect(localStorage.getItem('noticia-nao-salva:nova:anterior')).toBeNull();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ana-dic' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    await waitFor(() => expect(api.salvarNoticia).toHaveBeenCalled());
    expect(api.salvarNoticia.mock.calls[0][0].novo_id).toBe(codigo);
  });

  it('notícia sendo relida do Drive: avisa e só deixa salvar depois de recarregar', async () => {
    api.noticiaDoPainel.mockResolvedValueOnce({ ...structuredClone(P1), lendo: true });
    abrir('/marketing/noticias?noticia=P1');
    expect(await screen.findByText(/ainda está sendo relido/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();
    expect(screen.getByDisplayValue('Dia das Crianças especial com o Colégio Objetivo')).toBeDisabled();
    expect(screen.getByRole('button', { name: /Adicionar fotos/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Recarregar' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Salvar' })).not.toBeDisabled());
    expect(screen.getByDisplayValue('Dia das Crianças especial com o Colégio Objetivo')).not.toBeDisabled();
    expect(screen.queryByText(/ainda está sendo relido/)).not.toBeInTheDocument();
  });

  it('descrição apagada não conta como mudança; resposta que chega depois de sair não volta ao editor', async () => {
    const r = abrir('/marketing/noticias?noticia=P1');
    await screen.findByDisplayValue('Dia das Crianças especial com o Colégio Objetivo');
    fireEvent.click(screen.getByRole('button', { name: /^Foto 2/ }));
    const desc = screen.getByDisplayValue('Crianças no pátio');
    fireEvent.change(desc, { target: { value: '' } });
    fireEvent.change(desc, { target: { value: 'Crianças no pátio' } });
    fireEvent.click(screen.getByRole('button', { name: /^Foto 3/ }));
    const outra = screen.getByPlaceholderText(/Crianças do ANA Dic/);
    fireEvent.change(outra, { target: { value: 'a' } });
    fireEvent.change(outra, { target: { value: '' } });
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Caminho' })).getByRole('button', { name: 'Notícias' }));
    expect(local).toBe('/marketing/noticias'); // sem "Sair sem salvar?"
    r.unmount();
    let soltar!: (v: unknown) => void;
    api.salvarNoticia.mockImplementationOnce(() => new Promise((ok) => { soltar = ok; }));
    const s = abrir('/marketing/noticias?noticia=nova');
    fireEvent.change(await screen.findByPlaceholderText(/Oficina de Natal reúne/), { target: { value: 'Sai no meio' } });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ana-dic' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    await waitFor(() => expect(api.salvarNoticia).toHaveBeenCalled());
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Caminho' })).getByRole('button', { name: 'Notícias' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sair sem salvar' }));
    expect(local).toBe('/marketing/noticias');
    await act(async () => { soltar({ ...structuredClone(P1), pasta_id: 'NOVA' }); });
    expect(local).toBe('/marketing/noticias');
    s.unmount();
  });

  it('notícia que o Drive não conseguiu ler não abre como formulário em branco', async () => {
    api.noticiaDoPainel.mockResolvedValue({ ...structuredClone(P1), dados: null, erro: 'o post.json desta notícia está com o texto quebrado' });
    abrir('/marketing/noticias?noticia=P1');
    expect(await screen.findByText(/ainda não pôde ser lida do Drive/)).toBeInTheDocument();
    expect(screen.getByText(/texto quebrado/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Salvar rascunho' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Excluir notícia/ })).toBeInTheDocument();
  });
});
