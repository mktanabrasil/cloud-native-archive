import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { AnoDoCalendario } from '@/lib/calendario/regras';
import { ROTEIROS_DO_CALENDARIO, roteiroDoCalendario } from './tutorial';

/** O tutorial do fichário (19/11/2026): cada passo aponta para algo que existe na tela do fichário. */
vi.mock('@/lib/calendario/api', () => ({ salvarAno: vi.fn(), enviarAoMarketing: vi.fn(), linkDoArquivo: vi.fn(), acrescentarItem: vi.fn(), apagarItem: vi.fn(), editarItem: vi.fn(), criarFolhaExtra: vi.fn(), salvarFolhaExtra: vi.fn(), apagarFolhaExtra: vi.fn() }));

import { InicioDoCalendario } from '@/components/calendario/InicioDoCalendario';
import { MesAMes } from '@/components/calendario/MesAMes';

const ano = { ano: 2027, tema: 'T', percursos: [], textos: {}, meses_revisados: [], capa_url: null, status: 'aprovado', observacao: null, enviado_em: null, enviado_por: null,
  aprovado_em: '2026-11-30T15:00:00Z', aprovado_por: 'MKT', pdf_url: 'a.pdf', pdf_impresso_url: 'a.pdf', impresso_em: '2026-11-30T15:00:00Z', atualizado_em: '', atualizado_por: null } as AnoDoCalendario;

describe('qual roteiro abre', () => {
  it('no fichário, os do fichário; antes, os do preenchimento', () => {
    expect(roteiroDoCalendario('inicio', true)).toBe('calendario-fichario-inicio');
    expect(roteiroDoCalendario('mes', true)).toBe('calendario-fichario-mes');
    expect(roteiroDoCalendario('inicio', false)).toBe('calendario-inicio');
    expect(roteiroDoCalendario('textos', true)).toBeNull();
  });
});

describe('os alvos do fichário existem na tela', () => {
  it('início (menos o botão de ajuda, que é da página)', () => {
    const { container } = render(<MemoryRouter><InicioDoCalendario ano={ano} editavel={false} marketing={false} alteracoes={[]} onAno={() => {}} abrir={() => {}} onBaixar={() => {}}
      folhas={{ lista: [], itens: [], podeCriar: true, podeMexer: () => true }} /></MemoryRouter>);
    for (const p of ROTEIROS_DO_CALENDARIO['calendario-fichario-inicio'].filter(p => p.alvo !== 'cal-ajuda')) {
      expect(container.querySelector(`[data-tutorial="${p.alvo}"]`), p.alvo).not.toBeNull();
    }
  });
  it('mês a mês', () => {
    const { container } = render(<MemoryRouter><MesAMes ano={ano} itens={[]} editavel editavelDoMes={false} fichario alteracoes={[]} mes={3} onMes={() => {}} onAno={() => {}} onItens={() => {}} onBaixar={() => {}} /></MemoryRouter>);
    for (const p of ROTEIROS_DO_CALENDARIO['calendario-fichario-mes']) {
      expect(container.querySelector(`[data-tutorial="${p.alvo}"]`), p.alvo).not.toBeNull();
    }
    expect(container.querySelector('[data-tutorial="cal-revisado"]')).toBeNull();
  });
});
