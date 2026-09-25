/**
 * Termos que não podem ir para uma vaga publicada (fase 1, tela 32).
 *
 * A vaga não escolhe pessoa por gênero, idade, aparência, estado civil,
 * religião, raça ou gravidez (Lei 9.029/95 e CLT, art. 373-A). A lista é a
 * primeira versão e precisa de validação do jurídico/DPO, como anotado no
 * mockup. O rascunho grava mesmo com o termo; publicar, não.
 *
 * Exceção de propósito: "vaga afirmativa" para PcD e ações afirmativas não
 * entram aqui, porque são permitidas por lei e vêm de um campo próprio.
 */

export interface TermoSensivel {
  /** O que aparece para o RH: por que o trecho barra a publicação. */
  motivo: string;
  padrao: RegExp;
}

export const TERMOS_SENSIVEIS: TermoSensivel[] = [
  { motivo: 'gênero', padrao: /\b(masculin[oa]s?|feminin[oa]s?|sexo)\b/i },
  { motivo: 'gênero', padrao: /\bsomente (homens?|mulher(es)?)\b|\bapenas (homens?|mulher(es)?)\b/i },
  { motivo: 'idade', padrao: /\b(idade (entre|at[ée]|m[áa]xima|m[íi]nima|de))\b|\bat[ée] \d{2} anos\b|\bentre \d{2} e \d{2} anos\b/i },
  { motivo: 'aparência', padrao: /\bboa apar[êe]ncia\b|\baparência agradável\b/i },
  { motivo: 'estado civil', padrao: /\b(solteir[oa]s?|casad[oa]s?|estado civil)\b/i },
  { motivo: 'filhos ou gravidez', padrao: /\bsem filhos\b|\b(gr[áa]vida|gravidez|gestante)\b/i },
  { motivo: 'religião', padrao: /\b(religi[ãa]o|evang[ée]lic[oa]|cat[óo]lic[oa])\b/i },
  { motivo: 'raça ou cor', padrao: /\b(ra[çc]a|cor da pele)\b/i },
];

export interface Achado {
  campo: string;
  trecho: string;
  motivo: string;
}

/** Procura os termos em cada campo de texto. `campos` = { rótulo do campo: texto ou lista }. */
export function procurarTermos(campos: Record<string, string | string[]>): Achado[] {
  const achados: Achado[] = [];
  for (const [campo, valor] of Object.entries(campos)) {
    const textos = Array.isArray(valor) ? valor : [valor];
    for (const texto of textos) {
      for (const t of TERMOS_SENSIVEIS) {
        const m = t.padrao.exec(texto);
        if (m) achados.push({ campo, trecho: m[0], motivo: t.motivo });
      }
    }
  }
  return achados;
}
