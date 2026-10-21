import { useState, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { useTituloDaAba } from '@/hooks/useTituloDaAba';
import InstitutionalFooterBar from '@/components/news/InstitutionalFooterBar';
import { findNewsUnit } from '@/lib/news/units';
import { ROTULO_DA_AREA } from '@/lib/pizza/modelo';
import { enviarParaAPlanilha, inscrever } from '@/lib/voluntariado/api';
import {
  DIA_DO_EVENTO, GRUPOS_DO_FORMULARIO, SOBRE_O_EVENTO, UNIDADES_DO_VOLUNTARIADO, ULTIMO_DIA, encerrado, mascaraDoWhatsapp, mensagemDoErro, problemaDaInscricao, rotuloDaAjuda, tocarArea,
  type AreaDeAjuda,
} from '@/lib/voluntariado/modelo';

/**
 * /voluntariado — inscrição de voluntários (funcionários) para o Natal Feliz
 * de 08/12/2026 (mockup aprovado em 20/10/2026). Link público, no jeito da
 * Pizza da Alegria: nome completo, WhatsApp, unidade em que trabalha e onde
 * quer ajudar (1ª opção e, se quiser, uma 2ª). Cada área traz uma frase curta
 * do que se faz nela. O protocolo é sorteado pelo banco.
 *
 * Cores fixas da campanha nos dois temas: a página é uma peça do Natal Feliz,
 * não uma tela do app. A faixa listrada do topo é provisória, até a arte.
 */

const COR = { verde: '#1E4D3A', verde2: '#2F6B52', verdeClaro: '#EAF3EE', vermelho: '#C8372D', vermelhoEsc: '#9E2A22', creme: '#F6EEDF', fundo: '#FFFCF6', tinta: '#24201B', mut: '#6E655B', linha: '#E9DDC9', ouro: '#E4B23A', ouroClaro: '#FBF3DE' };

function Secao({ n, titulo, children }: { n: number; titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: COR.vermelhoEsc }}>{n} · {titulo}</h2>
      {children}
    </section>
  );
}

const campo = 'h-12 w-full rounded-xl border-2 bg-white px-3 text-base text-[#24201B] outline-none focus:border-[#1E4D3A]';

export default function VoluntariadoPage() {
  useTituloDaAba('Natal Feliz · Seja voluntário');
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [unidade, setUnidade] = useState('');
  const [opcoes, setOpcoes] = useState<{ opcao1: AreaDeAjuda | null; opcao2: AreaDeAjuda | null }>({ opcao1: null, opcao2: null });
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [feito, setFeito] = useState<{ protocolo: string; nome: string; unidade: string; opcao1: string; opcao2: string | null } | null>(null);
  const fechado = encerrado();

  async function enviar() {
    const p = problemaDaInscricao({ nome, whatsapp, unidade: unidade || null, opcao1: opcoes.opcao1 });
    if (p) { setErro(p); return; }
    setEnviando(true); setErro(null);
    try {
      const protocolo = await inscrever({ nome, whatsapp, unidadeId: unidade, opcao1: opcoes.opcao1!, opcao2: opcoes.opcao2 });
      enviarParaAPlanilha();
      setFeito({ protocolo, nome: nome.trim(), unidade: findNewsUnit(unidade)?.name ?? '', opcao1: rotuloDaAjuda(opcoes.opcao1), opcao2: opcoes.opcao2 ? rotuloDaAjuda(opcoes.opcao2) : null });
      window.scrollTo?.({ top: 0 });
    } catch (e) {
      setErro(mensagemDoErro(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col" style={{ background: COR.fundo, color: COR.tinta }}>
      <div className="mx-auto w-full max-w-[560px] flex-1">
        {/* Faixa provisória até a arte da campanha ficar pronta. */}
        <div className="grid h-40 place-items-center text-center" style={{ background: `repeating-linear-gradient(135deg, ${COR.verde} 0 18px, ${COR.verde2} 18px 36px)`, color: COR.creme }} role="img" aria-label="Natal Feliz, ANA Brasil">
          <div><b className="block text-3xl font-extrabold">Natal Feliz</b><span className="text-xs opacity-85">ANA Brasil · 2026</span></div>
        </div>
        <div className="flex flex-col gap-0.5 px-5 py-3.5 text-white" style={{ background: COR.vermelho }}>
          {feito ? (
            <>
              <b className="text-sm uppercase tracking-[0.06em]">Natal Feliz</b>
              <span className="text-[13px] opacity-90">Obrigado por se oferecer!</span>
            </>
          ) : (
            <>
              {/* A data do evento ao lado do título; as inscrições na linha de baixo (21/10/2026). */}
              <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <b className="text-sm uppercase tracking-[0.06em]">Seja voluntário</b>
                <span className="rounded-full bg-white/20 px-2.5 py-px text-[12.5px] font-semibold" data-testid="dia-do-evento">{DIA_DO_EVENTO} · Natal Feliz</span>
              </span>
              <span className="text-[13px] opacity-90">Inscrições até {ULTIMO_DIA}</span>
            </>
          )}
        </div>

        {feito ? (
          <div className="flex flex-col gap-5 px-5 py-8">
            <div className="flex flex-col items-center gap-2 text-center">
              <span className="grid h-16 w-16 place-items-center rounded-[20px] text-white" style={{ background: COR.verde }}><Check className="h-9 w-9" strokeWidth={2.6} /></span>
              <h1 className="text-xl font-bold">Inscrição feita</h1>
              <b className="text-3xl font-extrabold tracking-wide" style={{ color: COR.vermelhoEsc }} data-testid="protocolo">{feito.protocolo}</b>
              <span className="text-sm" style={{ color: COR.mut }}>Tire um print desta tela.</span>
            </div>
            <dl className="grid gap-2 rounded-2xl border-[1.5px] bg-white p-4 text-sm" style={{ borderColor: COR.linha }}>
              {([['Nome', feito.nome], ['Unidade', feito.unidade], ['1ª opção', feito.opcao1], ...(feito.opcao2 ? [['2ª opção', feito.opcao2]] : []), ['Quando', DIA_DO_EVENTO]] as Array<[string, string]>).map(([r, v]) => (
                <div key={r} className="flex justify-between gap-3"><dt style={{ color: COR.mut }}>{r}</dt><dd className="text-right font-semibold">{v}</dd></div>
              ))}
            </dl>
            <p className="rounded-2xl p-4 text-[13.5px] leading-relaxed" style={{ background: COR.verdeClaro, color: COR.verde }} data-testid="proximos-passos">
              <b>Próximos passos:</b> a equipe vai entrar em contato com você para a assinatura do termo de voluntariado e dará mais informações em breve.
            </p>
          </div>
        ) : fechado ? (
          <div className="flex flex-col gap-3 px-5 py-10 text-center">
            <h1 className="text-xl font-bold">As inscrições foram encerradas em {ULTIMO_DIA}.</h1>
            <p style={{ color: COR.mut }}>Obrigado a todos que se ofereceram. Nos vemos no Natal Feliz!</p>
          </div>
        ) : (
          <form className="flex flex-col gap-7 px-5 py-6" onSubmit={(e) => { e.preventDefault(); enviar(); }} noValidate aria-label="Inscrição de voluntário">
            <div className="-mb-2 rounded-2xl p-4 text-[13.5px] leading-relaxed" style={{ background: COR.verdeClaro, color: COR.verde }} data-testid="sobre-o-evento">
              <b className="mb-1 block text-[15px]">{SOBRE_O_EVENTO.titulo}</b>
              {SOBRE_O_EVENTO.texto}
            </div>
            <Secao n={1} titulo="Quem é você">
              <label className="flex flex-col gap-1.5 text-sm font-semibold">Nome completo
                <input className={campo} style={{ borderColor: COR.linha }} autoComplete="name" maxLength={120} value={nome} onChange={(e) => { setNome(e.target.value); setErro(null); }} />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold">WhatsApp
                <input className={campo} style={{ borderColor: COR.linha }} type="tel" inputMode="tel" autoComplete="tel-national" placeholder="(19) 99999-9999" value={whatsapp} onChange={(e) => { setWhatsapp(mascaraDoWhatsapp(e.target.value)); setErro(null); }} />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold">Unidade em que você trabalha
                <select className={campo} style={{ borderColor: COR.linha }} value={unidade} onChange={(e) => { setUnidade(e.target.value); setErro(null); }}>
                  <option value="">Escolha a unidade</option>
                  {UNIDADES_DO_VOLUNTARIADO.map(({ area, unidades }) => (
                    <optgroup key={area} label={ROTULO_DA_AREA[area]}>
                      {unidades.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                    </optgroup>
                  ))}
                </select>
              </label>
            </Secao>

            <Secao n={2} titulo="Onde você quer ajudar">
              <p className="-mt-1 text-[13px]" style={{ color: COR.mut }}>Toque na sua 1ª opção e, se quiser, numa 2ª.</p>
              {GRUPOS_DO_FORMULARIO.map((g) => (
                <div key={g.grupo} className="flex flex-col gap-1.5">
                  <span className="mt-1 text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: COR.mut }}>{g.grupo}</span>
                  {g.areas.map(([k, rotulo, descricao]) => {
                    const ordem = opcoes.opcao1 === k ? 1 : opcoes.opcao2 === k ? 2 : 0;
                    return (
                      <button key={k} type="button" aria-pressed={ordem > 0} onClick={() => { setOpcoes((o) => tocarArea(o, k)); setErro(null); }}
                        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 rounded-xl border-2 bg-white px-3 py-2.5 text-left transition active:scale-[0.99]"
                        style={ordem === 1 ? { borderColor: COR.verde, background: COR.verdeClaro } : ordem === 2 ? { borderColor: COR.ouro, background: COR.ouroClaro } : { borderColor: COR.linha }}>
                        <span className="min-w-0">
                          <b className="block text-[14px]">{rotulo}</b>
                          <span className="block text-[12.5px] leading-snug" style={{ color: COR.mut }}>{descricao}</span>
                        </span>
                        <span className="grid h-7 min-w-7 place-items-center rounded-lg border-2 px-1 text-[11px] font-extrabold"
                          style={ordem === 1 ? { background: COR.verde, borderColor: COR.verde, color: '#fff' } : ordem === 2 ? { background: COR.ouro, borderColor: COR.ouro, color: '#3A2A00' } : { borderColor: COR.linha }}
                          aria-hidden>{ordem ? `${ordem}ª` : ''}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </Secao>

            {erro && <p role="alert" className="rounded-xl px-3 py-2.5 text-sm font-semibold" style={{ background: '#FDE7E2', color: COR.vermelhoEsc }}>{erro}</p>}
            <button type="submit" disabled={enviando} className="h-14 rounded-2xl text-base font-bold text-white disabled:opacity-60" style={{ background: COR.vermelho }}>
              {enviando ? 'Enviando…' : 'Enviar inscrição'}
            </button>
          </form>
        )}
      </div>
      <InstitutionalFooterBar className="ana-fio" />
    </div>
  );
}
