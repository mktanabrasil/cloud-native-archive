import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, KeyRound, MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTituloDaAba } from '@/hooks/useTituloDaAba';
import { MolduraDaConta } from '@/components/vagas/MolduraDaConta';
import { ROTAS_DO_CANDIDATO, emailValido, mensagemDaConta, pedirNovaSenha } from '@/lib/vagas/conta';

/**
 * /vagas/recuperar-senha (mockup 06). O link do e-mail leva à mesma tela de
 * nova senha da equipe (/redefinir-senha), que devolve o candidato à área
 * dele. A resposta é a mesma exista a conta ou não: a tela não conta a
 * ninguém quais e-mails têm cadastro.
 */
export default function RecuperarSenhaCandidatoPage() {
  useTituloDaAba('Recuperar senha · Trabalhe Conosco ANA Brasil');
  const [email, setEmail] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!emailValido(email)) { setErro('Confira o e-mail.'); return; }
    setErro(null); setEnviando(true);
    try {
      await pedirNovaSenha(email);
      setEnviado(true);
    } catch (err) {
      const msg = mensagemDaConta(err);
      // Limite de tentativas é o único erro que vale mostrar; o resto responde igual.
      if (msg.startsWith('Muitas')) setErro(msg); else setEnviado(true);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <MolduraDaConta atalho={<Link to={ROTAS_DO_CANDIDATO.entrar} className="text-foreground hover:text-primary">Entrar</Link>}>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-5 px-4 pb-12">
        <span className="vg-selo grid h-14 w-14 place-items-center rounded-[18px] bg-[#FBCE00] text-[#1F2322]">
          {enviado ? <MailCheck className="h-7 w-7" /> : <KeyRound className="h-7 w-7" />}
        </span>
        {enviado ? (
          <div className="vg-pergunta flex flex-col gap-3" role="status">
            <h1 className="text-[28px] font-bold leading-tight">Confira seu e-mail.</h1>
            <p className="text-muted-foreground">Se <b className="text-foreground">{email.trim()}</b> tiver conta, o link para criar uma senha nova chega em alguns minutos. Olhe também o spam.</p>
            <Button asChild variant="outline" className="mt-2 h-12 self-start rounded-xl"><Link to={ROTAS_DO_CANDIDATO.entrar}><ArrowLeft className="h-4 w-4" /> Voltar para entrar</Link></Button>
          </div>
        ) : (
          <form onSubmit={enviar} noValidate className="vg-pergunta flex flex-col gap-4">
            <h1 className="text-[28px] font-bold leading-tight">Esqueceu a senha?</h1>
            <p className="text-muted-foreground">Digite o e-mail da sua conta. Mandamos um link para você criar uma senha nova.</p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="vg-email-rec">E-mail</Label>
              <Input id="vg-email-rec" type="email" inputMode="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className="h-14 rounded-[14px] text-base" />
            </div>
            {erro && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-900 dark:bg-red-950/60 dark:text-red-100">{erro}</p>}
            <Button type="submit" disabled={enviando} className="h-14 rounded-[14px] text-base">{enviando ? 'Enviando…' : 'Enviar link'}</Button>
          </form>
        )}
      </div>
    </MolduraDaConta>
  );
}
