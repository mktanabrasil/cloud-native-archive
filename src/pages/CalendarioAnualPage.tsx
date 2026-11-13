import { useCallback, useEffect, useState } from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { ArrowLeft, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { ROTAS_DO_CANDIDATO, ehCandidato, primeiroNome } from '@/lib/vagas/conta';
import { ehContaDoCalendario } from '@/lib/calendario/conta';
import { ANO_DO_CALENDARIO, lerAno, lerItens, meuAcesso } from '@/lib/calendario/api';
import { aberto, type AnoDoCalendario, type ItemDoCalendario } from '@/lib/calendario/regras';
import { MolduraDoCalendario } from '@/components/calendario/MolduraDoCalendario';
import { EntradaDoCalendario } from '@/components/calendario/EntradaDoCalendario';
import { InicioDoCalendario, type Parte } from '@/components/calendario/InicioDoCalendario';
import { PercursosDoAno } from '@/components/calendario/PercursosDoAno';
import { MesAMes } from '@/components/calendario/MesAMes';
import { CoordenadorasDoCalendario } from '@/components/calendario/CoordenadorasDoCalendario';

/**
 * /calendario (14/11/2026): o Calendário Anual dos educadores.
 *
 * - Sem sessão: a entrada (entrar, primeiro acesso, esqueci a senha).
 * - Conta do calendário: o preenchimento, se o marketing liberou o e-mail.
 * - Marketing: o mesmo preenchimento, mais quem tem acesso.
 * - O resto da equipe: o calendário de eventos, que mora na aba do hub
 *   (este endereço era dele até 14/11/2026).
 */
export default function CalendarioAnualPage() {
  const { user, isAuthenticated, loading, signOut } = useAuth();
  const { isMarketing, loading: carregandoPapel } = useUserRole();
  const location = useLocation();

  if (loading) return null;
  if (!isAuthenticated) return <MolduraDoCalendario><EntradaDoCalendario /></MolduraDoCalendario>;
  if (ehCandidato(user)) return <Navigate to={ROTAS_DO_CANDIDATO.minhaArea} replace />;
  const doCalendario = ehContaDoCalendario(user);
  if (!doCalendario) {
    if (carregandoPapel) return null;
    if (!isMarketing) {
      const resto = new URLSearchParams(location.search); resto.delete('parte'); resto.delete('m');
      return <Navigate to={`/?tela=calendario${resto.toString() ? `&${resto}` : ''}`} replace />;
    }
  }
  const atalho = (
    <span className="flex items-center gap-2">
      {!doCalendario && <Button asChild variant="ghost" size="sm" className="gap-1"><a href="/"><ArrowLeft className="h-4 w-4" /> App</a></Button>}
      <span className="hidden text-muted-foreground sm:inline">{primeiroNome(user)}</span>
      <Button variant="ghost" size="sm" className="gap-1" onClick={() => void signOut()}><LogOut className="h-4 w-4" /> Sair</Button>
    </span>
  );
  return (
    <MolduraDoCalendario atalho={atalho}>
      <Preenchimento email={user?.email ?? ''} marketing={!doCalendario && isMarketing} />
    </MolduraDoCalendario>
  );
}

function Preenchimento({ email, marketing }: { email: string; marketing: boolean }) {
  const [params, setParams] = useSearchParams();
  const parte = (params.get('parte') as Parte | null) ?? 'inicio';
  const mes = Math.min(12, Math.max(1, Number(params.get('m')) || 1));
  const [estado, setEstado] = useState<'carregando' | 'sem_acesso' | 'erro' | 'pronto'>('carregando');
  const [ano, setAno] = useState<AnoDoCalendario | null>(null);
  const [itens, setItens] = useState<ItemDoCalendario[]>([]);

  const carregar = useCallback(async () => {
    try {
      if (!marketing) {
        const acesso = await meuAcesso(email);
        if (!acesso?.ativo) { setEstado('sem_acesso'); return; }
      }
      const [a, i] = await Promise.all([lerAno(ANO_DO_CALENDARIO), lerItens(ANO_DO_CALENDARIO)]);
      if (!a) { setEstado(marketing ? 'erro' : 'sem_acesso'); return; }
      setAno(a); setItens(i); setEstado('pronto');
    } catch { setEstado('erro'); }
  }, [email, marketing]);
  useEffect(() => { void carregar(); }, [carregar]);

  const abrir = (p: Parte, m?: number) => {
    const n = new URLSearchParams();
    if (p !== 'inicio') n.set('parte', p);
    if (m) n.set('m', String(m));
    setParams(n);
    window.scrollTo?.({ top: 0 });
  };

  if (estado === 'carregando') return <p className="px-6 py-10 text-center text-[14px] text-muted-foreground">Carregando o calendário…</p>;
  if (estado === 'sem_acesso') return (
    <div className="mx-auto max-w-md px-4 py-10">
      <div className="glass-2 rounded-[22px] p-6 text-center" role="status">
        <h1 className="font-display text-[22px] font-bold">Seu acesso ainda não foi liberado</h1>
        <p className="mt-2 text-[14px] text-muted-foreground">O marketing libera o e-mail <b>{email}</b> para o Calendário Anual. Quando for liberado, é só entrar de novo.</p>
      </div>
    </div>
  );
  if (estado === 'erro' || !ano) return (
    <div className="mx-auto max-w-md px-4 py-10 text-center">
      <p className="text-[14px]">Não consegui carregar o calendário agora.</p>
      <Button className="mt-3" onClick={() => { setEstado('carregando'); void carregar(); }}>Tentar de novo</Button>
    </div>
  );

  const editavel = marketing || aberto(ano);
  const voltar = parte !== 'inicio' && (
    <div className="mx-auto w-full max-w-7xl px-4 pb-2 lg:px-6"><Button variant="ghost" size="sm" className="gap-1" onClick={() => abrir('inicio')}><ArrowLeft className="h-4 w-4" /> Início</Button></div>
  );
  return (
    <>
      {voltar}
      {parte === 'percursos' && <PercursosDoAno ano={ano} editavel={editavel} onAno={setAno} />}
      {parte === 'mes' && <MesAMes ano={ano} itens={itens} editavel={editavel} mes={mes} onMes={m => abrir('mes', m)} onAno={setAno} onItens={setItens} />}
      {parte === 'coordenadoras' && marketing && <CoordenadorasDoCalendario quem={email} />}
      {(parte === 'inicio' || (parte === 'coordenadoras' && !marketing)) && <InicioDoCalendario ano={ano} editavel={editavel} marketing={marketing} onAno={setAno} abrir={abrir} />}
    </>
  );
}
