import { useEffect, useMemo, useState } from 'react';
import { Download, Lock, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useUserRole } from '@/hooks/useUserRole';
import { baixarArquivo } from '@/lib/enquetes/planilha';
import { apagarInscricao, lerMetas, listarInscricoes, type Inscricao } from '@/lib/voluntariado/api';
import { AREAS_DE_AJUDA, CAMINHO_DO_FORMULARIO, areaNosPaineis, PRAZO, ULTIMO_DIA, rotuloDaAjuda, rotuloDoHorario, rotuloDoVinculo, type AreaDeAjuda } from '@/lib/voluntariado/modelo';
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
  // As áreas do formulário, e alguma tirada (23/10/2026) que alguém já tenha escolhido.
  const escolhidas = (lista ?? []).flatMap((i) => [i.opcao1, i.opcao2]);
  const porArea = AREAS_DE_AJUDA.filter((a) => areaNosPaineis(a.chave, escolhidas)).map((a) => ({
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

  const numeros: Array<[string, string, boolean]> = [['Inscritos', String(daUnidade.length), false], ['Unidades', String(new Set(daUnidade.flatMap((i) => (i.unidade_id ? [i.unidade_id] : []))).size), false], ['Áreas sem ninguém', String(vazias), vazias > 0], ['Faltam', dias === 0 ? 'encerrado' : `${dias} ${dias === 1 ? 'dia' : 'dias'}`, false]];
  // Uma lista só para computador e celular: na tela larga vira tabela (colunas),
  // na estreita cada inscrição empilha em duas colunas, sem rolar para o lado.
  const COLUNAS = 'lg:grid-cols-[92px_minmax(0,1.1fr)_136px_minmax(0,1.3fr)_88px_minmax(0,1fr)_minmax(0,1fr)_40px]';

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold leading-tight">Voluntariado · Natal Feliz</h1>
          <p className="text-sm text-muted-foreground">Funcionários, Alcance JNI e voluntários de fora · até {ULTIMO_DIA} · evento em 08/12</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={copiarLink}>Copiar link do formulário</Button>
          <Button variant="outline" size="sm" onClick={carregar}>Atualizar</Button>
          <Button size="sm" disabled={!vistas.length} onClick={() => baixarArquivo(csvDasInscricoes(vistas), nomeDaPlanilha(unidade))}><Download className="h-4 w-4" /> Baixar planilha</Button>
        </div>
      </div>

      <PlanilhaDoGoogle inscritos={(lista ?? []).length} />
      <AoVivoDaGestao />
      {/* As metas valem para todas as inscrições, então leem a lista inteira (sem o filtro de unidade). */}
      <MetasPorArea metas={metas} primeiras={Object.fromEntries(AREAS_DE_AJUDA.map((a) => [a.chave, (lista ?? []).filter((i) => i.opcao1 === a.chave).length]))} onSalvas={setMetas} />

      {/* Esboço V2: filtro por unidade/vínculo como abas segmentadas */}
      <div className="inline-flex max-w-full gap-0.5 self-start overflow-x-auto rounded-[14px] bg-muted p-1" role="group" aria-label="Filtrar por unidade">
        {([[null, 'Todos'], ...unidades] as Array<[string | null, string]>).map(([id, nome]) => (
          <button
            key={id ?? 'todos'}
            type="button"
            aria-pressed={unidade === id}
            onClick={() => setUnidade(id)}
            className={`shrink-0 whitespace-nowrap rounded-[10px] px-3 py-1.5 text-[13.5px] transition-colors ${unidade === id ? 'bg-card font-semibold text-foreground shadow-[0_1px_3px_hsl(165_30%_12%/0.12)]' : 'font-medium text-muted-foreground hover:text-foreground'}`}
          >
            {nome}
          </button>
        ))}
      </div>

      {erro && <p role="alert" className="inline-flex items-center gap-1.5 text-sm font-semibold text-destructive"><span className="h-1.5 w-1.5 rounded-full bg-current" />Não consegui carregar as inscrições. Toque em Atualizar.</p>}

      {/* Faixa de números (padrão do Dashboard): cor só no número que pede ação */}
      <div className="glass-1 grid grid-cols-2 overflow-hidden rounded-[20px] lg:grid-cols-4">
        {numeros.map(([r, v, alerta], n) => (
          <div
            key={r}
            className={`border-black/10 p-4 dark:border-white/10 sm:px-5 ${n % 2 === 1 ? 'border-l' : ''} ${n >= 2 ? 'border-t lg:border-t-0' : ''} ${n === 2 ? 'lg:border-l' : ''}`}
            data-testid={`kpi-${r}`}
          >
            <b className={`block font-display text-2xl font-bold tabular-nums sm:text-3xl ${alerta ? 'text-destructive' : ''}`}>{v}</b>
            <span className="mt-0.5 block text-[13px] text-muted-foreground">{r}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1.5 rounded-[20px] border border-black/5 bg-card p-4 dark:border-white/5" aria-label="Por área">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <b className="text-[15px] font-semibold">Por área <span className="text-[13px] font-normal text-muted-foreground">(1ª opção /meta · a 2ª ao lado)</span></b>
          {area && <button type="button" className="text-[13px] font-semibold text-[hsl(var(--sel))] hover:underline" onClick={() => setArea(null)}>Ver todas as áreas</button>}
        </div>
        {porArea.map((a) => (
          <button key={a.chave} type="button" onClick={() => setArea(area === a.chave ? null : a.chave)} aria-pressed={area === a.chave}
            className={`grid min-h-9 grid-cols-[minmax(0,140px)_minmax(0,1fr)_76px] items-center gap-2.5 rounded-[10px] px-2 py-1 text-left text-sm transition-colors hover:bg-muted/60 sm:grid-cols-[minmax(0,190px)_minmax(0,1fr)_84px] ${area === a.chave ? 'bg-muted font-semibold' : ''} ${a.primeira === 0 ? 'text-destructive' : ''}`}
            data-testid="barra-area">
            <span className="truncate">{a.rotulo}</span>
            <span className="h-2 rounded-full bg-muted"><span className="block h-full rounded-full bg-[#2F6B52] dark:bg-[#81E2CF]" style={{ width: `${(a.primeira / max) * 100}%` }} /></span>
            <span className="text-right tabular-nums"><b>{a.primeira}</b>{a.meta ? <span className="text-xs text-muted-foreground">/{a.meta}</span> : null}{a.segunda ? <span className="text-xs text-muted-foreground"> +{a.segunda}</span> : null}</span>
          </button>
        ))}
      </div>

      {lista === null ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : vistas.length === 0 ? (
        <p className="rounded-[20px] border border-dashed border-border p-6 text-sm text-muted-foreground">{lista.length ? 'Ninguém com esse filtro.' : 'Nenhuma inscrição ainda. Copie o link do formulário e mande para as unidades.'}</p>
      ) : (
        <div className="overflow-hidden rounded-[20px] border border-black/5 bg-card text-sm dark:border-white/5">
          <div className={`hidden gap-3 border-b border-border px-4 py-3 text-xs font-semibold text-muted-foreground lg:grid ${COLUNAS}`} aria-hidden="true">
            <span>Protocolo</span><span>Nome</span><span>WhatsApp</span><span>Unidade / vínculo</span><span>Horário</span><span>1ª opção</span><span>2ª opção</span><span />
          </div>
          <ul>
            {vistas.map((i) => (
              <li key={i.id} className={`grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 border-b border-border/70 px-4 py-3.5 transition-colors last:border-b-0 hover:bg-muted/40 lg:items-center lg:gap-3 lg:py-2.5 ${COLUNAS}`} data-testid="inscricao">
                <span className="order-4 self-center text-right text-xs font-semibold tabular-nums text-[hsl(var(--fraco))] lg:order-none lg:text-left lg:text-sm lg:text-foreground">{i.protocolo}</span>
                <span className="order-1 min-w-0 self-center font-semibold lg:order-none lg:font-normal">{i.nome}</span>
                <span className="order-3 self-center"><a href={`https://wa.me/55${i.whatsapp}`} target="_blank" rel="noopener noreferrer" className="font-semibold tabular-nums text-[hsl(var(--sel))] hover:underline">{whatsappLegivel(i.whatsapp)}</a></span>
                <span className="order-5 col-span-2 lg:order-none lg:col-span-1">
                  {i.unidade_nome ?? rotuloDoVinculo(i.vinculo)}
                  {(i.indicado_por || i.igreja) && <small className="block text-xs text-[hsl(var(--fraco))]">{[i.indicado_por && `indicado(a) por ${i.indicado_por}`, i.igreja].filter(Boolean).join(' · ')}</small>}
                </span>
                <span className="order-7 text-right text-muted-foreground lg:order-none lg:text-left lg:text-foreground">{rotuloDoHorario(i.horario) || '—'}</span>
                <span className="order-6 lg:order-none"><span className="text-[hsl(var(--fraco))] lg:hidden">1ª </span>{rotuloDaAjuda(i.opcao1)}</span>
                <span className="order-8 col-span-2 text-muted-foreground lg:order-none lg:col-span-1"><span className="text-[hsl(var(--fraco))] lg:hidden">2ª </span>{i.opcao2 ? rotuloDaAjuda(i.opcao2) : '—'}</span>
                <span className="order-2 -mr-2 -mt-2 lg:order-none lg:m-0 lg:text-right"><Button variant="ghost" size="icon" className="h-11 w-11 text-muted-foreground hover:text-destructive lg:h-9 lg:w-9" aria-label={`Apagar ${i.protocolo}`} title="Apagar" onClick={() => setApagando(i)}><Trash2 className="h-4 w-4" /></Button></span>
              </li>
            ))}
          </ul>
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
