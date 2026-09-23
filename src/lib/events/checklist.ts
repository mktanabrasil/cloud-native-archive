import type { AppEvent } from '@/types';
import { eventUnitLabel } from '@/types';
import { resumoDoTransporte } from './transporte';
import { estadoDaCobertura } from './cobertura';
import { itensDoResumo } from './itens';
import { alimentoEmTexto, limparAlimentos, paraProvidenciar, providenciar, textoDoFornecedor } from './alimentos';
import { lerPedidoDeArte } from './arte';
import { pistaDoEstoque } from './itens';

/**
 * O checklist do evento (22/09/2026, mockup aprovado).
 *
 * Depois de criar, salvar ou enviar, a gestora pode baixar um PDF com o que
 * fazer, montado só do que ela preencheu: transporte vira "confirmar a VAN",
 * alimento que a ANA providencia vira um item, cartaz vira "imprimir N",
 * e assim por diante. Três colunas fixas — Antes, No dia, Depois. O que não
 * foi preenchido não aparece.
 *
 * Aqui é só a lista; o PDF é `checklistPdf.ts`. Separado para o teste
 * conferir as frases sem desenhar nada.
 */
export interface Checklist {
  antes: string[];
  noDia: string[];
  depois: string[];
}

const minuscula = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export function montarChecklist(e: Partial<AppEvent>): Checklist {
  const antes: string[] = [];
  const noDia: string[] = [];
  const depois: string[] = [];

  // Transporte
  const t = resumoDoTransporte(e);
  if (t) {
    const veiculos = [t.veiculo?.label, t.apoio?.label].filter(Boolean).join(' + ');
    const gente = t.total > 0 ? ` para ${t.total} ${t.total === 1 ? 'pessoa' : 'pessoas'}` : '';
    antes.push(veiculos ? `Confirmar ${veiculos}${gente} (frota da ANA)` : `Definir o veículo${gente}`);
    if (t.apoioExterno) antes.push('Acionar a equipe de apoio para transporte de fora da frota');
    if (t.volumosos) noDia.push('Carregar os volumosos no veículo antes de sair');
  }

  // Alimentação
  const refeicoes = itensDoResumo(e.food_items);
  const prov = paraProvidenciar(refeicoes);
  if (prov.length > 0) antes.push(`Providenciar: ${prov.map(p => alimentoEmTexto(p.alimento)).join(', ')}`);
  const porFornecedor = new Map<string, string[]>();
  for (const r of refeicoes) {
    for (const a of limparAlimentos(r.alimentos)) {
      if (providenciar(a)) continue;
      const quem = textoDoFornecedor(a);
      porFornecedor.set(quem, [...(porFornecedor.get(quem) ?? []), a.quantidade ? `${a.nome}, ${a.quantidade}` : a.nome]);
    }
  }
  for (const [quem, lista] of porFornecedor) antes.push(`Confirmar com ${quem}: ${lista.join('; ')}`);
  for (const r of refeicoes) {
    const alimentos = limparAlimentos(r.alimentos);
    if (alimentos.length === 0 && !r.cardapio && !r.detalhes) continue;
    const cardapio = r.cardapio ? ` (cardápio: ${r.cardapio})` : r.detalhes && alimentos.length === 0 ? ` (${r.detalhes})` : '';
    noDia.push(`Receber e servir ${minuscula(r.item)}${cardapio}`);
  }
  if (e.food_details?.trim()) noDia.push(`Atenção à comida: ${e.food_details.trim()}`);

  // Equipamentos
  const equipamentos = itensDoResumo(e.equipment_items);
  if (equipamentos.length > 0) {
    const nomes = equipamentos.map(i => {
      const pista = pistaDoEstoque(i.item);
      return `${minuscula(i.item)}${pista ? ` (${pista})` : ''}${i.detalhes ? ` — ${i.detalhes}` : ''}`;
    });
    antes.push(`Reservar ${nomes.join(', ')}`);
    noDia.push(`Montar e testar ${equipamentos.map(i => minuscula(i.item)).join(', ')} antes de começar`);
    noDia.push('Recolher os equipamentos ao fim');
    depois.push('Devolver os equipamentos');
  }

  // Marketing
  if (e.marketing_request) {
    const cobertura = estadoDaCobertura(e);
    if (cobertura !== 'nao-pedida') {
      noDia.push(
        cobertura === 'confirmada'
          ? 'Registrar com fotos e vídeos pelo celular (a unidade registra, mesmo com o marketing presente)'
          : 'Registrar com fotos e vídeos pelo celular (o registro é da unidade)',
      );
      depois.push('Mandar as fotos e os vídeos para o marketing');
    }
    const arte = lerPedidoDeArte(e.marketing_items);
    if (arte.whatsapp) antes.push('Receber a arte do marketing e mandar nos grupos das famílias');
    if (arte.cartaz) antes.push(`Imprimir ${arte.quantidade ? `${arte.quantidade} ${arte.quantidade === 1 ? 'cartaz' : 'cartazes'}` : 'os cartazes'} A4 e plastificar`);
    if (arte.cartaz) noDia.push('Colar os cartazes na unidade');
  }

  // Parcerias
  const parceiros = (e.partners ?? []).filter(p => p.name?.trim());
  for (const p of parceiros) antes.push(`Confirmar com ${p.name.trim()} (parceiro)`);
  const externos = (e.external_collaborators ?? []).map(c => (typeof c === 'string' ? c : c?.name)).filter((n): n is string => !!n?.trim());
  for (const n of externos) antes.push(`Confirmar com ${n.trim()} (instituição)`);
  if ((e.collaborating_units ?? []).length > 0) antes.push(`Alinhar com ${e.collaborating_units!.map(u => eventUnitLabel(u)).join(', ')}`);

  // Público e equipe
  if (e.target_audience && e.target_audience !== 'Os funcionários') antes.push('Avisar as famílias do dia e do horário');
  if (e.support_team) antes.push(`Confirmar quem ajuda no dia: ${minuscula(e.support_team)}`);
  if (e.target_audience && /atendidos|comunidade/i.test(e.target_audience)) noDia.push('Lista de presença');

  depois.push('Registrar no relatório da unidade');

  return { antes, noDia, depois };
}

/** Quantos itens, para o texto do botão. */
export const tamanhoDoChecklist = (c: Checklist): number => c.antes.length + c.noDia.length + c.depois.length;

/**
 * As linhas curtas do pop-up: "Transporte · VAN · 12 pessoas", só do que foi
 * preenchido.
 */
export function resumoDoEvento(e: Partial<AppEvent>): Array<[string, string]> {
  const linhas: Array<[string, string]> = [];
  const t = resumoDoTransporte(e);
  if (t) linhas.push(['Transporte', t.texto]);
  const refeicoes = itensDoResumo(e.food_items);
  if (refeicoes.length > 0) {
    const prov = paraProvidenciar(refeicoes).length;
    linhas.push(['Alimentação', `${refeicoes.map(r => minuscula(r.item)).join(', ')}${prov ? ` · ${prov} a providenciar` : ''}`]);
  }
  const equipamentos = itensDoResumo(e.equipment_items);
  if (equipamentos.length > 0) linhas.push(['Equipamentos', equipamentos.map(i => minuscula(i.item)).join(', ')]);
  if (e.marketing_request) {
    const partes: string[] = [];
    if (estadoDaCobertura(e) !== 'nao-pedida') partes.push('cobertura');
    const arte = lerPedidoDeArte(e.marketing_items);
    if (arte.whatsapp) partes.push('arte WhatsApp');
    if (arte.cartaz) partes.push(arte.quantidade ? `${arte.quantidade} cartazes` : 'cartaz');
    if (partes.length) linhas.push(['Marketing', partes.join(' + ')]);
  }
  return linhas;
}
