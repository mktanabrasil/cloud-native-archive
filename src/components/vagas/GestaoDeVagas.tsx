import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, MoreHorizontal, Search, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { COR_DA_AREA } from './PecasDasVagas';
import { VagaFormDialog, type ModoDaVaga } from './VagaFormDialog';
import { ImportarVagasDialog } from './ImportarVagasDialog';
import { apagarVaga, listarTodasAsVagas, mensagemDoErro, mudarStatus } from '@/lib/vagas/api';
import { PROXIMOS_STATUS, ROTULO_DA_AREA, ROTULO_DO_STATUS, STATUS_DA_VAGA, type StatusDaVaga, type Vaga } from '@/lib/vagas/modelo';
import { casaComBusca } from '@/lib/vagas/vitrine';
import { contagemPorVaga } from '@/lib/vagas/rh';
import { format } from 'date-fns';

/**
 * A aba Gestão de /vagas (fase 1, tela 31 do mockup aprovado), só para RH e
 * admin. Todas as vagas, de qualquer status, com o ciclo de vida à mão:
 * publicar, pausar, encerrar, arquivar. Apagar só vale para rascunho e
 * arquivada, e pede confirmação na própria linha.
 */

// Esboço V2: a situação é texto com bolinha, sem pílula colorida.
const COR_DO_STATUS: Record<StatusDaVaga, string> = {
  rascunho: 'text-muted-foreground',
  revisao: 'text-warning',
  publicada: 'text-success',
  pausada: 'text-info',
  encerrada: 'text-muted-foreground',
  arquivada: 'text-[hsl(var(--fraco,0_0%_45%))]',
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
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] font-semibold ${COR_DO_STATUS[status]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />{ROTULO_DO_STATUS[status]}
    </span>
  );
}

export function GestaoDeVagas() {
  const [vagas, setVagas] = useState<Vaga[] | null>(null);
  const [erro, setErro] = useState(false);
  const [status, setStatus] = useState<StatusDaVaga | null>(null);
  const [busca, setBusca] = useState('');
  const [form, setForm] = useState<{ modo: ModoDaVaga; vaga: Vaga | null } | null>(null);
  const [apagando, setApagando] = useState<string | null>(null);
  const [importando, setImportando] = useState(false);
  // Candidatos por vaga (PR 9, 09/10/2026): total e os que ninguém abriu.
  const [candidatos, setCandidatos] = useState<Map<string, { total: number; novos: number }>>(new Map());
  useEffect(() => { contagemPorVaga().then(setCandidatos).catch(() => setCandidatos(new Map())); }, []);

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
      <div className="flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h1 className="text-[28px] font-bold leading-tight">Gestão de vagas</h1>
          <p className="text-sm text-muted-foreground">Trabalhe Conosco · todas as vagas, de qualquer situação</p>
        </div>
        <Button variant="outline" disabled={vagas === null} onClick={() => setImportando(true)}>Importar do site</Button>
        <Button onClick={() => setForm({ modo: 'nova', vaga: null })}>Nova vaga</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex max-w-full gap-0.5 overflow-x-auto rounded-[14px] bg-muted p-1" role="group" aria-label="Filtrar por situação">
        {[null, ...STATUS_DA_VAGA].map(s => {
          const n = s === null ? (vagas?.length ?? 0) : contagem[s];
          if (s !== null && n === 0 && status !== s) return null;
          const ativo = status === s;
          return (
            <button key={s ?? 'todas'} type="button" aria-pressed={ativo} onClick={() => setStatus(s)}
              className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[10px] px-3 py-1.5 text-[13.5px] transition-colors ${ativo ? 'bg-card font-semibold text-foreground shadow-[0_1px_3px_hsl(165_30%_12%/0.12)]' : 'font-medium text-muted-foreground hover:text-foreground'}`}>
              {s === null ? 'Todas' : ROTULO_DO_STATUS[s]}<span className="sr-only"> · </span><span className="tabular-nums text-[hsl(var(--fraco,0_0%_45%))]">{n}</span>
            </button>
          );
        })}
        </div>
        <span className="flex-1" />
        <label className="flex h-10 w-full items-center gap-2 rounded-[12px] border border-input bg-card px-3 sm:w-64">
          <Search className="h-4 w-4 text-muted-foreground" aria-hidden />
          <span className="sr-only">Buscar na gestão</span>
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Título ou código" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
        </label>
      </div>

      {erro ? (
        <div className="flex flex-col items-start gap-3 rounded-[20px] border border-black/5 bg-card p-6 dark:border-white/5">
          <p className="font-semibold">Não deu para carregar as vagas.</p>
          <Button variant="outline" onClick={carregar}>Tentar de novo</Button>
        </div>
      ) : vagas === null ? (
        <div className="space-y-2" aria-busy="true">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-[16px]" />)}</div>
      ) : vagas.length === 0 ? (
        <div className="flex flex-col items-start gap-2 rounded-[20px] border border-black/5 bg-card p-6 dark:border-white/5">
          <p className="text-lg font-semibold">Nenhuma vaga ainda.</p>
          <p className="text-sm text-muted-foreground">Traga as vagas que estão hoje nos sites do Social e do GOE, ou crie uma do zero.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button onClick={() => setImportando(true)}>Importar as vagas do site</Button>
            <Button variant="outline" onClick={() => setForm({ modo: 'nova', vaga: null })}>Nova vaga</Button>
          </div>
        </div>
      ) : lista.length === 0 ? (
        <p className="rounded-[20px] border border-dashed border-border p-6 text-sm text-muted-foreground">Nenhuma vaga com esse filtro.</p>
      ) : (
        <div className="flex flex-col gap-5">
          {[
            ['Com candidatos novos', lista.filter(v => !!candidatos.get(v.id)?.novos)],
            ['Demais vagas', lista.filter(v => !candidatos.get(v.id)?.novos)],
          ].map(([titulo, grupo]) => {
            const vagasDoGrupo = grupo as Vaga[];
            const temNovos = lista.some(v => !!candidatos.get(v.id)?.novos);
            if (!vagasDoGrupo.length || (!temNovos && titulo === 'Com candidatos novos')) return null;
            return (
              <section key={titulo as string} aria-label={titulo as string} className="flex flex-col gap-2">
                {/* As vagas com candidato que ninguém abriu sobem (19/10/2026): a do teste estava lá embaixo. */}
                {temNovos && <h3 className="text-[15px] font-semibold">{titulo as string} <span className="font-normal tabular-nums text-[hsl(var(--fraco,0_0%_45%))]">· {vagasDoGrupo.length}</span></h3>}
        <ul className="overflow-hidden rounded-[20px] border border-black/5 bg-card dark:border-white/5">
          {vagasDoGrupo.map(v => (
            <li key={v.id} className="flex flex-col gap-2.5 border-b border-border/70 px-4 py-3.5 last:border-b-0 sm:flex-row sm:items-center sm:gap-4" data-testid={`linha-${v.slug}`}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                  <p className="min-w-0 truncate font-semibold">{v.titulo}</p>
                  <SeloDoStatus status={v.status} />
                </div>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-[hsl(var(--fraco,0_0%_45%))]">
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <span className="h-2 w-2 shrink-0 rounded-full ring-1 ring-black/10" style={{ background: COR_DA_AREA[v.area] }} aria-hidden />{ROTULO_DA_AREA[v.area]}
                  </span>
                  <span>· <span className="tabular-nums">{v.codigo}</span></span>
                  <span>· {v.publicada_em ? `Publicada em ${format(new Date(v.publicada_em), 'dd/MM/yyyy')}` : 'Nunca publicada'}{v.prazo ? ` · prazo ${format(new Date(v.prazo), 'dd/MM')}` : ''}</span>
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
                  <Button size="sm" variant="outline" asChild>
                    <Link to={`/vagas/${v.slug}/candidatos`} data-testid={`candidatos-${v.slug}`}>
                      <Users className="h-3.5 w-3.5" /> <span className="tabular-nums">{candidatos.get(v.id)?.total ?? 0}</span>
                      {!!candidatos.get(v.id)?.novos && <span className="inline-flex items-center gap-1 text-xs font-semibold text-destructive"><span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />{candidatos.get(v.id)!.novos} {candidatos.get(v.id)!.novos === 1 ? 'novo' : 'novos'}</span>}
                    </Link>
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setForm({ modo: 'editar', vaga: v })}>Editar</Button>
                  {v.status === 'publicada' && (
                    <Button size="sm" variant="ghost" asChild><Link to={`/vagas/${v.slug}`} target="_blank" aria-label={`Ver ${v.titulo} no portal`}><ExternalLink className="h-4 w-4" /></Link></Button>
                  )}
                  <MenuDaLinha titulo={v.titulo}>
                    {fechar => (
                      <>
                        <p className="px-3 pb-1 pt-2 text-xs text-muted-foreground">Mudar para</p>
                        {PROXIMOS_STATUS[v.status].map(s => <ItemDoMenu key={s} onClick={() => { fechar(); trocar(v, s); }}>{VERBO[s]}</ItemDoMenu>)}
                        <div className="my-1 h-px bg-border" role="separator" />
                        <ItemDoMenu onClick={() => { fechar(); setForm({ modo: 'duplicar', vaga: v }); }}>Duplicar</ItemDoMenu>
                        {(v.status === 'rascunho' || v.status === 'arquivada') && (
                          <ItemDoMenu perigo onClick={() => { fechar(); setApagando(v.id); }}>Apagar</ItemDoMenu>
                        )}
                      </>
                    )}
                  </MenuDaLinha>
                </div>
              )}
            </li>
          ))}
        </ul>
              </section>
            );
          })}
        </div>
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
        <div role="menu" className="absolute right-0 top-full z-20 mt-1 min-w-[210px] rounded-[14px] border border-border bg-popover p-1 text-popover-foreground shadow-lg">
          {children(() => setAberto(false))}
        </div>
      )}
    </div>
  );
}

function ItemDoMenu({ children, onClick, perigo = false }: { children: React.ReactNode; onClick: () => void; perigo?: boolean }) {
  return (
    <button type="button" role="menuitem" onClick={onClick} className={`flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none ${perigo ? 'text-destructive' : ''}`}>
      {children}
    </button>
  );
}
