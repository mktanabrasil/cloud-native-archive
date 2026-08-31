import { useRef, useState } from 'react';
import { FileUp, Loader2, Sparkles, AlertCircle, FileText, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { UnitBadge } from '@/components/journal/UnitBadge';
import { cn } from '@/lib/utils';
import {
  arquivoParaBase64,
  conferirArquivo,
  normalizarImportacao,
  resumirImportacao,
  LIMITE_ARQUIVO_MB,
  type ResultadoImportacao,
} from '@/lib/journal/importar';
import { medirFotosDoPdf } from '@/lib/journal/pdfImagens';
import { arranjarImagens } from '@/lib/journal/arranjarImagens';
import type { JournalPage } from '@/lib/journal/types';

interface Props {
  aberto: boolean;
  onAberto: (aberto: boolean) => void;
  /** Unidade sugerida — a da pessoa. */
  unitId: string | null;
  /** Nome sugerido para a edição, já com a unidade. */
  sugerirNome: (unitId: string | null, mes: string) => string;
  /** Quem pode escolher outra unidade (comunicação). */
  podeTrocarUnidade?: boolean;
  /** Cria o jornal e devolve o id, ou nada se falhar. */
  onCriar: (dados: {
    name: string;
    unitId: string | null;
    referenceMonth: string;
    pages: JournalPage[];
  }) => Promise<string | null>;
  /** Chamado com o resultado, para a página abrir o editor e avisar. */
  onPronto: (journalId: string, resultado: ResultadoImportacao) => void;
}

type Etapa = 'escolher' | 'lendo' | 'erro';

/**
 * A mensagem que a função escreveu, e não a que o cliente inventou.
 *
 * Quando a edge function responde fora da faixa 2xx, o `invoke` devolve um erro
 * cujo `message` é sempre o mesmo texto em inglês — "Edge Function returned a
 * non-2xx status code" — e joga a resposta de verdade num `context`. O corpo
 * traz o que nós escrevemos: "a leitura está congestionada", "seu acesso não
 * permite criar jornais", e assim por diante.
 *
 * Sem esta função, toda falha do servidor chega à diretora como uma frase em
 * inglês que não diz o que fazer.
 */
async function mensagemDoErro(erro: Error): Promise<string> {
  const contexto = (erro as { context?: unknown }).context;
  const resposta = contexto as Response | undefined;

  if (resposta && typeof resposta.json === 'function') {
    try {
      const corpo = await resposta.json();
      if (corpo && typeof corpo.error === 'string' && corpo.error.trim()) return corpo.error;
    } catch {
      /* corpo ilegível: sobra a mensagem genérica, melhor que nada */
    }
  }

  return erro.message;
}

/**
 * Criar um jornal a partir de um arquivo que a unidade já tinha.
 *
 * A leitura só identifica **o que cada pedaço é** — título, texto, foto. A
 * aparência continua sendo da folha, então nada do que entra por aqui pode sair
 * fora da identidade. Por isso a tela não promete "formatar": promete organizar.
 */
export function JournalImportDialog({
  aberto,
  onAberto,
  unitId,
  sugerirNome,
  podeTrocarUnidade,
  onCriar,
  onPronto,
}: Props) {
  const [etapa, setEtapa] = useState<Etapa>('escolher');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erro, setErro] = useState<string>('');
  const [arrastando, setArrastando] = useState(false);
  const [unidade, setUnidade] = useState<string | null>(unitId);
  const [mes, setMes] = useState('');
  const [nome, setNome] = useState(() => sugerirNome(unitId, ''));
  const inputRef = useRef<HTMLInputElement>(null);

  const reiniciar = () => {
    setEtapa('escolher');
    setArquivo(null);
    setErro('');
    setArrastando(false);
    setUnidade(unitId);
    setMes('');
    setNome(sugerirNome(unitId, ''));
  };

  const fechar = (proximo: boolean) => {
    // Fechar no meio da leitura perderia a chamada já paga; o botão some, mas
    // o Esc e o clique fora continuam existindo.
    if (!proximo && etapa === 'lendo') return;
    if (!proximo) reiniciar();
    onAberto(proximo);
  };

  const escolher = (novo: File | null | undefined) => {
    const problema = conferirArquivo(novo);
    if (problema) {
      setErro(problema);
      setArquivo(null);
      return;
    }
    setErro('');
    setArquivo(novo ?? null);
  };

  const importar = async () => {
    const problema = conferirArquivo(arquivo);
    if (problema || !arquivo) {
      setErro(problema ?? 'Escolha um arquivo para continuar.');
      return;
    }

    setEtapa('lendo');
    setErro('');

    try {
      const [base64, bytes] = await Promise.all([arquivoParaBase64(arquivo), arquivo.arrayBuffer()]);

      // A medida das fotos roda em paralelo com a leitura do texto: uma é local
      // e instantânea, a outra leva segundos. Somar as duas esperas seria
      // desperdício, e a medida não depende da resposta.
      const [resposta, fotos] = await Promise.all([
        supabase.functions.invoke('journal-import', {
          body: { arquivo: base64, unidade, edicao: mes },
        }),
        medirFotosDoPdf(bytes),
      ]);

      const { data, error } = resposta;
      if (error) throw new Error(await mensagemDoErro(error));
      if (data?.error) throw new Error(data.error);

      const resultado = normalizarImportacao(data?.resultado);
      if (!resultado.paginas.length) {
        throw new Error(
          'Não encontrei conteúdo neste arquivo. Ele pode ser um PDF de imagens escaneadas, que ainda não conseguimos ler.',
        );
      }

      // As fotos entram em fileira e na proporção que têm no arquivo. Sem esta
      // passada elas saem empilhadas na largura toda, o que estoura a folha e
      // recorta foto em pé.
      const paginas = arranjarImagens(resultado.paginas, fotos);

      const id = await onCriar({
        name: nome || sugerirNome(unidade, mes),
        unitId: unidade,
        referenceMonth: mes,
        pages: paginas,
      });
      if (!id) throw new Error('Li o arquivo, mas não consegui salvar o jornal. Tente de novo.');

      onAberto(false);
      reiniciar();
      onPronto(id, resultado);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Algo deu errado na leitura.');
      setEtapa('erro');
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={fechar}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Começar de um arquivo que você já tem
          </DialogTitle>
          <DialogDescription>
            Envie o arquivo do jeito que ele está. Vamos organizar o conteúdo dentro do modelo do
            Jornal — e você confere tudo antes de gerar o PDF.
          </DialogDescription>
        </DialogHeader>

        {etapa === 'lendo' ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium text-foreground">Lendo o seu arquivo…</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              Costuma levar alguns segundos. Não feche esta janela.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <UnitBadge
              variant="banner"
              unitId={unidade}
              label="Unidade"
              hint="preenchida automaticamente"
              onChangeUnit={
                podeTrocarUnidade
                  ? (novo) => {
                      setUnidade(novo);
                      setNome(sugerirNome(novo, mes));
                    }
                  : undefined
              }
            />

            {/* Área de anexo */}
            <div
              onDragOver={(evento) => {
                evento.preventDefault();
                setArrastando(true);
              }}
              onDragLeave={() => setArrastando(false)}
              onDrop={(evento) => {
                evento.preventDefault();
                setArrastando(false);
                escolher(evento.dataTransfer.files?.[0]);
              }}
              className={cn(
                'rounded-lg border-2 border-dashed p-5 text-center transition-colors',
                arrastando ? 'border-primary bg-accent' : 'border-border bg-muted/30',
              )}
            >
              {arquivo ? (
                <div className="flex items-center justify-center gap-2 text-sm">
                  <FileText className="h-4 w-4 shrink-0 text-primary" />
                  <span className="min-w-0 truncate font-medium text-foreground">{arquivo.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    aria-label="Trocar de arquivo"
                    onClick={() => escolher(null)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <>
                  <FileUp className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">
                    Arraste o arquivo aqui
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => inputRef.current?.click()}
                  >
                    Escolher do computador
                  </Button>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    PDF de até {LIMITE_ARQUIVO_MB} MB. No Word, use “Salvar como” e escolha PDF.
                  </p>
                </>
              )}
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="sr-only"
                onChange={(evento) => escolher(evento.target.files?.[0])}
              />
            </div>

            {erro && (
              <p className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{erro}</span>
              </p>
            )}

            <div className="space-y-1.5">
              <Label>Nome da edição</Label>
              <Input
                value={nome}
                placeholder="Jornal ANA — Agosto/2026"
                onChange={(evento) => setNome(evento.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Mês e ano desta edição</Label>
              <Input
                value={mes}
                placeholder="Agosto/2026"
                onChange={(evento) => {
                  setMes(evento.target.value);
                  setNome(sugerirNome(unidade, evento.target.value));
                }}
              />
            </div>

            <p className="rounded-md bg-muted/60 px-2.5 py-2 text-[11px] text-muted-foreground">
              As fotos do arquivo não vêm junto, mas o lugar delas vem: cada encaixe já nasce com o
              tamanho e o formato da foto original — em pé ou deitada, na mesma fileira em que você as
              colocou. Basta arrastar cada imagem para o seu lugar.
            </p>
          </div>
        )}

        {etapa !== 'lendo' && (
          <DialogFooter>
            <Button variant="outline" onClick={() => fechar(false)}>
              Cancelar
            </Button>
            <Button onClick={importar} disabled={!arquivo}>
              <Sparkles className="mr-1.5 h-4 w-4" />
              Organizar no modelo
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default JournalImportDialog;
