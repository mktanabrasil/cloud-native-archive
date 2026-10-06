import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useTituloDaAba } from '@/hooks/useTituloDaAba';
import { AbasDoCandidato } from '@/components/vagas/AbasDoCandidato';
import { EtapasDaCandidatura } from '@/components/vagas/EtapasDaCandidatura';
import { MolduraDaConta } from '@/components/vagas/MolduraDaConta';
import { ROTAS_DO_CANDIDATO, ehCandidato } from '@/lib/vagas/conta';
import { ETAPAS, dataEHora, minhasCandidaturas, retirarCandidatura, type Candidatura } from '@/lib/vagas/candidatura';

/**
 * /vagas/minha-area/:id — uma candidatura (mockup do PR 8, 06/10/2026):
 * protocolo, a etapa na linha, o que foi enviado e "Retirar candidatura",
 * com confirmação na própria tela. Quem muda a etapa é o RH (PR 9).
 */

const MOTIVOS = ['Consegui outra oportunidade', 'Horário ou local não funcionam para mim', 'Prefiro não dizer'] as const;

export default function CandidaturaDetalhePage() {
  const { id = '' } = useParams();
  const { user, isAuthenticated, loading } = useAuth();
  const [c, setC] = useState<Candidatura | null | undefined>(undefined);
  const [retirando, setRetirando] = useState(false);
  const [motivo, setMotivo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useTituloDaAba('Candidatura · Trabalhe Conosco ANA Brasil');

  const idDoCandidato = user && ehCandidato(user) ? user.id : null;
  useEffect(() => {
    if (!idDoCandidato) return;
    minhasCandidaturas(idDoCandidato).then((l) => setC(l.find((x) => x.id === id) ?? null)).catch(() => setC(null));
  }, [idDoCandidato, id]);

  if (loading) return null;
  if (!isAuthenticated) return <Navigate to={`${ROTAS_DO_CANDIDATO.entrar}?volta=${encodeURIComponent(`${ROTAS_DO_CANDIDATO.minhaArea}/${id}`)}`} replace />;
  if (!ehCandidato(user)) return <Navigate to="/" replace />;

  async function retirar() {
    if (!c) return;
    try {
      await retirarCandidatura(c.id, motivo);
      setC({ ...c, retirada_em: new Date().toISOString() });
      setRetirando(false);
    } catch {
      setErro('Não deu para retirar. Tente de novo.');
    }
  }

  const atalho = <Link to={ROTAS_DO_CANDIDATO.minhaArea} className="text-foreground hover:text-primary">Minha área</Link>;
  const rotuloDaEtapa = c ? ETAPAS.find(([k]) => k === c.etapa)?.[1] : '';

  return (
    <MolduraDaConta atalho={atalho}>
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 pb-10 pt-4 sm:px-6">
        <Link to={ROTAS_DO_CANDIDATO.minhaArea} className="flex items-center gap-1 self-start text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Minhas candidaturas</Link>
        {c === undefined ? (
          <p className="text-muted-foreground">Abrindo…</p>
        ) : c === null ? (
          <p className="text-muted-foreground">Candidatura não encontrada.</p>
        ) : (
          <>
            <div className="grid gap-1 rounded-2xl bg-emerald-50 p-4 dark:bg-emerald-950/40">
              <h1 className="text-xl font-bold leading-tight">{c.vaga?.titulo ?? 'Vaga encerrada'}</h1>
              <span className="text-sm text-muted-foreground">Protocolo <b className="tabular-nums text-foreground">{c.protocolo}</b> · enviada em {dataEHora(c.created_at)}</span>
            </div>
            <span className={`self-start rounded-full px-3 py-1 text-xs font-semibold ${c.retirada_em ? 'bg-muted text-muted-foreground' : 'bg-sky-50 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300'}`}>
              {c.retirada_em ? 'Retirada' : rotuloDaEtapa}
            </span>
            <EtapasDaCandidatura etapa={c.etapa} retirada={!!c.retirada_em} />

            {c.retirada_em ? (
              <p className="rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
                Você retirou esta candidatura em {dataEHora(c.retirada_em)}. Se a vaga ainda estiver aberta, dá para se candidatar de novo.
              </p>
            ) : (
              <>
                <span className="mt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">O que você enviou</span>
                <div className="grid gap-2 rounded-2xl bg-muted/60 p-4 text-sm">
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Perfil</span><b className="font-semibold">versão de {dataEHora(c.created_at).split(',')[0]}</b></div>
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Currículo</span><b className="truncate font-semibold">{c.curriculo_nome ?? 'Sem currículo'}</b></div>
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Requisitos marcados</span><b className="font-semibold">{c.requisitos.filter((r) => r.atende).length} de {c.requisitos.length}</b></div>
                  {c.respostas.length > 0 && <div className="flex justify-between gap-3"><span className="text-muted-foreground">Respostas</span><b className="font-semibold">{c.respostas.length}</b></div>}
                </div>

                {retirando ? (
                  <div className="flex flex-col gap-3 rounded-2xl bg-red-50 p-4 text-red-950 dark:bg-red-950/50 dark:text-red-100" role="alert">
                    <p className="font-semibold">Retirar a candidatura?</p>
                    <p className="text-sm">Você deixa de participar deste processo. Se quiser, conte o motivo:</p>
                    <div className="flex flex-wrap gap-2">
                      {MOTIVOS.map((m) => (
                        <button key={m} type="button" aria-pressed={motivo === m} onClick={() => setMotivo(motivo === m ? null : m)}
                          className={`rounded-full px-3 py-2 text-xs font-medium ${motivo === m ? 'bg-red-900 text-white dark:bg-red-200 dark:text-red-950' : 'bg-white/70 dark:bg-black/20'}`}>{m}</button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" onClick={() => setRetirando(false)}>Manter</Button>
                      <Button variant="destructive" onClick={retirar}>Retirar candidatura</Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="ghost" className="self-start text-red-700 hover:text-red-800 dark:text-red-400" onClick={() => setRetirando(true)}>Retirar candidatura</Button>
                )}
              </>
            )}
            {erro && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-900 dark:bg-red-950/60 dark:text-red-100">{erro}</p>}
          </>
        )}
      </div>
      <AbasDoCandidato />
    </MolduraDaConta>
  );
}
