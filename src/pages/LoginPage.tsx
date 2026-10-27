import logoImg from '@/assets/logo.png';
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
    <div className="flex min-h-[100svh] items-center justify-center p-4">
      {/* Esboço V2: a malha de fundo do app e o ícone da ANA no lugar do calendário. */}
      <div className="ana-mesh dark:opacity-50" aria-hidden="true" />
      <AccessForm
        title="ANA Brasil"
        icon={<img src={logoImg} alt="" className="mx-auto mb-4 h-14 w-14 rounded-2xl object-cover" />}
      />

      <div className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] right-[calc(1.5rem+env(safe-area-inset-right))] z-[60] flex items-center gap-3">
        <TestModeTrigger floating />
        <ThemeToggle className="max-md:hidden" />
      </div>
    </div>
  );
}
