import { useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, Briefcase, Download, FileText, Mail, Search, ShieldAlert, Star, User } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { baixarArquivo } from '@/lib/enquetes/planilha';
import { semAcento } from '@/lib/vagas/rh';
import {
  LIMITE_DA_LISTA, ROTULO_DO_PAPEL, TIPOS_DE_REGISTRO, agruparSeguidos, alertasDaAuditoria, conferirAlerta, listarAuditoria, textoDoRegistro, tocaDadosPessoais,
  type Alerta, type Registro, type TipoDeRegistro,
} from '@/lib/vagas/auditoria';

/**
 * Vagas › Auditoria (passo 6 do roteiro, mockup aprovado em 20/10/2026): o
 * registro de quem acessou dados de candidatos e de quem mexeu nos
 * processos. Só administradores; ninguém apaga. No topo, o aviso de "fora do
 * comum" (mais de 30 fichas ou currículos abertos em 1 hora).
 */

const PERIODOS: Array<[number, string]> = [[7, '7 dias'], [30, '30 dias'], [90, '90 dias']];
const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

function Icone({ acao }: { acao: string }) {
  const I = acao === 'curriculo.aberto' ? FileText : acao === 'ficha.aberta' ? User : acao === 'planilha.baixada' ? Download
    : acao === 'candidato.movido' ? ArrowRightLeft : acao === 'mensagem.enviada' ? Mail : acao === 'responsavel.nomeado' ? Star : Briefcase;
  return <span className="grid h-7 w-7 place-items-center rounded-[8px] bg-muted text-muted-foreground"><I className="h-3.5 w-3.5" aria-hidden /></span>;
}

const csv = (lista: Registro[]) => {
  const campo = (v: string) => (/[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const linhas = lista.map((r) => [new Date(r.em).toLocaleString('pt-BR'), r.quem_nome ?? '', ROTULO_DO_PAPEL[r.papel ?? ''] ?? '', textoDoRegistro(r), r.protocolo ?? '', r.vaga_titulo ?? ''].map(campo).join(';'));
  return '﻿' + ['Quando;Quem;Papel;O quê;Protocolo;Vaga', ...linhas].join('\r\n') + '\r\n';
};

export function AuditoriaDasVagas() {
  const [dias, setDias] = useState(7);
  const [tipo, setTipo] = useState<TipoDeRegistro | null>(null);
  const [busca, setBusca] = useState('');
  const [lista, setLista] = useState<Registro[] | null>(null);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [erro, setErro] = useState(false);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let vivo = true;
    setErro(false);
    listarAuditoria({ dias, quem: null, tipo }).then((l) => { if (vivo) setLista(l); }).catch(() => { if (vivo) { setErro(true); setLista([]); } });
    return () => { vivo = false; };
  }, [dias, tipo, versao]);

  useEffect(() => {
    alertasDaAuditoria(30).then(setAlertas).catch(() => setAlertas([]));
  }, [versao]);

  const vistos = useMemo(() => {
    const termo = semAcento(busca.trim());
    const filtrada = (lista ?? []).filter((r) => !termo || semAcento(`${r.quem_nome ?? ''} ${r.vaga_titulo ?? ''} ${r.protocolo ?? ''}`).includes(termo));
    return { filtrada, agrupada: agruparSeguidos(filtrada) };
  }, [lista, busca]);

  const pendentes = alertas.filter((a) => !a.conferido);

  async function conferir(a: Alerta) {
    try { await conferirAlerta(a); toast.success('Alerta marcado como conferido'); setVersao((n) => n + 1); }
    catch { toast.error('Não deu para marcar. Tente de novo.'); }
  }

  // Esboço V2: abas segmentadas para período e tipo; tabela sólida que vira lista empilhada no celular.
  const segmento = 'inline-flex max-w-full gap-0.5 overflow-x-auto rounded-[14px] bg-muted p-1';
  const opcao = (ativa: boolean) => `inline-flex shrink-0 items-center whitespace-nowrap rounded-[10px] px-3 py-1.5 text-[13.5px] transition-colors ${ativa ? 'bg-card font-semibold text-foreground shadow-[0_1px_3px_hsl(165_30%_12%/0.12)]' : 'font-medium text-muted-foreground hover:text-foreground'}`;
  const pessoal = <span className="ml-2 inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-warning"><span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />dados pessoais</span>;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold leading-tight">Auditoria</h1>
          <p className="text-sm text-muted-foreground">Trabalhe Conosco · ninguém altera nem apaga</p>
        </div>
        <Button variant="outline" disabled={!vistos.filtrada.length} onClick={() => baixarArquivo(csv(vistos.filtrada), `auditoria-vagas-${dias}-dias.csv`)}><Download className="h-4 w-4" /> Planilha</Button>
      </div>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Período e tipo">
        <div className={segmento}>
          {PERIODOS.map(([d, r]) => <button key={r} type="button" aria-pressed={dias === d} className={opcao(dias === d)} onClick={() => setDias(d)}>{r}</button>)}
        </div>
        <div className={segmento}>
          <button type="button" aria-pressed={tipo === null} className={opcao(tipo === null)} onClick={() => setTipo(null)}>Tudo</button>
          {(Object.keys(TIPOS_DE_REGISTRO) as TipoDeRegistro[]).map((k) => (
            <button key={k} type="button" aria-pressed={tipo === k} className={opcao(tipo === k)} onClick={() => setTipo(k)}>{TIPOS_DE_REGISTRO[k].rotulo}</button>
          ))}
        </div>
      </div>

      {pendentes.map((a) => (
        <div key={`${a.quem}-${a.hora}`} role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-destructive/30 bg-card px-4 py-3 text-sm text-foreground" data-testid="alerta">
          <span className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
            <span><b className="text-destructive">Fora do comum:</b> {a.quem_nome ?? 'alguém'} abriu <b>{a.quantidade} fichas ou currículos</b> em 1 hora ({quando(a.hora)}){a.vagas ? `, em ${a.vagas}` : ''}.{a.media_por_dia !== null ? ` Costuma abrir ${String(a.media_por_dia).replace('.', ',')} por dia.` : ''}</span>
          </span>
          <Button size="sm" variant="outline" onClick={() => conferir(a)}>Marcar como conferido</Button>
        </div>
      ))}

      <label className="relative w-full sm:w-80">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input aria-label="Buscar por pessoa, vaga ou protocolo" placeholder="Pessoa, vaga ou protocolo" className="pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </label>

      {erro && <p role="alert" className="text-sm font-semibold text-destructive">Não consegui abrir a auditoria. Recarregue a página.</p>}
      {lista === null ? <p className="text-sm text-muted-foreground">Carregando…</p> : vistos.agrupada.length === 0 ? (
        <p className="rounded-[20px] border border-dashed border-border p-6 text-sm text-muted-foreground">Nenhum registro no período.</p>
      ) : (
        <>
          {/* computador: a tabela */}
          <div className="hidden overflow-x-auto rounded-[20px] border border-black/5 bg-card dark:border-white/5 md:block">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="text-left text-xs font-semibold text-muted-foreground">
                <tr className="border-b border-border"><th className="w-10 py-3 pl-4 pr-1" /><th className="px-4 py-3">Quando</th><th className="px-4 py-3">Quem</th><th className="px-4 py-3">O quê</th><th className="px-4 py-3">Sobre</th></tr>
              </thead>
              <tbody>
                {vistos.agrupada.map((r) => (
                  <tr key={r.id} className="border-t border-border/70 align-top transition-colors hover:bg-muted/40" data-testid="registro">
                    <td className="py-3 pl-4 pr-1"><Icone acao={r.acao} /></td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums">{r.vezes > 1 ? `${quando(r.em)}–${hora(r.ate)}` : quando(r.em)}</td>
                    <td className="px-4 py-3">{r.quem_nome ?? 'Sistema'}<span className="block text-xs text-[hsl(var(--fraco,0_0%_45%))]">{ROTULO_DO_PAPEL[r.papel ?? ''] ?? ''}</span></td>
                    <td className="px-4 py-3">
                      {textoDoRegistro(r)}{r.vezes > 1 && <b> ×{r.vezes}</b>}
                      {tocaDadosPessoais(r.acao) && pessoal}
                    </td>
                    <td className="px-4 py-3">{[r.protocolo, r.vaga_titulo].filter(Boolean).join(' · ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* celular: cada registro numa linha empilhada */}
          <div className="overflow-hidden rounded-[20px] border border-black/5 bg-card dark:border-white/5 md:hidden">
            {vistos.agrupada.map((r) => (
              <div key={r.id} className="grid grid-cols-[28px_minmax(0,1fr)] gap-3 border-b border-border/70 px-4 py-3.5 last:border-b-0">
                <Icone acao={r.acao} />
                <div className="min-w-0 text-sm">
                  <p>{textoDoRegistro(r)}{r.vezes > 1 && <b> ×{r.vezes}</b>}{tocaDadosPessoais(r.acao) && pessoal}</p>
                  <p className="text-xs text-[hsl(var(--fraco,0_0%_45%))]">
                    <span className="tabular-nums">{r.vezes > 1 ? `${quando(r.em)}–${hora(r.ate)}` : quando(r.em)}</span> · {r.quem_nome ?? 'Sistema'}{ROTULO_DO_PAPEL[r.papel ?? ''] ? ` (${ROTULO_DO_PAPEL[r.papel ?? '']})` : ''}
                  </p>
                  {(r.protocolo || r.vaga_titulo) && <p className="text-xs text-muted-foreground">{[r.protocolo, r.vaga_titulo].filter(Boolean).join(' · ')}</p>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {lista && lista.length >= LIMITE_DA_LISTA && <p className="text-xs text-muted-foreground">Mostrando os {LIMITE_DA_LISTA} registros mais recentes. Diminua o período ou escolha um tipo para ver os outros.</p>}
    </div>
  );
}
