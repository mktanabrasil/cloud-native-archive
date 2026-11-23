import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Bug, Check, Heart, ImagePlus, Lightbulb, Loader2, MessageSquarePlus, PackageOpen, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { avisarOMarketing, enviarFeedback, lerMeusFeedbacks } from '@/lib/feedback/api';
import {
  LIMITE_DO_TEXTO, SITUACOES_DO_FEEDBACK, TIPOS_DE_FEEDBACK, TIPOS_DO_PRINT, aparelhoDe, navegadorDe, ondeEstou, ondeFoi, problemaDoPrint,
  type MeuFeedback, type SituacaoDoFeedback, type TipoDeFeedback,
} from '@/lib/feedback/regras';

/** O ícone e as cores de cada tipo (as mesmas do mockup aprovado e do e-mail). */
export const VISUAL_DO_TIPO: Record<TipoDeFeedback, { Icone: typeof Lightbulb; cor: string }> = {
  ideia: { Icone: Lightbulb, cor: 'bg-[hsl(45_95%_90%)] text-[hsl(35_80%_32%)] dark:bg-[hsl(45_60%_22%)] dark:text-[hsl(45_90%_75%)]' },
  erro: { Icone: Bug, cor: 'bg-[#fde3dd] text-[#a53a26] dark:bg-[#4a2119] dark:text-[#f5b4a5]' },
  falta: { Icone: PackageOpen, cor: 'bg-[hsl(201_80%_93%)] text-[hsl(var(--info))] dark:bg-[hsl(201_50%_20%)] dark:text-[hsl(201_85%_75%)]' },
  elogio: { Icone: Heart, cor: 'bg-[hsl(149_45%_92%)] text-[hsl(var(--success))] dark:bg-[hsl(149_35%_18%)] dark:text-[hsl(149_50%_70%)]' },
};
export const COR_DA_SITUACAO: Record<SituacaoDoFeedback, string> = {
  novo: 'bg-[hsl(201_80%_93%)] text-[hsl(var(--info))] dark:bg-[hsl(201_50%_20%)] dark:text-[hsl(201_85%_75%)]',
  analise: 'bg-[hsl(39_90%_92%)] text-[hsl(var(--warning))] dark:bg-[hsl(39_50%_20%)] dark:text-[hsl(39_90%_70%)]',
  feito: 'bg-[hsl(149_45%_92%)] text-[hsl(var(--success))] dark:bg-[hsl(149_35%_18%)] dark:text-[hsl(149_50%_70%)]',
  nao: 'bg-muted text-muted-foreground',
};

function IconeDoTipo({ tipo, grande = false }: { tipo: TipoDeFeedback; grande?: boolean }) {
  const { Icone, cor } = VISUAL_DO_TIPO[tipo] ?? VISUAL_DO_TIPO.ideia;
  return <span className={cn('grid shrink-0 place-items-center rounded-[9px]', grande ? 'h-8 w-8' : 'h-7 w-7', cor)} aria-hidden><Icone className="h-4 w-4" /></span>;
}

/** Os feedbacks de quem está logado, com a situação e a resposta do marketing. */
function SeusFeedbacks({ lista, erro, onTentar }: { lista: MeuFeedback[] | null; erro: boolean; onTentar: () => void }) {
  if (erro) return <p role="alert" className="text-xs text-destructive">Não consegui ler os seus feedbacks. <button type="button" className="underline" onClick={onTentar}>Tentar de novo</button></p>;
  if (lista === null) return <p className="text-xs text-muted-foreground">Carregando…</p>;
  if (lista.length === 0) return <p className="text-xs text-muted-foreground">Você ainda não mandou feedback.</p>;
  return (
    <ul className="space-y-2" aria-label="Seus feedbacks">
      {lista.map(f => (
        <li key={f.id} className="rounded-[14px] border border-black/10 bg-card/60 p-2.5 text-[12.5px] dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <IconeDoTipo tipo={f.tipo} />
            <span className="min-w-0 flex-1 truncate" title={f.texto}>{f.texto}</span>
            <span className={cn('whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold', COR_DA_SITUACAO[f.situacao])}>{SITUACOES_DO_FEEDBACK[f.situacao]}</span>
          </div>
          {f.resposta?.trim() && (
            <p className="mt-2 rounded-[10px] bg-muted/60 px-2.5 py-1.5 text-[12px]"><b>Resposta do marketing:</b> {f.resposta.trim()}</p>
          )}
        </li>
      ))}
    </ul>
  );
}

type Tela = 'escrever' | 'enviado' | 'meus';

/**
 * "Dar feedback" (23/11/2026, mockup aprovado): o botão fica na faixa de cada
 * setor; a janela pergunta o tipo, o texto e um print opcional. O setor, a
 * página, o aparelho e quem mandou vão sozinhos. No celular, a janela abre
 * de baixo. Depois de enviar, a pessoa vê os seus feedbacks e a situação.
 */
export function DarFeedback({ compacta = false }: { compacta?: boolean }) {
  const { user } = useAuth();
  const location = useLocation();
  const [aberto, setAberto] = useState(false);
  const [tela, setTela] = useState<Tela>('escrever');
  const [tipo, setTipo] = useState<TipoDeFeedback | null>(null);
  const [texto, setTexto] = useState('');
  const [print, setPrint] = useState<File | null>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [meus, setMeus] = useState<MeuFeedback[] | null>(null);
  const [erroDosMeus, setErroDosMeus] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);
  const userId = user?.id ?? null;

  // A prévia do print vive enquanto ele estiver escolhido.
  useEffect(() => {
    if (!print) { setPrevia(null); return; }
    const url = URL.createObjectURL(print);
    setPrevia(url);
    return () => URL.revokeObjectURL(url);
  }, [print]);

  const carregarMeus = useCallback(async () => {
    if (!userId) return;
    setErroDosMeus(false);
    try { setMeus(await lerMeusFeedbacks(userId)); } catch { setErroDosMeus(true); }
  }, [userId]);

  const limpar = () => { setTipo(null); setTexto(''); setPrint(null); setErro(null); };
  const abrir = (v: boolean) => {
    if (enviando) return;
    setAberto(v);
    // Reabrir guarda o rascunho (fechar sem querer não perde o texto), mas não o erro antigo.
    if (v) { setTela('escrever'); setErro(null); setMeus(null); void carregarMeus(); }
  };

  const escolherPrint = (f: File | null | undefined) => {
    if (!f) return;
    const problema = problemaDoPrint(f);
    if (problema) { setErro(problema); return; }
    setErro(null);
    setPrint(f);
  };
  // Colar um print (Ctrl+V) também anexa. Texto copiado do Excel ou do Word
  // traz junto uma imagem das células: com texto, vale o texto.
  const colar = (e: React.ClipboardEvent) => {
    if (e.clipboardData.types.includes('text/plain')) return;
    const img = [...e.clipboardData.files].find(f => f.type.startsWith('image/'));
    if (img) { e.preventDefault(); escolherPrint(img); }
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    if (!tipo) { setErro('Escolha sobre o que é o feedback.'); return; }
    if (!texto.trim()) { setErro('Escreva o feedback.'); return; }
    setErro(null);
    setEnviando(true);
    try {
      const onde = ondeEstou(location.pathname);
      const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
      const telaPequena = typeof window !== 'undefined' && window.innerWidth < 768;
      const id = await enviarFeedback(userId, {
        tipo, texto: texto.trim(), setor: onde.setor, pagina: onde.pagina, caminho: `${location.pathname}${location.search}`,
        aparelho: aparelhoDe(ua, telaPequena), navegador: navegadorDe(ua),
      }, print);
      // O e-mail ao marketing não segura a pessoa: o feedback já está gravado.
      void avisarOMarketing(id).catch(() => false);
      limpar();
      setTela('enviado');
      void carregarMeus();
    } catch (err) {
      setErro((err as Error).message || 'Não foi possível enviar o feedback.');
    } finally {
      setEnviando(false);
    }
  };

  const onde = ondeFoi(ondeEstou(location.pathname));

  return (
    <Dialog open={aberto} onOpenChange={abrir}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={compacta ? 'Dar feedback' : undefined}
          className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-black/10 bg-white/55 px-3 py-1.5 text-[13px] text-foreground/80 transition-colors hover:bg-white/80 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
        >
          <MessageSquarePlus className="h-4 w-4" aria-hidden />
          {!compacta && 'Dar feedback'}
        </button>
      </DialogTrigger>
      <DialogContent
        className="max-w-[640px] rounded-[24px] max-sm:bottom-0 max-sm:top-auto max-sm:max-h-[92svh] max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-[24px] max-sm:p-4 max-sm:pb-6 max-sm:data-[state=closed]:slide-out-to-top-[100%] max-sm:data-[state=open]:slide-in-from-top-[100%] max-sm:data-[state=closed]:zoom-out-100 max-sm:data-[state=open]:zoom-in-100 sm:rounded-[24px]"
        onPaste={tela === 'escrever' ? colar : undefined}
      >
        {tela === 'enviado' ? (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-2 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-[hsl(149_45%_92%)] text-[hsl(var(--success))] dark:bg-[hsl(149_35%_18%)]"><Check className="h-6 w-6" aria-hidden /></span>
              <DialogTitle className="font-display text-[20px]">Recebido, obrigado!</DialogTitle>
              <DialogDescription className="max-w-[44ch] text-[13px]">O marketing vai ler. Quando mudar a situação ou houver resposta, você vê aqui, no botão "Dar feedback".</DialogDescription>
            </div>
            <h3 className="text-[13px] font-semibold">Seus feedbacks</h3>
            <SeusFeedbacks lista={meus} erro={erroDosMeus} onTentar={() => void carregarMeus()} />
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={() => setTela('escrever')}>Mandar outro</Button>
              <Button onClick={() => abrir(false)}>Fechar</Button>
            </div>
          </div>
        ) : tela === 'meus' ? (
          <div className="space-y-4">
            <DialogHeader className="text-left">
              <DialogTitle className="font-display text-[20px]">Seus feedbacks</DialogTitle>
              <DialogDescription className="text-[13px]">A situação de cada um e a resposta do marketing.</DialogDescription>
            </DialogHeader>
            <SeusFeedbacks lista={meus} erro={erroDosMeus} onTentar={() => void carregarMeus()} />
            <div className="flex justify-end"><Button variant="ghost" onClick={() => setTela('escrever')}>Voltar</Button></div>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={enviar} noValidate>
            <DialogHeader className="text-left">
              <DialogTitle className="font-display text-[20px]">Dar feedback</DialogTitle>
              <DialogDescription className="text-[13px]">Ideia, problema, algo que faltou ou um elogio. Tudo ajuda o app a melhorar.</DialogDescription>
            </DialogHeader>
            <p className="flex flex-wrap items-center gap-1.5 text-[12px] text-muted-foreground">
              <span className="whitespace-nowrap rounded-full bg-muted px-2.5 py-0.5 font-medium text-foreground/80" data-testid="onde-do-feedback">{onde}</span>
              <span className="max-sm:hidden">vai junto, sem você precisar escrever</span>
            </p>
            <fieldset>
              <legend className="mb-2 text-[13px] font-semibold">Sobre o quê?</legend>
              <div role="radiogroup" aria-label="Sobre o quê?" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {TIPOS_DE_FEEDBACK.map(t => {
                  const sel = tipo === t.id;
                  return (
                    <button
                      key={t.id} type="button" role="radio" aria-checked={sel} onClick={() => { setTipo(t.id); setErro(null); }}
                      className={cn('flex flex-col items-start gap-1.5 rounded-[14px] border p-2.5 text-left text-[12.5px] transition-colors',
                        sel ? 'border-foreground bg-card shadow-sm' : 'border-black/10 bg-card/50 hover:bg-card dark:border-white/10')}
                    >
                      <IconeDoTipo tipo={t.id} />
                      <b className="leading-tight">{t.nome}</b>
                      <span className="text-muted-foreground max-sm:hidden">{t.exemplo}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-semibold">Conta pra gente</span>
              <Textarea
                value={texto} onChange={e => setTexto(e.target.value)} maxLength={LIMITE_DO_TEXTO} rows={4}
                placeholder={tipo ? TIPOS_DE_FEEDBACK.find(t => t.id === tipo)?.exemplo : 'Escreva com as suas palavras.'}
                className="min-h-[92px] text-[13.5px]"
              />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input ref={arquivo} type="file" accept={TIPOS_DO_PRINT.join(',')} className="hidden" aria-label="Escolher o print"
                onChange={e => { escolherPrint(e.target.files?.[0]); e.target.value = ''; }} />
              {print ? (
                <span className="inline-flex max-w-full items-center gap-2 rounded-[10px] border border-black/10 bg-card/70 py-1 pl-1 pr-2 text-[12px] dark:border-white/10">
                  {previa && <img src={previa} alt="" className="h-8 w-11 shrink-0 rounded-[6px] object-cover" />}
                  <span className="min-w-0 truncate">{print.name || 'print'}</span>
                  <button type="button" aria-label="Tirar o print" className="text-muted-foreground hover:text-destructive" onClick={() => setPrint(null)}><X className="h-3.5 w-3.5" /></button>
                </span>
              ) : (
                <button type="button" onClick={() => arquivo.current?.click()} className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-black/20 px-3 py-1.5 text-[12.5px] hover:bg-card dark:border-white/20">
                  <ImagePlus className="h-4 w-4" aria-hidden />Anexar print (opcional)
                </button>
              )}
            </div>
            {erro && <p role="alert" className="text-[12.5px] text-destructive">{erro}</p>}
            <div className="flex items-center gap-3 pt-1 max-sm:flex-col-reverse max-sm:items-stretch sm:justify-between">
              <button type="button" className="text-left text-[12px] text-muted-foreground underline-offset-2 hover:underline max-sm:text-center" onClick={() => { setTela('meus'); if (meus === null) void carregarMeus(); }}>
                Seus feedbacks{meus && meus.length > 0 ? ` (${meus.length})` : ''}
              </button>
              <div className="flex gap-2 max-sm:flex-col-reverse">
                <Button type="button" variant="ghost" onClick={() => { limpar(); abrir(false); }} disabled={enviando}>Cancelar</Button>
                <Button type="submit" className="gap-1.5" disabled={enviando}>
                  {enviando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}Enviar feedback
                </Button>
              </div>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
