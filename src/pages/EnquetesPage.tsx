import { useCallback, useEffect, useState } from 'react';
import { Copy, CopyPlus, Download, Link2, Lock, LockOpen, MessageCircle, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useUserRole } from '@/hooks/useUserRole';
import { EnqueteFormDialog, type ModoDoFormulario } from '@/components/enquetes/EnqueteFormDialog';
import { tomDaCor } from '@/components/enquetes/PecasDaEnquete';
import type { Enquete, ResultadoDaEnquete } from '@/lib/enquetes/modelo';
import { estaAberta, lider, percentual } from '@/lib/enquetes/modelo';
import { apagarEnquete, apagarVoto, encerrarEnquete, listarEnquetes, listarVotos, reabrirEnquete, resultado as buscarResultado, type VotoDaEquipe } from '@/lib/enquetes/api';
import { baixarArquivo, csvDosVotos, nomeDaPlanilha } from '@/lib/enquetes/planilha';
import { formatarTelefone } from '@/lib/enquetes/telefone';
import { linksDaEnquete, textoDoWhatsAppDaEnquete } from '@/lib/enquetes/links';

/**
 * A aba "Enquetes" do Painel do Marketing (23/09/2026): tudo registrado —
 * estado, votos, quem lidera — com encerrar, reabrir, apagar e os links.
 * Desde 25/09 (PR 2): editar, duplicar, ver e apagar votos, baixar a lista.
 */
export default function EnquetesPage() {
  const { isMarketing, userName } = useUserRole();
  const [enquetes, setEnquetes] = useState<Enquete[] | null>(null);
  const [resultados, setResultados] = useState<Record<string, ResultadoDaEnquete>>({});
  /** O formulário aberto: nova, editar ou duplicar, com a enquete de partida. */
  const [formulario, setFormulario] = useState<{ modo: ModoDoFormulario; enquete: Enquete | null } | null>(null);
  /** A enquete cujos votos estão abertos, com a lista. */
  const [votosDe, setVotosDe] = useState<Enquete | null>(null);
  const [votos, setVotos] = useState<VotoDaEquipe[] | null>(null);
  const [apagandoVoto, setApagandoVoto] = useState<VotoDaEquipe | null>(null);
  const [links, setLinks] = useState<Enquete | null>(null);
  const [apagando, setApagando] = useState<Enquete | null>(null);

  const carregar = useCallback(async () => {
    try {
      const lista = await listarEnquetes();
      setEnquetes(lista);
      const pares = await Promise.all(lista.map(async e => [e.slug, await buscarResultado(e.slug, true)] as const));
      setResultados(Object.fromEntries(pares.filter(([, r]) => r).map(([s, r]) => [s, r!])));
    } catch (erro) {
      toast.error('Não deu para carregar as enquetes', { description: erro instanceof Error ? erro.message : undefined });
      setEnquetes([]);
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  const agir = async (acao: () => Promise<void>, feito: string) => {
    try { await acao(); toast.success(feito); await carregar(); } catch (erro) { toast.error('Não deu', { description: erro instanceof Error ? erro.message : undefined }); }
  };

  const copiar = async (texto: string, rotulo: string) => {
    try { await navigator.clipboard.writeText(texto); toast.success(`${rotulo} copiado`, { description: texto }); } catch { toast.error('Não deu para copiar', { description: texto }); }
  };

  const abrirVotos = async (e: Enquete) => {
    setVotosDe(e);
    setVotos(null);
    try { setVotos(await listarVotos(e.id)); } catch (erro) { toast.error('Não deu para carregar os votos', { description: erro instanceof Error ? erro.message : (erro as { message?: string })?.message }); setVotos([]); }
  };

  const baixarPlanilha = (e: Enquete, lista: VotoDaEquipe[]) => {
    const csv = csvDosVotos(e, lista.map(v => ({ nome: v.nome, telefone: formatarTelefone(v.telefone), opcao_id: v.opcao_id, em: v.alterado_em ?? v.votado_em, trocou: !!v.alterado_em })));
    baixarArquivo(csv, nomeDaPlanilha(e.slug));
    toast.success('Planilha baixada', { description: `${lista.length} ${lista.length === 1 ? 'voto' : 'votos'}` });
  };

  const confirmarApagarVoto = async () => {
    if (!apagandoVoto || !votosDe) return;
    try {
      await apagarVoto(apagandoVoto.id);
      toast.success('Voto apagado', { description: apagandoVoto.nome || formatarTelefone(apagandoVoto.telefone) });
      setApagandoVoto(null);
      await abrirVotos(votosDe);
      await carregar();
    } catch (erro) {
      toast.error('Não deu para apagar', { description: erro instanceof Error ? erro.message : (erro as { message?: string })?.message });
    }
  };

  if (!isMarketing) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Enquetes</h2>
          <p className="text-sm text-muted-foreground">Crie, mande o link de voto no grupo e o de acompanhamento para a chefia.</p>
        </div>
        <Button className="gap-1.5" onClick={() => setFormulario({ modo: 'nova', enquete: null })} data-testid="nova-enquete"><Plus className="h-4 w-4" /> Nova enquete</Button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/60 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="px-3.5 py-2.5 font-semibold">Enquete</th>
              <th className="px-3.5 py-2.5 font-semibold">Estado</th>
              <th className="px-3.5 py-2.5 font-semibold">Votos</th>
              <th className="px-3.5 py-2.5 font-semibold">Liderando</th>
              <th className="px-3.5 py-2.5 font-semibold">Encerra</th>
              <th className="px-3.5 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {enquetes === null && <tr><td colSpan={6} className="px-3.5 py-6 text-center text-muted-foreground">Carregando…</td></tr>}
            {enquetes?.length === 0 && <tr><td colSpan={6} className="px-3.5 py-8 text-center text-muted-foreground">Nenhuma enquete ainda. Crie a primeira.</td></tr>}
            {enquetes?.map(e => {
              const r = resultados[e.slug];
              const aberta = estaAberta(e);
              const l = r ? lider(e.opcoes, r.por_opcao) : null;
              return (
                <tr key={e.id} className="border-t border-border align-middle" data-testid={`enquete-${e.slug}`}>
                  <td className="px-3.5 py-3">
                    <b>{e.pergunta}</b>
                    <br />
                    <small className="text-muted-foreground">criada {format(new Date(e.created_at), 'dd/MM', { locale: ptBR })}{e.criada_por ? ` por ${e.criada_por}` : ''}</small>
                  </td>
                  <td className="px-3.5 py-3">
                    {aberta ? (
                      <span className="rounded-full bg-[#E4F8F3] px-2.5 py-0.5 text-[11px] font-semibold text-[#0E6B58] dark:bg-[#153A32] dark:text-[#8FE3CF]">Aberta</span>
                    ) : (
                      <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">Encerrada</span>
                    )}
                  </td>
                  <td className="px-3.5 py-3 tabular-nums"><b>{r?.total ?? '—'}</b></td>
                  <td className="px-3.5 py-3">
                    {l && r ? (
                      <span className="inline-flex items-center gap-1.5"><span className={`h-[9px] w-[9px] rounded-full ${tomDaCor(l.cor).forte}`} />{l.titulo} · {percentual(r.por_opcao[l.id] ?? 0, r.total)}%</span>
                    ) : r && r.total > 0 ? 'empate' : '—'}
                  </td>
                  <td className="px-3.5 py-3 whitespace-nowrap text-muted-foreground">
                    {e.encerrada_em ? `à mão, ${format(new Date(e.encerrada_em), 'dd/MM HH:mm', { locale: ptBR })}` : e.encerra_em ? format(new Date(e.encerra_em), 'dd/MM HH:mm', { locale: ptBR }) : 'sem prazo'}
                  </td>
                  <td className="px-3.5 py-3 whitespace-nowrap text-right">
                    <Button variant="outline" size="sm" className="ml-1.5 gap-1" onClick={() => setLinks(e)}><Link2 className="h-3.5 w-3.5" /> Links</Button>
                    <Button variant="outline" size="sm" className="ml-1.5 gap-1" onClick={() => abrirVotos(e)} data-testid={`votos-${e.slug}`}><Users className="h-3.5 w-3.5" /> Votos</Button>
                    <Button variant="ghost" size="sm" className="ml-1.5" aria-label="Editar" title="Editar" onClick={() => setFormulario({ modo: 'editar', enquete: e })} data-testid={`editar-${e.slug}`}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="sm" className="ml-1.5" aria-label="Duplicar" title="Duplicar" onClick={() => setFormulario({ modo: 'duplicar', enquete: e })} data-testid={`duplicar-${e.slug}`}><CopyPlus className="h-3.5 w-3.5" /></Button>
                    {aberta ? (
                      <Button variant="outline" size="sm" className="ml-1.5 gap-1" onClick={() => agir(() => encerrarEnquete(e.id), 'Enquete encerrada')}><Lock className="h-3.5 w-3.5" /> Encerrar</Button>
                    ) : e.encerrada_em ? (
                      <Button variant="outline" size="sm" className="ml-1.5 gap-1" onClick={() => agir(() => reabrirEnquete(e.id), 'Enquete reaberta')}><LockOpen className="h-3.5 w-3.5" /> Reabrir</Button>
                    ) : null}
                    <Button variant="ghost" size="sm" className="ml-1.5 text-muted-foreground hover:text-destructive" aria-label="Apagar" onClick={() => setApagando(e)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <EnqueteFormDialog
        open={!!formulario}
        onOpenChange={a => !a && setFormulario(null)}
        modo={formulario?.modo ?? 'nova'}
        enquete={formulario?.enquete ?? null}
        votosPorOpcao={formulario?.enquete ? resultados[formulario.enquete.slug]?.por_opcao ?? {} : {}}
        criadaPor={userName || 'Marketing'}
        onSalva={e => {
          // Criada ou duplicada: os links, prontos para mandar. Editada: só a lista.
          if (formulario?.modo !== 'editar') setLinks(e);
          setFormulario(null);
          void carregar();
        }}
      />

      {/* Os votos, com o número inteiro (só a equipe vê), apagar e planilha. */}
      <Dialog open={!!votosDe} onOpenChange={a => { if (!a) { setVotosDe(null); setVotos(null); } }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg" data-testid="dialogo-votos">
          {votosDe && (
            <>
              <DialogHeader>
                <DialogTitle>Votos · {votosDe.pergunta}</DialogTitle>
                <DialogDescription>{votos === null ? 'Carregando…' : `${votos.length} ${votos.length === 1 ? 'voto' : 'votos'}. Só a equipe vê o número inteiro.`}</DialogDescription>
              </DialogHeader>
              {votos && votos.length > 0 && (
                <>
                  <ul className="divide-y divide-border rounded-xl border border-border text-sm">
                    {votos.map(v => {
                      const o = votosDe.opcoes.find(x => x.id === v.opcao_id);
                      return (
                        <li key={v.id} className="flex items-center gap-2.5 px-3 py-2.5" data-testid="linha-voto">
                          {o && <span className={`h-[9px] w-[9px] shrink-0 rounded-full ${tomDaCor(o.cor).forte}`} aria-hidden="true" />}
                          <div className="min-w-0 flex-1">
                            <b className="block truncate">{v.nome || 'Sem nome'}</b>
                            <small className="block text-muted-foreground tabular-nums">
                              {v.telefone.startsWith('ap:') ? 'aparelho anônimo' : formatarTelefone(v.telefone)} · {o?.titulo ?? '(opção removida)'}
                              {v.alterado_em ? ' · trocou' : ''} · {format(new Date(v.alterado_em ?? v.votado_em), 'dd/MM HH:mm', { locale: ptBR })}
                            </small>
                          </div>
                          <Button variant="ghost" size="sm" className="shrink-0 text-muted-foreground hover:text-destructive" aria-label={`Apagar o voto de ${v.nome || 'sem nome'}`} onClick={() => setApagandoVoto(v)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                  <Button variant="outline" className="w-full gap-2" onClick={() => baixarPlanilha(votosDe, votos)} data-testid="baixar-planilha">
                    <Download className="h-4 w-4" /> Baixar a lista em planilha
                  </Button>
                </>
              )}
              {votos && votos.length === 0 && <p className="text-sm text-muted-foreground">Ninguém votou ainda.</p>}
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!apagandoVoto} onOpenChange={a => !a && setApagandoVoto(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Apagar este voto?</DialogTitle>
            <DialogDescription>
              O voto de {apagandoVoto?.nome || 'sem nome'} sai da contagem. A pessoa pode votar de novo com o mesmo número, criando outro PIN.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Button variant="destructive" onClick={confirmarApagarVoto} data-testid="confirmar-apagar-voto">Apagar o voto</Button>
            <Button variant="ghost" onClick={() => setApagandoVoto(null)}>Cancelar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Os dois links, prontos para mandar. */}
      <Dialog open={!!links} onOpenChange={a => !a && setLinks(null)}>
        <DialogContent className="sm:max-w-md" data-testid="dialogo-links">
          {links && (() => {
            const { votar, resultado } = linksDaEnquete(links.slug);
            return (
              <>
                <DialogHeader>
                  <DialogTitle>{links.pergunta}</DialogTitle>
                  <DialogDescription>
                    {estaAberta(links) ? (links.encerra_em ? `Aberta, encerra ${format(new Date(links.encerra_em), "dd/MM 'às' HH:mm", { locale: ptBR })}.` : 'Aberta, sem prazo.') : 'Encerrada. Os links continuam valendo como registro.'}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2.5">
                  {[['Para votar · mande no grupo', votar, 'Link de voto'], ['Para acompanhar · mande para a chefia', resultado, 'Link de acompanhamento']].map(([rotulo, url, nome]) => (
                    <div key={url} className="flex items-center justify-between gap-2.5 rounded-xl border border-border px-3 py-2.5">
                      <div className="min-w-0">
                        <small className="block text-[11px] text-muted-foreground">{rotulo}</small>
                        <code className="break-all text-xs">{url.replace(/^https?:\/\//, '')}</code>
                      </div>
                      <Button variant="outline" size="sm" className="shrink-0 gap-1" onClick={() => copiar(url, nome)}><Copy className="h-3.5 w-3.5" /> Copiar</Button>
                    </div>
                  ))}
                  <Button className="w-full gap-2 bg-[#81E2CF] text-[#1F2322] hover:bg-[#6fd6c2]" asChild>
                    <a href={`https://wa.me/?text=${encodeURIComponent(textoDoWhatsAppDaEnquete(links))}`} target="_blank" rel="noreferrer">
                      <MessageCircle className="h-4 w-4" /> Mandar o link de voto pelo WhatsApp
                    </a>
                  </Button>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={!!apagando} onOpenChange={a => !a && setApagando(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Apagar esta enquete?</DialogTitle>
            <DialogDescription>“{apagando?.pergunta}” sai da lista e os links param de abrir. Os votos ficam no banco.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Button variant="destructive" onClick={() => apagando && agir(async () => { await apagarEnquete(apagando.id); setApagando(null); }, 'Enquete apagada')}>Apagar</Button>
            <Button variant="ghost" onClick={() => setApagando(null)}>Cancelar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
