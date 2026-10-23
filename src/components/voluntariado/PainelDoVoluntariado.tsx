import { useEffect, useMemo, useState } from 'react';
import { Copy, Download, Lock, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useUserRole } from '@/hooks/useUserRole';
import { baixarArquivo } from '@/lib/enquetes/planilha';
import { apagarInscricao, lerMetas, listarInscricoes, type Inscricao } from '@/lib/voluntariado/api';
import { AREAS_DE_AJUDA, CAMINHO_DO_FORMULARIO, PRAZO, ULTIMO_DIA, rotuloDaAjuda, rotuloDoHorario, rotuloDoVinculo, type AreaDeAjuda } from '@/lib/voluntariado/modelo';
import { csvDasInscricoes, nomeDaPlanilha, whatsappLegivel } from '@/lib/voluntariado/planilha';
import { PlanilhaDoGoogle } from './PlanilhaDoGoogle';
import { AoVivoDaGestao } from './AoVivoDaGestao';
import { MetasPorArea } from './MetasPorArea';

/**
 * O painel do voluntariado do Natal Feliz (mockup aprovado em 20/10/2026):
 * só administradores e comunicação, como a Pizza. Inscritos, áreas sem
 * ninguém, quantos em cada área pela 1ª opção, a lista com WhatsApp (para o
 * contato do termo de voluntariado), filtros por unidade e área, a planilha
 * e o apagar (teste ou desistência). Desde 21/10/2026, também a planilha do
 * Google que se atualiza sozinha (PlanilhaDoGoogle). Desde 23/10/2026, o
 * vínculo e o horário de cada um, o filtro também por vínculo (Alcance JNI,
 * voluntários de fora) e as metas por área.
 */

export const LINK_DO_FORMULARIO = `https://app.anabrasil.org${CAMINHO_DO_FORMULARIO}`;

export function PainelDoVoluntariado() {
  const { isMarketing, loading } = useUserRole();
  const [lista, setLista] = useState<Inscricao[] | null>(null);
  const [erro, setErro] = useState(false);
  const [unidade, setUnidade] = useState<string | null>(null);
  const [area, setArea] = useState<AreaDeAjuda | null>(null);
  const [apagando, setApagando] = useState<Inscricao | null>(null);
  const [metas, setMetas] = useState<Record<string, number>>({});

  const carregar = () => {
    setErro(false);
    listarInscricoes().then(setLista).catch(() => { setErro(true); setLista([]); });
    lerMetas().then(setMetas).catch(() => { /* sem metas, as barras ficam sem o /meta */ });
  };
  useEffect(() => { if (isMarketing) carregar(); }, [isMarketing]);

  // O filtro: as unidades de quem é funcionário e, como se fossem unidades, o Alcance JNI e os voluntários de fora.
  const grupo = (i: Inscricao) => i.unidade_id ?? i.vinculo;
  const unidades = useMemo(() => {
    const m = new Map<string, string>();
    (lista ?? []).forEach((i) => m.set(grupo(i), i.unidade_nome ?? rotuloDoVinculo(i.vinculo)));
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  }, [lista]);
  const daUnidade = useMemo(() => (lista ?? []).filter((i) => !unidade || grupo(i) === unidade), [lista, unidade]);
  const vistas = useMemo(() => daUnidade.filter((i) => !area || i.opcao1 === area || i.opcao2 === area), [daUnidade, area]);

  if (loading) return null;
  if (!isMarketing) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-20 text-center">
        <Lock className="h-10 w-10 text-muted-foreground" />
        <h1 className="text-lg font-semibold">Acesso restrito</h1>
        <p className="text-sm text-muted-foreground">O painel do voluntariado é da comunicação e da administração.</p>
      </div>
    );
  }

  // Quantos em cada área: a barra conta a 1ª opção; a 2ª aparece ao lado, para remanejar.
  const porArea = AREAS_DE_AJUDA.map((a) => ({
    ...a,
    primeira: daUnidade.filter((i) => i.opcao1 === a.chave).length,
    segunda: daUnidade.filter((i) => i.opcao2 === a.chave).length,
    meta: metas[a.chave] ?? null,
  }));
  const max = Math.max(1, ...porArea.map((a) => a.primeira));
  const vazias = porArea.filter((a) => a.primeira === 0).length;
  const dias = Math.max(0, Math.ceil((PRAZO.getTime() - Date.now()) / 864e5));

  async function copiarLink() {
    try { await navigator.clipboard.writeText(LINK_DO_FORMULARIO); toast.success('Link do formulário copiado.'); }
    catch { toast.message(LINK_DO_FORMULARIO); }
  }

  async function apagar(i: Inscricao) {
    try { await apagarInscricao(i.id); setLista((l) => (l ?? []).filter((x) => x.id !== i.id)); toast.success(`Inscrição ${i.protocolo} apagada.`); }
    catch { toast.error('Não deu para apagar. Tente de novo.'); }
    finally { setApagando(null); }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Voluntariado · Natal Feliz</h1>
          <p className="text-sm text-muted-foreground">Funcionários, Alcance JNI e voluntários de fora · até {ULTIMO_DIA} · evento em 08/12</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={copiarLink}><Copy className="h-4 w-4" /> Copiar link do formulário</Button>
          <Button variant="outline" size="sm" onClick={carregar}><RefreshCw className="h-4 w-4" /> Atualizar</Button>
          <Button size="sm" disabled={!vistas.length} onClick={() => baixarArquivo(csvDasInscricoes(vistas), nomeDaPlanilha(unidade))}><Download className="h-4 w-4" /> Baixar planilha</Button>
        </div>
      </div>

      <PlanilhaDoGoogle inscritos={(lista ?? []).length} />
      <AoVivoDaGestao />
      {/* As metas valem para todas as inscrições, então leem a lista inteira (sem o filtro de unidade). */}
      <MetasPorArea metas={metas} primeiras={Object.fromEntries(AREAS_DE_AJUDA.map((a) => [a.chave, (lista ?? []).filter((i) => i.opcao1 === a.chave).length]))} onSalvas={setMetas} />

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por unidade">
        <Button size="sm" variant={unidade === null ? 'default' : 'secondary'} className="h-8 rounded-full" onClick={() => setUnidade(null)}>Todos</Button>
        {unidades.map(([id, nome]) => (
          <Button key={id} size="sm" variant={unidade === id ? 'default' : 'secondary'} className="h-8 rounded-full" onClick={() => setUnidade(id)}>{nome}</Button>
        ))}
      </div>

      {erro && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950/60 dark:text-red-100">Não consegui carregar as inscrições. Toque em Atualizar.</p>}

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
          {([['Inscritos', String(daUnidade.length), false], ['Unidades', String(new Set(daUnidade.flatMap((i) => (i.unidade_id ? [i.unidade_id] : []))).size), false], ['Áreas sem ninguém', String(vazias), vazias > 0], ['Faltam', dias === 0 ? 'encerrado' : `${dias} ${dias === 1 ? 'dia' : 'dias'}`, false]] as Array<[string, string, boolean]>).map(([r, v, alerta]) => (
            <div key={r} className="flex flex-col gap-0.5 bg-card p-4" data-testid={`kpi-${r}`}>
              <small className="text-[11px] uppercase tracking-wider text-muted-foreground">{r}</small>
              <b className={`text-2xl tabular-nums ${alerta ? 'text-red-700 dark:text-red-400' : ''}`}>{v}</b>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-1.5 border-t border-border p-4" aria-label="Por área">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <b className="text-sm">Por área <span className="font-normal text-muted-foreground">(1ª opção /meta · a 2ª ao lado)</span></b>
            {area && <button type="button" className="text-xs font-semibold underline" onClick={() => setArea(null)}>Ver todas as áreas</button>}
          </div>
          {porArea.map((a) => (
            <button key={a.chave} type="button" onClick={() => setArea(area === a.chave ? null : a.chave)} aria-pressed={area === a.chave}
              className={`grid grid-cols-[minmax(0,190px)_minmax(0,1fr)_84px] items-center gap-2.5 rounded-lg px-1.5 py-0.5 text-left text-sm hover:bg-muted/60 ${area === a.chave ? 'bg-muted' : ''} ${a.primeira === 0 ? 'text-red-700 dark:text-red-400' : ''}`}
              data-testid="barra-area">
              <span className="truncate">{a.rotulo}</span>
              <span className="h-2.5 rounded-full bg-muted"><span className="block h-full rounded-full bg-[#2F6B52]" style={{ width: `${(a.primeira / max) * 100}%` }} /></span>
              <span className="text-right tabular-nums"><b>{a.primeira}</b>{a.meta ? <span className="text-xs text-muted-foreground">/{a.meta}</span> : null}{a.segunda ? <span className="text-xs text-muted-foreground"> +{a.segunda}</span> : null}</span>
            </button>
          ))}
        </div>
      </div>

      {lista === null ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : vistas.length === 0 ? (
        <p className="rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground">{lista.length ? 'Ninguém com esse filtro.' : 'Nenhuma inscrição ainda. Copie o link do formulário e mande para as unidades.'}</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr><th className="p-3">Protocolo</th><th className="p-3">Nome</th><th className="p-3">WhatsApp</th><th className="p-3">Unidade / vínculo</th><th className="p-3">Horário</th><th className="p-3">1ª opção</th><th className="p-3">2ª opção</th><th className="p-3" /></tr>
            </thead>
            <tbody>
              {vistas.map((i) => (
                <tr key={i.id} className="border-t border-border" data-testid="inscricao">
                  <td className="p-3 font-semibold tabular-nums">{i.protocolo}</td>
                  <td className="p-3">{i.nome}</td>
                  <td className="p-3"><a href={`https://wa.me/55${i.whatsapp}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400">{whatsappLegivel(i.whatsapp)}</a></td>
                  <td className="p-3">
                    {i.unidade_nome ?? rotuloDoVinculo(i.vinculo)}
                    {(i.indicado_por || i.igreja) && <small className="block text-xs text-muted-foreground">{[i.indicado_por && `indicado(a) por ${i.indicado_por}`, i.igreja].filter(Boolean).join(' · ')}</small>}
                  </td>
                  <td className="p-3">{rotuloDoHorario(i.horario) || '—'}</td>
                  <td className="p-3">{rotuloDaAjuda(i.opcao1)}</td>
                  <td className="p-3 text-muted-foreground">{i.opcao2 ? rotuloDaAjuda(i.opcao2) : '—'}</td>
                  <td className="p-3 text-right"><Button variant="ghost" size="sm" aria-label={`Apagar ${i.protocolo}`} onClick={() => setApagando(i)}><Trash2 className="h-4 w-4" /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AlertDialog open={!!apagando} onOpenChange={(v) => { if (!v) setApagando(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar a inscrição {apagando?.protocolo}?</AlertDialogTitle>
            <AlertDialogDescription>{apagando?.nome} sai da lista. Use para inscrição de teste ou desistência; não dá para desfazer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => apagando && apagar(apagando)}>Apagar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
