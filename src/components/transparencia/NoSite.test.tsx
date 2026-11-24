import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import type { EstadoDoSite } from '@/lib/transparencia/api';

const api = vi.hoisted(() => ({ estadoDoSite: vi.fn(), atualizarSiteAgora: vi.fn() }));
const avisos = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }));
vi.mock('@/lib/transparencia/api', async (orig) => ({ ...(await orig<typeof import('@/lib/transparencia/api')>()), ...api }));
vi.mock('sonner', () => ({ toast: avisos }));

const { CartaoDoSite, SituacaoNoSite, useEstadoDoSite, haQuanto, linhaDaUnidade, quando, situacaoGeral } = await import('./NoSite');

// Terça, 24/11/2026, 16:45 (horário local do teste).
const AGORA = new Date(2026, 10, 24, 16, 45);
const ISO = (h: number, m: number, dia = 24) => new Date(2026, 10, dia, h, m).toISOString();
const ESTADO: EstadoDoSite = {
  ciclo_em: ISO(16, 44), ciclo_erro: null, alerta_em: null, alerta_motivo: null,
  base: 'https://supabase.anabrasil.org/functions/v1/transparencia',
  unidades: [
    { slug: 'ana-jardim-nilopolis', nome: 'Ana Jardim Nilópolis', nome_curto: 'Nilópolis', documentos: 733, pastas: 137, atualizado_em: ISO(16, 38) },
    { slug: 'ana-jardim-santana', nome: 'Ana Jardim Santana', nome_curto: 'Santana', documentos: 631, pastas: 131, atualizado_em: ISO(14, 18) },
  ],
  situacao: [
    { config_id: 'nilo', erro: null, tentativa_em: ISO(16, 38), falhando_desde: null, sujo: false },
    { config_id: 'santana', erro: 'a pasta principal desta unidade está na lixeira do Drive', tentativa_em: ISO(16, 44), falhando_desde: ISO(14, 20), sujo: true },
    { config_id: 'nova', erro: null, tentativa_em: null, falhando_desde: null, sujo: true },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(AGORA);
  api.estadoDoSite.mockResolvedValue(structuredClone(ESTADO));
  api.atualizarSiteAgora.mockResolvedValue({ lidas: ['Nilópolis', 'Santana'], falhas: [], pendentes: 3, erro: null });
});
afterEach(() => { vi.useRealTimers(); });

function Tela() {
  const s = useEstadoDoSite(true);
  return (
    <div>
      <CartaoDoSite s={s} />
      <SituacaoNoSite s={s} configId="nilo" slug="ana-jardim-nilopolis" />
      <SituacaoNoSite s={s} configId="santana" slug="ana-jardim-santana" />
      <SituacaoNoSite s={s} configId="nova" slug={null} />
    </div>
  );
}

describe('Portal Transparência no site do ANA', () => {
  it('horários: "às" hoje, data nos outros dias, "há X min"', () => {
    expect(quando(ISO(16, 4), AGORA)).toBe('às 16:04');
    expect(quando(ISO(9, 30, 23), AGORA)).toBe('em 23/11 às 09:30');
    expect(haQuanto(ISO(16, 44), AGORA)).toBe('há 1 min');
    expect(haQuanto(ISO(16, 44, 23), AGORA)).toBe('há 24 h');
  });

  it('situação geral: no ar; aviso; última conferência falhou; parada; nunca rodou', () => {
    expect(situacaoGeral(ESTADO, AGORA)).toEqual({ tom: 'ok', titulo: 'No ar · Drive conferido há 1 min', detalhe: null });
    const parada = situacaoGeral({ ...ESTADO, alerta_em: ISO(14, 50), alerta_motivo: 'A conta do Google Drive do portal foi desconectada.' }, AGORA);
    expect(parada).toEqual({ tom: 'alerta', titulo: 'A atualização parou · aviso enviado às 14:50 · o site mostra a última lista boa (16:38)', detalhe: 'A conta do Google Drive do portal foi desconectada.' });
    expect(situacaoGeral({ ...ESTADO, alerta_em: ISO(14, 50), alerta_motivo: '1 unidade(s) sem conseguir atualizar há mais de 30 min. Último erro: x' }, AGORA).titulo).toMatch(/^Há unidades sem atualizar/);
    const falhou = situacaoGeral({ ...ESTADO, ciclo_erro: 'o Google Drive respondeu 500' }, AGORA);
    expect(falhou.tom).toBe('alerta'); expect(falhou.titulo).toMatch(/^A última conferência do Drive falhou \(há 1 min\)/); expect(falhou.detalhe).toBe('o Google Drive respondeu 500');
    expect(situacaoGeral({ ...ESTADO, ciclo_em: ISO(16, 30) }, AGORA).tom).toBe('alerta');
    expect(situacaoGeral({ ...ESTADO, ciclo_em: null }, AGORA).titulo).toBe('A conferência automática do Drive ainda não rodou');
  });

  it('linha de cada unidade: documentos e hora; motivo quando não atualiza; unidade nova', () => {
    expect(linhaDaUnidade(ESTADO, 'nilo', 'ana-jardim-nilopolis', AGORA)).toEqual({ tom: 'neutro', destaque: '733 documentos', texto: ' · lista lida às 16:38' });
    expect(linhaDaUnidade(ESTADO, 'santana', 'ana-jardim-santana', AGORA)?.texto).toBe('Não atualiza: a pasta principal desta unidade está na lixeira do Drive. O site mostra a lista lida às 14:18.');
    expect(linhaDaUnidade(ESTADO, 'nova', null, AGORA)?.texto).toMatch(/^Ainda não aparece no site/);
    expect(linhaDaUnidade(ESTADO, 'sem-linha', null, AGORA)).toBeNull();
  });

  it('mostra o cartão e as linhas das unidades', async () => {
    render(<Tela />);
    expect(await screen.findByText('No ar · Drive conferido há 1 min')).toBeInTheDocument();
    expect(screen.getByText(/2 unidades · 1\.364 documentos · confere o Drive a cada 2 minutos/)).toBeInTheDocument();
    // Santana está na fila, mas falhando: aparece na linha dela, não no "atualizando".
    expect(screen.getByText(/atualizando 1 unidade…/)).toBeInTheDocument();
    const linhas = screen.getAllByTestId('situacao-no-site');
    expect(linhas[0]).toHaveTextContent('No site: 733 documentos · lista lida às 16:38');
    expect(linhas[1]).toHaveTextContent('Não atualiza: a pasta principal');
    expect(screen.getByRole('button', { name: /Ver o que o site recebe/ })).toBeInTheDocument();
  });

  it('lista parada: cartão em alerta com o motivo', async () => {
    api.estadoDoSite.mockResolvedValue({ ...ESTADO, alerta_em: ISO(14, 20), alerta_motivo: 'A conta do Google Drive do portal foi desconectada.' });
    render(<Tela />);
    expect(await screen.findByRole('alert')).toHaveTextContent('A conta do Google Drive do portal foi desconectada. Enquanto isso, o site continua com a última lista boa');
    expect(screen.getByText(/A atualização parou · aviso enviado às 14:20/)).toBeInTheDocument();
  });

  it('"Atualizar agora" pede confirmação antes', async () => {
    render(<Tela />);
    fireEvent.click(await screen.findByRole('button', { name: /Atualizar agora/ }));
    expect(api.atualizarSiteAgora).not.toHaveBeenCalled();
    expect(screen.getByText(/tirou muitos documentos de propósito/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar agora' }));
    await waitFor(() => expect(api.atualizarSiteAgora).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(avisos.success).toHaveBeenCalledWith('2 unidade(s) relidas; as outras 3 terminam nos próximos minutos'));
    expect(api.estadoDoSite).toHaveBeenCalledTimes(2);
  });

  it('"Atualizar agora": ocupado não promete nada; falhas aparecem', async () => {
    api.atualizarSiteAgora.mockResolvedValueOnce({ ocupado: true });
    render(<Tela />);
    fireEvent.click(await screen.findByRole('button', { name: /Atualizar agora/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar agora' }));
    await waitFor(() => expect(avisos.info).toHaveBeenCalledWith('Uma conferência automática está rodando agora. Tente de novo em 1 minuto.'));
    api.atualizarSiteAgora.mockResolvedValueOnce({ lidas: ['Nilópolis'], falhas: ['Santana: a pasta principal desta unidade está na lixeira do Drive'], pendentes: 0, erro: null });
    await waitFor(() => expect(screen.getByRole('button', { name: /Atualizar agora/ })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: /Atualizar agora/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar agora' }));
    await waitFor(() => expect(avisos.warning).toHaveBeenCalledWith('1 unidade(s) relidas; 1 não conseguiram', { description: 'Santana: a pasta principal desta unidade está na lixeira do Drive' }));
    expect(avisos.success).not.toHaveBeenCalled();
  });

  it('se uma consulta seguinte falhar, avisa que é a última situação vista', async () => {
    const { result } = renderHook(() => useEstadoDoSite(true));
    await waitFor(() => expect(result.current.estado).not.toBeNull());
    api.estadoDoSite.mockRejectedValueOnce(new Error('rede'));
    await act(async () => { await result.current.recarregar(); });
    expect(result.current.estado).not.toBeNull();
    expect(result.current.falhou).toBe(true);
  });

  it('copia o endereço da API', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<Tela />);
    fireEvent.click(await screen.findByRole('button', { name: /Copiar endereço da API/ }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(ESTADO.base));
  });

  it('sem acesso à situação, o cartão avisa sem assustar; desligado, nem pergunta', async () => {
    api.estadoDoSite.mockRejectedValue(new Error('Só quem cuida do Portal Transparência.'));
    render(<Tela />);
    expect(await screen.findByText(/Não foi possível ver a situação agora. Tente de novo em instantes./)).toBeInTheDocument();
    api.estadoDoSite.mockClear();
    renderHook(() => useEstadoDoSite(false));
    await act(async () => {});
    expect(api.estadoDoSite).not.toHaveBeenCalled();
  });
});
