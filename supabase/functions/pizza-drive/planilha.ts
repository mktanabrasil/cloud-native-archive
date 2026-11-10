/**
 * Pizza da Alegria (10/11/2026): a planilha "Pizza da Alegria 2026 · Pedidos".
 *
 * Fica na pasta da campanha no Drive (a mesma dos PDFs) e só tem a tabela dos
 * pedidos, nas cores da ANA. É só de leitura: a cada mudança a aba Pedidos é
 * reescrita inteira a partir do banco (o gatilho de pizza_confirmacoes marca
 * pizza_planilha.pendente). Abas que a equipe criar ficam intocadas.
 *
 * A primeira chamada cria a planilha e aplica o desenho (cores, larguras,
 * filtro, etiquetas coloridas por regra condicional); as seguintes só trocam
 * os valores. Mockup aprovado: https://claude.ai/artifact/41wgaj3mM5yXTcrXmwSMwB
 */

// deno-lint-ignore no-explicit-any
type Admin = any;

export interface Auxiliares {
  sabores: Record<string, string>;
  formas: Record<string, string>;
  areas: Record<string, string>;
  formaDoMercadoPago: (tipo: string | null | undefined, bandeira: string | null | undefined) => string;
}

export const NOME_DA_PLANILHA = 'Pizza da Alegria 2026 · Pedidos';
const ABA = 'Pedidos';
/** Linhas: 1 título, 2 fio de cores, 3 cabeçalho, 4 em diante os pedidos e, no fim, o total. */
const PRIMEIRA = 4;
const LINHAS_DA_GRADE = 3000;
const ORDEM_DOS_SABORES = ['marguerita', 'frango', 'calabresa', 'mucarela', 'lombo', 'napolitana'];
const COLUNAS = ['Nº', 'Pedido em', 'Nome', 'Unidade', 'Área', 'Marguerita', 'Frango', 'Calabresa', 'Muçarela', 'Lombo', 'Napolitana', 'Pizzas', 'Valor', 'Pagamento', 'Código da operação', 'Retirada', 'Retirada em'];
const LARGURAS = [92, 130, 230, 290, 90, 96, 80, 96, 92, 76, 100, 72, 108, 220, 250, 118, 130];
const N = COLUNAS.length; // 17: A a Q
const COL = { valor: 12, pagamento: 13, retirada: 15 };
export const RETIRADA_SIM = '✓ Retirada';
export const RETIRADA_NAO = 'A retirar';

class ErroPlanilha extends Error { constructor(public status: number, msg: string) { super(msg); } }

async function g(token: string, metodo: string, url: string, corpo?: unknown) {
  const r = await fetch(url, {
    method: metodo,
    headers: { Authorization: `Bearer ${token}`, ...(corpo ? { 'Content-Type': 'application/json' } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  if (r.status === 204) return null;
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new ErroPlanilha(r.status, `Planilha ${r.status}: ${j?.error?.message || JSON.stringify(j).slice(0, 200)}`);
  return j;
}

// --- Cores ----------------------------------------------------------------------------------

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return { red: ((n >> 16) & 255) / 255, green: ((n >> 8) & 255) / 255, blue: (n & 255) / 255 };
};
const C = {
  marrom: '#6B2E1C', creme: '#F4E7D2', vermelho: '#D8463A', vermelhoEsc: '#A9322A', coral: '#F37964',
  tinta: '#2B1A14', zebra: '#FFF8EE', branco: '#FFFFFF', apagado: '#C9BBAA',
  pixBg: '#DDF3EE', pixTx: '#12695A', cartaoBg: '#DCEEFA', cartaoTx: '#0A5E8E', unidBg: '#FFF1BF', unidTx: '#7A5A00',
  retBg: '#D4F5EC', retTx: '#12695A',
};
/** O fio de cinco cores da ANA, em blocos de colunas (A-D, E-G, H-K, L-N, O-Q). */
const FIO: Array<[number, number, string]> = [[0, 4, '#F5DFBB'], [4, 7, '#FBCE00'], [7, 11, '#F37964'], [11, 14, '#81E2CF'], [14, 17, '#01ADFF']];

// --- Desenho (só na criação) ----------------------------------------------------------------

function desenho(aba: number) {
  const faixa = (r0: number, r1: number, c0 = 0, c1 = N) => ({ sheetId: aba, startRowIndex: r0, endRowIndex: r1, startColumnIndex: c0, endColumnIndex: c1 });
  const corpo = (c0 = 0, c1 = N) => faixa(PRIMEIRA - 1, LINHAS_DA_GRADE, c0, c1);
  // fundo null: a regra só muda o texto e o fundo da zebra continua.
  const regra = (ranges: unknown[], condicao: unknown, fundo: string | null, texto: string, negrito = false) => ({
    addConditionalFormatRule: { index: 0, rule: { ranges, booleanRule: { condition: condicao, format: { ...(fundo ? { backgroundColor: rgb(fundo) } : {}), textFormat: { foregroundColor: rgb(texto), bold: negrito } } } } },
  });
  const pedidos: unknown[] = [
    { updateSpreadsheetProperties: { properties: { title: NOME_DA_PLANILHA, locale: 'pt_BR', timeZone: 'America/Sao_Paulo', defaultFormat: { textFormat: { fontFamily: 'Poppins', fontSize: 10 } } }, fields: 'title,locale,timeZone,defaultFormat.textFormat' } },
    // Só as 3 linhas do topo ficam presas. Coluna presa não dá: o Sheets não junta o título (A1:Q1)
    // atravessando coluna presa e solta (erro 400 no mergeCells, 10/11/2026).
    { updateSheetProperties: { properties: { sheetId: aba, title: ABA, tabColorStyle: { rgbColor: rgb(C.vermelho) }, gridProperties: { rowCount: LINHAS_DA_GRADE, columnCount: N, frozenRowCount: 3, frozenColumnCount: 0 } }, fields: 'title,tabColorStyle,gridProperties(rowCount,columnCount,frozenRowCount,frozenColumnCount)' } },
    // Larguras e alturas
    ...LARGURAS.map((px, i) => ({ updateDimensionProperties: { range: { sheetId: aba, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 }, properties: { pixelSize: px }, fields: 'pixelSize' } })),
    { updateDimensionProperties: { range: { sheetId: aba, dimension: 'ROWS', startIndex: 0, endIndex: 1 }, properties: { pixelSize: 48 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId: aba, dimension: 'ROWS', startIndex: 1, endIndex: 2 }, properties: { pixelSize: 6 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId: aba, dimension: 'ROWS', startIndex: 2, endIndex: 3 }, properties: { pixelSize: 36 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId: aba, dimension: 'ROWS', startIndex: PRIMEIRA - 1, endIndex: LINHAS_DA_GRADE }, properties: { pixelSize: 28 }, fields: 'pixelSize' } },
    // Título: faixa marrom, texto creme
    { mergeCells: { range: faixa(0, 1), mergeType: 'MERGE_ALL' } },
    { repeatCell: { range: faixa(0, 1), cell: { userEnteredFormat: { backgroundColor: rgb(C.marrom), verticalAlignment: 'MIDDLE', padding: { left: 14 }, textFormat: { foregroundColor: rgb(C.creme), bold: true, fontSize: 14 } } }, fields: 'userEnteredFormat(backgroundColor,verticalAlignment,padding,textFormat)' } },
    // Fio de cores
    ...FIO.map(([c0, c1, cor]) => ({ repeatCell: { range: faixa(1, 2, c0, c1), cell: { userEnteredFormat: { backgroundColor: rgb(cor) } }, fields: 'userEnteredFormat.backgroundColor' } })),
    // Cabeçalho: vermelho; os sabores em coral
    { repeatCell: { range: faixa(2, 3), cell: { userEnteredFormat: { backgroundColor: rgb(C.vermelho), verticalAlignment: 'MIDDLE', wrapStrategy: 'CLIP', textFormat: { foregroundColor: rgb(C.branco), bold: true } } }, fields: 'userEnteredFormat(backgroundColor,verticalAlignment,wrapStrategy,textFormat)' } },
    { repeatCell: { range: faixa(2, 3, 5, 11), cell: { userEnteredFormat: { backgroundColor: rgb(C.coral), horizontalAlignment: 'CENTER', textFormat: { foregroundColor: rgb(C.tinta), bold: true } } }, fields: 'userEnteredFormat(backgroundColor,horizontalAlignment,textFormat)' } },
    { repeatCell: { range: faixa(2, 3, COL.valor, COL.valor + 1), cell: { userEnteredFormat: { horizontalAlignment: 'RIGHT' } }, fields: 'userEnteredFormat.horizontalAlignment' } },
    // Corpo
    { repeatCell: { range: corpo(), cell: { userEnteredFormat: { verticalAlignment: 'MIDDLE', wrapStrategy: 'CLIP' } }, fields: 'userEnteredFormat(verticalAlignment,wrapStrategy)' } },
    { repeatCell: { range: corpo(0, 1), cell: { userEnteredFormat: { textFormat: { foregroundColor: rgb(C.vermelhoEsc), bold: true } } }, fields: 'userEnteredFormat.textFormat' } },
    { repeatCell: { range: corpo(5, 12), cell: { userEnteredFormat: { horizontalAlignment: 'CENTER', textFormat: { bold: true } } }, fields: 'userEnteredFormat(horizontalAlignment,textFormat)' } },
    { repeatCell: { range: corpo(COL.valor, COL.valor + 1), cell: { userEnteredFormat: { horizontalAlignment: 'RIGHT', numberFormat: { type: 'CURRENCY', pattern: '"R$" #,##0.00' } } }, fields: 'userEnteredFormat(horizontalAlignment,numberFormat)' } },
    { repeatCell: { range: corpo(COL.pagamento, COL.pagamento + 1), cell: { userEnteredFormat: { horizontalAlignment: 'CENTER' } }, fields: 'userEnteredFormat.horizontalAlignment' } },
    { repeatCell: { range: corpo(COL.retirada, COL.retirada + 1), cell: { userEnteredFormat: { horizontalAlignment: 'CENTER' } }, fields: 'userEnteredFormat.horizontalAlignment' } },
    // Filtro em cada coluna do cabeçalho
    { setBasicFilter: { filter: { range: faixa(2, LINHAS_DA_GRADE) } } },
    // Só de leitura: o Sheets avisa antes de alguém editar a aba
    { addProtectedRange: { protectedRange: { range: { sheetId: aba }, description: 'Esta aba é reescrita pelo app a cada pedido e retirada. Edições aqui se perdem; crie uma aba nova para anotar.', warningOnly: true } } },
    // Zebra pelas linhas alternadas do próprio Sheets, sem fórmula: a planilha é pt_BR e lá as
    // fórmulas separam com ";" (a regra com AND(…,…) deu 400, 10/11/2026).
    { addBanding: { bandedRange: { range: corpo(), rowProperties: { firstBandColorStyle: { rgbColor: rgb(C.branco) }, secondBandColorStyle: { rgbColor: rgb(C.zebra) } } } } },
  ];
  // Regras condicionais (a de índice 0 vale primeiro: a última adicionada fica no topo).
  pedidos.push(
    // O zero dos sabores fica apagado; só a cor do texto muda, a zebra continua.
    regra([corpo(5, 11)], { type: 'NUMBER_EQ', values: [{ userEnteredValue: '0' }] }, null, C.apagado),
    regra([corpo(COL.pagamento, COL.pagamento + 1)], { type: 'TEXT_STARTS_WITH', values: [{ userEnteredValue: 'Na unidade' }] }, C.unidBg, C.unidTx),
    regra([corpo(COL.pagamento, COL.pagamento + 1)], { type: 'TEXT_STARTS_WITH', values: [{ userEnteredValue: 'Cartão' }] }, C.cartaoBg, C.cartaoTx),
    regra([corpo(COL.pagamento, COL.pagamento + 1)], { type: 'TEXT_STARTS_WITH', values: [{ userEnteredValue: 'Pix' }] }, C.pixBg, C.pixTx),
    regra([corpo(COL.retirada, COL.retirada + 1)], { type: 'TEXT_EQ', values: [{ userEnteredValue: RETIRADA_NAO }] }, C.creme, C.marrom),
    regra([corpo(COL.retirada, COL.retirada + 1)], { type: 'TEXT_EQ', values: [{ userEnteredValue: RETIRADA_SIM }] }, C.retBg, C.retTx, true),
    regra([corpo()], { type: 'CUSTOM_FORMULA', values: [{ userEnteredValue: `=$A${PRIMEIRA}="Total"` }] }, C.creme, C.marrom, true),
  );
  return pedidos;
}

// --- Conteúdo ---------------------------------------------------------------------------------

const dataHora = (iso: string | null) => {
  if (!iso) return '';
  const p = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(iso));
  const v = (t: string) => p.find((x) => x.type === t)?.value ?? '';
  return `${v('day')}/${v('month')}/${v('year')} ${v('hour')}:${v('minute')}`;
};
const reais = (n: number) => 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// deno-lint-ignore no-explicit-any
export function linhasDaPlanilha(lista: any[], aux: Auxiliares, agora: string) {
  const somaSab = ORDEM_DOS_SABORES.map(() => 0);
  let pizzas = 0, valor = 0, retirados = 0;
  const linhas = lista.map((c) => {
    const q = ORDEM_DOS_SABORES.map((k, i) => { const n = Number(c.sabores?.[k] ?? 0); somaSab[i] += n; return n; });
    const online = c.forma === 'mercado_pago';
    const pagamento = online ? aux.formaDoMercadoPago(c.mp_forma, c.mp_bandeira) : `Na unidade · ${aux.formas[c.forma] ?? c.forma}`;
    pizzas += Number(c.quantidade); valor += Number(c.total); if (c.retirada) retirados++;
    return [
      c.numero, dataHora(c.created_at), c.nome, c.unidade_nome, aux.areas[c.area] ?? c.area, ...q,
      Number(c.quantidade), Number(c.total), pagamento, c.mp_pagamento_id ?? '—',
      c.retirada ? RETIRADA_SIM : RETIRADA_NAO, dataHora(c.retirada_em),
    ];
  });
  const pedidos = lista.length;
  const total = ['Total', '', `${pedidos} ${pedidos === 1 ? 'pedido' : 'pedidos'}`, '', '', ...somaSab, pizzas, valor, '', '', `${retirados} de ${pedidos}`, ''];
  const titulo = `PIZZA DA ALEGRIA 2026   ·   ${pedidos} ${pedidos === 1 ? 'pedido' : 'pedidos'} · ${pizzas} ${pizzas === 1 ? 'pizza' : 'pizzas'} · ${reais(valor)} · ${retirados} ${retirados === 1 ? 'retirado' : 'retirados'}   ·   atualizada em ${dataHora(agora)}`;
  return { titulo, linhas: pedidos ? [...linhas, total] : [] };
}

// --- Sincronizar ------------------------------------------------------------------------------

export interface ResultadoPlanilha { escrita: boolean; link?: string; motivo?: string }

export const linkDaPlanilha = (id: string) => `https://docs.google.com/spreadsheets/d/${id}/edit`;

/**
 * Reescreve a aba Pedidos se houver mudança (ou se `forcar`). Cria a planilha
 * na primeira vez. A trava em pizza_planilha.escrevendo_em impede duas
 * chamadas de escreverem ao mesmo tempo; a pendência é baixada ANTES de ler o
 * banco, então uma mudança no meio da escrita marca de novo e entra na próxima.
 */
export async function sincronizarPlanilha(admin: Admin, token: string, pastaId: string, aux: Auxiliares, forcar = false): Promise<ResultadoPlanilha> {
  const { data: p } = await admin.from('pizza_planilha').select('*').eq('id', 1).maybeSingle();
  if (!p) return { escrita: false, motivo: 'a tabela pizza_planilha não existe: falta rodar a migração' };
  if (!p.pendente && p.planilha_id && !forcar) return { escrita: false, link: linkDaPlanilha(p.planilha_id) };

  const agora = new Date().toISOString();
  const limite = new Date(Date.now() - 90_000).toISOString();
  const { data: trava } = await admin.from('pizza_planilha').update({ escrevendo_em: agora, pendente: false })
    .eq('id', 1).or(`escrevendo_em.is.null,escrevendo_em.lt.${limite}`).select('id');
  if (!trava?.length) return { escrita: false, link: p.planilha_id ? linkDaPlanilha(p.planilha_id) : undefined, motivo: 'outra chamada está escrevendo' };

  try {
    let planilha: string = p.planilha_id;
    let aba: number = p.aba_id;
    if (!planilha) {
      const novo = await g(token, 'POST', 'https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id', {
        name: NOME_DA_PLANILHA, mimeType: 'application/vnd.google-apps.spreadsheet', parents: [pastaId],
      });
      planilha = novo.id;
      const info = await g(token, 'GET', `https://sheets.googleapis.com/v4/spreadsheets/${planilha}?fields=sheets.properties.sheetId`);
      aba = info.sheets[0].properties.sheetId;
      // Grava o id já: se o desenho falhar, a próxima chamada desenha nesta mesma planilha, sem criar outra.
      await admin.from('pizza_planilha').update({ planilha_id: planilha, aba_id: aba }).eq('id', 1);
      console.log(`[pizza-drive] planilha criada: ${planilha}`);
    }
    if (!p.desenhada_em) {
      // O batchUpdate é tudo ou nada: ou o desenho entra inteiro, ou nada muda e a próxima chamada tenta de novo.
      await g(token, 'POST', `https://sheets.googleapis.com/v4/spreadsheets/${planilha}:batchUpdate`, { requests: desenho(aba) });
      await admin.from('pizza_planilha').update({ desenhada_em: new Date().toISOString() }).eq('id', 1);
    }

    const { data: lista, error } = await admin.from('pizza_confirmacoes')
      .select('numero, nome, unidade_nome, area, sabores, quantidade, total, forma, mp_pagamento_id, mp_forma, mp_bandeira, retirada, retirada_em, created_at')
      .order('created_at');
    if (error) throw new Error(`não li os pedidos: ${error.message}`);
    const { titulo, linhas } = linhasDaPlanilha(lista ?? [], aux, agora);

    const base = `https://sheets.googleapis.com/v4/spreadsheets/${planilha}/values`;
    const r = (a1: string) => encodeURIComponent(`'${ABA}'!${a1}`);
    await g(token, 'POST', `${base}/${r(`A${PRIMEIRA}:Q${LINHAS_DA_GRADE}`)}:clear`, {});
    await g(token, 'POST', `${base}:batchUpdate`, {
      valueInputOption: 'RAW',
      data: [
        { range: `'${ABA}'!A1`, values: [[titulo]] },
        { range: `'${ABA}'!A3:Q3`, values: [COLUNAS] },
        ...(linhas.length ? [{ range: `'${ABA}'!A${PRIMEIRA}:Q${PRIMEIRA + linhas.length - 1}`, values: linhas }] : []),
      ],
    });
    await admin.from('pizza_planilha').update({ atualizada_em: new Date().toISOString(), erro: null, escrevendo_em: null }).eq('id', 1);
    return { escrita: true, link: linkDaPlanilha(planilha) };
  } catch (e) {
    const msg = e instanceof ErroPlanilha && /SERVICE_DISABLED|has not been used|is disabled/i.test(e.message)
      ? 'A API do Google Sheets não está ativada no projeto do Google Cloud.'
      : (e instanceof Error ? e.message : String(e));
    console.error('[pizza-drive] planilha:', msg);
    // Devolve a pendência: a próxima chamada tenta de novo.
    await admin.from('pizza_planilha').update({ erro: msg.slice(0, 500), escrevendo_em: null, pendente: true }).eq('id', 1);
    return { escrita: false, motivo: msg };
  }
}
