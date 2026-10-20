import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowLeft, Bell } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTituloDaAba } from '@/hooks/useTituloDaAba';
import { AbasDoCandidato } from '@/components/vagas/AbasDoCandidato';
import { MolduraDaConta } from '@/components/vagas/MolduraDaConta';
import { ROTAS_DO_CANDIDATO, ehCandidato } from '@/lib/vagas/conta';
import { dataEHora } from '@/lib/vagas/candidatura';
import { marcarAvisosVistos, meusAvisos, type Aviso } from '@/lib/vagas/mensagens';

/**
 * /vagas/avisos — o sino do candidato (passo 5, mockup de 19/10/2026): tudo
 * que aconteceu nas candidaturas, do mais novo para o mais antigo. Abrir a
 * tela marca como visto; cada aviso leva à candidatura.
 */
export default function AvisosCandidatoPage() {
  const { user, isAuthenticated, loading } = useAuth();
  const [avisos, setAvisos] = useState<Aviso[] | null>(null);
  useTituloDaAba('Avisos · Trabalhe Conosco ANA Brasil');

  const idDoCandidato = user && ehCandidato(user) ? user.id : null;
  useEffect(() => {
    if (!idDoCandidato) return;
    // Lê antes de marcar, para mostrar o que era novo nesta visita.
    meusAvisos().then((l) => { setAvisos(l); if (l.some((a) => a.novo)) marcarAvisosVistos().catch(() => null); }).catch(() => setAvisos([]));
  }, [idDoCandidato]);

  if (loading) return null;
  if (!isAuthenticated) return <Navigate to={`${ROTAS_DO_CANDIDATO.entrar}?volta=${encodeURIComponent(ROTAS_DO_CANDIDATO.avisos)}`} replace />;
  if (!ehCandidato(user)) return <Navigate to="/" replace />;

  const atalho = <Link to={ROTAS_DO_CANDIDATO.minhaArea} className="text-foreground hover:text-primary">Minha área</Link>;
  return (
    <MolduraDaConta atalho={atalho}>
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 pb-10 pt-4 sm:px-6">
        <Link to={ROTAS_DO_CANDIDATO.minhaArea} className="flex items-center gap-1 self-start text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Minhas candidaturas</Link>
        <h1 className="text-2xl font-bold">Avisos</h1>
        {avisos === null ? <p className="text-muted-foreground">Abrindo…</p> : avisos.length === 0 ? (
          <p className="flex items-center gap-2 rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground"><Bell className="h-4 w-4" aria-hidden /> Nenhum aviso ainda.</p>
        ) : (
          <ul className="flex flex-col" data-testid="avisos">
            {avisos.map((a, i) => (
              <li key={`${a.candidatura_id}-${a.em}-${i}`}>
                <Link to={`${ROTAS_DO_CANDIDATO.minhaArea}/${a.candidatura_id}`} className="grid grid-cols-[10px_minmax(0,1fr)] items-start gap-3 border-b border-border py-3 hover:bg-muted/40">
                  <span className={`mt-1.5 h-2 w-2 rounded-full ${a.novo ? 'bg-[#F26B4F]' : ''}`} aria-label={a.novo ? 'novo' : undefined} />
                  <span className="min-w-0">
                    <span className={`block ${a.novo ? 'font-semibold' : ''}`}>{a.texto}</span>
                    <span className="block truncate text-xs text-muted-foreground">{a.vaga} · {dataEHora(a.em)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <AbasDoCandidato />
    </MolduraDaConta>
  );
}
