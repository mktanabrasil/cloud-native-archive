import { useRef, useState } from 'react';
import { AlertTriangle, Check, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { colocarFotos, conferirEsboco, numeroDaFoto, type Conferencia, type Esboco } from '@/lib/journal/esboco';
import { enviarJpegs } from '@/lib/journal/enviarFotos';
import { TEMPLATE_LABELS, type JournalPage, type JournalPaperKey } from '@/lib/journal/types';

/**
 * "Criar a partir de esboço" (mockup de 05/10/2026, decisões: unidade do
 * esboço, nome no padrão do app, observações só no esboço).
 *
 * A pessoa escolhe a pasta do jornal em "Jornal - Esboço"; o app lê o
 * `esboco.json` e as `fotos/foto-NN.jpg`, mostra a conferência e só então
 * envia. As fotos sobem primeiro e o rascunho nasce já com elas: se o envio
 * parar no meio, o rascunho sai com as que subiram e o resto fica como
 * quadro vazio.
 */

export interface DadosDoEsboco {
  name: string;
  unitId: string;
  referenceMonth: string;
  pages: JournalPage[];
  paper: JournalPaperKey;
}

interface Props {
  aberto: boolean;
  onAberto: (aberto: boolean) => void;
  sugerirNome: (unitId: string | null, mes: string) => string;
  /** Cria o rascunho; devolve o id, ou null se falhou. */
  onCriar: (dados: DadosDoEsboco) => Promise<string | null>;
  onPronto: (journalId: string) => void;
}

type Etapa =
  | { tipo: 'escolher'; erro?: string }
  | { tipo: 'conferir'; pasta: string; conferencia: Conferencia; fotos: Map<number, File> }
  | { tipo: 'enviando'; enviadas: number; total: number; criando: boolean }
  | { tipo: 'pronto'; id: string; nome: string; paginas: number; fotos: number; faltaram: number }
  | { tipo: 'falhou'; voltar: Etapa };

/** A pasta escolhida: o nome dela e o caminho de cada arquivo a partir dela. */
function lerPasta(arquivos: File[]): { pasta: string; json: File | null; fotos: Map<number, File> } {
  const rel = (f: File) => (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
  const pasta = rel(arquivos[0] ?? new File([], '')).split('/')[0] ?? '';
  let json: File | null = null;
  const fotos = new Map<number, File>();
  for (const f of arquivos) {
    const partes = rel(f).split('/');
    // Só o que está na raiz da pasta escolhida ou em fotos/ conta.
    if (partes.length === 2 && partes[1] === 'esboco.json') json = f;
    if (partes.length === 3 && partes[1] === 'fotos') {
      const n = numeroDaFoto(partes[2]);
      if (n !== null) fotos.set(n, f);
    }
  }
  return { pasta, json, fotos };
}

/** O texto do arquivo; FileReader onde `Blob.text` não existe (navegador antigo, jsdom). */
function lerTexto(arquivo: File): Promise<string> {
  if (typeof arquivo.text === 'function') return arquivo.text();
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result ?? ''));
    leitor.onerror = () => reject(leitor.error);
    leitor.readAsText(arquivo);
  });
}

export function JournalEsbocoDialog({ aberto, onAberto, sugerirNome, onCriar, onPronto }: Props) {
  const [etapa, setEtapa] = useState<Etapa>({ tipo: 'escolher' });
  const entrada = useRef<HTMLInputElement>(null);
  const parar = useRef(false);

  const fechar = (v: boolean) => {
    if (!v && etapa.tipo === 'enviando') return; // não fecha no meio do envio
    onAberto(v);
    if (!v) setEtapa({ tipo: 'escolher' });
  };

  const aoEscolher = async (lista: FileList | null) => {
    const arquivos = Array.from(lista ?? []);
    if (entrada.current) entrada.current.value = '';
    if (!arquivos.length) return;
    const { pasta, json, fotos } = lerPasta(arquivos);
    if (!json) {
      setEtapa({ tipo: 'escolher', erro: `A pasta “${pasta}” não tem esboco.json. Escolha a pasta do jornal (ex.: 2026-10 Anísio), ou gere o esboço de novo para criar o arquivo.` });
      return;
    }
    let esboco: Esboco;
    try {
      esboco = JSON.parse(await lerTexto(json)) as Esboco;
    } catch {
      setEtapa({ tipo: 'escolher', erro: 'O esboco.json desta pasta não abriu. Gere o esboço de novo.' });
      return;
    }
    setEtapa({ tipo: 'conferir', pasta, conferencia: conferirEsboco(esboco, new Set(fotos.keys())), fotos });
  };

  const criar = async (pasta: string, c: Conferencia, fotos: Map<number, File>) => {
    if (!c.unidade || !c.mes) return;
    parar.current = false;
    const numeros = c.fotosUsadas;
    setEtapa({ tipo: 'enviando', enviadas: 0, total: numeros.length, criando: false });
    const enderecos = await enviarJpegs(
      numeros.map((n) => fotos.get(n)!),
      (enviadas, total) => setEtapa({ tipo: 'enviando', enviadas, total, criando: false }),
      () => parar.current,
    );
    const porNumero = new Map<number, string>();
    enderecos.forEach((url, i) => { if (url) porNumero.set(numeros[i], url); });
    setEtapa({ tipo: 'enviando', enviadas: enderecos.length, total: numeros.length, criando: true });

    const nome = sugerirNome(c.unidade.id, c.mes);
    const id = await onCriar({
      name: nome,
      unitId: c.unidade.id,
      referenceMonth: c.mes,
      pages: colocarFotos(c.paginas, c.fotoDoBloco, porNumero),
      paper: c.fundo,
    });
    if (!id) { setEtapa({ tipo: 'falhou', voltar: { tipo: 'conferir', pasta, conferencia: c, fotos } }); return; }
    setEtapa({ tipo: 'pronto', id, nome, paginas: c.paginas.length, fotos: porNumero.size, faltaram: numeros.length - porNumero.size });
  };

  return (
    <Dialog open={aberto} onOpenChange={fechar}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
        <input
          ref={entrada}
          type="file"
          multiple
          className="hidden"
          data-testid="pasta-do-esboco"
          onChange={(e) => aoEscolher(e.target.files)}
          {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
        />

        {etapa.tipo === 'escolher' && (
          <>
            <DialogHeader>
              <DialogTitle>Criar a partir de esboço</DialogTitle>
              <DialogDescription>
                Escolha a pasta do jornal dentro de “Jornal - Esboço”. O app lê o esboço e as fotos dela; nada é enviado antes de você conferir.
              </DialogDescription>
            </DialogHeader>
            <div className="grid justify-items-center gap-2.5 rounded-xl border-2 border-dashed border-border px-4 py-7 text-center">
              <FolderOpen className="h-8 w-8 text-muted-foreground" />
              <Button onClick={() => entrada.current?.click()}>Escolher a pasta do esboço</Button>
              <span className="text-xs text-muted-foreground">ex.: Downloads › Jornal - Esboço › <b>2026-10 Anísio</b></span>
            </div>
            {etapa.erro && (
              <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-foreground">{etapa.erro}</p>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => fechar(false)}>Cancelar</Button>
            </DialogFooter>
          </>
        )}

        {etapa.tipo === 'conferir' && (() => {
          const c = etapa.conferencia;
          const pode = c.erros.length === 0;
          return (
            <>
              <DialogHeader>
                <DialogTitle>Conferir o esboço</DialogTitle>
                <DialogDescription>{etapa.pasta}</DialogDescription>
              </DialogHeader>
              <ul className="grid gap-1.5 text-sm" data-testid="conferencia">
                {c.erros.map((e) => (
                  <li key={e} className="flex gap-2 text-destructive"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{e}</li>
                ))}
                {c.unidade && <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />Unidade: <b>{c.unidade.name}</b></li>}
                {pode && <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />{c.fotosUsadas.length} fotos usadas, todas na pasta</li>}
                {c.avisos.map((a) => (
                  <li key={a} className="flex gap-2 text-amber-700 dark:text-amber-400"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{a}</li>
                ))}
              </ul>
              {c.unidade && c.mes && (
                <div className="grid gap-1 rounded-lg bg-muted/50 px-3 py-2 text-sm">
                  <span><span className="text-muted-foreground">Nome:</span> {sugerirNome(c.unidade.id, c.mes)}</span>
                  <span><span className="text-muted-foreground">Mês:</span> {c.mes}</span>
                </div>
              )}
              <ol className="grid gap-2">
                {c.paginas.map((p, i) => {
                  const titulo = p.blocks.find((b) => b.kind === 'text' && b.style.startsWith('titulo'));
                  const fotos = p.blocks.filter((b) => b.kind === 'image').map((b) => c.fotoDoBloco.get(b.id));
                  return (
                    <li key={p.id} className="grid grid-cols-[24px_minmax(0,1fr)] items-center gap-2.5 rounded-lg border border-border px-2.5 py-2">
                      <span className="text-center font-bold tabular-nums text-muted-foreground">{i + 1}</span>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">
                          <span className="mr-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{TEMPLATE_LABELS[p.template] ?? p.template}</span>
                          {titulo && titulo.kind === 'text' ? titulo.content : 'Sem título'}
                        </div>
                        {fotos.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {fotos.map((n, k) => (
                              <span key={k} className="grid h-5 w-7 place-items-center rounded border border-border bg-muted text-[9px] tabular-nums text-muted-foreground">{n ?? '—'}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => entrada.current?.click()}>Escolher outra pasta</Button>
                <Button disabled={!pode} onClick={() => criar(etapa.pasta, c, etapa.fotos)}>
                  Criar rascunho com {c.fotosUsadas.length} fotos
                </Button>
              </DialogFooter>
            </>
          );
        })()}

        {etapa.tipo === 'enviando' && (
          <>
            <DialogHeader>
              <DialogTitle>Criando o rascunho</DialogTitle>
              <DialogDescription>Deixe esta janela aberta até terminar.</DialogDescription>
            </DialogHeader>
            <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={etapa.total} aria-valuenow={etapa.enviadas}>
              <div className="h-full bg-primary transition-[width]" style={{ width: `${etapa.total ? (etapa.enviadas / etapa.total) * 100 : 100}%` }} />
            </div>
            <ul className="grid gap-1.5 text-sm">
              <li className={etapa.criando ? 'text-muted-foreground' : 'font-semibold'}>
                {etapa.criando ? '✓' : '•'} Enviando as fotos: {etapa.enviadas} de {etapa.total}
              </li>
              <li className={etapa.criando ? 'font-semibold' : 'text-muted-foreground'}>{etapa.criando ? '•' : '○'} Criando o rascunho com cada foto no seu quadro</li>
            </ul>
            <DialogFooter>
              <Button variant="outline" disabled={etapa.criando} onClick={() => { parar.current = true; }}>
                Parar e criar com as que subiram
              </Button>
            </DialogFooter>
          </>
        )}

        {etapa.tipo === 'pronto' && (
          <>
            <div className="grid justify-items-center gap-2 py-2 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#81E2CF] text-[#1F2322]"><Check className="h-7 w-7" /></span>
              <DialogTitle>Rascunho pronto</DialogTitle>
              <DialogDescription>
                {etapa.nome} · {etapa.paginas} páginas · {etapa.fotos} fotos
              </DialogDescription>
              {etapa.faltaram > 0 && (
                <p className="text-xs text-amber-700 dark:text-amber-400">{etapa.faltaram} {etapa.faltaram === 1 ? 'foto não subiu e ficou' : 'fotos não subiram e ficaram'} como quadro vazio, para colocar à mão.</p>
              )}
            </div>
            <DialogFooter className="sm:justify-center">
              <Button onClick={() => { const id = etapa.id; fechar(false); onPronto(id); }}>Abrir no editor</Button>
            </DialogFooter>
          </>
        )}

        {etapa.tipo === 'falhou' && (
          <>
            <DialogHeader>
              <DialogTitle>Não consegui criar o rascunho</DialogTitle>
              <DialogDescription>As fotos subiram, mas o jornal não foi gravado. Confira a conexão e tente de novo. Se continuar, saia e entre de novo.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => setEtapa(etapa.voltar)}>Voltar à conferência</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
