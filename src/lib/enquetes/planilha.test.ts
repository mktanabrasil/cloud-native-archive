import { describe, expect, it } from 'vitest';
import { csvDosVotos, nomeDaPlanilha } from './planilha';

const enquete = { opcoes: [
  { id: 'a', titulo: 'Folgar 12/10 e 13/10', subtitulo: '', cor: 'azul' as const },
  { id: 'b', titulo: 'Folgar 15/10; 16/10', subtitulo: '', cor: 'coral' as const },
] };

describe('planilha dos votos', () => {
  it('BOM, ponto e vírgula, título da opção, data em pt-BR e aspas quando precisa', () => {
    const csv = csvDosVotos(enquete, [
      { nome: 'Ana "Paula"', telefone: '(19) 99876-5432', opcao_id: 'b', em: '2026-09-25T13:05:00-03:00', trocou: true },
      { nome: '', telefone: '(19) 3232-1234', opcao_id: 'x', em: '2026-09-25T14:00:00-03:00', trocou: false },
    ]);
    expect(csv.startsWith('﻿')).toBe(true);
    const linhas = csv.slice(1).trimEnd().split('\r\n');
    expect(linhas[0]).toBe('Nome;WhatsApp;Voto;Quando;Trocou o voto');
    expect(linhas[1]).toBe('"Ana ""Paula""";(19) 99876-5432;"Folgar 15/10; 16/10";25/09/2026 13:05;sim');
    expect(linhas[2]).toBe('Sem nome;(19) 3232-1234;(opção removida);25/09/2026 14:00;não');
  });

  it('o rótulo do telefone muda no link público', () => {
    expect(csvDosVotos(enquete, [], 'Final do número')).toContain('Nome;Final do número;Voto');
  });

  it('nome do arquivo com o slug e a data', () => {
    expect(nomeDaPlanilha('qual-folga-voce-prefere', new Date('2026-09-25T10:00:00-03:00'))).toBe('votos-qual-folga-voce-prefere-25-09-2026.csv');
  });
});
