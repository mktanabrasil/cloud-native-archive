import { Navigate, useSearchParams } from 'react-router-dom';
import { useTituloDaAba } from '@/hooks/useTituloDaAba';
import { useUserRole } from '@/hooks/useUserRole';
import { ListaDeVoluntarios, VoluntariosNosEventos } from '@/components/voluntariado/VoluntariadoDosEventos';

export type TelaDoVoluntariado = 'eventos' | 'voluntarios';

/** A tela pedida no endereço (`?tela=`): Eventos é a de entrada. */
export const telaDoVoluntariado = (pedida: string | null): TelaDoVoluntariado => (pedida === 'voluntarios' ? 'voluntarios' : 'eventos');

/**
 * Administração › Voluntariado (18/11/2026, PR 4): os voluntários que as
 * unidades indicam nos eventos, com o status (confirmado ou a confirmar). O cadastro em si é feito em outra plataforma; aqui é só o controle. Para quem tem o vínculo
 * Voluntariado e para o marketing. O voluntariado do Natal Feliz continua no
 * Marketing (formulário e planilha próprios).
 */
export default function AdministracaoVoluntariadoPage() {
  const { temVoluntariado, loading } = useUserRole();
  const [params, setParams] = useSearchParams();
  const tela = telaDoVoluntariado(params.get('tela'));
  useTituloDaAba(`${tela === 'voluntarios' ? 'Voluntários' : 'Voluntários nos eventos'} · ANA Brasil`);

  if (loading) return null;
  if (!temVoluntariado) return <Navigate to="/" replace />;

  const opcoes: ReadonlyArray<readonly [string, TelaDoVoluntariado]> = [['Eventos', 'eventos'], ['Voluntários', 'voluntarios']];
  return (
    <div className="pb-16">
      <nav aria-label="Voluntariado: abas" className="mt-1">
        <div className="mx-auto flex max-w-6xl items-center gap-5 overflow-x-auto border-b border-border px-4 sm:px-6">
          {opcoes.map(([rotulo, t]) => (
            <button
              key={t}
              type="button"
              aria-current={tela === t ? 'page' : undefined}
              onClick={() => setParams(t === 'eventos' ? new URLSearchParams() : new URLSearchParams(`tela=${t}`), { replace: true })}
              className={`-mb-px shrink-0 whitespace-nowrap border-b-2 py-2.5 text-sm ${tela === t ? 'border-[#81e2cf] font-semibold text-foreground' : 'border-transparent font-medium text-muted-foreground hover:text-foreground'}`}
            >
              {rotulo}
            </button>
          ))}
        </div>
      </nav>
      {tela === 'voluntarios' ? <ListaDeVoluntarios /> : <VoluntariosNosEventos />}
    </div>
  );
}
