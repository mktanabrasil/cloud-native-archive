import type { AppEvent } from '@/types';

/**
 * As duas listas do formulário: parceiros e instituições externas.
 *
 * "Adicionar" cria a linha vazia na hora; se a pessoa esquecia de preencher,
 * gravava assim. Parceiro com tipo e nome em branco é lixo interno;
 * instituição em branco é pior — `external_collaborators` é **público**, e
 * virava um item vazio no card do site. Aqui a validação aponta a linha e a
 * gravação descarta o que ficou em branco, por segurança.
 */

type Listas = Pick<AppEvent, 'partner_involved' | 'partners' | 'has_unit_collaboration' | 'collaborating_units' | 'external_collaborators'>;

const nomeDe = (ext: string | { name: string; details: string }): string => (typeof ext === 'string' ? ext : ext.name);

export function errosDasListas(form: Partial<Listas>): Partial<Record<'partners' | 'external_collaborators', string>> {
  const erros: Partial<Record<'partners' | 'external_collaborators', string>> = {};

  if (form.partner_involved) {
    const parceiros = form.partners || [];
    const preenchidos = parceiros.filter(p => p.name.trim() && p.type);
    if (parceiros.length === 0 || preenchidos.length === 0) {
      erros.partners = 'Adicione ao menos um parceiro, ou desligue “Parceiro envolvido”';
    } else if (preenchidos.length < parceiros.length) {
      erros.partners = 'Preencha tipo e nome de cada parceiro, ou remova a linha em branco';
    }
  }

  if (form.has_unit_collaboration) {
    const unidades = form.collaborating_units || [];
    const externas = form.external_collaborators || [];
    const comNome = externas.filter(e => nomeDe(e).trim());
    if (unidades.length === 0 && comNome.length === 0) {
      erros.external_collaborators = 'Marque uma unidade ou adicione uma instituição, ou desligue a parceria';
    } else if (comNome.length < externas.length) {
      erros.external_collaborators = 'Escreva o nome da instituição, ou remova a linha em branco';
    }
  }

  return erros;
}

/** Tira o que ficou em branco e apara o resto. Não depende da validação ter rodado. */
export function limparListas<T extends Partial<Listas>>(form: T): Pick<Listas, 'partners' | 'external_collaborators'> {
  const partners = (form.partners || [])
    .filter(p => p.name.trim() && p.type)
    .map(p => ({ ...p, name: p.name.trim() }));
  const external_collaborators = (form.external_collaborators || [])
    .filter(e => nomeDe(e).trim())
    .map(e => (typeof e === 'string' ? { name: e.trim(), details: '' } : { name: e.name.trim(), details: (e.details || '').trim() }));
  return { partners, external_collaborators };
}
