import { useMemo, useState } from 'react';
import { Check, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { linkDoArquivo } from '@/lib/calendario/api';
import {
  MESES, UNIDADES_DO_CALENDARIO, mesesQueMudaram, type AlteracaoDoCalendario, type AnoDoCalendario, type ItemDoCalendario,
} from '@/lib/calendario/regras';

type DeQuem = 'geral' | string;
type OQue = 'mudaram' | 'inteiro';

/** "Calendário Anual 2027 · DIC · Março.pdf" */
export function nomeDoArquivo(ano: number, deQuem: DeQuem, oQue: OQue, meses: number[]): string {
  const quem = deQuem === 'geral' ? 'Geral' : deQuem;
  const oque = oQue === 'inteiro' ? 'inteiro' : meses.length === 1 ? MESES[meses[0] - 1] : `${meses.length} meses`;
  return `Calendário Anual ${ano} · ${quem} · ${oque}.pdf`;
}

/** As folhas que saem: 1 ou 3 por mês. */
export const folhasDosMeses = (meses: number[], anotacoes: boolean) => meses.length * (anotacoes ? 3 : 1);

/**
 * Baixar para imprimir, no fichário digital (19/11/2026, mockup aprovado):
 * primeiro "de quem" (a unidade de quem baixa, ou geral), depois "o quê"
 * (só as folhas que mudaram, já marcadas, ou o calendário inteiro). Sai sem a
 * marca de prévia, em preto e branco legível (a sigla da unidade em cada
 * atividade) e com a data no pé, para trocar a folha certa no fichário.
 */
export function BaixarDoFichario({ ano, itens, alteracoes, marketing, unidade, mesInicial, aberto, onFechar }: {
  ano: AnoDoCalendario;
  itens: ItemDoCalendario[];
  alteracoes: AlteracaoDoCalendario[];
  marketing: boolean;
  /** A unidade da gestão que está baixando (null para o marketing). */
  unidade: string | null;
  /** Aberto a partir de um mês: só ele vem marcado. */
  mesInicial?: number | null;
  aberto: boolean;
  onFechar: () => void;
}) {
  const opcoesDeQuem: DeQuem[] = marketing || !unidade ? ['geral', ...UNIDADES_DO_CALENDARIO] : [unidade, 'geral'];
  const [deQuem, setDeQuem] = useState<DeQuem>(opcoesDeQuem[0]);
  const [oQue, setOQue] = useState<OQue>('mudaram');
  const [anotacoes, setAnotacoes] = useState(false);
  const mudaram = useMemo(() => mesesQueMudaram(alteracoes, deQuem === 'geral' ? null : deQuem), [alteracoes, deQuem]);
  const [escolhidos, setEscolhidos] = useState<number[] | null>(null);
  const [gerando, setGerando] = useState(false);
  // Abrir de novo (ou trocar "de quem") volta para o padrão: os meses que mudaram, ou o mês de onde veio.
  const [chave, setChave] = useState('');
  const chaveAgora = `${aberto}|${deQuem}|${mesInicial ?? ''}`;
  if (chave !== chaveAgora) { setChave(chaveAgora); setEscolhidos(mesInicial ? [mesInicial] : null); }
  const meses = (escolhidos ?? mudaram).slice().sort((a, b) => a - b);

  const alternar = (m: number) => setEscolhidos(meses.includes(m) ? meses.filter(x => x !== m) : [...meses, m]);
  const rotulo = (q: DeQuem) => (q === 'geral' ? 'Geral · as três unidades' : `Só da ${q}`);

  const baixar = async () => {
    if (oQue === 'mudaram' && meses.length === 0) return;
    setGerando(true);
    try {
      const inteiro = oQue === 'inteiro';
      const [{ gerarPdfDoCalendario }, capaUrl] = await Promise.all([
        import('@/lib/calendario/pdf/gerar'),
        inteiro && ano.capa_url ? linkDoArquivo(ano.capa_url).catch(() => null) : Promise.resolve(null),
      ]);
      const partes = inteiro ? undefined : { capa: false, textos: false, meses, anotacoes, fim: false };
      const r = await gerarPdfDoCalendario(ano, itens, { capaUrl, previa: false, partes, unidade: deQuem === 'geral' ? null : deQuem, atualizadaEm: new Date().toISOString() });
      const url = URL.createObjectURL(r.blob);
      const a = document.createElement('a');
      a.href = url; a.download = nomeDoArquivo(ano.ano, deQuem, oQue, meses);
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      toast.success(inteiro ? 'Calendário baixado' : `${r.paginas} ${r.paginas === 1 ? 'folha baixada' : 'folhas baixadas'}`);
      onFechar();
    } catch (e) { toast.error((e as Error).message || 'Não deu para montar o PDF agora.'); }
    finally { setGerando(false); }
  };

  const Opcao = ({ ativo, onClick, titulo, detalhe, children }: { ativo: boolean; onClick: () => void; titulo: string; detalhe?: string; children?: React.ReactNode }) => (
    <div className={`rounded-[14px] border p-3 ${ativo ? 'border-foreground/50 bg-card' : 'border-black/10 bg-card/60 dark:border-white/10'}`}>
      <button type="button" role="radio" aria-checked={ativo} onClick={onClick} className="flex w-full items-start gap-2 text-left">
        <span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 ${ativo ? 'border-foreground' : 'border-black/25 dark:border-white/30'}`}>{ativo && <span className="h-2 w-2 rounded-full bg-foreground" />}</span>
        <span><b className="text-[13.5px] font-semibold">{titulo}</b>{detalhe && <span className="block text-[12px] text-muted-foreground">{detalhe}</span>}</span>
      </button>
      {children}
    </div>
  );

  const folhas = oQue === 'inteiro' ? null : folhasDosMeses(meses, anotacoes);
  return (
    <Dialog open={aberto} onOpenChange={o => { if (!o && !gerando) onFechar(); }}>
      <DialogContent className="max-h-[90svh] max-w-[640px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Baixar para imprimir</DialogTitle>
          <DialogDescription>Em preto e branco: cada atividade sai com a sigla da unidade, e o pé da folha diz de quem e de quando ela é.</DialogDescription>
        </DialogHeader>

        <p className="text-[12.5px] font-semibold">1. De quem?</p>
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="De quem">
          {opcoesDeQuem.map(q => (
            <Opcao key={q} ativo={deQuem === q} onClick={() => setDeQuem(q)} titulo={rotulo(q)}
              detalhe={q === 'geral' ? 'O fichário completo, com as siglas das três unidades.' : `As atividades da ${q} e as de todas, os feriados e as datas.`} />
          ))}
        </div>

        <p className="mt-2 text-[12.5px] font-semibold">2. O quê?</p>
        <div className="space-y-2" role="radiogroup" aria-label="O quê">
          <Opcao ativo={oQue === 'mudaram'} onClick={() => setOQue('mudaram')} titulo={deQuem === 'geral' ? 'Só as folhas que mudaram' : `Só as folhas que mudaram para a ${deQuem}`}
            detalhe={mudaram.length ? 'Já vêm marcados os meses que mudaram desde a impressão.' : 'Nada mudou desde a impressão; escolham os meses que quiserem.'}>
            {oQue === 'mudaram' && (
              <div className="mt-2 space-y-2 pl-6">
                <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6" data-testid="meses-para-baixar">
                  {MESES.map((nome, i) => {
                    const m = i + 1; const marcado = meses.includes(m); const mudou = mudaram.includes(m);
                    return (
                      <button key={nome} type="button" role="checkbox" aria-checked={marcado} aria-label={`${nome}${mudou ? ' (mudou)' : ''}`} onClick={() => alternar(m)}
                        className={`flex items-center gap-1.5 rounded-[10px] border px-2 py-1.5 text-[12px] ${mudou ? 'border-[#e8a596] bg-[#fde3dd] font-semibold text-[#a53a26] dark:border-[#7a3a2c] dark:bg-[#5a2a20] dark:text-[#ffc9bd]' : 'border-black/10 bg-card dark:border-white/10'}`}>
                        <span className={`grid h-3.5 w-3.5 shrink-0 place-items-center rounded-[4px] border ${marcado ? 'border-foreground bg-foreground' : 'border-black/25 dark:border-white/30'}`}>{marcado && <Check className="h-2.5 w-2.5 text-background" />}</span>{nome.slice(0, 3)}
                      </button>
                    );
                  })}
                </div>
                <div>
                  <p className="text-[12px] font-semibold">De cada mês</p>
                  <div className="mt-1 flex flex-wrap gap-1.5" role="radiogroup" aria-label="De cada mês">
                    <button type="button" role="radio" aria-checked={!anotacoes} onClick={() => setAnotacoes(false)} className={`rounded-full border px-3 py-1 text-[12px] ${!anotacoes ? 'border-foreground/40 bg-accent font-semibold' : 'border-black/10 bg-card dark:border-white/10'}`}>Só a folha da grade (1)</button>
                    <button type="button" role="radio" aria-checked={anotacoes} onClick={() => setAnotacoes(true)} className={`rounded-full border px-3 py-1 text-[12px] ${anotacoes ? 'border-foreground/40 bg-accent font-semibold' : 'border-black/10 bg-card dark:border-white/10'}`}>A grade e as 2 folhas de anotação (3)</button>
                  </div>
                </div>
              </div>
            )}
          </Opcao>
          <Opcao ativo={oQue === 'inteiro'} onClick={() => setOQue('inteiro')} titulo={deQuem === 'geral' ? 'O calendário inteiro, atualizado' : `O fichário inteiro da ${deQuem}`}
            detalhe="Capa, textos, os 12 meses e as folhas do fim, como o impresso." />
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <span className="text-[12.5px] text-muted-foreground" data-testid="resumo-do-download">
            {folhas === null ? 'O calendário inteiro' : folhas === 0 ? 'Escolham ao menos um mês' : `${folhas} ${folhas === 1 ? 'folha' : 'folhas'} · ${meses.map(m => MESES[m - 1]).join(', ')}`}
          </span>
          <Button className="gap-2" disabled={gerando || folhas === 0} onClick={() => void baixar()}>
            {gerando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} {gerando ? 'Montando o PDF…' : 'Baixar para imprimir'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
