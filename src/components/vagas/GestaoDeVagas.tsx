import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Download, ExternalLink, MoreHorizontal, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SeloDaArea } from './PecasDasVagas';
import { VagaFormDialog, type ModoDaVaga } from './VagaFormDialog';
import { ImportarVagasDialog } from './ImportarVagasDialog';
import { apagarVaga, listarTodasAsVagas, mensagemDoErro, mudarStatus } from '@/lib/vagas/api';
import { PROXIMOS_STATUS, ROTULO_DO_STATUS, STATUS_DA_VAGA, type StatusDaVaga, type Vaga } from '@/lib/vagas/modelo';
import { casaComBusca } from '@/lib/vagas/vitrine';
import { format } from 'date-fns';

/**
 * A aba Gestão de /vagas (fase 1, tela 31 do mockup aprovado), só para RH e
 * admin. Todas as vagas, de qualquer status, com o ciclo de vida à mão:
 * publicar, pausar, encerrar, arquivar. Apagar só vale para rascunho e
 * arquivada, e pede confirmação na própria linha.
 */

const COR_DO_STATUS: Record<StatusDaVaga, string> = {
  rascunho: 'bg-muted text-foreground',
  revisao: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  publicada: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  pausada: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200',
  encerrada: 'bg-stone-200 text-stone-800 dark:bg-stone-800 dark:text-stone-200',
  arquivada: 'bg-stone-100 text-stone-500 dark:bg-stone-900 dark:text-stone-400',
};

const VERBO: Record<StatusDaVaga, string> = {
  rascunho: 'Voltar para rascunho',
  revisao: 'Enviar para revisão',
  publicada: 'Publicar',
  pausada: 'Pausar (some do portal)',
  encerrada: 'Encerrar',
  arquivada: 'Arquivar',
};

export function SeloDoStatus({ status }: { status: StatusDaVaga }) {
  return <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold ${COR_DO_STATUS[status]}`}>{ROTULO_DO_STATUS[status]}</span>;
}

export function GestaoDeVagas() {
  const [vagas, setVagas] = useState<Vaga[] | null>(null);
  const [erro, setErro] = useState(false);
  const [status, setStatus] = useState<StatusDaVaga | null>(null);
  const [busca, setBusca] = useState('');
  const [form, setForm] = useState<{ modo: ModoDaVaga; vaga: Vaga | null } | null>(null);
  const [apagando, setApagando] = useState<string | null>(null);
  const [importando, setImportando] = useState(false);

  const carregar = useCallback(() => {
    setErro(false);
    listarTodasAsVagas().then(setVagas).catch(() => setErro(true));
  }, []);
  useEffect(carregar, [carregar]);

  const contagem = useMemo(() => {
    const c = Object.fromEntries(STATUS_DA_VAGA.map(s => [s, 0])) as Record<StatusDaVaga, number>;
    (vagas ?? []).forEach(v => { c[v.status]++; });
    return c;
  }, [vagas]);
  const lista = useMemo(() => (vagas ?? []).filter(v => (status === null || v.status === status) && casaComBusca(v, busca)), [vagas, status, busca]);

  async function trocar(v: Vaga, novo: StatusDaVaga) {
    if (novo === 'publicada' && v.requisitos.length === 0) { toast.error('Inclua pelo menos um requisito antes de publicar.'); setForm({ modo: 'editar', vaga: v }); return; }
    try {
      const salva = await mudarStatus(v.id, novo);
      setVagas(atual => (atual ?? []).map(x => (x.id === salva.id ? salva : x)));
      toast.success(`${v.titulo}: ${ROTULO_DO_STATUS[novo].toLowerCase()}.`);
    } catch (e) { toast.error(mensagemDoErro(e)); }
  }

  async function apagar(v: Vaga) {
    try {
      await apagarVaga(v.id);
      setVagas(atual => (atual ?? []).filter(x => x.id !== v.id));
      toast.success('Vaga apagada.');
    } catch (e) { toast.error(mensagemDoErro(e)); }
    setApagando(null);
  }

  const aoSalvar = (salva: Vaga) => setVagas(atual => {
    const l = atual ?? [];
    return l.some(x => x.id === salva.id) ? l.map(x => (x.id === salva.id ? salva : x)) : [salva, ...l];
  });

  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-4 px-4 pb-12 pt-6 sm:px-6" aria-label="Gestão de vagas">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-2xl font-bold">Gestão de vagas</h1>
        <Button variant="outline" disabled={vagas === null} onClick={() => setImportando(true)}><Download className="h-4 w-4" /> Importar do site</Button>
        <Button onClick={() => setForm({ modo: 'nova', vaga: null })}><Plus className="h-4 w-4" /> Nova vaga</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {[null, ...STATUS_DA_VAGA].map(s => {
          const n = s === null ? (vagas?.length ?? 0) : contagem[s];
          if (s !== null && n === 0 && status !== s) return null;
          const ativo = status === s;
          return (
            <button key={s ?? 'todas'} type="button" aria-pressed={ativo} onClick={() => setStatus(s)}
              className={`h-9 rounded-full px-3.5 text-sm font-medium transition ${ativo ? 'bg-foreground text-background' : 'bg-muted text-foreground hover:bg-muted/70'}`}>
              {s === null ? 'Todas' : ROTULO_DO_STATUS[s]} · {n}
            </button>
          );
        })}
        <span className="flex-1" />
        <label className="flex h-9 w-full items-center gap-2 rounded-full border border-input bg-background px-3 sm:w-64">
          <Search className="h-4 w-4 text-muted-foreground" aria-hidden />
          <span className="sr-only">Buscar na gestão</span>
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Título ou código" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
        </label>
      </div>

      {erro ? (
        <div className="flex flex-col items-start gap-3 rounded-2xl border border-border bg-card p-6">
          <p className="font-semibold">Não deu para carregar as vagas.</p>
          <Button variant="outline" onClick={carregar}>Tentar de novo</Button>
        </div>
      ) : vagas === null ? (
        <div className="space-y-2" aria-busy="true">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : vagas.length === 0 ? (
        <div className="flex flex-col items-start gap-2 rounded-2xl bg-muted/60 p-6">
          <p className="text-lg font-semibold">Nenhuma vaga ainda.</p>
          <p className="text-sm text-muted-foreground">Traga as vagas que estão hoje nos sites do Social e do GOE, ou crie uma do zero.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button onClick={() => setImportando(true)}><Download className="h-4 w-4" /> Importar as vagas do site</Button>
            <Button variant="outline" onClick={() => setForm({ modo: 'nova', vaga: null })}><Plus className="h-4 w-4" /> Nova vaga</Button>
          </div>
        </div>
      ) : lista.length === 0 ? (
        <p className="rounded-2xl bg-muted/60 p-6 text-sm text-muted-foreground">Nenhuma vaga com esse filtro.</p>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
          {lista.map(v => (
            <li key={v.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-4 sm:px-4" data-testid={`linha-${v.slug}`}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <SeloDaArea area={v.area} /><SeloDoStatus status={v.status} />
                  <span className="text-xs tabular-nums text-muted-foreground">{v.codigo}</span>
                </div>
                <p className="mt-1 truncate font-semibold">{v.titulo}</p>
                <p className="text-xs text-muted-foreground">
                  {v.publicada_em ? `Publicada em ${format(new Date(v.publicada_em), 'dd/MM/yyyy')}` : 'Nunca publicada'}
                  {v.prazo ? ` · prazo ${format(new Date(v.prazo), 'dd/MM')}` : ''}
                  {!v.link_externo ? ' · sem formulário' : ''}
                </p>
              </div>
              {apagando === v.id ? (
                <div className="flex items-center gap-2" role="group" aria-label="Confirmar exclusão">
                  <span className="text-sm">Apagar de vez?</span>
                  <Button size="sm" variant="destructive" onClick={() => apagar(v)}>Apagar</Button>
                  <Button size="sm" variant="ghost" onClick={() => setApagando(null)}>Não</Button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => setForm({ modo: 'editar', vaga: v })}><Pencil className="h-3.5 w-3.5" /> Editar</Button>
                  {v.status === 'publicada' && (
                    <Button size="sm" variant="ghost" asChild><Link to={`/vagas/${v.slug}`} target="_blank" aria-label={`Ver ${v.titulo} no portal`}><ExternalLink className="h-4 w-4" /></Link></Button>
                  )}
                  <MenuDaLinha titulo={v.titulo}>
                    {fechar => (
                      <>
                        <p className="px-3 pb-1 pt-2 text-xs text-muted-foreground">Mudar para</p>
                        {PROXIMOS_STATUS[v.status].map(s => <ItemDoMenu key={s} onClick={() => { fechar(); trocar(v, s); }}>{VERBO[s]}</ItemDoMenu>)}
                        <div className="my-1 h-px bg-border" role="separator" />
                        <ItemDoMenu onClick={() => { fechar(); setForm({ modo: 'duplicar', vaga: v }); }}><Copy className="h-4 w-4" /> Duplicar</ItemDoMenu>
                        {(v.status === 'rascunho' || v.status === 'arquivada') && (
                          <ItemDoMenu perigo onClick={() => { fechar(); setApagando(v.id); }}><Trash2 className="h-4 w-4" /> Apagar</ItemDoMenu>
                        )}
                      </>
                    )}
                  </MenuDaLinha>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <ImportarVagasDialog
        open={importando}
        onOpenChange={setImportando}
        existentes={vagas ?? []}
        onImportadas={novas => setVagas(atual => [...novas, ...(atual ?? [])])}
      />

      <VagaFormDialog
        open={form !== null}
        onOpenChange={o => { if (!o) setForm(null); }}
        modo={form?.modo ?? 'nova'}
        vaga={form?.vaga ?? null}
        todas={vagas ?? []}
        onSalva={aoSalvar}
      />
    </section>
  );
}

/**
 * Menu de ações da linha. Simples de propósito, sem portal: abre embaixo do
 * botão, fecha ao escolher, com Esc ou tocando fora.
 */
function MenuDaLinha({ titulo, children }: { titulo: string; children: (fechar: () => void) => React.ReactNode }) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => { if (!caixa.current?.contains(e.target as Node)) setAberto(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false); };
    document.addEventListener('pointerdown', fora);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', fora); document.removeEventListener('keydown', esc); };
  }, [aberto]);
  return (
    <div ref={caixa} className="relative">
      <Button size="sm" variant="ghost" aria-label={`Mais ações para ${titulo}`} aria-haspopup="menu" aria-expanded={aberto} onClick={() => setAberto(a => !a)}>
        <MoreHorizontal className="h-4 w-4" />
      </Button>
      {aberto && (
        <div role="menu" className="absolute right-0 top-full z-20 mt-1 min-w-[210px] rounded-xl border border-border bg-popover py-1 text-popover-foreground shadow-lg">
          {children(() => setAberto(false))}
        </div>
      )}
    </div>
  );
}

function ItemDoMenu({ children, onClick, perigo = false }: { children: React.ReactNode; onClick: () => void; perigo?: boolean }) {
  return (
    <button type="button" role="menuitem" onClick={onClick} className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none ${perigo ? 'text-destructive' : ''}`}>
      {children}
    </button>
  );
}
