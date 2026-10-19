import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { ROTULO_DA_AREA } from '@/lib/vagas/modelo';
import {
  COLUNAS_DO_QUADRO, ROTULO_DA_SITUACAO, definirResponsavel, equipe, iniciais, listarProcessos, prazoEmBreve, semAcento,
  type PessoaDaEquipe, type Processo, type Situacao,
} from '@/lib/vagas/rh';

/**
 * A aba Processos do RH (passo 3 do roteiro, mockup de 19/10/2026): cada
 * vaga com o responsável, os candidatos por etapa, há quanto tempo está
 * aberta, o prazo e a situação. "Definir" escolhe a pessoa da equipe (uma
 * por vaga) e o prazo; a pessoa recebe e-mail.
 */

type Filtro = 'abertos' | 'sem_responsavel' | 'prazo' | 'meus' | 'encerrados';

const COR_DA_SITUACAO: Record<Situacao, string> = {
  no_prazo: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  triagem_lenta: 'bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200',
  sem_responsavel: 'bg-red-50 text-red-800 dark:bg-red-950/60 dark:text-red-300',
  prazo_vencido: 'bg-red-50 text-red-800 dark:bg-red-950/60 dark:text-red-300',
};
const COR_DA_COLUNA = ['#01ADFF', '#FBCE00', '#81E2CF', '#0E6B58', 'hsl(var(--muted-foreground) / 0.35)'];

const dataCurta = (d: string | null) => (d ? d.split('-').reverse().slice(0, 2).join('/') : '—');

export function ProcessosDoRh() {
  const { user } = useAuth();
  const [lista, setLista] = useState<Processo[] | null>(null);
  const [pessoas, setPessoas] = useState<PessoaDaEquipe[]>([]);
  const [filtro, setFiltro] = useState<Filtro>('abertos');
  const [editando, setEditando] = useState<Processo | null>(null);
  const [erro, setErro] = useState(false);

  const carregar = () => { setErro(false); listarProcessos().then(setLista).catch(() => { setErro(true); setLista([]); }); };
  useEffect(carregar, []);
  useEffect(() => { equipe().then(setPessoas).catch(() => setPessoas([])); }, []);
  const nomeDe = (id: string | null) => pessoas.find((p) => p.user_id === id)?.nome ?? null;

  const abertos = useMemo(() => (lista ?? []).filter((p) => p.vaga.status === 'publicada' || p.vaga.status === 'pausada'), [lista]);
  const contagem: Record<Filtro, number> = {
    abertos: abertos.length,
    sem_responsavel: abertos.filter((p) => !p.vaga.responsavel_id).length,
    prazo: abertos.filter((p) => prazoEmBreve(p.vaga.prazo_processo)).length,
    meus: abertos.filter((p) => p.vaga.responsavel_id === user?.id).length,
    encerrados: (lista ?? []).filter((p) => p.vaga.status === 'encerrada').length,
  };
  const vistos = filtro === 'encerrados' ? (lista ?? []).filter((p) => p.vaga.status === 'encerrada')
    : abertos.filter((p) => filtro === 'abertos' || (filtro === 'sem_responsavel' && !p.vaga.responsavel_id) || (filtro === 'prazo' && prazoEmBreve(p.vaga.prazo_processo)) || (filtro === 'meus' && p.vaga.responsavel_id === user?.id));
  const ordem: Record<Situacao, number> = { sem_responsavel: 0, prazo_vencido: 1, triagem_lenta: 2, no_prazo: 3 };
  const ordenados = [...vistos].sort((a, b) => ordem[a.situacao] - ordem[b.situacao] || b.novos - a.novos || a.vaga.titulo.localeCompare(b.vaga.titulo));

  const filtros: Array<[Filtro, string]> = [['abertos', 'Abertos'], ['sem_responsavel', 'Sem responsável'], ['prazo', 'Prazo em 7 dias'], ['meus', 'Meus'], ['encerrados', 'Encerrados']];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-bold">Processos seletivos</h1>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar processos">
        {filtros.map(([k, r]) => (
          <Button key={k} size="sm" variant={filtro === k ? 'default' : 'secondary'} className={`h-8 rounded-full ${k === 'sem_responsavel' && contagem[k] && filtro !== k ? 'bg-red-50 text-red-800 hover:bg-red-100 dark:bg-red-950/50 dark:text-red-300' : ''}`} onClick={() => setFiltro(k)}>
            {r}<span className="opacity-60">{contagem[k]}</span>
          </Button>
        ))}
      </div>

      {erro && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950/60 dark:text-red-100">Não consegui carregar os processos. Recarregue a página.</p>}
      {lista === null ? <p className="text-sm text-muted-foreground">Carregando…</p> : ordenados.length === 0 ? (
        <p className="rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground">Nenhum processo neste filtro.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[920px] text-sm">
            <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr><th className="p-3">Processo</th><th className="p-3">Responsável</th><th className="p-3">Candidatos por etapa</th><th className="p-3">Aberto há</th><th className="p-3">Prazo</th><th className="p-3">Situação</th><th className="p-3" /></tr>
            </thead>
            <tbody>
              {ordenados.map((p) => {
                const nome = nomeDe(p.vaga.responsavel_id);
                const max = Math.max(1, ...Object.values(p.porColuna));
                return (
                  <tr key={p.vaga.id} className="border-t border-border" data-testid="processo">
                    <td className="p-3"><b className="block">{p.vaga.titulo}</b><span className="text-xs text-muted-foreground">{p.vaga.codigo} · {ROTULO_DA_AREA[p.vaga.area]}{p.novos ? ` · ${p.novos} ${p.novos === 1 ? 'novo' : 'novos'}` : ''}</span></td>
                    <td className="p-3">
                      {p.vaga.responsavel_id ? (
                        <button type="button" onClick={() => setEditando(p)} className="flex items-center gap-2 text-left hover:underline">
                          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-emerald-50 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">{iniciais(nome ?? '?')}</span>{nome ?? 'Pessoa da equipe'}
                        </button>
                      ) : <span className="font-semibold text-red-700 dark:text-red-400">— definir</span>}
                    </td>
                    <td className="p-3">
                      <div className="flex items-end gap-1" role="img" aria-label={COLUNAS_DO_QUADRO.map(([k, r]) => `${r} ${p.porColuna[k]}`).join(', ')}>
                        {COLUNAS_DO_QUADRO.map(([k], i) => (
                          <span key={k} className="flex flex-col items-center gap-0.5">
                            <span className="block w-4 rounded-t" style={{ height: `${4 + (p.porColuna[k] / max) * 20}px`, background: COR_DA_COLUNA[i] }} />
                            <span className="text-[10px] tabular-nums text-muted-foreground">{p.porColuna[k]}</span>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-3 tabular-nums">{p.abertoHa} {p.abertoHa === 1 ? 'dia' : 'dias'}</td>
                    <td className="p-3 tabular-nums">{dataCurta(p.vaga.prazo_processo)}</td>
                    <td className="p-3"><span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${COR_DA_SITUACAO[p.situacao]}`}>{ROTULO_DA_SITUACAO[p.situacao]}</span></td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant={p.vaga.responsavel_id ? 'outline' : 'default'} onClick={() => setEditando(p)}>{p.vaga.responsavel_id ? 'Trocar' : 'Definir'}</Button>
                        <Button size="sm" variant="outline" asChild><Link to={`/vagas/${p.vaga.slug}/candidatos`}>Abrir</Link></Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">“Triagem lenta” = candidato parado há 10+ dias. O responsável vê só os processos dele e move até Entrevista; o resultado fica com o RH.</p>

      {editando && <DefinirResponsavel processo={editando} pessoas={pessoas} aoFechar={(mudou) => { setEditando(null); if (mudou) carregar(); }} />}
    </div>
  );
}

function DefinirResponsavel({ processo, pessoas, aoFechar }: { processo: Processo; pessoas: PessoaDaEquipe[]; aoFechar: (mudou: boolean) => void }) {
  const [escolhido, setEscolhido] = useState<string | null>(processo.vaga.responsavel_id);
  const [prazo, setPrazo] = useState(processo.vaga.prazo_processo ?? '');
  const [busca, setBusca] = useState('');
  const [salvando, setSalvando] = useState(false);
  const termo = semAcento(busca.trim());
  const vistas = pessoas.filter((p) => !termo || semAcento(`${p.nome} ${p.email ?? ''} ${p.unidade ?? ''}`).includes(termo)).slice(0, 30);

  async function salvar() {
    setSalvando(true);
    try {
      const r = await definirResponsavel(processo.vaga, escolhido, prazo || null);
      if (r.avisou && r.falhouAviso) toast.warning('Responsável salvo', { description: 'O e-mail para a pessoa não saiu.' });
      else toast.success('Responsável salvo', { description: r.avisou ? 'A pessoa foi avisada por e-mail.' : undefined });
      aoFechar(true);
    } catch {
      toast.error('Não deu para salvar. Tente de novo.');
      setSalvando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) aoFechar(false); }}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Responsável · {processo.vaga.titulo}</DialogTitle>
          <DialogDescription>Uma pessoa por processo. Ela vê só este processo e move até a entrevista.</DialogDescription>
        </DialogHeader>
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Buscar pessoa da equipe" placeholder="Buscar pessoa da equipe" className="pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </label>
        <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto" role="listbox" aria-label="Pessoas da equipe">
          {vistas.map((p) => (
            <li key={p.user_id}>
              <button type="button" role="option" aria-selected={escolhido === p.user_id} onClick={() => setEscolhido(p.user_id)}
                className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm ${escolhido === p.user_id ? 'bg-emerald-50 dark:bg-emerald-950/50' : 'hover:bg-muted'}`}>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-50 text-xs font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">{iniciais(p.nome)}</span>
                <span className="min-w-0"><b className="block truncate">{p.nome}</b><span className="block truncate text-xs text-muted-foreground">{[p.email, p.unidade].filter(Boolean).join(' · ')}</span></span>
              </button>
            </li>
          ))}
          {vistas.length === 0 && <li className="p-2 text-sm text-muted-foreground">Ninguém com esse nome.</li>}
        </ul>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">Prazo do processo <span className="font-normal text-muted-foreground">(opcional)</span>
          <Input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
        </label>
        <DialogFooter className="gap-2">
          {processo.vaga.responsavel_id && <Button variant="ghost" className="mr-auto text-red-700 dark:text-red-400" disabled={salvando} onClick={() => setEscolhido(null)}>Tirar responsável</Button>}
          <Button variant="outline" onClick={() => aoFechar(false)}>Cancelar</Button>
          <Button disabled={salvando || (escolhido === processo.vaga.responsavel_id && (prazo || null) === processo.vaga.prazo_processo)} onClick={salvar}>
            {escolhido && escolhido !== processo.vaga.responsavel_id ? 'Salvar e avisar' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
