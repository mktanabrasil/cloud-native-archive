import { useEffect, useMemo, useState } from 'react';
import { Copy, Download, Lock, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useUserRole } from '@/hooks/useUserRole';
import { baixarArquivo } from '@/lib/enquetes/planilha';
import { linkDoComprovante, listarConfirmacoes, marcarRetirada, type Confirmacao } from '@/lib/pizza/api';
import { FORMAS, ROTULO_DA_AREA, SABORES, reais, resumoDosSabores, rotuloDaForma } from '@/lib/pizza/modelo';
import { csvDasConfirmacoes, nomeDaPlanilha } from '@/lib/pizza/planilha';

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
      <b className="text-sm">{titulo}</b>
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Pizza da Alegria</h1>
          <p className="text-sm text-muted-foreground">Confirmações de pagamento · até 30/11 · retirada 04/12</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={copiarLink}><Copy className="h-4 w-4" /> Copiar link do formulário</Button>
          <Button variant="outline" size="sm" onClick={carregar}><RefreshCw className="h-4 w-4" /> Atualizar</Button>
          <Button size="sm" disabled={!vistas.length} onClick={() => baixarArquivo(csvDasConfirmacoes(vistas), nomeDaPlanilha(unidade))}><Download className="h-4 w-4" /> Baixar planilha</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por unidade">
        <Button size="sm" variant={unidade === null ? 'default' : 'secondary'} className="h-8 rounded-full" onClick={() => setUnidade(null)}>Todas as unidades</Button>
        {unidades.map(([id, nome]) => (
          <Button key={id} size="sm" variant={unidade === id ? 'default' : 'secondary'} className="h-8 rounded-full" onClick={() => setUnidade(id)}>{nome}</Button>
        ))}
      </div>

      {erro && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950/60 dark:text-red-100">Não consegui carregar as confirmações. Toque em Atualizar.</p>}

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
          {[['Confirmações', String(vistas.length)], ['Pizzas', String(pizzas)], ['Valor', reais(valor)], ['Retiradas', `${vistas.filter((c) => c.retirada).length} de ${vistas.length}`]].map(([r, v]) => (
            <div key={r} className="flex flex-col gap-0.5 bg-card p-4" data-testid={`kpi-${r}`}>
              <small className="text-[11px] uppercase tracking-wider text-muted-foreground">{r}</small>
              <b className="text-2xl tabular-nums">{v}</b>
            </div>
          ))}
        </div>
        <div className="grid border-t border-border md:grid-cols-2 md:divide-x md:divide-border">
          <Barras titulo="Por sabor (para a produção)" linhas={porSabor} cor="#D8463A" />
          <Barras titulo="Por forma de pagamento (conciliação)" linhas={porForma} cor="#6B2E1C" />
        </div>
      </div>

      {lista === null ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : vistas.length === 0 ? (
        <p className="rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground">Nenhuma confirmação ainda. Copie o link do formulário e mande para as unidades.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr><th className="p-3">Nº</th><th className="p-3">Unidade</th><th className="p-3">Nome</th><th className="p-3">Pizzas</th><th className="p-3 text-right">Valor</th><th className="p-3">Pagamento</th><th className="p-3">Comprovante</th><th className="p-3">Retirada</th></tr>
            </thead>
            <tbody>
              {vistas.map((c) => (
                <tr key={c.id} className="border-t border-border" data-testid="confirmacao">
                  <td className="p-3 font-semibold tabular-nums">{c.numero}</td>
                  <td className="p-3">{c.unidade_nome}<br /><span className="text-xs text-muted-foreground">{ROTULO_DA_AREA[c.area]}</span></td>
                  <td className="p-3">{c.nome}</td>
                  <td className="p-3">{resumoDosSabores(c.sabores)}</td>
                  <td className="p-3 text-right tabular-nums">{reais(c.total)}</td>
                  <td className="p-3"><span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">{rotuloDaForma(c.forma)}</span></td>
                  <td className="p-3">{c.comprovante_caminho ? <button type="button" className="font-semibold text-red-700 hover:underline dark:text-red-400" onClick={() => ver(c)}>ver</button> : <span className="text-xs text-muted-foreground">sem anexo</span>}</td>
                  <td className="p-3">
                    <label className="flex cursor-pointer items-center gap-2"><Checkbox checked={c.retirada} onCheckedChange={(v) => retirar(c, v === true)} aria-label={`Retirada ${c.numero}`} /> {c.retirada ? 'retirada' : ''}</label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
