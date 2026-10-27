import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useTituloDaAba } from '@/hooks/useTituloDaAba';
import { AbasDoCandidato } from '@/components/vagas/AbasDoCandidato';
import { EtapasDaCandidatura } from '@/components/vagas/EtapasDaCandidatura';
import { MolduraDaConta } from '@/components/vagas/MolduraDaConta';
import { MensagensDoCandidato } from '@/components/vagas/MensagensDoCandidato';
import { SinoDoCandidato } from '@/components/vagas/SinoDoCandidato';
import { ROTAS_DO_CANDIDATO, ehCandidato } from '@/lib/vagas/conta';
import { dataEHora, rotuloDaEtapa, minhasCandidaturas, retirarCandidatura, type Candidatura } from '@/lib/vagas/candidatura';

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

  const atalho = <span className="flex items-center gap-3"><Link to={ROTAS_DO_CANDIDATO.minhaArea} className="text-foreground hover:text-[hsl(var(--sel))]">Minha área</Link><SinoDoCandidato /></span>;
  const etapaVisivel = c ? rotuloDaEtapa(c.etapa, c.resultado) : '';

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
            <div className="grid gap-1 rounded-[20px] border border-black/5 bg-card dark:border-white/5 p-5">
              <h1 className="text-[24px] font-bold leading-tight">{c.vaga?.titulo ?? 'Vaga encerrada'}</h1>
              <span className="text-sm text-muted-foreground">Protocolo <b className="tabular-nums text-foreground">{c.protocolo}</b> · enviada em {dataEHora(c.created_at)}</span>
            </div>
            <span className={`inline-flex items-center gap-1.5 self-start text-[13px] font-semibold ${c.retirada_em ? 'text-muted-foreground' : 'text-info'}`}><span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
              {c.retirada_em ? 'Retirada' : etapaVisivel}
            </span>
            <EtapasDaCandidatura etapa={c.etapa} resultado={c.resultado} retirada={!!c.retirada_em} />

            <MensagensDoCandidato candidatura={c.id} retirada={!!c.retirada_em} />

            {c.retirada_em ? (
              <p className="rounded-2xl bg-muted/70 p-4 text-sm text-muted-foreground">
                Você retirou esta candidatura em {dataEHora(c.retirada_em)}. Se a vaga ainda estiver aberta, dá para se candidatar de novo.
              </p>
            ) : (
              <>
                <h2 className="mt-2 text-[15px] font-semibold">O que você enviou</h2>
                <div className="grid gap-2.5 rounded-[20px] border border-black/5 bg-card dark:border-white/5 p-5 text-sm">
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Perfil</span><b className="font-semibold">versão de {dataEHora(c.created_at).split(',')[0]}</b></div>
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Currículo</span><b className="truncate font-semibold">{c.curriculo_nome ?? 'Sem currículo'}</b></div>
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Requisitos marcados</span><b className="font-semibold">{c.requisitos.filter((r) => r.atende).length} de {c.requisitos.length}</b></div>
                  {c.respostas.length > 0 && <div className="flex justify-between gap-3"><span className="text-muted-foreground">Respostas</span><b className="font-semibold">{c.respostas.length}</b></div>}
                </div>

                {retirando ? (
                  <div className="flex flex-col gap-3 rounded-[20px] border border-destructive/30 bg-destructive/10 p-4" role="alert">
                    <p className="font-semibold text-destructive">Retirar a candidatura?</p>
                    <p className="text-sm">Você deixa de participar deste processo. Se quiser, conte o motivo:</p>
                    <div className="flex flex-wrap gap-2">
                      {MOTIVOS.map((m) => (
                        <button key={m} type="button" aria-pressed={motivo === m} onClick={() => setMotivo(motivo === m ? null : m)}
                          className={`min-h-11 rounded-xl border px-3 py-2 text-[13px] font-medium transition-colors ${motivo === m ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-card hover:bg-muted/60'}`}>{m}</button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" onClick={() => setRetirando(false)}>Manter</Button>
                      <Button variant="destructive" onClick={retirar}>Retirar candidatura</Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="ghost" className="self-start text-destructive hover:text-destructive" onClick={() => setRetirando(true)}>Retirar candidatura</Button>
                )}
              </>
            )}
            {erro && <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>}
          </>
        )}
      </div>
      <AbasDoCandidato />
    </MolduraDaConta>
  );
}
