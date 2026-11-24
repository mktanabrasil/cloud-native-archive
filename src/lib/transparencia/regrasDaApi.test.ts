import { describe, expect, it } from 'vitest';
import {
  mostraNaTela, quedaSuspeita, chaveDe, compararNomes, contar, ehChave, ehFinalizada, grupoDa, nomeDaUnidade, nomeParaBaixar, ordemDa, ordenar, slugDe, slugLivre, tipoDo,
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
