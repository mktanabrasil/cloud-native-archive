import { describe, expect, it } from 'vitest';
import { buscarNoticias, escala, lerNomeDaPasta, manchete, maisRecentePrimeiro, montarNoticia, nomeDaPastaDoPost, nomeNaOrdem, pastaDaUnidade, problemasDaEdicao, resumoDe, slugDaNoticia, unidadeDe } from '../../../supabase/functions/noticias/regras';

/** A API de notícias (25/11/2026): pastas do blog no Drive → lista para o site. */
describe('as regras da API de notícias', () => {
  it('unidades com os endereços da transparência; "ANA Brasil" vira institucional', () => {
    expect(unidadeDe('Ana Dic')).toEqual({ slug: 'ana-dic', nome: 'Ana Dic' });
    expect(unidadeDe('Ana Jardim Nilópolis').slug).toBe('ana-jardim-nilopolis');
    expect(unidadeDe('ANA Brasil (institucional)')).toEqual({ slug: 'institucional', nome: 'ANA Brasil' });
    expect(unidadeDe('Aninha Cancela').slug).toBe('aninha-cancela');
    expect(unidadeDe('CEI Novo Qualquer').slug).toBe('cei-novo-qualquer');
  });

  it('nome da pasta, endereço da notícia (sem emoji) e tamanhos', () => {
    expect(lerNomeDaPasta('2026-10-28 — Dia das Crianças especial')).toEqual({ data: '2026-10-28', titulo: 'Dia das Crianças especial' });
    expect(lerNomeDaPasta('Sem data')).toEqual({ data: null, titulo: 'Sem data' });
    expect(slugDaNoticia('x', '%f0%9f%8e%88-dia-das-criancas-com-muita-alegria-e-fe')).toBe('dia-das-criancas-com-muita-alegria-e-fe');
    expect(slugDaNoticia('Oficina de Natal com as famílias', null)).toBe('oficina-de-natal-com-as-familias');
    expect(escala(4000, 3000, 1600)).toEqual({ w: 1600, h: 1200 });
    expect(escala(1200, 1600, 400)).toEqual({ w: 300, h: 400 });
    expect(escala(300, 200, 400)).toEqual({ w: 300, h: 200 });
    expect(escala(null, 200, 400)).toBeNull();
  });

  it('monta a notícia do post.json; o que faltar sai do nome da pasta', () => {
    const n = montarNoticia({ titulo: 'Natal', data: '2025-12-13T00:00:00', unidade: 'Ana Jardim Santana', unidades: ['Ana Jardim Santana', 'Ana Dic'], texto_paragrafos: [' Um. ', '', 'Dois.'] }, { nome: '2025-12-13 — Natal', unidadePasta: 'Ana Jardim Santana' });
    expect(n).toEqual({ titulo: 'Natal', data: '2025-12-13', data_hora: '2025-12-13T00:00', unidade: 'ana-jardim-santana', unidades: ['ana-jardim-santana', 'ana-dic'], texto: ['Um.', 'Dois.'], na_lista: true, fixada: false, publicado: true });
    expect(montarNoticia({ data: '2026-10-28T00:02:00', publicado: false }, { nome: '2026-10-28 — X', unidadePasta: 'Ana Dic' })).toMatchObject({ data_hora: '2026-10-28T00:02', publicado: false });
    expect(montarNoticia({}, { nome: '2024-05-01 — Festa Junina', unidadePasta: 'Ana Piauí' })).toMatchObject({ titulo: 'Festa Junina', data: '2024-05-01', unidade: 'ana-piaui' });
    expect(resumoDe(['', 'a '.repeat(200)], 20)).toMatch(/…$/);
  });

  it('manchete: a fixada; sem fixada, a mais recente da lista', () => {
    const l = [
      { slug: 'a', data: '2026-10-01', na_lista: true, fixada: false },
      { slug: 'b', data: '2026-11-01', na_lista: true, fixada: false },
      { slug: 'c', data: '2026-12-01', na_lista: false, fixada: false },
      { slug: 'd', data: '2025-01-01', na_lista: true, fixada: true },
    ];
    expect(manchete(l)?.slug).toBe('d');
    expect(manchete(l.map((x) => ({ ...x, fixada: false })))?.slug).toBe('b');
  });

  it('busca: título vale mais que o texto; respeita unidade e quem está fora da lista', () => {
    const l = [
      { titulo: 'Balanço 2024 publicado', texto: ['x'], unidade: 'ana-dic', unidades: ['ana-dic'], data: '2025-01-01', na_lista: true },
      { titulo: 'Festa', texto: ['O balanço do ano foi ótimo'], unidade: 'ana-piaui', unidades: ['ana-piaui'], data: '2026-01-01', na_lista: true },
      { titulo: 'Balanço escondido', texto: [], unidade: 'ana-dic', unidades: ['ana-dic'], data: '2026-01-01', na_lista: false },
    ];
    expect(buscarNoticias(l, 'balanco', {}).resultados.map((n) => n.titulo)).toEqual(['Balanço 2024 publicado', 'Festa']);
    expect(buscarNoticias(l, 'balanco', {}, { unidade: 'ana-piaui' }).total).toBe(1);
    expect(buscarNoticias(l, 'festa piaui', { 'ana-piaui': 'Ana Piauí' }).total).toBe(1);
  });

  it('edição: pasta, ordem das fotos, unidade e o que falta para publicar', () => {
    expect(nomeDaPastaDoPost('2026-11-25', '🎄 Oficina de Natal: famílias/alunos')).toBe('2026-11-25 — Oficina de Natal famílias alunos');
    expect(nomeNaOrdem(3, '01 - IMG_0803.jpg')).toBe('03 - IMG_0803.jpg');
    // Só a numeração do painel sai: nome que começa com data ou número fica inteiro.
    expect(nomeNaOrdem(1, '2024-05-01 festa.jpg')).toBe('01 - 2024-05-01 festa.jpg');
    expect(nomeNaOrdem(2, '1-capa.jpg')).toBe('02 - 1-capa.jpg');
    expect(nomeNaOrdem(4, '120 - IMG.jpg')).toBe('04 - IMG.jpg');
    expect(pastaDaUnidade('institucional')).toBe('ANA Brasil (institucional)');
    expect(pastaDaUnidade('nao-existe')).toBeNull();
    const base = { titulo: 'X', data: '2026-11-25', unidade: 'ana-dic', texto: ['Oi'] };
    expect(problemasDaEdicao(base, true)).toEqual([]);
    expect(problemasDaEdicao({ ...base, texto: [] }, false)).toEqual(['o texto', 'a capa']);
    expect(problemasDaEdicao({ ...base, texto: [], publicado: false }, false)).toEqual([]);
    expect(problemasDaEdicao({ ...base, data: '2026-02-30', hora: '25:00' }, true)).toEqual(['a data', 'a hora']);
    const l = [{ slug: 'a', data: '2026-10-28', data_hora: '2026-10-28T00:00' }, { slug: 'b', data: '2026-10-28', data_hora: '2026-10-28T00:02' }];
    expect([...l].sort(maisRecentePrimeiro).map((x) => x.slug)).toEqual(['b', 'a']);
  });
});
