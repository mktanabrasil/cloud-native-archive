import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { KeyRound, CheckCircle2, AlertCircle } from 'lucide-react';
import { ROTAS_DO_CANDIDATO, ehCandidato } from '@/lib/vagas/conta';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { useNavigate } from 'react-router-dom';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [popup, setPopup] = useState<{ title: string; message: string; type: 'error' | 'success' } | null>(null);
  const navigate = useNavigate();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setPopup({ title: 'Erro', message: 'A senha deve ter no mínimo 6 caracteres.', type: 'error' });
      return;
    }
    if (password !== confirmPassword) {
      setPopup({ title: 'Erro', message: 'As senhas não coincidem.', type: 'error' });
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.updateUser({ password });
    if (error) {
      setPopup({ title: 'Erro', message: error.message, type: 'error' });
    } else {
      setPopup({ title: 'Senha alterada!', message: 'Sua senha foi redefinida com sucesso. Você será redirecionado.', type: 'success' });
      // Candidato do Trabalhe Conosco volta para a área dele, não para o app da equipe.
      setTimeout(() => navigate(ehCandidato(data?.user) ? ROTAS_DO_CANDIDATO.minhaArea : '/'), 2000);
    }
    setLoading(false);
  };

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
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary">
              <KeyRound className="h-7 w-7 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl">Redefinir Senha</CardTitle>
            <CardDescription>Digite sua nova senha abaixo</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleReset} className="space-y-4">
              <div>
                <Label htmlFor="new-password">Nova senha</Label>
                <Input id="new-password" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
              </div>
              <div>
                <Label htmlFor="confirm-password">Confirmar nova senha</Label>
                <Input id="confirm-password" type="password" placeholder="••••••••" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={6} />
              </div>
              <Button type="submit" className="w-full gap-2" disabled={loading}>
                <KeyRound className="h-4 w-4" />
                {loading ? 'Aguarde...' : 'Redefinir Senha'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
