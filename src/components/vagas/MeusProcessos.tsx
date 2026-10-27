import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { COLUNAS_DO_QUADRO, listarProcessos, type Processo } from '@/lib/vagas/rh';

/**
 * "Meus processos" (passo 3 do roteiro, 19/10/2026): o que vê quem é
 * responsável por um processo e não é RH. Um cartão por vaga, com os números
 * por etapa e "Abrir quadro". O banco já entrega só as vagas dela.
 */
export function MeusProcessos() {
  const { user } = useAuth();
  const { userName } = useUserRole();
  const [lista, setLista] = useState<Processo[] | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => { listarProcessos().then(setLista).catch(() => { setErro(true); setLista([]); }); }, []);
  const meus = (lista ?? []).filter((p) => p.vaga.responsavel_id === user?.id && p.vaga.status !== 'arquivada');
  const primeiro = (userName || '').split(' ')[0];

  // Esboço V2: a grade de cartões iguais vira lista em linhas (padrão de Processos).
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-[28px] font-bold leading-tight">{primeiro ? `Olá, ${primeiro}.` : 'Meus processos'}</h1>
        <p className="text-sm text-muted-foreground">Os processos seletivos em que você é responsável. Você abre as fichas e move até a entrevista; o resultado fica com o RH.</p>
      </div>
      {erro && <p role="alert" className="text-sm font-semibold text-destructive">Não consegui carregar. Recarregue a página.</p>}
      {lista === null ? <p className="text-sm text-muted-foreground">Carregando…</p> : meus.length === 0 ? (
        <p className="rounded-[20px] border border-dashed border-border p-6 text-sm text-muted-foreground">Nenhum processo com você agora.</p>
      ) : (
        <div className="overflow-hidden rounded-[20px] border border-black/5 bg-card dark:border-white/5">
          {meus.map((p) => (
            <article key={p.vaga.id} className="flex flex-col gap-2 border-b border-border/70 px-4 py-3.5 last:border-b-0 sm:flex-row sm:items-center sm:gap-6" data-testid="meu-processo">
              <div className="min-w-0 flex-1">
                <b className="block font-semibold leading-snug">{p.vaga.titulo}</b>
                <span className="text-xs text-[hsl(var(--fraco,0_0%_45%))]">{p.vaga.codigo} · {p.vaga.prazo_processo ? `prazo ${p.vaga.prazo_processo.split('-').reverse().slice(0, 2).join('/')}` : 'sem prazo'}{p.vaga.status === 'encerrada' ? ' · encerrada' : ''}</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
                {!!p.novos && <span className="inline-flex items-center gap-1.5 font-semibold text-destructive"><span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />{p.novos} {p.novos === 1 ? 'novo' : 'novos'}</span>}
                {COLUNAS_DO_QUADRO.slice(0, 3).map(([k, r]) => <span key={k}>{r} <b className="font-semibold tabular-nums text-foreground">{p.porColuna[k]}</b></span>)}
              </div>
              <Link to={`/vagas/${p.vaga.slug}/candidatos`} className="inline-flex min-h-[44px] shrink-0 items-center self-start text-sm font-semibold text-[hsl(var(--sel,168_80%_27%))] hover:underline sm:self-center">Abrir quadro</Link>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
