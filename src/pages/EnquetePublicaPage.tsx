import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Lock, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTituloDaAba } from '@/hooks/useTituloDaAba';
import { CartaoDeOpcao, DiasEmDestaque, Marca, RodapeDaEnquete, TextoDaEnquete } from '@/components/enquetes/PecasDaEnquete';
import type { Enquete, OpcaoDeEnquete, ResultadoDaEnquete } from '@/lib/enquetes/modelo';
import { estaAberta, ordenarPorVotos, tempoRestante } from '@/lib/enquetes/modelo';
import { MENSAGEM_DO_MOTIVO, buscarEnquete, chaveDoAparelho, esquecerIdentidade, guardarIdentidade, lerIdentidade, meuVoto, resultado as buscarResultado, votar, type Identidade } from '@/lib/enquetes/api';
import { formatarTelefone, mascararTelefone, normalizarTelefone, pinValido, telefoneValido } from '@/lib/enquetes/telefone';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * /enquete/:slug — a página de voto (23/09/2026, mockup aprovado).
 *
 * Uma tela, feita para o celular, sem login. Toca numa opção; na primeira
 * vez sobe a folha de identificação (nome, WhatsApp, PIN). O aparelho
 * lembra: na volta, troca com um toque. Passou o prazo, congela. O
 * resultado atualiza sozinho a cada 10 s enquanto a página está aberta.
 */

const INTERVALO_MS = 10_000;

/** "hoje às 18h" · "sexta, 02/10 às 18h" */
export function textoDoPrazo(iso: string, agora: Date = new Date()): string {
  const d = new Date(iso);
  const hora = format(d, "HH'h'mm", { locale: ptBR }).replace('h00', 'h');
  const mesmoDia = d.toDateString() === agora.toDateString();
  if (mesmoDia) return `hoje às ${hora}`;
  const amanha = new Date(agora); amanha.setDate(agora.getDate() + 1);
  if (d.toDateString() === amanha.toDateString()) return `amanhã às ${hora}`;
  return `${format(d, "EEEE, dd/MM", { locale: ptBR })} às ${hora}`;
}

export default function EnquetePublicaPage() {
  const { slug = '' } = useParams();
  const [enquete, setEnquete] = useState<Enquete | null | undefined>(undefined);
  const [res, setRes] = useState<(ResultadoDaEnquete & { oculto: boolean }) | null>(null);
  const [identidade, setIdentidade] = useState<Identidade | null>(null);
  const [meuVotoId, setMeuVotoId] = useState<string | null>(null);
  const [escolhida, setEscolhida] = useState<OpcaoDeEnquete | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [agora, setAgora] = useState(() => new Date());
  const [form, setForm] = useState({ nome: '', telefone: '', pin: '', pin2: '' });
  const [erroForm, setErroForm] = useState<string | null>(null);

  useTituloDaAba(enquete ? `${enquete.pergunta} · Enquete ANA Brasil` : 'Enquete · ANA Brasil');

  const aberta = enquete ? estaAberta(enquete, agora) : false;

  const atualizarResultado = useCallback(async () => {
    try { setRes(await buscarResultado(slug)); } catch { /* fica o último */ }
  }, [slug]);

  // Carrega a enquete e, se o aparelho lembra, o voto atual.
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const e = await buscarEnquete(slug);
        if (!vivo) return;
        setEnquete(e);
        if (!e) return;
        const lembrada = e.identificar ? lerIdentidade(slug) : { telefone: chaveDoAparelho(), nome: '', pin: '' };
        if (lembrada) {
          setIdentidade(lembrada);
          setForm({ nome: lembrada.nome, telefone: formatarTelefone(lembrada.telefone), pin: lembrada.pin, pin2: lembrada.pin });
          const mv = await meuVoto(slug, lembrada.telefone, lembrada.pin);
          if (vivo && mv.ok) setMeuVotoId(mv.opcao_id);
          else if (vivo && e.identificar) { esquecerIdentidade(slug); setIdentidade(null); }
        }
        await atualizarResultado();
      } catch {
        if (vivo) setEnquete(null);
      }
    })();
    return () => { vivo = false; };
  }, [slug, atualizarResultado]);

  // Ao vivo: resultado a cada 10 s e o relógio do prazo a cada 30 s.
  useEffect(() => {
    if (!enquete) return;
    const r = setInterval(atualizarResultado, INTERVALO_MS);
    const t = setInterval(() => setAgora(new Date()), 30_000);
    return () => { clearInterval(r); clearInterval(t); };
  }, [enquete, atualizarResultado]);

  const mostraContagem = !!enquete && !!res && !res.oculto && (meuVotoId !== null || !aberta);
  const opcoesOrdenadas = useMemo(() => (enquete && mostraContagem && !aberta ? ordenarPorVotos(enquete.opcoes, res!.por_opcao) : enquete?.opcoes ?? []), [enquete, mostraContagem, aberta, res]);

  const registrar = async (opcao: OpcaoDeEnquete, id: Identidade) => {
    if (!enquete) return;
    setEnviando(true);
    try {
      const r = await votar(slug, opcao.id, id);
      if (r.ok === false) {
        setErroForm(MENSAGEM_DO_MOTIVO[r.motivo]);
        if (r.motivo === 'encerrada') setAgora(new Date());
        if (r.motivo === 'pin_incorreto' && identidade) { esquecerIdentidade(slug); setIdentidade(null); setEscolhida(opcao); }
        return;
      }
      setMeuVotoId(r.opcao_id);
      setIdentidade(id);
      if (enquete.identificar) guardarIdentidade(slug, id);
      setEscolhida(null);
      setErroForm(null);
      toast.success(r.trocou ? 'Voto trocado' : 'Voto registrado', { description: opcao.titulo });
      await atualizarResultado();
    } catch (erro) {
      setErroForm(erro instanceof Error ? erro.message : 'Não deu para registrar. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  };

  const escolher = (opcao: OpcaoDeEnquete) => {
    if (!enquete || !aberta || enviando) return;
    if (meuVotoId === opcao.id) return;
    if (identidade) { void registrar(opcao, identidade); return; }
    setErroForm(null);
    setEscolhida(opcao);
  };

  const confirmar = () => {
    if (!escolhida) return;
    if (!form.nome.trim()) return setErroForm('Diga seu nome.');
    if (!telefoneValido(form.telefone)) return setErroForm('Número com DDD, como (19) 99876-5432.');
    if (!pinValido(form.pin)) return setErroForm('O PIN tem 4 números.');
    if (form.pin !== form.pin2) return setErroForm('Os dois PINs não são iguais. Digite o mesmo nos dois campos.');
    void registrar(escolhida, { nome: form.nome.trim(), telefone: normalizarTelefone(form.telefone), pin: form.pin });
  };

  if (enquete === undefined) {
    return <div className="min-h-screen bg-background" aria-busy="true" />;
  }
  if (enquete === null) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-10">
          <Marca />
          <h1 className="text-xl font-bold">Enquete não encontrada</h1>
          <p className="text-sm text-muted-foreground">O link pode estar errado ou a enquete foi apagada.</p>
        </main>
      </div>
    );
  }

  const votoAtual = enquete.opcoes.find(o => o.id === meuVotoId) ?? null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto flex min-h-screen max-w-md flex-col gap-3 px-4 pb-6 pt-5">
        <Marca><span className="ml-1 rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">Enquete</span></Marca>
        <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-muted-foreground">
          Enquete · {format(new Date(enquete.created_at || Date.now()), 'MMMM yyyy', { locale: ptBR })}
        </p>
        <h1 className="text-2xl font-bold leading-tight tracking-tight [text-wrap:balance]">{enquete.pergunta}</h1>

        {!aberta ? (
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-muted px-3 py-2 text-[13px]" data-testid="encerrada">
            <Lock className="h-3.5 w-3.5" />
            <b>Encerrada{enquete.encerra_em && !enquete.encerrada_em ? ` ${textoDoPrazo(enquete.encerra_em, agora)}` : ''}.</b>
            {res && res.total > 0 && opcoesOrdenadas[0] && (res.por_opcao[opcoesOrdenadas[0].id] ?? 0) > 0 && (
              <span>Resultado final: <b>{opcoesOrdenadas[0].titulo}</b>, com {res.por_opcao[opcoesOrdenadas[0].id]} de {res.total} votos.</span>
            )}
          </div>
        ) : votoAtual ? (
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-[#E4F8F3] px-3 py-2 text-[13px] text-[#0E6B58] dark:bg-[#153A32] dark:text-[#8FE3CF]" data-testid="meu-voto">
            <span aria-hidden="true">✓</span>
            {identidade?.nome && <b>{identidade.nome}</b>}
            {enquete.identificar && identidade && <span>· {mascararTelefone(identidade.telefone)}</span>}
            <span>· {votoAtual.titulo}</span>
            {enquete.permitir_troca && <span className="text-muted-foreground">· toque em outra opção para trocar</span>}
          </div>
        ) : (
          <TextoDaEnquete texto={enquete.texto} />
        )}

        {(aberta && !votoAtual) && <DiasEmDestaque dias={enquete.dias} />}

        <div className="flex flex-col gap-2.5" role="radiogroup" aria-label="Opções da enquete">
          {opcoesOrdenadas.map(o => (
            <CartaoDeOpcao
              key={o.id}
              opcao={o}
              votada={meuVotoId === o.id}
              votos={mostraContagem ? (res!.por_opcao[o.id] ?? 0) : null}
              total={res?.total ?? 0}
              desabilitada={!aberta || enviando}
              onEscolher={aberta ? escolher : undefined}
            />
          ))}
        </div>

        {aberta && (
          <p className="text-center text-[11.5px] text-muted-foreground">
            {res && (mostraContagem || res.total > 0) && <b>{res.total} {res.total === 1 ? 'voto' : 'votos'} · </b>}
            {enquete.encerra_em ? `encerra ${textoDoPrazo(enquete.encerra_em, agora)} · ${tempoRestante(enquete.encerra_em, agora)}` : 'sem prazo: aberta até a equipe encerrar'}
            {!votoAtual && <><br />Toque numa opção para votar. Um voto por pessoa{enquete.permitir_troca ? '; dá para trocar até o prazo' : ''}.</>}
            {votoAtual && res?.oculto && <><br />O resultado aparece quando a enquete encerrar.</>}
          </p>
        )}
        {!aberta && votoAtual && (
          <p className="text-center text-[11.5px] text-muted-foreground">Seu voto ficou registrado como <b>{votoAtual.titulo}</b>. Não dá mais para trocar.</p>
        )}

        {identidade && enquete.identificar && aberta && (
          <button type="button" className="mx-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground underline" onClick={() => { esquecerIdentidade(slug); setIdentidade(null); setMeuVotoId(null); }}>
            <Pencil className="h-3 w-3" /> Não é você? Votar com outro número
          </button>
        )}

        <RodapeDaEnquete />
      </main>

      {/* A folha de identificação, sobre a página. */}
      {escolhida && enquete.identificar && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => !enviando && setEscolhida(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="folha-titulo"
            className="w-full max-w-md rounded-t-3xl bg-card p-5 pb-[calc(20px+env(safe-area-inset-bottom,0px))] shadow-2xl sm:rounded-3xl"
            onClick={e => e.stopPropagation()}
            data-testid="folha-identidade"
          >
            <p id="folha-titulo" className="flex items-center gap-2 text-[15px] font-bold"><Lock className="h-4 w-4" /> Confirme quem é você</p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Seu voto: <b className="text-foreground">{escolhida.titulo}</b>. Para contar (e poder trocar depois), diga seu WhatsApp e crie um PIN.
            </p>
            <div className="mt-3 flex flex-col gap-3">
              <div>
                <Label htmlFor="enquete-nome" className="text-xs font-medium">Seu nome</Label>
                <Input id="enquete-nome" className="mt-1 h-10" autoComplete="name" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Como te chamam" maxLength={80} />
              </div>
              <div>
                <Label htmlFor="enquete-telefone" className="text-xs font-medium">Seu WhatsApp</Label>
                <Input id="enquete-telefone" className="mt-1 h-10" type="tel" inputMode="tel" autoComplete="tel-national" value={form.telefone} onChange={e => setForm({ ...form, telefone: formatarTelefone(e.target.value) })} placeholder="(19) 99876-5432" />
              </div>
              <div>
                <Label htmlFor="enquete-pin" className="text-xs font-medium">
                  Crie um PIN de 4 dígitos <span className="font-normal text-muted-foreground">(para trocar o voto depois)</span>
                </Label>
                {/* Dois campos lado a lado: o PIN e a confirmação (pedido de
                    23/09/2026), para não travar o voto num dígito errado. */}
                <div className="mt-1 flex items-end gap-3">
                  <Input id="enquete-pin" aria-label="Crie um PIN de 4 dígitos" className="h-12 w-[132px] text-center text-2xl font-bold tracking-[.5em] tabular-nums" inputMode="numeric" pattern="\d*" maxLength={4} value={form.pin} onChange={e => setForm({ ...form, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })} placeholder="••••" />
                  <div className="flex-1">
                    <Label htmlFor="enquete-pin2" className="text-xs font-medium">Repita o PIN</Label>
                    <Input id="enquete-pin2" className={`mt-1 h-12 w-[132px] text-center text-2xl font-bold tracking-[.5em] tabular-nums ${form.pin2.length === 4 && form.pin2 !== form.pin ? 'border-destructive' : ''}`} inputMode="numeric" pattern="\d*" maxLength={4} value={form.pin2} onChange={e => setForm({ ...form, pin2: e.target.value.replace(/\D/g, '').slice(0, 4) })} placeholder="••••" />
                  </div>
                </div>
                {form.pin2.length === 4 && form.pin2 !== form.pin && <p className="mt-1 text-[11px] text-destructive">Não bateu com o primeiro.</p>}
              </div>
              {erroForm && <p className="text-xs text-destructive" role="alert">{erroForm}</p>}
              <Button className="h-11 w-full" onClick={confirmar} disabled={enviando} data-testid="confirmar-voto">
                {enviando ? 'Registrando…' : 'Confirmar voto'}
              </Button>
              <p className="text-center text-[11px] text-muted-foreground">Já votou antes? Use o mesmo número e o mesmo PIN. Um voto por número.</p>
            </div>
          </div>
        </div>
      )}

      {/* Sem identificação: o toque já vota; o erro aparece como aviso. */}
      {erroForm && !escolhida && <p className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-destructive px-4 py-2 text-xs text-destructive-foreground shadow-lg" role="alert">{erroForm}</p>}
    </div>
  );
}
