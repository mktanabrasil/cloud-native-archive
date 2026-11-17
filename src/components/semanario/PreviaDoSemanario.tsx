import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { periodoPorExtenso, type Semanario } from '@/lib/semanario/regras';
import { gerarPdfDoSemanario, nomeDoArquivo } from '@/lib/semanario/pdf/gerar';
import { cn } from '@/lib/utils';

/**
 * O PDF do Semanário na tela (17/11/2026): a folha ao lado do preenchimento,
 * que se refaz enquanto a professora escreve, a prévia das duas páginas e o
 * botão de baixar. A conta de "não coube" vem do mesmo PDF que sai.
 */

export type DadosDoPdf = Parameters<typeof gerarPdfDoSemanario>[0];
export type FolhaPronta = { fase: 'pronta'; blob: Blob; cheios: string[]; tamanho: number };
export type EstadoDaFolha = { fase: 'montando' } | { fase: 'erro'; mensagem: string } | FolhaPronta;

const PROPORCAO = 842.25 / 595.5;

/** O PDF do que está escrito agora, refeito um pouco depois de cada mudança. */
export function useFolhaDoSemanario(dados: DadosDoPdf | null, atraso = 700): EstadoDaFolha {
  const [estado, setEstado] = useState<EstadoDaFolha>({ fase: 'montando' });
  const chave = dados ? JSON.stringify(dados) : '';
  useEffect(() => {
    if (!dados) return;
    let vivo = true;
    const t = setTimeout(() => {
      gerarPdfDoSemanario(dados)
        .then(r => { if (vivo) setEstado({ fase: 'pronta', blob: r.blob, cheios: r.cheios, tamanho: r.tamanho }); })
        .catch((e: Error) => { if (vivo) setEstado({ fase: 'erro', mensagem: e?.message || 'Não deu para montar o PDF.' }); });
    }, atraso);
    return () => { vivo = false; clearTimeout(t); };
    // A chave já resume os dados.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, atraso]);
  return estado;
}

/** Baixa o arquivo pelo navegador. */
export function baixarArquivo(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Gera e baixa o PDF de um semanário. */
export async function baixarSemanario(s: Pick<Semanario, 'agrupamento' | 'dias' | 'formas_registro' | 'materiais' | 'avaliacao' | 'professora_nome' | 'semana'>) {
  const r = await gerarPdfDoSemanario(s);
  baixarArquivo(r.blob, nomeDoArquivo(s));
}

/**
 * Uma página do PDF, na largura da caixa. Troca a imagem só quando a nova está
 * pronta, para a folha não piscar enquanto a professora escreve.
 */
export function PaginaDoPdf({ blob, numero, className }: { blob: Blob; numero: number; className?: string }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [pronta, setPronta] = useState(false);
  useEffect(() => {
    let vivo = true;
    // O documento (e o worker do pdf.js) é fechado sempre: ao terminar, ao falhar e ao sair.
    let tarefa: { destroy: () => Promise<void> } | null = null;
    (async () => {
      const el = caixa.current;
      if (!el) return;
      const pdfjs = await import('pdfjs-dist');
      if (!vivo) return;
      pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
      const t = pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) });
      tarefa = t;
      const doc = await t.promise;
      const pagina = await doc.getPage(numero);
      const base = pagina.getViewport({ scale: 1 });
      const escala = ((el.clientWidth || 600) / base.width) * Math.min(2, window.devicePixelRatio || 1);
      const vista = pagina.getViewport({ scale: escala });
      const c = document.createElement('canvas');
      c.width = Math.round(vista.width); c.height = Math.round(vista.height);
      c.className = 'block h-full w-full';
      c.setAttribute('aria-label', `Página ${numero} do semanário`);
      c.setAttribute('role', 'img');
      const g = c.getContext('2d');
      if (!g) return;
      await pagina.render({ canvasContext: g, viewport: vista, canvas: c } as Parameters<typeof pagina.render>[0]).promise;
      if (!vivo) return;
      el.querySelector('canvas')?.remove();
      el.appendChild(c);
      setPronta(true);
    })().catch(() => { /* a prévia é só para ver; o erro do PDF aparece no estado */ })
      .finally(() => { void tarefa?.destroy(); tarefa = null; });
    return () => { vivo = false; void tarefa?.destroy(); tarefa = null; };
  }, [blob, numero]);
  return (
    <div ref={caixa} className={cn('relative w-full overflow-hidden rounded-[8px] bg-white shadow-[0_6px_24px_rgba(0,0,0,0.12)] ring-1 ring-black/10', className)} style={{ aspectRatio: `${PROPORCAO}` }}>
      {!pronta && <span className="absolute inset-0 grid place-items-center text-[12px] text-neutral-400">Montando a página {numero}…</span>}
    </div>
  );
}

/** O aviso do que não cabe na folha. */
export function AvisoDeFolhaCheia({ cheios, className }: { cheios: string[]; className?: string }) {
  if (!cheios.length) return null;
  return (
    <p role="status" className={cn('flex gap-2 rounded-[14px] border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[13px] leading-snug', className)}>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
      <span>Não cabe na folha, nem com a letra menor: <b>{cheios.join(', ')}</b>. Encurte esse texto: o que passa não sai no PDF, e o envio espera.</span>
    </p>
  );
}

/** A folha ao lado do preenchimento: a página 2, como vai sair. */
export function FolhaAoLado({ estado }: { estado: EstadoDaFolha }) {
  return (
    <div>
      <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Como vai sair · página 2</p>
      {estado.fase === 'pronta' ? <PaginaDoPdf blob={estado.blob} numero={2} /> : (
        <div className="grid w-full place-items-center rounded-[8px] bg-white/60 text-[12.5px] text-muted-foreground ring-1 ring-black/10 dark:bg-white/5" style={{ aspectRatio: `${PROPORCAO}` }}>
          {estado.fase === 'erro' ? estado.mensagem : <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Montando a folha…</span>}
        </div>
      )}
      {estado.fase === 'pronta' && <AvisoDeFolhaCheia cheios={estado.cheios} className="mt-2" />}
      <p className="mt-2 text-[12px] text-muted-foreground">
        Os títulos, as cores e a ordem são do modelo e não mudam. Só o que vocês escrevem entra nos quadros; com muito texto, a letra diminui até um limite. Emojis não vão para o PDF.
      </p>
    </div>
  );
}

/** A prévia das duas páginas, com o botão de baixar. */
export function PreviaDoSemanario({ estado, semanario, aberta, onFechar }: {
  estado: EstadoDaFolha;
  /** O que está escrito agora: o "Baixar PDF" gera de novo com isto, nunca com uma folha velha. */
  semanario: DadosDoPdf;
  aberta: boolean;
  onFechar: () => void;
}) {
  return (
    <Dialog open={aberta} onOpenChange={o => { if (!o) onFechar(); }}>
      <DialogContent className="flex max-h-[92vh] max-w-5xl flex-col gap-0 p-0">
        <DialogHeader className="border-b border-black/10 px-5 py-4 text-left dark:border-white/10">
          <DialogTitle>Prévia do semanário · 2 páginas</DialogTitle>
          <DialogDescription>
            {periodoPorExtenso(semanario.semana)}{semanario.agrupamento ? ` · ${semanario.agrupamento}` : ''}. A página 1 (as orientações) é sempre a mesma; a página 2 sai com o que foi preenchido.
          </DialogDescription>
          {estado.fase === 'pronta' && (
            <div><Button variant="outline" size="sm" className="mt-2 gap-1.5" onClick={() => void baixarSemanario(semanario).catch(() => baixarArquivo(estado.blob, nomeDoArquivo(semanario)))}><Download className="h-4 w-4" /> Baixar PDF</Button></div>
          )}
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto bg-black/[.04] px-4 py-4 dark:bg-white/[.03] sm:px-6">
          {estado.fase === 'montando' && <p className="flex items-center justify-center gap-2 py-20 text-[14px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Montando a prévia…</p>}
          {estado.fase === 'erro' && <p role="alert" className="py-20 text-center text-[14px] text-destructive">{estado.mensagem}</p>}
          {estado.fase === 'pronta' && (
            <>
              <AvisoDeFolhaCheia cheios={estado.cheios} className="mb-4" />
              <div className="mx-auto grid max-w-4xl gap-4">
                <PaginaDoPdf blob={estado.blob} numero={1} />
                <PaginaDoPdf blob={estado.blob} numero={2} />
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
