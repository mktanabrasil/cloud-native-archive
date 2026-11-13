import { useAuth } from '@/contexts/AuthContext';
import { ehCandidato } from '@/lib/vagas/conta';

/**
 * Quem tem sessão E é da equipe (13/11/2026).
 *
 * Qualquer pessoa cria uma conta de candidato em /vagas/criar-conta. Até aqui,
 * as telas de eventos olhavam só "tem sessão" e tratavam essa conta como
 * equipe: o hub, a faixa "vendo como equipe", a logística no detalhe. O menu
 * (`AppLayout`) e a guarda das rotas já separavam; agora os eventos também.
 * No banco vale a mesma regra (`eh_da_equipe`: tem perfil ativo; o candidato
 * não ganha perfil).
 */
export function useEquipe(): boolean {
  const { isAuthenticated, user } = useAuth();
  return isAuthenticated && !ehCandidato(user);
}
