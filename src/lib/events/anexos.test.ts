import { describe, expect, it, vi } from 'vitest';

const espiao = vi.hoisted(() => ({ removidos: [] as string[][] }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    storage: {
      from: () => ({
        remove: (caminhos: string[]) => {
          espiao.removidos.push(caminhos);
          return Promise.resolve({ data: null, error: null });
        },
      }),
    },
  },
}));

const {
  apagarDoBalde, caminhoDoAnexo, caminhoNoBalde, categoriaDoAnexo, limparNome, motivoDeRecusa, normalizarAnexo, rotuloDoTamanho,
} = await import('./anexos');

const URL_BASE = 'https://ihqogooddvhsvfhbwdez.supabase.co/storage/v1/object/public/event-attachments/';

describe('nomes e caminhos', () => {
  it('limpa acento, espaço e o que não é letra, e mantém a extensão', () => {
    expect(limparNome('Ofício da Secretaria (final).PDF')).toBe('Oficio-da-Secretaria-final.pdf');
    expect(limparNome('sem-extensao')).toBe('sem-extensao');
    expect(limparNome('...')).toBe('arquivo');
  });

  it('o caminho leva ano, mês, uuid e o nome limpo', () => {
    const c = caminhoDoAnexo('Cardápio café.jpg', new Date(2026, 8, 4), '11111111-2222-3333-4444-555555555555');
    expect(c).toBe('anexos/2026/09/11111111-2222-3333-4444-555555555555-Cardapio-cafe.jpg');
  });

  it('recupera o caminho a partir da URL pública, e ignora o que não é do balde', () => {
    expect(caminhoNoBalde(`${URL_BASE}anexos/2026/09/x-a.pdf?download=1`)).toBe('anexos/2026/09/x-a.pdf');
    expect(caminhoNoBalde('https://drive.google.com/abc')).toBeNull();
  });
});

describe('normalizarAnexo', () => {
  it('anexo antigo (só URL) ganha o nome do arquivo', () => {
    const a = normalizarAnexo(`${URL_BASE}2rdksrr22q.png`);
    expect(a).toEqual({ url: `${URL_BASE}2rdksrr22q.png`, name: '2rdksrr22q.png', size: 0, type: '' });
  });

  it('anexo novo em URL tira o uuid do nome', () => {
    const a = normalizarAnexo(`${URL_BASE}anexos/2026/09/11111111-2222-3333-4444-555555555555-oficio.pdf`);
    expect(a.name).toBe('oficio.pdf');
  });

  it('objeto passa direto', () => {
    const obj = { url: 'u', name: 'n.pdf', size: 3, type: 'application/pdf' };
    expect(normalizarAnexo(obj)).toBe(obj);
  });
});

describe('categoriaDoAnexo e tamanho', () => {
  it('pelo tipo, ou pela extensão quando o tipo falta', () => {
    expect(categoriaDoAnexo({ url: '', name: 'a', size: 0, type: 'application/pdf' })).toBe('PDF');
    expect(categoriaDoAnexo({ url: '', name: 'lista.xlsx', size: 0, type: '' })).toBe('Planilha');
    expect(categoriaDoAnexo({ url: '', name: 'foto.PNG', size: 0, type: '' })).toBe('Imagem');
    expect(categoriaDoAnexo({ url: '', name: 'x.zip', size: 0, type: '' })).toBe('Arquivo');
  });

  it('tamanho legível; vazio quando não sabemos', () => {
    expect(rotuloDoTamanho(312 * 1024)).toBe('312 KB');
    expect(rotuloDoTamanho(1.4 * 1024 * 1024)).toBe('1,4 MB');
    expect(rotuloDoTamanho(0)).toBe('');
  });
});

describe('motivoDeRecusa', () => {
  it('recusa acima de 10 MB e tipo desconhecido; aceita PDF e imagem', () => {
    expect(motivoDeRecusa({ name: 'video.mp4', size: 11 * 1024 * 1024, type: 'video/mp4' })).toMatch(/limite é 10 MB/);
    expect(motivoDeRecusa({ name: 'x.zip', size: 10, type: 'application/zip' })).toMatch(/não é PDF/);
    expect(motivoDeRecusa({ name: 'oficio.pdf', size: 10, type: 'application/pdf' })).toBeNull();
    expect(motivoDeRecusa({ name: 'foto.jpg', size: 10, type: 'image/jpeg' })).toBeNull();
  });
});

describe('apagarDoBalde', () => {
  it('só manda o que é do balde, num pedido só', async () => {
    espiao.removidos = [];
    await apagarDoBalde([`${URL_BASE}anexos/2026/09/a.pdf`, 'https://drive.google.com/x', `${URL_BASE}velho.png`]);
    expect(espiao.removidos).toEqual([['anexos/2026/09/a.pdf', 'velho.png']]);
  });

  it('nada a apagar, nada chamado', async () => {
    espiao.removidos = [];
    await apagarDoBalde(['https://drive.google.com/x']);
    expect(espiao.removidos).toEqual([]);
  });
});
