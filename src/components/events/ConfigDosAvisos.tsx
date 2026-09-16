import { useCallback, useEffect, useMemo, useState } from 'react';
import { Lock, Mail, Plus, RefreshCw, Rocket, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import type { PerfilParaAviso } from '@/lib/events/avisos';
import {
  CONFIG_PADRAO, type ConfigDeAvisos, ROTULO_DO_ESTADO, ROTULO_DO_MOTIVO, emailValido, listaDeDestinatarios, normalizarEmail, quemEntraNoLancamento, resumoDaLista,
} from '@/lib/events/avisosConfig';
import { toast } from 'sonner';
import { AVISO_DE_SESSAO_EXPIRADA, tratarNaoAutorizado } from '@/lib/sessao';

interface Resposta { config: ConfigDeAvisos; origem: 'painel' | 'variavel'; perfis: PerfilParaAviso[]; error?: string }

const chamar = async (body: Record<string, unknown>): Promise<Resposta> => {
  const { data, error } = await supabase.functions.invoke('eventos-aviso', { body });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    let detalhe = '';
    try { detalhe = ctx ? ((await ctx.clone().json()) as { error?: string }).error || '' : ''; } catch { /* sem corpo JSON */ }
    // Sessão morta no servidor: a pessoa vai para o login; aqui só não pintamos erro por cima.
    if (/não autorizado/i.test(detalhe) && await tratarNaoAutorizado()) throw new Error(AVISO_DE_SESSAO_EXPIRADA);
    throw new Error(detalhe || error.message || 'sem resposta');
  }
  const r = data as Resposta | null;
  if (!r) throw new Error('sem resposta');
  if (r.error) throw new Error(r.error);
  if (!r.config) throw new Error('a função publicada ainda não conhece a configuração dos avisos');
  return r;
};

const quando = (iso: string | null | undefined) => iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';

/**
 * Card "Avisos por e-mail" do Painel (só admin geral), PR 3 de 16/09/2026:
 * o interruptor do pré-lançamento e a lista de quem recebe, com "não incluir"
 * por pessoa e e-mails avulsos. A cor por unidade ficou fixa no código; quem
 * vê a agenda é definido no Google, pela eventos@.
 */
export function ConfigDosAvisos() {
  const [config, setConfig] = useState<ConfigDeAvisos>(CONFIG_PADRAO);
  const [origem, setOrigem] = useState<'painel' | 'variavel'>('variavel');
  const [perfis, setPerfis] = useState<PerfilParaAviso[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [carregado, setCarregado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [novo, setNovo] = useState('');
  const [confirmarLancamento, setConfirmarLancamento] = useState(false);

  const ler = useCallback(async () => {
    try {
      const r = await chamar({ config: true });
      setConfig(r.config); setOrigem(r.origem); setPerfis(r.perfis); setErro(null); setCarregado(true);
    } catch (e) { setErro(e instanceof Error ? e.message : String(e)); }
  }, []);
  useEffect(() => { void ler(); }, [ler]);

  const linhas = useMemo(() => listaDeDestinatarios(perfis, config), [perfis, config]);
  const entram = useMemo(() => quemEntraNoLancamento(linhas), [linhas]);

  const salvar = async (nova: ConfigDeAvisos, mensagem: string) => {
    setSalvando(true);
    try {
      const r = await chamar({ salvar_config: { pre_lancamento: nova.pre_lancamento, extras: nova.extras, excluidos: nova.excluidos } });
      setConfig(r.config); setOrigem(r.origem); setPerfis(r.perfis);
      toast.success(mensagem);
    } catch (e) {
      toast.error('Não consegui salvar', { description: e instanceof Error ? e.message : String(e) });
    } finally { setSalvando(false); }
  };

  const alternar = (ligar: boolean) => {
    if (ligar) { void salvar({ ...config, pre_lancamento: true }, 'Modo pré-lançamento ligado: só as quatro caixas recebem.'); return; }
    setConfirmarLancamento(true);
  };
  const lancar = () => { setConfirmarLancamento(false); void salvar({ ...config, pre_lancamento: false }, 'Lançado: a equipe toda passa a receber os avisos.'); };

  const excluir = (email: string, sim: boolean) => {
    const excluidos = sim ? Array.from(new Set([...config.excluidos, email])) : config.excluidos.filter(e => e !== email);
    void salvar({ ...config, excluidos }, sim ? `${email} não recebe mais os avisos.` : `${email} volta a receber os avisos.`);
  };
  const removerAvulso = (email: string) => void salvar({ ...config, extras: config.extras.filter(e => e !== email), excluidos: config.excluidos.filter(e => e !== email) }, `${email} removido.`);
  const adicionar = () => {
    const email = normalizarEmail(novo);
    if (!emailValido(email)) { toast.error('Digite um e-mail válido.'); return; }
    if (linhas.some(l => l.email === email)) { toast.error('Esse e-mail já está na lista.'); return; }
    setNovo('');
    void salvar({ ...config, extras: [...config.extras, email] }, `${email} adicionado.`);
  };

  return (
    <Card data-testid="config-dos-avisos">
      <CardHeader className="space-y-1">
        <CardTitle className="flex items-center gap-2 text-lg"><Mail className="h-5 w-5 text-primary" /> Avisos por e-mail</CardTitle>
        <p className="max-w-[60ch] text-sm text-muted-foreground">Quem recebe o e-mail quando um evento é confirmado, cancelado ou muda de data. Quem vê a agenda do Google é definido no próprio Google, pela eventos@.</p>
      </CardHeader>
      <CardContent className="space-y-5">
        {erro && (
          <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-foreground">
            Não consegui falar com a função de avisos agora ({erro}). <button className="underline" onClick={() => void ler()}>Tentar de novo</button>
          </p>
        )}

        {/* 1. Lançamento */}
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">1. Lançamento <span className="font-normal text-muted-foreground">· quem entra além das quatro caixas</span></h3>
          <div className={`flex items-start gap-3 rounded-lg border p-3 ${config.pre_lancamento ? 'border-dashed border-warning/60 bg-warning/10' : 'border-primary/40 bg-primary/10'}`} data-testid="modo-lancamento">
            {/* O interruptor É o modo pré-lançamento: ligado quando o texto diz "ligado". Desligar = lançar (com confirmação). */}
            <Switch id="pre-lancamento" checked={config.pre_lancamento} disabled={!carregado || salvando} onCheckedChange={v => alternar(v)} aria-label="Modo pré-lançamento" className="mt-0.5" />
            <div className="flex-1 text-xs">
              <p className="flex items-center gap-1.5 font-semibold text-foreground">
                {config.pre_lancamento ? <><Lock className="h-3.5 w-3.5 text-warning" /> Modo pré-lançamento ligado</> : <><Rocket className="h-3.5 w-3.5 text-primary" /> Lançado para a equipe</>}
              </p>
              <p className="text-muted-foreground">
                {config.pre_lancamento
                  ? 'Só mkt@, contato@, parceiros@ e eventos@ recebem os e-mails. Desligue para lançar: a gestão das unidades e quem cria eventos entram na hora.'
                  : 'Modo pré-lançamento desligado: a gestão das unidades, quem cria eventos e os e-mails adicionados recebem os avisos. Ligar de novo tira o acesso deles na hora.'}
              </p>
              {origem === 'variavel' && carregado && <p className="mt-1 text-muted-foreground">Hoje quem manda ainda é a variável do Coolify. Ao salvar qualquer coisa aqui, o Painel passa a mandar e a variável pode ser removida.</p>}
            </div>
          </div>
        </section>

        {/* 2. Lista */}
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">2. Quem recebe os e-mails <span className="font-normal text-muted-foreground">· {resumoDaLista(linhas)}</span></h3>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-semibold">Pessoa</th><th className="px-3 py-2 font-semibold">Por quê</th><th className="px-3 py-2 font-semibold">Hoje</th><th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {linhas.map(l => (
                  <tr key={l.email} className="border-b border-border last:border-0" data-testid="linha-destinatario">
                    <td className="px-3 py-2"><span className="text-foreground">{l.email}</span>{l.nome && <span className="text-muted-foreground"> · {l.nome}</span>}</td>
                    <td className="px-3 py-2 text-muted-foreground">{l.motivo === 'gestao' ? `gestão ${l.unidade}` : ROTULO_DO_MOTIVO[l.motivo]}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${l.estado === 'recebe' ? 'bg-primary/15 text-primary' : l.estado === 'entra_no_lancamento' ? 'bg-warning/15 text-warning' : 'bg-muted text-muted-foreground'}`}>{ROTULO_DO_ESTADO[l.estado]}</span>
                    </td>
                    <td className="px-3 py-1 text-right">
                      {!l.fixo && l.motivo !== 'avulso' && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={salvando} onClick={() => excluir(l.email, l.estado !== 'nao_incluir')}>
                          {l.estado === 'nao_incluir' ? 'Incluir' : 'Não incluir'}
                        </Button>
                      )}
                      {l.motivo === 'avulso' && (
                        <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-destructive" disabled={salvando} onClick={() => removerAvulso(l.email)}><Trash2 className="h-3 w-3" /> Remover</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <form className="flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); adicionar(); }}>
            <Input id="novo-destinatario" value={novo} onChange={e => setNovo(e.target.value)} placeholder="Adicionar um e-mail sem cadastro (ex.: diretoria@anabrasil.org)" className="h-9 min-w-[240px] flex-1 text-xs" disabled={!carregado || salvando} />
            <Button type="submit" variant="outline" className="h-9 gap-1.5 text-xs" disabled={!carregado || salvando || !novo.trim()}>{salvando ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Adicionar</Button>
          </form>
          <p className="text-xs text-muted-foreground">A lista nasce da regra que já existe: caixas fixas, gestão ativa por unidade e quem cria eventos. Aqui você só acrescenta e-mails avulsos e marca quem não entra. Quem for cadastrado ou desativado em Usuários aparece aqui sozinho.</p>
        </section>

        {config.atualizado_em && <p className="text-[11px] text-muted-foreground">Última alteração: {config.atualizado_por} em {quando(config.atualizado_em)}.</p>}
      </CardContent>

      <Dialog open={confirmarLancamento} onOpenChange={o => { if (!o) setConfirmarLancamento(false); }}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Lançar os avisos para a equipe toda?</DialogTitle>
            <DialogDescription>
              {entram.length === 0
                ? 'Ninguém além das quatro caixas está na lista hoje. Os próximos cadastros passam a receber assim que forem feitos.'
                : <>Agora mesmo, <b>{entram.length === 1 ? '1 pessoa passa' : `${entram.length} pessoas passam`}</b> a receber os e-mails de evento: {entram.join(', ')}. Quem está marcado como "não incluir" continua fora. Dá para religar depois, e o acesso é retirado na hora.</>}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmarLancamento(false)}>Ainda não</Button>
            <Button onClick={lancar}>Lançar agora</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
