import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ROTAS_DO_CANDIDATO, ehCandidato } from '@/lib/vagas/conta';
import { meusAvisos } from '@/lib/vagas/mensagens';

/**
 * O sino do candidato (passo 5, 20/10/2026): junta o que hoje só chegava por
 * e-mail (recebimento, avanço de etapa, mensagens do RH). A bolinha conta o
 * que é novo desde a última vez que a pessoa abriu os avisos.
 */
export function SinoDoCandidato() {
  const { user } = useAuth();
  const [novos, setNovos] = useState(0);
  const id = user && ehCandidato(user) ? user.id : null;
  useEffect(() => {
    if (!id) return;
    let vivo = true;
    meusAvisos().then((l) => { if (vivo) setNovos(l.filter((a) => a.novo).length); }).catch(() => null);
    return () => { vivo = false; };
  }, [id]);
  if (!id) return null;
  return (
    <Link to={ROTAS_DO_CANDIDATO.avisos} aria-label={novos ? `Avisos, ${novos} ${novos === 1 ? 'novo' : 'novos'}` : 'Avisos'}
      className="relative grid h-10 w-10 place-items-center rounded-xl bg-muted/60 text-foreground hover:bg-muted" data-testid="sino">
      <Bell className="h-5 w-5" aria-hidden />
      {novos > 0 && <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#F26B4F] px-1 text-[10.5px] font-bold text-white" aria-hidden>{novos > 9 ? '9+' : novos}</span>}
    </Link>
  );
}
