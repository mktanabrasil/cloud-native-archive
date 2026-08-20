import { Calendar } from 'lucide-react';
import { AccessForm } from '@/components/auth/AccessForm';
import { TestModeTrigger } from '@/components/TestModeBanner';
import { ThemeToggle } from '@/components/ThemeToggle';

/**
 * Tela de login direta.
 *
 * Continua sendo o destino dos redirecionamentos de `ProtectedRoute` e
 * `MarketingRoute` e dos links de e-mail. O formulário vive em `AccessForm`,
 * compartilhado com a porta de entrada em `/`.
 */
export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <AccessForm
        title="ANA Brasil"
        icon={
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary">
            <Calendar className="h-7 w-7 text-primary-foreground" />
          </div>
        }
      />

      <div className="fixed bottom-6 right-6 z-[60] flex items-center gap-3">
        <TestModeTrigger floating />
        <ThemeToggle />
      </div>
    </div>
  );
}
