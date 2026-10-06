import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Info, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useTituloDaAba } from '@/hooks/useTituloDaAba';
import { PassosComAviao } from '@/components/vagas/LinhaDeVoo';
import { MolduraDaConta } from '@/components/vagas/MolduraDaConta';
import { ROTAS_DO_CANDIDATO, ehCandidato } from '@/lib/vagas/conta';
import { comMaiusculas } from '@/lib/vagas/maiusculas';
import {
  ESCOLARIDADES, PASSOS_DO_PERFIL, PERFIL_VAZIO, TURNOS, apagarExperiencia, carregarPerfil, mascararWhatsapp,
  passosCompletos, periodo, salvarExperiencia, salvarPerfil, whatsappValido,
  type Experiencia, type Perfil, type Turno,
} from '@/lib/vagas/perfil';

/**
 * /vagas/meu-perfil — o perfil em 5 passos curtos (mockup aprovado em
 * 06/10/2026). Um passo por tela, com o avião claro na parada atual. Cada
 * "Continuar" grava o passo; "Depois" grava o que tiver e volta para Minha
 * área, sem exigir nada. `?passo=3` abre direto no passo que falta.
 */

const ULTIMO = PASSOS_DO_PERFIL.length - 1;

const PERGUNTAS = ['Sobre você', 'Como falamos com você?', 'Até onde você estudou?', 'Onde você já trabalhou?', 'Quando você pode trabalhar?'];

type RascunhoExp = Omit<Experiencia, 'id'> & { id?: string };
/** Campos que ganham maiúsculas automáticas ao salvar (06/10/2026); `true` = nome de pessoa. */
const AJEITAR: Partial<Record<keyof Perfil, boolean>> = { nome: true, nome_social: true, cidade: false, bairro: false, curso: false };

const EXP_VAZIA: RascunhoExp = { funcao: '', onde: '', inicio: '', fim: '', atual: false, descricao: '' };

function idadeValida(data: string): boolean {
  const d = new Date(`${data}T12:00:00`);
  if (Number.isNaN(d.getTime())) return false;
  const anos = (Date.now() - d.getTime()) / (365.25 * 864e5);
  return anos >= 14 && anos <= 100;
}

function Campo({ id, rotulo, opcional, ajuda, children }: { id: string; rotulo: string; opcional?: boolean; ajuda?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">{rotulo}{opcional && <span className="font-normal text-muted-foreground"> (opcional)</span>}</label>
      {children}
      {ajuda && <span className="text-xs text-muted-foreground">{ajuda}</span>}
    </div>
  );
}

function Escolha({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={ativo}
      className={`rounded-full px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${ativo ? 'bg-foreground text-background' : 'bg-muted hover:bg-muted/70'}`}>
      {children}
    </button>
  );
}

const campoGrande = 'h-12 rounded-xl text-base';

export default function MeuPerfilCandidatoPage() {
  useTituloDaAba('Meu perfil · Trabalhe Conosco ANA Brasil');
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { user, isAuthenticated, loading } = useAuth();
  const [perfil, setPerfil] = useState<Perfil>(PERFIL_VAZIO);
  const [exps, setExps] = useState<Experiencia[]>([]);
  const [carregado, setCarregado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [rascunho, setRascunho] = useState<RascunhoExp | null>(null);
  const [pronto, setPronto] = useState(false);

  const passo = Math.min(ULTIMO, Math.max(0, Number(params.get('passo') ?? 0) || 0));
  const irPara = (n: number) => { setErro(null); setParams(n ? { passo: String(n) } : {}, { replace: true }); };

  const idDoCandidato = user && ehCandidato(user) ? user.id : null;
  useEffect(() => {
    if (!idDoCandidato) return;
    carregarPerfil(idDoCandidato)
      .then(({ perfil: p, experiencias }) => { setPerfil(p); setExps(experiencias); })
      .catch(() => setErro('Não consegui abrir o seu perfil. Confira a internet e recarregue a página.'))
      .finally(() => setCarregado(true));
  }, [idDoCandidato]);

  if (loading) return null;
  if (!isAuthenticated) return <Navigate to={`${ROTAS_DO_CANDIDATO.entrar}?volta=${encodeURIComponent(ROTAS_DO_CANDIDATO.meuPerfil)}`} replace />;
  if (!ehCandidato(user)) return <Navigate to="/" replace />;
  const userId = user!.id;

  const muda = <K extends keyof Perfil>(k: K, v: Perfil[K]) => { setPerfil((p) => ({ ...p, [k]: v })); setSalvo(false); };

  /** O que cada passo grava. */
  const camposDoPasso = (n: number): Partial<Perfil> => [
    { nome: perfil.nome, nome_social: perfil.nome_social, nascimento: perfil.nascimento },
    { whatsapp: perfil.whatsapp, cidade: perfil.cidade, bairro: perfil.bairro },
    { escolaridade: perfil.escolaridade, curso: perfil.curso, cursos_livres: perfil.cursos_livres },
    { sem_experiencia: perfil.sem_experiencia },
    { disponibilidade: perfil.disponibilidade, acessibilidade: perfil.acessibilidade },
  ][n];

  function problema(n: number): string | null {
    if (n === 0 && !perfil.nome.trim()) return 'Escreva o seu nome completo.';
    if (n === 0 && !idadeValida(perfil.nascimento)) return 'Confira a data de nascimento.';
    if (n === 1 && !whatsappValido(perfil.whatsapp)) return 'Confira o WhatsApp, com o DDD: (19) 99123-4567.';
    if (n === 1 && !perfil.cidade.trim()) return 'Escreva a cidade onde você mora.';
    if (n === 2 && !perfil.escolaridade) return 'Escolha até onde você estudou.';
    if (n === 3 && exps.length === 0 && !perfil.sem_experiencia) return 'Adicione uma experiência ou toque em “Não tenho”.';
    if (n === 4 && perfil.disponibilidade.length === 0) return 'Escolha pelo menos um horário.';
    return null;
  }

  async function gravar(n: number, extra: Partial<Perfil> = {}): Promise<boolean> {
    setSalvando(true);
    try {
      // Nascimento inválido não vai ao banco (seria recusado); o resto do passo vai.
      const campos = { ...camposDoPasso(n), ...extra };
      for (const [k, pessoa] of Object.entries(AJEITAR) as Array<[keyof Perfil, boolean]>) {
        const v = campos[k];
        if (typeof v === 'string') (campos as Record<string, unknown>)[k] = comMaiusculas(v, { pessoa });
      }
      if ('nascimento' in campos && campos.nascimento && !idadeValida(campos.nascimento)) delete campos.nascimento;
      if ('nome' in campos && !campos.nome?.trim()) delete campos.nome;
      await salvarPerfil(userId, campos);
      setPerfil((p) => ({ ...p, ...campos }));
      setSalvo(true);
      return true;
    } catch {
      setErro('Não deu para salvar. Confira a internet e tente de novo.');
      return false;
    } finally {
      setSalvando(false);
    }
  }

  async function continuar(e: FormEvent) {
    e.preventDefault();
    const p = problema(passo);
    if (p) { setErro(p); return; }
    const ultimo = passo === ULTIMO;
    const completo = passosCompletos(perfil, exps.length).every(Boolean);
    const ok = await gravar(passo, ultimo && completo ? { perfil_concluido_em: perfil.perfil_concluido_em ?? new Date().toISOString() } : {});
    if (!ok) return;
    if (ultimo) setPronto(true); else irPara(passo + 1);
  }

  async function depois() {
    if (await gravar(passo)) navigate(ROTAS_DO_CANDIDATO.minhaArea);
  }

  async function semExperiencia() {
    muda('sem_experiencia', true);
    if (await gravar(3, { sem_experiencia: true })) irPara(4);
  }

  async function guardarExp() {
    if (!rascunho) return;
    if (!rascunho.funcao.trim() || !rascunho.onde.trim()) { setErro('Escreva a função e onde foi.'); return; }
    if (!rascunho.inicio) { setErro('Escolha o mês de início.'); return; }
    if (!rascunho.atual && !rascunho.fim) { setErro('Escolha o mês de saída, ou marque que trabalha lá hoje.'); return; }
    if (!rascunho.atual && rascunho.fim! < rascunho.inicio) { setErro('A saída não pode vir antes do início.'); return; }
    setSalvando(true);
    try {
      const salva = await salvarExperiencia(userId, { ...rascunho, funcao: comMaiusculas(rascunho.funcao), onde: comMaiusculas(rascunho.onde) });
      setExps((l) => [salva, ...l.filter((x) => x.id !== salva.id)].sort((a, b) => b.inicio.localeCompare(a.inicio)));
      if (perfil.sem_experiencia) { muda('sem_experiencia', false); await salvarPerfil(userId, { sem_experiencia: false }); }
      setRascunho(null); setErro(null); setSalvo(true);
    } catch {
      setErro('Não deu para salvar a experiência. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  }

  async function tirarExp(id: string) {
    try { await apagarExperiencia(id); setExps((l) => l.filter((x) => x.id !== id)); }
    catch { setErro('Não deu para apagar. Tente de novo.'); }
  }

  const feitos = passosCompletos(perfil, exps.length);
  const alternar = (t: Turno) => muda('disponibilidade', perfil.disponibilidade.includes(t) ? perfil.disponibilidade.filter((x) => x !== t) : [...perfil.disponibilidade, t]);

  return (
    <MolduraDaConta atalho={<Link to={ROTAS_DO_CANDIDATO.minhaArea} className="text-foreground hover:text-primary">Minha área</Link>}>
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 pb-10 pt-2 sm:px-6">
        <div className="flex flex-col gap-2">
          <PassosComAviao total={PASSOS_DO_PERFIL.length} atual={pronto ? ULTIMO : passo} concluidos={pronto ? feitos.map(() => true) : feitos} />
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <span aria-live="polite">{pronto ? 'Perfil pronto' : `${passo + 1} de ${PASSOS_DO_PERFIL.length} · ${PASSOS_DO_PERFIL[passo]}`}</span>
            {salvo && !pronto && <span className="flex items-center gap-1 normal-case tracking-normal text-emerald-700 dark:text-emerald-400"><Check className="h-3.5 w-3.5" /> Salvo</span>}
          </div>
        </div>

        {pronto ? (
          <div className="vg-pergunta flex flex-col items-start gap-4">
            <span className="grid h-16 w-16 place-items-center rounded-[20px] bg-[#81E2CF] text-[#1F2322]"><Check className="h-8 w-8" strokeWidth={2.6} /></span>
            <h1 className="text-[28px] font-bold leading-tight">Perfil pronto.</h1>
            <p className="text-muted-foreground">Você pode mudar qualquer resposta quando quiser.</p>
            <div className="flex flex-wrap gap-2">
              <Button asChild className="h-12 rounded-xl px-6"><Link to={ROTAS_DO_CANDIDATO.curriculo}>Enviar currículo <ArrowRight className="h-4 w-4" /></Link></Button>
              <Button asChild variant="outline" className="h-12 rounded-xl px-6"><Link to={ROTAS_DO_CANDIDATO.minhaArea}>Minha área</Link></Button>
            </div>
          </div>
        ) : !carregado ? (
          <p className="text-muted-foreground">Abrindo o seu perfil…</p>
        ) : (
          <form key={passo} onSubmit={continuar} noValidate className="vg-pergunta flex flex-col gap-4" aria-label={PERGUNTAS[passo]}>
            <h1 className="text-[26px] font-bold leading-tight sm:text-[30px]">{PERGUNTAS[passo]}</h1>

            {passo === 0 && (
              <>
                <Campo id="pf-nome" rotulo="Nome completo">
                  <Input id="pf-nome" autoComplete="name" maxLength={120} value={perfil.nome} onChange={(e) => muda('nome', e.target.value)} className={campoGrande} />
                </Campo>
                <Campo id="pf-social" rotulo="Como prefere ser chamado" opcional ajuda="Se preencher, o RH usa este nome.">
                  <Input id="pf-social" maxLength={120} value={perfil.nome_social} onChange={(e) => muda('nome_social', e.target.value)} className={campoGrande} placeholder="Nome social" />
                </Campo>
                <Campo id="pf-nasc" rotulo="Data de nascimento">
                  <Input id="pf-nasc" type="date" value={perfil.nascimento} onChange={(e) => muda('nascimento', e.target.value)} className={campoGrande} />
                </Campo>
              </>
            )}

            {passo === 1 && (
              <>
                <Campo id="pf-whats" rotulo="WhatsApp">
                  <Input id="pf-whats" type="tel" inputMode="tel" autoComplete="tel-national" placeholder="(19) 99123-4567" value={perfil.whatsapp}
                    onChange={(e) => muda('whatsapp', mascararWhatsapp(e.target.value))} className={campoGrande} />
                </Campo>
                <Campo id="pf-cidade" rotulo="Cidade">
                  <Input id="pf-cidade" autoComplete="address-level2" maxLength={80} placeholder="Campinas/SP" value={perfil.cidade} onChange={(e) => muda('cidade', e.target.value)} className={campoGrande} />
                </Campo>
                <Campo id="pf-bairro" rotulo="Bairro" opcional ajuda="Ajuda a pensar na unidade mais perto de você.">
                  <Input id="pf-bairro" maxLength={80} placeholder="Ex.: Jardim Nilópolis" value={perfil.bairro} onChange={(e) => muda('bairro', e.target.value)} className={campoGrande} />
                </Campo>
                <p className="flex items-center gap-2 text-sm text-muted-foreground"><Info className="h-4 w-4 shrink-0 text-sky-700 dark:text-sky-400" /> CPF e RG só se você avançar no processo.</p>
              </>
            )}

            {passo === 2 && (
              <>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Escolaridade">
                  {ESCOLARIDADES.map(([k, rotulo]) => <Escolha key={k} ativo={perfil.escolaridade === k} onClick={() => muda('escolaridade', k)}>{rotulo}</Escolha>)}
                </div>
                <Campo id="pf-curso" rotulo="Curso" opcional>
                  <Input id="pf-curso" maxLength={160} placeholder="Ex.: Pedagogia, Técnico em Nutrição" value={perfil.curso} onChange={(e) => muda('curso', e.target.value)} className={campoGrande} />
                </Campo>
                <Campo id="pf-livres" rotulo="Cursos livres e certificados" opcional>
                  <Textarea id="pf-livres" maxLength={600} rows={2} placeholder="Ex.: Primeiros socorros" value={perfil.cursos_livres} onChange={(e) => muda('cursos_livres', e.target.value)} className="rounded-xl text-base" />
                </Campo>
              </>
            )}

            {passo === 3 && (
              <>
                <ul className="flex flex-col gap-2">
                  {exps.map((x) => (
                    <li key={x.id} className="flex items-center gap-2 rounded-2xl bg-muted/60 p-3">
                      <div className="min-w-0 flex-1">
                        <b className="block truncate">{x.funcao}</b>
                        <span className="block truncate text-sm text-muted-foreground">{x.onde} · {periodo(x)}</span>
                      </div>
                      <Button type="button" variant="ghost" size="icon" aria-label={`Editar ${x.funcao}`} onClick={() => setRascunho({ ...x, fim: x.fim ?? '' })}><Pencil className="h-4 w-4" /></Button>
                      <Button type="button" variant="ghost" size="icon" aria-label={`Apagar ${x.funcao}`} onClick={() => tirarExp(x.id)}><Trash2 className="h-4 w-4" /></Button>
                    </li>
                  ))}
                </ul>
                {rascunho ? (
                  <div className="flex flex-col gap-3 rounded-2xl bg-muted/60 p-4" role="group" aria-label="Experiência">
                    <Campo id="ex-funcao" rotulo="Função">
                      <Input id="ex-funcao" maxLength={120} placeholder="Ex.: Auxiliar de cozinha" value={rascunho.funcao} onChange={(e) => setRascunho({ ...rascunho, funcao: e.target.value })} className={campoGrande} />
                    </Campo>
                    <Campo id="ex-onde" rotulo="Onde">
                      <Input id="ex-onde" maxLength={120} placeholder="Empresa, escola ou projeto" value={rascunho.onde} onChange={(e) => setRascunho({ ...rascunho, onde: e.target.value })} className={campoGrande} />
                    </Campo>
                    <div className="grid grid-cols-2 gap-3">
                      <Campo id="ex-inicio" rotulo="Início">
                        <Input id="ex-inicio" type="month" value={rascunho.inicio} onChange={(e) => setRascunho({ ...rascunho, inicio: e.target.value })} className={campoGrande} />
                      </Campo>
                      {!rascunho.atual && (
                        <Campo id="ex-fim" rotulo="Saída">
                          <Input id="ex-fim" type="month" value={rascunho.fim ?? ''} onChange={(e) => setRascunho({ ...rascunho, fim: e.target.value })} className={campoGrande} />
                        </Campo>
                      )}
                    </div>
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <Checkbox checked={rascunho.atual} onCheckedChange={(v) => setRascunho({ ...rascunho, atual: v === true })} aria-label="Trabalho lá hoje" /> Trabalho lá hoje
                    </label>
                    <Campo id="ex-desc" rotulo="O que você fazia" opcional>
                      <Textarea id="ex-desc" maxLength={600} rows={2} value={rascunho.descricao} onChange={(e) => setRascunho({ ...rascunho, descricao: e.target.value })} className="rounded-xl text-base" />
                    </Campo>
                    <div className="flex gap-2">
                      <Button type="button" variant="ghost" onClick={() => { setRascunho(null); setErro(null); }}>Cancelar</Button>
                      <Button type="button" disabled={salvando} onClick={guardarExp} className="flex-1">Salvar experiência</Button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => setRascunho({ ...EXP_VAZIA })}
                    className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-50 font-semibold text-emerald-900 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-200">
                    <Plus className="h-4 w-4" /> Adicionar experiência
                  </button>
                )}
                <p className="flex items-center gap-2 text-sm text-muted-foreground"><Info className="h-4 w-4 shrink-0 text-sky-700 dark:text-sky-400" /> Voluntariado e projetos contam.</p>
              </>
            )}

            {passo === 4 && (
              <>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Horários">
                  {TURNOS.map(([k, rotulo]) => <Escolha key={k} ativo={perfil.disponibilidade.includes(k)} onClick={() => alternar(k)}>{rotulo}</Escolha>)}
                </div>
                <Campo id="pf-acess" rotulo="Precisa de algum apoio de acessibilidade?" opcional ajuda="Só o RH do processo vê.">
                  <Textarea id="pf-acess" maxLength={600} rows={2} placeholder="Conte só se quiser" value={perfil.acessibilidade} onChange={(e) => muda('acessibilidade', e.target.value)} className="rounded-xl text-base" />
                </Campo>
              </>
            )}

            {erro && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-900 dark:bg-red-950/60 dark:text-red-100">{erro}</p>}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              {passo > 0 && <Button type="button" variant="ghost" className="h-12 rounded-xl" onClick={async () => { await gravar(passo); irPara(passo - 1); }}><ArrowLeft className="h-4 w-4" /> Voltar</Button>}
              {passo === 3 && exps.length === 0 && !rascunho
                ? <Button type="button" variant="outline" className="h-12 rounded-xl" onClick={semExperiencia}>Não tenho</Button>
                : passo < ULTIMO && <Button type="button" variant="outline" className="h-12 rounded-xl" onClick={depois}>Depois</Button>}
              <Button type="submit" disabled={salvando || rascunho !== null} className="h-12 flex-1 rounded-xl px-6 text-base sm:flex-none">
                {passo === ULTIMO ? 'Concluir perfil' : <>Continuar <ArrowRight className="h-4 w-4" /></>}
              </Button>
            </div>
          </form>
        )}
      </div>
    </MolduraDaConta>
  );
}
