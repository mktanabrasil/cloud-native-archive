import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

export default function ImpersonationBanner() {
  const navigate = useNavigate();
  const [active, setActive] = useState(false);
  const [targetEmail, setTargetEmail] = useState<string | null>(null);

  useEffect(() => {
    const check = () => {
      const impersonatorId = sessionStorage.getItem('impersonator_id');
      const email = sessionStorage.getItem('impersonation_target_email');
      setActive(!!impersonatorId);
      setTargetEmail(email);
    };
    check();
    window.addEventListener('storage', check);
    return () => window.removeEventListener('storage', check);
  }, []);

  if (!active) return null;

  const handleExit = async () => {
    sessionStorage.removeItem('impersonator_id');
    sessionStorage.removeItem('impersonation_target_email');
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
    window.location.reload();
  };

  return (
    // Esboço V2: faixa sólida no tom do cartão, com a situação em texto e bolinha
    // (a cor fala só no aviso), no lugar do fundo vermelho chapado.
    <div className="sticky top-0 z-[60] w-full border-b border-destructive/30 bg-card text-foreground">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2 lg:px-8">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <span className="h-2 w-2 shrink-0 rounded-full bg-destructive" aria-hidden="true" />
          <span className="min-w-0">
            <span className="font-semibold text-destructive">Modo de impersonação ativo</span> — você está logado como <strong className="break-all font-semibold">{targetEmail || 'outro usuário'}</strong>.
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExit}
          className="h-10 shrink-0 rounded-[12px]"
        >
          Sair da impersonação
        </Button>
      </div>
    </div>
  );
}
