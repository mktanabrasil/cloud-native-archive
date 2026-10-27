import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export default function AuthConfirmPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const handleConfirm = async () => {
      const token_hash = searchParams.get('token_hash');
      const type = searchParams.get('type') as any;
      const next = searchParams.get('next') ?? '/redefinir-senha';

      if (token_hash && type) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash,
          type,
        });

        if (error) {
          console.error('Error verifying OTP:', error.message);
          navigate('/login?error=auth_confirmation_failed');
        } else {
          navigate(next);
        }
      } else {
        navigate('/login');
      }
    };

    handleConfirm();
  }, [searchParams, navigate]);

  return (
    <div className="flex min-h-[100svh] items-center justify-center p-4">
      {/* Esboço V2: a malha de fundo do app. */}
      <div className="ana-mesh dark:opacity-50" aria-hidden="true" />
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Verificando...</CardTitle>
          <CardDescription>
            Por favor, aguarde enquanto validamos seu acesso.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" aria-hidden="true" />
        </CardContent>
      </Card>
    </div>
  );
}
