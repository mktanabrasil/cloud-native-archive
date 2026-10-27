import { useEffect, useMemo, useState } from 'react';
import { Download, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useUserRole } from '@/hooks/useUserRole';
import { baixarArquivo } from '@/lib/enquetes/planilha';
import { linkDoComprovante, listarConfirmacoes, marcarRetirada, type Confirmacao } from '@/lib/pizza/api';
import { FORMAS, ROTULO_DA_AREA, SABORES, reais, resumoDosSabores, rotuloDaForma } from '@/lib/pizza/modelo';
import { csvDasConfirmacoes, nomeDaPlanilha } from '@/lib/pizza/planilha';
import { DriveDaPizza } from './DriveDaPizza';

/**
 * O painel da Pizza da Alegria (mockup de 07/10/2026): só ADM (vínculo
 * financeiro), comunicação e admin; as gestoras não entram. Números gerais,
 * pizzas por sabor (a lista de produção), valor por forma de pagamento (a
 * conciliação), a lista com o comprovante e a retirada, o filtro por unidade
 * e a planilha. O mesmo critério do banco: `pode_ver_pizza`.
 */

export const LINK_DO_FORMULARIO = 'https://app.anabrasil.org/pizza-da-alegria';

function Barras({ titulo, linhas, cor }: { titulo: string; linhas: Array<{ rotulo: string; n: number; texto: string }>; cor: string }) {
  const max = Math.max(1, ...linhas.map((l) => l.n));
  return (
    <div className="flex min-w-0 flex-col gap-2 p-4">
      <b className="text-[15px] font-semibold">{titulo}</b>
      {linhas.map((l) => (
        <div key={l.rotulo} className="grid grid-cols-[120px_minmax(0,1fr)_84px] items-center gap-2 text-sm">
          <span className="truncate">{l.rotulo}</span>
          <span className="h-2.5 rounded-full bg-muted"><span className="block h-full rounded-full" style={{ width: `${(l.n / max) * 100}%`, background: cor }} /></span>
          <span className="text-right tabular-nums text-muted-foreground">{l.texto}</span>
        </div>
      ))}
    </div>
  );
}

export function PainelDaPizza() {
  const { isMarketing, bondType, isActive, loading } = useUserRole();
  const pode = isMarketing || (bondType === 'financeiro' && isActive);
  const [lista, setLista] = useState<Confirmacao[] | null>(null);
  const [erro, setErro] = useState(false);
  const [unidade, setUnidade] = useState<string | null>(null);

  const carregar = () => { setErro(false); listarConfirmacoes().then(setLista).catch(() => { setErro(true); setLista([]); }); };
  useEffect(() => { if (pode) carregar(); }, [pode]);

  const unidades = useMemo(() => {
    const m = new Map<string, string>();
    (lista ?? []).forEach((c) => m.set(c.unidade_id, c.unidade_nome));
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [lista]);
  const vistas = useMemo(() => (lista ?? []).filter((c) => !unidade || c.unidade_id === unidade), [lista, unidade]);

  if (loading) return null;
  if (!pode) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-20 text-center">
        <Lock className="h-10 w-10 text-muted-foreground" />
        <h1 className="text-lg font-semibold">Acesso restrito</h1>
        <p className="text-sm text-muted-foreground">O painel da Pizza da Alegria é do ADM e da comunicação.</p>
      </div>
    );
  }

  const pizzas = vistas.reduce((a, c) => a + c.quantidade, 0);
  const valor = vistas.reduce((a, c) => a + c.total, 0);
  const porSabor = SABORES.map(([k, r]) => { const n = vistas.reduce((a, c) => a + (c.sabores[k] ?? 0), 0); return { rotulo: r, n, texto: String(n) }; }).sort((a, b) => b.n - a.n);
  const porForma = FORMAS.map(([k, r]) => { const n = vistas.filter((c) => c.forma === k).reduce((a, c) => a + c.total, 0); return { rotulo: r, n, texto: reais(n) }; });

  async function ver(c: Confirmacao) {
    if (!c.comprovante_caminho) return;
    const aba = window.open('', '_blank');
    try { const url = await linkDoComprovante(c.comprovante_caminho); if (aba) aba.location.href = url; else window.location.href = url; }
    catch { aba?.close(); toast.error('Não consegui abrir o comprovante.'); }
  }

  async function retirar(c: Confirmacao, v: boolean) {
    setLista((l) => (l ?? []).map((x) => (x.id === c.id ? { ...x, retirada: v } : x)));
    try { await marcarRetirada(c.id, v); }
    catch { setLista((l) => (l ?? []).map((x) => (x.id === c.id ? { ...x, retirada: !v } : x))); toast.error('Não deu para marcar a retirada.'); }
  }

  async function copiarLink() {
    try { await navigator.clipboard.writeText(LINK_DO_FORMULARIO); toast.success('Link do formulário copiado.'); }
    catch { toast.message(LINK_DO_FORMULARIO); }
  }

  const retiradas = vistas.filter((c) => c.retirada).length;
  const numeros: Array<[string, string]> = [['Confirmações', String(vistas.length)], ['Pizzas', String(pizzas)], ['Valor', reais(valor)], ['Retiradas', `${retiradas} de ${vistas.length}`]];
  // Uma lista só para computador e celular: na tela larga vira tabela (colunas),
  // na estreita cada confirmação empilha em duas colunas, sem rolar para o lado.
  const COLUNAS = 'lg:grid-cols-[84px_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.3fr)_96px_110px_96px_110px]';

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold leading-tight">Pizza da Alegria</h1>
          <p className="text-sm text-muted-foreground">Confirmações de pagamento · até 30/11 · retirada 04/12</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={copiarLink}>Copiar link do formulário</Button>
          <Button variant="outline" size="sm" onClick={carregar}>Atualizar</Button>
          <Button size="sm" disabled={!vistas.length} onClick={() => baixarArquivo(csvDasConfirmacoes(vistas), nomeDaPlanilha(unidade))}><Download className="h-4 w-4" /> Baixar planilha</Button>
        </div>
      </div>

      <DriveDaPizza />

      {/* Esboço V2: filtro por unidade como abas segmentadas */}
      <div className="inline-flex max-w-full gap-0.5 self-start overflow-x-auto rounded-[14px] bg-muted p-1" role="group" aria-label="Filtrar por unidade">
        {([[null, 'Todas as unidades'], ...unidades] as Array<[string | null, string]>).map(([id, nome]) => (
          <button
            key={id ?? 'todas'}
            type="button"
            aria-pressed={unidade === id}
            onClick={() => setUnidade(id)}
            className={`shrink-0 whitespace-nowrap rounded-[10px] px-3 py-1.5 text-[13.5px] transition-colors ${unidade === id ? 'bg-card font-semibold text-foreground shadow-[0_1px_3px_hsl(165_30%_12%/0.12)]' : 'font-medium text-muted-foreground hover:text-foreground'}`}
          >
            {nome}
          </button>
        ))}
      </div>

      {erro && <p role="alert" className="inline-flex items-center gap-1.5 text-sm font-semibold text-destructive"><span className="h-1.5 w-1.5 rounded-full bg-current" />Não consegui carregar as confirmações. Toque em Atualizar.</p>}

      {/* Faixa de números (padrão do Dashboard) */}
      <div className="glass-1 grid grid-cols-2 overflow-hidden rounded-[20px] lg:grid-cols-4">
        {numeros.map(([r, v], i) => (
          <div
            key={r}
            className={`border-black/10 p-4 dark:border-white/10 sm:px-5 ${i % 2 === 1 ? 'border-l' : ''} ${i >= 2 ? 'border-t lg:border-t-0' : ''} ${i === 2 ? 'lg:border-l' : ''}`}
            data-testid={`kpi-${r}`}
          >
            <b className="block font-display text-2xl font-bold tabular-nums sm:text-3xl">{v}</b>
            <span className="mt-0.5 block text-[13px] text-muted-foreground">{r}</span>
          </div>
        ))}
      </div>

      <div className="grid overflow-hidden rounded-[20px] border border-black/5 bg-card dark:border-white/5 md:grid-cols-2 md:divide-x md:divide-border/70">
        <Barras titulo="Por sabor (para a produção)" linhas={porSabor} cor="#D8463A" />
        <Barras titulo="Por forma de pagamento (conciliação)" linhas={porForma} cor="#6B2E1C" />
      </div>

      {lista === null ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : vistas.length === 0 ? (
        <p className="rounded-[20px] border border-dashed border-border p-6 text-sm text-muted-foreground">Nenhuma confirmação ainda. Copie o link do formulário e mande para as unidades.</p>
      ) : (
        <div className="overflow-hidden rounded-[20px] border border-black/5 bg-card text-sm dark:border-white/5">
          <div className={`hidden gap-3 border-b border-border px-4 py-3 text-xs font-semibold text-muted-foreground lg:grid ${COLUNAS}`} aria-hidden="true">
            <span>Nº</span><span>Unidade</span><span>Nome</span><span>Pizzas</span><span className="text-right">Valor</span><span>Pagamento</span><span>Comprovante</span><span>Retirada</span>
          </div>
          <ul>
            {vistas.map((c) => (
              <li key={c.id} className={`grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 border-b border-border/70 px-4 py-3.5 transition-colors last:border-b-0 hover:bg-muted/40 lg:items-center lg:gap-3 lg:py-3 ${COLUNAS}`} data-testid="confirmacao">
                <span className="order-1 font-semibold tabular-nums lg:order-none">{c.numero}</span>
                <span className="order-5 col-span-2 text-muted-foreground lg:order-none lg:col-span-1 lg:text-foreground">
                  {c.unidade_nome}<span className="lg:hidden"> · </span><span className="text-xs text-[hsl(var(--fraco))] lg:block">{ROTULO_DA_AREA[c.area]}</span>
                </span>
                <span className="order-3 min-w-0 font-semibold lg:order-none lg:font-normal">{c.nome}</span>
                <span className="order-6 col-span-2 lg:order-none lg:col-span-1">{resumoDosSabores(c.sabores)}</span>
                <span className="order-4 text-right font-semibold tabular-nums lg:order-none lg:font-normal">{reais(c.total)}</span>
                <span className="order-7 text-muted-foreground lg:order-none">{rotuloDaForma(c.forma)}</span>
                <span className="order-8 text-right lg:order-none lg:text-left">{c.comprovante_caminho ? <button type="button" className="font-semibold text-[hsl(var(--sel))] hover:underline" onClick={() => ver(c)}>ver</button> : <span className="text-xs text-muted-foreground">sem anexo</span>}</span>
                <span className="order-2 lg:order-none">
                  <label className="flex min-h-11 cursor-pointer items-center justify-end gap-2 lg:min-h-0 lg:justify-start"><Checkbox checked={c.retirada} onCheckedChange={(v) => retirar(c, v === true)} aria-label={`Retirada ${c.numero}`} /> <span className={c.retirada ? 'text-[13px] font-semibold text-success' : 'text-[13px] text-muted-foreground lg:hidden'}>{c.retirada ? 'retirada' : 'a retirar'}</span></label>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
