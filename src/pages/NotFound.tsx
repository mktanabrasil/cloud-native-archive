import { Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useIsCleanView } from "@/hooks/useIsEntryGate";

/** O que a porta de entrada (HomePage) recebe para avisar que o endereço não existe. */
const ESTADO_ENDERECO_INEXISTENTE = { enderecoInexistente: true } as const;

const NotFound = () => {
  const location = useLocation();
  const { isAuthenticated, loading } = useAuth();
  const isCleanView = useIsCleanView();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  if (loading) return null;

  // Sem login (12/11/2026, mockup aprovado, opção A): quem chega a um endereço
  // que não existe — um link público pela metade, por exemplo — vai para a
  // porta de entrada, com o aviso, e não fica dentro do app com o menu.
  // Em embed, nada muda: lá a raiz serve as Programações.
  if (!isAuthenticated && !isCleanView) return <Navigate to="/" replace state={ESTADO_ENDERECO_INEXISTENTE} />;

  return (
    // Esboço V2: dentro do app, sobre a malha; um bloco calmo e um botão só.
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-[20px] border border-black/5 bg-card px-6 py-10 text-center dark:border-white/5">
        <p className="font-display text-5xl font-bold tabular-nums text-foreground">404</p>
        <h1 className="mt-3 text-2xl font-bold text-foreground">Página não encontrada</h1>
        <p className="mt-1 text-muted-foreground">Esse endereço não existe no app.</p>
        <Button asChild className="mt-6">
          <a href="/">Voltar ao início</a>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
