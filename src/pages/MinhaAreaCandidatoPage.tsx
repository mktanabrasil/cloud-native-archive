import { Link, Navigate } from 'react-router-dom';
import { ArrowRight, Briefcase, FileText, LogOut, User as Pessoa } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useTituloDaAba } from '@/hooks/useTituloDaAba';
import { MolduraDasVagas } from '@/components/vagas/PecasDasVagas';
import { ROTAS_DO_CANDIDATO, ehCandidato, primeiroNome } from '@/lib/vagas/conta';

/**
 * /vagas/minha-area — a área do candidato (mockups 08 e M11).
 *
 * Neste PR ela só recebe quem acabou de criar conta: o perfil, o currículo e
 * as candidaturas chegam nos próximos (PR 7 a 9). Até lá, a inscrição de
 * cada vaga segue pelo formulário dela, e a tela diz isso sem rodeio.
 */
export default function MinhaAreaCandidatoPage() {
  const { user, isAuthenticated, loading, signOut } = useAuth();
  const nome = primeiroNome(user);
  useTituloDaAba('Minha área · Trabalhe Conosco ANA Brasil');

  if (loading) return null;
  if (!isAuthenticated) return <Navigate to={`${ROTAS_DO_CANDIDATO.entrar}?volta=${encodeURIComponent(ROTAS_DO_CANDIDATO.minhaArea)}`} replace />;
  if (!ehCandidato(user)) return <Navigate to="/" replace />;

  const embreve = [
    [Pessoa, '#F5DFBB', 'Perfil', 'Dados e contato, preenchidos uma vez só'],
    [FileText, '#01ADFF', 'Currículo', 'Experiência, formação e o seu PDF'],
    [Briefcase, '#81E2CF', 'Candidaturas', 'Cada etapa à vista, com aviso'],
  ] as const;

  return (
    <MolduraDasVagas>
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-2">
          <h1 className="vg-pergunta text-[30px] font-bold leading-tight sm:text-[38px]">Olá, {nome}.</h1>
          <p className="text-muted-foreground">Sua conta está pronta. Entrou com <b className="text-foreground">{user?.email}</b>.</p>
        </div>

        <div className="flex flex-col gap-3 rounded-[20px] bg-muted/60 p-5 sm:p-6">
          <p className="font-semibold">Por enquanto, a inscrição de cada vaga continua pelo formulário dela.</p>
          <p className="text-sm text-muted-foreground">Abra a vaga e toque em Candidatar-se. Logo a candidatura vai ser feita aqui mesmo, com o seu perfil já preenchido.</p>
          <Button asChild className="mt-1 h-12 self-start rounded-xl px-6"><Link to="/vagas">Ver vagas abertas <ArrowRight className="h-4 w-4" /></Link></Button>
        </div>

        <section aria-label="Em breve" className="grid gap-3 sm:grid-cols-3">
          {embreve.map(([Icone, cor, t, d], i) => (
            <div key={t} className="vg-sobe flex flex-col gap-2 rounded-2xl border border-dashed border-border p-4" style={{ ['--vg-i' as string]: i }}>
              <span className="grid h-10 w-10 place-items-center rounded-xl text-[#1F2322]" style={{ background: cor }}><Icone className="h-5 w-5" aria-hidden /></span>
              <b>{t}</b>
              <span className="text-sm text-muted-foreground">{d}</span>
              <span className="text-xs font-semibold text-muted-foreground">Em breve</span>
            </div>
          ))}
        </section>

        <div className="flex flex-wrap items-center gap-4 border-t border-border pt-4 text-sm">
          <Link to={ROTAS_DO_CANDIDATO.privacidade} className="text-muted-foreground hover:text-foreground">Privacidade e dados</Link>
          <span className="flex-1" />
          <Button variant="ghost" onClick={() => signOut()}><LogOut className="h-4 w-4" /> Sair</Button>
        </div>
      </div>
    </MolduraDasVagas>
  );
}
