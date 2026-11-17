import { describe, expect, it } from 'vitest';
import {
  diaComSemana as diaDoEmail, emailDaDevolutiva, emailDoEnvio, nomeDaUnidade, periodoDoAssunto,
  periodoPorExtenso as periodoDoEmail, prazoDaDevolutiva as prazoDoEmail, quando, type SemanarioDoEmail,
} from '../../../supabase/functions/semanario-aviso/email';
import { diaComSemana, periodoPorExtenso, prazoDaDevolutiva, somarDias } from './regras';

/**
 * Os e-mails do Semanário (PR 6, 17/11/2026): o texto é montado na função
 * `semanario-aviso`, mas as contas de data têm de bater com as do app.
 */
const SITE = 'https://app.anabrasil.org';
const dia = { projeto: 'Identidade', proposta: 'Roda', objetivo: 'Conversar', desenvolvimento: 'Em roda' };
const base: SemanarioDoEmail = {
  id: '0b6c1f8e-2a51-4c7e-9f0a-1d2e3f4a5b6c', professora_nome: 'Marina Souza', unidade: 'Anísio', semana: '2026-11-23',
  agrupamento: 'AG I B', dias: { seg: dia, ter: dia, qua: dia, qui: { ...dia, objetivo: '' } },
  enviado_em: '2026-11-18T19:20:00Z', devolutiva: null, devolutiva_por: null, devolutiva_em: null,
};

describe('as datas do e-mail batem com as do app', () => {
  it('período, prazo e dia da semana, inclusive na virada de mês e de ano', () => {
    let semana = '2026-11-02';
    for (let i = 0; i < 70; i++, semana = somarDias(semana, 7)) {
      expect(periodoDoEmail(semana)).toBe(periodoPorExtenso(semana));
      expect(prazoDoEmail(semana)).toBe(prazoDaDevolutiva(semana));
      expect(diaDoEmail(prazoDoEmail(semana))).toBe(diaComSemana(prazoDaDevolutiva(semana)));
    }
  });
  it('assunto curto: "23 a 27/11"; virando o mês, "30/11 a 04/12"', () => {
    expect(periodoDoAssunto('2026-11-23')).toBe('23 a 27/11');
    expect(periodoDoAssunto('2026-11-30')).toBe('30/11 a 04/12');
  });
  it('a hora no fuso de Brasília', () => {
    expect(quando('2026-11-18T19:20:00Z')).toBe('quarta, 18/11 às 16:20');
    expect(quando('2026-11-19T13:05:00Z')).toBe('quinta, 19/11 às 10:05');
  });
});

describe('o e-mail do envio (para a orientadora)', () => {
  const m = emailDoEnvio(base, SITE);
  it('assunto, link e prazo da devolutiva', () => {
    expect(m.assunto).toBe('Semanário enviado: Marina Souza · AG I B · 23 a 27/11');
    expect(m.html).toContain(`${SITE}/educacao/semanario/${base.id}`);
    expect(m.texto).toContain(`Abrir e revisar o semanário: ${SITE}/educacao/semanario/${base.id}`);
    expect(m.texto).toContain('Devolutiva até: quinta, 19/11');
    expect(m.texto).toContain('Enviado em: quarta, 18/11 às 16:20');
    expect(m.html).toContain('CEI Anísio · AG I B');
  });
  it('os dias completos (a quinta tem campo vazio)', () => {
    expect(m.texto).toContain('Dias completos: 3 de 5');
    expect(m.html.match(/background:#d9f3ec/g)).toHaveLength(3);
  });
  it('o GOE não vira "CEI GOE"; agrupamento vazio aparece como tal', () => {
    expect(nomeDaUnidade('GOE')).toBe('GOE');
    const goe = emailDoEnvio({ ...base, unidade: 'GOE', agrupamento: '  ' }, SITE);
    expect(goe.html).toContain('GOE · Sem agrupamento');
    expect(goe.html).not.toContain('CEI GOE');
  });
  it('o nome da professora não vira HTML', () => {
    const x = emailDoEnvio({ ...base, professora_nome: '<b>Ana</b> & Cia' }, SITE);
    expect(x.html).not.toContain('<b>Ana</b>');
    expect(x.html).toContain('&lt;b&gt;Ana&lt;/b&gt; &amp; Cia');
  });
});

describe('o e-mail da devolutiva (para a professora)', () => {
  const comDevolutiva = { ...base, devolutiva: 'Muito bom!\n<script>x</script>', devolutiva_por: 'Orientação CEI Anísio', devolutiva_em: '2026-11-19T13:05:00Z' };
  it('o texto da devolutiva vai inteiro, escapado, com as quebras de linha', () => {
    const m = emailDaDevolutiva(comDevolutiva, SITE);
    expect(m.assunto).toBe('Devolutiva do semanário · AG I B · 23 a 27/11');
    expect(m.html).toContain('Muito bom!<br>&lt;script&gt;x&lt;/script&gt;');
    expect(m.html).not.toContain('<script>');
    expect(m.texto).toContain('Devolutiva de: Orientação CEI Anísio, em quinta, 19/11 às 10:05');
    expect(m.texto).toContain(`Abrir o semanário: ${SITE}/educacao/semanario/${base.id}`);
  });
  it('reescrita: assunto e selo de "atualizada"', () => {
    const m = emailDaDevolutiva(comDevolutiva, SITE, true);
    expect(m.assunto).toBe('Devolutiva atualizada · AG I B · 23 a 27/11');
    expect(m.html).toContain('atualizou a devolutiva');
  });
});
