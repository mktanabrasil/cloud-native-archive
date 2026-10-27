import { FlaskConical, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTestView, TEST_PERSONAS } from '@/contexts/TestViewContext';
import { toast } from 'sonner';

export default function TestModeBanner() {
  const { canUseTestMode, activePersona, setActivePersona, resetView } = useTestView();

  if (!canUseTestMode) return null;

  const handleSelect = (id: string) => {
    const persona = TEST_PERSONAS.find(p => p.id === id);
    if (persona) {
      setActivePersona(persona);
      toast.success(`Visualizando como ${persona.name}`);
    }
  };

  const handleReset = () => {
    resetView();
    toast.success('Voltou para sua visualização normal');
  };

  // Active mode → banner with reset button
  if (activePersona) {
    return (
      // Esboço V2: faixa no tom do cartão; a situação vai em texto com bolinha.
      <div className="sticky top-0 z-[60] w-full border-b border-info/30 bg-card text-foreground">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2 lg:px-8">
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <span className="h-2 w-2 shrink-0 rounded-full bg-info" aria-hidden="true" />
            <span className="min-w-0">
              <span className="font-semibold text-info">Modo teste</span> — visualizando como <strong className="font-semibold">{activePersona.name}</strong> <span className="text-muted-foreground">({activePersona.permission_level} · {activePersona.unit})</span>
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-10 gap-1.5 rounded-[12px]">
                  Trocar perfil
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>Perfis de teste</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {TEST_PERSONAS.map(p => (
                  <DropdownMenuItem
                    key={p.id}
                    onClick={() => handleSelect(p.id)}
                    className={activePersona.id === p.id ? 'bg-accent' : ''}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{p.name}</span>
                      <span className="text-xs text-muted-foreground">{p.permission_level} · {p.unit}</span>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="h-10 rounded-[12px] text-destructive hover:text-destructive"
            >
              Resetar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// Standalone trigger button to put in the header
export function TestModeTrigger({ floating = false }: { floating?: boolean }) {
  const { canUseTestMode, activePersona, setActivePersona } = useTestView();

  if (!canUseTestMode || activePersona) return null;

  const handleSelect = (id: string) => {
    const persona = TEST_PERSONAS.find(p => p.id === id);
    if (persona) {
      setActivePersona(persona);
      toast.success(`Visualizando como ${persona.name}`);
    }
  };

  if (floating) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="secondary" 
            size="icon" 
            className="h-14 w-14 rounded-full shadow-2xl border-2 border-primary/20 hover:bg-secondary/90 transition-transform active:scale-95"
            title="Modo Teste"
          >
            <FlaskConical className="h-7 w-7 text-primary" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="w-64 mb-2">
          <DropdownMenuLabel>Visualizar como (modo teste)</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {TEST_PERSONAS.map(p => (
            <DropdownMenuItem key={p.id} onClick={() => handleSelect(p.id)}>
              <div className="flex flex-col">
                <span className="font-medium">{p.name}</span>
                <span className="text-xs text-muted-foreground">{p.permission_level} · {p.unit}</span>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 border-primary/50 text-primary hover:bg-primary/10">
          <FlaskConical className="h-4 w-4" />
          <span className="hidden sm:inline">Teste</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Visualizar como (modo teste)</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {TEST_PERSONAS.map(p => (
          <DropdownMenuItem key={p.id} onClick={() => handleSelect(p.id)}>
            <div className="flex flex-col">
              <span className="font-medium">{p.name}</span>
              <span className="text-xs text-muted-foreground">{p.permission_level} · {p.unit}</span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
