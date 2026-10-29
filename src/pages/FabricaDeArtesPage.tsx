import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, Copy, Mail, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { CAMPOS, FAMILIAS, FORMATOS, OPCOES_DE_CONTA, OPCOES_DE_PUBLICO, PEDIDO_VAZIO, UNIDADES_DA_ARTE, lista, pares, quantasPlacas, texto, unidadeDaArte, type Familia, type Formato, type Pedido, type Publica } from '@/lib/artes/modelo';
import { decidir, fichaDeImpressao, formatosPara, gerarFrase, resumoDoPedido, type Decisao } from '@/lib/artes/motor';
import { desenharArte } from '@/components/artes/moldes';

/**
 * Fábrica de Artes (PR 1, 29/10/2026). Quatro etapas: como a arte vai ser
 * usada (impressa? plastificar? quantas?), o que conta e para quem, os
 * campos do padrão escolhido com a prévia ao vivo, e o resumo. O motor
 * (`lib/artes/motor.ts`) escolhe o padrão por regras; a gestora vê por que e
 * pode trocar. Neste PR o pedido vai por e-mail ao marketing (mailto) ou
 * copiado; a fila no banco é o PR 2.
 */
const ETAPAS = [['uso', 'Uso'], ['conteudo', 'Conteúdo'], ['informacoes', 'Informações'], ['resumo', 'Resumo']] as const;
type Etapa = (typeof ETAPAS)[number][0];
const EMAIL_DO_MARKETING = 'mkt@anabrasil.org';

function Opcao({ on, onClick, children, sub, compacta }: { on: boolean; onClick: () => void; children: ReactNode; sub?: string; compacta?: boolean }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
      className={cn('grid min-h-11 gap-0.5 rounded-[14px] border-[1.5px] px-3 py-2.5 text-left transition-colors', compacta && 'min-h-9', on ? 'border-primary bg-primary/20' : 'border-border bg-card hover:bg-muted/60')}>
      <b className={cn('text-sm', on && 'text-[hsl(var(--sel))]')}>{children}</b>
      {sub && <small className="text-xs leading-snug text-muted-foreground">{sub}</small>}
    </button>
  );
}
function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" aria-pressed={on} onClick={onClick} className={cn('min-h-9 rounded-full border-[1.5px] px-3 py-1.5 text-[13px] font-semibold transition-colors', on ? 'border-transparent bg-primary text-primary-foreground' : 'border-border bg-card hover:bg-muted/60')}>{children}</button>;
}
function Pergunta({ children, ajuda }: { children: ReactNode; ajuda?: string }) {
  return <div className="mb-2 mt-4 text-sm font-semibold">{children}{ajuda && <small className="block text-xs font-normal text-muted-foreground">{ajuda}</small>}</div>;
}
function Contador({ valor, max }: { valor: string; max?: number }) {
  if (!max) return null;
  const n = valor.length;
  return <span className={cn('text-right text-[11.5px] font-normal tabular-nums text-muted-foreground', n > max ? 'text-destructive' : n > max * 0.85 && 'text-warning')}>{n}/{max}</span>;
}

export default function FabricaDeArtesPage() {
  const [etapa, setEtapa] = useState<Etapa>('uso');
  const [p, setP] = useState<Pedido>(PEDIDO_VAZIO);
  const [decisao, setDecisao] = useState<Decisao | null>(null);
  const [perguntaAberta, setPerguntaAberta] = useState(false);
  const [placaAtual, setPlacaAtual] = useState(0);
  const [vezDaFrase, setVezDaFrase] = useState(0);
  const [infoDaFrase, setInfoDaFrase] = useState('');
  const [obs, setObs] = useState('');
  const [copiado, setCopiado] = useState(false);
  const palco = useRef<HTMLDivElement>(null);
  const [larguraDoPalco, setLarguraDoPalco] = useState(420);

  const muda = (patch: Partial<Pedido>) => setP(x => ({ ...x, ...patch }));
  const mudaDado = (k: string, v: Pedido['dados'][string]) => setP(x => ({ ...x, dados: { ...x.dados, [k]: v } }));
  const alternaPublica = (k: Publica) => muda({ publica: p.publica.includes(k) ? p.publica.filter(x => x !== k) : [...p.publica, k] });

  const podeSeguir1 = !!p.uso && (p.uso === 'digital' || !!p.plastificar);
  const podeSeguir2 = !!p.conta && !!p.publico && !!p.unidade;
  const unidade = unidadeDaArte(p.unidade);
  const formatos = useMemo(() => (p.familia ? formatosPara(p.familia, p) : []), [p]);
  const formato: Formato | null = p.familia ? (p.formato && formatos.includes(p.formato) ? p.formato : formatos[0]) : null;
  const ficha = p.familia ? fichaDeImpressao(p.familia, p) : null;
  const fam = p.familia ? FAMILIAS[p.familia] : null;

  // A decisão roda ao entrar nas informações e sempre que as respostas mudam; a família escolhida à mão fica.
  const decidirAgora = (reset: boolean) => {
    const d = decidir(p); setDecisao(d);
    if (reset || !p.familia) { muda({ familia: d.top, formato: null }); setPerguntaAberta(!!d.desempate && reset) }
  };
  useEffect(() => { if (p.familia) setDecisao(decidir(p)) }, [p.conta, p.publico, p.uso, p.plastificar]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const medir = () => { if (palco.current) setLarguraDoPalco(palco.current.clientWidth - 32) };
    medir(); window.addEventListener('resize', medir); return () => window.removeEventListener('resize', medir);
  }, [etapa, p.familia]);

  const ir = (e: Etapa) => { setEtapa(e); window.scrollTo({ top: 0, behavior: 'smooth' }) };

  const resumo = resumoDoPedido(p, unidade.cheio, ficha) + (obs ? `\n\nObservação: ${obs}` : '');
  const copiar = async () => {
    try { await navigator.clipboard.writeText(resumo); setCopiado(true); toast.success('Resumo copiado'); setTimeout(() => setCopiado(false), 2000) }
    catch { toast.error('Não deu para copiar. Selecione o texto do resumo.') }
  };
  const mailto = `mailto:${EMAIL_DO_MARKETING}?subject=${encodeURIComponent(`Pedido de arte · ${unidade.cheio} · ${fam?.nome ?? ''}`)}&body=${encodeURIComponent(resumo)}`;

  // Avisos sem IA: texto que passou do limite, foto faltando, público idoso.
  const avisos: string[] = [];
  if (fam) {
    for (const k of fam.campos) { const d = CAMPOS[k]; const v = texto(p, k); if (d.max && d.t !== 'lista' && d.t !== 'lista2' && v.length > d.max) avisos.push(`"${d.r}" passou do limite (${v.length}/${d.max}): a arte pode cortar.`) }
    if (!texto(p, 'foto') && fam.campos.includes('foto')) avisos.push('Sem foto: o marketing vai usar uma foto da unidade.');
    if (p.publico === 'idosos') avisos.push('Público idoso: letras maiores e pouca informação; o molde já aplica.');
    if (ficha?.obs) avisos.push(ficha.obs);
  }

  const previa = p.familia && formato ? (() => {
    const F = FORMATOS[formato]; const cel = typeof window !== 'undefined' && window.innerWidth < 1024;
    const larg = Math.min(larguraDoPalco, F.w > F.h ? (cel ? 360 : 640) : (cel ? 250 : 420)); const escala = larg / F.w;
    return { html: desenharArte(p.familia, formato, p, placaAtual), larg, alt: Math.round(F.h * escala), escala, F };
  })() : null;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-8">
      <div className="mb-4">
        <h1 className="font-display text-[26px] font-bold tracking-[-0.02em] [text-wrap:balance]">Fábrica de Artes</h1>
        <p className="mt-1 max-w-[62ch] text-sm text-muted-foreground">Responda e a ferramenta escolhe o padrão aprovado, monta a prévia e manda o pedido ao marketing. Sem IA: a escolha é por regras e os moldes são as artes já aprovadas.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,480px)_minmax(0,1fr)] lg:items-start">
        <div>
          <div className="glass-1 mb-4 flex w-max max-w-full flex-wrap gap-1 rounded-[14px] p-1" role="list" aria-label="Etapas">
            {ETAPAS.map(([k, r], i) => { const atual = ETAPAS.findIndex(e => e[0] === etapa); return <span key={k} role="listitem" className={cn('rounded-[10px] px-3 py-1.5 text-[12.5px] font-semibold', i === atual ? 'bg-[hsl(var(--ativo))] text-foreground shadow-[inset_0_1px_0_hsl(var(--glass-luz))]' : i < atual ? 'text-[hsl(var(--sel))]' : 'text-muted-foreground')}>{i < atual ? '✓ ' : ''}{r}</span> })}
          </div>

          {etapa === 'uso' && (
            <section className="glass-1 rounded-[20px] p-[18px]" aria-labelledby="t-uso">
              <h2 id="t-uso" className="font-display text-[17px] font-semibold">1 · Como essa arte vai ser usada?</h2>
              <p className="mb-3 text-[13px] text-muted-foreground">Isso vem antes de tudo: decide o tamanho, a quantidade e o que vai para a impressão.</p>
              <Pergunta>Vai ser impressa ou só enviada pelo celular?</Pergunta>
              <div className="grid grid-cols-3 gap-2" role="group" aria-label="Uso">
                <Opcao on={p.uso === 'digital'} onClick={() => muda({ uso: 'digital' })} sub="WhatsApp, Instagram">Só digital</Opcao>
                <Opcao on={p.uso === 'impressa'} onClick={() => muda({ uso: 'impressa' })} sub="mural, parede, folha">Impressa</Opcao>
                <Opcao on={p.uso === 'os_dois'} onClick={() => muda({ uso: 'os_dois' })}>Os dois</Opcao>
              </div>
              {p.uso && p.uso !== 'digital' && (
                <>
                  <Pergunta ajuda="Placas e cartazes de parede costumam ser plastificados.">Vai plastificar?</Pergunta>
                  <div className="flex gap-1.5" role="group" aria-label="Plastificar"><Chip on={p.plastificar === 'sim'} onClick={() => muda({ plastificar: 'sim' })}>Sim</Chip><Chip on={p.plastificar === 'nao'} onClick={() => muda({ plastificar: 'nao' })}>Não</Chip></div>
                  <Pergunta ajuda="Se não marcar, vale 1.">Quantas cópias?</Pergunta>
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label="Cópias">{[1, 5, 10, 30, 100].map(n => <Chip key={n} on={p.copias === n} onClick={() => muda({ copias: n })}>{n}</Chip>)}</div>
                  <label className="mt-2 block text-[13px] font-semibold">Ou digite<Input type="number" min={1} inputMode="numeric" placeholder="ex.: 12" className="mt-1" value={p.copias ?? ''} onChange={e => muda({ copias: e.target.value ? Math.max(1, +e.target.value) : null })} /></label>
                  <p className="mt-2 text-[13px] text-muted-foreground">O tamanho do papel não é perguntado: a ferramenta propõe e você confirma no fim.</p>
                </>
              )}
              {p.uso && p.uso !== 'impressa' && (
                <>
                  <Pergunta ajuda="Pode marcar mais de um.">Onde vai ser publicada?</Pergunta>
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label="Onde publica"><Chip on={p.publica.includes('grupo')} onClick={() => alternaPublica('grupo')}>Grupo de WhatsApp</Chip><Chip on={p.publica.includes('story')} onClick={() => alternaPublica('story')}>Status / story</Chip><Chip on={p.publica.includes('feed')} onClick={() => alternaPublica('feed')}>Feed do Instagram</Chip></div>
                </>
              )}
              <div className="mt-4 flex justify-end"><Button disabled={!podeSeguir1} onClick={() => ir('conteudo')}>Continuar</Button></div>
            </section>
          )}

          {etapa === 'conteudo' && (
            <section className="glass-1 rounded-[20px] p-[18px]" aria-labelledby="t-cont">
              <h2 id="t-cont" className="font-display text-[17px] font-semibold">2 · O que a arte conta e para quem</h2>
              <p className="mb-3 text-[13px] text-muted-foreground">Com essas respostas a ferramenta escolhe o padrão sozinha.</p>
              <Pergunta>O que essa arte conta?</Pergunta>
              <div className="grid gap-2" role="group" aria-label="O que conta">{OPCOES_DE_CONTA.map(o => <Opcao key={o.chave} on={p.conta === o.chave} onClick={() => muda({ conta: o.chave })} sub={o.exemplo}>{o.rotulo}</Opcao>)}</div>
              <Pergunta>Para quem é?</Pergunta>
              <div className="grid grid-cols-2 gap-2" role="group" aria-label="Para quem">{OPCOES_DE_PUBLICO.map(o => <Opcao key={o.chave} compacta on={p.publico === o.chave} onClick={() => muda({ publico: o.chave })}>{o.rotulo}</Opcao>)}</div>
              <Pergunta>De qual unidade é?</Pergunta>
              <select aria-label="Unidade" className="h-11 w-full rounded-xl border-[1.5px] border-border bg-card px-3 text-[15px]" value={p.unidade} onChange={e => muda({ unidade: e.target.value })}>
                <option value="">Escolha…</option>
                {UNIDADES_DA_ARTE.map(u => <option key={u.chave} value={u.chave}>{u.cheio}{u.chave !== 'geral' ? ` · ${u.setor === 'educacao' ? 'Educação' : 'Social'}` : ' (institucional)'}</option>)}
              </select>
              <details className="mt-3"><summary className="cursor-pointer text-[13px] font-semibold text-[hsl(var(--sel))]">Mais detalhes (parceiro, inscrição)</summary>
                <label className="mt-2 block text-[13px] font-semibold">Tem parceiro ou projeto junto?<Input className="mt-1" placeholder="ex.: Projeto MM" value={p.parceiro} onChange={e => muda({ parceiro: e.target.value })} /></label>
                <label className="mt-2 block text-[13px] font-semibold">Telefone para inscrição ou contato<Input className="mt-1" type="tel" placeholder="(19) 99999-9999" value={p.telefone} onChange={e => muda({ telefone: e.target.value })} /></label>
              </details>
              <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => ir('uso')}>Voltar</Button><Button disabled={!podeSeguir2} onClick={() => { decidirAgora(true); ir('informacoes') }}>Ver o padrão escolhido</Button></div>
            </section>
          )}

          {(etapa === 'informacoes' || etapa === 'resumo') && fam && decisao && (
            <section className="glass-1 mb-4 rounded-[20px] border-primary/60 p-[18px]" aria-labelledby="t-dec">
              <h2 id="t-dec" className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Vai sair como</h2>
              <div className="font-display text-[22px] font-bold tracking-[-0.02em]">{fam.nome}</div>
              <p className="text-[13px] text-muted-foreground">{fam.desc}</p>
              {perguntaAberta && decisao.desempate && (
                <div className="mt-3 rounded-xl bg-warning/15 p-3 text-[13px]">Ficou empatado. <b>{decisao.desempate.q}</b>
                  <div className="mt-2 flex gap-1.5"><Chip on={false} onClick={() => { muda({ familia: decisao.desempate!.sim, formato: null }); setPerguntaAberta(false) }}>Sim</Chip><Chip on={false} onClick={() => { muda({ familia: decisao.desempate!.nao, formato: null }); setPerguntaAberta(false) }}>Não</Chip></div>
                </div>
              )}
              <details className="mt-3" open><summary className="cursor-pointer text-[13px] font-semibold text-[hsl(var(--sel))]">Por que este padrão</summary>
                <ul className="mt-2 grid gap-1 text-[13px]">
                  {decisao.log.filter(l => l.f === p.familia || Math.abs(l.p) >= 6).slice(0, 8).map((l, i) => <li key={i} className="flex gap-2"><b className={cn('min-w-[34px] tabular-nums', l.p < 0 ? 'text-destructive' : 'text-[hsl(var(--sel))]')}>{l.p > 0 ? '+' : ''}{l.p}</b><span>{l.por} → {FAMILIAS[l.f].nome}</span></li>)}
                  <li className="flex gap-2"><b className="min-w-[34px]">=</b><span>{fam.nome} fica em 1º com {decisao.ordem.find(o => o.f === p.familia)?.pts ?? 0} pontos</span></li>
                </ul>
              </details>
              <details className="mt-2"><summary className="cursor-pointer text-[13px] font-semibold text-[hsl(var(--sel))]">Trocar padrão</summary>
                <div className="mt-2 grid gap-1.5">{decisao.ordem.filter(o => o.pts > -10).slice(0, 5).map(o => (
                  <button key={o.f} type="button" aria-pressed={o.f === p.familia} onClick={() => { muda({ familia: o.f, formato: null }); setPerguntaAberta(false) }} className={cn('flex items-center justify-between gap-2 rounded-xl border-[1.5px] bg-card px-3 py-2 text-left', o.f === p.familia ? 'border-primary' : 'border-border')}>
                    <span><b className="text-sm">{FAMILIAS[o.f].nome}</b><br /><small className="text-muted-foreground">{FAMILIAS[o.f].desc.slice(0, 70)}…</small></span><small className="shrink-0 text-muted-foreground">{o.pts} pts</small>
                  </button>))}</div>
              </details>
            </section>
          )}

          {etapa === 'informacoes' && fam && (
            <section className="glass-1 rounded-[20px] p-[18px]" aria-labelledby="t-inf">
              <h2 id="t-inf" className="font-display text-[17px] font-semibold">3 · Informações da arte</h2>
              <p className="mb-1 text-[13px] text-muted-foreground">Só os campos deste padrão. O contador avisa quando o texto não cabe.</p>
              {fam.emBreve && <div className="mt-2 rounded-xl bg-warning/15 p-3 text-[13px]">Este padrão existe nas artes aprovadas ({fam.nome}), mas o molde ainda não entrou. Aqui ele mostra o lugar dele na ferramenta.</div>}
              {fam.campos.map(k => {
                const d = CAMPOS[k]; const id = `c-${k}`;
                if (d.t === 'foto') {
                  const f = texto(p, 'foto');
                  return <div key={k} className="mt-3"><label htmlFor={id} className="block text-[13px] font-semibold">{d.r}</label>
                    <label htmlFor={id} className="mt-1 grid h-28 cursor-pointer place-items-center rounded-xl border-[1.5px] border-dashed border-border bg-[#9fb9c2] bg-cover bg-center font-semibold text-white [text-shadow:0_1px_4px_rgba(0,0,0,.4)]" style={f ? { backgroundImage: `url(${f})` } : undefined}>{f ? '' : 'toque para anexar uma foto da unidade'}</label>
                    <input id={id} type="file" accept="image/*" className="sr-only" onChange={e => { const fl = e.target.files?.[0]; if (!fl) return; const rd = new FileReader(); rd.onload = () => mudaDado('foto', String(rd.result)); rd.readAsDataURL(fl) }} /></div>;
                }
                if (d.t === 'apoio') {
                  const v = texto(p, k);
                  return <div key={k} className="mt-3">
                    <label htmlFor="c-apoio-info" className="block text-[13px] font-semibold">O que você quer dizer? <span className="block text-[11.5px] font-normal text-muted-foreground">Escreva solto: tema, para quem, o que vai ter. A ferramenta monta a frase no padrão.</span></label>
                    <Textarea id="c-apoio-info" className="mt-1" placeholder="ex.: palestra sobre menopausa com a Helga, conversa e acolhimento, saúde da mulher" value={infoDaFrase} onChange={e => setInfoDaFrase(e.target.value)} />
                    <div className="mt-1.5 flex gap-1.5"><Chip on={false} onClick={() => { setVezDaFrase(0); mudaDado('apoio', gerarFrase(infoDaFrase, p.publico, 0, texto(p, 't2') || texto(p, 't1'))) }}><Sparkles className="mr-1 inline h-3.5 w-3.5" aria-hidden />Gerar frase no padrão</Chip><Chip on={false} onClick={() => { const n = vezDaFrase + 1; setVezDaFrase(n); mudaDado('apoio', gerarFrase(infoDaFrase, p.publico, n, texto(p, 't2') || texto(p, 't1'))) }}>Outra versão</Chip></div>
                    <label htmlFor={id} className="mt-2 flex items-baseline justify-between text-[13px] font-semibold">{d.r}<Contador valor={v} max={d.max} /></label>
                    <Textarea id={id} className="mt-1" placeholder={String(d.ex ?? '')} value={v} onChange={e => mudaDado(k, e.target.value)} />
                  </div>;
                }
                if (d.t === 'lista' || d.t === 'lista2') {
                  const L = d.t === 'lista' ? lista(p, k) : pares(p, k); const ex = d.ex as string | [string, string];
                  const setL = (n: unknown[]) => mudaDado(k, n as Pedido['dados'][string]);
                  return <div key={k} className="mt-3"><div className="flex items-baseline justify-between text-[13px] font-semibold">{d.r}<span className="text-[11.5px] font-normal text-muted-foreground">{L.length}/{d.max}</span></div>
                    <div className="mt-1 grid gap-1.5">{L.map((it, i) => <div key={i} className="grid grid-cols-[1fr_auto] gap-1.5">
                      {d.t === 'lista' ? <Input aria-label={`${d.r} ${i + 1}`} value={it as string} placeholder={ex as string} onChange={e => { const n = [...(L as string[])]; n[i] = e.target.value; setL(n) }} />
                        : <div className="grid grid-cols-[1fr_2fr] gap-1.5"><Input aria-label={`${d.r} ${i + 1}, primeira parte`} value={(it as [string, string])[0]} placeholder={(ex as [string, string])[0]} onChange={e => { const n = (L as [string, string][]).map(x => [...x] as [string, string]); n[i][0] = e.target.value; setL(n) }} /><Input aria-label={`${d.r} ${i + 1}, segunda parte`} value={(it as [string, string])[1]} placeholder={(ex as [string, string])[1]} onChange={e => { const n = (L as [string, string][]).map(x => [...x] as [string, string]); n[i][1] = e.target.value; setL(n) }} /></div>}
                      <Button type="button" variant="outline" size="icon" aria-label={`Tirar item ${i + 1}`} onClick={() => setL(L.filter((_, j) => j !== i))}>×</Button>
                    </div>)}</div>
                    <Button type="button" variant="outline" size="sm" className="mt-1.5" disabled={L.length >= (d.max ?? 99)} onClick={() => setL([...L, d.t === 'lista' ? '' : ['', '']])}>+ adicionar</Button>
                  </div>;
                }
                const v = texto(p, k);
                return <label key={k} htmlFor={id} className="mt-3 block text-[13px] font-semibold"><span className="flex items-baseline justify-between">{d.r}<Contador valor={v} max={d.max} /></span>
                  <Input id={id} className="mt-1" type={d.t === 'date' ? 'date' : 'text'} placeholder={String(d.ex ?? '')} value={v} onChange={e => mudaDado(k, e.target.value)} /></label>;
              })}
              <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => ir('conteudo')}>Voltar</Button><Button onClick={() => ir('resumo')}>Ver resumo e enviar</Button></div>
            </section>
          )}

          {etapa === 'resumo' && fam && (
            <section className="glass-1 rounded-[20px] p-[18px]" aria-labelledby="t-res">
              <h2 id="t-res" className="font-display text-[17px] font-semibold">4 · Resumo do pedido</h2>
              <p className="mb-2 text-[13px] text-muted-foreground">O marketing recebe isto junto com a prévia. A arte final é gerada pelo marketing, com os mesmos moldes.</p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13.5px]">
                {[['Padrão', fam.nome], ['Unidade', `${unidade.cheio} · rodapé ${unidade.setor === 'educacao' ? 'Educação' : 'Social'}`], ['Formatos', formatos.map(k => FORMATOS[k].nome).join(' · ')], ['Arquivos', formatos.map(k => FORMATOS[k].saida).join(' · ')],
                  ...(ficha ? [['Impressão', ficha.tamanho], ['Cópias', `${ficha.copias}${ficha.porFolha > 1 ? ` (${ficha.porFolha} por folha)` : ''}`], ['Folhas A4', String(ficha.folhas)], ['Plastificar', ficha.plastificar ? 'Sim' : 'Não'], ['Preto e branco', ficha.pb ? 'Sim (ficha)' : 'Não']] : [['Impressão', 'Não (só digital)']])]
                  .map(([k, v]) => <div key={k} className="contents"><dt className="font-semibold">{k}</dt><dd className="text-muted-foreground">{v}</dd></div>)}
              </dl>
              {avisos.map((a, i) => <div key={i} className="mt-2 rounded-xl bg-warning/15 p-2.5 text-[13px]">{a}</div>)}
              <label htmlFor="obs" className="mt-3 block text-[13px] font-semibold">Observação para o marketing<Textarea id="obs" className="mt-1" placeholder="ex.: a foto é da festa do ano passado, pode trocar." value={obs} onChange={e => setObs(e.target.value)} /></label>
              <p className="mt-3 text-[13px] text-muted-foreground">Nesta primeira versão o pedido vai por e-mail para {EMAIL_DO_MARKETING}, com a prévia salva por você. A fila do marketing dentro do app vem na próxima etapa.</p>
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={() => ir('informacoes')}>Voltar</Button>
                <Button variant="outline" onClick={copiar}>{copiado ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />} Copiar resumo</Button>
                <Button asChild><a href={mailto}><Mail className="h-4 w-4" aria-hidden /> Enviar ao marketing</a></Button>
              </div>
            </section>
          )}
        </div>

        <div className={cn('lg:sticky lg:top-24', !previa && 'hidden lg:block')}>
          {previa && (
            <div className="mb-2.5 flex flex-wrap gap-1.5" role="group" aria-label="Formato da prévia">
              {formatos.map(k => <Chip key={k} on={k === formato} onClick={() => muda({ formato: k })}>{FORMATOS[k].nome}</Chip>)}
              {p.familia === 'placa' && quantasPlacas(p) > 1 && <><span className="basis-full" />{pares(p, 'placas').filter(x => x[0]).map((_, i) => <Chip key={i} on={placaAtual === i} onClick={() => setPlacaAtual(i)}>Placa {i + 1}</Chip>)}</>}
            </div>
          )}
          <div ref={palco} className="glass-1 grid min-h-[200px] place-items-center overflow-hidden rounded-[20px] p-4 lg:min-h-[300px]">
            {previa ? (
              <div className="relative overflow-hidden rounded shadow-[0_12px_40px_rgba(20,40,36,.18)]" style={{ width: previa.larg, height: previa.alt }} aria-label="Prévia da arte" role="img">
                <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `scale(${previa.escala})` }} dangerouslySetInnerHTML={{ __html: previa.html }} />
              </div>
            ) : <small className="text-muted-foreground">A prévia aparece assim que o padrão for escolhido.</small>}
          </div>
          {previa && <p className="mt-2 text-center text-[12.5px] text-muted-foreground">{fam?.nome} · {previa.F.nome} · sai como {previa.F.saida}</p>}
        </div>
      </div>
    </div>
  );
}
