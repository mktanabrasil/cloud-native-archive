import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Copy, Loader2, Plus, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTituloDaAba } from '@/hooks/useTituloDaAba';
import { useUserRole } from '@/hooks/useUserRole';
import { useApoiadores } from '@/hooks/useApoiadores';
import { UNIT_BG_COLORS, type Unit } from '@/types';
import {
  ROTULO_DO_TIPO, TIPOS_DO_LADO, apoiadoresDoLado, emailValido, filtrarApoiadores, numerosDoLado, textoParaCopiar,
  type EventoComApoiadores, type Lado, type TipoDeApoiador,
} from '@/lib/administracao/apoiadores';
import { lerAcesso, lerApoiadores, mudarAcesso, type AcessoLiberado } from '@/lib/administracao/apoiadoresApi';

const FUSO = 'America/Sao_Paulo';
const diaEMes = (iso: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit', year: '2-digit' }).format(new Date(iso));

const TEXTOS: Record<Lado, { titulo: string; sub: string; vazio: string; aba: string }> = {
  padrinhos: {
    titulo: 'Padrinhos e doadores', aba: 'Padrinhos',
    sub: 'Quem as unidades citaram nos eventos como padrinho ou doador',
    vazio: 'Nenhum padrinho ou doador citado nos eventos ainda. Eles entram pelo formulário de eventos, em "Tem padrinho, doador ou empresa envolvida?".',
  },
  parceiros: {
    titulo: 'Parceiros', aba: 'Parceiros',
    sub: 'Empresas, figuras públicas e instituições citadas nos eventos',
    vazio: 'Nenhum parceiro citado nos eventos ainda. Eles entram pelo formulário de eventos: empresas e figuras públicas em "Tem padrinho, doador ou empresa envolvida?", instituições em "Unidades da ANA e instituições participantes".',
  },
};

async function copiar(texto: string, aviso: string) {
  try { await navigator.clipboard.writeText(texto); toast.success(aviso); }
  catch { toast.error('Não consegui copiar', { description: 'Selecione o texto e copie à mão.' }); }
}

/**
 * Administração › Padrinhos e Parceiros (18/11/2026, PR 6). Decisão de 18/11:
 * começam como uma lista lida dos eventos, um nome por linha com os eventos em
 * que foi citado. Veem: o financeiro, o marketing e quem a administração
 * liberar pelo e-mail (no fim da página, só para o admin).
 */
export default function AdministracaoApoiadoresPage({ lado }: { lado: Lado }) {
  const { isAdmin, loading } = useUserRole();
  const { vejo, carregado } = useApoiadores();
  const t = TEXTOS[lado];
  useTituloDaAba(`${t.aba} · ANA Brasil`);

  if (loading || !carregado) return null;
  if (!vejo) return <Navigate to="/" replace />;
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6 pb-16 sm:px-6">
      <ListaDeApoiadores lado={lado} />
      {isAdmin && <QuemMaisVe />}
    </div>
  );
}

function ListaDeApoiadores({ lado }: { lado: Lado }) {
  const t = TEXTOS[lado];
  const [estado, setEstado] = useState<'carregando' | 'pronto' | 'erro' | 'semBanco'>('carregando');
  const [eventos, setEventos] = useState<EventoComApoiadores[]>([]);
  const [termo, setTermo] = useState('');
  const [tipo, setTipo] = useState<TipoDeApoiador | null>(null);
  const [agora] = useState(() => new Date());

  const carregar = useCallback(async () => {
    setEstado('carregando');
    try { setEventos(await lerApoiadores()); setEstado('pronto'); }
    catch (e) { setEstado((e as { semBanco?: boolean }).semBanco ? 'semBanco' : 'erro'); }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => { setTipo(null); setTermo(''); }, [lado]);

  const todos = useMemo(() => apoiadoresDoLado(eventos, lado), [eventos, lado]);
  const lista = useMemo(() => filtrarApoiadores(todos, termo, tipo), [todos, termo, tipo]);
  const numeros = useMemo(() => numerosDoLado(todos, agora), [todos, agora]);
  const contagem = (x: TipoDeApoiador | null) => (x ? todos.filter(a => a.tipos.includes(x)).length : todos.length);

  return (
    <>
      <div>
        <h1 className="text-[28px] font-bold leading-tight">{t.titulo}</h1>
        <p className="text-sm text-muted-foreground">{t.sub}</p>
      </div>

      {estado === 'carregando' && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {estado === 'erro' && (
        <div className="flex flex-col items-start gap-2">
          <p role="alert" className="text-sm font-semibold text-destructive">Não consegui carregar a lista.</p>
          <Button variant="outline" size="sm" onClick={() => void carregar()}>Tentar de novo</Button>
        </div>
      )}
      {estado === 'semBanco' && <p role="alert" className="text-sm text-muted-foreground">Esta página ainda depende de uma atualização do banco. Fale com o marketing.</p>}

      {estado === 'pronto' && (
        <>
          <div className="glass-1 grid grid-cols-3 overflow-hidden rounded-[20px]">
            {([[lado === 'padrinhos' ? 'padrinhos e doadores' : 'parceiros', numeros.nomes], ['eventos com eles', numeros.eventos], ['eventos ainda por vir', numeros.proximos]] as const).map(([rotulo, n], i) => (
              <div key={rotulo} className={`flex flex-col p-4 sm:px-5 ${i > 0 ? 'border-l border-black/10 dark:border-white/10' : ''}`}>
                <span className="font-display text-[28px] font-bold leading-none tabular-nums">{n}</span>
                <span className="mt-1 text-[13px] text-muted-foreground">{rotulo}</span>
              </div>
            ))}
          </div>

          {todos.length === 0 ? (
            <p className="rounded-[20px] border border-dashed border-border p-6 text-sm text-muted-foreground">{t.vazio}</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex flex-wrap rounded-[14px] bg-muted p-1" role="group" aria-label="Tipo">
                    {([null, ...TIPOS_DO_LADO[lado]] as (TipoDeApoiador | null)[]).filter(x => x === null || contagem(x) > 0).map(x => (
                      <button key={x ?? 'todos'} type="button" aria-pressed={tipo === x} onClick={() => setTipo(x)}
                        className={`rounded-[10px] px-3 py-1.5 text-[13px] ${tipo === x ? 'bg-card font-semibold text-foreground shadow-sm' : 'font-medium text-muted-foreground hover:text-foreground'}`}>
                        {x ? ROTULO_DO_TIPO[x] : 'Todos'} <span className="tabular-nums text-muted-foreground">{contagem(x)}</span>
                      </button>
                    ))}
                  </div>
                  <label className="relative w-full sm:w-64">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                    <Input aria-label="Procurar pelo nome" placeholder="Procurar pelo nome" value={termo} onChange={e => setTermo(e.target.value)} className="pl-9" />
                  </label>
                </div>
                {lista.length > 0 && (
                  <Button variant="outline" size="sm" className="gap-1.5 rounded-full" onClick={() => void copiar(textoParaCopiar(lista), 'Lista copiada')}>
                    <Copy className="h-3.5 w-3.5" /> Copiar lista
                  </Button>
                )}
              </div>

              {lista.length === 0 ? <p className="text-sm text-muted-foreground">Ninguém nesta lista{termo.trim() ? ` com "${termo.trim()}"` : ''}.</p> : (
                <div className="overflow-x-auto rounded-[20px] border border-black/5 bg-card dark:border-white/5">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                        <th className="px-4 py-2.5 font-semibold">Nome</th>
                        <th className="px-4 py-2.5 font-semibold">Tipo</th>
                        <th className="px-4 py-2.5 font-semibold">Eventos em que aparece</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lista.map(a => (
                        <tr key={a.chave} className="border-t border-border align-top">
                          <td className="px-4 py-3 font-semibold">{a.nome}</td>
                          <td className="px-4 py-3">
                            <span className="flex flex-wrap gap-1">
                              {a.tipos.map(x => <span key={x} className="rounded-full bg-muted px-2 py-0.5 text-[12px]">{ROTULO_DO_TIPO[x]}</span>)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <ul className="space-y-0.5">
                              {a.eventos.map(e => (
                                <li key={e.id} className="text-[13px]">
                                  <span className="tabular-nums text-muted-foreground">{diaEMes(e.start_datetime)}</span> · {e.title}{' '}
                                  <span className="text-muted-foreground">
                                    (<span className={`mr-1 inline-block h-2 w-2 rounded-full ${UNIT_BG_COLORS[e.unit as Unit] ?? 'bg-muted-foreground/50'}`} aria-hidden />{e.unit})
                                  </span>
                                  {e.status === 'pendente' && <span className="ml-1 rounded-full bg-[hsl(var(--warning)/0.14)] px-2 py-0.5 text-[11px] font-semibold text-[hsl(var(--warning))]">aguardando aprovação</span>}
                                  {e.detalhe && <span className="block text-[12px] text-muted-foreground">{e.detalhe}</span>}
                                </li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="text-xs text-muted-foreground">O mesmo nome escrito com ou sem acento, ou com maiúscula, conta uma vez. Eventos cancelados e na lixeira ficam de fora.</p>
            </>
          )}
        </>
      )}
    </>
  );
}

/**
 * Quem mais vê Padrinhos e Parceiros, além do financeiro e do marketing: os
 * responsáveis que a administração liberar pelo e-mail (decisão de 18/11).
 * Só o admin vê e muda. A pessoa precisa ter conta no app com esse e-mail.
 */
function QuemMaisVe() {
  const [lista, setLista] = useState<AcessoLiberado[] | null>(null);
  const [erro, setErro] = useState(false);
  const [novo, setNovo] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const ler = useCallback(async () => {
    try { setLista(await lerAcesso()); setErro(false); } catch { setErro(true); }
  }, []);
  useEffect(() => { void ler(); }, [ler]);

  const mudar = async (email: string, liberar: boolean) => {
    setOcupado(true);
    try {
      await mudarAcesso(email, liberar);
      await ler();
      if (liberar) setNovo('');
      toast.success(liberar ? `${email} passa a ver Padrinhos e Parceiros.` : `${email} não vê mais Padrinhos e Parceiros.`);
    } catch (e) {
      toast.error('Não foi possível salvar', { description: (e as Error).message });
    } finally { setOcupado(false); }
  };
  const adicionar = (ev: React.FormEvent) => {
    ev.preventDefault();
    const email = novo.trim().toLowerCase();
    if (!emailValido(email)) { toast.error('Digite um e-mail válido.'); return; }
    if (lista?.some(a => a.email === email)) { toast.error('Esse e-mail já está na lista.'); return; }
    void mudar(email, true);
  };

  return (
    <section className="space-y-2 rounded-[20px] border border-dashed border-border p-4" aria-label="Quem mais vê Padrinhos e Parceiros">
      <h2 className="text-sm font-semibold">Quem mais vê Padrinhos e Parceiros <span className="font-normal text-muted-foreground">· só a administração geral vê esta parte</span></h2>
      <p className="max-w-[70ch] text-xs text-muted-foreground">O financeiro e o marketing já veem. Aqui entram os responsáveis, pelo e-mail da conta deles no app.</p>
      {erro ? (
        <p role="alert" className="text-xs text-destructive">Não consegui ler a lista. <button className="underline" onClick={() => void ler()}>Tentar de novo</button></p>
      ) : lista === null ? <p className="text-xs text-muted-foreground">Carregando…</p> : (
        <>
          {lista.length === 0 ? <p className="text-xs text-muted-foreground">Ninguém além do financeiro e do marketing.</p> : (
            <ul className="flex flex-wrap gap-1.5" aria-label="E-mails liberados">
              {lista.map(a => (
                <li key={a.email} className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 py-0.5 pl-2.5 pr-1 text-xs">
                  {a.email}
                  <button type="button" className="rounded-full p-0.5 text-muted-foreground hover:text-destructive disabled:opacity-50" disabled={ocupado} aria-label={`Tirar o acesso de ${a.email}`} onClick={() => void mudar(a.email, false)}><X className="h-3 w-3" /></button>
                </li>
              ))}
            </ul>
          )}
          <form className="flex max-w-md gap-2" onSubmit={adicionar}>
            <Input aria-label="E-mail para liberar" value={novo} onChange={e => setNovo(e.target.value)} placeholder="responsavel@anabrasil.org" className="h-8 min-w-0 flex-1 text-xs" disabled={ocupado} />
            <Button type="submit" variant="outline" className="h-8 gap-1 text-xs" disabled={ocupado || !novo.trim()}>
              {ocupado ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Liberar
            </Button>
          </form>
        </>
      )}
    </section>
  );
}
