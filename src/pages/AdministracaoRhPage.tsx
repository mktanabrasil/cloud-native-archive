import { Navigate, Link, useSearchParams } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { useTituloDaAba } from '@/hooks/useTituloDaAba';
import { useUserRole } from '@/hooks/useUserRole';
import { useResponsavel } from '@/hooks/useSouResponsavel';
import { PainelDoRh } from '@/components/vagas/PainelDoRh';
import { ProcessosDoRh } from '@/components/vagas/ProcessosDoRh';
import { MeusProcessos } from '@/components/vagas/MeusProcessos';
import { GestaoDeVagas } from '@/components/vagas/GestaoDeVagas';
import { RelatoriosDoRh } from '@/components/vagas/RelatoriosDoRh';
import { AuditoriaDasVagas } from '@/components/vagas/AuditoriaDasVagas';
import { ModelosDeEmail } from '@/components/vagas/ModelosDeEmail';

export type TelaDoRh = 'painel' | 'processos' | 'gestao' | 'relatorios' | 'emails' | 'auditoria' | 'meus';

const TITULO: Record<TelaDoRh, string> = {
  painel: 'Painel do RH', processos: 'Processos', gestao: 'Gestão de vagas', relatorios: 'Relatórios',
  emails: 'Modelos de e-mail', auditoria: 'Auditoria das vagas', meus: 'Meus processos',
};

/** A tela pedida no endereço (`?tela=`), dentro do que esta pessoa pode abrir. */
export function telaDoRh(pedida: string | null, p: { isRh: boolean; isAdmin: boolean }): TelaDoRh {
  if (!p.isRh) return 'meus';
  if (pedida === 'processos' || pedida === 'gestao' || pedida === 'relatorios' || pedida === 'emails') return pedida;
  if (pedida === 'auditoria' && p.isAdmin) return 'auditoria';
  return 'painel';
}

/**
 * Administração › RH (18/11/2026): a gestão do Trabalhe Conosco, que até
 * aqui ficava em /vagas, fora da barra do app. Agora é uma página do setor
 * Administração, dentro do app, com as mesmas abas de sempre no `?tela=`.
 *
 * /vagas continua sendo o portal público dos candidatos (e o endereço dos
 * e-mails deles). Quem é do RH e abre /vagas cai aqui, e o portal fica no
 * link "Ver o portal".
 *
 * RH e admin: Painel, Processos, Gestão, Relatórios, Modelos de e-mail e,
 * só admin, Auditoria. Responsável por um processo, sem ser RH: Meus
 * processos. Os outros voltam ao portal.
 */
export default function AdministracaoRhPage() {
  const { isRh, isAdmin, loading } = useUserRole();
  const { sou: souResponsavel, carregado } = useResponsavel();
  const [params, setParams] = useSearchParams();
  const tela = telaDoRh(params.get('tela'), { isRh, isAdmin });
  useTituloDaAba(`${TITULO[tela]} · ANA Brasil`);

  if (loading) return null;
  // Sem ser RH, espera saber se é responsável antes de mandar ao portal.
  if (!isRh && !carregado) return null;
  if (!isRh && !souResponsavel) return <Navigate to="/vagas" replace />;

  const opcoes: ReadonlyArray<readonly [string, TelaDoRh]> = isRh
    ? [['Painel', 'painel'], ['Processos', 'processos'], ['Gestão', 'gestao'], ['Relatórios', 'relatorios'], ['Modelos de e-mail', 'emails'], ...(isAdmin ? [['Auditoria', 'auditoria'] as const] : [])]
    : [['Meus processos', 'meus']];
  const telaPadrao: TelaDoRh = isRh ? 'painel' : 'meus';

  return (
    <div className="pb-16">
      {/* As abas no topo, como antes em /vagas; cada aba traz o próprio título. O portal fica no fim da linha. */}
      <nav aria-label="RH: abas" className="mt-1">
        <div className="mx-auto flex max-w-6xl items-center gap-5 overflow-x-auto border-b border-border px-4 sm:px-6">
          {opcoes.length > 1 && opcoes.map(([rotulo, t]) => (
            <button
              key={t}
              type="button"
              aria-current={tela === t ? 'page' : undefined}
              onClick={() => setParams(t === telaPadrao ? new URLSearchParams() : new URLSearchParams(`tela=${t}`), { replace: true })}
              className={`-mb-px shrink-0 whitespace-nowrap border-b-2 py-2.5 text-sm ${tela === t ? 'border-[#81e2cf] font-semibold text-foreground' : 'border-transparent font-medium text-muted-foreground hover:text-foreground'}`}
            >
              {rotulo}
            </button>
          ))}
          <Link to="/vagas?tela=portal" className="ml-auto inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground">
            <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Ver o portal
          </Link>
        </div>
      </nav>
      {tela === 'gestao' ? <GestaoDeVagas /> : tela === 'relatorios' ? <RelatoriosDoRh /> : tela === 'emails' ? <ModelosDeEmail />
        : tela === 'auditoria' ? <AuditoriaDasVagas /> : tela === 'processos' ? <ProcessosDoRh /> : tela === 'meus' ? <MeusProcessos /> : <PainelDoRh />}
    </div>
  );
}
