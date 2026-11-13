import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { AnoDoCalendario, ItemDoCalendario } from '@/lib/calendario/regras';

/**
 * A prévia do PDF (13/11/2026): monta o PDF com o que está preenchido agora e
 * mostra as páginas na tela. Toda prévia sai com a marca "PRÉVIA". Só o
 * marketing baixa; as coordenadoras só veem.
 */

interface DocumentoPdf { numPages: number; getPage(n: number): Promise<PaginaPdf> }
interface PaginaPdf {
  getViewport(o: { scale: number }): { width: number; height: number };
  render(o: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }): { promise: Promise<void> };
}

type Estado =
  | { fase: 'montando' }
  | { fase: 'erro'; mensagem: string }
  | { fase: 'pronta'; blob: Blob; doc: DocumentoPdf; cheias: string[] };

const PROPORCAO = 842.25 / 595.5;
const diaCurto = (chave: string) => { const [, m, d] = chave.split('-'); return `${d}/${m}`; };

/** Uma página: desenha quando aparece na tela, na largura em que é vista. */
function Pagina({ doc, numero }: { doc: DocumentoPdf; numero: number }) {
  const caixa = useRef<HTMLDivElement>(null);
  const tela = useRef<HTMLCanvasElement>(null);
  const [desenhada, setDesenhada] = useState(false);
  useEffect(() => {
    const el = caixa.current;
    if (!el || desenhada) return;
    let vivo = true;
    const desenhar = async () => {
      const pagina = await doc.getPage(numero);
      const base = pagina.getViewport({ scale: 1 });
      const escala = (el.clientWidth / base.width) * Math.min(2, window.devicePixelRatio || 1);
      const vista = pagina.getViewport({ scale: escala });
      const c = tela.current;
      const g = c?.getContext('2d');
      if (!c || !g || !vivo) return;
      c.width = Math.round(vista.width); c.height = Math.round(vista.height);
      await pagina.render({ canvasContext: g, viewport: vista }).promise;
      if (vivo) setDesenhada(true);
    };
    if (typeof IntersectionObserver === 'undefined') { void desenhar(); return () => { vivo = false; }; }
    const obs = new IntersectionObserver((entradas) => {
      if (entradas.some(e => e.isIntersecting)) { obs.disconnect(); void desenhar(); }
    }, { rootMargin: '600px 0px' });
    obs.observe(el);
    return () => { vivo = false; obs.disconnect(); };
  }, [doc, numero, desenhada]);
  return (
    <div ref={caixa} className="relative w-full overflow-hidden rounded-[10px] bg-white shadow-sm ring-1 ring-black/10" style={{ aspectRatio: `${PROPORCAO}` }}>
      <canvas ref={tela} className="block h-full w-full" aria-label={`Página ${numero}`} />
      {!desenhada && <span className="absolute inset-0 grid place-items-center text-[12px] text-neutral-400">Página {numero}</span>}
    </div>
  );
}

export function PreviaDoPdf({ ano, itens, podeBaixar, aberta, onFechar }: {
  ano: AnoDoCalendario;
  itens: ItemDoCalendario[];
  podeBaixar: boolean;
  aberta: boolean;
  onFechar: () => void;
}) {
  const [estado, setEstado] = useState<Estado>({ fase: 'montando' });

  useEffect(() => {
    if (!aberta) return;
    let vivo = true;
    setEstado({ fase: 'montando' });
    (async () => {
      const [{ gerarPdfDoCalendario }, pdfjs] = await Promise.all([import('@/lib/calendario/pdf/gerar'), import('pdfjs-dist')]);
      pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
      const r = await gerarPdfDoCalendario(ano, itens, { previa: true });
      const doc = await pdfjs.getDocument({ data: new Uint8Array(await r.blob.arrayBuffer()) }).promise;
      if (vivo) setEstado({ fase: 'pronta', blob: r.blob, doc: doc as unknown as DocumentoPdf, cheias: r.celulasCheias });
    })().catch((e: Error) => { if (vivo) setEstado({ fase: 'erro', mensagem: e?.message || 'Não deu para montar a prévia.' }); });
    return () => { vivo = false; };
    // A prévia é uma foto do momento em que abriu; não remonta a cada mudança.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberta]);

  const baixar = () => {
    if (estado.fase !== 'pronta') return;
    const url = URL.createObjectURL(estado.blob);
    const a = document.createElement('a');
    a.href = url; a.download = `Calendário Anual ${ano.ano} - prévia.pdf`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  return (
    <Dialog open={aberta} onOpenChange={o => { if (!o) onFechar(); }}>
      <DialogContent className="flex h-[92vh] max-w-5xl flex-col gap-0 p-0">
        <DialogHeader className="border-b border-black/10 px-5 py-4 text-left dark:border-white/10">
          <DialogTitle>Prévia do PDF · {ano.ano}</DialogTitle>
          <DialogDescription>
            {estado.fase === 'pronta' ? `${estado.doc.numPages} páginas, montadas com o que está preenchido agora. ` : 'Montando com o que está preenchido agora. '}
            O PDF final é o que o marketing aprova.
          </DialogDescription>
          {podeBaixar && estado.fase === 'pronta' && (
            <div><Button variant="outline" size="sm" className="mt-2 gap-1.5" onClick={baixar}><Download className="h-4 w-4" /> Baixar a prévia</Button></div>
          )}
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto bg-black/[.04] px-4 py-4 dark:bg-white/[.03] sm:px-6">
          {estado.fase === 'montando' && (
            <p className="flex items-center justify-center gap-2 py-20 text-[14px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Montando a prévia…</p>
          )}
          {estado.fase === 'erro' && <p role="alert" className="py-20 text-center text-[14px] text-destructive">{estado.mensagem}</p>}
          {estado.fase === 'pronta' && (
            <>
              {estado.cheias.length > 0 && (
                <p role="status" className="mb-4 flex gap-2 rounded-[14px] border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[13px] leading-snug">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <span>Não couberam inteiros na grade: <b>{estado.cheias.map(diaCurto).join(', ')}</b>. Encurtem os textos desses dias.</span>
                </p>
              )}
              <div className="mx-auto grid max-w-4xl gap-4">
                {Array.from({ length: estado.doc.numPages }, (_, i) => <Pagina key={i} doc={estado.doc} numero={i + 1} />)}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
