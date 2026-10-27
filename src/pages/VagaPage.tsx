import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Check, ChevronRight, Info, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useTituloDaAba } from '@/hooks/useTituloDaAba';
import { Etiqueta, MolduraDasVagas, SeloAberta, SeloDaArea } from '@/components/vagas/PecasDasVagas';
import { buscarVaga } from '@/lib/vagas/api';
import { ROTULO_DA_AREA, ROTULO_DA_CONTRATACAO, ROTULO_DA_MODALIDADE, type Vaga } from '@/lib/vagas/modelo';

/**
 * /vagas/:slug — a página da vaga (fase 1, telas 03 e C03e do mockup aprovado).
 *
 * O banco só entrega a vaga publicada: a encerrada, a pausada e o endereço
 * errado chegam iguais, como "não encontrada", e mostram a mesma tela, que
 * leva para as vagas abertas em vez de um erro. "Candidatar-se" leva à
 * candidatura no app (PR 8, 06/10/2026: todas as vagas de uma vez); o link
 * do Forms (`link_externo`) fica guardado no banco, sem botão.
 *
 * Esboço V2 (26/10/2026): área e "Aberta" em texto com bolinha; carga,
 * contratação e local numa faixa de vidro; o texto da vaga num cartão sólido;
 * a coluna de "Candidatar-se" num cartão sólido, presa abaixo da barra.
 */

/** Cartão sólido do kit V2: raio 20, contorno de 5%, sem sombra. */
const CARTAO = 'rounded-[20px] border border-black/5 bg-card dark:border-white/5';

export default function VagaPage() {
  const { slug = '' } = useParams();
  const [vaga, setVaga] = useState<Vaga | null | undefined>(undefined);
  const [erro, setErro] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  useTituloDaAba(vaga ? `${vaga.titulo} · Trabalhe Conosco ANA Brasil` : 'Trabalhe Conosco · ANA Brasil');

  useEffect(() => {
    let vivo = true;
    setErro(false);
    setVaga(undefined);
    buscarVaga(slug)
      .then(v => { if (vivo) setVaga(v); })
      .catch(() => { if (vivo) setErro(true); });
    return () => { vivo = false; };
  }, [slug, tentativa]);

  if (erro) {
    return (
      <MolduraDasVagas>
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div className={`flex flex-col items-start gap-3 p-6 ${CARTAO}`}>
            <h1 className="text-2xl font-bold">Não deu para carregar a vaga.</h1>
            <p className="text-muted-foreground">Confira a internet e tente de novo.</p>
            <Button variant="outline" onClick={() => setTentativa(t => t + 1)}>Tentar de novo</Button>
          </div>
        </div>
      </MolduraDasVagas>
    );
  }

  if (vaga === undefined) {
    return (
      <MolduraDasVagas>
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 sm:px-6" aria-busy="true" aria-label="Carregando vaga">
          <Skeleton className="h-5 w-40" /><Skeleton className="h-11 w-2/3" />
          <Skeleton className="h-[76px] rounded-[20px]" />
          <Skeleton className="h-60 rounded-[20px]" />
        </div>
      </MolduraDasVagas>
    );
  }

  if (vaga === null) return <VagaEncerrada />;

  const fatos: Array<[string, string]> = [
    ...(vaga.carga_horaria ? [[vaga.carga_horaria, 'carga horária'] as [string, string]] : []),
    [ROTULO_DA_CONTRATACAO[vaga.contratacao], 'contratação'],
    [vaga.cidade || '—', ROTULO_DA_MODALIDADE[vaga.modalidade].toLowerCase()],
  ];

  return (
    <MolduraDasVagas>
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 pb-12 pt-6 sm:px-6">
        <nav aria-label="Caminho" className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          <Link to="/vagas" className="hover:text-foreground">Vagas</Link><span aria-hidden>›</span>
          <Link to={`/vagas?area=${vaga.area}`} className="hover:text-foreground">{ROTULO_DA_AREA[vaga.area]}</Link><span aria-hidden>›</span>
          <span className="font-semibold text-foreground">{vaga.titulo}</span>
        </nav>

        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8">
          <div className="flex min-w-0 flex-col gap-5">
            <div className="flex flex-col gap-2.5">
              <div className="flex flex-wrap items-center gap-4"><SeloDaArea area={vaga.area} /><SeloAberta /></div>
              <h1 className="text-[28px] font-bold leading-tight tracking-tight sm:text-[36px]">{vaga.titulo}</h1>
            </div>

            {/* Faixa de fatos (padrão da faixa de números do Painel): vidro, sem ícone. */}
            <dl className="glass-1 grid grid-cols-[minmax(0,1fr)] divide-y divide-border/70 rounded-[20px] sm:grid-flow-col sm:auto-cols-fr sm:grid-cols-none sm:divide-x sm:divide-y-0">
              {fatos.map(([valor, rotulo]) => (
                <div key={rotulo} className="flex min-w-0 items-baseline justify-between gap-3 px-5 py-3 sm:flex-col-reverse sm:justify-end sm:gap-0.5 sm:py-4">
                  <dt className="text-[13px] text-muted-foreground">{rotulo}</dt>
                  <dd className="font-display text-[17px] font-semibold leading-tight">{valor}</dd>
                </div>
              ))}
            </dl>

            <article className={`flex flex-col gap-7 p-5 sm:p-7 ${CARTAO}`}>
              {vaga.descricao && <Secao titulo="O que você vai fazer"><p className="whitespace-pre-line leading-relaxed">{vaga.descricao}</p></Secao>}
              {vaga.responsabilidades.length > 0 && <Secao titulo="No dia a dia"><Itens itens={vaga.responsabilidades} /></Secao>}
              {(vaga.requisitos.length > 0 || vaga.diferenciais.length > 0) && (
                <Secao titulo="Você precisa ter">
                  <ul className="flex flex-col gap-2">
                    {vaga.requisitos.map(r => <Requisito key={r}>{r}</Requisito>)}
                    {vaga.diferenciais.map(d => <Requisito key={d} diferencial>Diferencial: {d}</Requisito>)}
                  </ul>
                </Secao>
              )}
              {vaga.beneficios.length > 0 && (
                <Secao titulo="O que a ANA oferece">
                  <div className="flex flex-wrap gap-2">{vaga.beneficios.map(b => <Etiqueta key={b}>{b}</Etiqueta>)}</div>
                </Secao>
              )}
              {vaga.complementares && <Secao titulo="Informações complementares"><p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{vaga.complementares}</p></Secao>}

              <p className="flex gap-2.5 rounded-[16px] bg-muted/70 p-4 text-sm">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" aria-hidden />
                <span>
                  {vaga.afirmativa_pcd ? 'Vaga afirmativa para pessoas com deficiência. ' : vaga.aberta_pcd ? 'Vaga aberta a pessoas com deficiência. ' : ''}
                  A unidade de trabalho é definida pelo RH ao longo do processo.
                </span>
              </p>
            </article>
          </div>

          <aside className="flex flex-col gap-3 lg:sticky lg:top-[88px]">
            <div className={`flex flex-col gap-3 p-5 ${CARTAO}`}>
              <Button asChild className="h-12 rounded-[12px] text-base">
                <Link to={`/vagas/${vaga.slug}/candidatar`}>Candidatar-se <ArrowRight className="h-5 w-5" /></Link>
              </Button>
              <Button variant="outline" className="h-11 rounded-[12px]" onClick={() => compartilhar(vaga)}><Share2 className="h-4 w-4" /> Compartilhar</Button>
              <h2 className="mt-2 border-t border-border/70 pt-4 text-[15px] font-semibold">Como funciona</h2>
              <ol className="flex flex-col gap-3">
                {[['Você se candidata', 'aqui mesmo, em poucos minutos'], ['A equipe analisa', 'o seu perfil'], ['Entrevista', 'se avançar'], ['Resultado', 'por e-mail ou telefone']].map(([t, d], i) => (
                  <li key={t} className="flex items-center gap-3">
                    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full font-display text-[13px] font-semibold tabular-nums ${i === 0 ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>{i + 1}</span>
                    <span className="text-sm leading-snug"><b className="font-semibold">{t}</b><br /><span className="text-[13px] text-muted-foreground">{d}</span></span>
                  </li>
                ))}
              </ol>
            </div>
            <Link to={`/vagas?area=${vaga.area}`} className={`group flex min-h-[56px] items-center justify-between gap-3 px-5 py-3 text-sm transition-colors hover:border-black/10 dark:hover:border-white/15 ${CARTAO}`}>
              <span><b className="font-semibold">Mais vagas em {ROTULO_DA_AREA[vaga.area]}</b><br /><span className="text-muted-foreground">Ver todas</span></span>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </aside>
        </div>
      </div>
    </MolduraDasVagas>
  );
}

async function compartilhar(v: Vaga) {
  const url = `${window.location.origin}/vagas/${v.slug}`;
  try {
    if (navigator.share) { await navigator.share({ title: v.titulo, text: `Vaga na ANA Brasil: ${v.titulo}`, url }); return; }
  } catch { return; /* cancelou */ }
  try { await navigator.clipboard.writeText(url); toast.success('Link da vaga copiado.'); }
  catch { toast.error('Não deu para copiar. O link é: ' + url); }
}

function VagaEncerrada() {
  return (
    <MolduraDasVagas>
      <div className="mx-auto max-w-xl px-4 py-12">
        <div className={`flex flex-col items-center gap-4 px-6 py-10 text-center ${CARTAO}`}>
          <h1 className="text-[26px] font-bold leading-tight">Esta vaga não está mais aberta.</h1>
          <p className="text-muted-foreground">Ela pode ter sido preenchida ou encerrada. Veja as vagas abertas agora.</p>
          <Button asChild className="h-12 rounded-[12px] px-6"><Link to="/vagas">Ver vagas abertas <ArrowRight className="h-4 w-4" /></Link></Button>
        </div>
      </div>
    </MolduraDasVagas>
  );
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return <section className="flex flex-col gap-2.5"><h2 className="text-lg font-semibold">{titulo}</h2>{children}</section>;
}

function Itens({ itens }: { itens: string[] }) {
  return <ul className="flex list-disc flex-col gap-1.5 pl-5 leading-relaxed marker:text-muted-foreground">{itens.map(i => <li key={i}>{i}</li>)}</ul>;
}

function Requisito({ children, diferencial = false }: { children: ReactNode; diferencial?: boolean }) {
  return (
    <li className="flex items-start gap-2.5 text-[15px] leading-snug">
      <Check className={`mt-0.5 h-4 w-4 shrink-0 ${diferencial ? 'text-muted-foreground' : 'text-success'}`} aria-hidden />
      <span className={diferencial ? 'text-muted-foreground' : undefined}>{children}</span>
    </li>
  );
}
