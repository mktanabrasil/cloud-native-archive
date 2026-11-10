import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import { ROTULO_DA_AREA, reais, rotuloDoSabor, type Area } from '@/lib/pizza/modelo';
import {
  calcular, filtrar, grupoDoPagamento, lerDashboard, pagamentoPorExtenso, ranking,
  type DadosDoDashboard, type Dia, type Filtros, type Grupo, type PedidoDoDashboard,
} from '@/lib/pizza/dashboard';

/**
 * O dashboard da Pizza da Alegria (mockup aprovado em 10/11/2026:
 * https://claude.ai/artifact/41wgaj3mM5yXTcrXmwSMwB). Os mesmos gráficos para
 * a equipe (com login, mostra o número do pedido) e para a gestão (link com
 * código, sem o número). Busca de novo a cada 30 segundos.
 *
 * Cores: as da Pizza (fundo creme claro, sempre, como o formulário). As três
 * cores dos gráficos de grupos foram validadas para daltonismo (teal,
 * vermelho, azul, nessa ordem).
 */

export const ATUALIZA_A_CADA_MS = 30_000;

const COR = {
  fundo: '#FFFBF5', cartao: '#FFFFFF', tinta: '#2B1A14', mut: '#7A6359', linha: '#EADBC8', grade: '#F1E6D6',
  vermelho: '#D8463A', vermelhoEsc: '#A9322A', creme: '#F4E7D2', marrom: '#6B2E1C',
};
const COR_DO_GRUPO: Record<Grupo, string> = { pix: '#1F9E89', unidade: '#D8463A', cartao: '#0B84C6' };
const CHIP_DO_GRUPO: Record<Grupo, { bg: string; tx: string }> = {
  pix: { bg: '#DDF3EE', tx: '#12695A' }, unidade: { bg: '#FFF1BF', tx: '#7A5A00' }, cartao: { bg: '#DCEEFA', tx: '#0A5E8E' },
};
const COR_DA_AREA: Record<Area, string> = { social: '#1F9E89', educacao: '#D8463A' };
const FIO = ['#F5DFBB', '#FBCE00', '#F37964', '#81E2CF', '#01ADFF'];

const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
const dataCurta = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' });
const semCentavos = (n: number) => reais(n).replace(/,00$/, '');
const plural = (n: number, um: string, varios: string) => `${n.toLocaleString('pt-BR')} ${n === 1 ? um : varios}`;

function Cartao({ titulo, sub, children, testid }: { titulo: string; sub?: string; children: React.ReactNode; testid?: string }) {
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-2xl border-[1.5px] p-4" style={{ background: COR.cartao, borderColor: COR.linha }} data-testid={testid}>
      <div className="flex flex-col gap-0.5">
        <h2 className="text-[15px] font-semibold">{titulo}</h2>
        {sub && <p className="text-[12.5px]" style={{ color: COR.mut }}>{sub}</p>}
      </div>
      {children}
    </section>
  );
}

/**
 * Barras horizontais com o número ao lado; o maior valor ocupa a largura toda.
 * As colunas têm largura fixa (`colunas`), para todas as barras começarem no mesmo ponto.
 */
function Barras({ linhas, rotuloDoValor, aoClicar, ativo, colunas }: {
  linhas: Array<{ id: string; rotulo: string; n: number; extra?: string }>;
  rotuloDoValor: (n: number) => string;
  aoClicar?: (id: string) => void;
  ativo?: string | null;
  colunas: string;
}) {
  const max = Math.max(1, ...linhas.map((l) => l.n));
  return (
    <ul className="flex flex-col gap-1.5">
      {linhas.map((l) => {
        const clicavel = !!aoClicar && l.id !== 'outras';
        const conteudo = (
          <>
            <span className="truncate text-left">{l.rotulo}</span>
            <span className="flex h-3.5 items-center"><span className="block h-3.5 rounded-r" style={{ width: `${Math.max(l.n ? 2 : 0, (l.n / max) * 100)}%`, background: l.id === 'outras' ? '#C9BBAA' : COR.vermelho, opacity: ativo && ativo !== l.id ? 0.35 : 1 }} /></span>
            <span className="text-right text-[12.5px] font-semibold tabular-nums">{rotuloDoValor(l.n)}{l.extra && <span className="font-normal" style={{ color: COR.mut }}> · {l.extra}</span>}</span>
          </>
        );
        const classe = `grid w-full ${colunas} items-center gap-2.5 rounded-lg px-1 py-0.5 text-[13px] max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:[&>span:nth-child(2)]:order-3 max-sm:[&>span:nth-child(2)]:col-span-2`;
        return (
          <li key={l.id} title={`${l.rotulo}: ${rotuloDoValor(l.n)}${l.extra ? ` · ${l.extra}` : ''}`}>
            {clicavel
              ? <button type="button" className={`${classe} hover:bg-[#D8463A]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#D8463A]`} onClick={() => aoClicar!(l.id)} aria-pressed={ativo === l.id}>{conteudo}</button>
              : <div className={classe}>{conteudo}</div>}
          </li>
        );
      })}
    </ul>
  );
}

/** Uma barra só, dividida em partes, com a legenda embaixo (nome, número e %). */
function Empilhada({ partes, rotulo }: { partes: Array<{ id: string; rotulo: string; n: number; cor: string }>; rotulo: string }) {
  const total = partes.reduce((a, p) => a + p.n, 0);
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex h-[26px] gap-0.5" role="img" aria-label={`${rotulo}: ${partes.map((p) => `${p.rotulo} ${p.n}`).join(', ')}`}>
        {total === 0 && <span className="h-full w-full rounded" style={{ background: COR.creme }} />}
        {partes.filter((p) => p.n > 0).map((p, i, vis) => (
          <span key={p.id} title={`${p.rotulo}: ${p.n} (${pct(p.n)}%)`} className="h-full"
            style={{ width: `${(p.n / total) * 100}%`, background: p.cor, borderRadius: `${i === 0 ? 4 : 0}px ${i === vis.length - 1 ? 4 : 0}px ${i === vis.length - 1 ? 4 : 0}px ${i === 0 ? 4 : 0}px` }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px]">
        {partes.map((p) => (
          <span key={p.id} className="inline-flex items-center gap-1.5">
            <i className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: p.cor }} />
            {p.rotulo} <b className="tabular-nums">{p.n}</b> <span style={{ color: COR.mut }}>{pct(p.n)}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Pizzas por dia: área com linha, o maior dia marcado, e a leitura do dia ao passar o mouse. */
function PorDia({ dias }: { dias: Dia[] }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  const [foco, setFoco] = useState<number | null>(null);
  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const medir = () => setW(Math.max(280, Math.round(el.clientWidth)));
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  if (!dias.length) return <p className="py-6 text-center text-sm" style={{ color: COR.mut }}>Nenhum pedido ainda.</p>;

  const H = 200, m = { t: 22, r: 12, b: 26, l: 32 };
  const maxV = Math.max(...dias.map((d) => d.pizzas));
  const passo = maxV <= 5 ? 1 : maxV <= 20 ? 5 : maxV <= 50 ? 10 : Math.ceil(maxV / 40) * 10;
  const topo = Math.max(passo, Math.ceil(maxV / passo) * passo);
  const so1 = dias.length === 1;
  const x = (i: number) => (so1 ? (m.l + W - m.r) / 2 : m.l + (i * (W - m.l - m.r)) / (dias.length - 1));
  const y = (v: number) => m.t + (1 - v / topo) * (H - m.t - m.b);
  const linha = dias.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.pizzas).toFixed(1)}`).join('');
  const area = `${linha}L${x(dias.length - 1)},${y(0)}L${x(0)},${y(0)}Z`;
  const iMax = dias.findIndex((d) => d.pizzas === maxV);
  const cadaQuantos = Math.max(1, Math.ceil(dias.length / Math.floor((W - m.l) / 52)));
  const marcas: number[] = [];
  for (let t = 0; t <= topo; t += passo) marcas.push(t);

  function mover(e: React.MouseEvent<SVGRectElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    setFoco(so1 ? 0 : Math.max(0, Math.min(dias.length - 1, Math.round(((e.clientX - r.left) / r.width) * (dias.length - 1)))));
  }
  const f = foco !== null ? dias[foco] : null;

  return (
    <div ref={caixa} className="relative w-full">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Pizzas por dia, de ${dias[0].rotulo} a ${dias[dias.length - 1].rotulo}. O maior dia foi ${dias[iMax].rotulo}, com ${maxV}.`}>
        {marcas.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} stroke={COR.grade} />
            <text x={m.l - 6} y={y(t) + 4} textAnchor="end" fontSize="10.5" fill={COR.mut}>{t}</text>
          </g>
        ))}
        {dias.map((d, i) => (i % cadaQuantos === 0 || i === dias.length - 1) && (
          <text key={d.dia} x={x(i)} y={H - 6} textAnchor="middle" fontSize="10.5" fill={COR.mut}>{d.rotulo}</text>
        ))}
        {!so1 && <path d={area} fill={COR.vermelho} fillOpacity={0.14} />}
        {!so1 && <path d={linha} fill="none" stroke={COR.vermelho} strokeWidth={2} strokeLinejoin="round" />}
        {maxV > 0 && (
          <>
            <circle cx={x(iMax)} cy={y(maxV)} r={4.5} fill={COR.vermelho} stroke={COR.cartao} strokeWidth={2} />
            <text x={Math.min(Math.max(x(iMax), m.l + 40), W - m.r - 40)} y={y(maxV) - 9} textAnchor="middle" fontSize="11.5" fontWeight={600} fill={COR.tinta}>{maxV} em {dias[iMax].rotulo}</text>
          </>
        )}
        {f && (
          <>
            <line x1={x(foco!)} x2={x(foco!)} y1={m.t} y2={y(0)} stroke={COR.mut} strokeDasharray="3 3" />
            <circle cx={x(foco!)} cy={y(f.pizzas)} r={4.5} fill={COR.vermelho} stroke={COR.cartao} strokeWidth={2} />
          </>
        )}
        <rect x={m.l} y={m.t} width={Math.max(1, W - m.l - m.r)} height={H - m.t - m.b} fill="transparent" onMouseMove={mover} onMouseLeave={() => setFoco(null)} />
      </svg>
      {f && (
        <div className="pointer-events-none absolute top-0 rounded-lg px-2.5 py-1.5 text-xs" data-testid="leitura-do-dia"
          style={{ background: COR.tinta, color: COR.fundo, left: Math.min(Math.max(0, x(foco!) - 70), W - 150) }}>
          {f.rotulo}: <b>{plural(f.pizzas, 'pizza', 'pizzas')}</b> · {reais(f.valor)}
        </div>
      )}
    </div>
  );
}

function ChipPagamento({ p }: { p: PedidoDoDashboard }) {
  const g = grupoDoPagamento(p);
  const rotulo = g === 'pix' ? 'Pix' : g === 'cartao' ? 'Cartão' : 'Na unidade';
  return <span className="inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px] font-medium" title={pagamentoPorExtenso(p)} style={{ background: CHIP_DO_GRUPO[g].bg, color: CHIP_DO_GRUPO[g].tx }}>{rotulo}</span>;
}

function ChipRetirada({ p }: { p: PedidoDoDashboard }) {
  if (!p.retirada) return <span className="inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px]" style={{ background: COR.creme, color: COR.marrom }}>A retirar</span>;
  return <span className="inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px] font-bold" style={{ background: '#E3F2E9', color: '#1E6B41' }}>✓ {p.retirada_em ? `${dataCurta(p.retirada_em)} ${hora(p.retirada_em)}` : 'Retirada'}</span>;
}

const POR_PAGINA = 50;

export function DashboardDaPizza({ codigo, topo }: { codigo?: string; topo?: React.ReactNode }) {
  const equipe = !codigo;
  const [dados, setDados] = useState<DadosDoDashboard | null>(null);
  const [erro, setErro] = useState<'codigo' | 'permissao' | 'rede' | null>(null);
  const [filtros, setFiltros] = useState<Filtros>({ area: null, unidade: null });
  const [busca, setBusca] = useState('');
  const [todos, setTodos] = useState(false);

  const buscar = useCallback(async () => {
    try {
      setDados(await lerDashboard(codigo));
      setErro(null);
    } catch (e) {
      const msg = String((e as { message?: string })?.message ?? e);
      setErro(/codigo_invalido/.test(msg) ? 'codigo' : /sem_permissao/.test(msg) ? 'permissao' : 'rede');
    }
  }, [codigo]);

  useEffect(() => {
    buscar();
    const t = window.setInterval(buscar, ATUALIZA_A_CADA_MS);
    return () => window.clearInterval(t);
  }, [buscar]);

  const unidades = useMemo(() => {
    const m = new Map<string, { nome: string; area: Area }>();
    (dados?.pedidos ?? []).forEach((p) => m.set(p.unidade_id, { nome: p.unidade_nome, area: p.area }));
    return [...m.entries()].filter(([, u]) => !filtros.area || u.area === filtros.area).sort((a, b) => a[1].nome.localeCompare(b[1].nome));
  }, [dados, filtros.area]);

  const vistos = useMemo(() => filtrar(dados?.pedidos ?? [], filtros), [dados, filtros]);
  const contas = useMemo(() => (dados ? calcular(vistos, dados.agora) : null), [vistos, dados]);
  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return [...vistos].reverse().filter((p) => !q || p.nome.toLowerCase().includes(q) || (p.numero ?? '').toLowerCase().includes(q));
  }, [vistos, busca]);

  if (erro === 'codigo') {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-2 px-4 py-20 text-center" style={{ color: COR.tinta }}>
        <h1 className="text-lg font-semibold">Este link não vale mais</h1>
        <p className="text-sm" style={{ color: COR.mut }}>O endereço do acompanhamento foi trocado. Peça o link novo à comunicação.</p>
      </div>
    );
  }
  if (erro === 'permissao') {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-2 px-4 py-20 text-center">
        <h1 className="text-lg font-semibold">Acesso restrito</h1>
        <p className="text-sm text-muted-foreground">O dashboard da Pizza da Alegria é do ADM e da comunicação.</p>
      </div>
    );
  }

  const c = contas;
  const pct = c && c.pedidos ? Math.round((c.retirados / c.pedidos) * 100) : 0;
  const maisPedido = c?.porSabor.find((s) => s.pizzas > 0);
  const filtroAtivo = !!(filtros.area || filtros.unidade);

  return (
    <div className="flex flex-col gap-4 rounded-3xl p-4 sm:p-6" style={{ background: COR.fundo, color: COR.tinta }} data-testid="dashboard-pizza">
      <div className="flex h-1.5 max-w-[320px] overflow-hidden rounded" aria-hidden="true">{FIO.map((cor) => <span key={cor} className="flex-1" style={{ background: cor }} />)}</div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: COR.vermelhoEsc }}>{equipe ? 'Dashboard' : 'Acompanhamento'}</span>
          <h1 className="text-[26px] font-extrabold leading-tight">Pizza da Alegria 2026</h1>
          <p className="flex items-center gap-1.5 text-[13px]" style={{ color: COR.mut }}>
            {dados ? <>Atualizado às {hora(dados.agora)} · atualiza sozinho</> : erro === 'rede' ? 'Sem conexão; tentando de novo…' : 'Carregando…'}
            <button type="button" onClick={buscar} className="inline-flex items-center rounded p-1 hover:bg-black/5" aria-label="Atualizar agora"><RefreshCw className="h-3.5 w-3.5" /></button>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {topo}
          <select aria-label="Área" value={filtros.area ?? ''} onChange={(e) => setFiltros({ area: (e.target.value || null) as Area | null, unidade: null })}
            className="h-9 rounded-[10px] border-[1.5px] bg-white px-2.5 text-[13px] font-medium" style={{ borderColor: COR.linha, color: COR.tinta }}>
            <option value="">Todas as áreas</option>
            <option value="educacao">{ROTULO_DA_AREA.educacao}</option>
            <option value="social">{ROTULO_DA_AREA.social}</option>
          </select>
          <select aria-label="Unidade" value={filtros.unidade ?? ''} onChange={(e) => setFiltros((f) => ({ ...f, unidade: e.target.value || null }))}
            className="h-9 max-w-[260px] rounded-[10px] border-[1.5px] bg-white px-2.5 text-[13px] font-medium" style={{ borderColor: COR.linha, color: COR.tinta }}>
            <option value="">Todas as unidades</option>
            {unidades.map(([id, u]) => <option key={id} value={id}>{u.nome}</option>)}
          </select>
          {filtroAtivo && <button type="button" className="text-[13px] font-semibold underline" style={{ color: COR.vermelhoEsc }} onClick={() => setFiltros({ area: null, unidade: null })}>Limpar filtros</button>}
        </div>
      </div>

      {c && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="col-span-2 flex min-w-0 flex-col gap-0.5 rounded-2xl p-4 lg:col-span-1" style={{ background: COR.vermelho, color: '#FFF' }} data-testid="kpi-arrecadado">
              <span className="text-[12.5px] opacity-90">Arrecadado</span>
              <span className="text-[28px] font-extrabold leading-tight tabular-nums">{semCentavos(c.valor)}</span>
              <span className="text-[12.5px] opacity-90">{plural(c.pizzas, 'pizza', 'pizzas')}</span>
            </div>
            {[
              ['Pedidos', c.pedidos.toLocaleString('pt-BR'), c.pedidos ? `${(c.pizzas / c.pedidos).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} pizza por pedido` : '—'],
              ['Pizzas', c.pizzas.toLocaleString('pt-BR'), maisPedido ? `${maisPedido.rotulo} é a mais pedida` : '—'],
            ].map(([t, v, d]) => (
              <div key={t} className="flex min-w-0 flex-col gap-0.5 rounded-2xl border-[1.5px] p-4" style={{ background: COR.cartao, borderColor: COR.linha }} data-testid={`kpi-${t}`}>
                <span className="text-[12.5px]" style={{ color: COR.mut }}>{t}</span>
                <span className="text-[28px] font-extrabold leading-tight tabular-nums">{v}</span>
                <span className="truncate text-[12.5px]" style={{ color: COR.mut }}>{d}</span>
              </div>
            ))}
            <div className="col-span-2 flex min-w-0 flex-col gap-0.5 rounded-2xl border-[1.5px] p-4 lg:col-span-1" style={{ background: COR.cartao, borderColor: COR.linha }} data-testid="kpi-Retiradas">
              <span className="text-[12.5px]" style={{ color: COR.mut }}>Retiradas</span>
              <span className="text-[28px] font-extrabold leading-tight tabular-nums">{c.retirados} <small className="text-[15px] font-medium" style={{ color: COR.mut }}>de {c.pedidos}</small></span>
              <span className="mt-1 h-2 overflow-hidden rounded" style={{ background: COR.creme }} role="img" aria-label={`${pct}% retirados`}><span className="block h-full rounded" style={{ width: `${pct}%`, background: COR_DO_GRUPO.pix }} /></span>
              <span className="text-[12.5px]" style={{ color: COR.mut }}>{pct}% · {c.pedidos - c.retirados === 0 ? 'nenhum a retirar' : `faltam ${plural(c.pedidos - c.retirados, 'pedido', 'pedidos')}`}</span>
            </div>
          </div>

          <Cartao titulo="Pizzas por dia" sub="Do primeiro pedido até hoje. Pedidos até 30/11." testid="por-dia">
            <PorDia dias={c.porDia} />
          </Cartao>

          <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
            <Cartao titulo="Unidades que mais compraram" sub="Pizzas por unidade, com o valor. Toque numa unidade para filtrar." testid="ranking">
              {c.porUnidade.length
                ? <Barras colunas="grid-cols-[minmax(0,15rem)_minmax(0,1fr)_7.5rem]" linhas={ranking(c.porUnidade).map((u) => ({ id: u.id, rotulo: u.nome, n: u.pizzas, extra: semCentavos(u.valor) }))} rotuloDoValor={(n) => String(n)}
                    ativo={filtros.unidade} aoClicar={(id) => setFiltros((f) => ({ ...f, unidade: f.unidade === id ? null : id }))} />
                : <p className="text-sm" style={{ color: COR.mut }}>Nenhum pedido ainda.</p>}
            </Cartao>
            <div className="flex min-w-0 flex-col gap-4">
              <Cartao titulo="Sabores" sub="Pizzas de cada sabor" testid="sabores">
                <Barras colunas="grid-cols-[minmax(0,9.5rem)_minmax(0,1fr)_2.5rem]" linhas={c.porSabor.map((s) => ({ id: s.sabor, rotulo: s.rotulo, n: s.pizzas }))} rotuloDoValor={(n) => String(n)} />
              </Cartao>
              <Cartao titulo="Como pagaram" sub="Pizzas por forma de pagamento" testid="formas">
                <Empilhada rotulo="Como pagaram" partes={c.porGrupo.map((g) => ({ id: g.grupo, rotulo: g.rotulo, n: g.pizzas, cor: COR_DO_GRUPO[g.grupo] }))} />
              </Cartao>
              <Cartao titulo="Por área" sub="Pizzas de Social e de Educação" testid="areas">
                <Empilhada rotulo="Por área" partes={c.porArea.map((a) => ({ id: a.area, rotulo: a.rotulo, n: a.pizzas, cor: COR_DA_AREA[a.area] }))} />
              </Cartao>
            </div>
          </div>

          <Cartao titulo="Pedidos" sub="Os mais recentes primeiro" testid="pedidos">
            <label className="relative w-full max-w-[300px]">
              <span className="sr-only">Buscar pedido</span>
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: COR.mut }} />
              <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={equipe ? 'Buscar nome ou número' : 'Buscar nome'}
                className="h-9 w-full rounded-[10px] border-[1.5px] bg-white pl-8 pr-3 text-[13px]" style={{ borderColor: COR.linha, color: COR.tinta }} />
            </label>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-[13px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[0.08em]" style={{ color: COR.mut }}>
                    {equipe && <th className="border-b-[1.5px] px-2 py-2 font-semibold" style={{ borderColor: COR.linha }}>Nº</th>}
                    {['Nome', 'Unidade', 'Sabores'].map((t) => <th key={t} className="border-b-[1.5px] px-2 py-2 font-semibold" style={{ borderColor: COR.linha }}>{t}</th>)}
                    <th className="border-b-[1.5px] px-2 py-2 text-right font-semibold" style={{ borderColor: COR.linha }}>Valor</th>
                    {['Pagamento', 'Retirada'].map((t) => <th key={t} className="border-b-[1.5px] px-2 py-2 font-semibold" style={{ borderColor: COR.linha }}>{t}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {(todos ? lista : lista.slice(0, POR_PAGINA)).map((p, i) => (
                    <tr key={`${p.created_at}-${i}`} className="hover:bg-[#D8463A]/5" data-testid="linha-pedido">
                      {equipe && <td className="border-b px-2 py-2 font-bold" style={{ borderColor: COR.grade, color: COR.vermelho }}>{p.numero}</td>}
                      <td className="border-b px-2 py-2" style={{ borderColor: COR.grade }}>{p.nome}</td>
                      <td className="border-b px-2 py-2" style={{ borderColor: COR.grade, color: COR.mut }}>{p.unidade_nome}</td>
                      <td className="border-b px-2 py-2" style={{ borderColor: COR.grade }}>
                        <span className="inline-flex flex-wrap gap-1">
                          {Object.entries(p.sabores ?? {}).filter(([, n]) => Number(n) > 0).map(([k, n]) => (
                            <span key={k} className="rounded-full px-2 py-px text-[11.5px] font-medium" style={{ background: COR.creme, color: COR.marrom }}>{n} {rotuloDoSabor(k)}</span>
                          ))}
                        </span>
                      </td>
                      <td className="border-b px-2 py-2 text-right tabular-nums" style={{ borderColor: COR.grade }}>{reais(p.total)}</td>
                      <td className="border-b px-2 py-2" style={{ borderColor: COR.grade }}><ChipPagamento p={p} /></td>
                      <td className="border-b px-2 py-2" style={{ borderColor: COR.grade }}><ChipRetirada p={p} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!lista.length && <p className="py-6 text-center text-sm" style={{ color: COR.mut }}>{busca ? 'Nenhum pedido com essa busca.' : 'Nenhum pedido ainda.'}</p>}
            </div>
            {!todos && lista.length > POR_PAGINA && (
              <button type="button" onClick={() => setTodos(true)} className="self-start text-[13px] font-semibold underline" style={{ color: COR.vermelhoEsc }}>
                Mostrar todos os {lista.length} pedidos
              </button>
            )}
          </Cartao>
        </>
      )}
    </div>
  );
}
