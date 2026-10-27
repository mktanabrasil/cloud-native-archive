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

  // Esboço V2: situação em texto com bolinha; etapas em tracinhos na cor de Vagas.
  const COR_DO_TEXTO: Record<Situacao, string> = {
    no_prazo: 'text-success',
    triagem_lenta: 'text-warning',
    sem_responsavel: 'text-destructive',
    prazo_vencido: 'text-destructive',
  };
  const situacao = (p: Processo) => (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] font-semibold ${COR_DO_TEXTO[p.situacao]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {ROTULO_DA_SITUACAO[p.situacao]}
    </span>
  );
  const etapas = (p: Processo) => (
    <div className="flex items-end gap-1" role="img" aria-label={COLUNAS_DO_QUADRO.map(([k, r]) => `${r} ${p.porColuna[k]}`).join(', ')}>
      {COLUNAS_DO_QUADRO.map(([k]) => (
        <span key={k} className="flex w-5 flex-col items-center gap-0.5">
          <span className={`block h-1 w-5 rounded-full ${p.porColuna[k] ? 'bg-[#81e2cf]' : 'bg-border'}`} />
          <span className={`text-[10.5px] tabular-nums ${p.porColuna[k] ? 'font-bold text-foreground' : 'text-muted-foreground'}`}>{p.porColuna[k]}</span>
        </span>
      ))}
    </div>
  );
  const responsavel = (p: Processo) => {
    const nome = nomeDe(p.vaga.responsavel_id);
    return p.vaga.responsavel_id ? (
      <button type="button" onClick={() => setEditando(p)} className="flex items-center gap-2 text-left hover:underline">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#81e2cf] text-[11px] font-bold text-[#10201C]">{iniciais(nome ?? '?')}</span>
        {nome ?? 'Pessoa da equipe'}
      </button>
    ) : (
      <button type="button" onClick={() => setEditando(p)} className="font-semibold text-destructive hover:underline">Definir</button>
    );
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold leading-tight">Processos seletivos</h1>
          <p className="text-sm text-muted-foreground">Trabalhe Conosco · {contagem.abertos} {contagem.abertos === 1 ? 'aberto' : 'abertos'}</p>
        </div>
      </div>
      <div className="inline-flex max-w-full gap-0.5 self-start overflow-x-auto rounded-[14px] bg-muted p-1" role="group" aria-label="Filtrar processos">
        {filtros.map(([k, r]) => (
          <button
            key={k}
            type="button"
            aria-pressed={filtro === k}
            onClick={() => setFiltro(k)}
            className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[10px] px-3 py-1.5 text-[13.5px] transition-colors ${filtro === k ? 'bg-card font-semibold text-foreground shadow-[0_1px_3px_hsl(165_30%_12%/0.12)]' : 'font-medium text-muted-foreground hover:text-foreground'}`}
          >
            {r}
            <span className={`tabular-nums ${k === 'sem_responsavel' && contagem[k] ? 'font-semibold text-destructive' : 'text-[hsl(var(--fraco,0_0%_45%))]'}`}>{contagem[k]}</span>
          </button>
        ))}
      </div>

      {erro && <p role="alert" className="text-sm font-semibold text-destructive">Não consegui carregar os processos. Recarregue a página.</p>}
      {lista === null ? <p className="text-sm text-muted-foreground">Carregando…</p> : ordenados.length === 0 ? (
        <p className="rounded-[20px] border border-dashed border-border p-6 text-sm text-muted-foreground">Nenhum processo neste filtro.</p>
      ) : (
        <>
          {/* computador: a tabela */}
          <div className="hidden overflow-x-auto rounded-[20px] border border-black/5 bg-card dark:border-white/5 md:block">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="text-left text-xs font-semibold text-muted-foreground">
                <tr className="border-b border-border"><th className="px-4 py-3">Processo</th><th className="px-4 py-3">Responsável</th><th className="px-4 py-3">Candidatos por etapa</th><th className="px-4 py-3">Aberto há</th><th className="px-4 py-3">Prazo</th><th className="px-4 py-3">Situação</th><th className="px-4 py-3" /></tr>
              </thead>
              <tbody>
                {ordenados.map((p) => (
                  <tr key={p.vaga.id} className="border-t border-border/70 transition-colors hover:bg-muted/40" data-testid="processo">
                    <td className="px-4 py-3"><b className="block font-semibold">{p.vaga.titulo}</b><span className="text-xs text-[hsl(var(--fraco,0_0%_45%))]">{p.vaga.codigo} · {ROTULO_DA_AREA[p.vaga.area]}{p.novos ? ` · ${p.novos} ${p.novos === 1 ? 'novo' : 'novos'}` : ''}</span></td>
                    <td className="px-4 py-3">{responsavel(p)}</td>
                    <td className="px-4 py-3">{etapas(p)}</td>
                    <td className="px-4 py-3 tabular-nums">{p.abertoHa} {p.abertoHa === 1 ? 'dia' : 'dias'}</td>
                    <td className="px-4 py-3 tabular-nums">{dataCurta(p.vaga.prazo_processo)}</td>
                    <td className="px-4 py-3">{situacao(p)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link to={`/vagas/${p.vaga.slug}/candidatos`} className="font-semibold text-[hsl(var(--sel,168_80%_27%))] hover:underline">Abrir</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* celular: cada processo numa linha empilhada, sem rolar para o lado */}
          <div className="overflow-hidden rounded-[20px] border border-black/5 bg-card dark:border-white/5 md:hidden">
            {ordenados.map((p) => (
              <div key={p.vaga.id} className="grid gap-2 border-b border-border/70 px-4 py-3.5 last:border-b-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <b className="block font-semibold leading-snug">{p.vaga.titulo}</b>
                    <span className="text-xs text-[hsl(var(--fraco,0_0%_45%))]">{p.vaga.codigo} · {ROTULO_DA_AREA[p.vaga.area]}</span>
                  </div>
                  <Link to={`/vagas/${p.vaga.slug}/candidatos`} className="shrink-0 text-sm font-semibold text-[hsl(var(--sel,168_80%_27%))]">Abrir</Link>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
                  {situacao(p)}
                  {etapas(p)}
                </div>
                <div className="text-sm">{responsavel(p)}</div>
              </div>
            ))}
          </div>
        </>
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
