import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
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

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-bold">{primeiro ? `Olá, ${primeiro}.` : 'Meus processos'}</h1>
      <p className="text-sm text-muted-foreground">Os processos seletivos em que você é responsável. Você abre as fichas e move até a entrevista; o resultado fica com o RH.</p>
      {erro && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950/60 dark:text-red-100">Não consegui carregar. Recarregue a página.</p>}
      {lista === null ? <p className="text-sm text-muted-foreground">Carregando…</p> : meus.length === 0 ? (
        <p className="rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground">Nenhum processo com você agora.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {meus.map((p) => (
            <article key={p.vaga.id} className="flex flex-col gap-2.5 rounded-2xl bg-muted/60 p-4" data-testid="meu-processo">
              <div>
                <b className="block text-base">{p.vaga.titulo}</b>
                <span className="text-xs text-muted-foreground">{p.vaga.codigo} · {p.vaga.prazo_processo ? `prazo ${p.vaga.prazo_processo.split('-').reverse().slice(0, 2).join('/')}` : 'sem prazo'}{p.vaga.status === 'encerrada' ? ' · encerrada' : ''}</span>
              </div>
              <div className="flex flex-wrap gap-1.5 text-xs">
                {!!p.novos && <span className="rounded-md bg-red-50 px-2 py-0.5 font-bold text-red-800 dark:bg-red-950/60 dark:text-red-300">{p.novos} {p.novos === 1 ? 'novo' : 'novos'}</span>}
                {COLUNAS_DO_QUADRO.slice(0, 3).map(([k, r]) => <span key={k} className="rounded-md bg-background px-2 py-0.5">{r} {p.porColuna[k]}</span>)}
              </div>
              <Button asChild size="sm" className="self-start"><Link to={`/vagas/${p.vaga.slug}/candidatos`}>Abrir quadro</Link></Button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
