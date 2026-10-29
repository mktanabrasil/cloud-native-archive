import logoSvg from '@/assets/ana-brasil-logo.svg?raw';
import { CAMPOS, FORMATOS, lista, pares, texto, unidadeDaArte, type Familia, type Formato, type Pedido } from '@/lib/artes/modelo';
import './moldes.css';

/**
 * Os moldes desenham a arte em HTML a partir do pedido, na largura base de
 * 1080 px (`1em` = largura/100), e a página escala para caber. São textos de
 * HTML, não componentes: é o mesmo caminho das placas do refeitório
 * (`modelos/placas-refeitorio`), que depois vira JPEG/PDF pelo Chrome. Tudo
 * que vem da gestora passa por `esc`.
 */
const LOGO = logoSvg.replace(/<\?xml[^>]*>|<!DOCTYPE[^>]*>/g, '').replace(/\s+width="[\d.]+"\s+height="[\d.]+"/, '');
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

const ICO: Record<string, string> = {
  cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01"/></svg>',
  rel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  tel: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.6 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.6 3.6a1 1 0 0 1-.25 1z"/></svg>',
  pessoas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  maos: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 11V5a1.5 1.5 0 0 1 3 0v5h1V3a1.5 1.5 0 0 1 3 0v7h1V5a1.5 1.5 0 0 1 3 0v8.5l2.2-2.2a1.4 1.4 0 0 1 2 2L17 18.5A6 6 0 0 1 12.5 21H11a6 6 0 0 1-6-6v-4a1.5 1.5 0 0 1 2 0z"/></svg>',
  estrela: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 9.5 8.5 2 9.3l5.5 5-1.6 7.7L12 18l6.1 4-1.6-7.7 5.5-5-7.5-.8z"/></svg>',
  alerta: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 1 21h22L12 2zm1 15h-2v-2h2v2zm0-4h-2V9h2v4z"/></svg>',
};
/** Os ícones que a gestora pode pedir numa placa, pelo nome. */
export const ICONES_DE_PLACA = ['maos', 'pessoas', 'alerta', 'estrela'] as const;

interface Paleta { c1: string; c2: string; c3: string; c4: string; fundo: string; claro: string[] }
const PAL: Record<'ana' | 'mulheres' | 'educacao', Paleta> = {
  ana: { c1: '#01adff', c2: '#f37964', c3: '#81e2cf', c4: '#fbce00', fundo: '#f0eee4', claro: ['#dff3fb', '#fde3dc', '#dff7f1', '#fff3c4'] },
  mulheres: { c1: '#9b3a6e', c2: '#4a2140', c3: '#c9a8e0', c4: '#ec6f7d', fundo: '#fbf3ef', claro: ['#f7c6cc', '#e9dcf3', '#f7c6cc', '#e9dcf3'] },
  educacao: { c1: '#fbce00', c2: '#f37964', c3: '#f5dfbb', c4: '#fbce00', fundo: '#f0eee4', claro: ['#fff3c4', '#fde3dc', '#f9efdc', '#fff3c4'] },
};
const paleta = (p: Pedido): Paleta => (p.publico === 'mulheres' ? PAL.mulheres : unidadeDaArte(p.unidade).setor === 'educacao' ? PAL.educacao : PAL.ana);

export function dataBonita(iso: string) {
  if (!iso) return { dia: '31 de outubro', sem: 'Sábado', curta: '31/10' };
  const d = new Date(iso + 'T12:00:00');
  const M = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const S = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  return { dia: `${d.getDate()} de ${M[d.getMonth()]}`, sem: S[d.getDay()], curta: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}` };
}

/** O rodapé de faixas da identidade: 5 no Social, 3 na Educação, de ponta a ponta. */
const rodape = (p: Pedido) => {
  const cores = unidadeDaArte(p.unidade).setor === 'educacao' ? ['#f5dfbb', '#fbce00', '#f37964'] : ['#f5dfbb', '#fbce00', '#f37964', '#81e2cf', '#01adff'];
  const w = 1080 / cores.length;
  return `<div class="rodape"><svg viewBox="0 0 1080 24" preserveAspectRatio="none">${cores.map((c, i) => `<rect x="${i * w}" y="0" width="${w + 0.5}" height="24" fill="${c}"/>`).join('')}</svg></div>`;
};
const logo = (p: Pedido, bottom: number) => { const u = unidadeDaArte(p.unidade); return `<div class="logo" style="bottom:${bottom}em">${LOGO}${u.nome ? `<span class="un">${esc(u.nome)}</span>` : ''}</div>` };
const foto = (p: Pedido, h: number, semRotulo = false) => { const f = texto(p, 'foto'); return `<div class="foto ${f ? '' : 'vazia'} ${semRotulo ? 'sem-rotulo' : ''}" style="height:${h}%;${f ? `background-image:url(${f})` : ''}"></div>` };
const ondas = (top: number, pl: Paleta) => `<svg class="onda" viewBox="0 0 1080 90" preserveAspectRatio="none" style="top:calc(${top}% - 6em)"><path d="M0 40 C 250 95 420 0 620 30 S 950 80 1080 35 V90 H0z" fill="${pl.c1}"/><path d="M0 58 C 250 110 420 22 620 50 S 950 96 1080 56 V90 H0z" fill="${pl.c3}"/><path d="M0 72 C 250 120 420 40 620 66 S 950 108 1080 70 V90 H0z" fill="${pl.fundo}"/></svg>`;
/** O texto do campo ou, vazio, o exemplo do campo: a prévia nunca fica em branco. */
const D = (p: Pedido, k: string): string => texto(p, k) || (typeof CAMPOS[k]?.ex === 'string' ? (CAMPOS[k].ex as string) : '');
const hora = (p: Pedido) => { const [h, resto] = D(p, 'hora').split('·'); return { h: h.trim(), resto: (resto ?? '').trim() } };

const info = (p: Pedido, pl: Paleta, circulos: string[]) => {
  const dt = dataBonita(texto(p, 'data')); const u = unidadeDaArte(p.unidade); const loc = texto(p, 'local') || u.cheio; const { h, resto } = hora(p);
  return `<div class="info"><div><i style="background:${circulos[0]};color:${pl.c2}">${ICO.cal}</i><span><b>${dt.dia}</b><small>${dt.sem}</small></span></div><div><i style="background:${circulos[1]};color:${pl.c2}">${ICO.rel}</i><span><b>${esc(h)}</b><small>${esc(resto)}</small></span></div><div><i style="background:${circulos[2]};color:${pl.c2}">${ICO.pin}</i><span><b>${esc(loc)}</b><small>${esc(u.endereco)}</small></span></div></div>`;
};

type Molde = (p: Pedido, W: number, H: number, placaAtual: number) => string;
const MOLDES: Record<Familia, Molde> = {
  convite(p, W, H) {
    const pl = paleta(p); const story = H / W > 1.6; const fH = story ? 42 : 36; const grande = p.publico === 'idosos';
    const pre = p.parceiro ? `<div class="pre">Em parceria com <b style="color:${pl.c1}">${esc(p.parceiro)}</b></div>` : texto(p, 'pre') ? `<div class="pre">${esc(texto(p, 'pre'))}</div>` : '';
    const fecho = p.telefone ? `<div class="fecho"><em>FAÇA SUA INSCRIÇÃO</em><span><i style="width:1.3em;height:1.3em;border-radius:50%;background:${pl.claro[1]};display:inline-grid;place-items:center">${ICO.tel.replace('<svg', '<svg style="width:.7em;height:.7em"')}</i>${esc(p.telefone)}</span></div>` : '';
    return `<div class="arte" style="width:${W}px;height:${H}px;background:${pl.fundo};--c2:${pl.c2};font-size:${W / 100}px">${foto(p, fH)}${ondas(fH, pl)}
      <div class="miolo" style="top:${fH + 3}%">${pre}<div class="t1" style="color:${pl.c2}">${esc(D(p, 't1'))}</div><div class="t2" style="color:${pl.c1};${grande ? 'font-size:12em' : ''}">${esc(D(p, 't2'))}</div>
      <div class="apoio" style="${grande ? 'font-size:3.6em' : ''}">${esc(D(p, 'apoio'))}</div>
      ${texto(p, 'palestrante') ? `<div class="pal"><small>PALESTRANTE</small><b>${esc(texto(p, 'palestrante'))}</b></div>` : ''}
      ${info(p, pl, pl.claro)}${fecho}</div>
      <div class="forma e" style="background:${pl.claro[1]}"></div><div class="forma d" style="background:${pl.claro[0]}"></div>${logo(p, 4)}${rodape(p)}</div>`;
  },
  infantil(p, W, H) {
    const pl = PAL.ana; const pais = W > H; const fH = 38; const cores = [pl.c2, pl.c4, pl.c3, pl.c1]; const t = D(p, 't2').toUpperCase();
    const At = lista(p, 'atracoes').filter(Boolean); const atr = At.length ? At : ['Pula-pula e brincadeiras', 'Pintura facial', 'Lanche especial'];
    const dt = dataBonita(texto(p, 'data')); const u = unidadeDaArte(p.unidade);
    const logoTopo = pais ? logo(p, 0).replace('class="logo"', 'class="logo" style="position:static;transform:none;justify-content:center;margin-bottom:1em"') : '';
    return `<div class="arte" style="width:${W}px;height:${H}px;font-size:${pais ? W / 125 : W / 100}px">${pais ? '' : foto(p, fH)}${pais ? '' : `<div style="position:absolute;left:0;top:${fH - 14}%;width:100%;height:16%;background:linear-gradient(to bottom,transparent,#f0eee4)"></div>`}
      <div class="miolo" style="top:${pais ? 4 : fH + 2}%;text-align:center;${pais ? 'bottom:6em' : ''}">${logoTopo}<div class="fredoka">${[...t].map((ch, i) => `<span style="color:${ch === ' ' ? 'transparent' : cores[i % 4]}">${esc(ch)}</span>`).join('')}</div>
      <div style="margin-top:1.2em"><span class="fita">${esc(D(p, 'fita'))}</span></div>
      <div class="bolinhas" style="text-align:left;display:inline-block">${atr.map((a, i) => `<div><span style="background:${cores[i % 4]}"></span>${esc(a)}</div>`).join('')}</div>
      <div class="adesivos"><div class="adesivo" style="--c1:${pl.c2}"><div class="r">DATA</div><div class="v">${dt.curta}</div><div class="d">${dt.sem}</div></div><div class="adesivo" style="--c1:${pl.c4}"><div class="r">HORÁRIO</div><div class="v" style="font-size:3.4em">${esc(D(p, 'hora'))}</div><div class="d">&nbsp;</div></div><div class="adesivo" style="--c1:${pl.c3}"><div class="r">LOCAL</div><div class="v" style="font-size:3.6em">${esc(texto(p, 'local') || u.cheio)}</div><div class="d">${esc(u.endereco.split(' - ')[0])}</div></div></div></div>
      ${pais ? '' : logo(p, 5)}${rodape(p)}</div>`;
  },
  cronograma(p, W, H) {
    const pl = paleta(p); const u = unidadeDaArte(p.unidade); const L = pares(p, 'itens').filter(x => x[0] || x[1]);
    const itens = L.length ? L : [['19 · SEG', 'Dia do brinquedo: traga o seu brinquedo preferido'], ['20 · TER', 'Piquenique: lanche coletivo no pátio'], ['21 · QUA', 'Oficina de pipas: vamos construir e soltar'], ['22 · QUI', 'Cabelo maluco: penteados criativos'], ['23 · SEX', 'Festa de encerramento: música e dança']];
    const cores = [pl.c4, pl.c2, pl.c3, pl.c1];
    return `<div class="arte" style="width:${W}px;height:${H}px;background:${pl.fundo};font-size:${W / 100}px">${foto(p, 32)}<svg class="onda" viewBox="0 0 1080 90" preserveAspectRatio="none" style="top:calc(32% - 6em)"><path d="M0 45 C 250 100 420 5 620 35 S 950 85 1080 40 V90 H0z" fill="${pl.c4}"/><path d="M0 70 C 250 118 420 38 620 64 S 950 106 1080 68 V90 H0z" fill="${pl.fundo}"/></svg>
      <div class="miolo" style="top:35%;text-align:center"><span class="pilula">${esc(u.cheio)}</span><div class="t1" style="margin-top:.4em;font-size:4.8em">${esc(texto(p, 't1') || 'Semana da')} <span class="marca" style="color:${pl.c2}">${esc(texto(p, 't2') || 'Infância')}</span></div><div class="apoio" style="margin:.6em auto 0">${esc(D(p, 'apoio'))}</div>
      <div class="grade" style="text-align:left">${itens.slice(0, 8).map((it, i) => `<div class="gi"><i style="background:${pl.claro[i % 4]};color:${pl.c2}">${ICO.estrela}</i><span><span class="et" style="background:${cores[i % 4]}">${esc(it[0])}</span><b>${esc((it[1] || '').split(':')[0])}</b><small>${esc((it[1] || '').split(':')[1] || '')}</small></span></div>`).join('')}</div></div>
      ${logo(p, 5)}${rodape(p)}</div>`;
  },
  convocacao(p, W, H) {
    const dt = dataBonita(texto(p, 'data')); const u = unidadeDaArte(p.unidade); const { h, resto } = hora(p);
    return `<div class="arte" style="width:${W}px;height:${H}px;font-size:${W / 100}px">${foto(p, 46)}<div class="conv-tag">${LOGO}<span><b>Convocação</b><small>${u.setor === 'educacao' ? 'Educação' : 'Social'}</small></span></div>
      <svg class="onda" viewBox="0 0 1080 90" preserveAspectRatio="none" style="top:calc(46% - 6em)"><path d="M0 50 C 250 100 420 10 620 40 S 950 90 1080 45 V90 H0z" fill="#01adff"/><path d="M0 72 C 250 118 420 40 620 66 S 950 108 1080 70 V90 H0z" fill="#81e2cf"/></svg>
      <div class="conv-bloco" style="top:46%;height:36%"><div class="ante">${esc(D(p, 'ante').toUpperCase())}</div><div class="t1">${esc(texto(p, 't1') || 'Reunião de')}</div><div class="gig">${esc(texto(p, 't2') || 'alinhamento')}</div><span class="faixa-am">${esc(D(p, 'chamada'))}</span></div>
      <div class="conv-rod"><div><div class="k">DATA</div><b>${dt.curta}</b><small>${dt.sem}</small></div><div><div class="k">HORÁRIO</div><b>${esc(h)}</b><small>${esc(resto)}</small></div><div><div class="k">LOCAL</div><b style="font-size:3.4em">${esc(texto(p, 'local') || u.cheio)}</b><small>${esc(u.endereco)}</small></div></div></div>`;
  },
  cartaz(p, W, H) {
    const pl = paleta(p); const L = pares(p, 'regras').filter(x => x[0] || x[1]);
    const regras = L.length ? L : [['Respeito', 'Ouvir o educador e os colegas'], ['Celular guardado', 'Na secretaria durante as atividades'], ['Cuidar do espaço', 'Deixar tudo como encontrou'], ['Pontualidade', 'Chegar no horário combinado']];
    const cores = [pl.c3, pl.c1, pl.c2, pl.c4];
    return `<div class="arte" style="width:${W}px;height:${H}px;background:${pl.fundo};font-size:${W / 100}px">${foto(p, 36)}<div class="reg-topo"></div><div class="reg-t"><small>${esc((texto(p, 'pre') || 'TRILHANDO FUTURO · SALA 2').toUpperCase())}</small><b>${esc(texto(p, 't2') || 'Nossos combinados')}</b></div>
      <div class="miolo" style="top:40%;bottom:9em"><div class="reg-lista">${regras.slice(0, 10).map((r, i) => `<div><i style="color:${cores[i % 4]}">${String(i + 1).padStart(2, '0')}</i><span><b>${esc(r[0])}</b><small>${esc(r[1])}</small></span></div>`).join('')}</div></div>
      <div class="reg-fecho">${esc(D(p, 'fecho')).replace(/(^\S+\s\S+)/, '<b>$1</b>')}</div>${rodape(p)}</div>`;
  },
  placa(p, W, H, placaAtual) {
    const L = pares(p, 'placas').filter(x => x[0]); const pl = L.length ? L[Math.min(placaAtual, L.length - 1)] : ['Higienize as mãos antes de comer', 'maos'];
    const aviso = /celular|proibid|atenção|não /i.test(pl[0] || ''); const ic = ICO[pl[1]] || (aviso ? ICO.alerta : ICO.maos);
    return `<div class="arte placa ${aviso ? 'aviso' : ''}" style="width:${W}px;height:${H}px;font-size:${W / 100}px"><div class="painel"><i>${ic}</i><b>${esc(pl[0])}</b><div class="lg">${LOGO}<small>inspirar voos mais altos</small></div></div></div>`;
  },
  campanha(p, W, H) {
    const pl = PAL.ana; const L = pares(p, 'grupos').filter(x => x[0] || x[1]);
    const g = L.length ? L : [['Material escolar', '20 cadernos · 50 lápis · 10 mochilas'], ['Higiene', 'Sabonete, pasta e escova de dente'], ['Alimentos', 'Arroz, feijão, óleo e leite']];
    const cores = [pl.c3, pl.claro[0], pl.claro[1]];
    return `<div class="arte" style="width:${W}px;height:${H}px;font-size:${W / 100}px">${foto(p, 46, true)}<div class="camp-cap"></div><div class="camp-t" style="top:9em"><small>${esc((texto(p, 'pre') || 'CAMPANHA').toUpperCase())}</small><b>${esc(texto(p, 't2') || 'Trilhando').replace(/(\S+)$/, '<em>$1</em>')}</b></div>
      <div class="miolo" style="top:48.5%"><div class="apoio" style="margin-top:0">${esc(D(p, 'apoio'))}</div><div class="camp-lista">${g.slice(0, 3).map((x, i) => `<div style="background:${cores[i]}"><b>${esc(x[0])}</b><small>${esc(x[1])}</small></div>`).join('')}</div><div class="camp-contato"><i></i>${esc(p.telefone || '(19) 99999-9999')} · @anabrasilorg</div></div>${logo(p, 5)}${rodape(p)}</div>`;
  },
  ficha(p, W, H) { return `<div class="arte" style="width:${W}px;height:${H}px;font-size:${W / 100}px"><div class="embreve"><b>Ficha para preencher</b><p>Molde da Ficha de Atendimento CCII: sai 4 por folha A4 com marcas de corte e versão em preto e branco. Entra na próxima etapa.</p></div>${rodape(p)}</div>` },
  adesivo(_p, W, H) { return `<div class="arte" style="width:${W}px;height:${H}px;font-size:${W / 100}px"><div class="embreve"><b>Adesivo e tag</b><p>Molde da Oficina de Costura: adesivo Ø 50 mm e tag 50×85 mm com furo. Entra na próxima etapa.</p></div></div>` },
};

/** O HTML da arte no formato pedido. */
export function desenharArte(familia: Familia, formato: Formato, p: Pedido, placaAtual = 0): string {
  const F = FORMATOS[formato];
  return MOLDES[familia](p, F.w, F.h, placaAtual);
}
