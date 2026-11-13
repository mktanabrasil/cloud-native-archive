import { useEffect, useRef, useState } from 'react';
import { Check, Download, Eye, ImagePlus, Loader2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { aprovarComPdf, devolverAsCoordenadoras, linkDoArquivo, trocarCapa } from '@/lib/calendario/api';
import { prepararFotoDaCapa } from '@/lib/calendario/foto';
import { andamento, autoriaDe, diaEMes, type AnoDoCalendario, type ItemDoCalendario } from '@/lib/calendario/regras';
import { baixarPdfAprovado } from './SituacaoDoPdf';

const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });

function Selo({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${ok ? 'bg-[hsl(149_45%_92%)] text-[hsl(var(--success))] dark:bg-[hsl(149_30%_18%)]' : 'bg-[hsl(39_90%_92%)] text-[hsl(var(--warning))] dark:bg-[hsl(39_40%_18%)]'}`}>
      {ok && <Check className="h-3 w-3" />}{children}
    </span>
  );
}

/**
 * A revisão do marketing (13/11/2026, mockup aprovado de manhã): o que veio
 * preenchido, a foto da capa, a prévia, devolver com observação ou aprovar e
 * liberar o PDF. Ao aprovar, o PDF final (sem a marca de prévia) é gerado
 * aqui e guardado no balde; é esse arquivo que todas baixam.
 */
export function RevisaoDoMarketing({ ano, itens, quem, onAno, onPrevia }: {
  ano: AnoDoCalendario;
  itens: ItemDoCalendario[];
  /** O nome de quem aprova, para o registro. */
  quem: string;
  onAno: (a: AnoDoCalendario) => void;
  onPrevia: () => void;
}) {
  const a = andamento(ano);
  const atividades = itens.filter(i => i.tipo === 'atividade').length;
  const textosEditados = Object.keys(ano.textos ?? {}).length;
  const [capa, setCapa] = useState<string | null>(null);
  const [subindoCapa, setSubindoCapa] = useState(false);
  const [devolvendo, setDevolvendo] = useState(false);
  const [observacao, setObservacao] = useState('');
  const [confirmarAprovacao, setConfirmarAprovacao] = useState(false);
  const [fase, setFase] = useState<'parado' | 'gerando' | 'enviando'>('parado');
  const arquivo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let vivo = true;
    setCapa(null);
    if (ano.capa_url) linkDoArquivo(ano.capa_url).then(u => { if (vivo) setCapa(u); }).catch(() => {});
    return () => { vivo = false; };
  }, [ano.capa_url]);

  const escolherFoto = async (f: File | undefined) => {
    if (!f) return;
    setSubindoCapa(true);
    try {
      const { foto, extensao } = await prepararFotoDaCapa(f);
      onAno(await trocarCapa(ano, foto, extensao));
      toast.success('Foto da capa trocada');
    } catch (e) { toast.error((e as Error).message || 'Não deu para trocar a foto.'); }
    finally { setSubindoCapa(false); if (arquivo.current) arquivo.current.value = ''; }
  };

  const devolver = async () => {
    try {
      onAno(await devolverAsCoordenadoras(ano.ano, observacao));
      toast.success(ano.status === 'aprovado' ? 'Reaberto para edição' : 'Devolvido às coordenadoras');
      setDevolvendo(false); setObservacao('');
    } catch (e) { toast.error((e as Error).message || 'Não deu para devolver agora.'); }
  };

  const aprovar = async () => {
    try {
      setFase('gerando');
      const [{ gerarPdfDoCalendario }, capaUrl] = await Promise.all([
        import('@/lib/calendario/pdf/gerar'),
        ano.capa_url ? linkDoArquivo(ano.capa_url) : Promise.resolve(null),
      ]);
      const r = await gerarPdfDoCalendario(ano, itens, { capaUrl, previa: false });
      setFase('enviando');
      onAno(await aprovarComPdf(ano, r.blob, quem));
      toast.success('Aprovado. O PDF está liberado para as coordenadoras.');
      setConfirmarAprovacao(false);
    } catch (e) { toast.error((e as Error).message || 'Não deu para aprovar agora.'); }
    finally { setFase('parado'); }
  };

  const subtitulo = ano.status === 'revisao'
    ? `Enviado${ano.enviado_por ? ` por ${ano.enviado_por}` : ''}${ano.enviado_em ? ` em ${diaEMes(ano.enviado_em)} às ${hora(ano.enviado_em)}` : ''}.`
    : ano.status === 'aprovado'
      ? `Aprovado${ano.aprovado_por ? ` por ${ano.aprovado_por}` : ''}${ano.aprovado_em ? ` em ${diaEMes(ano.aprovado_em)}` : ''}.`
      : 'Ainda em preenchimento pelas coordenadoras. Se precisar, o marketing aprova direto daqui.';

  const linhas: { titulo: string; detalhe: string; ok: boolean; autoria?: string | null }[] = [
    { titulo: 'Tema do ano', detalhe: ano.tema.trim() ? `“${ano.tema.trim()}”` : 'Ainda sem tema', ok: !!ano.tema.trim(), autoria: autoriaDe(ano, 'tema') },
    { titulo: 'Percursos', detalhe: `${a.percursos} de 12 meses`, ok: a.percursos === 12 },
    { titulo: 'Mês a mês', detalhe: `${a.meses} de 12 revisados · ${atividades} ${atividades === 1 ? 'atividade' : 'atividades'} das unidades`, ok: a.meses === 12 },
    { titulo: 'Textos do projeto', detalhe: textosEditados ? `${textosEditados} ${textosEditados === 1 ? 'seção editada' : 'seções editadas'}` : 'Iguais aos de 2026', ok: true },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-10 lg:px-6">
      <h1 className="font-display text-[28px] font-bold tracking-tight sm:text-[30px]">Calendário Anual {ano.ano} · revisão</h1>
      <p className="mt-1 text-[14px] text-muted-foreground">{subtitulo}</p>

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="glass-2 min-w-0 rounded-[22px] p-5">
          <h2 className="text-[16px] font-semibold">O que veio preenchido</h2>
          <div className="mt-3 divide-y divide-black/[.07] dark:divide-white/10">
            {linhas.map(l => (
              <div key={l.titulo} className="flex items-center justify-between gap-3 py-2.5 text-[14px]">
                <span className="min-w-0">
                  <b className="font-semibold">{l.titulo}</b>
                  <span className="block text-[12.5px] text-muted-foreground">{l.detalhe}{l.autoria ? ` · por ${l.autoria}` : ''}</span>
                </span>
                <Selo ok={l.ok}>{l.ok ? 'ok' : 'falta'}</Selo>
              </div>
            ))}
          </div>

          <h2 className="mt-5 text-[16px] font-semibold">A parte do marketing</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-[220px_minmax(0,1fr)]">
            <div className="relative grid place-items-center overflow-hidden rounded-[14px] border border-black/10 bg-[#d9dde0] dark:border-white/10" style={{ aspectRatio: '842/461' }}>
              {capa ? <img src={capa} alt="Foto da capa" className="h-full w-full object-cover" /> : <span className="px-3 text-center text-[12px] text-[#5f6b73]">{ano.capa_url ? 'Carregando…' : 'Sem foto ainda'}</span>}
              {subindoCapa && <span className="absolute inset-0 grid place-items-center bg-white/70"><Loader2 className="h-5 w-5 animate-spin" /></span>}
            </div>
            <div className="text-[13.5px] leading-relaxed text-muted-foreground">
              <p><b className="text-foreground">Foto da capa</b>: escolhida aqui, pelo marketing. Foto deitada funciona melhor; a grande é reduzida antes de subir.{autoriaDe(ano, 'capa') ? ` Última troca: ${autoriaDe(ano, 'capa')}.` : ''}</p>
              <input ref={arquivo} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" aria-label="Foto da capa" onChange={e => void escolherFoto(e.target.files?.[0])} />
              <div className="mt-2 flex flex-wrap gap-2">
                <Button variant="outline" className="gap-2" disabled={subindoCapa || ano.status === 'aprovado'} onClick={() => arquivo.current?.click()}><ImagePlus className="h-4 w-4" /> {ano.capa_url ? 'Trocar a foto' : 'Escolher a foto'}</Button>
                <Button variant="outline" className="gap-2" onClick={onPrevia}><Eye className="h-4 w-4" /> Ver a prévia completa</Button>
              </div>
              <p className="mt-2"><b className="text-foreground">Diagramação</b>: automática, no formato de 2026.</p>
            </div>
          </div>

          {ano.status !== 'aprovado' ? (
            <div className="mt-5 space-y-3">
              {devolvendo && (
                <div className="rounded-[14px] border border-black/10 bg-card/70 p-3 dark:border-white/10">
                  <label htmlFor="obs-devolucao" className="text-[13px] font-semibold">O que as coordenadoras precisam ajustar</label>
                  <Textarea id="obs-devolucao" className="mt-1.5" rows={3} value={observacao} maxLength={600} onChange={e => setObservacao(e.target.value)} placeholder="Ex.: faltam as atividades de março da unidade Santana." />
                  <div className="mt-2 flex justify-end gap-2">
                    <Button variant="ghost" onClick={() => { setDevolvendo(false); setObservacao(''); }}>Cancelar</Button>
                    <Button disabled={!observacao.trim()} onClick={() => void devolver()}>Devolver</Button>
                  </div>
                </div>
              )}
              <div className="flex flex-wrap justify-end gap-2">
                {ano.status === 'revisao' && !devolvendo && <Button variant="outline" className="gap-2" onClick={() => setDevolvendo(true)}><Undo2 className="h-4 w-4" /> Devolver com observação</Button>}
                <Button className="gap-2" disabled={!ano.capa_url || fase !== 'parado'} onClick={() => setConfirmarAprovacao(true)}><Check className="h-4 w-4" /> Aprovar e liberar o PDF</Button>
              </div>
              {!ano.capa_url && <p className="text-right text-[12.5px] text-muted-foreground">Para aprovar, escolha antes a foto da capa.</p>}
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {devolvendo && (
                <div className="rounded-[14px] border border-black/10 bg-card/70 p-3 dark:border-white/10">
                  <label htmlFor="obs-reabrir" className="text-[13px] font-semibold">Observação para as coordenadoras (opcional)</label>
                  <Textarea id="obs-reabrir" className="mt-1.5" rows={3} value={observacao} maxLength={600} onChange={e => setObservacao(e.target.value)} />
                  <div className="mt-2 flex justify-end gap-2">
                    <Button variant="ghost" onClick={() => { setDevolvendo(false); setObservacao(''); }}>Cancelar</Button>
                    <Button onClick={() => void devolver()}>Reabrir</Button>
                  </div>
                </div>
              )}
              <div className="flex flex-wrap justify-end gap-2">
                {!devolvendo && <Button variant="outline" className="gap-2" onClick={() => setDevolvendo(true)}><Undo2 className="h-4 w-4" /> Reabrir para edição</Button>}
                <Button className="gap-2" disabled={!ano.pdf_url} onClick={() => void baixarPdfAprovado(ano)}><Download className="h-4 w-4" /> Baixar o PDF aprovado</Button>
              </div>
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <p className="px-1 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">O que as coordenadoras veem</p>
          <section className="glass-2 rounded-[22px] p-4 text-[13.5px] leading-snug">
            {ano.status === 'preenchimento' && <p>O calendário está aberto para elas preencherem{ano.observacao ? ', com a sua observação no topo' : ''}.</p>}
            {ano.status === 'revisao' && <p>“Em revisão”: a edição está fechada e o botão de baixar aparece travado.</p>}
            {ano.status === 'aprovado' && <p>“Aprovado”, com o botão <b>Baixar o PDF</b>.</p>}
            <p className="mt-2 text-[12.5px] text-muted-foreground">Se você devolver, a observação aparece no topo para elas e o calendário volta a ficar editável.</p>
          </section>
        </aside>
      </div>

      <AlertDialog open={confirmarAprovacao} onOpenChange={o => { if (fase === 'parado') setConfirmarAprovacao(o); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aprovar e liberar o PDF de {ano.ano}?</AlertDialogTitle>
            <AlertDialogDescription>
              O PDF final é gerado agora, com o que está preenchido e a foto da capa, e fica disponível para as coordenadoras baixarem. Dá para reabrir depois, se precisar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={fase !== 'parado'}>Ainda não</AlertDialogCancel>
            <AlertDialogAction disabled={fase !== 'parado'} onClick={e => { e.preventDefault(); void aprovar(); }}>
              {fase === 'gerando' ? 'Gerando o PDF…' : fase === 'enviando' ? 'Guardando…' : 'Aprovar e liberar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
