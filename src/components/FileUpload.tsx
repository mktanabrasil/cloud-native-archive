import { useRef, useState, type DragEvent } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileText, Image as ImageIcon, Loader2, Paperclip, Sheet, X } from 'lucide-react';
import { toast } from 'sonner';
import type { Anexo } from '@/types';
import {
  ACCEPT_ANEXOS, BALDE, apagarDoBalde, caminhoDoAnexo, categoriaDoAnexo, motivoDeRecusa, normalizarAnexo, rotuloDoTamanho, urlDoAnexo,
} from '@/lib/events/anexos';

interface Props {
  attachments?: Array<string | Anexo>;
  url?: string;
  onChange: (value: any) => void;
  mode?: 'multiple' | 'single';
  label?: string;
}

/**
 * Upload para o balde `event-attachments`.
 *
 * Dois modos que sempre foram dois componentes disfarçados de um:
 *  - `single`: uma imagem (capa, banner, logo). Mostra a prévia.
 *  - `multiple`: os anexos do evento. Aceita PDF, imagem, planilha e
 *    documento até 10 MB; mostra nome e tamanho; remover apaga o arquivo
 *    quando ele subiu nesta sessão (é órfão de qualquer jeito). O que já
 *    estava no evento sai só da lista — quem grava o evento decide o que
 *    fazer com o arquivo (ver `EventFormDialog.salvar`).
 */
export function FileUpload({ attachments = [], url = '', onChange, mode = 'multiple', label }: Props) {
  const [isUploading, setIsUploading] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  /** URLs que subiram com este formulário aberto: remover pode apagar do balde. */
  const enviadosAgora = useRef<Set<string>>(new Set());

  const subir = async (file: File, caminho: string): Promise<string> => {
    const { data, error } = await supabase.storage.from(BALDE).upload(caminho, file);
    if (error) throw error;
    return supabase.storage.from(BALDE).getPublicUrl(data.path).data.publicUrl;
  };

  const receberArquivos = async (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return;
    const lista = Array.from(files);

    if (mode === 'single') {
      const file = lista[0];
      setIsUploading(true);
      try {
        const ext = (file.name.split('.').pop() || 'png').toLowerCase();
        const agora = new Date();
        const caminho = `imagens/${agora.getFullYear()}/${String(agora.getMonth() + 1).padStart(2, '0')}/${crypto.randomUUID()}.${ext}`;
        onChange(await subir(file, caminho));
        toast.success('Imagem enviada');
      } catch (error: any) {
        toast.error('Não foi possível enviar a imagem', { description: error?.message });
      } finally {
        setIsUploading(false);
      }
      return;
    }

    // Antes de subir qualquer um, o que não pode entrar é dito pelo nome.
    const aceitos: File[] = [];
    for (const file of lista) {
      const motivo = motivoDeRecusa(file);
      if (motivo) toast.error('Arquivo não enviado', { description: motivo });
      else aceitos.push(file);
    }
    if (aceitos.length === 0) return;

    setIsUploading(true);
    const novos: Anexo[] = [];
    try {
      for (const file of aceitos) {
        const publicUrl = await subir(file, caminhoDoAnexo(file.name));
        enviadosAgora.current.add(publicUrl);
        novos.push({ url: publicUrl, name: file.name, size: file.size, type: file.type });
      }
      onChange([...attachments, ...novos]);
      toast.success(novos.length === 1 ? `“${novos[0].name}” anexado` : `${novos.length} arquivos anexados`);
    } catch (error: any) {
      if (novos.length > 0) onChange([...attachments, ...novos]);
      toast.error('Não foi possível enviar', { description: error?.message });
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await receberArquivos(e.target.files);
    e.target.value = '';
  };

  const remover = (a: string | Anexo) => {
    const u = urlDoAnexo(a);
    onChange(attachments.filter(x => urlDoAnexo(x) !== u));
    if (enviadosAgora.current.has(u)) {
      enviadosAgora.current.delete(u);
      void apagarDoBalde([u]);
    }
  };

  const soltar = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setArrastando(false);
    void receberArquivos(e.dataTransfer.files);
  };

  const Icone = ({ categoria }: { categoria: string }) => {
    if (categoria === 'Imagem') return <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />;
    if (categoria === 'Planilha') return <Sheet className="h-3.5 w-3.5 text-muted-foreground" />;
    if (categoria === 'PDF' || categoria === 'Documento' || categoria === 'Apresentação' || categoria === 'Texto')
      return <FileText className="h-3.5 w-3.5 text-muted-foreground" />;
    return <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />;
  };

  if (mode === 'single') {
    return (
      <div className="space-y-3">
        {label !== '' && <Label className="text-sm font-medium">{label ?? 'Imagem'}</Label>}
        {url && (
          <div className="relative aspect-video rounded-lg overflow-hidden border border-border group">
            <img src={url} alt="Preview" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => onChange('')}
              aria-label="Remover imagem"
              className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="relative">
          <Input type="file" accept="image/*" onChange={handleFileChange} disabled={isUploading} className="cursor-pointer" />
          {isUploading && (
            <div className="absolute inset-0 bg-background/50 flex items-center justify-center rounded-md">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              <span className="text-xs">Enviando...</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Label className="text-sm font-semibold block">
        {label ?? 'Anexos'}
        <span className="ml-1.5 font-normal text-muted-foreground">— PDF, imagem, planilha ou documento · até 10 MB cada</span>
      </Label>

      {attachments.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {attachments.map(normalizarAnexo).map(a => {
            const categoria = categoriaDoAnexo(a);
            const tamanho = rotuloDoTamanho(a.size);
            return (
              <li
                key={a.url}
                className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-1.5 text-xs"
              >
                <Icone categoria={categoria} />
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`${categoria}${tamanho ? ` · ${tamanho}` : ''}`}
                  className="max-w-[220px] truncate text-foreground hover:underline"
                >
                  {a.name}
                </a>
                {tamanho && <span className="text-muted-foreground">{tamanho}</span>}
                <button
                  type="button"
                  onClick={() => remover(a)}
                  aria-label={`Remover ${a.name}`}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div
        onDragOver={e => { e.preventDefault(); setArrastando(true); }}
        onDragLeave={() => setArrastando(false)}
        onDrop={soltar}
        className={`relative flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed p-4 text-center text-xs transition-colors ${
          arrastando ? 'border-primary bg-primary/5' : 'border-input bg-card'
        }`}
      >
        <p className="font-medium text-foreground">
          Arraste arquivos aqui ou{' '}
          <button
            type="button"
            className="text-info underline underline-offset-2"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
          >
            escolha
          </button>
        </p>
        <p className="text-muted-foreground">Ofício, cardápio, lista de presença…</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT_ANEXOS}
          onChange={handleFileChange}
          disabled={isUploading}
          className="sr-only"
          aria-label="Escolher arquivos"
        />
        {isUploading && (
          <div className="absolute inset-0 bg-background/60 flex items-center justify-center rounded-lg">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            <span className="text-xs">Enviando...</span>
          </div>
        )}
      </div>
    </div>
  );
}
