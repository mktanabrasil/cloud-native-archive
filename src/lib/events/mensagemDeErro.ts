/**
 * Traduz a recusa do banco numa frase que diz o que fazer.
 *
 * Antes, toda falha de gravação virava "Erro ao adicionar evento" — sem
 * permissão, link duplicado, campo obrigatório vazio, rede caída, tudo igual.
 * A pessoa não sabia se tentava de novo, mudava algo ou chamava alguém.
 *
 * Os códigos são os do Postgres, que o PostgREST repassa em `error.code`:
 *   42501  permissão negada (inclui RLS: "new row violates row-level security")
 *   23505  chave única violada — para nós, quase sempre o `slug`
 *   23502  NOT NULL
 *   23514  CHECK (a unidade fora das quatro, por exemplo)
 * Rede caída não tem código: chega como `TypeError: Failed to fetch`.
 */

export type TipoDeErro = 'permissao' | 'slug' | 'duplicado' | 'obrigatorio' | 'invalido' | 'rede' | 'desconhecido';

export interface ErroDescrito {
  tipo: TipoDeErro;
  titulo: string;
  descricao: string;
}

interface ErroDoBanco {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
  name?: string;
}

const texto = (e: ErroDoBanco) => `${e.message ?? ''} ${e.details ?? ''} ${e.hint ?? ''}`;

/** Nome da coluna em "null value in column "location" of relation…". */
const colunaDe = (s: string) => s.match(/column "([^"]+)"/)?.[1];

const NOMES: Record<string, string> = {
  title: 'Título',
  location: 'Localização',
  start_datetime: 'Início',
  end_datetime: 'Término',
  unit: 'Unidade',
  event_type: 'Tipo',
  status: 'Status',
};

export function descreverErroDeGravacao(
  erro: unknown,
  contexto: { acao: 'criar' | 'atualizar'; unidade?: string; slug?: string | null },
): ErroDescrito {
  const e = (erro ?? {}) as ErroDoBanco;
  const msg = texto(e);
  const acao = contexto.acao === 'criar' ? 'criar' : 'salvar';

  if (e.code === '42501' || /row-level security|permission denied/i.test(msg)) {
    return {
      tipo: 'permissao',
      titulo: contexto.unidade
        ? `Sem permissão para gravar em ${contexto.unidade}`
        : 'Sem permissão para gravar este evento',
      descricao: 'Seu acesso aqui é de leitura. Nada foi perdido — peça à administração geral para liberar.',
    };
  }

  if (e.code === '23505') {
    if (/slug/i.test(msg)) {
      return {
        tipo: 'slug',
        titulo: contexto.slug ? `O link “${contexto.slug}” já é de outro evento` : 'Este link já é de outro evento',
        descricao: 'Vamos ajustar o link e tentar de novo.',
      };
    }
    return {
      tipo: 'duplicado',
      titulo: 'Já existe um evento igual a este',
      descricao: 'Confira se ele não foi gravado antes, ou mude o que o diferencia.',
    };
  }

  if (e.code === '23502') {
    const coluna = colunaDe(msg);
    const nome = (coluna && NOMES[coluna]) || coluna;
    return {
      tipo: 'obrigatorio',
      titulo: nome ? `Falta preencher ${nome}` : 'Falta um campo obrigatório',
      descricao: 'O banco exige este campo. Preencha e tente de novo.',
    };
  }

  if (e.code === '23514') {
    return {
      tipo: 'invalido',
      titulo: 'Um valor não é aceito pelo banco',
      descricao: 'Confira Unidade, Tipo e Status e tente de novo.',
    };
  }

  if (e.name === 'TypeError' || /failed to fetch|network|networkerror|load failed/i.test(msg)) {
    return {
      tipo: 'rede',
      titulo: 'Sem conexão',
      descricao: `Nada foi perdido. Verifique a internet e tente ${acao} de novo.`,
    };
  }

  return {
    tipo: 'desconhecido',
    titulo: contexto.acao === 'criar' ? 'Não foi possível criar o evento' : 'Não foi possível salvar as alterações',
    descricao: e.message ? e.message.slice(0, 160) : 'Tente de novo. Se continuar, avise a administração.',
  };
}
