import { describe, expect, it } from 'vitest';
import {
  achatar, buscar, palavrasDaBusca, mostraNaTela, quedaSuspeita, chaveDe, compararNomes, contar, ehChave, ehFinalizada, grupoDa, nomeDaUnidade, nomeParaBaixar, ordemDa, ordenar, slugDe, slugLivre, tipoDo,
} from '../../../supabase/functions/transparencia/regras';

/** As 20 pastas cadastradas em 24/11/2026 (nome original no Drive). */
const PASTAS = [
  '6 CEI Bem Querer Professor Anísio Spínola', '3 CEI Bem Querer Senador João de Medeiros Calmon', '7 CEI Bem Querer Ministro Gustavo Capanema',
  '2 Ana Dic', '14 CEI Bem Querer Reverendo Bernhard Johnson Jr (Parceria Finalizada)', '11 CEI Bem Querer Professora Renata Ferramola',
  '1 Grupo de Oração Esperança', '15 CEI Bem Querer João Batista Nardi Neto (Parceria Finalizada)', '8 CEI Bem Querer Gov. Leonel de Moura Brizola',
  '10 CEI Bem Querer Mayara Masson Christofoletti', '13 Bem Querer Midori Hamamoto (Parceria Finalizada)', '1 Ana Jardim Nilópolis', '5 Ana Oziel ',
  '4 Ana Piauí', '9 CEI Bem Querer Paulo Reglus Neves Freire', '2 CEI Bem Querer Professor Pierre Weil', '4 CEI Bem Querer Célia Aparecida Jordão Velardi Gaspar',
  '3 Ana Jardim Santana', '5 CEI Bem Querer Rogério Leandro Portela Santana', '12 CEI Bem Querer Vandir Justino da Costa Dias',
];

describe('a API pública do Portal Transparência', () => {
  it('cada unidade tem um endereço fixo, legível e único', () => {
    expect(slugDe(nomeDaUnidade('1 Ana Jardim Nilópolis'))).toBe('ana-jardim-nilopolis');
    expect(slugDe(nomeDaUnidade('14 CEI Bem Querer Reverendo Bernhard Johnson Jr (Parceria Finalizada)'))).toBe('cei-bem-querer-reverendo-bernhard-johnson-jr');
    expect(slugDe(nomeDaUnidade('8 CEI Bem Querer Gov. Leonel de Moura Brizola'))).toBe('cei-bem-querer-gov-leonel-de-moura-brizola');
    const slugs = PASTAS.map((p) => slugDe(nomeDaUnidade(p)));
    expect(new Set(slugs).size).toBe(20);
    expect(slugs.every((s) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s))).toBe(true);
    expect(slugLivre('ana-dic', new Set(['ana-dic', 'ana-dic-2']))).toBe('ana-dic-3');
    // Acento decomposto (NFD), como alguns sistemas gravam nomes de arquivo.
    expect(slugDe('Ana Jardim Nilópolis'.normalize('NFD'))).toBe('ana-jardim-nilopolis');
  });

  it('grupo, ordem e "parceria finalizada" saem do nome da pasta', () => {
    const grupos = PASTAS.map(grupoDa);
    expect(grupos.filter((g) => g === 'social')).toHaveLength(5);
    expect(grupos.filter((g) => g === 'educacao')).toHaveLength(14);
    expect(grupoDa('1 Grupo de Oração Esperança')).toBe('outros');
    expect(PASTAS.filter(ehFinalizada)).toHaveLength(3);
    expect(ordemDa('14 CEI Bem Querer X')).toBe(14);
    expect(nomeDaUnidade('5 Ana Oziel ')).toBe('Ana Oziel');
    expect(nomeDaUnidade('13 Bem Querer Midori Hamamoto (Parceria Finalizada)')).toBe('Bem Querer Midori Hamamoto');
  });

  it('ordem natural das pastas, como eles numeram', () => {
    const nomes = ['10 Recursos Humanos', '2 Estatuto', '1 Ata', '17. Parecer do Conselho Fiscal', '3 Balanços'];
    expect(nomes.sort(compararNomes)).toEqual(['1 Ata', '2 Estatuto', '3 Balanços', '10 Recursos Humanos', '17. Parecer do Conselho Fiscal']);
    const arvore = ordenar({ nome: '', documentos: [], pastas: [
      { nome: '10 B', pastas: [], documentos: [{ nome: '2.pdf', tipo: 'pdf', tamanho: 1, atualizado_em: null, chave: 'x' }, { nome: '10.pdf', tipo: 'pdf', tamanho: 1, atualizado_em: null, chave: 'y' }] },
      { nome: '2 A', pastas: [{ nome: 'sub', pastas: [], documentos: [] }], documentos: [] },
    ] });
    expect(arvore.pastas.map((p) => p.nome)).toEqual(['2 A', '10 B']);
    expect(arvore.pastas[1].documentos.map((d) => d.nome)).toEqual(['2.pdf', '10.pdf']);
    expect(contar(arvore)).toEqual({ pastas: 3, documentos: 2 });
  });

  it('a chave do documento não revela o código do Google e não muda', async () => {
    const a = await chaveDe('segredo-1', '1BzicdGu9vGZUDgC8L2IlPD2rRwWPEkg7');
    expect(a).toBe(await chaveDe('segredo-1', '1BzicdGu9vGZUDgC8L2IlPD2rRwWPEkg7'));
    expect(a).not.toBe(await chaveDe('segredo-2', '1BzicdGu9vGZUDgC8L2IlPD2rRwWPEkg7'));
    expect(ehChave(a)).toBe(true);
    expect(a).not.toContain('1Bzic');
    expect(ehChave('../../etc/passwd')).toBe(false);
  });

  it('tipo e nome para baixar: documento do Google sai como PDF', () => {
    expect(tipoDo('application/pdf', 'x.pdf')).toBe('pdf');
    expect(tipoDo('application/vnd.google-apps.document', 'Ata')).toBe('pdf');
    expect(tipoDo('application/vnd.oasis.opendocument.spreadsheet', 'p.ods')).toBe('ods');
    expect(tipoDo(undefined, 'planilha.XLSX')).toBe('xlsx');
    expect(nomeParaBaixar('Ata', 'application/vnd.google-apps.document')).toBe('Ata.pdf');
    expect(nomeParaBaixar('Balanço.pdf', 'application/pdf')).toBe('Balanço.pdf');
  });

  it('só PDF, imagem e texto abrem na tela; HTML e SVG baixam', () => {
    expect(['application/pdf', 'image/jpeg', 'text/csv'].every(mostraNaTela)).toBe(true);
    expect(['text/html', 'image/svg+xml', 'text/xml', 'application/octet-stream'].some(mostraNaTela)).toBe(false);
  });

  it('lista que zera ou cai mais da metade não entra sozinha', () => {
    expect(quedaSuspeita(733, 0)).toBe(true);
    expect(quedaSuspeita(733, 300)).toBe(true);
    expect(quedaSuspeita(733, 700)).toBe(false);
    expect(quedaSuspeita(4, 1)).toBe(false);
    expect(quedaSuspeita(0, 0)).toBe(false);
  });
});

describe('a busca do site nos documentos do portal', () => {
  const arvore = {
    nome: '', documentos: [],
    pastas: [
      { nome: '3 Balanços', pastas: [], documentos: [
        { nome: 'BALANÇO 2024.pdf', tipo: 'pdf', tamanho: 1, atualizado_em: '2025-03-01T00:00:00Z', chave: 'a' },
        { nome: 'BALANÇO 2025.pdf', tipo: 'pdf', tamanho: 1, atualizado_em: '2026-03-01T00:00:00Z', chave: 'b' },
        { nome: 'Notas explicativas 2024.pdf', tipo: 'pdf', tamanho: 1, atualizado_em: '2025-03-02T00:00:00Z', chave: 'c' },
      ] },
      { nome: '5 Certidões', pastas: [{ nome: 'VENCIDAS', pastas: [], documentos: [{ nome: 'CNPJ 16/01/2024.pdf', tipo: 'pdf', tamanho: 1, atualizado_em: null, chave: 'd' }] }], documentos: [] },
    ],
  };
  const docs = [...achatar(arvore, { slug: 'ana-jardim-nilopolis', nome: 'Ana Jardim Nilópolis' }), ...achatar({ nome: '', pastas: [], documentos: [{ nome: 'Balanço 2024.pdf', tipo: 'pdf', tamanho: 1, atualizado_em: null, chave: 'e' }] }, { slug: 'ana-dic', nome: 'Ana Dic' })];

  it('acha sem acento nem maiúscula, com o caminho de pastas', () => {
    const r = buscar(docs, 'balanco 2024');
    // As Notas estão na pasta Balanços e têm 2024 no nome: entram, depois das que têm tudo no nome.
    expect(r.total).toBe(3);
    expect(r.resultados.map((d) => [d.nome, d.unidade.slug, d.caminho])).toEqual([['BALANÇO 2024.pdf', 'ana-jardim-nilopolis', ['3 Balanços']], ['Balanço 2024.pdf', 'ana-dic', []], ['Notas explicativas 2024.pdf', 'ana-jardim-nilopolis', ['3 Balanços']]]);
  });
  it('quem tem as palavras no nome vem antes de quem só está na pasta', () => {
    expect(buscar(docs, 'balanço').resultados.map((d) => d.nome)).toEqual(['BALANÇO 2025.pdf', 'BALANÇO 2024.pdf', 'Balanço 2024.pdf', 'Notas explicativas 2024.pdf']);
  });
  it('acha pela pasta, pela unidade e por data com barra', () => {
    expect(buscar(docs, 'vencidas cnpj').resultados[0].nome).toBe('CNPJ 16/01/2024.pdf');
    expect(buscar(docs, 'nilopolis notas').total).toBe(1);
    expect(buscar(docs, '16/01/2024').total).toBe(1);
  });
  it('filtro por unidade, limite e pesquisa vazia', () => {
    expect(buscar(docs, '2024', { unidade: 'ana-dic' }).total).toBe(1);
    expect(buscar(docs, '2024', { limite: 1 }).resultados).toHaveLength(1);
    expect(buscar(docs, ' ').total).toBe(0);
    expect(palavrasDaBusca('  O balanço, de 2024!  ')).toEqual(['balanco', '2024']);
    expect(palavrasDaBusca('de')).toEqual(['de']);
  });

  const mais = [...docs, ...achatar({ nome: '', pastas: [], documentos: [
    { nome: 'Data base salarial.pdf', tipo: 'pdf', tamanho: 1, atualizado_em: '2026-10-01T00:00:00Z', chave: 'f' },
    { nome: 'ATA da assembleia.pdf', tipo: 'pdf', tamanho: 1, atualizado_em: '2020-01-01T00:00:00Z', chave: 'g' },
    { nome: 'Relatório de Atividades 2024.pdf', tipo: 'pdf', tamanho: 1, atualizado_em: null, chave: 'h' },
    { nome: 'QUALQUER ORIGEM 29.12.2025.pdf', tipo: 'pdf', tamanho: 1, atualizado_em: null, chave: 'i' },
    { nome: '1º Termo Aditivo.pdf', tipo: 'pdf', tamanho: 1, atualizado_em: null, chave: 'j' },
  ] }, { slug: 'ana-oziel', nome: 'Ana Oziel' })];

  it('como as pessoas digitam: "de", datas com ponto, 1o/1º', () => {
    expect(buscar(mais, 'relatorio de 2024').resultados.map((d) => d.nome)).toEqual(['Relatório de Atividades 2024.pdf']);
    expect(buscar(mais, '29/12/2025').resultados.map((d) => d.nome)).toEqual(['QUALQUER ORIGEM 29.12.2025.pdf']);
    expect(buscar(mais, '1o termo').resultados.map((d) => d.nome)).toEqual(['1º Termo Aditivo.pdf']);
  });

  it('"ata" põe as atas antes de "Data" e outros nomes que só contêm as letras', () => {
    const r = buscar(mais, 'ata').resultados.map((d) => d.nome);
    expect(r[0]).toBe('ATA da assembleia.pdf');
    expect(r.indexOf('Data base salarial.pdf')).toBeGreaterThan(0);
  });
});
