import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useTituloDaAba } from '@/hooks/useTituloDaAba';
import { LinhaDePassos } from '@/components/vagas/LinhaDeVoo';
import { MolduraDaConta } from '@/components/vagas/MolduraDaConta';
import {
  ROTAS_DO_CANDIDATO, SENHA_MINIMA, criarContaDeCandidato, ehCandidato, emailValido, mensagemDaConta, problemaDaSenha,
} from '@/lib/vagas/conta';

/**
 * /vagas/criar-conta — o cadastro em conversa (mockups 05, 05b e M03,
 * animação aprovada em 25/09/2026). Uma pergunta por vez: nome, e-mail,
 * senha e o aceite. A cada resposta a pergunta sai para cima, a próxima entra
 * por baixo, e o avião voa até a parada seguinte, mais alta. No fim ele
 * decola e a conta está criada. Sem conta Google, como decidido.
 */

type Etapa = 0 | 1 | 2 | 3;

const PERGUNTAS: Record<Etapa, { titulo: string; pergunta: string; dica: string }> = {
  0: { titulo: 'Todo voo começa com o seu nome.', pergunta: 'Como você quer ser chamado?', dica: 'Pode ser o nome social. O nome completo só entra no perfil, depois.' },
  1: { titulo: 'Para onde mandamos os avisos?', pergunta: 'Qual é o seu e-mail?', dica: 'É por ele que você entra e acompanha cada etapa.' },
  2: { titulo: 'Uma senha só sua.', pergunta: 'Crie uma senha', dica: `Pelo menos ${SENHA_MINIMA} caracteres, com letras e números.` },
  3: { titulo: 'Quase lá.', pergunta: 'Antes de criar a conta', dica: '' },
};

export default function CriarContaCandidatoPage() {
  useTituloDaAba('Criar conta · Trabalhe Conosco ANA Brasil');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // Veio de "Candidatar-se": no fim, o botão principal volta para a candidatura.
  const volta = (params.get('volta') ?? '').startsWith('/vagas/') ? params.get('volta')! : null;
  const entrar = volta ? `${ROTAS_DO_CANDIDATO.entrar}?volta=${encodeURIComponent(volta)}` : ROTAS_DO_CANDIDATO.entrar;
  const { user, isAuthenticated, loading } = useAuth();
  const [etapa, setEtapa] = useState<Etapa>(0);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [verSenha, setVerSenha] = useState(false);
  const [aceite, setAceite] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [fim, setFim] = useState<'pronta' | 'confirmar' | null>(null);
  const campo = useRef<HTMLInputElement>(null);
  // Criando a conta agora: a sessão nova chega antes da tela de sucesso, e sem
  // esta trava o redirecionamento abaixo pularia o "Conta criada".
  const criandoAgora = useRef(false);

  // Quem já é candidato e está logado não precisa criar outra conta.
  useEffect(() => {
    if (!loading && isAuthenticated && ehCandidato(user) && fim === null && !criandoAgora.current) navigate(volta ?? ROTAS_DO_CANDIDATO.minhaArea, { replace: true });
  }, [loading, isAuthenticated, user, fim, navigate, volta]);

  // O foco acompanha a pergunta, para seguir só no teclado.
  useEffect(() => { campo.current?.focus(); }, [etapa]);

  function conferir(): string | null {
    if (etapa === 0 && !nome.trim()) return 'Escreva como você quer ser chamado.';
    if (etapa === 1 && !emailValido(email)) return 'Confira o e-mail: falta o @ ou o final (.com, .br…).';
    if (etapa === 2) return problemaDaSenha(senha);
    if (etapa === 3 && !aceite) return 'Para criar a conta, marque que leu e aceita os termos.';
    return null;
  }

  async function seguir(e: FormEvent) {
    e.preventDefault();
    const problema = conferir();
    if (problema) { setErro(problema); return; }
    setErro(null);
    if (etapa < 3) { setEtapa((etapa + 1) as Etapa); return; }
    setEnviando(true);
    criandoAgora.current = true;
    try {
      const r = await criarContaDeCandidato(nome, email, senha);
      setFim(r.precisaConfirmar ? 'confirmar' : 'pronta');
    } catch (err) {
      const msg = mensagemDaConta(err);
      setErro(msg);
      // E-mail já cadastrado: volta para a pergunta do e-mail, com o aviso.
      if (msg.startsWith('Já existe')) setEtapa(1);
      criandoAgora.current = false;
    } finally {
      setEnviando(false);
    }
  }

  const q = PERGUNTAS[etapa];
  const primeiro = nome.trim().split(/\s+/)[0];

  return (
    <MolduraDaConta atalho={<Link to={entrar} className="text-foreground hover:text-primary">Já tenho conta</Link>}>
      <div className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-[minmax(0,1fr)] content-center items-center gap-6 px-4 pb-10 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,500px)] lg:gap-12 lg:px-12">
        <div className="flex flex-col gap-4 lg:gap-6">
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300" aria-live="polite">
            {fim ? 'Criar conta · pronto' : `Criar conta · ${Math.min(etapa + 1, 3)} de 3 · um minuto`}
          </span>
          <h1 key={fim ?? etapa} className="vg-pergunta text-[30px] font-bold leading-[1.08] tracking-tight sm:text-[44px]">
            {fim === 'pronta' ? <>Conta criada.<br />Bom voo, {primeiro}!</> : fim === 'confirmar' ? 'Falta só confirmar o e-mail.' : q.titulo}
          </h1>
          <LinhaDePassos atual={Math.min(etapa, 2)} concluido={fim !== null} />
        </div>

        {fim ? (
          <div className="vg-pergunta flex flex-col items-start gap-4 lg:border-l lg:border-border lg:pl-10">
            <span className="vg-selo grid h-16 w-16 place-items-center rounded-[20px] bg-[#F37964] text-[#1F2322]">
              {fim === 'pronta' ? <Check className="h-8 w-8" strokeWidth={2.6} /> : <MailCheck className="h-8 w-8" />}
            </span>
            {fim === 'pronta' ? (
              <>
                <h2 className="text-2xl font-bold">Tudo pronto.</h2>
                <p className="text-muted-foreground">Agora é só escolher uma vaga.</p>
                <div className="flex flex-wrap gap-2">
                  {volta
                    ? <Button asChild className="h-12 rounded-xl px-6"><Link to={volta}>Continuar a candidatura <ArrowRight className="h-4 w-4" /></Link></Button>
                    : <Button asChild className="h-12 rounded-xl px-6"><Link to="/vagas">Ver vagas <ArrowRight className="h-4 w-4" /></Link></Button>}
                  <Button asChild variant="outline" className="h-12 rounded-xl px-6"><Link to={ROTAS_DO_CANDIDATO.minhaArea}>Minha área</Link></Button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold">Confira sua caixa de entrada.</h2>
                <p className="text-muted-foreground">Mandamos um link para <b className="text-foreground">{email.trim()}</b>. Toque nele para ativar a conta. Se não chegar em alguns minutos, olhe o spam.</p>
                <Button asChild variant="outline" className="h-12 rounded-xl px-6"><Link to={entrar}>Já confirmei, quero entrar</Link></Button>
              </>
            )}
          </div>
        ) : (
          <form onSubmit={seguir} noValidate className="flex flex-col gap-4 lg:border-l lg:border-border lg:pl-10" aria-label="Criar conta">
            <div key={etapa} className="vg-pergunta flex flex-col gap-4">
              <label htmlFor="vg-resposta" className="text-[22px] font-bold sm:text-[26px]">{q.pergunta}</label>
              {etapa === 0 && <Input ref={campo} id="vg-resposta" autoComplete="given-name" value={nome} maxLength={120} onChange={e => setNome(e.target.value)} className="h-[60px] rounded-2xl text-xl" aria-describedby="vg-dica" />}
              {etapa === 1 && <Input ref={campo} id="vg-resposta" type="email" inputMode="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className="h-[60px] rounded-2xl text-xl" aria-describedby="vg-dica" />}
              {etapa === 2 && (
                <div className="relative">
                  <Input ref={campo} id="vg-resposta" type={verSenha ? 'text' : 'password'} autoComplete="new-password" value={senha} onChange={e => setSenha(e.target.value)} className="h-[60px] rounded-2xl pr-14 text-xl" aria-describedby="vg-dica" />
                  <button type="button" onClick={() => setVerSenha(v => !v)} aria-label={verSenha ? 'Esconder senha' : 'Mostrar senha'}
                    className="absolute right-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:text-foreground">
                    {verSenha ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              )}
              {etapa === 3 && (
                <div className="flex flex-col gap-3 rounded-2xl bg-muted/60 p-4 text-sm">
                  <p><b>{nome.trim()}</b> · {email.trim()}</p>
                  <label className="flex cursor-pointer items-start gap-3">
                    <Checkbox checked={aceite} onCheckedChange={v => setAceite(v === true)} className="mt-0.5" aria-label="Li e aceito os Termos de Uso e o Aviso de Privacidade" />
                    <span>Li e aceito os Termos de Uso e o <Link to={ROTAS_DO_CANDIDATO.privacidade} target="_blank" className="font-semibold text-primary underline">Aviso de Privacidade</Link>.</span>
                  </label>
                </div>
              )}
              {q.dica && <p id="vg-dica" className="text-sm text-muted-foreground">{q.dica}</p>}
            </div>
            {erro && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-900 dark:bg-red-950/60 dark:text-red-100">{erro}</p>}
            <div className="flex flex-wrap items-center gap-2">
              {etapa > 0 && <Button type="button" variant="ghost" className="h-14 rounded-2xl" onClick={() => { setErro(null); setEtapa((etapa - 1) as Etapa); }}><ArrowLeft className="h-4 w-4" /> Voltar</Button>}
              <Button type="submit" disabled={enviando} className="group h-14 flex-1 rounded-2xl px-8 text-base sm:flex-none">
                {enviando ? 'Criando…' : etapa === 3 ? 'Criar conta' : <>Continuar <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" /></>}
              </Button>
            </div>
          </form>
        )}
      </div>
    </MolduraDaConta>
  );
}
