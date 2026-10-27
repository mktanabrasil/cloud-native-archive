import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

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
