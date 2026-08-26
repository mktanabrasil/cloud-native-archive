import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LogIn, UserPlus, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { UNITS, Unit } from '@/types';
import { cn } from '@/lib/utils';

type Mode = 'login' | 'signup' | 'request_sent' | 'forgot';

interface AccessFormProps {
  /** Título do card. */
  title: string;
  /** Visual acima do título, dentro do card. Omitido quando a tela já traz a marca por fora. */
  icon?: ReactNode;
  /** Descrição no modo de login. Os outros modos têm texto próprio. */
  loginDescription?: string;
  /** Classe extra do Card, para a tela ajustar largura e sombra. */
  className?: string;
  /**
   * Faz os blocos do card entrarem em cascata, na animação de chegada.
   *
   * Desligado por padrão: o `/login` é destino de redirecionamento, e quem cai
   * lá já estava navegando — animar de novo atrasaria o que a pessoa foi buscar.
   */
  stagger?: boolean;
}

/**
 * Formulário de acesso — login, solicitação de acesso e recuperação de senha.
 *
 * Vive fora das páginas porque duas telas o usam: a porta de entrada (`/`, para
 * quem chega sem sessão) e o `/login`, que continua sendo o destino dos
 * redirecionamentos de `ProtectedRoute` e dos links de e-mail. Toda a lógica de
 * autenticação está aqui; as páginas só decidem o entorno.
 */
export function AccessForm({ title, icon, loginDescription, className, stagger }: AccessFormProps) {
  const { signIn, signUp, resetPassword } = useAuth();
  /** Posição do bloco na cascata de entrada. Sem `stagger`, não devolve nada. */
  const item = (i: number) =>
    stagger
      ? { className: 'ana-enter-item', style: { '--ana-i': i } as React.CSSProperties }
      : {};
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [requestedRole, setRequestedRole] = useState<string>('viewer');
  const [requestedUnit, setRequestedUnit] = useState<Unit>('Administração');
  const [loading, setLoading] = useState(false);
  const [popup, setPopup] = useState<{ title: string; message: string; type: 'error' | 'success' } | null>(null);

  // Ajusta unidade padrão se mudar o nível solicitado
  useEffect(() => {
    if ((requestedRole === 'editor' || requestedRole === 'criador') && requestedUnit === 'Administração') {
      setRequestedUnit('DIC');
    } else if (requestedRole === 'viewer' && requestedUnit !== 'Administração') {
      setRequestedUnit('Administração');
    }
  }, [requestedRole]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) {
      let message = error.message;
      if (message.includes('Email not confirmed')) {
        message = 'Sua solicitação de acesso ainda está pendente ou seu e-mail não foi confirmado. Verifique sua caixa de entrada ou aguarde a aprovação de um administrador.';
      } else if (message.includes('Invalid login credentials')) {
        message = 'E-mail ou senha incorretos. Tente novamente.';
      }
      setPopup({ title: 'Erro', message: message, type: 'error' });
    }
    setLoading(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    const { error } = await resetPassword(email);
    if (error) {
      setPopup({ title: 'Erro', message: error.message, type: 'error' });
    } else {
      setPopup({ title: 'E-mail enviado!', message: 'Verifique sua caixa de entrada para redefinir a senha.', type: 'success' });
      setMode('login');
    }
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !name) return;
    setLoading(true);

    const { error } = await signUp(email, password, {
      name,
      requested_role: requestedRole,
      requested_unit: requestedUnit
    });

    if (error) {
      setPopup({ title: 'Erro', message: error.message, type: 'error' });
      setLoading(false);
      return;
    }

    setMode('request_sent');
    setLoading(false);
  };

  if (mode === 'request_sent') {
    return (
      <Card className={className ? `text-center ${className}` : 'w-full max-w-md text-center'}>
        <CardHeader>
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
            <Clock className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-xl">Solicitação Enviada!</CardTitle>
          <CardDescription>
            Sua solicitação de acesso foi enviada com sucesso. Um administrador irá analisar e aprovar seu acesso em breve.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => { setMode('login'); }} className="w-full">
            Voltar ao Login
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <AlertDialog open={!!popup} onOpenChange={(open) => { if (!open) setPopup(null); }}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full" style={{ background: popup?.type === 'error' ? 'hsl(var(--destructive) / 0.1)' : 'hsl(var(--primary) / 0.1)' }}>
              {popup?.type === 'error' ? <AlertCircle className="h-6 w-6 text-destructive" /> : <CheckCircle2 className="h-6 w-6 text-primary" />}
            </div>
            <AlertDialogTitle className="text-center">{popup?.title}</AlertDialogTitle>
            <AlertDialogDescription className="text-center">{popup?.message}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center">
            <AlertDialogAction onClick={() => setPopup(null)}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      <Card className={className ?? 'w-full max-w-md'}>
        <CardHeader className={cn("text-center", stagger && "ana-enter-item")} style={item(0).style}>
          {icon}
          <CardTitle className="text-2xl font-bold tracking-tight">{title}</CardTitle>
          <CardDescription>
            {mode === 'signup'
              ? 'Solicite acesso para gerenciar programações'
              : mode === 'forgot'
              ? 'Informe seu e-mail para redefinir a senha'
              : loginDescription ?? 'Faça login para editar programações'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={mode === 'signup' ? handleSignUp : mode === 'forgot' ? handleResetPassword : handleLogin} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <Label htmlFor="name">Nome completo</Label>
                <Input id="name" placeholder="Seu nome" value={name} onChange={e => setName(e.target.value)} required />
              </div>
            )}
            <div {...item(1)}>
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            {mode !== 'forgot' && (
              <div {...item(2)}>
                <Label htmlFor="password">Senha</Label>
                <Input id="password" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
              </div>
            )}
            {mode === 'signup' && (
              <div>
                <Label>Nível de acesso solicitado</Label>
                <Select value={requestedRole} onValueChange={setRequestedRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">Visualizador</SelectItem>
                    <SelectItem value="editor">Editor (Apenas Edição)</SelectItem>
                    <SelectItem value="criador">Criador (Cria e Edita)</SelectItem>
                  </SelectContent>
                </Select>
                {(requestedRole === 'editor' || requestedRole === 'criador') && (
                  <div className="mt-4">
                    <Label>Selecione sua unidade</Label>
                    <Select value={requestedUnit} onValueChange={(v) => setRequestedUnit(v as Unit)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {UNITS.filter(u => u !== 'Administração').map(u => (
                          <SelectItem key={u} value={u}>{u}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-1">O acesso será concedido após aprovação de um administrador.</p>
              </div>
            )}
            <Button type="submit" className={cn("w-full gap-2", stagger && "ana-enter-item")} style={item(3).style} disabled={loading}>
              {mode === 'signup' ? <UserPlus className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
              {loading ? 'Aguarde...' : mode === 'signup' ? 'Solicitar Acesso' : mode === 'forgot' ? 'Enviar E-mail' : 'Entrar'}
            </Button>
          </form>
          <div className={cn("mt-4 text-center space-y-2", stagger && "ana-enter-item")} style={item(4).style}>
            {mode === 'login' && (
              <button type="button" onClick={() => setMode('forgot')} className="text-sm text-muted-foreground hover:underline block w-full">
                Esqueceu a senha?
              </button>
            )}
            <button
              type="button"
              onClick={() => setMode(mode === 'signup' ? 'login' : mode === 'forgot' ? 'login' : 'signup')}
              className="text-sm text-primary hover:underline"
            >
              {mode === 'signup' ? 'Já tem uma conta? Faça login' : mode === 'forgot' ? 'Voltar ao login' : 'Não tem conta? Solicite acesso'}
            </button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

export default AccessForm;
