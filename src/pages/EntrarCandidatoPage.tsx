import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Lock, User as Pessoa, Clock, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useTituloDaAba } from '@/hooks/useTituloDaAba';
import { FraseEmEscada, useLarguraDaEscada } from '@/components/vagas/LinhaDeVoo';
import { MolduraDaConta } from '@/components/vagas/MolduraDaConta';
import { ROTAS_DO_CANDIDATO, ehCandidato, emailValido, entrarComoCandidato, mensagemDaConta } from '@/lib/vagas/conta';

/**
 * /vagas/entrar — o login do candidato (mockups 04 e M12, animação aprovada
 * em 25/09/2026): a frase da ANA sobe a escada, a linha de voo se desenha, o
 * avião pousa na parada coral e "altos." dá um pulinho. O formulário chega
 * pela direita no computador e fica embaixo da frase no celular.
 *
 * Quem entrar aqui com conta da equipe vai para o app, não para a área do
 * candidato: a mesma porta serve às duas contas sem prender ninguém.
 */
export default function EntrarCandidatoPage() {
  useTituloDaAba('Entrar · Trabalhe Conosco ANA Brasil');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user, isAuthenticated, loading } = useAuth();
  const largura = useLarguraDaEscada();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [verSenha, setVerSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);
  const destino = params.get('volta') || ROTAS_DO_CANDIDATO.minhaArea;

  // Já tem sessão de candidato: vai direto.
  useEffect(() => {
    if (!loading && isAuthenticated && ehCandidato(user)) navigate(destino, { replace: true });
  }, [loading, isAuthenticated, user, destino, navigate]);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    if (!emailValido(email)) { setErro('Confira o e-mail.'); return; }
    if (!senha) { setErro('Digite a senha.'); return; }
    setErro(null); setEntrando(true);
    try {
      const u = await entrarComoCandidato(email, senha);
      if (!ehCandidato(u)) {
        // Conta da equipe passa pelo login da equipe, que confere conta desativada e pedido pendente.
        await supabase.auth.signOut();
        setErro('Essa é uma conta da equipe da ANA. Entre pela página da equipe.');
        setEntrando(false);
        return;
      }
      navigate(destino, { replace: true });
    } catch (err) {
      setErro(mensagemDaConta(err));
      setEntrando(false);
    }
  }

  return (
    <MolduraDaConta atalho={<Link to={ROTAS_DO_CANDIDATO.criarConta} className="text-foreground hover:text-primary">Criar conta</Link>}>
      <div className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-[minmax(0,1fr)] content-center items-center gap-8 px-4 pb-10 pt-2 sm:px-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-12 lg:px-12">
        <div className="flex flex-col gap-6">
          <div className="mx-auto w-full max-w-[380px] lg:max-w-none">
            <FraseEmEscada key={largura} estreito={largura === 'estreito'} />
          </div>
          <ul className="hidden flex-wrap gap-5 text-sm text-muted-foreground lg:flex">
            {[[Pessoa, 'Perfil salvo'], [Clock, 'Etapas à vista'], [ShieldCheck, 'Seus dados protegidos']].map(([Icone, t]) => {
              const I = Icone as typeof Pessoa;
              return <li key={t as string} className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-[10px] bg-muted"><I className="h-4 w-4" aria-hidden /></span>{t as string}</li>;
            })}
          </ul>
        </div>

        <form onSubmit={entrar} noValidate className="vg-chega-do-lado flex flex-col gap-4 rounded-[20px] bg-muted/60 p-6 sm:p-7" aria-label="Entrar">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Entrar</h1>
            <img src="/logo.png" alt="" width={36} height={36} className="rounded-[11px]" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="vg-email">E-mail</Label>
            <Input id="vg-email" type="email" inputMode="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)}
              className="h-[54px] rounded-[14px] bg-background text-base" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="vg-senha">Senha</Label>
            <div className="relative">
              <Input id="vg-senha" type={verSenha ? 'text' : 'password'} autoComplete="current-password" value={senha} onChange={e => setSenha(e.target.value)}
                className="h-[54px] rounded-[14px] bg-background pr-12 text-base" />
              <button type="button" onClick={() => setVerSenha(v => !v)} aria-label={verSenha ? 'Esconder senha' : 'Mostrar senha'}
                className="absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:text-foreground">
                {verSenha ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>
          <div className="flex justify-end"><Link to={ROTAS_DO_CANDIDATO.recuperarSenha} className="text-sm text-primary hover:underline">Esqueci a senha</Link></div>
          {erro && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-900 dark:bg-red-950/60 dark:text-red-100">{erro}{erro.includes('equipe') && <> <Link to="/login" className="font-semibold underline">Ir para a página da equipe</Link></>}</p>}
          <Button type="submit" disabled={entrando} className="group h-14 rounded-[14px] text-base">
            {entrando ? 'Entrando…' : <>Entrar <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" /></>}
          </Button>
          <p className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" aria-hidden /> Conexão protegida</span>
            <Link to="/login" className="hover:text-foreground">Equipe ANA</Link>
          </p>
          <p className="text-center text-sm text-muted-foreground">Ainda não tem conta? <Link to={ROTAS_DO_CANDIDATO.criarConta} className="font-semibold text-primary hover:underline">Criar em um minuto</Link></p>
        </form>
      </div>
    </MolduraDaConta>
  );
}
