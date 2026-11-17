import { useEffect, useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { JournalTutorial } from '@/components/journal/JournalTutorial';
import { useTutoriaisVistos } from '@/hooks/useTutoriaisVistos';
import { ROTEIROS_DO_SEMANARIO, type RoteiroDoSemanario } from '@/lib/semanario/tutorial';

/**
 * O tutorial de uma tela do Semanário (PR 8, 17/11/2026): abre sozinho na
 * primeira vez (quando a tela está pronta) e volta pelo "Ver o tutorial".
 * `roteiro` nulo = esta pessoa não tem tutorial nesta tela (o marketing, a
 * ficha de outra pessoa, a ficha já enviada).
 */
export function useTutorialDoSemanario(roteiro: RoteiroDoSemanario | null, pronto: boolean) {
  const tutoriais = useTutoriaisVistos();
  const [aberto, setAberto] = useState(false);
  useEffect(() => {
    if (pronto && roteiro && tutoriais.carregado && !tutoriais.jaViu(roteiro)) setAberto(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pronto, roteiro, tutoriais.carregado]);

  const tutorial = roteiro ? (
    <JournalTutorial percurso={roteiro} passos={ROTEIROS_DO_SEMANARIO[roteiro]} rotulo="Tutorial do Semanário"
      aberto={aberto} onFechar={() => setAberto(false)} onVisto={() => tutoriais.marcarVisto(roteiro)} />
  ) : null;
  const botao = roteiro ? <BotaoDoTutorial onClick={() => setAberto(true)} /> : null;
  return { tutorial, botao };
}

function BotaoDoTutorial({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" data-tutorial="sem-ajuda" onClick={onClick}>
      <HelpCircle className="h-4 w-4" /> Ver o tutorial
    </Button>
  );
}
