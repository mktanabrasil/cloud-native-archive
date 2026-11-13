import { useLayoutEffect, useRef, useState, type ComponentProps } from 'react';
import { toast } from 'sonner';
import { Plus, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { salvarAno } from '@/lib/calendario/api';
import { trocarMarcas } from '@/lib/calendario/pdf/marcacao';
import { SECOES_DO_TEXTO, corpoDaSecao, proximaUnidade, romano, secoesDoAno, unidadesNovas, type SecaoDoTexto } from '@/lib/calendario/pdf/textosBase';
import { autoriaDe, type AnoDoCalendario } from '@/lib/calendario/regras';

/**
 * Os textos do projeto (13/11/2026): as páginas 2 a 10 do PDF, que as
 * coordenadoras revisam e reescrevem. Vêm os de 2026.
 *
 * Só o que foi mexido é gravado (`textos[id]`); a seção que volta igual à de
 * 2026 some do banco e passa a seguir a base de novo.
 *
 * Unidades novas (13/11/2026): o botão depois da ANA III acrescenta a próxima
 * (ANA IV, ANA V…), com o texto em branco para elas escreverem. A unidade nova
 * fica gravada mesmo vazia; só a última pode ser tirada, para a ordem não pular.
 */

/** As seções por página do PDF, a partir da 2, como em 2026. */
function porPagina(secoes: SecaoDoTexto[]): { pagina: number; secoes: SecaoDoTexto[] }[] {
  const grupos: { pagina: number; secoes: SecaoDoTexto[] }[] = [];
  for (const s of secoes) {
    if (s.novaPagina || !grupos.length) grupos.push({ pagina: grupos.length + 2, secoes: [] });
    grupos[grupos.length - 1].secoes.push(s);
  }
  return grupos;
}
const ehNova = (id: string) => /^ana-\d+$/.test(id) && Number(id.slice(4)) > 3;

const limpo = (t: string) => t.replace(/\r\n?/g, '\n').replace(/[ \t]+$/gm, '').trim();
const base = (id: string) => limpo(SECOES_DO_TEXTO.find(s => s.id === id)?.corpo ?? '');

/** O campo cresce com o texto: a coordenadora lê a seção inteira sem rolar dentro dele. */
function CampoQueCresce(props: ComponentProps<typeof Textarea>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ajustar = () => { el.style.height = 'auto'; el.style.height = `${el.scrollHeight + 2}px`; };
    ajustar();
    window.addEventListener('resize', ajustar);
    return () => window.removeEventListener('resize', ajustar);
  }, [props.value]);
  return <Textarea ref={ref} rows={3} {...props} className={`resize-none overflow-hidden ${props.className ?? ''}`} />;
}

export function TextosDoProjeto({ ano, editavel, onAno }: { ano: AnoDoCalendario; editavel: boolean; onAno: (a: AnoDoCalendario) => void }) {
  const [corpos, setCorpos] = useState<Record<string, string>>(() => Object.fromEntries(secoesDoAno(ano.textos).map(s => [s.id, corpoDaSecao(ano.textos, s.id)])));
  const [novas, setNovas] = useState<number[]>(() => unidadesNovas(ano.textos));
  const [salvando, setSalvando] = useState(false);
  const secoes = secoesDoAno(ano.textos, novas);
  const grupos = porPagina(secoes);
  const corpo = (id: string) => corpos[id] ?? '';
  const mudou = novas.join() !== unidadesNovas(ano.textos).join() || secoes.some(s => limpo(corpo(s.id)) !== limpo(corpoDaSecao(ano.textos, s.id)));
  const editadas = secoes.filter(s => ehNova(s.id) || limpo(corpo(s.id)) !== base(s.id)).length;
  const ultimaUnidade = `ana-${novas[novas.length - 1] ?? 3}`;
  const proxima = proximaUnidade(novas);
  const acrescentarUnidade = () => { setNovas(n => [...n, proxima]); setCorpos(c => ({ ...c, [`ana-${proxima}`]: '' })); };
  const tirarUltima = () => {
    const n = novas[novas.length - 1];
    setNovas(ns => ns.slice(0, -1));
    setCorpos(c => { const r = { ...c }; delete r[`ana-${n}`]; return r; });
  };

  const salvar = async () => {
    setSalvando(true);
    try {
      const textos: Record<string, string> = {};
      for (const s of secoes) if (ehNova(s.id) || limpo(corpo(s.id)) !== base(s.id)) textos[s.id] = limpo(corpo(s.id));
      onAno(await salvarAno(ano.ano, { textos }));
      toast.success('Textos salvos');
    } catch (e) { toast.error((e as Error).message || 'Não foi possível salvar'); }
    finally { setSalvando(false); }
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-10 lg:px-6">
      <h1 className="font-display text-[26px] font-bold tracking-tight sm:text-[28px]">Textos do projeto · {ano.ano}</h1>
      <p className="mt-1 text-[14px] text-muted-foreground">As páginas 2 a 10 do PDF. Vieram os textos de 2026: revisem e troquem o que mudou.</p>

      <section className="glass-2 mt-5 rounded-[22px] p-4 text-[13.5px] leading-relaxed">
        <p className="font-semibold">Como escrever</p>
        <ul className="mt-1.5 grid gap-x-6 gap-y-1 text-muted-foreground sm:grid-cols-2">
          <li>Cada linha vira um parágrafo no PDF.</li>
          <li>Comece a linha com <b className="text-foreground">-</b> e um espaço para virar item de lista.</li>
          <li><b className="text-foreground">**assim**</b> fica em negrito.</li>
          <li><b className="text-foreground">{'{ano}'}</b> e <b className="text-foreground">{'{tema}'}</b> viram o ano e o tema do ano.</li>
        </ul>
      </section>

      {grupos.map(g => (
        <section key={g.pagina} className="mt-6" aria-labelledby={`textos-pagina-${g.pagina}`}>
          <h2 id={`textos-pagina-${g.pagina}`} className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Página {g.pagina} do PDF</h2>
          <div className="mt-2 space-y-3">
            {g.secoes.map(s => {
              const titulo = trocarMarcas(s.titulo, ano.ano, ano.tema);
              const nova = ehNova(s.id);
              const editada = !nova && limpo(corpo(s.id)) !== base(s.id);
              return (
                <div key={s.id}>
                <div className="glass-2 rounded-[22px] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <label htmlFor={`texto-${s.id}`} className={`min-w-0 font-semibold ${s.nivel === 1 ? 'text-[15px]' : 'text-[13.5px]'}`}>{titulo}</label>
                    <span className="flex flex-wrap items-center gap-2">
                      {autoriaDe(ano, `texto:${s.id}`) && <span className="text-[11.5px] text-muted-foreground">por {autoriaDe(ano, `texto:${s.id}`)}</span>}
                      {editada && <span className="rounded-full bg-[hsl(var(--sel))]/15 px-2.5 py-0.5 text-[11.5px] font-semibold text-[hsl(var(--sel))]">Editado</span>}
                      {nova && <span className="rounded-full bg-[hsl(var(--sel))]/15 px-2.5 py-0.5 text-[11.5px] font-semibold text-[hsl(var(--sel))]">Unidade nova</span>}
                    </span>
                  </div>
                  <CampoQueCresce
                    id={`texto-${s.id}`}
                    className="mt-2 text-[14px] leading-relaxed"
                    value={corpo(s.id)}
                    disabled={!editavel}
                    placeholder={nova ? 'Escrevam a apresentação da unidade, como nas outras: o território e o que a unidade faz. No fim, “Unidade:” e “Responsável técnico:”.' : undefined}
                    onChange={e => setCorpos(c => ({ ...c, [s.id]: e.target.value }))}
                  />
                  {editavel && editada && (
                    <Button variant="ghost" size="sm" className="mt-1.5 gap-1.5 text-muted-foreground" onClick={() => setCorpos(c => ({ ...c, [s.id]: base(s.id) }))}>
                      <RotateCcw className="h-3.5 w-3.5" /> Voltar ao texto de 2026
                    </Button>
                  )}
                  {editavel && nova && s.id === ultimaUnidade && (
                    <Button variant="ghost" size="sm" className="mt-1.5 gap-1.5 text-muted-foreground" onClick={tirarUltima}>
                      <Trash2 className="h-3.5 w-3.5" /> Tirar a {s.titulo}
                    </Button>
                  )}
                </div>
                {editavel && s.id === ultimaUnidade && (
                  <Button variant="outline" className="mt-3 w-full gap-2 border-dashed" onClick={acrescentarUnidade}>
                    <Plus className="h-4 w-4" /> Acrescentar unidade (ANA {romano(proxima)})
                  </Button>
                )}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <p className="mt-6 text-[13px] text-muted-foreground">A tabela dos percursos, no fim da página 10, sai sozinha dos percursos de cada mês.</p>

      {editavel && (
        <div className="sticky bottom-3 mt-4 flex items-center justify-end gap-3">
          <span className="rounded-full bg-background/80 px-3 py-1 text-[12.5px] text-muted-foreground backdrop-blur">{editadas === 0 ? 'Igual a 2026' : `${editadas} ${editadas === 1 ? 'seção editada' : 'seções editadas'}`}</span>
          <Button onClick={salvar} disabled={!mudou || salvando} className="shadow-lg">{salvando ? 'Salvando…' : mudou ? 'Salvar os textos' : 'Tudo salvo'}</Button>
        </div>
      )}
    </div>
  );
}
