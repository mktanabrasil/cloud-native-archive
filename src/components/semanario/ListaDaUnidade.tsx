import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronRight, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ROTAS } from '@/config/navigation';
import { lerDaSemana } from '@/lib/semanario/api';
import {
  ROTULO_DA_SITUACAO, diaComSemana, diasCompletos, hojeIso, periodoCurto, periodoPorExtenso, prazoDaDevolutiva,
  prazoDeEnvio, proximaSegunda, segundaDaSemana, situacao, somarDias as somar, type Semanario,
} from '@/lib/semanario/regras';
import { cn } from '@/lib/utils';
import { useTelaLarga } from '@/hooks/useTelaLarga';
import { CaixaDaDevolutiva, Selo, Vidro, quando } from './pecas';
import { Devolutiva } from './Devolutiva';
import { FolhaAoLado, useFolhaDoSemanario } from './PreviaDoSemanario';
import { PedidosDeProfessoras } from './PedidosDeProfessoras';

/** Primeiro o que espera devolutiva, depois o que está em preenchimento, por fim os respondidos. */
const ORDEM: Record<Semanario['status'], number> = { enviado: 0, preenchimento: 1, com_devolutiva: 2 };
export const ordenarParaRevisar = (lista: Semanario[]) =>
  [...lista].sort((a, b) => ORDEM[a.status] - ORDEM[b.status] || (a.enviado_em ?? '').localeCompare(b.enviado_em ?? '') || a.professora_nome.localeCompare(b.professora_nome));

/** O semanário escolhido, ao lado da lista: a folha e a devolutiva. */
function PainelDoSemanario({ s, marketing, podeDevolver, onSalvo }: { s: Semanario; marketing: boolean; podeDevolver: boolean; onSalvo: (s: Semanario) => void }) {
  // Só o que vai na folha: salvar a devolutiva não refaz o PDF.
  const folha = useFolhaDoSemanario({ agrupamento: s.agrupamento, dias: s.dias, formas_registro: s.formas_registro, materiais: s.materiais, avaliacao: s.avaliacao, professora_nome: s.professora_nome, semana: s.semana });
  const sit = situacao(s, hojeIso());
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate font-display text-[18px] font-bold tracking-tight">{s.professora_nome || 'Professora'}</h2>
          <p className="text-[12.5px] text-muted-foreground">{[marketing ? s.unidade : null, s.agrupamento || 'Sem agrupamento', s.enviado_em ? `enviado ${quando(s.enviado_em)}` : null].filter(Boolean).join(' · ')}</p>
          <div className="mt-1"><Selo situacao={sit}>{ROTULO_DA_SITUACAO[sit]}</Selo></div>
        </div>
        <Button asChild variant="outline" size="sm" className="gap-1.5 rounded-full">
          <Link to={`${ROTAS.semanario}/${s.id}`}><ExternalLink className="h-3.5 w-3.5" /> Abrir inteiro</Link>
        </Button>
      </div>
      {/* A devolutiva antes da folha: é o que a orientadora veio fazer, e fica à vista. */}
      {podeDevolver
        ? <Devolutiva semanario={s} onSalvo={onSalvo} />
        : s.devolutiva && <CaixaDaDevolutiva texto={s.devolutiva} por={s.devolutiva_por} em={s.devolutiva_em} />}
      <FolhaAoLado estado={folha} />
    </div>
  );
}

const iniciais = (nome: string) => nome.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || '·';

/**
 * Os semanários de uma semana (17/11/2026): a orientadora pedagógica vê os do
 * CEI dela e escreve a devolutiva; o marketing vê os de todas as unidades, só
 * para ler (a RLS recorta). No computador, o escolhido abre ao lado da lista,
 * com a folha e a devolutiva; no celular, a lista abre a ficha.
 */
export function ListaDaUnidade({ titulo, marketing, podeDevolver = () => false, pedidos = false }: {
  titulo: string;
  marketing: boolean;
  podeDevolver?: (s: Semanario) => boolean;
  /** A orientadora vê aqui os pedidos de acesso das professoras do CEI dela (PR 7). */
  pedidos?: boolean;
}) {
  const telaLarga = useTelaLarga();
  const [params, setParams] = useSearchParams();
  const hoje = hojeIso();
  const proxima = proximaSegunda(hoje);
  const semanas = [proxima, segundaDaSemana(hoje), somar(proxima, -14), somar(proxima, -21)];
  // A semana fica no endereço (?semana=), para voltar a ela depois de abrir um semanário.
  const semana = semanas.includes(params.get('semana') ?? '') ? params.get('semana')! : proxima;
  const setSemana = (s: string) => {
    const n = new URLSearchParams(params);
    if (s === proxima) n.delete('semana'); else n.set('semana', s);
    n.delete('ver');
    setParams(n, { replace: true });
  };
  const [estado, setEstado] = useState<'carregando' | 'erro' | 'pronto'>('carregando');
  const [lista, setLista] = useState<Semanario[]>([]);

  // Trocando de semana depressa, só a resposta da semana escolhida por último vale.
  const pedida = useRef(semana);
  const carregar = useCallback(async (s: string) => {
    pedida.current = s;
    setEstado('carregando');
    try { const l = await lerDaSemana(s); if (pedida.current === s) { setLista(l); setEstado('pronto'); } }
    catch { if (pedida.current === s) setEstado('erro'); }
  }, []);
  useEffect(() => { void carregar(semana); }, [carregar, semana]);

  const ordenada = useMemo(() => ordenarParaRevisar(lista), [lista]);
  const aguardando = lista.filter(s => s.status === 'enviado').length;
  // O escolhido fica no endereço (?ver=), para voltar a ele; sem escolha, o primeiro da fila.
  const escolhido = ordenada.find(s => s.id === params.get('ver')) ?? ordenada[0];
  const escolher = (id: string) => { const n = new URLSearchParams(params); n.set('ver', id); setParams(n, { replace: true }); };
  const atualizar = (nova: Semanario) => {
    // Sem escolha no endereço, o painel seguia "o primeiro da fila" e pulava para outra professora.
    if (params.get('ver') !== nova.id) escolher(nova.id);
    setLista(l => l.map(x => (x.id === nova.id ? nova : x)));
  };

  return (
    <main className={cn('mx-auto w-full px-4 pb-16 lg:px-6', telaLarga ? 'max-w-7xl' : 'max-w-5xl')}>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[30px] font-bold tracking-tight">{titulo}</h1>
          <p className="mt-1 text-[14.5px] text-muted-foreground">
            Semana de {periodoPorExtenso(semana)} · envio até {diaComSemana(prazoDeEnvio(semana))} · devolutiva até {diaComSemana(prazoDaDevolutiva(semana))}
          </p>
          {estado === 'pronto' && aguardando > 0 && (
            <p className="mt-1 text-[13px] font-semibold text-[hsl(var(--info))]">{aguardando === 1 ? '1 semanário aguardando devolutiva' : `${aguardando} semanários aguardando devolutiva`}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Semana">
          {semanas.map(s => (
            <button key={s} type="button" aria-pressed={s === semana} onClick={() => setSemana(s)}
              className={cn('rounded-full border px-3 py-1.5 text-[13px]', s === semana
                ? 'border-transparent bg-foreground font-semibold text-background'
                : 'border-black/10 bg-white/55 dark:border-white/10 dark:bg-white/5')}>
              {periodoCurto(s).replace(' a ', '–')}
            </button>
          ))}
        </div>
      </div>

      {pedidos && <PedidosDeProfessoras />}

      {estado === 'carregando' && <p className="py-10 text-center text-[14px] text-muted-foreground">Carregando os semanários…</p>}
      {estado === 'erro' && (
        <div className="py-10 text-center">
          <p className="text-[14px]">Não consegui carregar os semanários agora.</p>
          <Button className="mt-3" onClick={() => void carregar(semana)}>Tentar de novo</Button>
        </div>
      )}
      {estado === 'pronto' && lista.length === 0 && (
        <Vidro className="mt-5 p-6 text-center text-[14px] text-muted-foreground">Nenhum semanário desta semana ainda.</Vidro>
      )}
      {estado === 'pronto' && lista.length > 0 && (
        <div className={cn('mt-5', telaLarga && 'grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] items-start gap-5')}>
        <Vidro className="px-4 py-1">
          <ul className="divide-y divide-black/[.07] dark:divide-white/[.08]">
            {ordenada.map(s => {
              const sit = situacao(s, hoje);
              const detalhe = s.status === 'preenchimento' ? `${ROTULO_DA_SITUACAO[sit]} · ${diasCompletos(s.dias)} de 5 dias` : s.status === 'enviado' ? `${ROTULO_DA_SITUACAO[sit]} · enviado ${quando(s.enviado_em)}` : ROTULO_DA_SITUACAO[sit];
              const ativo = telaLarga && escolhido?.id === s.id;
              const conteudo = (
                <>
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#f37964]/25 text-[12px] font-bold" aria-hidden>{iniciais(s.professora_nome)}</span>
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-[14px]">{s.professora_nome || 'Professora'}</b>
                      <span className="block text-[12px] text-muted-foreground">{[marketing ? s.unidade : null, s.agrupamento || 'Sem agrupamento'].filter(Boolean).join(' · ')}</span>
                      {/* No celular a situação desce para baixo do nome, sem cortar a linha. */}
                      {/* Na lista estreita (celular, ou ao lado do painel) a situação desce para baixo do nome. */}
                      <span className={cn('mt-1 block', !telaLarga && 'sm:hidden')}><Selo situacao={sit} className="whitespace-normal">{detalhe}</Selo></span>
                    </span>
                    {!telaLarga && <span className="hidden sm:inline-flex"><Selo situacao={sit}>{detalhe}</Selo></span>}
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                </>
              );
              const classe = cn('-mx-2 flex w-full items-center gap-3 rounded-[14px] px-2 py-3 text-left hover:bg-[hsl(var(--ativo))]', ativo && 'bg-[hsl(var(--ativo))]');
              return (
                <li key={s.id}>
                  {telaLarga
                    ? <button type="button" aria-current={ativo ? 'true' : undefined} onClick={() => escolher(s.id)} className={classe}>{conteudo}</button>
                    : <Link to={`${ROTAS.semanario}/${s.id}`} className={classe}>{conteudo}</Link>}
                </li>
              );
            })}
          </ul>
        </Vidro>
        {telaLarga && escolhido && (
          <div className="sticky top-24">
            <PainelDoSemanario key={escolhido.id} s={escolhido} marketing={marketing} podeDevolver={podeDevolver(escolhido)} onSalvo={atualizar} />
          </div>
        )}
        </div>
      )}
    </main>
  );
}
