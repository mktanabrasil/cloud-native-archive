import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CalendarDays, Check, Clock, Download, Heart, MapPin, Users } from 'lucide-react';
import { useTituloDaAba } from '@/hooks/useTituloDaAba';
import InstitutionalFooterBar from '@/components/news/InstitutionalFooterBar';
import { findNewsUnit } from '@/lib/news/units';
import { ROTULO_DA_AREA } from '@/lib/pizza/modelo';
import { areasLotadas, enviarParaAPlanilha, inscrever } from '@/lib/voluntariado/api';
import { salvarComprovante } from '@/lib/voluntariado/comprovante';
import {
  AREAS_DE_AJUDA, AREAS_POR_VINCULO, descricaoDaArea, DIA_DO_EVENTO, GRUPO_DO_WHATSAPP, HORARIOS, MAPA_DO_TREINAMENTO, SOBRE_O_EVENTO, TEXTO_DO_HORARIO, TITULO_DAS_AREAS, TREINAMENTO, UNIDADES_DO_VOLUNTARIADO, ULTIMO_DIA, VINCULOS,
  encerrado, mascaraDoWhatsapp, mensagemDoErro, pedeAvisoDeLotada, problemaDaEtapa2, rotuloDaAjuda, rotuloDoHorario, tocarArea,
  type AreaDeAjuda, type Horario, type Vinculo,
} from '@/lib/voluntariado/modelo';

/**
 * /voluntariado/natalfeliz26 — inscrição de voluntários para o Natal Feliz
 * de 08/12/2026. Desde 23/10/2026, em três etapas e aberta a funcionários,
 * público e Alcance JNI (mockup aprovado em 23/10/2026):
 *  1. o treinamento obrigatório de 28/11 no Recanto Maanaim; quem não pode vê um
 *     agradecimento e o formulário para ali, sem gravar nada;
 *  2. nome, WhatsApp, horário e vínculo, com a pergunta que cada vínculo pede;
 *  3. as áreas do vínculo (1ª e 2ª opção). Área que bateu a meta abre um
 *     aviso e só entra como 2ª opção.
 * No fim, o protocolo, os dados do treinamento e o comprovante em imagem.
 *
 * Cores fixas da campanha nos dois temas: a página é uma peça do Natal Feliz,
 * não uma tela do app.
 */

const COR = { verde: '#1E4D3A', verde2: '#2F6B52', verdeClaro: '#EAF3EE', vermelho: '#C8372D', vermelhoEsc: '#9E2A22', creme: '#F6EEDF', fundo: '#FFFCF6', tinta: '#24201B', mut: '#6E655B', linha: '#E9DDC9', ouro: '#E4B23A', ouroClaro: '#FBF3DE' };

type Etapa = 'treino' | 'sem_treino' | 'quem' | 'areas' | 'feito';

const campo = 'h-12 w-full rounded-xl border-2 bg-white px-3 text-base text-[#24201B] outline-none focus:border-[#1E4D3A]';
const botao = 'h-14 w-full rounded-2xl text-base font-bold text-white disabled:opacity-60';
const voltar = 'h-10 w-full rounded-xl text-sm font-semibold';

function Etapas({ n }: { n: number }) {
  return (
    <div className="flex items-center gap-1.5" data-testid="etapas">
      {[1, 2, 3].map((i) => <i key={i} className="h-1.5 flex-1 rounded-full" style={{ background: i <= n ? COR.verde2 : COR.linha }} />)}
      <span className="ml-1 whitespace-nowrap text-[12px]" style={{ color: COR.mut }}>Etapa {n} de 3</span>
    </div>
  );
}

function Titulo({ n, children }: { n: number; children: ReactNode }) {
  return <h2 className="text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: COR.vermelhoEsc }}>{n} · {children}</h2>;
}

function Pergunta({ children, id }: { children: ReactNode; id?: string }) {
  return <p id={id} className="text-[16px] font-bold leading-snug">{children}</p>;
}

/** Uma resposta de escolha única: cartão com bolinha (ou a cor do horário). */
function Escolha({ marcada, onClick, cor, children, detalhe }: { marcada: boolean; onClick: () => void; cor?: string; children: ReactNode; detalhe?: string }) {
  return (
    <button type="button" aria-pressed={marcada} onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border-2 bg-white px-3 py-3 text-left text-[14.5px] font-semibold transition active:scale-[0.99]"
      style={marcada ? { borderColor: COR.verde, background: COR.verdeClaro } : { borderColor: COR.linha }}>
      {cor
        ? <span className="h-4 w-4 shrink-0 rounded-full" style={{ background: cor, boxShadow: marcada ? `0 0 0 3px ${COR.verdeClaro}, 0 0 0 5px ${COR.verde}` : undefined }} aria-hidden />
        : <span className="h-5 w-5 shrink-0 rounded-full border-2" style={marcada ? { borderColor: COR.verde, borderWidth: 6 } : { borderColor: COR.linha }} aria-hidden />}
      <span>{children}{detalhe && <small className="block text-[12px] font-normal" style={{ color: COR.mut }}>{detalhe}</small>}</span>
    </button>
  );
}

/** "horário a definir", com borda tracejada, enquanto o dado não chega. */
const OuADefinir = ({ valor, texto }: { valor: string; texto: string }) =>
  valor ? <b>{valor}</b> : <span className="inline-block rounded-md border-[1.5px] border-dashed px-1.5 font-semibold opacity-85" style={{ borderColor: COR.verde2 }}>{texto}</span>;

export default function VoluntariadoPage() {
  useTituloDaAba('Natal Feliz · Dia do Voluntariado');
  const [etapa, setEtapa] = useState<Etapa>('treino');
  const [treino, setTreino] = useState<'sim' | 'nao' | null>(null);
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [horario, setHorario] = useState<Horario | null>(null);
  const [vinculo, setVinculo] = useState<Vinculo | null>(null);
  const [unidade, setUnidade] = useState('');
  const [indicado, setIndicado] = useState<boolean | null>(null);
  const [indicadoPor, setIndicadoPor] = useState('');
  const [temIgreja, setTemIgreja] = useState<boolean | null>(null);
  const [igreja, setIgreja] = useState('');
  const [opcoes, setOpcoes] = useState<{ opcao1: AreaDeAjuda | null; opcao2: AreaDeAjuda | null }>({ opcao1: null, opcao2: null });
  const [lotadas, setLotadas] = useState<string[]>([]);
  const [aviso, setAviso] = useState<AreaDeAjuda | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [baixando, setBaixando] = useState(false);
  const [feito, setFeito] = useState<{ protocolo: string; linhas: Array<[string, string]> } | null>(null);
  const topo = useRef<HTMLDivElement>(null);
  const fechado = encerrado();

  const buscarLotadas = () => areasLotadas().then(setLotadas).catch(() => { /* sem a lista, o banco confere ao gravar */ });
  useEffect(() => { buscarLotadas(); }, []);

  function ir(e: Etapa) {
    setEtapa(e); setErro(null);
    if (e === 'areas') buscarLotadas();
    topo.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }

  function escolherVinculo(v: Vinculo) {
    setVinculo(v); setErro(null);
    // As áreas mudam com o vínculo: o que estava marcado pode não existir mais.
    setOpcoes({ opcao1: null, opcao2: null });
  }

  function seguirParaAsAreas() {
    const p = problemaDaEtapa2({ nome, whatsapp, horario, vinculo, unidade: unidade || null, indicado, indicadoPor, temIgreja, igreja });
    if (p) { setErro(p); return; }
    ir('areas');
  }

  function tocar(k: AreaDeAjuda) {
    setErro(null);
    if (pedeAvisoDeLotada(opcoes, k, lotadas)) { setAviso(k); return; }
    setOpcoes((o) => tocarArea(o, k, lotadas));
  }

  async function enviar() {
    if (!opcoes.opcao1) { setErro('Escolha onde você quer ajudar (a 1ª opção).'); return; }
    setEnviando(true); setErro(null);
    try {
      const protocolo = await inscrever({
        nome, whatsapp, horario: horario!, vinculo: vinculo!, unidadeId: unidade || null,
        indicadoPor: indicado ? indicadoPor : null, igreja: temIgreja ? igreja : null,
        opcao1: opcoes.opcao1, opcao2: opcoes.opcao2,
      });
      enviarParaAPlanilha();
      const v = VINCULOS.find((x) => x.chave === vinculo)!;
      const quem = vinculo === 'funcionario' ? `${v.curto} · ${findNewsUnit(unidade)?.name ?? ''}`
        : vinculo === 'comunidade' && indicado && indicadoPor.trim() ? `${v.curto} · indicado(a) por ${indicadoPor.trim()}` : v.curto;
      const linhas: Array<[string, string]> = [['Nome', nome.trim().replace(/\s+/g, ' ')], ['Vínculo', quem], ['Horário', rotuloDoHorario(horario)], ['1ª opção', rotuloDaAjuda(opcoes.opcao1)]];
      if (opcoes.opcao2) linhas.push(['2ª opção', rotuloDaAjuda(opcoes.opcao2)]);
      if (vinculo === 'comunidade' && temIgreja && igreja.trim()) linhas.push(['Igreja', igreja.trim()]);
      setFeito({ protocolo, linhas });
      setEtapa('feito');
      window.scrollTo?.({ top: 0 });
    } catch (e) {
      if (/area_lotada/.test(String((e as { message?: string })?.message ?? e))) {
        // A última vaga saiu enquanto a pessoa preenchia: a área vira a 2ª opção.
        const lotou = opcoes.opcao1;
        setLotadas((l) => [...new Set([...l, lotou])]);
        setOpcoes((o) => ({ opcao1: o.opcao2 && !lotadas.includes(o.opcao2) ? o.opcao2 : null, opcao2: lotou }));
        setErro(`As vagas de ${rotuloDaAjuda(lotou)} acabaram de ser preenchidas. Ela ficou como a sua 2ª opção; confira a 1ª e envie de novo.`);
        buscarLotadas();
      } else {
        setErro(mensagemDoErro(e));
      }
    } finally {
      setEnviando(false);
    }
  }

  async function baixar() {
    if (!feito) return;
    setBaixando(true);
    try { await salvarComprovante(feito); }
    catch { setErro('Não deu para gerar o comprovante. Tente de novo.'); }
    finally { setBaixando(false); }
  }

  const Erro = () => (erro ? <p role="alert" className="rounded-xl px-3 py-2.5 text-sm font-semibold" style={{ background: '#FDE7E2', color: COR.vermelhoEsc }}>{erro}</p> : null);

  return (
    <div className="flex min-h-screen flex-col" style={{ background: COR.fundo, color: COR.tinta }}>
      <div className="mx-auto w-full max-w-[560px] flex-1">
        {/* A arte da campanha (22/10/2026). */}
        <img src="/voluntariado-natal-feliz-capa.webp" alt="Natal Feliz, ANA Brasil: crianças sorrindo com presentes" width={1793} height={877} className="block aspect-[1793/877] w-full object-cover" data-testid="capa" />
        <div className="flex flex-col gap-0.5 px-5 py-3.5 text-white" style={{ background: COR.vermelho }}>
          {feito ? (
            <>
              <b className="text-sm uppercase tracking-[0.06em]">Dia do Voluntariado</b>
              <span className="text-[13px] opacity-90">Obrigado por fazer parte!</span>
            </>
          ) : (
            <>
              {/* A data do evento ao lado do título; as inscrições na linha de baixo (21/10/2026). */}
              <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <b className="text-sm uppercase tracking-[0.06em]">Dia do Voluntariado</b>
                <span className="rounded-full bg-white/20 px-2.5 py-px text-[12.5px] font-semibold" data-testid="dia-do-evento">{DIA_DO_EVENTO} · Natal Feliz</span>
              </span>
              <span className="text-[13px] opacity-90">Inscrições até {ULTIMO_DIA}</span>
            </>
          )}
        </div>

        <div ref={topo} className="scroll-mt-2" />
        {etapa === 'feito' && feito ? (
          <div className="flex flex-col gap-5 px-5 py-8">
            <div className="flex flex-col items-center gap-2 text-center">
              <span className="grid h-16 w-16 place-items-center rounded-[20px] text-white" style={{ background: COR.verde }}><Check className="h-9 w-9" strokeWidth={2.6} /></span>
              <h1 className="text-xl font-bold">Inscrição feita</h1>
              <b className="text-3xl font-extrabold tracking-wide" style={{ color: COR.vermelhoEsc }} data-testid="protocolo">{feito.protocolo}</b>
            </div>
            <p className="text-center text-[15px] font-semibold" style={{ color: COR.verde }} data-testid="agradecimento">Obrigado por fazer parte do Dia do Voluntariado! Você vai deixar o Natal de muitas crianças mais feliz. 💚</p>
            <dl className="grid gap-2 rounded-2xl border-[1.5px] bg-white p-4 text-sm" style={{ borderColor: COR.linha }} data-testid="resumo">
              {feito.linhas.map(([r, v]) => (
                <div key={r} className="flex justify-between gap-3"><dt style={{ color: COR.mut }}>{r}</dt><dd className="text-right font-semibold">{v}</dd></div>
              ))}
            </dl>
            {/* O grupo do WhatsApp (23/10/2026): a entrada é obrigatória; o formulário é aberto no celular, então é um botão. */}
            <div className="flex flex-col gap-2.5 rounded-2xl border-2 p-4 text-[13.5px] leading-relaxed" style={{ borderColor: '#25D366', background: '#E7F8EE', color: '#14532D' }} data-testid="grupo">
              <b className="text-[14.5px]">Grupo dos voluntários · entrada obrigatória</b>
              <span>É no grupo do WhatsApp que passamos todas as informações do treinamento e do dia do evento. Entre agora:</span>
              <a href={GRUPO_DO_WHATSAPP} target="_blank" rel="noopener noreferrer" className={`${botao} flex items-center justify-center gap-2`} style={{ background: '#1FA855' }}>
                <Users className="h-5 w-5" /> Entrar no grupo do WhatsApp
              </a>
            </div>
            {/* No lugar do "a equipe entra em contato" (23/10/2026): os dados do treinamento já aqui. */}
            <div className="flex flex-col gap-2.5 rounded-2xl p-4 text-[13.5px]" style={{ background: COR.verdeClaro, color: COR.verde }} data-testid="treinamento">
              <b className="text-[14.5px]">Treinamento de Voluntários · obrigatório</b>
              <p className="flex items-start gap-2.5"><CalendarDays className="mt-0.5 h-4 w-4 shrink-0" /><span><small className="block text-[10.5px] uppercase tracking-wider opacity-75">Data</small><b>{TREINAMENTO.data}</b></span></p>
              <p className="flex items-start gap-2.5"><Clock className="mt-0.5 h-4 w-4 shrink-0" /><span><small className="block text-[10.5px] uppercase tracking-wider opacity-75">Horário</small><OuADefinir valor={TREINAMENTO.horario} texto="a confirmar" /></span></p>
              <p className="flex items-start gap-2.5"><MapPin className="mt-0.5 h-4 w-4 shrink-0" /><span><small className="block text-[10.5px] uppercase tracking-wider opacity-75">Local</small><b>{TREINAMENTO.local}</b> <span className="opacity-80">· mesmo local do Natal Feliz</span><br /><a href={MAPA_DO_TREINAMENTO} target="_blank" rel="noopener noreferrer" className="underline" data-testid="endereco-do-treinamento">{TREINAMENTO.endereco}</a></span></p>
            </div>
            <Erro />
            <button type="button" onClick={baixar} disabled={baixando} className={`${botao} flex items-center justify-center gap-2`} style={{ background: COR.verde }}>
              <Download className="h-5 w-5" /> {baixando ? 'Gerando…' : 'Baixar comprovante'}
            </button>
            <p className="-mt-2 text-center text-[12.5px]" style={{ color: COR.mut }}>Uma imagem leve, com o protocolo e os dados do treinamento.</p>
          </div>
        ) : fechado ? (
          <div className="flex flex-col gap-3 px-5 py-10 text-center">
            <h1 className="text-xl font-bold">As inscrições foram encerradas em {ULTIMO_DIA}.</h1>
            <p style={{ color: COR.mut }}>Obrigado a todos que se ofereceram. Nos vemos no Natal Feliz!</p>
          </div>
        ) : etapa === 'sem_treino' ? (
          <div className="flex flex-col items-center gap-3 px-5 py-10 text-center" data-testid="sem-treino">
            <span className="grid h-16 w-16 place-items-center rounded-[20px] text-white" style={{ background: COR.vermelho }}><Heart className="h-8 w-8" fill="currentColor" /></span>
            <h1 className="text-xl font-bold">Obrigado pelo carinho!</h1>
            <p className="text-[14.5px]" style={{ color: COR.mut }}>Como o treinamento de {TREINAMENTO.dataCurta} é obrigatório para quem vai atuar no dia, desta vez não conseguimos contar com você como voluntário(a).</p>
            <p className="text-[14.5px]" style={{ color: COR.mut }}>Mas a sua vontade de ajudar já faz diferença. Se a sua agenda mudar até {ULTIMO_DIA}, é só voltar aqui e se inscrever. 💚</p>
            <button type="button" className={voltar} style={{ color: COR.mut }} onClick={() => ir('treino')}>Voltar e mudar a resposta</button>
          </div>
        ) : etapa === 'treino' ? (
          <div className="flex flex-col gap-6 px-5 py-6">
            {/* O convite (21/10/2026): para muita gente a ida é voluntária, então o formulário convida. */}
            <div className="flex flex-col gap-2.5 rounded-[20px] p-4 text-[13.5px] leading-relaxed" style={{ background: COR.verdeClaro, color: COR.verde }} data-testid="sobre-o-evento">
              <h2 className="text-[20px] font-bold leading-tight">{SOBRE_O_EVENTO.titulo}</h2>
              <p>{SOBRE_O_EVENTO.texto}</p>
              <p className="rounded-xl bg-white px-3 py-2.5 font-semibold" style={{ color: COR.vermelhoEsc }}>{SOBRE_O_EVENTO.destaque}</p>
              <ul className="flex flex-col gap-1.5">
                {SOBRE_O_EVENTO.selos.map((s) => (
                  <li key={s} className="flex items-center gap-2 text-[13px] font-semibold"><span className="grid h-[18px] w-[18px] place-items-center rounded-md text-white" style={{ background: COR.verde2 }}><Check className="h-3 w-3" strokeWidth={3} /></span>{s}</li>
                ))}
              </ul>
              <p className="font-bold">{SOBRE_O_EVENTO.chamada}</p>
            </div>
            <Etapas n={1} />
            <section className="flex flex-col gap-3">
              <Titulo n={1}>Antes de começar</Titulo>
              <p className="rounded-2xl border-2 px-3.5 py-3 text-[13.5px] leading-relaxed" style={{ borderColor: COR.ouro, background: COR.ouroClaro, color: '#5A4500' }} data-testid="aviso-do-treinamento">
                <b>Para se voluntariar, é obrigatório participar do Treinamento de Voluntários</b>, no dia <b>{TREINAMENTO.dataCurta}, no {TREINAMENTO.local}</b>. É nele que você conhece a equipe, a sua área e como vai ser o dia.
              </p>
              <Pergunta>Você tem disponibilidade para participar do treinamento em {TREINAMENTO.dataCurta}?</Pergunta>
              <Escolha marcada={treino === 'sim'} onClick={() => setTreino('sim')}>Sim, posso participar</Escolha>
              <Escolha marcada={treino === 'nao'} onClick={() => setTreino('nao')}>Não tenho disponibilidade</Escolha>
            </section>
            <button type="button" disabled={!treino} className={botao} style={{ background: COR.vermelho }} onClick={() => ir(treino === 'sim' ? 'quem' : 'sem_treino')}>Continuar</button>
          </div>
        ) : etapa === 'quem' ? (
          <form className="flex flex-col gap-6 px-5 py-6" onSubmit={(e) => { e.preventDefault(); seguirParaAsAreas(); }} noValidate aria-label="Inscrição de voluntário: quem é você">
            <Etapas n={2} />
            <section className="flex flex-col gap-3">
              <Titulo n={2}>Quem é você</Titulo>
              <label className="flex flex-col gap-1.5 text-sm font-semibold">Nome completo
                <input className={campo} style={{ borderColor: COR.linha }} autoComplete="name" maxLength={120} value={nome} onChange={(e) => { setNome(e.target.value); setErro(null); }} />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold">Telefone (WhatsApp)
                <input className={campo} style={{ borderColor: COR.linha }} type="tel" inputMode="tel" autoComplete="tel-national" placeholder="(19) 99999-9999" value={whatsapp} onChange={(e) => { setWhatsapp(mascaraDoWhatsapp(e.target.value)); setErro(null); }} />
              </label>
            </section>

            <section className="flex flex-col gap-2" aria-labelledby="pergunta-horario">
              <Pergunta id="pergunta-horario">Em que horário você pode ajudar?</Pergunta>
              <p className="-mt-1 mb-1 text-[13px]" style={{ color: COR.mut }}>{TEXTO_DO_HORARIO}</p>
              {HORARIOS.map((h) => (
                <Escolha key={h.chave} marcada={horario === h.chave} cor={h.cor} detalhe={h.detalhe} onClick={() => { setHorario(h.chave); setErro(null); }}>{h.rotulo}</Escolha>
              ))}
            </section>

            <section className="flex flex-col gap-2" aria-labelledby="pergunta-vinculo">
              <Pergunta id="pergunta-vinculo">Você é…</Pergunta>
              {VINCULOS.map((v) => (
                <Escolha key={v.chave} marcada={vinculo === v.chave} detalhe={v.detalhe || undefined} onClick={() => escolherVinculo(v.chave)}>{v.rotulo}</Escolha>
              ))}
              {vinculo === 'funcionario' && (
                <label className="mt-2 flex flex-col gap-1.5 text-sm font-semibold">Em qual unidade você trabalha?
                  <select className={campo} style={{ borderColor: COR.linha }} value={unidade} onChange={(e) => { setUnidade(e.target.value); setErro(null); }}>
                    <option value="">Escolha a unidade</option>
                    {UNIDADES_DO_VOLUNTARIADO.map(({ area, unidades }) => (
                      <optgroup key={area} label={ROTULO_DA_AREA[area]}>
                        {unidades.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </label>
              )}
              {vinculo === 'comunidade' && (
                <div className="mt-2 flex flex-col gap-2">
                  <Pergunta>Alguém da ANA te indicou?</Pergunta>
                  <Escolha marcada={indicado === true} onClick={() => { setIndicado(true); setErro(null); }}>Sim</Escolha>
                  <Escolha marcada={indicado === false} onClick={() => { setIndicado(false); setErro(null); }}>Não</Escolha>
                  {indicado && (
                    <label className="flex flex-col gap-1.5 text-sm font-semibold">Nome de quem te indicou
                      <input className={campo} style={{ borderColor: COR.linha }} maxLength={120} placeholder="Nome do funcionário(a)" value={indicadoPor} onChange={(e) => { setIndicadoPor(e.target.value); setErro(null); }} />
                    </label>
                  )}
                  {/* Obrigatória desde 23/10/2026: Sim/Não e, se sim, qual. */}
                  <Pergunta>Você faz parte de alguma igreja?</Pergunta>
                  <Escolha marcada={temIgreja === true} onClick={() => { setTemIgreja(true); setErro(null); }}>Sim</Escolha>
                  <Escolha marcada={temIgreja === false} onClick={() => { setTemIgreja(false); setErro(null); }}>Não</Escolha>
                  {temIgreja && (
                    <label className="flex flex-col gap-1.5 text-sm font-semibold">Qual igreja?
                      <input className={campo} style={{ borderColor: COR.linha }} maxLength={120} placeholder="Nome da igreja" value={igreja} onChange={(e) => { setIgreja(e.target.value); setErro(null); }} />
                    </label>
                  )}
                </div>
              )}
            </section>

            <Erro />
            <button type="submit" className={botao} style={{ background: COR.vermelho }}>Continuar</button>
            <button type="button" className={`${voltar} -mt-4`} style={{ color: COR.mut }} onClick={() => ir('treino')}>Voltar</button>
          </form>
        ) : (
          <form className="flex flex-col gap-5 px-5 py-6" onSubmit={(e) => { e.preventDefault(); enviar(); }} noValidate aria-label="Inscrição de voluntário: onde você quer ajudar">
            <Etapas n={3} />
            <section className="flex flex-col gap-2">
              <Titulo n={3}>Onde você quer ajudar</Titulo>
              <span className="text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: COR.mut }}>{TITULO_DAS_AREAS[vinculo!]}</span>
              <p className="-mt-1 mb-1 text-[13px]" style={{ color: COR.mut }}>Toque na sua 1ª opção e, se quiser, numa 2ª.</p>
              {AREAS_POR_VINCULO[vinculo!].map((k) => {
                const a = AREAS_DE_AJUDA.find((x) => x.chave === k)!;
                const ordem = opcoes.opcao1 === k ? 1 : opcoes.opcao2 === k ? 2 : 0;
                const lotada = lotadas.includes(k);
                return (
                  <button key={k} type="button" aria-pressed={ordem > 0} onClick={() => tocar(k)}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 rounded-xl border-2 bg-white px-3 py-2.5 text-left transition active:scale-[0.99]"
                    style={ordem === 1 ? { borderColor: COR.verde, background: COR.verdeClaro } : ordem === 2 ? { borderColor: COR.ouro, background: COR.ouroClaro } : { borderColor: COR.linha }}>
                    <span className="min-w-0">
                      <b className="block text-[14px]">{a.rotulo}</b>
                      {lotada && <span className="mb-0.5 mt-0.5 inline-block rounded-md px-1.5 text-[11px] font-bold" style={{ background: COR.ouroClaro, color: '#5A4500' }} data-testid="lotada">Vagas preenchidas · só como 2ª opção</span>}
                      <span className="block text-[12.5px] leading-snug" style={{ color: COR.mut }}>{descricaoDaArea(k, horario)}</span>
                    </span>
                    <span className="grid h-7 min-w-7 place-items-center rounded-lg border-2 px-1 text-[11px] font-extrabold"
                      style={ordem === 1 ? { background: COR.verde, borderColor: COR.verde, color: '#fff' } : ordem === 2 ? { background: COR.ouro, borderColor: COR.ouro, color: '#3A2A00' } : { borderColor: COR.linha }}
                      aria-hidden>{ordem ? `${ordem}ª` : ''}</span>
                  </button>
                );
              })}
            </section>
            <Erro />
            <button type="submit" disabled={enviando} className={botao} style={{ background: COR.vermelho }}>
              {enviando ? 'Enviando…' : 'Enviar inscrição'}
            </button>
            <button type="button" className={`${voltar} -mt-3`} style={{ color: COR.mut }} onClick={() => ir('quem')}>Voltar</button>
          </form>
        )}
      </div>

      {/* O aviso da área lotada (23/10/2026): fica como 2ª opção, para o caso de desistência. */}
      {aviso && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 px-5" onClick={() => setAviso(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="aviso-lotada" className="flex w-full max-w-[400px] flex-col gap-3 rounded-2xl p-5" style={{ background: COR.fundo, color: COR.tinta }} onClick={(e) => e.stopPropagation()}>
            <h2 id="aviso-lotada" className="text-lg font-bold">Vagas preenchidas</h2>
            <p className="text-[14.5px] leading-relaxed">As vagas de <b>{rotuloDaAjuda(aviso)}</b> já foram preenchidas. Você pode marcá-la como <b>2ª opção</b>, para o caso de alguma desistência, e escolher outra área como 1ª.</p>
            <button type="button" className="h-12 rounded-xl text-[15px] font-bold text-white" style={{ background: COR.verde }} onClick={() => { setOpcoes((o) => tocarArea(o, aviso, lotadas)); setAviso(null); }}>Marcar como 2ª opção</button>
            <button type="button" className="h-10 rounded-xl text-sm font-semibold" style={{ color: COR.mut }} onClick={() => setAviso(null)}>Escolher outra área</button>
          </div>
        </div>
      )}
      <InstitutionalFooterBar className="ana-fio" />
    </div>
  );
}
