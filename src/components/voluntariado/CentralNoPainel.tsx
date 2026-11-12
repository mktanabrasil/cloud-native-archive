import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BellRing, CalendarPlus, ExternalLink, Megaphone, Pencil, ScanLine, Trash2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { centralNoFormulario, type Inscricao } from '@/lib/voluntariado/api';
import {
  CAMINHO_DA_CENTRAL, CAMINHO_DA_PRESENCA, DIA_DO_NATAL_FELIZ, DIA_DO_TREINAMENTO, ORIGEM_DO_APP, ROTULO_DO_TIPO, apagarAviso, apagarItem, criarAviso,
  adicionarGestor, celularesComAvisos, definirCentralNoFormulario, diaCurto, ePara, horaCurta, listarAvisos, listarCronograma, listarGestores,
  listarPresencas, removerGestor, salvarItem, whatsappMascarado, type Gestor,
  type AvisoDoPainel, type ItemDoPainel, type NovoItem, type Presenca, type TipoDoItem,
} from '@/lib/voluntariado/central';
import { AREAS_DE_AJUDA, AREAS_FORA_DO_FORMULARIO, HORARIOS, mascaraDoWhatsapp, rotuloDaAjuda, rotuloDoHorario } from '@/lib/voluntariado/modelo';

/**
 * A Central do Voluntário no painel do Marketing (13/11/2026): o link, quem
 * já ligou os avisos e quem já teve a presença registrada; o cronograma (cada
 * item pode avisar no celular X minutos antes); e os avisos avulsos, na hora
 * ou agendados. Desde 12/11/2026, a pedido dele: o interruptor do botão da
 * Central no formulário (escondido até o treinamento) e os gestores, que
 * entram na Central pelo número, sem inscrição, e recebem todos os avisos.
 */

export const LINK_DA_CENTRAL = `${ORIGEM_DO_APP}${CAMINHO_DA_CENTRAL}`;

const AREAS = AREAS_DE_AJUDA.filter((a) => !AREAS_FORA_DO_FORMULARIO.includes(a.chave));
const TURNOS = HORARIOS.filter((h) => ['manha', 'tarde', 'pos_evento', 'dia_todo'].includes(h.chave));
const AVISAR: Array<[number | null, string]> = [[null, 'Sem aviso'], [0, 'Na hora'], [15, '15 min antes'], [30, '30 min antes'], [60, '1 h antes']];
const TIPOS = Object.keys(ROTULO_DO_TIPO) as TipoDoItem[];

const paraQuem = (areas: string[], horarios: string[]) => {
  const a = areas.length ? areas.map((k) => rotuloDaAjuda(k)).join(', ') : 'todas as áreas';
  const h = horarios.length ? horarios.map((k) => rotuloDoHorario(k)).join(', ') : 'todos os turnos';
  return areas.length || horarios.length ? `${a} · ${h}` : 'Todos';
};
const dataEHora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ' às');

/** Botões de escolha (vários ou um), no desenho de "Botões de seleção" do kit. */
function Escolhas<T extends string | number | null>({ opcoes, marcadas, aoTocar, rotulo }: { opcoes: Array<[T, string]>; marcadas: T[]; aoTocar: (v: T) => void; rotulo: string }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={rotulo}>
      {opcoes.map(([v, r]) => {
        const on = marcadas.includes(v);
        return (
          <button key={String(v)} type="button" aria-pressed={on} onClick={() => aoTocar(v)}
            className={cn('rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-colors',
              on ? 'border-transparent bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:text-foreground')}>
            {r}
          </button>
        );
      })}
    </div>
  );
}
const alternar = <T,>(l: T[], v: T) => (l.includes(v) ? l.filter((x) => x !== v) : [...l, v]);

/** Um campo com rótulo; os de botões de escolha são um grupo, não um label. */
function Campo({ rotulo, children, dica, grupo = false }: { rotulo: string; children: React.ReactNode; dica?: string; grupo?: boolean }) {
  const Tag = grupo ? 'div' : 'label';
  return (
    <Tag className="flex flex-col gap-1.5 text-sm">
      <span className="font-semibold">{rotulo}</span>
      {children}
      {dica && <span className="text-xs text-muted-foreground">{dica}</span>}
    </Tag>
  );
}

// --- O item do cronograma ---------------------------------------------------------------------

const ITEM_VAZIO: NovoItem = { dia: DIA_DO_NATAL_FELIZ, inicio: '', fim: null, titulo: '', tipo: 'atividade', local: null, detalhe: null, areas: [], horarios: [], avisar_min: null, aviso_texto: null };

function FormDoItem({ item, aoFechar, aoSalvar }: { item: ItemDoPainel | 'novo'; aoFechar: () => void; aoSalvar: () => void }) {
  const [f, setF] = useState<NovoItem>(() => (item === 'novo' ? ITEM_VAZIO : { ...item }));
  const [salvando, setSalvando] = useState(false);
  const muda = (p: Partial<NovoItem>) => setF((x) => ({ ...x, ...p }));
  const outroDia = f.dia !== DIA_DO_TREINAMENTO && f.dia !== DIA_DO_NATAL_FELIZ;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!f.dia || !/^\d{2}:\d{2}$/.test(f.inicio) || f.titulo.trim().length < 2) { toast.error('Preencha o dia, o início e o título.'); return; }
    if (f.fim && f.fim <= f.inicio) { toast.error('O fim precisa ser depois do início.'); return; }
    setSalvando(true);
    try { await salvarItem({ ...f, titulo: f.titulo.trim() }, item === 'novo' ? undefined : item.id); toast.success('Cronograma salvo.'); aoSalvar(); aoFechar(); }
    catch { toast.error('Não deu para salvar. Confira os campos e tente de novo.'); }
    finally { setSalvando(false); }
  }
  async function apagar() {
    if (item === 'novo') return;
    setSalvando(true);
    try { await apagarItem(item.id); toast.success('Item apagado.'); aoSalvar(); aoFechar(); }
    catch { toast.error('Não deu para apagar. Tente de novo.'); }
    finally { setSalvando(false); }
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) aoFechar(); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{item === 'novo' ? 'Novo item do cronograma' : 'Editar item do cronograma'}</DialogTitle>
          <DialogDescription>Aparece na aba Cronograma da Central. Com aviso, o celular de quem ligou os avisos recebe o lembrete.</DialogDescription>
        </DialogHeader>
        <form id="form-do-item" onSubmit={salvar} className="flex flex-col gap-4">
          <Campo rotulo="Dia" grupo>
            <Escolhas rotulo="Dia" marcadas={[outroDia ? 'outro' : f.dia]}
              opcoes={[[DIA_DO_TREINAMENTO, `Treinamento · ${diaCurto(DIA_DO_TREINAMENTO)}`], [DIA_DO_NATAL_FELIZ, `Natal Feliz · ${diaCurto(DIA_DO_NATAL_FELIZ)}`], ['outro', 'Outro dia']]}
              aoTocar={(v) => muda({ dia: v === 'outro' ? '' : v })} />
            {outroDia && <Input type="date" aria-label="Outro dia" value={f.dia} onChange={(e) => muda({ dia: e.target.value })} className="mt-1 w-48" />}
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Início"><Input type="time" value={f.inicio} onChange={(e) => muda({ inicio: e.target.value })} /></Campo>
            <Campo rotulo="Fim (opcional)"><Input type="time" value={f.fim ?? ''} onChange={(e) => muda({ fim: e.target.value || null })} /></Campo>
          </div>
          <Campo rotulo="Título"><Input value={f.titulo} maxLength={80} onChange={(e) => muda({ titulo: e.target.value })} placeholder="Ex.: Cozinha: café da manhã e almoço" /></Campo>
          <Campo rotulo="Tipo" grupo><Escolhas rotulo="Tipo" marcadas={[f.tipo]} opcoes={TIPOS.map((t) => [t, ROTULO_DO_TIPO[t]])} aoTocar={(t) => muda({ tipo: t })} /></Campo>
          <Campo rotulo="Local (opcional)"><Input value={f.local ?? ''} maxLength={60} onChange={(e) => muda({ local: e.target.value })} placeholder="Ex.: Cozinha, Entrada, Auditório" /></Campo>
          <Campo rotulo="Detalhe (opcional)"><Textarea value={f.detalhe ?? ''} maxLength={240} rows={2} onChange={(e) => muda({ detalhe: e.target.value })} placeholder="O que levar, a quem procurar…" /></Campo>
          <Campo rotulo="Para quem" grupo dica="Nenhuma marcada = todas as áreas. Nenhum turno = todos. O Dia todo entra em todos os turnos.">
            <Escolhas rotulo="Áreas" marcadas={f.areas} opcoes={AREAS.map((a) => [a.chave, a.rotulo])} aoTocar={(a) => muda({ areas: alternar(f.areas, a) })} />
            <Escolhas rotulo="Turnos" marcadas={f.horarios} opcoes={TURNOS.map((h) => [h.chave, h.rotulo])} aoTocar={(h) => muda({ horarios: alternar(f.horarios, h) })} />
          </Campo>
          <Campo rotulo="Aviso no celular" grupo>
            <Escolhas rotulo="Aviso no celular" marcadas={[f.avisar_min]} opcoes={AVISAR} aoTocar={(m) => muda({ avisar_min: m })} />
            {f.avisar_min !== null && (
              <Input value={f.aviso_texto ?? ''} maxLength={160} onChange={(e) => muda({ aviso_texto: e.target.value })} className="mt-1"
                placeholder={`Texto do aviso (sem nada: "${f.avisar_min === 0 ? 'Começa agora' : `Começa às ${f.inicio ? horaCurta(f.inicio) : '…'}`}${f.local ? ` · ${f.local}` : ''}")`} aria-label="Texto do aviso" />
            )}
          </Campo>
        </form>
        <DialogFooter className="gap-2 sm:justify-between">
          {item !== 'novo' ? <Button type="button" variant="ghost" className="text-destructive" disabled={salvando} onClick={apagar}><Trash2 className="h-4 w-4" /> Apagar</Button> : <span />}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={aoFechar}>Cancelar</Button>
            <Button type="submit" form="form-do-item" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- O aviso avulso -----------------------------------------------------------------------

function FormDoAviso({ inscricoes, comAvisos, gestoresComAvisos, aoFechar, aoEnviar }: { inscricoes: Inscricao[]; comAvisos: Set<string>; gestoresComAvisos: number; aoFechar: () => void; aoEnviar: () => void }) {
  const [titulo, setTitulo] = useState('');
  const [texto, setTexto] = useState('');
  const [areas, setAreas] = useState<string[]>([]);
  const [horarios, setHorarios] = useState<string[]>([]);
  const [quando, setQuando] = useState<'agora' | 'agendar'>('agora');
  const [hora, setHora] = useState('');
  const [enviando, setEnviando] = useState(false);
  const alcance = inscricoes.filter((i) => comAvisos.has(i.id) && ePara(areas, horarios, i.opcao1, i.horario)).length + gestoresComAvisos;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (titulo.trim().length < 2 || texto.trim().length < 2) { toast.error('Escreva o título e o texto do aviso.'); return; }
    let enviarEm: string | null = null;
    if (quando === 'agendar') {
      if (!hora) { toast.error('Escolha o dia e a hora do envio.'); return; }
      const d = new Date(`${hora}:00-03:00`);
      if (d.getTime() < Date.now()) { toast.error('Escolha um horário no futuro.'); return; }
      enviarEm = d.toISOString();
    }
    setEnviando(true);
    try {
      await criarAviso({ titulo, texto, enviar_em: enviarEm, areas, horarios });
      toast.success(enviarEm ? 'Aviso agendado.' : 'Aviso enviado.');
      aoEnviar(); aoFechar();
    } catch { toast.error('Não deu para enviar. Tente de novo.'); }
    finally { setEnviando(false); }
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) aoFechar(); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Novo aviso</DialogTitle>
          <DialogDescription>Chega como notificação no celular de quem ligou os avisos, e fica no sino da Central.</DialogDescription>
        </DialogHeader>
        <form id="form-do-aviso" onSubmit={enviar} className="flex flex-col gap-4">
          <Campo rotulo="Título"><Input value={titulo} maxLength={80} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: É amanhã!" /></Campo>
          <Campo rotulo="Texto"><Textarea value={texto} maxLength={240} rows={3} onChange={(e) => setTexto(e.target.value)} placeholder="Ex.: Natal Feliz no Recanto Maanaim. Sua credencial está na Central." /></Campo>
          <Campo rotulo="Para quem" grupo dica="Nenhuma marcada = todas as áreas. Nenhum turno = todos.">
            <Escolhas rotulo="Áreas" marcadas={areas} opcoes={AREAS.map((a) => [a.chave, a.rotulo])} aoTocar={(a) => setAreas((l) => alternar(l, a))} />
            <Escolhas rotulo="Turnos" marcadas={horarios} opcoes={TURNOS.map((h) => [h.chave, h.rotulo])} aoTocar={(h) => setHorarios((l) => alternar(l, h))} />
          </Campo>
          <Campo rotulo="Quando" grupo>
            <Escolhas<'agora' | 'agendar'> rotulo="Quando" marcadas={[quando]} opcoes={[['agora', 'Agora'], ['agendar', 'Agendar']]} aoTocar={setQuando} />
            {quando === 'agendar' && <Input type="datetime-local" aria-label="Dia e hora do envio" value={hora} onChange={(e) => setHora(e.target.value)} className="mt-1 w-60" />}
          </Campo>
          <p className="rounded-[12px] bg-muted px-3 py-2 text-[13px]" data-testid="alcance">
            {alcance === 1 ? 'Vai para 1 pessoa com os avisos ligados.' : `Vai para ${alcance} pessoas com os avisos ligados.`} Também aparece no sino da Central para quem abrir.
          </p>
        </form>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={aoFechar}>Cancelar</Button>
          <Button type="submit" form="form-do-aviso" disabled={enviando}>{enviando ? 'Enviando…' : quando === 'agora' ? 'Enviar agora' : 'Agendar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Os gestores (12/11/2026) --------------------------------------------------------------

function GestoresDaCentral() {
  const [lista, setLista] = useState<Gestor[] | null>(null);
  const [nome, setNome] = useState('');
  const [tel, setTel] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [tirando, setTirando] = useState<Gestor | null>(null);
  const carregar = useCallback(() => { listarGestores().then(setLista).catch(() => setLista([])); }, []);
  useEffect(() => { carregar(); }, [carregar]);

  async function cadastrar(e: React.FormEvent) {
    e.preventDefault();
    const digitos = tel.replace(/\D/g, '');
    if (nome.trim().length < 2 || digitos.length < 10) { toast.error('Escreva o nome e o WhatsApp com DDD.'); return; }
    setSalvando(true);
    try { await adicionarGestor(nome, tel); toast.success(`${nome.trim().split(/\s+/)[0]} já entra na Central.`); setNome(''); setTel(''); carregar(); }
    catch (x) { toast.error((x as Error).message === 'ja_cadastrado' ? 'Esse WhatsApp já está na lista.' : 'Não deu para cadastrar. Tente de novo.'); }
    finally { setSalvando(false); }
  }
  async function tirar(g: Gestor) {
    try { await removerGestor(g.id); toast.success(`${g.nome} saiu da lista.`); carregar(); }
    catch { toast.error('Não deu para tirar. Tente de novo.'); }
    finally { setTirando(null); }
  }

  return (
    <div className="flex flex-col gap-2" data-testid="gestores-da-central">
      <div className="text-sm">
        <b className="block text-[14.5px] font-semibold">Gestores com acesso</b>
        <span className="text-muted-foreground">Entram na Central pelo WhatsApp, sem inscrição: veem o cronograma inteiro e recebem todos os avisos. Não contam como voluntários.</span>
      </div>
      {lista && lista.length > 0 && (
        <ul className="overflow-hidden rounded-[14px] border border-border" data-testid="lista-de-gestores">
          {lista.map((g) => (
            <li key={g.id} className="flex items-center gap-3 border-b border-border/70 px-3 py-2 text-sm last:border-b-0">
              <span className="min-w-0 flex-1 font-semibold">{g.nome}</span>
              <span className="tabular-nums text-muted-foreground">{whatsappMascarado(g.whatsapp)}</span>
              <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive" aria-label={`Tirar ${g.nome}`} onClick={() => setTirando(g)}><Trash2 className="h-4 w-4" /></Button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={cadastrar} className="flex flex-wrap items-center gap-2">
        <Input aria-label="Nome do gestor" placeholder="Nome" value={nome} maxLength={120} onChange={(e) => setNome(e.target.value)} className="h-10 min-w-0 flex-[1_1_200px]" />
        <Input aria-label="WhatsApp do gestor" placeholder="(19) 99999-9999" inputMode="numeric" value={tel} onChange={(e) => setTel(mascaraDoWhatsapp(e.target.value))} className="h-10 w-44" />
        <Button type="submit" size="sm" variant="outline" disabled={salvando}><UserPlus className="h-4 w-4" /> Cadastrar</Button>
      </form>
      <AlertDialog open={!!tirando} onOpenChange={(v) => { if (!v) setTirando(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tirar {tirando?.nome} da Central?</AlertDialogTitle>
            <AlertDialogDescription>O acesso pelo WhatsApp acaba e os avisos param de chegar no celular dessa pessoa.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => tirando && tirar(tirando)}>Tirar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// --- O bloco no painel -----------------------------------------------------------------------

export function CentralNoPainel({ inscricoes }: { inscricoes: Inscricao[] }) {
  const [itens, setItens] = useState<ItemDoPainel[] | null>(null);
  const [avisos, setAvisos] = useState<AvisoDoPainel[]>([]);
  const [presencas, setPresencas] = useState<Presenca[]>([]);
  const [comAvisos, setComAvisos] = useState<Set<string>>(new Set());
  const [gestoresComAvisos, setGestoresComAvisos] = useState(0);
  // O botão da Central no formulário (escondido até a comunicação ligar, 12/11/2026).
  const [noFormulario, setNoFormulario] = useState<boolean | null>(null);
  const [editando, setEditando] = useState<ItemDoPainel | 'novo' | null>(null);
  const [novoAviso, setNovoAviso] = useState(false);

  const carregar = useCallback(() => {
    listarCronograma().then(setItens).catch(() => setItens([]));
    listarAvisos().then(setAvisos).catch(() => { /* sem lista */ });
    listarPresencas().then(setPresencas).catch(() => { /* sem lista */ });
    celularesComAvisos().then((c) => { setComAvisos(c.voluntarios); setGestoresComAvisos(c.gestores); }).catch(() => { /* sem contagem */ });
    centralNoFormulario().then(setNoFormulario).catch(() => setNoFormulario(false));
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const presentes = (m: 'treinamento' | 'evento') => presencas.filter((p) => p.momento === m).length;
  const porDia = useMemo(() => {
    const m = new Map<string, ItemDoPainel[]>();
    (itens ?? []).forEach((i) => m.set(i.dia, [...(m.get(i.dia) ?? []), i]));
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [itens]);
  const naFila = avisos.filter((a) => !a.enviado_em).sort((a, b) => a.enviar_em.localeCompare(b.enviar_em));
  const enviados = avisos.filter((a) => a.enviado_em).slice(0, 12);

  async function copiarLink() {
    try { await navigator.clipboard.writeText(LINK_DA_CENTRAL); toast.success('Link da Central copiado.'); }
    catch { toast.message(LINK_DA_CENTRAL); }
  }
  async function alternarFormulario(ligar: boolean) {
    setNoFormulario(ligar);
    try { await definirCentralNoFormulario(ligar); toast.success(ligar ? 'O botão da Central apareceu no formulário.' : 'O botão da Central saiu do formulário.'); }
    catch { setNoFormulario(!ligar); toast.error('Não deu para mudar agora. Tente de novo.'); }
  }
  async function cancelarAviso(a: AvisoDoPainel) {
    try { await apagarAviso(a.id); setAvisos((l) => l.filter((x) => x.id !== a.id)); toast.success('Aviso cancelado.'); }
    catch { toast.error('Não deu para cancelar. Tente de novo.'); }
  }

  const numeros: Array<[string, string, string]> = [
    ['avisos', gestoresComAvisos ? `Com avisos ligados (+${gestoresComAvisos} ${gestoresComAvisos === 1 ? 'gestor' : 'gestores'})` : 'Com avisos ligados', String(comAvisos.size)],
    ['treinamento', `Presença · treinamento ${DIA_DO_TREINAMENTO.slice(8)}/${DIA_DO_TREINAMENTO.slice(5, 7)}`, `${presentes('treinamento')} de ${inscricoes.length}`],
    ['evento', `Presença · Natal Feliz ${DIA_DO_NATAL_FELIZ.slice(8)}/${DIA_DO_NATAL_FELIZ.slice(5, 7)}`, `${presentes('evento')} de ${inscricoes.length}`],
  ];

  return (
    <section className="flex flex-col gap-3 rounded-[20px] border border-black/5 bg-card p-4 dark:border-white/5" aria-label="Central do Voluntário" data-testid="central-no-painel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="text-sm">
          <b className="block text-[15px] font-semibold">Central do Voluntário</b>
          <span className="text-muted-foreground">Cada voluntário entra com o WhatsApp da inscrição: cronograma, local e avisos.</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={copiarLink}>Copiar link da Central</Button>
          <Button variant="outline" size="sm" asChild><a href={CAMINHO_DA_CENTRAL} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /> Abrir</a></Button>
          <Button size="sm" asChild><Link to={CAMINHO_DA_PRESENCA}><ScanLine className="h-4 w-4" /> Registrar presença</Link></Button>
        </div>
      </div>

      <label className="flex items-center justify-between gap-4 rounded-[14px] bg-muted/60 px-3.5 py-3 text-sm" data-testid="central-no-formulario">
        <span>
          <b className="block text-[14px] font-semibold">Botão da Central no formulário</b>
          <span className="text-muted-foreground">{noFormulario ? 'Aparece depois da inscrição e no começo do formulário.' : 'Escondido. Ligue no dia do treinamento (28/11), para a galera ir entrando.'}</span>
        </span>
        <Switch checked={!!noFormulario} disabled={noFormulario === null} onCheckedChange={alternarFormulario} aria-label="Mostrar o botão da Central no formulário" />
      </label>

      <div className="grid gap-2 sm:grid-cols-3">
        {numeros.map(([k, r, v]) => (
          <div key={k} className="rounded-[14px] bg-muted/60 px-3.5 py-2.5" data-testid={`central-${k}`}>
            <b className="block text-xl font-bold tabular-nums" style={{ fontFamily: 'Poppins, sans-serif' }}>{v}</b>
            <span className="text-[12.5px] text-muted-foreground">{r}</span>
          </div>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <b className="text-[14.5px] font-semibold">Cronograma</b>
        <Button size="sm" variant="outline" onClick={() => setEditando('novo')}><CalendarPlus className="h-4 w-4" /> Adicionar item</Button>
      </div>
      {itens === null ? <p className="text-sm text-muted-foreground">Carregando…</p> : porDia.length === 0 ? (
        <p className="rounded-[14px] border border-dashed border-border p-4 text-sm text-muted-foreground">Nenhum item ainda. A aba Cronograma da Central mostra "está sendo montado" até o primeiro.</p>
      ) : (
        <div className="flex flex-col gap-3" data-testid="cronograma-do-painel">
          {porDia.map(([dia, l]) => (
            <div key={dia} className="flex flex-col gap-1">
              <span className="text-[12.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{diaCurto(dia)}{dia === DIA_DO_TREINAMENTO ? ' · Treinamento' : dia === DIA_DO_NATAL_FELIZ ? ' · Natal Feliz' : ''}</span>
              <ul className="overflow-hidden rounded-[14px] border border-border">
                {l.map((i) => (
                  <li key={i.id} className="flex items-center gap-3 border-b border-border/70 px-3 py-2 text-sm last:border-b-0">
                    <b className="w-[92px] shrink-0 tabular-nums">{i.inicio}{i.fim ? `–${i.fim}` : ''}</b>
                    <span className="min-w-0 flex-1">
                      <span className="font-semibold">{i.titulo}</span>
                      <span className="block truncate text-xs text-muted-foreground">{ROTULO_DO_TIPO[i.tipo]}{i.local ? ` · ${i.local}` : ''} · {paraQuem(i.areas, i.horarios)}</span>
                    </span>
                    {i.avisar_min !== null && <span className="hidden shrink-0 items-center gap-1 text-xs text-muted-foreground sm:inline-flex" title="Avisa no celular"><BellRing className="h-3.5 w-3.5" />{i.avisar_min === 0 ? 'na hora' : `${i.avisar_min} min antes`}</span>}
                    <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label={`Editar ${i.titulo}`} onClick={() => setEditando(i)}><Pencil className="h-4 w-4" /></Button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <b className="text-[14.5px] font-semibold">Avisos</b>
        <Button size="sm" onClick={() => setNovoAviso(true)}><Megaphone className="h-4 w-4" /> Novo aviso</Button>
      </div>
      {naFila.length + enviados.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum aviso ainda. Os do cronograma entram na fila sozinhos.</p>
      ) : (
        <ul className="flex flex-col gap-1.5 text-sm" data-testid="avisos-do-painel">
          {naFila.map((a) => (
            <li key={a.id} className="flex items-center gap-3 rounded-[12px] bg-muted/50 px-3 py-2">
              <span className="min-w-0 flex-1"><b>{a.titulo}</b> <span className="text-muted-foreground">· {a.texto}</span>
                <span className="block text-xs text-muted-foreground">Sai {dataEHora(a.enviar_em)} · {paraQuem(a.areas, a.horarios)}{a.cronograma_id ? ' · do cronograma' : ''}</span></span>
              {!a.cronograma_id && <Button variant="ghost" size="sm" onClick={() => cancelarAviso(a)}>Cancelar</Button>}
            </li>
          ))}
          {enviados.map((a) => (
            <li key={a.id} className="flex items-center gap-3 rounded-[12px] px-3 py-2">
              <span className="min-w-0 flex-1"><b>{a.titulo}</b> <span className="text-muted-foreground">· {a.texto}</span>
                <span className="block text-xs text-muted-foreground">
                  {a.pulado ? `Não saiu: passou da hora (${dataEHora(a.enviar_em)})` : `Enviado ${dataEHora(a.enviado_em!)} · ${a.entregues} ${a.entregues === 1 ? 'celular' : 'celulares'}${a.falhas ? ` · ${a.falhas} com falha` : ''}`}
                </span></span>
            </li>
          ))}
        </ul>
      )}

      {editando && <FormDoItem item={editando} aoFechar={() => setEditando(null)} aoSalvar={carregar} />}
      <div className="mt-2 border-t border-border pt-3"><GestoresDaCentral /></div>

      {novoAviso && <FormDoAviso inscricoes={inscricoes} comAvisos={comAvisos} gestoresComAvisos={gestoresComAvisos} aoFechar={() => setNovoAviso(false)} aoEnviar={carregar} />}
    </section>
  );
}
