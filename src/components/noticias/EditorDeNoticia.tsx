import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, ChevronRight, Eye, Folder, History, Image as ImageIcon, Loader2, Star, Trash2, Upload, Video, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import {
  COR_DA_UNIDADE, dataBR, unidadesParaOEditor, enviarArquivo, envioConcluido, excluirNoticia, nomeDaUnidade, noticiaDoPainel, paragrafosDe, salvarNoticia, textoDe,
  type MidiaDoPainel, type NoticiaDoPainel, type PedidoDeSalvar,
} from '@/lib/noticias/painel';
import { problemasDaEdicao } from '../../../supabase/functions/noticias/regras.ts';
import { EtiquetaDaUnidade } from './ListaDeNoticias';

/** O que está na tela (o que o salvar manda). */
interface Edicao {
  titulo: string;
  data: string;
  hora: string;
  unidade: string;
  extras: string[];
  texto: string;
  fotos: MidiaDoPainel[];
  videos: MidiaDoPainel[];
  capa: string | null;
  remover: string[];
  descricoes: Record<string, string>;
  na_lista: boolean;
  fixada: boolean;
}

interface Envio { id: number; nome: string; progresso: number; erro?: string }

/** Cópia local do que não foi salvo (aba fechada, voltar do navegador): dá para recuperar ao abrir de novo. */
interface CopiaLocal { em: string; novo_id?: string; titulo: string; data: string; hora: string; unidade: string; extras: string[]; texto: string; capa: string | null; fotos: string[]; videos: string[]; remover: string[]; descricoes: Record<string, string>; na_lista: boolean; fixada: boolean }
const chaveDaCopia = (pasta: string | null) => `noticia-nao-salva:${pasta ?? 'nova'}`;
/** Ao abrir, a cópia que sobrou vira "anterior" (o aviso oferece recuperar) e a edição de agora continua sendo guardada. */
function separarCopiaAnterior(pasta: string | null): CopiaLocal | null {
  try {
    const k = chaveDaCopia(pasta);
    const atual = localStorage.getItem(k);
    if (atual) { localStorage.setItem(`${k}:anterior`, atual); localStorage.removeItem(k); }
    const t = localStorage.getItem(`${k}:anterior`);
    return t ? JSON.parse(t) as CopiaLocal : null;
  } catch { return null; }
}
function esquecerCopiaAnterior(pasta: string | null) { try { localStorage.removeItem(`${chaveDaCopia(pasta)}:anterior`); } catch { /* sem armazenamento */ } }
function guardarCopia(pasta: string | null, e: Edicao | null, novoId?: string) {
  try {
    if (!e) { localStorage.removeItem(chaveDaCopia(pasta)); return; }
    const c: CopiaLocal = { ...e, em: new Date().toISOString(), novo_id: pasta ? undefined : novoId, fotos: e.fotos.map((m) => m.chave), videos: e.videos.map((m) => m.chave) };
    localStorage.setItem(chaveDaCopia(pasta), JSON.stringify(c));
  } catch { /* sem armazenamento: segue sem cópia */ }
}

const agoraEmBrasilia = () => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { data: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}` };
};

const vazia = (): Edicao => {
  const a = agoraEmBrasilia();
  return { titulo: '', data: a.data, hora: a.hora, unidade: '', extras: [], texto: '', fotos: [], videos: [], capa: null, remover: [], descricoes: {}, na_lista: true, fixada: false };
};

const semRepetir = (ms: MidiaDoPainel[]) => ms.filter((m, i) => ms.findIndex((x) => x.chave === m.chave) === i);

/** A notícia como está salva (sem os envios pendentes). Sem capa.* no Drive, a capa é a 1ª foto: aparece uma vez só. */
function daNoticia(n: NoticiaDoPainel): Edicao {
  const d = n.dados!;
  const fotos = semRepetir([...(d.capa ? [d.capa] : []), ...d.midias.filter((m) => m.tipo === 'foto')]);
  const videos = d.midias.filter((m) => m.tipo === 'video');
  return {
    // Sem a hora lida (notícia lida antes de a API guardar a hora): campo vazio, e o salvar mantém a do post.json.
    titulo: d.titulo, data: d.data, hora: d.data_hora && d.data_hora.length >= 16 ? d.data_hora.slice(11, 16) : '', unidade: d.unidade, extras: d.unidades.filter((u) => u !== d.unidade),
    texto: textoDe(d.texto), fotos, videos, capa: d.capa?.chave ?? null, remover: [],
    descricoes: Object.fromEntries([...fotos, ...videos].filter((m) => m.alt).map((m) => [m.chave, m.alt])), na_lista: d.na_lista, fixada: d.fixada,
  };
}
/** Junta mídias que chegaram (envios) sem desfazer o que está na tela (ordem, capa, retiradas). */
function juntar(e: Edicao, chegaram: MidiaDoPainel[]): Edicao {
  const conhecidas = new Set([...e.fotos, ...e.videos].map((m) => m.chave).concat(e.remover));
  const novas = semRepetir(chegaram.filter((m) => !conhecidas.has(m.chave)));
  if (!novas.length) return e;
  const fotos = [...e.fotos, ...novas.filter((m) => m.tipo === 'foto')];
  return { ...e, fotos, videos: [...e.videos, ...novas.filter((m) => m.tipo === 'video')], capa: e.capa ?? fotos[0]?.chave ?? null };
}

function pedido(e: Edicao, pastaId: string | null, publicado: boolean, novoId?: string): PedidoDeSalvar {
  return {
    ...(pastaId ? { pasta_id: pastaId } : novoId ? { novo_id: novoId } : {}),
    titulo: e.titulo.trim(), data: e.data, hora: e.hora || undefined, unidade: e.unidade, unidades: e.extras, texto: paragrafosDe(e.texto),
    na_lista: e.na_lista, fixada: e.fixada, publicado, capa: e.capa, ordem: e.fotos.map((f) => f.chave), videos: e.videos.map((v) => v.chave), remover: e.remover,
    descricoes: Object.fromEntries(Object.entries(e.descricoes).filter(([c, v]) => !e.remover.includes(c) && v.trim())),
  };
}
/** Para saber se há mudança sem salvar. */
const marca = (e: Edicao) => JSON.stringify(pedido(e, null, true));

const Rotulo = ({ children }: { children: ReactNode }) => <span className="text-[13px] font-semibold text-foreground">{children}</span>;
const campo = 'w-full rounded-[12px] border border-border bg-background px-3 py-2.5 text-[14.5px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-70';
const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

type Ocupado = null | 'rascunho' | 'publicar' | 'excluir' | 'criando' | 'concluindo';

export function EditorDeNoticia({ pastaId: pastaDoEndereco, voltar, criada }: { pastaId: string | null; voltar: (substituir?: boolean) => void; criada: (id: string) => void }) {
  // Só a de quando abriu: a notícia nova ganha endereço ao salvar e o editor segue o mesmo.
  const pastaInicial = useRef(pastaDoEndereco).current;
  // O mesmo código em todas as tentativas de criar esta notícia (o salvar repetido não cria outra pasta).
  const novoId = useRef(typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `n${Date.now()}${Math.random().toString(36).slice(2, 10)}`);
  // Depois de sair (desmontado), uma resposta que chega não puxa a pessoa de volta para o editor.
  const montado = useRef(true);
  useEffect(() => () => { montado.current = false; }, []);
  const [salvouAqui, setSalvouAqui] = useState(false);
  const navegar = useNavigate();
  const [pastaId, setPastaId] = useState<string | null>(pastaInicial);
  const [carregada, setCarregada] = useState<NoticiaDoPainel | null>(null);
  const [erroAoAbrir, setErroAoAbrir] = useState<string | null>(null);
  const [inicial] = useState(vazia);
  const [e, setE] = useState<Edicao>(inicial);
  const [salva, setSalva] = useState<string>(() => marca(inicial));
  const [publicada, setPublicada] = useState(false);
  const [ocupado, setOcupado] = useState<Ocupado>(null);
  const [envios, setEnvios] = useState<Envio[]>([]);
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [sair, setSair] = useState<null | { destino: string | null }>(null);
  const [perguntaExcluir, setPerguntaExcluir] = useState(false);
  const [faltam, setFaltam] = useState<string[]>([]);
  const [copia, setCopia] = useState<CopiaLocal | null>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const [soltando, setSoltando] = useState(false);
  const previa = useRef<HTMLElement>(null);
  const contador = useRef(0);

  /** A notícia como veio do servidor; os envios ainda não salvos entram na tela como mudança. */
  const aplicar = useCallback((n: NoticiaDoPainel) => {
    setCarregada(n);
    if (!n.dados) return;
    const base = daNoticia(n);
    setE(juntar(base, n.enviados ?? [])); setSalva(marca(base)); setPublicada(n.dados.publicado !== false);
  }, []);

  useEffect(() => {
    if (!pastaInicial) { setCopia(separarCopiaAnterior(null)); return; }
    let vivo = true;
    noticiaDoPainel(pastaInicial).then((n) => { if (!vivo) return; aplicar(n); setCopia(separarCopiaAnterior(pastaInicial)); })
      .catch((x) => vivo && setErroAoAbrir(x instanceof Error ? x.message : String(x)));
    return () => { vivo = false; };
  }, [pastaInicial, aplicar]);

  const enviando = envios.some((x) => x.progresso < 1 && !x.erro) || ocupado === 'concluindo' || ocupado === 'criando';
  const mudou = marca(e) !== salva;
  const travado = !!ocupado;

  // Fechar a aba com mudança: o navegador pergunta. Cópia local para recuperar se sair por outro caminho (voltar do navegador).
  useEffect(() => {
    if (!mudou && !enviando) return;
    const aviso = (ev: BeforeUnloadEvent) => { ev.preventDefault(); ev.returnValue = ''; };
    window.addEventListener('beforeunload', aviso);
    return () => window.removeEventListener('beforeunload', aviso);
  }, [mudou, enviando]);
  useEffect(() => {
    if (pastaInicial && !carregada) return; // a notícia ainda não abriu
    const t = setTimeout(() => guardarCopia(pastaId, mudou ? e : null, novoId.current), 600);
    return () => clearTimeout(t);
  }, [e, mudou, pastaId, carregada, pastaInicial]);
  // Links do menu e da faixa com mudança: pergunta antes (o voltar do navegador fica com a cópia local).
  useEffect(() => {
    if (!mudou && !enviando) return;
    const clique = (ev: MouseEvent) => {
      if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
      const a = (ev.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      const u = new URL(a.href, window.location.href);
      if (u.origin !== window.location.origin) return;
      ev.preventDefault(); ev.stopPropagation();
      setSair({ destino: u.pathname + u.search + u.hash });
    };
    document.addEventListener('click', clique, true);
    return () => document.removeEventListener('click', clique, true);
  }, [mudou, enviando]);

  const mudar = (parte: Partial<Edicao>) => { setE((x) => ({ ...x, ...parte })); setFaltam([]); };

  async function salvar(publicar: boolean) {
    const p = pedido(e, pastaId, publicar, novoId.current);
    const problemas = problemasDaEdicao(p, !!p.capa);
    if (problemas.length) { setFaltam(problemas); toast.error(`Falta preencher: ${problemas.join(', ')}.`); return; }
    setOcupado(publicar ? 'publicar' : 'rascunho');
    try {
      const n = await salvarNoticia(p);
      if (!pastaId) guardarCopia(null, null);
      guardarCopia(n.pasta_id, null);
      if (montado.current) {
        if (n.relendo || !n.dados) { setSalva(marca(e)); setPublicada(publicar); setCarregada(n); }
        else aplicar(n);
        setSalvouAqui(true);
        if (!pastaId) { setPastaId(n.pasta_id); criada(n.pasta_id); }
      }
      const fim = n.relendo ? ' O site termina de atualizar em até 2 minutos.' : '';
      toast.success((publicar ? (publicada ? 'Notícia salva.' : 'Notícia publicada.') : publicada ? 'Notícia tirada do site: agora é rascunho.' : 'Rascunho salvo.') + (fim || (publicar ? ' O site já mostra.' : '')));
    } catch (x) {
      toast.error(x instanceof Error ? x.message : String(x));
    } finally { setOcupado(null); }
  }

  /** Fotos e vídeos vão direto para o Drive (subpasta de envios; entram na notícia ao salvar). Notícia nova é salva antes como rascunho. */
  async function adicionar(arquivos: File[]) {
    if (!arquivos.length || travado || enviando || bloqueadoPelaLeitura) return;
    let pasta = pastaId;
    if (!pasta) {
      const p = pedido(e, null, false, novoId.current);
      const problemas = problemasDaEdicao(p, false);
      if (problemas.length) { setFaltam(problemas); toast.error(`Antes das fotos, preencha: ${problemas.join(', ')}.`); return; }
      setOcupado('criando');
      try {
        const n = await salvarNoticia(p);
        pasta = n.pasta_id; guardarCopia(null, null);
        if (!montado.current) return;
        setPastaId(pasta); criada(pasta); setCarregada(n); setSalva(marca(e)); setSalvouAqui(true);
      } catch (x) { toast.error(x instanceof Error ? x.message : String(x)); return; }
      finally { setOcupado(null); }
    }
    const lote = arquivos.map((f) => ({ f, id: ++contador.current }));
    setEnvios((xs) => [...xs.filter((x) => x.erro), ...lote.map(({ f, id }) => ({ id, nome: f.name, progresso: 0 }))]);
    const atualizar = (id: number, parte: Partial<Envio>) => setEnvios((xs) => xs.map((x) => (x.id === id ? { ...x, ...parte } : x)));
    const foram: number[] = [];
    const fila = [...lote];
    const enviarUm = async ({ f, id }: { f: File; id: number }) => {
      try { await enviarArquivo(pasta!, f, (p) => atualizar(id, { progresso: Math.min(p, 0.99) })); atualizar(id, { progresso: 1 }); foram.push(id); }
      catch (x) { atualizar(id, { erro: x instanceof Error ? x.message : String(x) }); }
    };
    const trabalhar = async () => { for (let item = fila.shift(); item; item = fila.shift()) await enviarUm(item); };
    // O primeiro sozinho (cria a subpasta de envios no Drive); o resto, dois de cada vez.
    await enviarUm(fila.shift()!);
    await Promise.all([trabalhar(), trabalhar()]);
    if (!foram.length || !montado.current) return;
    setOcupado('concluindo');
    try {
      const n = await envioConcluido(pasta!);
      setCarregada(n);
      setE((x) => juntar(x, n.enviados ?? []));
      setEnvios((xs) => xs.filter((x) => !foram.includes(x.id)));
      toast.success(`${foram.length === 1 ? 'Arquivo enviado' : `${foram.length} arquivos enviados`} ao Drive. Entra${foram.length === 1 ? '' : 'm'} na notícia quando você salvar.`);
    } catch (x) { toast.error(x instanceof Error ? x.message : String(x)); }
    finally { setOcupado(null); }
  }

  function retirar(chave: string) {
    setE((x) => {
      const fotos = x.fotos.filter((m) => m.chave !== chave);
      return { ...x, fotos, videos: x.videos.filter((m) => m.chave !== chave), remover: [...x.remover, chave], capa: x.capa === chave ? fotos[0]?.chave ?? null : x.capa };
    });
    if (selecionada === chave) setSelecionada(null);
  }
  function mover(chave: string, para: number) {
    setE((x) => {
      const de = x.fotos.findIndex((m) => m.chave === chave);
      if (de < 0 || para < 0 || para >= x.fotos.length || de === para) return x;
      const fotos = [...x.fotos]; const [m] = fotos.splice(de, 1); fotos.splice(para, 0, m);
      return { ...x, fotos };
    });
  }
  const soltar = (ev: DragEvent, alvo: string) => {
    if (ev.dataTransfer.files.length) return; // arquivos soltos aqui: a seção cuida (envio)
    ev.preventDefault();
    if (arrastando && arrastando !== alvo) mover(arrastando, e.fotos.findIndex((m) => m.chave === alvo));
    setArrastando(null);
  };

  async function excluir() {
    if (!pastaId) return;
    setOcupado('excluir');
    try {
      await excluirNoticia(pastaId);
      guardarCopia(pastaId, null); setSalva(marca(e));
      toast.success('Notícia excluída. A pasta foi para a lixeira do Drive (dá para recuperar por 30 dias).');
      voltar(true);
    } catch (x) { toast.error(x instanceof Error ? x.message : String(x)); }
    finally { setOcupado(null); setPerguntaExcluir(false); }
  }

  function recuperar() {
    if (!copia || travado || bloqueadoPelaLeitura) return;
    if (!pastaId && copia.novo_id) novoId.current = copia.novo_id; // a mesma notícia nova (um salvar que caiu pode ter criado a pasta)
    esquecerCopiaAnterior(pastaInicial); // a cópia anterior é a de quando o editor abriu ("nova" ou a pasta)
    const todas = new Map([...e.fotos, ...e.videos, ...(carregada?.enviados ?? [])].map((m) => [m.chave, m]));
    const fotos = copia.fotos.map((c) => todas.get(c)).filter(Boolean) as MidiaDoPainel[];
    const videos = copia.videos.map((c) => todas.get(c)).filter(Boolean) as MidiaDoPainel[];
    setE((x) => juntar({ ...x, ...copia, extras: copia.extras ?? [], fotos, videos, capa: copia.capa && fotos.some((f) => f.chave === copia.capa) ? copia.capa : fotos[0]?.chave ?? null, remover: copia.remover.filter((c) => todas.has(c)) }, carregada?.enviados ?? []));
    setCopia(null);
  }
  const descartarCopia = () => { esquecerCopiaAnterior(pastaInicial); setCopia(null); };

  async function recarregar() {
    if (!pastaId) return;
    try { aplicar(await noticiaDoPainel(pastaId)); } catch (x) { toast.error(x instanceof Error ? x.message : String(x)); }
  }
  const bloqueadoPelaLeitura = !!carregada?.lendo && !salvouAqui;

  const sairSemSalvar = () => {
    guardarCopia(pastaId, null);
    setSalva(marca(e));
    const destino = sair?.destino;
    setSair(null);
    if (destino) navegar(destino); else voltar();
  };
  const pedirSaida = () => (mudou || enviando ? setSair({ destino: null }) : voltar());
  const capa = e.fotos.find((m) => m.chave === e.capa) ?? null;
  const demais = e.fotos.filter((m) => m.chave !== e.capa);
  const paragrafos = useMemo(() => paragrafosDe(e.texto), [e.texto]);
  const sel = e.fotos.find((m) => m.chave === selecionada) ?? e.videos.find((m) => m.chave === selecionada) ?? null;
  const falta = (c: string) => faltam.includes(c);

  if (pastaInicial && !carregada) {
    return (
      <div className="space-y-3 py-10">
        <button type="button" onClick={() => voltar()} className="text-[13px] text-muted-foreground hover:text-foreground">← Notícias</button>
        {erroAoAbrir
          ? <p className="rounded-[14px] border border-destructive/40 bg-destructive/10 p-3 text-[13.5px] text-destructive">Não consegui abrir a notícia: {erroAoAbrir}</p>
          : <p className="flex items-center gap-2 text-[14px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Abrindo a notícia…</p>}
      </div>
    );
  }

  // A pasta existe, mas nunca foi lida (post.json quebrado ou leitura falhando): não abre como formulário em branco.
  if (carregada && !carregada.dados && pastaInicial) {
    return (
      <div className="space-y-4 py-6">
        <button type="button" onClick={() => voltar()} className="text-[13px] text-muted-foreground hover:text-foreground">← Notícias</button>
        <div className="space-y-2 rounded-[20px] border border-destructive/40 bg-destructive/10 p-4 text-[14px] text-destructive">
          <p><b>Esta notícia ainda não pôde ser lida do Drive.</b> {carregada.erro ?? 'A leitura está em andamento; tente de novo em 2 minutos.'}</p>
          <p className="text-[13px]">Pasta: Setor Marketing › Blog ANA Brasil › … › {carregada.pasta_nome}. Corrija o post.json lá ou exclua a notícia.</p>
        </div>
        <Button variant="outline" className="gap-1.5 text-destructive" onClick={() => setPerguntaExcluir(true)} disabled={travado}><Trash2 className="h-4 w-4" />Excluir notícia</Button>
        <DialogoExcluir aberto={perguntaExcluir} setAberto={setPerguntaExcluir} ocupado={ocupado === 'excluir'} excluir={excluir} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Caminho" className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <button type="button" onClick={pedirSaida} className="hover:text-foreground">Notícias</button>
          <ChevronRight className="h-4 w-4" />
          <b className="text-foreground">{pastaId ? 'Editar notícia' : 'Nova notícia'}</b>
          {pastaId && <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', publicada ? 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]' : 'bg-foreground text-background')}>{publicada ? 'No site' : 'Rascunho'}</span>}
        </nav>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-1.5 lg:hidden" onClick={() => previa.current?.scrollIntoView({ behavior: 'smooth' })}><Eye className="h-4 w-4" />Ver como o site mostra</Button>
          <Button variant="outline" disabled={travado || enviando || bloqueadoPelaLeitura} onClick={() => salvar(false)}>
            {ocupado === 'rascunho' && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}{publicada ? 'Tirar do site' : 'Salvar rascunho'}
          </Button>
          <Button className="gap-1.5" disabled={travado || enviando || bloqueadoPelaLeitura} onClick={() => salvar(true)}>
            {ocupado === 'publicar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{publicada ? 'Salvar' : 'Publicar'}
          </Button>
        </div>
      </div>

      {copia && (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-[14px] border border-border bg-card p-3 text-[13.5px] text-foreground">
          <History className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1">Há mudanças desta notícia que não foram salvas ({quando(copia.em)}).</span>
          <Button size="sm" onClick={recuperar} disabled={travado || bloqueadoPelaLeitura}>Recuperar</Button>
          <Button size="sm" variant="ghost" onClick={descartarCopia} disabled={travado}>Descartar</Button>
        </div>
      )}
      {carregada?.lendo && !salvouAqui && (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-[14px] border border-border bg-card p-3 text-[13.5px] text-foreground">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
          <span className="min-w-0 flex-1">O Drive ainda está sendo relido para esta notícia (até 2 minutos). Recarregue antes de editar, para não salvar por cima da versão nova.</span>
          <Button size="sm" variant="outline" onClick={recarregar} disabled={travado}>Recarregar</Button>
        </div>
      )}
      {carregada?.erro && <p className="rounded-[14px] border border-destructive/40 bg-destructive/10 p-3 text-[13.5px] text-destructive">A última leitura desta notícia no Drive falhou: {carregada.erro}. O site mostra a versão anterior.</p>}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
        {/* Com a releitura pendente, nada se edita (nem envia) até recarregar: o que está aqui pode não ser o último salvo. */}
        <fieldset disabled={travado || bloqueadoPelaLeitura} className="min-w-0 space-y-4">
          <section className="space-y-3 rounded-[20px] border border-border/60 bg-card p-4">
            <label className="block space-y-1">
              <Rotulo>Título</Rotulo>
              <input value={e.titulo} onChange={(x) => mudar({ titulo: x.target.value })} maxLength={200} className={cn(campo, falta('o título') && 'border-destructive')} placeholder="Ex.: Oficina de Natal reúne as famílias no ANA Dic" />
            </label>
            <div className="grid gap-3 sm:grid-cols-[1fr_120px_1fr]">
              <label className="block space-y-1">
                <Rotulo>Data</Rotulo>
                <input type="date" value={e.data} onChange={(x) => mudar({ data: x.target.value })} className={cn(campo, falta('a data') && 'border-destructive')} />
              </label>
              <label className="block space-y-1">
                <Rotulo>Hora</Rotulo>
                <input type="time" value={e.hora} onChange={(x) => mudar({ hora: x.target.value })} className={cn(campo, falta('a hora') && 'border-destructive')} />
              </label>
              <label className="block space-y-1">
                <Rotulo>Unidade</Rotulo>
                <select value={e.unidade} onChange={(x) => mudar({ unidade: x.target.value, extras: e.extras.filter((u) => u !== x.target.value) })} className={cn(campo, 'h-[46px]', falta('a unidade') && 'border-destructive')}>
                  <option value="">Escolha…</option>
                  {unidadesParaOEditor([e.unidade]).map((u) => <option key={u.slug} value={u.slug}>{u.nome}</option>)}
                </select>
              </label>
            </div>
            {e.unidade && (
              <div className="space-y-1">
                <span className="text-[12.5px] text-muted-foreground">Também aparece em:</span>
                <div className="flex flex-wrap gap-1.5">
                  {unidadesParaOEditor(e.extras).filter((u) => u.slug !== e.unidade).map((u) => {
                    const ligada = e.extras.includes(u.slug);
                    return (
                      <button key={u.slug} type="button" aria-pressed={ligada} onClick={() => mudar({ extras: ligada ? e.extras.filter((x) => x !== u.slug) : [...e.extras, u.slug] })}
                        className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px]', ligada ? 'bg-foreground font-semibold text-background' : 'border border-border bg-background text-foreground/80')}>
                        <span className="h-2 w-2 rounded-full" style={{ background: COR_DA_UNIDADE[u.slug] ?? '#ccc' }} />{u.nome}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <label className="block space-y-1">
              <Rotulo>Texto</Rotulo>
              <textarea value={e.texto} onChange={(x) => mudar({ texto: x.target.value })} rows={8} className={cn(campo, 'min-h-[160px] leading-relaxed', falta('o texto') && 'border-destructive')} />
              <span className="block text-[12px] text-muted-foreground">Uma linha em branco separa os parágrafos. Sem formatação: o site cuida da aparência.</span>
            </label>
          </section>

          <section
            onDragOver={(x) => { if (x.dataTransfer.types.includes('Files')) { x.preventDefault(); setSoltando(true); } }}
            onDragLeave={(x) => { if (!x.currentTarget.contains(x.relatedTarget as Node | null)) setSoltando(false); }}
            onDrop={(x) => { if (!x.dataTransfer.files.length) return; x.preventDefault(); setSoltando(false); void adicionar([...x.dataTransfer.files]); }}
            className={cn('space-y-3 rounded-[20px] border border-border/60 bg-card p-4', falta('a capa') && 'border-destructive', soltando && 'border-foreground ring-2 ring-ring')}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <b className="text-[15px] text-foreground">Fotos e vídeos <span className="font-normal text-muted-foreground">· {e.fotos.length} foto{e.fotos.length === 1 ? '' : 's'}{e.videos.length ? ` · ${e.videos.length} vídeo${e.videos.length > 1 ? 's' : ''}` : ''}</span></b>
              <span className="text-[12px] text-muted-foreground">Arraste ou use as setas para mudar a ordem · <Star className="inline h-3.5 w-3.5 fill-[#fbce00] text-[#fbce00]" /> é a capa</span>
            </div>
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-5">
              {e.fotos.map((f, i) => (
                <li key={f.chave} draggable={!travado} onDragStart={() => setArrastando(f.chave)} onDragEnd={() => setArrastando(null)} onDragOver={(x) => x.preventDefault()} onDrop={(x) => soltar(x, f.chave)}
                  className={cn('group relative overflow-hidden rounded-[12px] border-2 bg-muted', selecionada === f.chave ? 'border-foreground' : 'border-transparent', arrastando === f.chave && 'opacity-50')}>
                  <button type="button" onClick={() => setSelecionada(selecionada === f.chave ? null : f.chave)} className="block w-full" aria-label={`Foto ${i + 1}${f.chave === e.capa ? ' (capa)' : ''}: escrever a descrição`}>
                    <img src={f.mini} alt={e.descricoes[f.chave] ?? ''} loading="lazy" className="aspect-square w-full object-cover" />
                  </button>
                  <button type="button" onClick={() => mudar({ capa: f.chave })} title={f.chave === e.capa ? 'É a capa' : 'Usar como capa'} aria-label={f.chave === e.capa ? 'É a capa' : `Usar a foto ${i + 1} como capa`} aria-pressed={f.chave === e.capa}
                    className={cn('absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full', f.chave === e.capa ? 'bg-white/90' : 'bg-white/75 opacity-80 hover:opacity-100')}>
                    <Star className={cn('h-4 w-4', f.chave === e.capa ? 'fill-[#fbce00] text-[#fbce00]' : 'text-[#1f2322]')} />
                  </button>
                  <span className="absolute bottom-1 left-1 flex gap-1">
                    <button type="button" disabled={i === 0} onClick={() => mover(f.chave, i - 1)} aria-label={`Passar a foto ${i + 1} para antes`} className="grid h-6 w-6 place-items-center rounded-full bg-white/85 text-[#1f2322] disabled:opacity-30"><ArrowLeft className="h-3.5 w-3.5" /></button>
                    <button type="button" disabled={i === e.fotos.length - 1} onClick={() => mover(f.chave, i + 1)} aria-label={`Passar a foto ${i + 1} para depois`} className="grid h-6 w-6 place-items-center rounded-full bg-white/85 text-[#1f2322] disabled:opacity-30"><ArrowRight className="h-3.5 w-3.5" /></button>
                  </span>
                  <button type="button" onClick={() => retirar(f.chave)} aria-label={`Retirar a foto ${i + 1}`} className="absolute bottom-1 right-1 grid h-6 w-6 place-items-center rounded-full bg-white/85 text-[#1f2322] hover:bg-white"><X className="h-3.5 w-3.5" /></button>
                </li>
              ))}
            </ul>
            {e.videos.length > 0 && (
              <div className="space-y-2">
                {e.videos.map((v) => (
                  <div key={v.chave} className={cn('flex items-center gap-3 rounded-[12px] border px-3 py-2 text-[13px]', selecionada === v.chave ? 'border-foreground' : 'border-border')}>
                    <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[8px] bg-muted">
                      <img src={v.mini} alt="" className="h-full w-full object-cover" onError={(x) => { (x.target as HTMLImageElement).style.visibility = 'hidden'; }} />
                      <Video className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow" />
                    </span>
                    <button type="button" onClick={() => setSelecionada(selecionada === v.chave ? null : v.chave)} className="min-w-0 flex-1 truncate text-left text-foreground">
                      {v.nome}{v.duracao ? <span className="text-muted-foreground"> · {Math.floor(v.duracao / 60)}:{String(v.duracao % 60).padStart(2, '0')}</span> : null}
                    </button>
                    <button type="button" onClick={() => retirar(v.chave)} aria-label={`Retirar o vídeo ${v.nome}`} className="grid h-7 w-7 place-items-center rounded-full hover:bg-muted"><X className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
            )}
            <button type="button" onClick={() => entrada.current?.click()} disabled={enviando}
              className={cn('flex w-full items-center justify-center gap-3 rounded-[12px] border-2 border-dashed px-3 py-5 text-center text-[13px] text-muted-foreground hover:border-foreground/40 hover:text-foreground disabled:opacity-60', soltando ? 'border-foreground text-foreground' : 'border-border')}>
              <Upload className="h-5 w-5 shrink-0" />
              <span>{enviando ? 'Enviando…' : <><b className="font-semibold text-foreground">Adicionar fotos e vídeos</b><br />clique para escolher ou arraste os arquivos para cá</>}</span>
            </button>
            <input ref={entrada} type="file" accept="image/*,video/*,.heic,.heif" multiple hidden aria-label="Adicionar fotos e vídeos"
              onChange={(x) => { const fs = [...(x.target.files ?? [])]; x.target.value = ''; void adicionar(fs); }} />
            {sel && (
              <label className="block rounded-[12px] bg-muted/50 p-3 text-[13px] text-foreground">
                <b>{sel.tipo === 'video' ? 'Vídeo' : `Foto ${e.fotos.indexOf(sel) + 1}`} selecionad{sel.tipo === 'video' ? 'o' : 'a'}</b> · descrição para leitor de tela
                <input value={e.descricoes[sel.chave] ?? ''} maxLength={300} onChange={(x) => mudar({ descricoes: { ...e.descricoes, [sel.chave]: x.target.value } })}
                  placeholder="Ex.: Crianças do ANA Dic brincando no pátio" className={cn(campo, 'mt-1.5 py-2 text-[13.5px]')} />
              </label>
            )}
            {!e.fotos.length && <p className="text-[12.5px] text-muted-foreground">Para publicar, a notícia precisa de pelo menos uma foto (a capa).</p>}
          </section>

          {(envios.length > 0 || ocupado === 'concluindo' || ocupado === 'criando') && (
            <section aria-live="polite" className="space-y-2 rounded-[20px] border border-border/60 bg-card p-4 text-[13px]">
              <b className="text-[14px] text-foreground">{ocupado === 'criando' ? 'Criando a pasta da notícia no Drive…' : ocupado === 'concluindo' ? 'Conferindo os arquivos no Drive…' : 'Enviando para o Drive'}</b>
              {envios.map((x) => (
                <div key={x.id} className="space-y-1">
                  <div className="flex justify-between gap-2"><span className="truncate text-foreground">{x.nome}</span><span className={x.erro ? 'text-destructive' : 'text-muted-foreground'}>{x.erro ? 'falhou' : `${Math.round(x.progresso * 100)}%`}</span></div>
                  {x.erro ? <p className="text-[12px] text-destructive">{x.erro}</p> : <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${x.progresso * 100}%` }} /></div>}
                </div>
              ))}
              {!enviando && envios.length > 0 && <button type="button" onClick={() => setEnvios([])} className="text-[12px] text-muted-foreground underline">Limpar</button>}
            </section>
          )}

          <section className="space-y-2 rounded-[20px] border border-border/60 bg-card p-4 text-[13.5px]">
            <label className="flex items-center justify-between gap-3">
              <span><b className="text-foreground">Aparece na lista de notícias do site</b><br /><span className="text-[12.5px] text-muted-foreground">Desligado, o post só abre pelo link direto.</span></span>
              <Switch checked={e.na_lista} onCheckedChange={(v) => mudar({ na_lista: v })} />
            </label>
            <label className="flex items-center justify-between gap-3 border-t border-border/60 pt-2">
              <span><b className="text-foreground">Destaque (manchete)</b><br /><span className="text-[12.5px] text-muted-foreground">Fica no topo da página de notícias. Com mais de um, vale o mais recente.</span></span>
              <Switch checked={e.fixada} onCheckedChange={(v) => mudar({ fixada: v })} />
            </label>
            {e.unidade && e.data && (
              <p className="flex items-start gap-1.5 border-t border-border/60 pt-2 text-[12.5px] text-muted-foreground">
                <Folder className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="min-w-0 break-words">Arquivos no Drive: Setor Marketing › Blog ANA Brasil › {nomeDaUnidade(e.unidade)} › {e.data.slice(0, 4)} › {e.data} — {e.titulo.trim() || '(título)'}</span>
              </p>
            )}
            {pastaId && (
              <div className="border-t border-border/60 pt-2">
                <Button variant="ghost" className="h-8 gap-1.5 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setPerguntaExcluir(true)} disabled={travado || enviando}>
                  <Trash2 className="h-4 w-4" />Excluir notícia
                </Button>
              </div>
            )}
          </section>
        </fieldset>

        <aside ref={previa} className="min-w-0 space-y-2 lg:sticky lg:top-4 lg:self-start">
          <p className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Como o site mostra</p>
          <div className="overflow-hidden rounded-[20px] border border-black/5 bg-white text-[#1f2322] shadow-sm">
            {capa ? <img src={capa.tela} alt={e.descricoes[capa.chave] ?? ''} className="aspect-[4/3] w-full object-cover" /> : <div className="grid aspect-[4/3] place-items-center bg-[#eef0ee] text-[#777]"><ImageIcon className="h-7 w-7" /></div>}
            <div className="space-y-2 p-4">
              <div className="flex items-center gap-2 text-[12px] text-[#555]"><EtiquetaDaUnidade slug={e.unidade || null} className="bg-[#f3f4f2] shadow-none" />{dataBR(e.data)}</div>
              <h2 className="font-display text-[20px] font-semibold leading-tight">{e.titulo.trim() || 'Título da notícia'}</h2>
              {paragrafos.length ? paragrafos.map((t, i) => <p key={i} className="text-[14px] leading-relaxed">{t}</p>) : <p className="text-[14px] text-[#777]">O texto aparece aqui.</p>}
              {demais.length > 0 && <div className="grid grid-cols-3 gap-1.5 pt-1">{demais.slice(0, 6).map((f) => <img key={f.chave} src={f.mini} alt="" className="aspect-square w-full rounded-[8px] object-cover" />)}</div>}
              {demais.length > 6 && <p className="text-center text-[12px] text-[#777]">+ {demais.length - 6} fotos</p>}
              {e.videos.length > 0 && <p className="flex items-center justify-center gap-1 text-[12px] text-[#777]"><Video className="h-3.5 w-3.5" />{e.videos.length} vídeo{e.videos.length > 1 ? 's' : ''}</p>}
            </div>
          </div>
          <p className="text-[12px] text-muted-foreground">Para publicar: título, data, unidade, texto e a capa. Fotos e vídeos enviados só entram no site depois de salvar. A descrição das fotos ajuda quem usa leitor de tela e o Google.</p>
        </aside>
      </div>

      <AlertDialog open={!!sair} onOpenChange={(v) => { if (!v) setSair(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair sem salvar?</AlertDialogTitle>
            <AlertDialogDescription>
              {enviando ? 'Ainda há arquivos indo para o Drive; saindo agora, eles podem ficar pela metade.' : 'As mudanças desta notícia ainda não foram salvas. Fotos e vídeos já enviados ficam guardados no Drive, fora do site, para a próxima vez.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction onClick={sairSemSalvar}>Sair sem salvar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <DialogoExcluir aberto={perguntaExcluir} setAberto={setPerguntaExcluir} ocupado={ocupado === 'excluir'} excluir={excluir} />
    </div>
  );
}

function DialogoExcluir({ aberto, setAberto, ocupado, excluir }: { aberto: boolean; setAberto: (v: boolean) => void; ocupado: boolean; excluir: () => Promise<void> }) {
  return (
    <AlertDialog open={aberto} onOpenChange={setAberto}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir esta notícia?</AlertDialogTitle>
          <AlertDialogDescription>Ela sai do site na hora. A pasta com o texto, as fotos e os vídeos vai para a lixeira do Drive e pode ser recuperada por 30 dias.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={(x) => { x.preventDefault(); void excluir(); }} disabled={ocupado} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {ocupado && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
