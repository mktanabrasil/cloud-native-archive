import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { COR_DA_AREA, ICONE_DA_AREA } from './PecasDasVagas';
import { atualizarVaga, criarVaga, listarPerguntas, mensagemDoErro, salvarPerguntas, type NovaPergunta } from '@/lib/vagas/api';
import {
  AREAS, CONTRATACOES, MODALIDADES, ROTULO_DA_AREA, ROTULO_DA_CONTRATACAO, ROTULO_DA_MODALIDADE, TIPOS_DE_PERGUNTA,
  type PerguntaDeVaga, type StatusDaVaga, type TipoDePergunta, type Vaga,
} from '@/lib/vagas/modelo';
import {
  FORMULARIO_VAZIO, PASSOS, avisosDaRevisao, dadosParaGravar, faltasDoPasso, faltasParaSalvar, formularioDaVaga,
  itensDoTexto, perguntasParaGravar, termosDoFormulario, type FormularioDaVaga,
} from '@/lib/vagas/formulario';

/**
 * Nova vaga e editar vaga (fase 1, telas 32, 32b e 33 do mockup aprovado).
 *
 * Seis passos curtos, um assunto por vez, com revisão no fim. O rascunho
 * grava mesmo incompleto no conteúdo; publicar exige os mínimos e barra
 * termos discriminatórios (gênero, idade, aparência...). Editando uma vaga
 * publicada, o aviso lembra que a mudança aparece na hora no portal.
 * Duplicar abre como vaga nova, em rascunho, com o mesmo conteúdo.
 */

export type ModoDaVaga = 'nova' | 'editar' | 'duplicar';

const ROTULO_DO_TIPO: Record<TipoDePergunta, string> = {
  texto_curto: 'Resposta curta',
  texto_longo: 'Resposta longa',
  unica: 'Uma opção',
  multipla: 'Várias opções',
  sim_nao: 'Sim ou não',
};

interface Props {
  open: boolean;
  onOpenChange: (aberto: boolean) => void;
  modo: ModoDaVaga;
  vaga: Vaga | null;
  /** Todas as vagas, para achar endereço e código livres. */
  todas: Vaga[];
  onSalva: (v: Vaga) => void;
}

export function VagaFormDialog({ open, onOpenChange, modo, vaga, todas, onSalva }: Props) {
  const { user } = useAuth();
  const [passo, setPasso] = useState(0);
  const [f, setF] = useState<FormularioDaVaga>(FORMULARIO_VAZIO);
  const [banco, setBanco] = useState<PerguntaDeVaga[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [tentouAvancar, setTentouAvancar] = useState(false);

  // Abre limpo, ou com a vaga (e as perguntas dela) para editar ou duplicar.
  useEffect(() => {
    if (!open) return;
    setPasso(0); setTentouAvancar(false);
    let vivo = true;
    listarPerguntas(null).then(b => { if (vivo) setBanco(b); }).catch(() => { /* sem banco, segue */ });
    if (!vaga) { setF(FORMULARIO_VAZIO); return () => { vivo = false; }; }
    setF(formularioDaVaga(vaga, []));
    listarPerguntas(vaga.id).then(p => { if (vivo) setF(atual => ({ ...atual, perguntas: formularioDaVaga(vaga, p).perguntas })); }).catch(() => { /* fica sem */ });
    if (modo === 'duplicar') setF(atual => ({ ...atual, titulo: `${vaga.titulo} (cópia)` }));
    return () => { vivo = false; };
  }, [open, vaga, modo]);

  const editando = modo === 'editar' && vaga !== null;
  const publicada = editando && vaga!.status === 'publicada';
  const faltas = faltasDoPasso(passo, f);
  const termos = useMemo(() => termosDoFormulario(f), [f]);
  const muda = (p: Partial<FormularioDaVaga>) => setF(atual => ({ ...atual, ...p }));

  const avancar = () => {
    if (faltas.length) { setTentouAvancar(true); return; }
    setTentouAvancar(false); setPasso(p => Math.min(PASSOS.length - 1, p + 1));
  };

  async function gravar(status: StatusDaVaga) {
    const todasAsFaltas = faltasParaSalvar(f);
    if (todasAsFaltas.length) { toast.error(todasAsFaltas[0]); return; }
    if (status === 'publicada' && termos.length) { toast.error('Tire os termos marcados antes de publicar.'); return; }
    setSalvando(true);
    try {
      const outras = todas.filter(t => t.id !== vaga?.id);
      const dados = dadosParaGravar(f, status, editando ? vaga : null, outras);
      const salva = editando ? await atualizarVaga(vaga!.id, dados) : await criarVaga(dados, user?.id ?? null);
      await salvarPerguntas(salva.id, perguntasParaGravar(f));
      toast.success(status === 'publicada' ? (publicada ? 'Vaga atualizada no portal.' : 'Vaga publicada.') : status === 'revisao' ? 'Vaga enviada para revisão.' : 'Rascunho salvo.');
      onSalva(salva);
      onOpenChange(false);
    } catch (e) {
      toast.error(mensagemDoErro(e));
    } finally {
      setSalvando(false);
    }
  }

  const titulo = editando ? 'Editar vaga' : modo === 'duplicar' ? 'Duplicar vaga' : 'Nova vaga';

  return (
    <Dialog open={open} onOpenChange={o => { if (!salvando) onOpenChange(o); }}>
      <DialogContent className="max-h-[95vh] overflow-y-auto sm:max-w-2xl" data-testid="form-vaga">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{editando ? `${vaga!.codigo} · o endereço da vaga não muda.` : 'Um assunto por vez. Dá para salvar como rascunho em qualquer passo.'}</DialogDescription>
        </DialogHeader>

        {publicada && (
          <div className="flex gap-2.5 rounded-xl bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/60 dark:text-amber-100" role="note">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>Esta vaga está publicada. O que você mudar aparece na hora para quem abrir a vaga.</span>
          </div>
        )}

        <ol className="flex gap-1.5" aria-label="Passos">
          {PASSOS.map((p, i) => (
            <li key={p} className="flex-1">
              <button
                type="button"
                onClick={() => { if (i < passo || faltasParaSalvar(f).length === 0) setPasso(i); }}
                aria-current={i === passo ? 'step' : undefined}
                className="flex w-full flex-col gap-1 text-left"
              >
                <span className={`h-1.5 rounded-full ${i <= passo ? 'bg-[#81E2CF]' : 'bg-muted'}`} />
                <span className={`hidden text-[11px] sm:block ${i === passo ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{p}</span>
              </button>
            </li>
          ))}
        </ol>

        <div className="min-h-[300px] space-y-4">
          {passo === 0 && (
            <>
              <Campo id="vg-titulo" rotulo="Título da vaga *" dica="Sem caixa alta e sem gênero: “Educador Social de Música”, não “EDUCADORA”.">
                <Input id="vg-titulo" value={f.titulo} maxLength={120} onChange={e => muda({ titulo: e.target.value })} placeholder="Educador Social de Música" />
              </Campo>
              <div>
                <Label className="text-xs font-semibold">Área *</Label>
                <div className="mt-1.5 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Área">
                  {AREAS.map(a => {
                    const Icone = ICONE_DA_AREA[a];
                    const ativo = f.area === a;
                    return (
                      <button key={a} type="button" role="radio" aria-checked={ativo} onClick={() => muda({ area: a })}
                        className={`flex items-center gap-2 rounded-xl border-2 p-3 text-sm font-semibold transition ${ativo ? 'border-foreground' : 'border-transparent bg-muted/60 hover:bg-muted'}`}>
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#1F2322]" style={{ background: COR_DA_AREA[a] }}><Icone className="h-4 w-4" aria-hidden /></span>
                        <span className="truncate">{ROTULO_DA_AREA[a]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo id="vg-cidade" rotulo="Cidade *"><Input id="vg-cidade" value={f.cidade} onChange={e => muda({ cidade: e.target.value })} /></Campo>
                <Campo id="vg-carga" rotulo="Carga horária" dica="Como aparece no cartão: “40h semanais · tarde”."><Input id="vg-carga" value={f.carga_horaria} onChange={e => muda({ carga_horaria: e.target.value })} placeholder="40h semanais · tarde" /></Campo>
                <Campo id="vg-contratacao" rotulo="Contratação">
                  <select id="vg-contratacao" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={f.contratacao} onChange={e => muda({ contratacao: e.target.value as FormularioDaVaga['contratacao'] })}>
                    {CONTRATACOES.map(c => <option key={c} value={c}>{ROTULO_DA_CONTRATACAO[c]}</option>)}
                  </select>
                </Campo>
                <Campo id="vg-modalidade" rotulo="Modalidade">
                  <select id="vg-modalidade" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={f.modalidade} onChange={e => muda({ modalidade: e.target.value as FormularioDaVaga['modalidade'] })}>
                    {MODALIDADES.map(m => <option key={m} value={m}>{ROTULO_DA_MODALIDADE[m]}</option>)}
                  </select>
                </Campo>
              </div>
              <div className="space-y-2.5 rounded-xl bg-muted/50 p-3">
                <Interruptor id="vg-afirmativa" rotulo="Vaga afirmativa para pessoas com deficiência" ligado={f.afirmativa_pcd} aoMudar={v => muda({ afirmativa_pcd: v })} />
                {!f.afirmativa_pcd && <Interruptor id="vg-aberta-pcd" rotulo="Aberta a pessoas com deficiência" ligado={f.aberta_pcd} aoMudar={v => muda({ aberta_pcd: v })} />}
                {f.contratacao !== 'aprendiz' && <Interruptor id="vg-aprendiz" rotulo="Programa Jovem Aprendiz" ligado={f.aprendizagem} aoMudar={v => muda({ aprendizagem: v })} />}
              </div>
            </>
          )}

          {passo === 1 && (
            <>
              <Campo id="vg-descricao" rotulo="O que a pessoa vai fazer *" dica="Duas ou três frases, falando com quem vai ler.">
                <Textarea id="vg-descricao" rows={5} value={f.descricao} onChange={e => muda({ descricao: e.target.value })} placeholder="Conduzir oficinas de música para crianças e adolescentes no serviço de convivência…" />
              </Campo>
              <ListaDeItens id="vg-resp" rotulo="No dia a dia (opcional)" itens={f.responsabilidades} aoMudar={l => muda({ responsabilidades: l })} exemplo="Planejar as oficinas da semana" />
            </>
          )}

          {passo === 2 && (
            <>
              <ListaDeItens id="vg-req" rotulo="Requisitos *" itens={f.requisitos} aoMudar={l => muda({ requisitos: l })} exemplo="Ensino Médio completo" />
              <ListaDeItens id="vg-dif" rotulo="Diferenciais (opcional)" itens={f.diferenciais} aoMudar={l => muda({ diferenciais: l })} exemplo="Formação em música" />
            </>
          )}

          {passo === 3 && (
            <>
              <ListaDeItens id="vg-ben" rotulo="O que a ANA oferece" itens={f.beneficios} aoMudar={l => muda({ beneficios: l })} exemplo="Plano de saúde após a experiência" />
              <Campo id="vg-link" rotulo="Link do formulário de inscrição" dica="O Google Forms atual da vaga. Sem link, o botão mostra “Inscrições em breve”.">
                <Input id="vg-link" type="url" inputMode="url" value={f.link_externo} onChange={e => muda({ link_externo: e.target.value })} placeholder="https://forms.gle/…" />
              </Campo>
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo id="vg-prazo" rotulo="Prazo (opcional)" dica="Vazio: fica aberta até você encerrar.">
                  <div className="flex gap-2">
                    <Input id="vg-prazo" type="date" value={f.prazo} onChange={e => muda({ prazo: e.target.value })} />
                    {f.prazo && <Button type="button" variant="ghost" size="icon" aria-label="Tirar prazo" onClick={() => muda({ prazo: '' })}><X className="h-4 w-4" /></Button>}
                  </div>
                </Campo>
              </div>
              <Campo id="vg-compl" rotulo="Informações complementares (opcional)">
                <Textarea id="vg-compl" rows={3} value={f.complementares} onChange={e => muda({ complementares: e.target.value })} />
              </Campo>
            </>
          )}

          {passo === 4 && <PassoDasPerguntas perguntas={f.perguntas} banco={banco} aoMudar={p => muda({ perguntas: p })} />}

          {passo === 5 && <Revisao f={f} termos={termos} />}

          {tentouAvancar && faltas.length > 0 && (
            <ul className="space-y-1 rounded-xl bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950/60 dark:text-red-100" role="alert">
              {faltas.map(t => <li key={t}>{t}</li>)}
            </ul>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:items-center">
          {passo > 0
            ? <Button type="button" variant="ghost" onClick={() => setPasso(p => p - 1)}><ArrowLeft className="h-4 w-4" /> Voltar</Button>
            : <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>}
          <span className="flex-1" />
          {!publicada && <Button type="button" variant="outline" disabled={salvando} onClick={() => gravar('rascunho')}>Salvar rascunho</Button>}
          {passo < PASSOS.length - 1
            ? <Button type="button" onClick={avancar}>Continuar <ArrowRight className="h-4 w-4" /></Button>
            : (
              <>
                {!publicada && <Button type="button" variant="outline" disabled={salvando} onClick={() => gravar('revisao')}>Enviar para revisão</Button>}
                <Button type="button" disabled={salvando || termos.length > 0} onClick={() => gravar('publicada')}>
                  <Check className="h-4 w-4" /> {publicada ? 'Salvar e manter publicada' : 'Publicar'}
                </Button>
              </>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Campo({ id, rotulo, dica, children }: { id: string; rotulo: string; dica?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label htmlFor={id} className="text-xs font-semibold">{rotulo}</Label>
      <div className="mt-1">{children}</div>
      {dica && <p className="mt-1 text-xs text-muted-foreground">{dica}</p>}
    </div>
  );
}

function Interruptor({ id, rotulo, ligado, aoMudar }: { id: string; rotulo: string; ligado: boolean; aoMudar: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label htmlFor={id} className="text-sm font-normal">{rotulo}</Label>
      <Switch id={id} checked={ligado} onCheckedChange={aoMudar} />
    </div>
  );
}

/** Lista editável: digita e Enter, ou cola várias linhas de uma vez. */
function ListaDeItens({ id, rotulo, itens, aoMudar, exemplo }: { id: string; rotulo: string; itens: string[]; aoMudar: (l: string[]) => void; exemplo: string }) {
  const [texto, setTexto] = useState('');
  const incluir = () => { const novos = itensDoTexto(texto); if (novos.length) { aoMudar([...itens, ...novos]); setTexto(''); } };
  return (
    <div>
      <Label htmlFor={id} className="text-xs font-semibold">{rotulo}</Label>
      {itens.length > 0 && (
        <ul className="mt-1.5 space-y-1.5">
          {itens.map((t, i) => (
            <li key={`${t}-${i}`} className="flex items-center gap-2 rounded-lg bg-muted/60 py-1.5 pl-3 pr-1 text-sm">
              <Check className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="flex-1">{t}</span>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label={`Tirar “${t}”`} onClick={() => aoMudar(itens.filter((_, j) => j !== i))}><X className="h-3.5 w-3.5" /></Button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-1.5 flex gap-2">
        <Input
          id={id}
          value={texto}
          onChange={e => setTexto(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); incluir(); } }}
          onPaste={e => { const t = e.clipboardData.getData('text'); if (t.includes('\n')) { e.preventDefault(); aoMudar([...itens, ...itensDoTexto(t)]); } }}
          placeholder={exemplo}
        />
        <Button type="button" variant="outline" onClick={incluir} disabled={!texto.trim()}><Plus className="h-4 w-4" /> Incluir</Button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Enter inclui. Colar uma lista inteira vira um item por linha.</p>
    </div>
  );
}

function PassoDasPerguntas({ perguntas, banco, aoMudar }: { perguntas: NovaPergunta[]; banco: PerguntaDeVaga[]; aoMudar: (p: NovaPergunta[]) => void }) {
  const troca = (i: number, p: Partial<NovaPergunta>) => aoMudar(perguntas.map((q, j) => (j === i ? { ...q, ...p } : q)));
  const doBanco = banco.filter(b => !perguntas.some(p => p.texto === b.texto));
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Perguntas que a pessoa responde ao se candidatar. Nesta fase a inscrição continua no Forms; elas ficam guardadas para quando a candidatura vier para o app.</p>
      {doBanco.length > 0 && (
        <div>
          <p className="text-xs font-semibold">Do banco de perguntas</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {doBanco.map(b => (
              <Button key={b.id} type="button" variant="outline" size="sm" onClick={() => aoMudar([...perguntas, { texto: b.texto, tipo: b.tipo, opcoes: b.opcoes, obrigatoria: b.obrigatoria }])}>
                <Plus className="h-3.5 w-3.5" /> {b.texto}
              </Button>
            ))}
          </div>
        </div>
      )}
      {perguntas.map((p, i) => (
        <div key={i} className="space-y-2 rounded-xl border border-border p-3" data-testid={`pergunta-${i}`}>
          <div className="flex gap-2">
            <Input aria-label={`Pergunta ${i + 1}`} value={p.texto} onChange={e => troca(i, { texto: e.target.value })} placeholder="Por que você quer trabalhar na ANA?" />
            <Button type="button" variant="ghost" size="icon" aria-label={`Tirar pergunta ${i + 1}`} onClick={() => aoMudar(perguntas.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select aria-label={`Tipo da pergunta ${i + 1}`} className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={p.tipo} onChange={e => troca(i, { tipo: e.target.value as TipoDePergunta })}>
              {TIPOS_DE_PERGUNTA.map(t => <option key={t} value={t}>{ROTULO_DO_TIPO[t]}</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm"><Switch checked={p.obrigatoria} onCheckedChange={v => troca(i, { obrigatoria: v })} aria-label={`Pergunta ${i + 1} obrigatória`} /> Obrigatória</label>
          </div>
          {(p.tipo === 'unica' || p.tipo === 'multipla') && (
            <Textarea aria-label={`Opções da pergunta ${i + 1}`} rows={3} value={p.opcoes.join('\n')} onChange={e => troca(i, { opcoes: e.target.value.split('\n') })} placeholder={'Uma opção por linha\nManhã\nTarde'} />
          )}
        </div>
      ))}
      <Button type="button" variant="outline" onClick={() => aoMudar([...perguntas, { texto: '', tipo: 'texto_curto', opcoes: [], obrigatoria: false }])}><Plus className="h-4 w-4" /> Nova pergunta</Button>
    </div>
  );
}

function Revisao({ f, termos }: { f: FormularioDaVaga; termos: ReturnType<typeof termosDoFormulario> }) {
  const avisos = avisosDaRevisao(f);
  const linha = (r: string, v: string) => <div className="flex gap-3 border-b border-border py-2 text-sm last:border-0"><span className="w-32 shrink-0 text-muted-foreground">{r}</span><span className="min-w-0 flex-1 break-words">{v || '—'}</span></div>;
  return (
    <div className="space-y-4">
      {termos.length > 0 && (
        <div className="rounded-xl bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950/60 dark:text-red-100" role="alert" data-testid="termos-bloqueados">
          <p className="font-semibold">Não dá para publicar com estes trechos:</p>
          <ul className="mt-1 list-disc pl-5">{termos.map((t, i) => <li key={i}>“{t.trecho}” em {t.campo} ({t.motivo})</li>)}</ul>
          <p className="mt-1.5 text-xs">A vaga não pode escolher pessoa por gênero, idade, aparência, estado civil, religião, raça ou gravidez. O rascunho pode ser salvo.</p>
        </div>
      )}
      {avisos.length > 0 && (
        <ul className="space-y-1 rounded-xl bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/60 dark:text-amber-100">{avisos.map(a => <li key={a}>{a}</li>)}</ul>
      )}
      <div className="rounded-xl bg-muted/40 px-3">
        {linha('Título', f.titulo)}
        {linha('Área', f.area ? ROTULO_DA_AREA[f.area] : '')}
        {linha('Onde e como', `${f.cidade} · ${ROTULO_DA_MODALIDADE[f.modalidade]} · ${ROTULO_DA_CONTRATACAO[f.contratacao]}${f.carga_horaria ? ` · ${f.carga_horaria}` : ''}`)}
        {linha('Requisitos', f.requisitos.join(' · '))}
        {linha('Benefícios', f.beneficios.join(' · '))}
        {linha('Formulário', f.link_externo)}
        {linha('Prazo', f.prazo ? f.prazo.split('-').reverse().join('/') : 'Sem prazo')}
        {linha('Perguntas', f.perguntas.filter(p => p.texto.trim()).length ? `${f.perguntas.filter(p => p.texto.trim()).length}` : 'Nenhuma')}
      </div>
    </div>
  );
}
