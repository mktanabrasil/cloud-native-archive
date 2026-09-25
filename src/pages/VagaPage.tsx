import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Briefcase, Check, Clock, Info, MapPin, Share2, Star } from 'lucide-react';
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
 * leva para as vagas abertas em vez de um erro. "Candidatar-se" abre o
 * Forms da vaga (`link_externo`) até a fase 2 trazer a candidatura para cá.
 */
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
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-3 px-4 py-16 sm:px-6">
          <h1 className="text-2xl font-bold">Não deu para carregar a vaga.</h1>
          <p className="text-muted-foreground">Confira a internet e tente de novo.</p>
          <Button variant="outline" onClick={() => setTentativa(t => t + 1)}>Tentar de novo</Button>
        </div>
      </MolduraDasVagas>
    );
  }

  if (vaga === undefined) {
    return (
      <MolduraDasVagas>
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 sm:px-6" aria-busy="true" aria-label="Carregando vaga">
          <Skeleton className="h-6 w-40" /><Skeleton className="h-11 w-2/3" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      </MolduraDasVagas>
    );
  }

  if (vaga === null) return <VagaEncerrada />;

  return (
    <MolduraDasVagas>
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 pb-12 pt-6 sm:px-6">
        <nav aria-label="Caminho" className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          <Link to="/vagas" className="hover:text-foreground">Vagas</Link><span aria-hidden>›</span>
          <Link to={`/vagas?area=${vaga.area}`} className="hover:text-foreground">{ROTULO_DA_AREA[vaga.area]}</Link><span aria-hidden>›</span>
          <span className="font-semibold text-foreground">{vaga.titulo}</span>
        </nav>

        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-10">
          <div className="flex min-w-0 flex-col gap-6">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2"><SeloDaArea area={vaga.area} /><SeloAberta /></div>
              <h1 className="text-[28px] font-bold leading-tight tracking-tight sm:text-[38px]">{vaga.titulo}</h1>
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {vaga.carga_horaria && <Bloco icone={<Clock className="h-5 w-5" />} valor={vaga.carga_horaria} rotulo="carga horária" />}
              <Bloco icone={<Briefcase className="h-5 w-5" />} valor={ROTULO_DA_CONTRATACAO[vaga.contratacao]} rotulo="contratação" />
              <Bloco icone={<MapPin className="h-5 w-5" />} valor={vaga.cidade || '—'} rotulo={ROTULO_DA_MODALIDADE[vaga.modalidade].toLowerCase()} />
            </div>

            {vaga.descricao && <Secao titulo="O que você vai fazer"><p className="whitespace-pre-line leading-relaxed">{vaga.descricao}</p></Secao>}
            {vaga.responsabilidades.length > 0 && <Secao titulo="No dia a dia"><Itens itens={vaga.responsabilidades} /></Secao>}
            {(vaga.requisitos.length > 0 || vaga.diferenciais.length > 0) && (
              <Secao titulo="Você precisa ter">
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {vaga.requisitos.map(r => <Requisito key={r}>{r}</Requisito>)}
                  {vaga.diferenciais.map(d => <Requisito key={d} diferencial>Diferencial: {d}</Requisito>)}
                </div>
              </Secao>
            )}
            {vaga.beneficios.length > 0 && (
              <Secao titulo="O que a ANA oferece">
                <div className="flex flex-wrap gap-2">{vaga.beneficios.map(b => <Etiqueta key={b}><Check className="h-3.5 w-3.5" aria-hidden />{b}</Etiqueta>)}</div>
              </Secao>
            )}
            {vaga.complementares && <Secao titulo="Informações complementares"><p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{vaga.complementares}</p></Secao>}

            <div className="flex gap-3 rounded-2xl bg-sky-50 p-4 text-sm text-sky-950 dark:bg-sky-950/60 dark:text-sky-100">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>
                {vaga.afirmativa_pcd ? 'Vaga afirmativa para pessoas com deficiência. ' : vaga.aberta_pcd ? 'Vaga aberta a pessoas com deficiência. ' : ''}
                A unidade de trabalho é definida pelo RH ao longo do processo.
              </span>
            </div>
          </div>

          <aside className="flex flex-col gap-3.5 lg:sticky lg:top-4">
            <div className="flex flex-col gap-3 rounded-[18px] bg-muted/60 p-5">
              {vaga.link_externo ? (
                <Button asChild className="h-14 rounded-2xl text-base">
                  <a href={vaga.link_externo} target="_blank" rel="noopener noreferrer">Candidatar-se <ArrowRight className="h-5 w-5" /></a>
                </Button>
              ) : (
                <Button disabled className="h-14 rounded-2xl text-base">Inscrições em breve</Button>
              )}
              <Button variant="outline" className="h-11 rounded-xl" onClick={() => compartilhar(vaga)}><Share2 className="h-4 w-4" /> Compartilhar</Button>
              <ol className="mt-1 flex flex-col gap-2.5 border-t border-border pt-3">
                {[['Você se candidata', 'pelo formulário da vaga'], ['A equipe analisa', 'o seu perfil'], ['Entrevista', 'se avançar'], ['Resultado', 'por e-mail ou telefone']].map(([t, d], i) => (
                  <li key={t} className="flex items-center gap-3">
                    <span className={`grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full text-[13px] font-bold ${i === 0 ? 'bg-[#81E2CF] text-[#1F2322]' : 'bg-background text-foreground'}`}>{i + 1}</span>
                    <span className="text-sm"><b>{t}</b><br /><span className="text-xs text-muted-foreground">{d}</span></span>
                  </li>
                ))}
              </ol>
            </div>
            <Link to={`/vagas?area=${vaga.area}`} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-sm hover:bg-muted/50">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#F5DFBB] text-[#1F2322]"><Star className="h-5 w-5" aria-hidden /></span>
              <span><b>Mais vagas em {ROTULO_DA_AREA[vaga.area]}</b><br /><span className="text-muted-foreground">Ver todas</span></span>
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
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-16 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-[20px] bg-[#F5DFBB] text-[#1F2322]"><Briefcase className="h-7 w-7" aria-hidden /></span>
        <h1 className="text-[28px] font-bold leading-tight">Esta vaga não está mais aberta.</h1>
        <p className="text-muted-foreground">Ela pode ter sido preenchida ou encerrada. Veja as vagas abertas agora.</p>
        <Button asChild className="h-12 rounded-xl px-6"><Link to="/vagas">Ver vagas abertas <ArrowRight className="h-4 w-4" /></Link></Button>
      </div>
    </MolduraDasVagas>
  );
}

function Bloco({ icone, valor, rotulo }: { icone: ReactNode; valor: string; rotulo: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-[14px] bg-muted/60 p-3.5">
      <span aria-hidden>{icone}</span>
      <b className="text-[15px] leading-tight">{valor}</b>
      <span className="text-xs text-muted-foreground">{rotulo}</span>
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return <section className="flex flex-col gap-2.5"><h2 className="text-xl font-bold">{titulo}</h2>{children}</section>;
}

function Itens({ itens }: { itens: string[] }) {
  return <ul className="flex list-disc flex-col gap-1.5 pl-5 leading-relaxed">{itens.map(i => <li key={i}>{i}</li>)}</ul>;
}

function Requisito({ children, diferencial = false }: { children: ReactNode; diferencial?: boolean }) {
  return (
    <div className={`flex items-start gap-2.5 rounded-xl border p-3 text-sm ${diferencial ? 'border-dashed border-border' : 'border-transparent bg-muted/60'}`}>
      <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[#1F2322] ${diferencial ? 'bg-[#FBCE00]' : 'bg-[#81E2CF]'}`}>
        {diferencial ? <Star className="h-3 w-3" aria-hidden /> : <Check className="h-3 w-3" aria-hidden />}
      </span>
      <span>{children}</span>
    </div>
  );
}
