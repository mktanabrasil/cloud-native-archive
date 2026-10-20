import { supabase } from '@/integrations/supabase/client';

/**
 * A auditoria do Trabalhe Conosco (passo 6 do roteiro, decisões de
 * 20/10/2026): quem abriu ficha ou currículo, quem baixou a planilha com
 * dados pessoais, quem moveu candidatos, enviou mensagens, nomeou
 * responsáveis e mexeu em vagas. Só administradores leem; ninguém altera nem
 * apaga (o banco recusa). Mover, mensagens e vagas o banco registra sozinho;
 * abrir e baixar, o app avisa por `registrarAcesso`.
 */

export type AcaoDoApp = 'ficha.aberta' | 'curriculo.aberto' | 'planilha.baixada';

/** Avisa o banco; nunca segura a tela (se falhar, a pessoa segue). */
export async function registrarAcesso(acao: AcaoDoApp, alvo: { candidatura?: string; vaga?: string; detalhe?: string }): Promise<void> {
  try {
    await supabase.rpc('registrar_acesso', { p_acao: acao, p_candidatura: alvo.candidatura, p_vaga: alvo.vaga, p_detalhe: alvo.detalhe });
  } catch { /* segue */ }
}

export interface Registro {
  id: number;
  em: string;
  quem: string | null;
  quem_nome: string | null;
  papel: string | null;
  acao: string;
  candidatura_id: string | null;
  protocolo: string | null;
  vaga_id: string | null;
  vaga_titulo: string | null;
  detalhe: string | null;
}

export interface FiltrosDaAuditoria { dias: number; quem: string | null; tipo: TipoDeRegistro | null }

/** Os tipos do filtro, cada um juntando as ações parecidas. */
export const TIPOS_DE_REGISTRO = {
  dados: { rotulo: 'Acesso a dados', acoes: ['ficha.aberta', 'curriculo.aberto', 'planilha.baixada'] },
  candidatos: { rotulo: 'Candidatos', acoes: ['candidato.movido', 'mensagem.enviada'] },
  vagas: { rotulo: 'Vagas', acoes: ['vaga.criada', 'vaga.editada', 'vaga.status', 'vaga.apagada', 'responsavel.nomeado'] },
} as const;
export type TipoDeRegistro = keyof typeof TIPOS_DE_REGISTRO;

export const LIMITE_DA_LISTA = 500;

export async function listarAuditoria(f: FiltrosDaAuditoria, agora = Date.now()): Promise<Registro[]> {
  let q = supabase.from('vagas_auditoria').select('*').gte('em', new Date(agora - f.dias * 864e5).toISOString())
    .neq('acao', 'alerta.conferido').order('em', { ascending: false }).limit(LIMITE_DA_LISTA);
  if (f.quem) q = q.eq('quem', f.quem);
  if (f.tipo) q = q.in('acao', [...TIPOS_DE_REGISTRO[f.tipo].acoes]);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Registro[];
}

export interface Alerta { quem: string; quem_nome: string | null; hora: string; quantidade: number; media_por_dia: number | null; vagas: string | null; conferido: boolean }

export async function alertasDaAuditoria(dias = 30): Promise<Alerta[]> {
  const { data, error } = await supabase.rpc('alertas_da_auditoria', { p_dias: dias });
  if (error) throw error;
  return (data ?? []) as Alerta[];
}

export async function conferirAlerta(a: Pick<Alerta, 'quem' | 'hora'>): Promise<void> {
  const { error } = await supabase.rpc('conferir_alerta', { p_quem: a.quem, p_hora: a.hora });
  if (error) throw error;
}

const etapa: Record<string, string> = { recebida: 'Recebida', analise: 'Análise', entrevista: 'Entrevista', resultado: 'Resultado', 'resultado:aprovado': 'Aprovado', 'resultado:nao_selecionado': 'Não selecionado' };
const mensagem: Record<string, string> = { convite: 'convite para entrevista', pergunta: 'pergunta', recado: 'mensagem' };
const status: Record<string, string> = { rascunho: 'rascunho', revisao: 'revisão', publicada: 'publicada', pausada: 'pausada', encerrada: 'encerrada', arquivada: 'arquivada' };

/** A frase de cada registro ("Abriu o currículo", "Moveu Análise → Entrevista"…). */
export function textoDoRegistro(r: Pick<Registro, 'acao' | 'detalhe'>): string {
  const d = r.detalhe ?? '';
  switch (r.acao) {
    case 'ficha.aberta': return 'Abriu a ficha';
    case 'curriculo.aberto': return 'Abriu o currículo';
    case 'planilha.baixada': return `Baixou a planilha de candidatos${d ? ` (${d})` : ''}`;
    case 'candidato.movido': return `Moveu ${d.split(' → ').map((m) => etapa[m] ?? m).join(' → ')}`;
    case 'mensagem.enviada': return `Enviou ${mensagem[d] ?? 'mensagem'}`;
    case 'vaga.criada': return 'Criou a vaga';
    case 'vaga.editada': return `Editou a vaga (${d})`;
    case 'vaga.status': return `Mudou a vaga: ${d.split(' → ').map((s) => status[s] ?? s).join(' → ')}`;
    case 'vaga.apagada': return 'Apagou a vaga';
    case 'responsavel.nomeado': return d === 'sem responsável' ? 'Tirou o responsável' : `Nomeou responsável: ${d}`;
    default: return r.acao;
  }
}

/** Ações que mexem com dados pessoais de candidatos (ganham o selo). */
export const tocaDadosPessoais = (acao: string) => acao === 'planilha.baixada';

export const ROTULO_DO_PAPEL: Record<string, string> = { admin: 'administrador', rh: 'RH', responsavel: 'responsável', sistema: 'sistema' };

export interface RegistroAgrupado extends Registro { vezes: number; ate: string }

/**
 * Junta aberturas seguidas da mesma pessoa, mesma ação e mesma vaga com até
 * 15 min entre uma e outra ("Abriu o currículo ×40", 22:10–22:20). A lista
 * vem do mais novo para o mais antigo.
 */
export function agruparSeguidos(lista: Registro[]): RegistroAgrupado[] {
  const out: RegistroAgrupado[] = [];
  for (const r of lista) {
    const ult = out[out.length - 1];
    const junta = ult && (r.acao === 'ficha.aberta' || r.acao === 'curriculo.aberto')
      && ult.acao === r.acao && ult.quem === r.quem && ult.vaga_id === r.vaga_id
      && new Date(ult.em).getTime() - new Date(r.em).getTime() <= 15 * 60e3;
    if (junta) { ult.vezes++; ult.em = r.em; ult.protocolo = ult.protocolo === r.protocolo ? ult.protocolo : null; }
    else out.push({ ...r, vezes: 1, ate: r.em });
  }
  return out;
}
