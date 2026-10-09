import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowRight, Briefcase, ChevronRight, FileUp, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useTituloDaAba } from '@/hooks/useTituloDaAba';
import { MolduraDasVagas } from '@/components/vagas/PecasDasVagas';
import { ROTAS_DO_CANDIDATO, ehCandidato, primeiroNome } from '@/lib/vagas/conta';
import { carregarPerfil, completude, passosQueFaltam, type Perfil } from '@/lib/vagas/perfil';
import { dataEHora, minhasCandidaturas, type Candidatura } from '@/lib/vagas/candidatura';
import { AbasDoCandidato } from '@/components/vagas/AbasDoCandidato';
import { EtapasDaCandidatura } from '@/components/vagas/EtapasDaCandidatura';

/**
 * /vagas/minha-area — a área do candidato (mockups 08, M11 e o do PR 7, de
 * 06/10/2026). Dois blocos grandes: Meu perfil, com o anel do quanto está
 * pronto, e Currículo. Embaixo, só os passos que faltam, cada um abrindo
 * direto no passo. Desde o PR 8 as candidaturas vêm no topo, cada uma com a
 * linha das etapas; no celular, a barra de abas fica embaixo.
 */

function Anel({ pct }: { pct: number }) {
  const r = 22, c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 52 52" className="h-14 w-14 shrink-0" role="img" aria-label={`${pct}% do perfil pronto`}>
      <circle cx="26" cy="26" r={r} fill="none" stroke="hsl(var(--background))" strokeWidth="6" />
      <circle cx="26" cy="26" r={r} fill="none" stroke="#0E6B58" strokeWidth="6" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} transform="rotate(-90 26 26)" />
      <text x="26" y="30.5" textAnchor="middle" fontFamily="Poppins, system-ui, sans-serif" fontWeight={700} fontSize="13" fill="hsl(var(--foreground))">{pct}%</text>
    </svg>
  );
}

export default function MinhaAreaCandidatoPage() {
  const { user, isAuthenticated, loading, signOut } = useAuth();
  const nome = primeiroNome(user);
  useTituloDaAba('Minha área · Trabalhe Conosco ANA Brasil');
  const [dados, setDados] = useState<{ perfil: Perfil; exps: number } | null>(null);
  const [candidaturas, setCandidaturas] = useState<Candidatura[] | null>(null);

  const idDoCandidato = user && ehCandidato(user) ? user.id : null;
  useEffect(() => {
    if (!idDoCandidato) return;
    carregarPerfil(idDoCandidato).then(({ perfil, experiencias }) => setDados({ perfil, exps: experiencias.length })).catch(() => setDados(null));
    minhasCandidaturas(idDoCandidato).then(setCandidaturas).catch(() => setCandidaturas([]));
  }, [idDoCandidato]);

  if (loading) return null;
  if (!isAuthenticated) return <Navigate to={`${ROTAS_DO_CANDIDATO.entrar}?volta=${encodeURIComponent(ROTAS_DO_CANDIDATO.minhaArea)}`} replace />;
  if (!ehCandidato(user)) return <Navigate to="/" replace />;

  const pct = dados ? completude(dados.perfil, dados.exps) : 0;
  const faltam = dados ? passosQueFaltam(dados.perfil, dados.exps) : [];
  const temCurriculo = !!dados?.perfil.curriculo_caminho;
  const primeiroQueFalta = faltam[0]?.passo ?? 0;

  return (
    <MolduraDasVagas>
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
        <h1 className="vg-pergunta text-[30px] font-bold leading-tight sm:text-[38px]">Olá, {nome}.</h1>

        <section aria-label="Minhas candidaturas" className="flex flex-col gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Minhas candidaturas</span>
          {candidaturas === null ? null : candidaturas.length === 0 ? (
            <div className="flex flex-col gap-3 rounded-[20px] bg-muted/60 p-5">
              <p className="flex items-center gap-2 font-semibold"><Briefcase className="h-4 w-4" aria-hidden /> Nenhuma candidatura ainda.</p>
              <Button asChild className="h-12 self-start rounded-xl px-6"><Link to="/vagas">Ver vagas abertas <ArrowRight className="h-4 w-4" /></Link></Button>
            </div>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {candidaturas.map((c) => (
                <li key={c.id}>
                  <Link to={`${ROTAS_DO_CANDIDATO.minhaArea}/${c.id}`} className="flex flex-col gap-2.5 rounded-2xl bg-muted/60 p-4 hover:bg-muted" data-testid="candidatura">
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <b className="block truncate">{c.vaga?.titulo ?? 'Vaga encerrada'}</b>
                        <span className="text-xs text-muted-foreground">Protocolo {c.protocolo} · {dataEHora(c.created_at).split(',')[0]}{c.retirada_em ? ' · retirada' : ''}</span>
                      </span>
                      <ChevronRight className="h-5 w-5 shrink-0" aria-hidden />
                    </span>
                    <EtapasDaCandidatura etapa={c.etapa} resultado={c.resultado} retirada={!!c.retirada_em} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="grid gap-3 sm:grid-cols-2">
          <Link to={pct === 100 ? ROTAS_DO_CANDIDATO.meuPerfil : `${ROTAS_DO_CANDIDATO.meuPerfil}${primeiroQueFalta ? `?passo=${primeiroQueFalta}` : ''}`}
            className="vg-sobe flex items-center gap-3 rounded-[20px] bg-emerald-50 p-4 transition-colors hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/70" data-testid="bloco-perfil">
            <Anel pct={pct} />
            <span className="min-w-0 flex-1">
              <b className="block text-base">Meu perfil</b>
              <span className="text-sm text-muted-foreground">{pct === 100 ? 'Pronto' : faltam.length === 1 ? 'Falta 1 passo' : `Faltam ${faltam.length} passos`}</span>
            </span>
            <ChevronRight className="h-5 w-5" aria-hidden />
          </Link>
          <Link to={ROTAS_DO_CANDIDATO.curriculo}
            className="vg-sobe flex items-center gap-3 rounded-[20px] bg-amber-50 p-4 transition-colors hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-950/70" style={{ ['--vg-i' as string]: 1 }} data-testid="bloco-curriculo">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-background"><FileUp className="h-6 w-6" aria-hidden /></span>
            <span className="min-w-0 flex-1">
              <b className="block text-base">Currículo</b>
              <span className="text-sm text-muted-foreground">{temCurriculo ? 'Recebido' : 'Ainda não enviado'}</span>
            </span>
            <ChevronRight className="h-5 w-5" aria-hidden />
          </Link>
        </div>

        {dados && faltam.length > 0 && (
          <ul className="flex flex-col gap-2" aria-label="O que falta no perfil">
            {faltam.map((f) => (
              <li key={f.passo}>
                <Link to={`${ROTAS_DO_CANDIDATO.meuPerfil}${f.passo ? `?passo=${f.passo}` : ''}`} className="flex items-center justify-between rounded-xl bg-muted/60 px-3 py-2.5 text-sm hover:bg-muted">
                  {f.nome} <span className="text-xs font-semibold text-[#B23A25] dark:text-[#FF9C88]">falta</span>
                </Link>
              </li>
            ))}
          </ul>
        )}


        <div className="flex flex-wrap items-center gap-4 border-t border-border pt-4 text-sm">
          <Link to={ROTAS_DO_CANDIDATO.privacidade} className="text-muted-foreground hover:text-foreground">Privacidade e dados</Link>
          <span className="flex-1" />
          <Button variant="ghost" onClick={() => signOut()}><LogOut className="h-4 w-4" /> Sair</Button>
        </div>
      </div>
      <AbasDoCandidato />
    </MolduraDasVagas>
  );
}
