/**
 * O e-mail do Financeiro (19/11/2026, PR 2 do Financeiro; decisões do mockup
 * do mesmo dia): ao CONFIRMAR um evento que tem compras da ANA (alimentação
 * com fornecedor "ANA" e transporte de fora), e de novo quando a unidade muda
 * esse pedido depois de confirmado ("Pedido alterado": o que entrou, o que
 * saiu e o que mudou de quantidade). Pendentes não geram e-mail; aparecem só
 * na página do Financeiro, com selo.
 *
 * Os itens seguem a mesma regra da página (src/lib/financeiro/compras.ts):
 * mesma chave, mesma quantidade. O teste do app confere que as duas batem.
 *
 * Sem rede nem Deno: o index.ts monta o e-mail com isto, e os testes do app
 * (vitest) alcançam. Sem .ics: o pedido não muda a agenda de ninguém.
 */
import { blocoDeData, capa, escape, quandoDaEquipe, tituloEmTexto } from './equipe.ts';

type Evento = Record<string, any>;
export interface AvisoDoFinanceiro { evento: Evento; antes: Evento | null }

export interface ItemDeCompra { chave: string; tipo: 'alimentacao' | 'transporte'; grupo: string; nome: string; quantidade: string; detalhe: string | null }

const FUSO = 'America/Sao_Paulo';
const FONTE = "Poppins, Arial, Helvetica, sans-serif";
const FRASE_DA_ANA = 'Construindo oportunidades para transformar vidas e inspirar voos mais altos.';
const CORES_DA_UNIDADE: Record<string, string> = {
  'DIC': '#01adff', 'Nilópolis': '#81e2cf', 'Santana': '#fbce00', 'Administração': '#f37964', 'Grupo ANA Brasil': '#484848',
};
/** O âmbar da página do Financeiro. */
const DO_FINANCEIRO = { fundo: '#fdf3e2', tinta: '#8a5200', topo: 'Compras dos eventos · Financeiro', painel: 'Abrir no Financeiro' };
const SELO_CONFIRMADO = { rotulo: 'Confirmado', bg: '#e4f4ec', fg: '#1e7a4a', borda: '#a9dcc0' };
const SELO_ALTERADO = { rotulo: 'Pedido alterado', bg: '#fdf3d6', fg: '#8a5a00', borda: '#f1d98a' };

const chaveDoTexto = (t: string) =>
  String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'item';
const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, ...opts }).format(new Date(iso));
const dataCurta = (iso: string) => fmt(iso, { day: '2-digit', month: '2-digit' });
const hora = (iso: string) => fmt(iso, { hour: '2-digit', minute: '2-digit' });

/** As compras da ANA num evento: a mesma regra (e a mesma chave) da página do Financeiro. */
export function itensDeCompra(e: Evento | null | undefined): ItemDeCompra[] {
  if (!e) return [];
  const itens: ItemDeCompra[] = [];
  const vistas = new Set<string>();
  for (const refeicao of Array.isArray(e.food_items) ? e.food_items : []) {
    if (!refeicao || typeof refeicao !== 'object') continue;
    const grupo = String(refeicao.item ?? '').trim() || 'Alimentação';
    for (const a of Array.isArray(refeicao.alimentos) ? refeicao.alimentos : []) {
      const nome = String(a?.nome ?? '').trim();
      if (a?.fornecedor !== 'ANA' || !nome) continue;
      let chave = `alimento:${chaveDoTexto(grupo)}:${chaveDoTexto(nome)}`;
      for (let n = 2; vistas.has(chave); n++) chave = `alimento:${chaveDoTexto(grupo)}:${chaveDoTexto(nome)}-${n}`;
      vistas.add(chave);
      itens.push({ chave, tipo: 'alimentacao', grupo, nome, quantidade: String(a.quantidade ?? '').trim(), detalhe: String(refeicao.cardapio ?? '').trim() || null });
    }
  }
  const passageiros = Number(e.transport_passengers) || 0;
  if (e.transport_external_support) {
    itens.push({ chave: 'transporte:apoio-de-fora', tipo: 'transporte', grupo: 'Transporte de fora', nome: 'Ônibus ou van fretados', quantidade: passageiros ? `${passageiros} passageiros` : '', detalhe: 'A frota da ANA (VAN + Kombi, 25 lugares) não basta' });
  }
  if (e.transport_extra_equipment) {
    itens.push({ chave: 'transporte:veiculo-de-apoio', tipo: 'transporte', grupo: 'Transporte de fora', nome: 'Veículo de apoio', quantidade: String(e.transport_support_vehicle ?? '').trim(), detalhe: 'Leva equipamentos ou materiais volumosos' });
  }
  return itens;
}

export interface MudancaDoPedido { atual: ItemDeCompra[]; entraram: ItemDeCompra[]; sairam: ItemDeCompra[]; mudaram: Array<{ antes: ItemDeCompra; agora: ItemDeCompra }> }

/**
 * O que mudou entre o pedido de antes e o de agora, pela chave (nome +
 * refeição). "Mudou" = mesma chave com outra quantidade ou outra grafia do
 * nome (a mesma regra da página e do gatilho, que comparam nome e quantidade).
 */
export function mudancaDoPedido(antes: Evento | null, agora: Evento): MudancaDoPedido {
  const atual = itensDeCompra(agora);
  if (!antes) return { atual, entraram: [], sairam: [], mudaram: [] };
  const velhos = new Map(itensDeCompra(antes).map(i => [i.chave, i]));
  const novos = new Map(atual.map(i => [i.chave, i]));
  return {
    atual,
    entraram: atual.filter(i => !velhos.has(i.chave)),
    sairam: [...velhos.values()].filter(i => !novos.has(i.chave)),
    mudaram: atual.filter(i => { const v = velhos.get(i.chave); return !!v && (v.quantidade !== i.quantidade || v.nome !== i.nome); }).map(i => ({ antes: velhos.get(i.chave)!, agora: i })),
  };
}

/** "Pedido alterado" sem nada entrando, saindo ou mudando (só a ordem, o cardápio): não sai. */
export function pedidoSemMudanca(antes: Evento | null, agora: Evento): boolean {
  if (!antes) return false;
  const m = mudancaDoPedido(antes, agora);
  return m.entraram.length === 0 && m.sairam.length === 0 && m.mudaram.length === 0;
}

/** "AAAA-MM" do evento, para a página abrir no mês certo. */
const mesDoEvento = (iso: string) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit' }).formatToParts(new Date(iso)).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}`;
};
export const linkDoFinanceiro = (a: AvisoDoFinanceiro, site: string) => `${site}/administracao/financeiro?mes=${mesDoEvento(a.evento.start_datetime)}`;

export function assuntoDoFinanceiro(a: AvisoDoFinanceiro): string {
  const e = a.evento;
  return `${a.antes ? 'Pedido alterado' : 'Compras do evento'}: ${tituloEmTexto(e.title)} · ${dataCurta(e.start_datetime)} · ${e.unit}`;
}

const conta = (n: number, um: string, varios: string) => (n === 0 ? '' : n === 1 ? `1 ${um}` : `${n} ${varios}`);

/** O que o Gmail mostra ao lado do assunto. */
export function previaDoFinanceiro(a: AvisoDoFinanceiro): string {
  const m = mudancaDoPedido(a.antes, a.evento);
  const itens = conta(m.atual.length, 'item', 'itens') || 'nenhum item';
  if (a.antes) {
    const partes = [conta(m.entraram.length, 'entrou', 'entraram'), conta(m.sairam.length, 'saiu', 'saíram'), conta(m.mudaram.length, 'mudou', 'mudaram')].filter(Boolean);
    return `${partes.join(', ')} · agora ${itens} · ${quandoDaEquipe(a.evento)}`;
  }
  return `${itens} para cotar · ${quandoDaEquipe(a.evento)} · ${a.evento.location || 'Unidade ' + a.evento.unit}`;
}

/** "400 → 450"; se a grafia do nome mudou, o nome entra junto ("Marmitex · 400 → marmitex! · 400"). */
const antesDoItem = (x: { antes: ItemDeCompra; agora: ItemDeCompra }) => x.antes.nome !== x.agora.nome ? rotuloDoItem(x.antes) : (x.antes.quantidade || 'sem quantidade');
const agoraDoItem = (x: { antes: ItemDeCompra; agora: ItemDeCompra }) => x.antes.nome !== x.agora.nome ? rotuloDoItem(x.agora) : (x.agora.quantidade || 'sem quantidade');
const rotuloDoItem = (i: ItemDeCompra) => `${i.nome}${i.quantidade ? ` · ${i.quantidade}` : ''}`;

/** O pedido de agora, agrupado como na página (refeição; transporte de fora). */
function listaHtml(itens: ItemDeCompra[]): string {
  if (itens.length === 0) return `<p style="margin:0;font-size:14px;color:#474747">Nenhuma compra da ANA neste evento agora.</p>`;
  const grupos = Array.from(new Set(itens.map(i => i.grupo)));
  return grupos.map(g => {
    const doGrupo = itens.filter(i => i.grupo === g);
    const detalhe = doGrupo[0].tipo === 'alimentacao' && doGrupo[0].detalhe ? ` <span style="font-weight:400;color:#474747">· ${escape(doGrupo[0].detalhe)}</span>` : '';
    return `<div style="margin:0 0 10px"><div style="font-size:12px;font-weight:700;color:#191b1a;margin-bottom:3px">${escape(g)}${detalhe}</div>
      <ul style="margin:0;padding-left:18px;font-size:15px;line-height:1.5;color:#191b1a">${doGrupo.map(i => `<li style="margin:0 0 3px"><b>${escape(i.nome)}</b>${i.quantidade ? ` <span style="color:#474747">· ${escape(i.quantidade)}</span>` : ''}</li>`).join('')}</ul></div>`;
  }).join('');
}

export function corpoDoFinanceiroHtml(a: AvisoDoFinanceiro, site: string): string {
  const e = a.evento;
  const cor = CORES_DA_UNIDADE[e.unit] || '#f37964';
  const s = DO_FINANCEIRO;
  const st = a.antes ? SELO_ALTERADO : SELO_CONFIRMADO;
  const m = mudancaDoPedido(a.antes, e);
  const comBanner = !!(e.banner_url_desktop || e.banner_image_desktop || e.banner_url_mobile || e.banner_image_mobile);

  let mudou = '';
  if (a.antes) {
    const grupo = (titulo: string, corDoTitulo: string, linhas: string[]) => linhas.length === 0 ? '' : `
      <div style="margin:0 0 10px"><div style="font-size:11px;font-weight:700;letter-spacing:.05em;color:${corDoTitulo};margin-bottom:4px">${titulo}</div>
      <ul style="margin:0;padding-left:18px;font-size:14px;line-height:1.45;color:#191b1a">${linhas.map(l => `<li style="margin:0 0 4px">${l}</li>`).join('')}</ul></div>`;
    mudou = grupo(`ENTROU · ${m.entraram.length}`, '#1e7a4a', m.entraram.map(i => `<b>${escape(rotuloDoItem(i))}</b> <span style="color:#474747">(${escape(i.grupo)})</span>`))
      + grupo(`MUDOU · ${m.mudaram.length}`, '#8a5a00', m.mudaram.map(x => `<b>${escape(x.agora.nome)}</b> <span style="color:#474747">(${escape(x.agora.grupo)})</span>: <span style="text-decoration:line-through;color:#474747">${escape(antesDoItem(x))}</span> → <b>${escape(agoraDoItem(x))}</b>`))
      + grupo(`SAIU · ${m.sairam.length}`, '#b3261e', m.sairam.map(i => `<span style="text-decoration:line-through;color:#474747">${escape(rotuloDoItem(i))}</span> <span style="color:#474747">(${escape(i.grupo)})</span>`));
  }

  const linha = (k: string, v: string) => `<tr><td style="width:110px;padding:8px 0;border-top:1px solid #efece6;color:#474747;vertical-align:top;font-size:14px">${k}</td><td style="padding:8px 0;border-top:1px solid #efece6;vertical-align:top;font-size:14px;color:#191b1a">${v}</td></tr>`;
  let linhas = linha('Quando', `<b>${escape(quandoDaEquipe(e))}</b>`);
  linhas += linha('Onde', escape(e.location || 'Unidade ' + (e.unit || '')));
  const pedidoEm = e.submitted_at || e.created_at;
  if (e.created_by) linhas += linha('Pedido por', escape(e.created_by) + (pedidoEm ? `, em ${dataCurta(pedidoEm)}` : ''));
  if (a.antes && (e.updated_by || e.updated_at)) linhas += linha('Alterado por', escape(e.updated_by || 'a unidade') + (e.updated_at ? `, em ${dataCurta(e.updated_at)} às ${hora(e.updated_at)}` : ''));
  const aviso = a.antes ? `<p style="margin:8px 0 0;font-size:12px;color:#474747">O que já estava marcado como cotado ou comprado e mudou volta a aparecer como "a cotar" na página, com o aviso "o pedido mudou".</p>` : '';

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escape(assuntoDoFinanceiro(a))}</title></head>
<body style="margin:0;padding:0;background:#f8f6f3;font-family:${FONTE};color:#191b1a">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;overflow:hidden;color:#f8f6f3">${escape(previaDoFinanceiro(a))}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8f6f3"><tr><td align="center" style="padding:22px 12px 28px">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%">
  <tr><td style="padding:0 2px 14px">
    <table role="presentation" cellspacing="0" cellpadding="0"><tr>
      <td style="vertical-align:middle;padding-right:10px"><img src="${site}/logo.png" width="36" height="36" alt="anabrasil" style="display:block;border-radius:10px"></td>
      <td style="vertical-align:middle;font-size:20px;font-weight:700;letter-spacing:-.02em;color:#191b1a;font-family:${FONTE}">anabrasil</td>
      <td style="vertical-align:middle;padding-left:10px;font-size:12px;color:#474747">${s.topo}</td>
    </tr></table>
  </td></tr>
  <tr><td>
    <div style="background:#fefdfb;border:1px solid #e6e1d9;border-radius:12px;overflow:hidden">
      ${capa(e, cor)}
      <div style="padding:18px 24px 8px">
        <span style="display:inline-block;padding:3px 10px;border-radius:999px;background:${st.bg};color:${st.fg};border:1px solid ${st.borda};font-size:12px;font-weight:600;margin-bottom:12px">${st.rotulo}</span>
        ${comBanner ? `<div style="font-size:21px;font-weight:700;line-height:1.2;color:#191b1a;letter-spacing:-.01em;margin:0 0 12px">${escape(tituloEmTexto(e.title))}</div>` : ''}
        <div style="background:${s.fundo};border-radius:10px;padding:14px 16px;margin:0 0 14px">
          ${mudou}
          <div style="font-size:11px;font-weight:700;letter-spacing:.05em;color:${s.tinta};margin-bottom:8px">${a.antes ? 'O PEDIDO AGORA' : 'A ANA COMPRA'} · ${m.atual.length}</div>
          ${listaHtml(m.atual)}
          ${aviso}
        </div>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
          ${blocoDeData(e)}
          <td style="vertical-align:top"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">${linhas}</table></td>
        </tr></table>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0 4px"><tr>
          <td><a href="${linkDoFinanceiro(a, site)}" style="display:block;text-align:center;background:#81e2cf;color:#191b1a;text-decoration:none;font-weight:600;font-size:15px;padding:13px 18px;border-radius:8px;font-family:${FONTE}">${s.painel}</a></td>
        </tr></table>
      </div>
      <div style="padding:12px 24px 16px;font-size:12px;color:#474747;border-top:1px solid #efece6;margin-top:14px;line-height:1.5">Você recebe este e-mail porque está na lista do Financeiro no Painel do app. Comida de doação, de parceiro ou da própria unidade não entra. Se o pedido mudar, chega um novo aviso.</div>
    </div>
  </td></tr>
  <tr><td style="padding:20px 8px 0;text-align:center;font-size:12px;color:#474747;line-height:1.6">
    <b style="color:#191b1a;font-size:13px">ANA Brasil</b><br>
    ${FRASE_DA_ANA}<br>
    <a href="https://anabrasil.org" style="color:#191b1a;text-decoration:none">anabrasil.org</a> &nbsp;·&nbsp; <a href="https://www.instagram.com/anabrasilorg" style="color:#191b1a;text-decoration:none">@anabrasilorg</a><br>
    <span style="color:#8a8f8b">Aviso automático do sistema de eventos.</span>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

/** A versão em texto puro. */
export function corpoDoFinanceiroTexto(a: AvisoDoFinanceiro, site: string): string {
  const e = a.evento;
  const m = mudancaDoPedido(a.antes, e);
  const l: string[] = [previaDoFinanceiro(a), '', `ANA Brasil · ${DO_FINANCEIRO.topo}`, '', a.antes ? 'PEDIDO ALTERADO' : 'EVENTO CONFIRMADO', tituloEmTexto(e.title), `Unidade ${e.unit}`, ''];
  if (a.antes) {
    if (m.entraram.length) l.push('Entrou:', ...m.entraram.map(i => `+ ${rotuloDoItem(i)} (${i.grupo})`), '');
    if (m.mudaram.length) l.push('Mudou:', ...m.mudaram.map(x => `~ ${x.agora.nome} (${x.agora.grupo}): ${antesDoItem(x)} → ${agoraDoItem(x)}`), '');
    if (m.sairam.length) l.push('Saiu:', ...m.sairam.map(i => `- ${rotuloDoItem(i)} (${i.grupo})`), '');
  }
  l.push(`${a.antes ? 'O pedido agora' : 'A ANA compra'} (${m.atual.length}):`);
  if (m.atual.length) l.push(...m.atual.map(i => `- ${i.grupo}: ${rotuloDoItem(i)}`));
  else l.push('Nenhuma compra da ANA neste evento agora.');
  l.push('', `Quando: ${quandoDaEquipe(e)}`, `Onde: ${e.location || 'Unidade ' + e.unit}`);
  if (e.created_by) l.push(`Pedido por: ${e.created_by}`);
  l.push('', `${DO_FINANCEIRO.painel}: ${linkDoFinanceiro(a, site)}`, '', 'Aviso automático do sistema de eventos da ANA Brasil.');
  return l.join('\n');
}
