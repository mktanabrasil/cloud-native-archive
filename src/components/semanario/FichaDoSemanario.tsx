import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown, Eye, Loader2, Lock, Send, Trash2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ROTAS } from '@/config/navigation';
import { apagar, desfazerEnvio, enviar, lerUm, salvar } from '@/lib/semanario/api';
import {
  CAMPOS_DA_SEMANA, CAMPOS_DO_DIA, DIAS, LIMITES, ROTULO_DA_SITUACAO, dataDoDia, diaCompleto, diaComSemana,
  faltasParaEnviar, hojeIso, periodoCurto, periodoPorExtenso, prazoDaDevolutiva, prazoDeEnvio, situacao, textosLongos,
  type CampoDoDia, type ChaveDoDia, type ConteudoDoSemanario, type Semanario,
} from '@/lib/semanario/regras';
import { cn } from '@/lib/utils';
import { gerarPdfDoSemanario } from '@/lib/semanario/pdf/gerar';
import { CaixaDaDevolutiva, Rotulo, Selo, Vidro, quando } from './pecas';
import { AvisoDeFolhaCheia, FolhaAoLado, PreviaDoSemanario, useFolhaDoSemanario } from './PreviaDoSemanario';

const conteudoDe = (s: Semanario): ConteudoDoSemanario => ({
  agrupamento: s.agrupamento ?? '',
  dias: s.dias ?? {},
  formas_registro: s.formas_registro ?? '',
  materiais: s.materiais ?? '',
  avaliacao: s.avaliacao ?? '',
});

type Gravacao = 'salvo' | 'pendente' | 'salvando' | 'erro';

/** Tela larga (lg): só nela a folha fica ao lado; no celular ela nem é desenhada. */
function useTelaLarga() {
  const consulta = '(min-width: 1024px)';
  const [larga, setLarga] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(consulta).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(consulta);
    if (!mq) return;
    const mudar = () => setLarga(mq.matches);
    mudar();
    mq.addEventListener?.('change', mudar);
    return () => mq.removeEventListener?.('change', mudar);
  }, []);
  return larga;
}

/**
 * Um semanário aberto (mockup aprovado em 17/11/2026). A professora dona
 * preenche os campos fixos da página 2 do modelo, que salvam sozinhos; envia
 * à orientadora e, enquanto não houver devolutiva, pode desfazer o envio.
 * Depois do envio só a avaliação continua aberta. Quem só lê (a orientadora,
 * o marketing) vê os mesmos campos travados.
 */
export function FichaDoSemanario({ id, souADona }: { id: string; souADona: (s: Semanario) => boolean }) {
  const navigate = useNavigate();
  const [estado, setEstado] = useState<'carregando' | 'erro' | 'sumiu' | 'pronto'>('carregando');
  const [linha, setLinha] = useState<Semanario | null>(null);
  const [c, setC] = useState<ConteudoDoSemanario | null>(null);
  const [gravacao, setGravacao] = useState<Gravacao>('salvo');
  const [salvoAs, setSalvoAs] = useState<string | null>(null);
  const [diaAberto, setDiaAberto] = useState<ChaveDoDia | null>(null);
  const [confirmar, setConfirmar] = useState<'enviar' | 'apagar' | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [previa, setPrevia] = useState(false);
  // O que não coube na folha, conferido no PDF de verdade na hora de enviar.
  const [cheiosNoEnvio, setCheiosNoEnvio] = useState<string[]>([]);
  const [conferindo, setConferindo] = useState(false);
  const telaLarga = useTelaLarga();

  // O que ainda não foi para o banco: a versão do texto e o relógio da gravação.
  const versao = useRef(0);
  const gravada = useRef(0);
  const relogio = useRef<ReturnType<typeof setTimeout> | null>(null);
  const atual = useRef<{ c: ConteudoDoSemanario | null; linha: Semanario | null }>({ c: null, linha: null });
  atual.current = { c, linha };

  const carregar = useCallback(async () => {
    try {
      const s = await lerUm(id);
      if (!s) { setEstado('sumiu'); return; }
      setLinha(s); setC(conteudoDe(s)); setSalvoAs(s.atualizado_em);
      setDiaAberto(DIAS.find(d => !diaCompleto(s.dias?.[d.chave]))?.chave ?? 'seg');
      setEstado('pronto');
    } catch { setEstado('erro'); }
  }, [id]);
  useEffect(() => { void carregar(); }, [carregar]);

  const dona = !!linha && souADona(linha);
  const tudoAberto = dona && linha?.status === 'preenchimento';
  const avaliacaoAberta = dona;

  // Uma gravação de cada vez: a próxima só sai quando a anterior volta, para
  // as respostas nunca chegarem fora de ordem (texto velho por cima do novo).
  const emVoo = useRef<Promise<boolean> | null>(null);

  /**
   * Grava o que mudou. Depois do envio, só a avaliação vai (o banco trava o
   * resto). Se o banco devolver o semanário já enviado (por outra aba ou outro
   * aparelho), a tela volta ao que está gravado e avisa.
   */
  const gravar = useCallback((): Promise<boolean> => {
    if (relogio.current) { clearTimeout(relogio.current); relogio.current = null; }
    const anterior = emVoo.current;
    const vez = (async () => {
      if (anterior) await anterior.catch(() => false);
      const { c: agora, linha: l } = atual.current;
      if (!agora || !l) return true;
      if (versao.current === gravada.current) { setGravacao('salvo'); return true; }
      const v = versao.current;
      const tudo = l.status === 'preenchimento';
      setGravacao('salvando');
      try {
        const nova = await salvar(l.id, tudo ? agora : { avaliacao: agora.avaliacao });
        gravada.current = Math.max(gravada.current, v);
        setLinha(nova); setSalvoAs(nova.atualizado_em);
        if (tudo && nova.status !== 'preenchimento') {
          // O banco guardou só a avaliação: o resto volta ao que foi enviado.
          setC(antes => ({ ...conteudoDe(nova), avaliacao: antes?.avaliacao ?? nova.avaliacao }));
          toast.info('Este semanário já tinha sido enviado', { id: 'semanario-ja-enviado', description: 'Foi enviado em outra aba ou aparelho. O planejamento voltou ao que foi enviado; a avaliação continua aberta.' });
        }
        setGravacao(versao.current === gravada.current ? 'salvo' : 'pendente');
        return true;
      } catch (e) {
        setGravacao('erro');
        toast.error('Não salvou', { id: 'semanario-salvar', description: (e as Error).message || 'Confira a conexão e tente de novo.' });
        return false;
      }
    })();
    emVoo.current = vez;
    void vez.finally(() => { if (emVoo.current === vez) emVoo.current = null; });
    return vez;
  }, []);

  /** Antes de enviar, desfazer ou apagar: espera a gravação que estiver no ar. */
  const esperarGravacao = async () => {
    if (relogio.current) { clearTimeout(relogio.current); relogio.current = null; }
    if (emVoo.current) await emVoo.current.catch(() => false);
  };

  const mudar = (novo: ConteudoDoSemanario) => {
    setC(novo);
    versao.current += 1;
    setGravacao('pendente');
    if (relogio.current) clearTimeout(relogio.current);
    relogio.current = setTimeout(() => { void gravar(); }, 900);
  };
  const mudarDia = (dia: ChaveDoDia, campo: CampoDoDia, texto: string) =>
    c && mudar({ ...c, dias: { ...c.dias, [dia]: { ...c.dias[dia], [campo]: texto } } });

  // Saindo da página: grava o que faltou; fechando a aba com algo pendente, avisa.
  useEffect(() => {
    const avisar = (e: BeforeUnloadEvent) => { if (versao.current !== gravada.current) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', avisar);
    return () => { window.removeEventListener('beforeunload', avisar); void gravar(); };
  }, [gravar]);

  // A folha (página 2) refeita enquanto se escreve: ao lado do preenchimento e na prévia.
  const folha = useFolhaDoSemanario(c && linha ? { ...c, professora_nome: linha.professora_nome, semana: linha.semana } : null);

  if (estado === 'carregando') return <p className="px-6 py-10 text-center text-[14px] text-muted-foreground">Abrindo o semanário…</p>;
  if (estado === 'sumiu') return (
    <div className="mx-auto max-w-md px-4 py-10 text-center">
      <p className="text-[14px]">Este semanário não existe mais, ou não é seu para abrir.</p>
      <Button asChild variant="outline" className="mt-3 rounded-full"><Link to={ROTAS.semanario}>Voltar ao Semanário</Link></Button>
    </div>
  );
  if (estado === 'erro' || !linha || !c) return (
    <div className="mx-auto max-w-md px-4 py-10 text-center">
      <p className="text-[14px]">Não consegui abrir o semanário agora.</p>
      <Button className="mt-3" onClick={() => { setEstado('carregando'); void carregar(); }}>Tentar de novo</Button>
    </div>
  );

  const hoje = hojeIso();
  const sit = situacao(linha, hoje);
  const faltas = faltasParaEnviar(c);
  const longos = [...textosLongos(c), ...cheiosNoEnvio];

  /** Antes de abrir a confirmação, confere no PDF se tudo cabe na folha. */
  const pedirEnvio = async () => {
    setConferindo(true);
    try {
      const r = await gerarPdfDoSemanario({ ...(atual.current.c ?? c), professora_nome: linha.professora_nome, semana: linha.semana });
      setCheiosNoEnvio(r.cheios);
    } catch { setCheiosNoEnvio([]); /* sem o PDF, o banco ainda segura os tetos de tamanho */ }
    finally { setConferindo(false); setConfirmar('enviar'); }
  };

  const enviarAgora = async () => {
    setOcupado(true);
    try {
      await esperarGravacao();
      // Confere de novo o que vai sair: ela pode ter escrito durante a conferência.
      const v = versao.current;
      const agora = atual.current.c ?? c;
      const conferido = await gerarPdfDoSemanario({ ...agora, professora_nome: linha.professora_nome, semana: linha.semana }).catch(() => null);
      if (conferido?.cheios.length) { setCheiosNoEnvio(conferido.cheios); return; }
      const nova = await enviar(linha.id, agora);
      gravada.current = Math.max(gravada.current, v);
      setLinha(nova); setSalvoAs(nova.atualizado_em); setGravacao(versao.current === gravada.current ? 'salvo' : 'pendente'); setConfirmar(null);
      toast.success('Enviado à orientadora', { description: 'Ela lê e dá a devolutiva por aqui. A avaliação continua aberta para depois da semana.' });
    } catch (e) { toast.error('Não foi possível enviar', { description: (e as Error).message }); }
    finally { setOcupado(false); }
  };
  const desfazer = async () => {
    setOcupado(true);
    try {
      if (!(await gravar())) return;
      const nova = await desfazerEnvio(linha.id);
      if (nova.status !== 'preenchimento') { toast.info('A orientadora já deu a devolutiva; o envio não pode mais ser desfeito.'); setLinha(nova); return; }
      setLinha(nova); toast.success('Envio desfeito', { description: 'O semanário voltou para o preenchimento.' });
    } catch (e) { toast.error('Não foi possível desfazer o envio', { description: (e as Error).message }); }
    finally { setOcupado(false); }
  };
  const apagarAgora = async () => {
    setOcupado(true);
    try { await esperarGravacao(); await apagar(linha.id); gravada.current = versao.current; toast.success('Semanário apagado'); navigate(ROTAS.semanario); }
    catch (e) { toast.error('Não foi possível apagar', { description: (e as Error).message }); setOcupado(false); }
  };

  const textoDaGravacao = { salvo: salvoAs ? `Tudo salvo · ${quando(salvoAs).split(' às ')[1] ?? ''}` : 'Tudo salvo', pendente: 'Salvando…', salvando: 'Salvando…', erro: 'Não salvou' }[gravacao];
  const campo = (valor: string, aberto: boolean, onMudar: (t: string) => void, opcoes: { id: string; max: number; linhas?: number; dica?: string }) =>
    aberto ? (
      <Textarea id={opcoes.id} value={valor} maxLength={opcoes.max} rows={opcoes.linhas ?? 2} placeholder={opcoes.dica ?? 'Escreva aqui'}
        onChange={e => onMudar(e.target.value)} className="mt-1 rounded-[12px] border-black/10 bg-white/80 text-[13.5px] leading-snug dark:border-white/10 dark:bg-white/5" />
    ) : (
      <p id={opcoes.id} className={cn('mt-1 min-h-[38px] whitespace-pre-line rounded-[12px] bg-black/[.04] px-3 py-2 text-[13.5px] leading-snug dark:bg-white/[.05]', !valor && 'text-muted-foreground')}>{valor || '—'}</p>
    );

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-16 lg:px-6">
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <Link to={ROTAS.semanario} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Semanário</Link>
        <span className="flex flex-wrap items-center gap-2">
          {dona && <span className={cn('text-[12px] font-semibold', gravacao === 'erro' ? 'text-[hsl(var(--destructive))]' : gravacao === 'salvo' ? 'text-[hsl(var(--success))]' : 'text-muted-foreground')} role="status">{textoDaGravacao}</span>}
          {dona && gravacao === 'erro' && <Button size="sm" variant="outline" className="rounded-full" onClick={() => void gravar()}>Tentar salvar de novo</Button>}
          <Button variant="outline" className="gap-1.5 rounded-full" onClick={() => setPrevia(true)}><Eye className="h-4 w-4" /> Ver a prévia</Button>
          {tudoAberto && <Button className="gap-1.5 rounded-full" disabled={ocupado || conferindo} onClick={() => void pedirEnvio()}>{conferindo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar à orientadora</Button>}
          {dona && linha.status === 'enviado' && <Button variant="outline" className="gap-1.5 rounded-full" disabled={ocupado} onClick={() => void desfazer()}><Undo2 className="h-4 w-4" /> Desfazer o envio</Button>}
        </span>
      </div>

      <h1 className="mt-2 font-display text-[26px] font-bold tracking-tight sm:text-[30px]">Semana de {periodoPorExtenso(linha.semana)}</h1>
      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px] text-muted-foreground">
        <Selo situacao={sit}>{ROTULO_DA_SITUACAO[sit]}</Selo>
        {linha.status === 'preenchimento' && <span>Enviar até <b className="text-foreground">{diaComSemana(prazoDeEnvio(linha.semana))}</b></span>}
        {linha.status === 'enviado' && <span>Enviado {quando(linha.enviado_em)} · devolutiva até <b className="text-foreground">{diaComSemana(prazoDaDevolutiva(linha.semana))}</b></span>}
        {!dona && <span>{linha.unidade}</span>}
      </p>

      {linha.devolutiva && <div className="mt-4"><CaixaDaDevolutiva texto={linha.devolutiva} por={linha.devolutiva_por} em={linha.devolutiva_em} /></div>}
      {dona && linha.status !== 'preenchimento' && (
        <p className="mt-3 flex items-center gap-1.5 text-[12.5px] text-muted-foreground"><Lock className="h-3.5 w-3.5" /> Enviado: o planejamento está travado. A avaliação das propostas continua aberta.</p>
      )}

      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-3">
        {dona && folha.fase === 'pronta' && <AvisoDeFolhaCheia cheios={folha.cheios} className="lg:hidden" />}
        <Vidro className="grid gap-3 p-4 sm:grid-cols-3">
          <div>
            <Rotulo htmlFor="sem-agrupamento">Agrupamento</Rotulo>
            {tudoAberto ? (
              <Input id="sem-agrupamento" value={c.agrupamento} maxLength={LIMITES.agrupamento} placeholder="Ex.: AG I A"
                onChange={e => mudar({ ...c, agrupamento: e.target.value })} className="mt-1 rounded-[12px] border-black/10 bg-white/80 text-[13.5px] dark:border-white/10 dark:bg-white/5" />
            ) : <p id="sem-agrupamento" className="mt-1 rounded-[12px] bg-black/[.04] px-3 py-2 text-[13.5px] dark:bg-white/[.05]">{c.agrupamento || '—'}</p>}
          </div>
          <div>
            <Rotulo>Professora</Rotulo>
            <p className="mt-1 flex items-center gap-1.5 rounded-[12px] bg-black/[.04] px-3 py-2 text-[13.5px] dark:bg-white/[.05]"><Lock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />{linha.professora_nome || '—'}</p>
          </div>
          <div>
            <Rotulo>Período</Rotulo>
            <p className="mt-1 flex items-center gap-1.5 rounded-[12px] bg-black/[.04] px-3 py-2 text-[13.5px] dark:bg-white/[.05]"><Lock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />{periodoCurto(linha.semana)}</p>
          </div>
        </Vidro>

        {DIAS.map(d => {
          const dia = c.dias[d.chave];
          const n = CAMPOS_DO_DIA.filter(f => (dia?.[f.chave] ?? '').trim()).length;
          const aberto = diaAberto === d.chave;
          return (
            <Vidro key={d.chave} className="p-4">
              <button type="button" aria-expanded={aberto} onClick={() => setDiaAberto(aberto ? null : d.chave)} className="flex w-full items-center justify-between gap-3 text-left">
                <b className="font-display text-[16px] tracking-tight">{d.rotulo} <span className="ml-1 text-[12.5px] font-medium text-muted-foreground">{dataDoDia(linha.semana, d.chave).slice(8, 10)}/{dataDoDia(linha.semana, d.chave).slice(5, 7)}</span></b>
                <span className="flex items-center gap-2">
                  {n === 4 ? <span className="text-[12px] font-semibold text-[hsl(var(--success))]">Completo</span> : n ? <span className="text-[12px] font-semibold text-[hsl(var(--warning))]">{n} de 4</span> : <span className="text-[12px] text-muted-foreground">Em branco</span>}
                  <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', aberto && 'rotate-180')} aria-hidden />
                </span>
              </button>
              {aberto && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {CAMPOS_DO_DIA.map(f => (
                    <div key={f.chave} className={cn((f.chave === 'objetivo' || f.chave === 'desenvolvimento') && 'sm:col-span-2')}>
                      <Rotulo htmlFor={`sem-${d.chave}-${f.chave}`}>{f.rotulo}</Rotulo>
                      {campo(dia?.[f.chave] ?? '', tudoAberto, t => mudarDia(d.chave, f.chave, t), { id: `sem-${d.chave}-${f.chave}`, max: LIMITES.campoDoDia, linhas: f.chave === 'desenvolvimento' ? 4 : 2 })}
                    </div>
                  ))}
                </div>
              )}
            </Vidro>
          );
        })}

        <Vidro className="space-y-3 p-4">
          {CAMPOS_DA_SEMANA.map(f => {
            const aberto = f.chave === 'avaliacao' ? avaliacaoAberta : tudoAberto;
            return (
              <div key={f.chave}>
                <Rotulo htmlFor={`sem-${f.chave}`}>{f.rotulo}</Rotulo>
                {campo(c[f.chave], aberto, t => mudar({ ...c, [f.chave]: t }), {
                  id: `sem-${f.chave}`, max: LIMITES[f.chave], linhas: f.chave === 'avaliacao' ? 4 : 2,
                  dica: f.chave === 'avaliacao' ? 'Preencha depois da semana: como as propostas aconteceram.' : undefined,
                })}
              </div>
            );
          })}
        </Vidro>

        {tudoAberto && (
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" disabled={ocupado} onClick={() => setConfirmar('apagar')}><Trash2 className="h-4 w-4" /> Apagar este semanário</Button>
          </div>
        )}
      </div>
      {telaLarga && (
        <aside>
          <div className="sticky top-24"><FolhaAoLado estado={folha} /></div>
        </aside>
      )}
      </div>

      <PreviaDoSemanario estado={folha} semanario={{ ...c, professora_nome: linha.professora_nome, semana: linha.semana }} aberta={previa} onFechar={() => setPrevia(false)} />

      <AlertDialog open={confirmar === 'enviar'} onOpenChange={o => !o && setConfirmar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{faltas.length || longos.length ? 'Falta pouco para enviar' : 'Enviar à orientadora?'}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-[14px]">
                {faltas.length > 0 && <p>Preencha antes: <b>{faltas.join(', ')}</b>.</p>}
                {longos.length > 0 && <p>Não cabe na folha: <b>{longos.join(', ')}</b>. Encurte esse texto para caber.</p>}
                {!faltas.length && !longos.length && <p>A orientadora pedagógica recebe o semanário de {periodoPorExtenso(linha.semana)} para a devolutiva. Depois do envio só a avaliação continua aberta; dá para desfazer o envio enquanto ela não responder.</p>}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{faltas.length || longos.length ? 'Voltar a preencher' : 'Cancelar'}</AlertDialogCancel>
            {!faltas.length && !longos.length && (
              <AlertDialogAction disabled={ocupado} onClick={e => { e.preventDefault(); void enviarAgora(); }}><Send className="mr-1.5 h-4 w-4" /> Enviar</AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmar === 'apagar'} onOpenChange={o => !o && setConfirmar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar este semanário?</AlertDialogTitle>
            <AlertDialogDescription>O semanário de {periodoPorExtenso(linha.semana)}{c.agrupamento ? ` (${c.agrupamento})` : ''} some de vez. Não dá para desfazer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={ocupado} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={e => { e.preventDefault(); void apagarAgora(); }}>Apagar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
