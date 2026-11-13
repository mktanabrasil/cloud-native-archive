import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { criarContaDoCalendario, entrarNoCalendario, recuperarSenhaDoCalendario } from '@/lib/calendario/conta';
import { emailValido, mensagemDaConta, problemaDaSenha } from '@/lib/vagas/conta';

type Modo = 'entrar' | 'primeiro' | 'esqueci';

/**
 * A entrada do Calendário Anual (14/11/2026): entrar, criar a senha no
 * primeiro acesso, ou pedir o link de troca de senha. O e-mail precisa estar
 * liberado pelo marketing; isso o banco confere depois de entrar.
 */
export function EntradaDoCalendario() {
  const [modo, setModo] = useState<Modo>('entrar');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [indo, setIndo] = useState(false);

  const trocar = (m: Modo) => { setModo(m); setErro(null); setAviso(null); };

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null); setAviso(null);
    if (!emailValido(email)) return setErro('Confira o e-mail.');
    if (modo === 'primeiro') {
      if (nome.trim().length < 2) return setErro('Escreva o seu nome.');
      const p = problemaDaSenha(senha);
      if (p) return setErro(p);
    }
    if (modo === 'entrar' && !senha) return setErro('Escreva a senha.');
    setIndo(true);
    try {
      if (modo === 'entrar') await entrarNoCalendario(email, senha);
      else if (modo === 'primeiro') {
        const r = await criarContaDoCalendario(nome, email, senha);
        if (r.precisaConfirmar) setAviso(`Enviamos um link de confirmação para ${email.trim().toLowerCase()}. Abra o link e volte aqui para entrar.`);
      } else {
        await recuperarSenhaDoCalendario(email);
        setAviso('Se esse e-mail tiver conta, chega um link para criar uma senha nova.');
      }
    } catch (x) {
      setErro(mensagemDaConta(x));
    } finally {
      setIndo(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[440px] px-4 py-8">
      <div className="glass-2 rounded-[24px] p-6">
        <h1 className="font-display text-[26px] font-bold tracking-tight">Calendário Anual</h1>
        <p className="mt-1 text-[14px] text-muted-foreground">Para as coordenadoras do Social preencherem o calendário dos educadores. O acesso é liberado pelo marketing.</p>

        {modo !== 'esqueci' && (
          <div className="mt-5 grid grid-cols-2 gap-1 rounded-full bg-black/[.05] p-1 text-[13.5px] dark:bg-white/[.06]" role="tablist">
            {(['entrar', 'primeiro'] as const).map(m => (
              <button key={m} type="button" role="tab" aria-selected={modo === m} onClick={() => trocar(m)}
                className={`rounded-full py-2 font-semibold transition-colors ${modo === m ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}>
                {m === 'entrar' ? 'Entrar' : 'Primeiro acesso'}
              </button>
            ))}
          </div>
        )}

        <form className="mt-5 space-y-3" onSubmit={enviar} noValidate>
          {modo === 'primeiro' && (
            <div><Label htmlFor="cal-nome">Seu nome</Label><Input id="cal-nome" className="mt-1" value={nome} onChange={e => setNome(e.target.value)} autoComplete="name" /></div>
          )}
          <div><Label htmlFor="cal-email">E-mail</Label><Input id="cal-email" type="email" className="mt-1" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" /></div>
          {modo !== 'esqueci' && (
            <div>
              <Label htmlFor="cal-senha">{modo === 'primeiro' ? 'Crie uma senha' : 'Senha'}</Label>
              <Input id="cal-senha" type="password" className="mt-1" value={senha} onChange={e => setSenha(e.target.value)} autoComplete={modo === 'primeiro' ? 'new-password' : 'current-password'} />
              {modo === 'primeiro' && <p className="mt-1 text-[12px] text-muted-foreground">Pelo menos 8 caracteres, com letras e números.</p>}
            </div>
          )}
          {erro && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-[13px] text-destructive">{erro}</p>}
          {aviso && <p role="status" className="rounded-xl border border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/5 px-3 py-2 text-[13px]">{aviso}</p>}
          <Button type="submit" className="h-11 w-full" disabled={indo}>
            {indo ? 'Um instante…' : modo === 'entrar' ? 'Entrar' : modo === 'primeiro' ? 'Criar minha senha' : 'Enviar o link'}
          </Button>
        </form>

        <div className="mt-4 text-center text-[13px]">
          {modo === 'esqueci'
            ? <button type="button" className="font-semibold underline underline-offset-2" onClick={() => trocar('entrar')}>Voltar para entrar</button>
            : <button type="button" className="text-muted-foreground underline underline-offset-2" onClick={() => trocar('esqueci')}>Esqueci a senha</button>}
        </div>
      </div>
    </div>
  );
}
