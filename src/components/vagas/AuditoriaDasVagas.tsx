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
  return <span className="grid h-7 w-7 place-items-center rounded-lg bg-muted"><I className="h-3.5 w-3.5" aria-hidden /></span>;
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

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Auditoria <span className="text-sm font-normal text-muted-foreground">· ninguém altera nem apaga</span></h1>
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Período e tipo">
          {PERIODOS.map(([d, r]) => <Button key={r} size="sm" variant={dias === d ? 'default' : 'secondary'} className="h-8 rounded-full" onClick={() => setDias(d)}>{r}</Button>)}
          <span className="w-2" />
          <Button size="sm" variant={tipo === null ? 'default' : 'secondary'} className="h-8 rounded-full" onClick={() => setTipo(null)}>Tudo</Button>
          {(Object.keys(TIPOS_DE_REGISTRO) as TipoDeRegistro[]).map((k) => (
            <Button key={k} size="sm" variant={tipo === k ? 'default' : 'secondary'} className="h-8 rounded-full" onClick={() => setTipo(k)}>{TIPOS_DE_REGISTRO[k].rotulo}</Button>
          ))}
          <span className="w-2" />
          <Button size="sm" variant="outline" className="h-8" disabled={!vistos.filtrada.length} onClick={() => baixarArquivo(csv(vistos.filtrada), `auditoria-vagas-${dias}-dias.csv`)}><Download className="h-4 w-4" /> Planilha</Button>
        </div>
      </div>

      {pendentes.map((a) => (
        <div key={`${a.quem}-${a.hora}`} role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-900 dark:bg-red-950/50 dark:text-red-100" data-testid="alerta">
          <span className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span><b>Fora do comum:</b> {a.quem_nome ?? 'alguém'} abriu <b>{a.quantidade} fichas ou currículos</b> em 1 hora ({quando(a.hora)}){a.vagas ? `, em ${a.vagas}` : ''}.{a.media_por_dia !== null ? ` Costuma abrir ${String(a.media_por_dia).replace('.', ',')} por dia.` : ''}</span>
          </span>
          <Button size="sm" variant="outline" className="bg-background text-foreground" onClick={() => conferir(a)}>Marcar como conferido</Button>
        </div>
      ))}

      <label className="relative w-full sm:w-80">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input aria-label="Buscar por pessoa, vaga ou protocolo" placeholder="Pessoa, vaga ou protocolo" className="pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </label>

      {erro && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950/60 dark:text-red-100">Não consegui abrir a auditoria. Recarregue a página.</p>}
      {lista === null ? <p className="text-sm text-muted-foreground">Carregando…</p> : vistos.agrupada.length === 0 ? (
        <p className="rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground">Nenhum registro no período.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr><th className="w-10 p-3" /><th className="p-3">Quando</th><th className="p-3">Quem</th><th className="p-3">O quê</th><th className="p-3">Sobre</th></tr>
            </thead>
            <tbody>
              {vistos.agrupada.map((r) => (
                <tr key={r.id} className="border-t border-border align-top" data-testid="registro">
                  <td className="p-3"><Icone acao={r.acao} /></td>
                  <td className="whitespace-nowrap p-3 tabular-nums">{r.vezes > 1 ? `${quando(r.em)}–${hora(r.ate)}` : quando(r.em)}</td>
                  <td className="p-3">{r.quem_nome ?? 'Sistema'}<span className="block text-xs text-muted-foreground">{ROTULO_DO_PAPEL[r.papel ?? ''] ?? ''}</span></td>
                  <td className="p-3">
                    {textoDoRegistro(r)}{r.vezes > 1 && <b> ×{r.vezes}</b>}
                    {tocaDadosPessoais(r.acao) && <span className="ml-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-[10.5px] font-bold text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">dados pessoais</span>}
                  </td>
                  <td className="p-3">{[r.protocolo, r.vaga_titulo].filter(Boolean).join(' · ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {lista && lista.length >= LIMITE_DA_LISTA && <p className="text-xs text-muted-foreground">Mostrando os {LIMITE_DA_LISTA} registros mais recentes. Diminua o período ou escolha um tipo para ver os outros.</p>}
    </div>
  );
}
