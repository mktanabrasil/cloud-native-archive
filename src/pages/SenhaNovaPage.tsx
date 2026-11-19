import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Copy, KeyRound, Loader2, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTituloDaAba } from '@/hooks/useTituloDaAba';
import { codigoDoLink, gerarMinhaSenha } from '@/lib/senhas/email';
import logoImg from '@/assets/logo.png';

/**
 * "Gerar minha senha" (19/11/2026, PR 3 das senhas; mockup aprovado). O link
 * do e-mail traz um código de 1 hora e uso único. Abrir a página não gasta o
 * código: a senha só é gerada quando a pessoa toca no botão. Aí aparece uma
 * vez, para copiar e entrar.
 */
export default function SenhaNovaPage() {
  useTituloDaAba('Gerar minha senha · ANA Brasil');
  const { search } = useLocation();
  const navigate = useNavigate();
  const codigo = codigoDoLink(search);
  const [estado, setEstado] = useState<'inicio' | 'gerando' | 'pronta' | 'erro'>('inicio');
  const [senha, setSenha] = useState('');
  const [email, setEmail] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const [copiou, setCopiou] = useState('');

  const gerar = async () => {
    if (!codigo) return;
    setEstado('gerando');
    try {
      const r = await gerarMinhaSenha(codigo);
      setSenha(r.senha); setEmail(r.email); setEstado('pronta');
    } catch (e) { setErro((e as Error).message); setEstado('erro'); }
  };
  const copiar = async () => {
    try { await navigator.clipboard.writeText(senha); setCopiou('Copiada'); }
    catch { setCopiou('Selecione a senha e copie com Ctrl+C'); }
  };

  return (
    <div className="flex min-h-[100svh] items-center justify-center p-4">
      <div className="ana-mesh dark:opacity-50" aria-hidden="true" />
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <img src={logoImg} alt="" className="mx-auto mb-4 h-14 w-14 rounded-2xl object-cover" />
          <CardTitle className="text-2xl">{estado === 'pronta' ? 'Sua senha nova' : 'Gerar minha senha'}</CardTitle>
          <CardDescription>
            {estado === 'pronta'
              ? (email ? <>Para entrar com <b className="text-foreground">{email}</b></> : 'Para entrar no app da ANA Brasil')
              : 'A senha desta conta é gerada pelo app, no padrão FdGhJiuPn.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!codigo && (
            <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
              Este link está incompleto. Abra de novo pelo botão do e-mail, ou peça outro em "Esqueceu a senha?", na tela de entrada.
            </p>
          )}

          {codigo && (estado === 'inicio' || estado === 'gerando') && (
            <>
              <p className="text-sm text-muted-foreground">Ao tocar no botão, o app gera a sua senha e mostra aqui, uma vez só. A senha de antes para de funcionar.</p>
              <Button className="w-full gap-2" onClick={() => void gerar()} disabled={estado === 'gerando'}>
                {estado === 'gerando' ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Gerar minha senha
              </Button>
            </>
          )}

          {estado === 'pronta' && (
            <>
              <p className="select-all break-all rounded-xl border border-dashed border-border bg-muted px-4 py-3 text-center font-mono text-2xl tracking-wider" data-testid="senha-gerada">{senha}</p>
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => void copiar()} variant="outline" className="gap-1.5"><Copy className="h-4 w-4" /> Copiar</Button>
                <Button onClick={() => navigate('/')} className="gap-1.5"><LogIn className="h-4 w-4" /> Entrar com esta senha</Button>
                <span className="text-xs text-muted-foreground" aria-live="polite">{copiou}</span>
              </div>
              <p className="rounded-xl bg-[hsl(var(--warning)/0.12)] p-3 text-xs text-foreground">Guarde a senha: ela não aparece de novo. Se esquecer, é só pedir outra em "Esqueceu a senha?".</p>
            </>
          )}

          {estado === 'erro' && (
            <>
              <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">{erro}</p>
              <Button variant="outline" className="w-full" onClick={() => navigate('/')}>Ir para a tela de entrada</Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
