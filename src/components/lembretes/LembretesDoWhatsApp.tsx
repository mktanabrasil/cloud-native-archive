import { useCallback, useEffect, useState } from 'react';
import { Check, Clock, Image as ImageIcon, Loader2, Pencil, Send, Smartphone, Users, X, CalendarDays, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { enviarLembrete, estadoDoLembrete, ligarLembrete, salvarTextoDoLembrete, type EnvioDoLembrete, type EstadoDoLembrete } from '@/lib/lembretes/api';
import {
  CORES, DIAS_DO_LEMBRETE, HEX_DA_COR, HORA_DO_LEMBRETE, LEGENDA_DO_COMO_ENVIAR, MODELO_PADRAO, NOME_DA_COR, NOMES_DOS_DIAS, arteDoComoEnviar, arteDoLembrete,
  corDoComoEnviar, corDoDia, diaDaSemana, ehDiaDoLembrete, hojeEmBrasilia, pecasDoDia,
} from '../../../supabase/functions/lembrete-registros/regras';

/**
 * Marketing › Lembretes (24/11/2026, mockup aprovado): o lembrete diário dos
 * registros das unidades no grupo ANABRASIL PUBLICAÇÕES, de segunda a sexta às
 * 10h, pela função `lembrete-registros` (o mesmo WhatsApp da MKT do ranking
 * da Pizza). À esquerda, como chega no grupo; à direita, o envio automático
 * (nasce desligado), a arte de cada dia, editar a mensagem, o teste para a
 * conversa "Mensagens para mim", o envio na hora e os últimos envios.
 */

const ARTES = '/lembretes';
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const diaPorExtenso = (iso: string) => `${['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][diaDaSemana(iso)]}, ${ddmm(iso)}`;
const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '').replace('.', '');

/** Negrito do WhatsApp (*assim*) para a prévia. */
function TextoDoZap({ texto }: { texto: string }) {
  return (
    <>
      {texto.split('\n').map((l, i) => (
        <span key={i} className="block min-h-[1.1em] whitespace-pre-wrap">
          {l.split(/(\*[^*\n]+\*)/).map((p, k) => (p.length > 2 && p.startsWith('*') && p.endsWith('*') ? <b key={k}>{p.slice(1, -1)}</b> : <span key={k}>{p}</span>))}
        </span>
      ))}
    </>
  );
}

/** Como chega no grupo: as peças do dia, na ordem. */
function Previa({ dia, mensagem, modelo, grupo }: { dia: string; mensagem: string; modelo: string; grupo: string }) {
  const pecas = pecasDoDia(dia, mensagem, modelo);
  return (
    <div className="rounded-[18px] bg-[#efe7dd] p-3 text-[#111] dark:bg-[#1d2622] dark:text-[#e8ede9]" aria-label="Prévia no WhatsApp" data-testid="previa-do-lembrete">
      <div className="mb-2 flex items-center gap-2 rounded-[12px] bg-white/85 px-3 py-2 text-[12.5px] dark:bg-white/10">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-[#81e2cf] text-[#1f2322]"><Users className="h-4 w-4" /></span>
        <b className="truncate">{grupo}</b>
        <span className="ml-auto shrink-0 text-muted-foreground">{diaPorExtenso(dia)}, {HORA_DO_LEMBRETE}:00</span>
      </div>
      <div className="space-y-2">
        {pecas.map((p, i) => (p.tipo === 'imagem' ? (
          <div key={i} className="max-w-[460px] rounded-[12px] bg-white p-1.5 shadow-sm dark:bg-[#26312c]">
            <img src={`${ARTES}/${p.arquivo}`} alt={p.legenda === LEGENDA_DO_COMO_ENVIAR ? 'Arte "Como enviar os registros"' : 'Arte do lembrete'} className="w-full rounded-[9px]" loading="lazy" />
            <div className="px-2 pb-1 pt-2 text-[12.5px] leading-snug"><TextoDoZap texto={p.legenda} /></div>
          </div>
        ) : (
          <div key={i} className="max-w-[320px] rounded-[12px] bg-white px-3 py-2 text-[12.5px] leading-snug shadow-sm dark:bg-[#26312c]"><TextoDoZap texto={p.texto} /></div>
        )))}
      </div>
    </div>
  );
}

const SITUACAO: Record<EnvioDoLembrete['situacao'], { Icone: typeof Check; cor: string }> = {
  enviado: { Icone: Check, cor: 'text-emerald-700 dark:text-emerald-400' },
  falhou: { Icone: X, cor: 'text-destructive' },
  pulado: { Icone: CalendarDays, cor: 'text-muted-foreground' },
};

export function LembretesDoWhatsApp() {
  const [estado, setEstado] = useState<EstadoDoLembrete | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<null | 'ligar' | 'teste' | 'grupo' | 'salvar'>(null);
  const [confirmar, setConfirmar] = useState(false);
  const [editando, setEditando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [modelo, setModelo] = useState('');

  const carregar = useCallback(async () => {
    try { const e = await estadoDoLembrete(); setEstado(e); setErro(null); }
    catch (e) { setErro((e as Error).message); }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);

  if (erro && !estado) {
    return (
      <section className="space-y-2" aria-labelledby="titulo-lembretes">
        <h1 id="titulo-lembretes" className="font-display text-[26px] font-semibold">Lembretes no WhatsApp</h1>
        <p role="alert" className="text-sm text-destructive">Não consegui abrir os lembretes ({erro}). <button type="button" className="underline" onClick={() => void carregar()}>Tentar de novo</button></p>
      </section>
    );
  }
  if (!estado) return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando…</p>;

  // A prévia e o "Enviar agora" mostram o mesmo dia: hoje, se for dia útil; senão, o próximo.
  const hoje = hojeEmBrasilia(new Date());
  const dia = ehDiaDoLembrete(hoje) ? hoje : estado.proximo;
  const textoNaTela = editando ? mensagem : estado.mensagem;
  // Vazio, volta o de fábrica (como o servidor faz ao salvar).
  const modeloNaTela = editando ? (modelo.trim() ? modelo : MODELO_PADRAO) : estado.modelo;
  const corDeHoje = corDoDia(dia);
  // Ao grupo, só o de hoje, num dia útil, se ainda não foi; e nunca com texto por salvar.
  const motivoSemGrupo = !ehDiaDoLembrete(hoje) ? 'No fim de semana não vai lembrete ao grupo; o teste mostra o de segunda.'
    : estado.enviadoHoje ? 'O grupo já recebeu o lembrete de hoje.' : null;

  const ligar = async (v: boolean) => {
    setOcupado('ligar');
    try { await ligarLembrete(v); await carregar(); toast.success(v ? 'Envio automático ligado' : 'Envio automático desligado'); }
    catch (e) { toast.error('Não foi possível mudar', { description: (e as Error).message }); }
    finally { setOcupado(null); }
  };
  const enviar = async (destino: 'teste' | 'grupo') => {
    setOcupado(destino);
    try {
      await enviarLembrete(destino, dia);
      toast.success(destino === 'grupo' ? `Lembrete enviado ao grupo ${estado.grupo}` : 'Teste enviado para "Mensagens para mim"');
    } catch (e) { toast.error('Não foi possível enviar', { description: (e as Error).message }); }
    finally { setOcupado(null); void carregar(); }
  };
  const abrirEditor = () => { setMensagem(estado.mensagem); setModelo(estado.modelo); setEditando(true); };
  const salvar = async () => {
    if (!mensagem.trim()) { toast.error('A mensagem não pode ficar vazia.'); return; }
    setOcupado('salvar');
    try { await salvarTextoDoLembrete(mensagem, modelo); await carregar(); setEditando(false); toast.success('Mensagem salva'); }
    catch (e) { toast.error('Não foi possível salvar', { description: (e as Error).message }); }
    finally { setOcupado(null); }
  };

  return (
    <section className="space-y-4" aria-labelledby="titulo-lembretes">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 id="titulo-lembretes" className="font-display text-[26px] font-semibold">Lembretes no WhatsApp</h1>
          <p className="max-w-[80ch] text-[13.5px] text-muted-foreground">O lembrete para as unidades enviarem os registros das atividades, que viram as postagens do blog e das redes. Vai sozinho para o grupo, de segunda a sexta às {HORA_DO_LEMBRETE}h.</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void carregar()}><RefreshCw className="h-3.5 w-3.5" />Atualizar</Button>
      </div>

      {!estado.configurado && (
        <p role="alert" className="rounded-[14px] border border-destructive/30 bg-destructive/5 p-3 text-[13px] text-destructive">A conexão com o WhatsApp ainda não está configurada (a mesma do ranking da Pizza). Sem ela, nada é enviado.</p>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        {editando ? (
          <section className="space-y-3 rounded-[20px] border border-black/5 bg-card p-4 dark:border-white/5" aria-label="Editar a mensagem">
            <b className="block text-[15px]">Editar a mensagem</b>
            <label className="block text-[13px] font-semibold">Mensagem (vai com a arte)
              <Textarea className="mt-1 min-h-[300px] font-mono text-[12.5px]" value={mensagem} maxLength={3000} onChange={e => setMensagem(e.target.value)} />
            </label>
            <label className="block text-[13px] font-semibold">Modelo para copiar (mensagem separada)
              <Textarea className="mt-1 min-h-[80px] font-mono text-[12.5px]" value={modelo} maxLength={1000} onChange={e => setModelo(e.target.value)} />
            </label>
            <p className="text-[12px] text-muted-foreground">*assim* vira negrito no WhatsApp. Com o campo vazio, volta o texto de fábrica.</p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditando(false)} disabled={ocupado === 'salvar'}>Cancelar</Button>
              <Button onClick={() => void salvar()} disabled={ocupado === 'salvar'} className="gap-1.5">{ocupado === 'salvar' && <Loader2 className="h-4 w-4 animate-spin" />}Salvar</Button>
            </div>
          </section>
        ) : (
          <div className="space-y-2">
            <b className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Assim chega no grupo</b>
            <Previa dia={dia} mensagem={textoNaTela} modelo={modeloNaTela} grupo={estado.grupo} />
          </div>
        )}

        <div className="space-y-4">
          {editando && (
            <div className="space-y-2">
              <b className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Prévia</b>
              <Previa dia={dia} mensagem={textoNaTela} modelo={modeloNaTela} grupo={estado.grupo} />
            </div>
          )}
          <section className="space-y-3 rounded-[20px] border border-black/5 bg-card p-4 dark:border-white/5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <b className="block text-[15px]">Envio automático</b>
                <span className="text-[12.5px] text-muted-foreground">Grupo {estado.grupo}, pelo WhatsApp da MKT</span>
              </div>
              <label className="inline-flex items-center gap-2 text-[13px] font-semibold">
                <Switch checked={estado.ligado} disabled={!!ocupado} onCheckedChange={v => void ligar(v)} aria-label="Envio automático" />
                <span className={estado.ligado ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'}>{estado.ligado ? 'Ligado' : 'Desligado'}</span>
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[13px]" aria-label="Dias e horário">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-card/70 px-3 py-1.5 dark:border-white/10"><Clock className="h-4 w-4" /><b>{HORA_DO_LEMBRETE}:00</b></span>
              {[1, 2, 3, 4, 5, 6, 0].map(d => (
                <span key={d} className={cn('rounded-full border px-2.5 py-1.5', DIAS_DO_LEMBRETE.includes(d) ? 'border-transparent bg-foreground font-semibold text-background' : 'border-black/10 text-muted-foreground line-through dark:border-white/10')}>{NOMES_DOS_DIAS[d]}</span>
              ))}
            </div>
            <p className="text-[12.5px] text-muted-foreground">
              {estado.ligado ? <>Próximo: <b className="text-foreground">{diaPorExtenso(estado.proximo)}, às {HORA_DO_LEMBRETE}:00</b></> : <>Desligado: nada vai sozinho. Ligado, o próximo seria <b className="text-foreground">{diaPorExtenso(estado.proximo)}</b></>}
              {corDoDia(estado.proximo) && <> · arte {NOME_DA_COR[corDoDia(estado.proximo)!]}{diaDaSemana(estado.proximo) === 1 && ' + "Como enviar"'}</>}
            </p>
          </section>

          <section className="space-y-2 rounded-[20px] border border-black/5 bg-card p-4 dark:border-white/5" aria-label="Arte de cada dia">
            <b className="block text-[15px]">Arte de cada dia</b>
            <div className="grid grid-cols-5 gap-2">
              {CORES.map((c, i) => (
                <div key={c} className={cn('overflow-hidden rounded-[10px] border-2', c === corDeHoje ? 'border-foreground' : 'border-transparent')}>
                  <img src={`${ARTES}/${arteDoLembrete(c)}`} alt={`Arte ${NOME_DA_COR[c]}`} className="aspect-[16/9] w-full object-cover" loading="lazy" />
                  <p className="flex items-center gap-1 px-1.5 py-1 text-[11.5px]"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: HEX_DA_COR[c] }} />{NOMES_DOS_DIAS[i + 1]}</p>
                </div>
              ))}
            </div>
            <p className="flex items-start gap-1.5 pt-1 text-[12.5px] text-muted-foreground">
              <ImageIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Toda segunda vai também a arte <b className="text-foreground">"Como enviar"</b>, numa cor por semana. A desta semana: {NOME_DA_COR[corDoComoEnviar(dia)]}.</span>
              <img src={`${ARTES}/${arteDoComoEnviar(corDoComoEnviar(dia))}`} alt='Arte "Como enviar" da semana' className="ml-auto h-12 w-12 shrink-0 rounded-[8px] object-cover" loading="lazy" />
            </p>
          </section>

          <div className="flex flex-wrap gap-2">
            {!editando && <Button variant="outline" className="gap-1.5" onClick={abrirEditor} disabled={!!ocupado}><Pencil className="h-4 w-4" />Editar a mensagem</Button>}
            <Button variant="outline" className="gap-1.5" onClick={() => void enviar('teste')} disabled={!!ocupado || !estado.configurado || editando}>
              {ocupado === 'teste' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}Mandar teste para mim
            </Button>
            <Button className="gap-1.5" onClick={() => setConfirmar(true)} disabled={!!ocupado || !estado.configurado || editando || !!motivoSemGrupo}>
              {ocupado === 'grupo' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Enviar ao grupo agora
            </Button>
          </div>
          {editando && <p className="text-[12px] text-muted-foreground">Salve a mensagem antes de enviar: o envio usa o texto salvo.</p>}
          {!editando && motivoSemGrupo && estado.configurado && <p className="text-[12px] text-muted-foreground">{motivoSemGrupo}</p>}
          <p className="text-[12px] text-muted-foreground">O teste vai para a conversa "Mensagens para mim" do WhatsApp da MKT, com as mesmas artes e mensagens.</p>

          <section className="space-y-1 rounded-[20px] border border-black/5 bg-card p-4 text-[13px] dark:border-white/5" aria-label="Últimos envios">
            <b className="block text-[15px]">Últimos envios</b>
            {estado.envios.length === 0 ? <p className="text-muted-foreground">Nenhum envio ainda.</p> : estado.envios.map((e, i) => {
              const s = SITUACAO[e.situacao];
              return (
                <div key={i} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 border-b border-border/60 py-1.5 last:border-0" data-testid="envio-do-lembrete">
                  <s.Icone className={cn('h-4 w-4 shrink-0', s.cor)} />
                  <span className="tabular-nums">{quando(e.criado_em)}</span>
                  <span className="text-muted-foreground">· {e.destino === 'grupo' ? 'Grupo' : 'Teste para mim'} · {e.origem === 'agendado' ? 'automático' : 'pelo painel'}</span>
                  <span className={cn('ml-auto text-[12px]', e.situacao === 'falhou' ? 'text-destructive' : 'text-muted-foreground')}>
                    {e.situacao === 'enviado' ? [e.cor && NOME_DA_COR[e.cor], e.com_como_enviar && 'Como enviar'].filter(Boolean).join(' + ') : e.detalhe}
                  </span>
                </div>
              );
            })}
          </section>
        </div>
      </div>

      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enviar o lembrete ao grupo agora?</AlertDialogTitle>
            <AlertDialogDescription>Vai para o grupo {estado.grupo}, com a arte e a mensagem de hoje ({diaPorExtenso(dia)}). Depois disso, o envio automático das {HORA_DO_LEMBRETE}h de hoje não manda de novo.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void enviar('grupo')}>Enviar ao grupo</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
