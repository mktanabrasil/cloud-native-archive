import { useEffect, useMemo, useState } from 'react';
import { Copy, Download, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Confirmacao } from '@/lib/pizza/api';
import { calcularRanking, mensagemDoRanking } from '@/lib/pizza/ranking';

/**
 * "Ranking para o WhatsApp" (11/11/2026): a arte e a mensagem da disputa da
 * Pizza da Alegria, com os números do momento, prontas para o grupo. A arte
 * é desenhada aqui no navegador (rankingArte.ts), por isso o desenho só é
 * carregado quando a janela abre.
 */
export function RankingDoWhatsApp({ lista }: { lista: Confirmacao[] }) {
  const [aberto, setAberto] = useState(false);
  const [imagem, setImagem] = useState<Blob | null>(null);
  const [erro, setErro] = useState(false);
  const agora = useMemo(() => new Date(), [aberto]); // eslint-disable-line react-hooks/exhaustive-deps
  const ranking = useMemo(() => calcularRanking(lista), [lista]);
  const mensagem = useMemo(() => mensagemDoRanking(ranking, agora), [ranking, agora]);
  const url = useMemo(() => (imagem ? URL.createObjectURL(imagem) : null), [imagem]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  useEffect(() => {
    if (!aberto) return;
    let vale = true;
    setImagem(null); setErro(false);
    import('@/lib/pizza/rankingArte')
      .then(({ desenharRanking }) => desenharRanking(ranking, agora))
      .then((b) => { if (vale) setImagem(b); })
      .catch(() => { if (vale) setErro(true); });
    return () => { vale = false; };
  }, [aberto, ranking, agora]);

  async function baixar() {
    if (!imagem) return;
    const { salvarRanking } = await import('@/lib/pizza/rankingArte');
    try { await salvarRanking(imagem, agora); } catch { toast.error('Não consegui baixar a imagem.'); }
  }

  async function copiar() {
    try { await navigator.clipboard.writeText(mensagem); toast.success('Mensagem copiada. Cole no grupo junto com a imagem.'); }
    catch { toast.message('Selecione o texto e copie.'); }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setAberto(true)} disabled={!lista.length}><Trophy className="h-4 w-4" /> Ranking para o WhatsApp</Button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-h-[92vh] max-w-[880px] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ranking para o WhatsApp</DialogTitle>
            <DialogDescription>A disputa entre unidades e pessoas, com os números de agora. Baixe a imagem, copie a mensagem e mande as duas no grupo.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 md:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
            <div className="flex flex-col gap-2.5">
              <div className="aspect-[1080/1350] w-full overflow-hidden rounded-lg bg-muted" data-testid="previa-ranking">
                {url ? <img src={url} alt="Arte do ranking da Pizza da Alegria" className="h-full w-full object-cover" />
                  : <div className="grid h-full place-items-center p-4 text-center text-sm text-muted-foreground">{erro ? 'Não consegui desenhar a imagem. Feche e abra de novo.' : 'Desenhando o ranking…'}</div>}
              </div>
              <Button onClick={baixar} disabled={!imagem}><Download className="h-4 w-4" /> Baixar imagem</Button>
            </div>
            <div className="flex min-w-0 flex-col gap-2.5">
              <label htmlFor="mensagem-ranking" className="text-sm font-semibold">Mensagem para o grupo</label>
              <textarea id="mensagem-ranking" readOnly value={mensagem} rows={16} className="w-full resize-none rounded-lg border bg-background p-3 text-sm leading-relaxed" />
              <Button variant="outline" onClick={copiar}><Copy className="h-4 w-4" /> Copiar mensagem</Button>
              <p className="text-xs text-muted-foreground">Unidades pelo total de pizzas; no empate, fica à frente quem chegou primeiro. Os campeões são anunciados em 17/12, na Integração dos Funcionários.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
