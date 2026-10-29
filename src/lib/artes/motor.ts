import { CAMPOS, FAMILIAS, ROTULO, quantasPlacas, quantosDias, type Familia, type Formato, type Pedido, type Publico } from './modelo';

/**
 * O motor de escolha, sem IA: cada resposta soma ou tira pontos de cada
 * família. O que a arte conta pesa 10; o público ajusta; só digital tira os
 * padrões de parede e papel; plastificar soma placa e cartaz. Empate até 2
 * pontos vira uma pergunta fixa para a gestora. Testado contra 10 artes
 * aprovadas em `motor.test.ts`: mudar um peso é mudar o teste junto.
 */
export interface Regra { f: Familia; p: number; por: string }
export interface Desempate { q: string; sim: Familia; nao: Familia }
export interface Decisao { ordem: { f: Familia; pts: number }[]; log: Regra[]; top: Familia; desempate: Desempate | null; travada: boolean }

const POR_CONTA: Record<string, [Familia, number][]> = {
  evento: [['convite', 10], ['infantil', 6], ['convocacao', 6]], dias: [['cronograma', 10], ['infantil', 5]], regras: [['cartaz', 10], ['placa', 4]],
  placa: [['placa', 10], ['cartaz', 3]], doacao: [['campanha', 10]], ficha: [['ficha', 10]], adesivo: [['adesivo', 10]],
};
const POR_PUBLICO: Record<Publico, [Familia, number][]> = {
  criancas: [['infantil', 6], ['convite', -3], ['convocacao', -10], ['campanha', -5]], equipe: [['convocacao', 8], ['convite', -4], ['infantil', -10]],
  empresas: [['campanha', 6], ['convite', 1], ['infantil', -10]], mulheres: [['convite', 2], ['infantil', -6]], idosos: [['convite', 2], ['infantil', -8]],
  jovens: [['cartaz', 3], ['campanha', 1], ['infantil', -8]], familias: [['convite', 2], ['cronograma', 2], ['convocacao', -10]],
};
const DESEMPATES: Record<string, Desempate> = {
  'convite+convocacao': { q: 'A presença da equipe é obrigatória?', sim: 'convocacao', nao: 'convite' },
  'convite+infantil': { q: 'Quer um tom lúdico, bem infantil?', sim: 'infantil', nao: 'convite' },
  'cartaz+placa': { q: 'É uma frase só por folha?', sim: 'placa', nao: 'cartaz' },
  'cronograma+infantil': { q: 'Quer um tom lúdico, bem infantil?', sim: 'infantil', nao: 'cronograma' },
};

export function decidir(r: Pick<Pedido, 'conta' | 'publico' | 'uso' | 'plastificar'>): Decisao {
  const pontos: Partial<Record<Familia, number>> = {}; const log: Regra[] = [];
  const soma = (f: Familia, p: number, por: string) => { pontos[f] = (pontos[f] ?? 0) + p; log.push({ f, p, por }) };
  (r.conta ? POR_CONTA[r.conta] : []).forEach(([f, p]) => soma(f, p, `Você marcou "${ROTULO[r.conta!]}"`));
  (r.publico ? POR_PUBLICO[r.publico] : []).forEach(([f, p]) => soma(f, p, `Para ${ROTULO[r.publico!]}`));
  if (r.uso === 'digital') ([['placa', -8], ['cartaz', -6], ['ficha', -10], ['adesivo', -10]] as [Familia, number][]).forEach(([f, p]) => soma(f, p, 'Só digital: padrões de parede e papel perdem'));
  if (r.plastificar === 'sim') ([['placa', 4], ['cartaz', 4]] as [Familia, number][]).forEach(([f, p]) => soma(f, p, 'Vai plastificar: é peça de parede'));
  if (r.uso !== 'digital' && r.conta === 'evento') soma('convocacao', -4, 'Impressa: a convocação é peça de WhatsApp');
  const travada = r.conta === 'ficha' || r.conta === 'adesivo';
  const ordem = (Object.keys(FAMILIAS) as Familia[]).map(f => ({ f, pts: pontos[f] ?? 0 })).sort((a, b) => b.pts - a.pts);
  const [top, seg] = ordem;
  let desempate: Desempate | null = null;
  if (!travada && top.pts - seg.pts <= 2 && top.pts > 0) desempate = DESEMPATES[[top.f, seg.f].sort().join('+')] ?? null;
  return { ordem, log, top: top.f, desempate, travada };
}

/** Os formatos que saem, pelo uso, por onde publica e pela família. */
export function formatosPara(familia: Familia, r: Pedido): Formato[] {
  const f = FAMILIAS[familia];
  if (familia === 'ficha' || familia === 'adesivo') return f.formatos;
  const out: Formato[] = [];
  if (r.uso !== 'impressa') {
    const pub = r.publica;
    if (pub.includes('feed') || pub.includes('grupo') || pub.length === 0) out.push('4x5');
    if (pub.includes('story') && f.formatos.includes('story')) out.push('story');
    if (!out.length) out.push('4x5');
  }
  if (r.uso !== 'digital') {
    const imp = f.formatos.filter(x => x.startsWith('a'));
    if (familia === 'infantil' && quantosDias(r) >= 3) out.push('a4p'); else if (imp.length) out.push(imp[0]);
  }
  const ok = out.filter(x => f.formatos.includes(x) || x === '4x5');
  return [...new Set(ok.length ? ok : [f.formatos[0]])];
}

export interface FichaDeImpressao { tamanho: string; copias: number; porFolha: number; folhas: number; plastificar: boolean; pb: boolean; obs: string }
/** O que vai para quem imprime: o tamanho proposto, quantas por folha e quantas folhas. */
export function fichaDeImpressao(familia: Familia, r: Pedido): FichaDeImpressao | null {
  if (r.uso === 'digital' || !r.uso) return null;
  const n = r.copias ?? 1; let tamanho = 'A4 em pé'; let porFolha = 1;
  if (familia === 'placa' || (familia === 'infantil' && quantosDias(r) >= 3)) tamanho = 'A4 deitado';
  if (familia === 'cartaz' && n <= 3) tamanho = 'A4 em pé (A3 opcional)';
  if ((familia === 'convite' || familia === 'infantil') && n >= 20) { tamanho = 'Panfleto · 4 por folha A4 (98×138,6 mm)'; porFolha = 4 }
  if (familia === 'ficha') { tamanho = 'A6 · 4 por folha A4'; porFolha = 4 }
  if (familia === 'adesivo') { tamanho = 'Adesivo 15 por A4 · tag 9 por A4'; porFolha = 15 }
  const placas = familia === 'placa' ? quantasPlacas(r) : 1;
  return { tamanho, copias: n, porFolha, folhas: Math.ceil(n / porFolha) * placas, plastificar: r.plastificar === 'sim', pb: familia === 'ficha' && n >= 10,
    obs: r.plastificar === 'sim' ? 'Imprimir com "Ajustar à área de impressão": a HP corta 4–5 mm.' : '' };
}

/**
 * A frase de apoio no padrão, a partir do que a gestora escreveu solto. Sem
 * IA: um molde por público, três versões. (No app, este botão pode chamar a
 * camada gratuita do Gemini e cair aqui quando a cota acabar.)
 */
export function gerarFrase(info: string, publico: Publico | null, vez: number, titulo = ''): string {
  const tema = (info || '').replace(/\s+/g, ' ').trim().replace(/[.!]+$/, '') || titulo.trim().toLowerCase();
  const t = tema.charAt(0).toLowerCase() + tema.slice(1);
  const T = tema.charAt(0).toUpperCase() + t.slice(1);
  const M: Record<Publico, string[]> = {
    mulheres: [`Uma tarde de conversa, acolhimento e informação sobre ${t}, para cuidar da saúde em todas as fases da vida.`, `Vamos conversar sobre ${t}: um encontro de mulheres, com acolhimento e informação.`, `${T}: conversa, troca e cuidado entre mulheres.`],
    idosos: [`Um dia para celebrar, com carinho e respeito, ${t}.`, `Venha participar: ${t}. Esperamos você!`, `${T}, com muito carinho e alegria.`],
    familias: [`Convidamos as famílias para ${t}. Sua presença é muito importante.`, `Vem com a gente: ${t}. Traga a família!`, `${T}. Contamos com a presença de todos.`],
    criancas: [`${T}: um dia de brincadeiras, surpresas e alegria para as crianças.`, `Vem brincar com a gente: ${t}!`, `Para as crianças: ${t}, com muita diversão.`],
    equipe: [`${T}. Contamos com a sua presença.`, `Reunião da equipe: ${t}. Presença obrigatória.`, `${T}: vamos alinhar juntos.`],
    empresas: [`Ajude a ${t}. Toda contribuição faz diferença.`, `Sua empresa pode ${t}. Fale com a gente.`, `Juntos podemos ${t}.`],
    jovens: [`${T}. Vem com a gente!`, `Para os jovens: ${t}.`, `${T}: participe!`],
  };
  const L = M[publico ?? 'familias']; const max = CAMPOS.apoio.max ?? 120;
  // Passou do limite: tenta as outras versões, da mais curta; em último caso corta na vírgula.
  const cabe = [L[vez % L.length], ...[...L].sort((a, b) => a.length - b.length)].find(x => x.length <= max);
  if (cabe) return cabe;
  const f = L[vez % L.length].slice(0, max - 1);
  const corte = Math.max(f.lastIndexOf(', '), f.lastIndexOf(': '));
  return (corte > max / 2 ? f.slice(0, corte) : f.replace(/\s+\S*$/, '')) + '.';
}

/** O resumo em texto, para o e-mail ao marketing (PR 1: ainda sem fila no banco). */
export function resumoDoPedido(r: Pedido, unidade: string, ficha: FichaDeImpressao | null): string {
  const f = FAMILIAS[r.familia ?? 'convite'];
  const linhas = [`Padrão: ${f.nome}`, `Unidade: ${unidade}`, `Para quem: ${r.publico ? ROTULO[r.publico] : '-'}`, `Conta: ${r.conta ? ROTULO[r.conta] : '-'}`,
    `Uso: ${r.uso ? ROTULO[r.uso] : '-'}${r.publica.length ? ' · publica em ' + r.publica.join(', ') : ''}`,
    ficha ? `Impressão: ${ficha.tamanho} · ${ficha.copias} cópias · ${ficha.folhas} folhas · plastificar: ${ficha.plastificar ? 'sim' : 'não'}${ficha.pb ? ' · PB' : ''}` : 'Impressão: não',
    r.parceiro ? `Parceiro: ${r.parceiro}` : '', r.telefone ? `Telefone: ${r.telefone}` : '', ''];
  for (const k of f.campos) { if (k === 'foto') continue; const v = r.dados[k]; if (!v || (Array.isArray(v) && !v.length)) continue; linhas.push(`${CAMPOS[k].r}: ${Array.isArray(v) ? v.map(x => Array.isArray(x) ? x.filter(Boolean).join(' — ') : x).join(' | ') : v}`) }
  return linhas.filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');
}
