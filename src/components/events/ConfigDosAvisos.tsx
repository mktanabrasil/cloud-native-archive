import { useCallback, useEffect, useMemo, useState } from 'react';
import { Lock, Mail, Plus, RefreshCw, Rocket, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { CAIXAS_FIXAS_EM_TEXTO, COPIA_DOS_SETORES, type PerfilParaAviso } from '@/lib/events/avisos';
import {
  CONFIG_PADRAO, EQUIPE_PADRAO, NOME_DO_SETOR, type ConfigDaEquipe, type ConfigDeAvisos, ROTULO_DO_ESTADO, ROTULO_DO_MOTIVO, type SetorDaEquipe, emailValido, listaDeDestinatarios, normalizarEmail,
  quemEntraNoLancamento, resumoDaLista, sugestoesDaEquipe,
} from '@/lib/events/avisosConfig';
import { toast } from 'sonner';
import { AVISO_DE_SESSAO_EXPIRADA, tratarNaoAutorizado } from '@/lib/sessao';

/** `equipe`: ausente = função anterior ao PR 5; `null` = não deu para ler as listas agora. */
interface Resposta { config: ConfigDeAvisos; origem: 'painel' | 'variavel'; perfis: PerfilParaAviso[]; equipe?: ConfigDaEquipe | null; error?: string }

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
  const [equipe, setEquipe] = useState<ConfigDaEquipe>(EQUIPE_PADRAO);
  // A função publicada antes do PR 5 não devolve as listas: a parte 3 avisa em vez de salvar no vazio.
  const [temEquipe, setTemEquipe] = useState(false);
  const [erroDaEquipe, setErroDaEquipe] = useState(false);
  // A função publicada antes do PR 2 do Financeiro devolve as listas sem a do Financeiro.
  const [temFinanceiro, setTemFinanceiro] = useState(false);
  const [novoDaEquipe, setNovoDaEquipe] = useState<Record<SetorDaEquipe, string>>({ rh: '', voluntariado: '', financeiro: '' });
  const receberEquipe = (e: ConfigDaEquipe | null | undefined) => {
    setTemEquipe(e !== undefined); setErroDaEquipe(e === null);
    setTemFinanceiro(!!e && Array.isArray((e as Partial<ConfigDaEquipe>).financeiro));
    setEquipe(e ? { ...e, financeiro: Array.isArray(e.financeiro) ? e.financeiro : [] } : EQUIPE_PADRAO);
  };

  const ler = useCallback(async () => {
    try {
      const r = await chamar({ config: true });
      setConfig(r.config); setOrigem(r.origem); setPerfis(r.perfis); setErro(null); setCarregado(true);
      receberEquipe(r.equipe);
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

  /** Salva as listas da equipe do dia (RH e Voluntariado) e do Financeiro. A do Financeiro só vai se a função já a conhece. */
  const salvarEquipe = async (nova: ConfigDaEquipe, mensagem: string) => {
    setSalvando(true);
    try {
      const r = await chamar({ salvar_config_equipe: { rh: nova.rh, voluntariado: nova.voluntariado, ...(temFinanceiro ? { financeiro: nova.financeiro } : {}) } });
      setPerfis(r.perfis);
      if (r.equipe) receberEquipe(r.equipe);
      toast.success(mensagem);
    } catch (e) {
      toast.error('Não consegui salvar', { description: e instanceof Error ? e.message : String(e) });
    } finally { setSalvando(false); }
  };
  const adicionarNaEquipe = (setor: SetorDaEquipe, bruto: string) => {
    const email = normalizarEmail(bruto);
    if (!emailValido(email)) { toast.error('Digite um e-mail válido.'); return; }
    if (equipe[setor].includes(email)) { toast.error('Esse e-mail já está nesta lista.'); return; }
    setNovoDaEquipe(n => ({ ...n, [setor]: '' }));
    void salvarEquipe({ ...equipe, [setor]: [...equipe[setor], email] }, setor === 'financeiro' ? `${email} passa a receber as compras dos eventos (Financeiro).` : `${email} passa a receber a equipe do dia (${NOME_DO_SETOR[setor]}).`);
  };
  const tirarDaEquipe = (setor: SetorDaEquipe, email: string) =>
    void salvarEquipe({ ...equipe, [setor]: equipe[setor].filter(e => e !== email) }, `${email} saiu da lista do ${NOME_DO_SETOR[setor]}.`);

  const alternar = (ligar: boolean) => {
    if (ligar) { void salvar({ ...config, pre_lancamento: true }, 'Modo pré-lançamento ligado: só as caixas fixas recebem.'); return; }
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
          <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-foreground">
            Não consegui falar com a função de avisos agora ({erro}). <button className="underline" onClick={() => void ler()}>Tentar de novo</button>
          </p>
        )}

        {/* 1. Lançamento */}
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">1. Lançamento <span className="font-normal text-muted-foreground">· quem entra além das caixas fixas</span></h3>
          <div className={`flex items-start gap-3 rounded-xl border p-3 ${config.pre_lancamento ? 'border-warning/30 bg-warning/5' : 'border-border bg-muted/40'}`} data-testid="modo-lancamento">
            {/* O interruptor É o modo pré-lançamento: ligado quando o texto diz "ligado". Desligar = lançar (com confirmação). */}
            <Switch id="pre-lancamento" checked={config.pre_lancamento} disabled={!carregado || salvando} onCheckedChange={v => alternar(v)} aria-label="Modo pré-lançamento" className="mt-0.5" />
            <div className="flex-1 text-xs">
              <p className="flex items-center gap-1.5 font-semibold text-foreground">
                {config.pre_lancamento ? <><Lock className="h-3.5 w-3.5 text-warning" /> Modo pré-lançamento ligado</> : <><Rocket className="h-3.5 w-3.5 text-success" /> Lançado para a equipe</>}
              </p>
              <p className="text-muted-foreground">
                {config.pre_lancamento
                  ? `Só ${CAIXAS_FIXAS_EM_TEXTO} recebem os e-mails. Desligue para lançar: a gestão das unidades e quem cria eventos entram na hora.`
                  : 'Modo pré-lançamento desligado: a gestão das unidades, quem cria eventos e os e-mails adicionados recebem os avisos. Ligar de novo tira o acesso deles na hora.'}
              </p>
              {origem === 'variavel' && carregado && <p className="mt-1 text-muted-foreground">Hoje quem manda ainda é a variável do Coolify. Ao salvar qualquer coisa aqui, o Painel passa a mandar e a variável pode ser removida.</p>}
            </div>
          </div>
        </section>

        {/* 2. Lista */}
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">2. Quem recebe os e-mails <span className="font-normal text-muted-foreground">· {resumoDaLista(linhas)}</span></h3>
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-semibold">Pessoa</th><th className="px-3 py-2 font-semibold">Por quê</th><th className="px-3 py-2 font-semibold">Hoje</th><th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {linhas.map(l => (
                  <tr key={l.email} className="border-b border-border last:border-0" data-testid="linha-destinatario">
                    <td className="px-3 py-2"><span className="text-foreground">{l.email}</span>{l.nome && <span className="text-muted-foreground"> · {l.nome}</span>}</td>
                    <td className="px-3 py-2 text-muted-foreground">{l.motivo === 'gestao' ? `gestão ${l.unidade}` : ROTULO_DO_MOTIVO[l.motivo]}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold ${l.estado === 'recebe' ? 'text-success' : l.estado === 'entra_no_lancamento' ? 'text-warning' : 'text-muted-foreground'}`}><span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />{ROTULO_DO_ESTADO[l.estado]}</span>
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

        {/* 3. A equipe do dia (18/11/2026, PR 5) */}
        <section className="space-y-2" data-testid="avisos-da-equipe-do-dia">
          <h3 className="text-sm font-semibold">3. RH, Voluntariado e Financeiro <span className="font-normal text-muted-foreground">· a equipe do dia e as compras</span></h3>
          <p className="max-w-[70ch] text-xs text-muted-foreground">
            Quando um evento é confirmado, e de novo se mudar: o RH recebe quem vai trabalhar, o Voluntariado recebe os voluntários e o Financeiro recebe o que a ANA compra (comida que a ANA fornece e transporte de fora). Se o evento for cancelado, cada lista recebe também o mesmo e-mail de cancelamento que todos recebem. Quem também está na lista acima continua recebendo os avisos gerais.
          </p>
          <p className="max-w-[70ch] text-xs text-muted-foreground" data-testid="copia-dos-setores">
            Em cópia em todos os e-mails dos setores: {COPIA_DOS_SETORES.map((e, i) => <span key={e}>{i > 0 && ' e '}<b className="font-semibold text-foreground">{e}</b></span>)}.
          </p>
          {carregado && erroDaEquipe ? (
            <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-foreground">Não consegui ler as listas do RH, do Voluntariado e do Financeiro agora. <button className="underline" onClick={() => void ler()}>Tentar de novo</button></p>
          ) : carregado && !temEquipe ? (
            <p className="rounded-xl border border-warning/30 bg-warning/5 p-3 text-xs text-foreground">A função de avisos publicada ainda não conhece estas listas. Republique a função <b>eventos-aviso</b> e recarregue a página.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {(['rh', 'voluntariado', 'financeiro'] as const).map(setor => {
                const nome = NOME_DO_SETOR[setor];
                const sugestoes = sugestoesDaEquipe(perfis, equipe, setor);
                if (setor === 'financeiro' && !temFinanceiro) return (
                  <div key={setor} className="rounded-xl border border-warning/30 bg-warning/5 p-3 text-xs text-foreground" data-testid="lista-equipe-financeiro-sem-funcao">
                    <p className="font-semibold">Financeiro <span className="font-normal text-muted-foreground">· compras dos eventos</span></p>
                    <p className="mt-1">A função de avisos publicada ainda não conhece esta lista. Republique a função <b>eventos-aviso</b> e recarregue a página.</p>
                  </div>
                );
                return (
                  <div key={setor} className="space-y-2 rounded-xl border border-border p-3" data-testid={`lista-equipe-${setor}`}>
                    <p className="text-xs font-semibold">{nome} <span className="font-normal text-muted-foreground">· {setor === 'rh' ? 'funcionários escalados' : setor === 'financeiro' ? 'compras dos eventos' : 'voluntários, com o WhatsApp'}</span></p>
                    {equipe[setor].length === 0
                      ? <p className="text-xs text-muted-foreground">Ninguém ainda: enquanto a lista estiver vazia, os e-mails do {nome} não são enviados.</p>
                      : (
                        <ul className="flex flex-wrap gap-1.5" aria-label={`Quem recebe: ${nome}`}>
                          {equipe[setor].map(e => (
                            <li key={e} className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 py-0.5 pl-2.5 pr-1 text-xs">
                              {e}
                              <button type="button" className="rounded-full p-0.5 text-muted-foreground hover:text-destructive disabled:opacity-50" disabled={salvando} aria-label={`Tirar ${e} da lista do ${nome}`} onClick={() => tirarDaEquipe(setor, e)}><X className="h-3 w-3" /></button>
                            </li>
                          ))}
                        </ul>
                      )}
                    <form className="flex gap-2" onSubmit={ev => { ev.preventDefault(); adicionarNaEquipe(setor, novoDaEquipe[setor]); }}>
                      <Input aria-label={`E-mail para a lista do ${nome}`} value={novoDaEquipe[setor]} onChange={ev => setNovoDaEquipe(n => ({ ...n, [setor]: ev.target.value }))} placeholder="nome@anabrasil.org" className="h-8 min-w-0 flex-1 text-xs" disabled={!carregado || salvando} />
                      <Button type="submit" variant="outline" className="h-8 gap-1 text-xs" disabled={!carregado || salvando || !novoDaEquipe[setor].trim()}><Plus className="h-3.5 w-3.5" /> Adicionar</Button>
                    </form>
                    {sugestoes.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                        Com o vínculo {nome}:
                        {sugestoes.map(p => (
                          <button key={p.email} type="button" className="rounded-full border border-dashed border-border px-2 py-0.5 text-foreground hover:bg-muted disabled:opacity-50" disabled={salvando} onClick={() => adicionarNaEquipe(setor, p.email)}>
                            + {p.nome ? `${p.nome} · ` : ''}{p.email}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {config.atualizado_em && <p className="text-[11px] text-muted-foreground">Última alteração: {config.atualizado_por} em {quando(config.atualizado_em)}.</p>}
      </CardContent>

      <Dialog open={confirmarLancamento} onOpenChange={o => { if (!o) setConfirmarLancamento(false); }}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Lançar os avisos para a equipe toda?</DialogTitle>
            <DialogDescription>
              {entram.length === 0
                ? 'Ninguém além das caixas fixas está na lista hoje. Os próximos cadastros passam a receber assim que forem feitos.'
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
