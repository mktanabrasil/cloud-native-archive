import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CalendarDays, Clock, ExternalLink, Heart, LogOut, MapPin, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  COR_DO_TIPO, DIA_DO_NATAL_FELIZ, DIA_DO_TREINAMENTO, PLANTA_DO_LOCAL, ROTULO_DO_TIPO, agoraEProximo, caminho, caminhoDaAba, diaCurto,
  diaQueAbre, diasDoCronograma, eGestor, eSoDoMeuGrupo, horaCurta, itensDoDia, posicaoDoAgora, whatsappMascarado,
  type AbaDaCentral, type AvisoEnviado, type DadosDaCentral, type ItemDoCronograma, type Momento, type VoluntarioNaCentral,
} from '@/lib/voluntariado/central';
import { GRUPO_DO_WHATSAPP, MAPA_DO_TREINAMENTO, TREINAMENTO, dadosDoHorario, rotuloDaAjuda, rotuloDoVinculo } from '@/lib/voluntariado/modelo';
import { AvatarDaPessoa, CAPA_DO_NATAL, Cartao, CartaoDosAvisos, Pilula, Secao } from './PecasDaCentral';

/**
 * As cinco abas da Central do Voluntário (13/11/2026): Início, Cronograma,
 * Avisos, Local e Perfil, no desenho do mockup, com as cores do app.
 * O título de cada uma fica no topo escuro (cabecalhoDaAba). Recebem os dados
 * já lidos e a hora de agora (em Brasília), para os testes poderem fixar o dia.
 *
 * 12/11/2026, a pedido dele: a aba Credencial (QR) saiu e entrou a de Avisos;
 * os gestores entram sem inscrição e veem tudo (sem caminho, área nem turno).
 */

type Agora = { dia: string; hora: string };

const horaDe = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).replace(':', 'h').replace(/^0/, '');
const dataDe = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' });
const turnoDe = (h: string | null) => { const t = dadosDoHorario(h); return t ? `${t.rotulo} · ${t.detalhe}` : ''; };
const textoDoTreinamento = `${TREINAMENTO.local}${TREINAMENTO.horario ? ` · ${TREINAMENTO.horario}` : ' · horário a confirmar'}`;
/** "Funcionário(a) ANA · GOE", ou "Gestão" para quem entra sem inscrição. */
const quemE = (v: VoluntarioNaCentral) => (eGestor(v) ? 'Gestão' : `${rotuloDoVinculo(v.vinculo as never)}${v.unidade_nome ? ` · ${v.unidade_nome}` : ''}`);

function SeloDoPerfil({ v }: { v: VoluntarioNaCentral }) {
  return (
    <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.06em]',
      eGestor(v) ? 'bg-[#FBCE00]/30 text-[#6B5200] dark:text-[#FBE38A]' : 'bg-[#81E2CF]/35 text-[#0F5A4C] dark:text-[#9FF0DF]')}>
      {eGestor(v) ? 'Gestão' : 'Confirmada'}
    </span>
  );
}

/** O título e as pílulas do topo escuro de cada aba. */
export function cabecalhoDaAba(aba: AbaDaCentral, d: DadosDaCentral): { titulo: string; pilulas?: ReactNode } {
  if (aba === 'inicio') {
    return {
      titulo: 'Natal Feliz 2026',
      pilulas: (
        <>
          <Pilula icone={CalendarDays}>{diaCurto(DIA_DO_NATAL_FELIZ)}</Pilula>
          <Pilula icone={MapPin}>{TREINAMENTO.local}</Pilula>
          {d.voluntario.horario && <Pilula icone={Clock}>{turnoDe(d.voluntario.horario)}</Pilula>}
        </>
      ),
    };
  }
  return { titulo: { cronograma: 'Cronograma', avisos: 'Avisos', local: 'Local', perfil: 'Perfil' }[aba] };
}

// --- Início ---------------------------------------------------------------------------------

export function InicioDaCentral({ d, agora, whatsapp }: { d: DadosDaCentral; agora: Agora; whatsapp: string }) {
  const v = d.voluntario;
  const gestor = eGestor(v);
  const passos = caminho(d, agora.dia);
  const { acontecendo, proximo } = agoraEProximo(d.cronograma, v, agora);
  const texto: Record<'inscricao' | Momento, { titulo: string; sub: string }> = {
    inscricao: { titulo: 'Inscrição feita', sub: `${dataDe(v.inscrito_em)} · protocolo ${v.protocolo}` },
    treinamento: d.presencas.treinamento
      ? { titulo: 'Treinamento', sub: `Presença registrada às ${horaDe(d.presencas.treinamento)}` }
      : agora.dia > DIA_DO_TREINAMENTO
        ? { titulo: 'Treinamento', sub: 'Presença não registrada. Fale com a equipe no grupo.' }
        : { titulo: 'Treinamento obrigatório', sub: `${diaCurto(DIA_DO_TREINAMENTO)} · ${textoDoTreinamento}` },
    evento: d.presencas.evento
      ? { titulo: 'Natal Feliz', sub: `Presença registrada às ${horaDe(d.presencas.evento)}` }
      : { titulo: 'Natal Feliz', sub: `${diaCurto(DIA_DO_NATAL_FELIZ)} · ${turnoDe(v.horario) || TREINAMENTO.local}` },
  };
  const avisos = d.avisos.length;
  return (
    <div className="flex flex-col gap-3">
      <Cartao className="flex items-center gap-3">
        <AvatarDaPessoa nome={v.nome} />
        <div className="min-w-0 flex-1">
          <b className="block truncate text-[15.5px] font-semibold" style={{ fontFamily: 'Poppins, sans-serif' }}>{v.nome}</b>
          <span className="block truncate text-[12.5px] text-muted-foreground">{gestor ? 'Acompanha o voluntariado' : quemE(v)}</span>
        </div>
        <SeloDoPerfil v={v} />
      </Cartao>

      <GrupoDosVoluntarios gestor={gestor} />

      {(acontecendo || proximo) && (
        <Cartao className="flex flex-col gap-2.5 border-l-4 !border-l-[#F37964]" data-testid="agora-e-proximo">
          {acontecendo && (
            <div>
              <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#E0533D]">Agora</span>
              <b className="block text-[16px] font-semibold leading-snug">{acontecendo.titulo}</b>
              <span className="text-[13px] text-muted-foreground">{acontecendo.fim ? `até ${horaCurta(acontecendo.fim)}` : ''}{acontecendo.local ? ` · ${acontecendo.local}` : ''}</span>
            </div>
          )}
          {proximo && (
            <div>
              <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">A seguir · {horaCurta(proximo.inicio)}</span>
              <b className="block text-[15px] font-semibold leading-snug">{proximo.titulo}</b>
              {proximo.local && <span className="text-[13px] text-muted-foreground">{proximo.local}</span>}
            </div>
          )}
        </Cartao>
      )}

      <CartaoDosAvisos whatsapp={whatsapp} />

      {gestor ? (
        <>
          <Secao>As datas</Secao>
          <Cartao className="flex flex-col divide-y divide-border p-0" data-testid="datas">
            {[['Treinamento dos voluntários', `${diaCurto(DIA_DO_TREINAMENTO)} · ${textoDoTreinamento}`], ['Natal Feliz', `${diaCurto(DIA_DO_NATAL_FELIZ)} · ${TREINAMENTO.local}`]].map(([t, s]) => (
              <div key={t} className="px-4 py-3">
                <b className="block text-[14.5px] font-semibold">{t}</b>
                <span className="text-[13px] text-muted-foreground">{s}</span>
              </div>
            ))}
          </Cartao>
        </>
      ) : (
        <>
          <Secao>Seu caminho</Secao>
          <Cartao className="flex flex-col" data-testid="caminho">
            {passos.map((p, n) => (
              <div key={p.chave} className="relative grid grid-cols-[28px_minmax(0,1fr)] gap-3 pb-4 last:pb-0" data-estado={p.estado} data-testid={`passo-${p.chave}`}>
                {n < passos.length - 1 && <span className={cn('absolute bottom-0 left-[13px] top-7 w-0.5', p.estado === 'feito' ? 'bg-[#1F2322] dark:bg-[#81E2CF]' : 'bg-border')} aria-hidden />}
                <span className={cn('grid h-7 w-7 place-items-center rounded-full border-2 text-[12px] font-bold',
                  p.estado === 'feito' ? 'border-[#1F2322] bg-[#1F2322] text-[#81E2CF] dark:border-[#81E2CF] dark:bg-[#81E2CF] dark:text-[#1F2322]'
                    : p.estado === 'agora' ? 'border-[#FBCE00] bg-[#FBCE00]/20 text-foreground' : 'border-border bg-card text-muted-foreground')}>
                  {p.estado === 'feito' ? '✓' : n + 1}
                </span>
                <div className="min-w-0 pt-0.5">
                  <b className="flex flex-wrap items-center gap-2 text-[14.5px] font-semibold">
                    {texto[p.chave].titulo}
                    {p.estado === 'agora' && <span className="rounded-full bg-[#FBCE00] px-2 py-px text-[10px] font-bold uppercase tracking-[0.08em] text-[#1F2322]">Próximo</span>}
                  </b>
                  <span className="block text-[13px] leading-snug text-muted-foreground">{texto[p.chave].sub}</span>
                </div>
              </div>
            ))}
          </Cartao>
        </>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Link to={caminhoDaAba('avisos')} className="flex flex-col gap-2 rounded-[20px] border border-black/[0.06] bg-card p-4 transition-colors hover:bg-muted/40 dark:border-white/[0.08]">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-[#1F2322] text-[#81E2CF] dark:bg-[#81E2CF] dark:text-[#1F2322]"><Bell className="h-5 w-5" /></span>
          <b className="text-[14.5px] font-semibold">Avisos</b>
          <span className="-mt-1.5 text-[12.5px] text-muted-foreground">{avisos === 0 ? 'Nenhum ainda' : avisos === 1 ? '1 aviso' : `${avisos} avisos`}</span>
        </Link>
        {gestor ? (
          <Link to={caminhoDaAba('cronograma')} className="flex flex-col gap-2 rounded-[20px] border border-black/[0.06] bg-card p-4 transition-colors hover:bg-muted/40 dark:border-white/[0.08]">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-[#FBCE00]/25 text-foreground"><CalendarDays className="h-5 w-5" /></span>
            <b className="text-[14.5px] font-semibold">Cronograma</b>
            <span className="-mt-1.5 text-[12.5px] text-muted-foreground">Todas as áreas</span>
          </Link>
        ) : (
          <div className="flex flex-col gap-2 rounded-[20px] border border-black/[0.06] bg-card p-4 dark:border-white/[0.08]">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-[#FBCE00]/25 text-foreground"><Heart className="h-5 w-5" /></span>
            <b className="text-[14.5px] font-semibold">Sua área</b>
            <span className="-mt-1.5 text-[12.5px] text-muted-foreground">{rotuloDaAjuda(v.opcao1)}</span>
          </div>
        )}
      </div>

    </div>
  );
}

/**
 * O grupo do WhatsApp em destaque (12/11/2026, pedido dele): o mesmo cartão
 * verde do formulário. É por lá que a equipe passa as informações; para o
 * voluntário, a entrada é obrigatória.
 */
function GrupoDosVoluntarios({ gestor }: { gestor: boolean }) {
  return (
    <div className="flex flex-col gap-2.5 rounded-[20px] border-2 border-[#25D366] bg-[#E7F8EE] p-4 text-[#14532D] dark:border-[#25D366]/60 dark:bg-[#25D366]/10 dark:text-[#B9F2CD]" data-testid="grupo-dos-voluntarios">
      <b className="text-[14.5px] font-semibold">Grupo dos voluntários{gestor ? '' : ' · entrada obrigatória'}</b>
      <span className="text-[13.5px] leading-snug">
        {gestor ? 'O grupo do WhatsApp em que a equipe passa as informações do treinamento e do Natal Feliz para os voluntários.' : 'É no grupo do WhatsApp que passamos as informações do treinamento e do dia do evento.'}
      </span>
      <a href={GRUPO_DO_WHATSAPP} target="_blank" rel="noopener noreferrer"
        className="flex h-12 items-center justify-center gap-2 rounded-full bg-[#1FA855] text-[15px] font-semibold text-white transition-colors hover:bg-[#1A9049]">
        <Users className="h-5 w-5" /> Entrar no grupo do WhatsApp
      </a>
    </div>
  );
}

// --- Cronograma ----------------------------------------------------------------------------

function Segmentos<T extends string>({ valor, opcoes, aoMudar, rotulo }: { valor: T; opcoes: Array<[T, ReactNode]>; aoMudar: (v: T) => void; rotulo: string }) {
  return (
    <div className="inline-flex max-w-full gap-0.5 self-start overflow-x-auto rounded-full bg-black/[0.05] p-1 dark:bg-white/[0.07]" role="group" aria-label={rotulo}>
      {opcoes.map(([k, r]) => (
        <button key={k} type="button" aria-pressed={valor === k} onClick={() => aoMudar(k)}
          className={cn('shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-[13.5px] transition-colors',
            valor === k ? 'bg-card font-semibold text-foreground shadow-[0_1px_3px_hsl(165_30%_12%/0.14)]' : 'font-medium text-muted-foreground hover:text-foreground')}>
          {r}
        </button>
      ))}
    </div>
  );
}

const nomeDoDia = (dia: string) => (dia === DIA_DO_TREINAMENTO ? 'Treinamento' : dia === DIA_DO_NATAL_FELIZ ? 'Natal Feliz' : '');

export function CronogramaDaCentral({ d, agora }: { d: DadosDaCentral; agora: Agora }) {
  const v = d.voluntario;
  const dias = useMemo(() => diasDoCronograma(d.cronograma), [d.cronograma]);
  const [dia, setDia] = useState<string | null>(() => diaQueAbre(dias, agora.dia));
  const [soMeus, setSoMeus] = useState<'todos' | 'meus'>('todos');
  const diaAtual = dia && dias.includes(dia) ? dia : diaQueAbre(dias, agora.dia);
  const itens = diaAtual ? itensDoDia(d.cronograma, diaAtual, v, soMeus === 'meus') : [];
  const posAgora = diaAtual ? posicaoDoAgora(itens, diaAtual, agora) : -1;

  if (!dias.length) {
    return (
      <Cartao className="text-[14px] text-muted-foreground" data-testid="cronograma-vazio">
        O cronograma ainda está sendo montado. Assim que sair, aparece aqui. Com os avisos ligados, os lembretes chegam no seu celular.
      </Cartao>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {/* O gestor vê tudo: sem o filtro da área. */}
      {!eGestor(v) && <Segmentos<'todos' | 'meus'> rotulo="Filtrar" valor={soMeus} aoMudar={setSoMeus} opcoes={[['todos', 'Todos'], ['meus', 'Minha área']]} />}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Escolha o dia">
        {dias.map((x) => (
          <button key={x} type="button" aria-pressed={diaAtual === x} onClick={() => setDia(x)}
            className={cn('flex flex-col items-start rounded-[16px] px-4 py-2 text-left leading-tight transition-colors',
              diaAtual === x ? 'bg-[#1F2322] text-white dark:bg-[#81E2CF] dark:text-[#1F2322]' : 'text-muted-foreground hover:text-foreground')}>
            <b className="text-[14px] font-semibold">{diaCurto(x)}</b>
            {nomeDoDia(x) && <small className={cn('text-[11.5px]', diaAtual === x ? 'opacity-80' : '')}>{nomeDoDia(x)}</small>}
          </button>
        ))}
      </div>
      {itens.length === 0 ? (
        <Cartao className="text-[14px] text-muted-foreground">Nada só da sua área neste dia. Veja "Todos".</Cartao>
      ) : (
        <ol className="flex flex-col gap-2.5" data-testid="cronograma">
          {itens.map((i, n) => (
            <li key={i.id} className="contents">
              {n === posAgora && <LinhaDoAgora hora={agora.hora} />}
              <ItemDaLinha i={i} meu={eSoDoMeuGrupo(i, v)} passou={posAgora > -1 && n < posAgora && !!i.fim && i.fim <= agora.hora} />
            </li>
          ))}
          {posAgora === itens.length && <li className="contents"><LinhaDoAgora hora={agora.hora} /></li>}
        </ol>
      )}
    </div>
  );
}

function LinhaDoAgora({ hora }: { hora: string }) {
  return (
    <div className="grid grid-cols-[46px_minmax(0,1fr)] items-center gap-2" data-testid="linha-do-agora" aria-label={`Agora, ${hora}`}>
      <span className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#E0533D]">Agora</span>
      <span className="relative h-0.5 rounded-full bg-[#F37964]"><span className="absolute -left-1 -top-[3px] h-2 w-2 rounded-full bg-[#F37964]" /></span>
    </div>
  );
}

function ItemDaLinha({ i, meu, passou }: { i: ItemDoCronograma; meu: boolean; passou: boolean }) {
  return (
    <div className={cn('grid grid-cols-[46px_minmax(0,1fr)] gap-2', passou && 'opacity-55')} data-testid="item-do-cronograma">
      <span className="pt-3.5 text-[12.5px] font-semibold tabular-nums text-muted-foreground">{i.inicio}</span>
      <div className="flex flex-col gap-1 rounded-[18px] border border-black/[0.06] border-l-4 bg-card px-3.5 py-3 dark:border-white/[0.08]" style={{ borderLeftColor: COR_DO_TIPO[i.tipo] }}>
        <div className="flex items-start justify-between gap-2">
          <b className="text-[14.5px] font-semibold leading-snug">{i.titulo}</b>
          <span className={cn('shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold', meu ? 'bg-[#FBCE00]/30 text-foreground' : 'bg-muted text-muted-foreground')}>
            {meu ? 'Para você' : ROTULO_DO_TIPO[i.tipo]}
          </span>
        </div>
        <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-[12.5px] text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{i.inicio}{i.fim ? ` – ${i.fim}` : ''}</span>
          {i.local && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{i.local}</span>}
        </span>
        {i.detalhe && <p className="text-[13px] leading-snug text-muted-foreground">{i.detalhe}</p>}
      </div>
    </div>
  );
}

// --- Avisos (no meio da barra, no lugar da credencial, 12/11/2026) ---------------------------------

const quando = (iso: string) => {
  const d = new Date(iso);
  const min = Math.round((Date.now() - d.getTime()) / 60_000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  if (min < 24 * 60) return `há ${Math.round(min / 60)} h`;
  return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ' às');
};

/** Os avisos que já chegaram, com o ligar no topo. "novos" = os que chegaram depois da última visita. */
export function AvisosDaCentral({ avisos, whatsapp, destaque, vistosAte }: { avisos: AvisoEnviado[]; whatsapp: string; destaque?: string | null; vistosAte: string }) {
  return (
    <div className="flex flex-col gap-3">
      <CartaoDosAvisos whatsapp={whatsapp} compacto />
      {avisos.length === 0 ? (
        <Cartao className="flex flex-col items-center gap-2 py-8 text-center" data-testid="sem-avisos">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground"><Bell className="h-5 w-5" /></span>
          <b className="text-[15px] font-semibold">Nenhum aviso ainda</b>
          <span className="max-w-[300px] text-[13.5px] text-muted-foreground">Os lembretes do treinamento e do Natal Feliz aparecem aqui, e no celular com os avisos ligados.</span>
        </Cartao>
      ) : (
        <ul className="flex flex-col gap-2.5" data-testid="lista-de-avisos">
          {avisos.map((a) => {
            const novo = !!vistosAte ? a.enviado_em > vistosAte : true;
            return (
              <li key={a.id} className={cn('rounded-[18px] border border-black/[0.06] bg-card px-4 py-3.5 dark:border-white/[0.08]', a.id === destaque && 'ring-2 ring-[#81E2CF]')} data-novo={novo}>
                <div className="flex items-baseline justify-between gap-3">
                  <b className="flex items-center gap-2 text-[15px] font-semibold">
                    {novo && <span className="h-2 w-2 shrink-0 rounded-full bg-[#FBCE00]" aria-label="novo" />}
                    {a.titulo}
                  </b>
                  <span className="shrink-0 text-[12px] text-muted-foreground">{quando(a.enviado_em)}</span>
                </div>
                <p className="mt-1 text-[14px] leading-snug text-muted-foreground">{a.texto}</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// --- Local ---------------------------------------------------------------------------------

export function LocalDaCentral() {
  return (
    <div className="flex flex-col gap-3">
      <Cartao className="flex flex-col gap-3">
        <div>
          <b className="block text-[17px] font-semibold" style={{ fontFamily: 'Poppins, sans-serif' }}>{TREINAMENTO.local}</b>
          <span className="text-[13.5px] leading-snug text-muted-foreground">{TREINAMENTO.endereco}</span>
        </div>
        <Button asChild className="rounded-[14px]"><a href={MAPA_DO_TREINAMENTO} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /> Abrir no Google Maps</a></Button>
        <div className="grid grid-cols-2 gap-2 text-[13px]">
          <div className="rounded-[14px] bg-muted/70 px-3 py-2"><span className="block text-muted-foreground">Treinamento</span><b>{diaCurto(DIA_DO_TREINAMENTO)}</b><span className="block text-[12px] text-muted-foreground">{TREINAMENTO.horario || 'horário a confirmar'}</span></div>
          <div className="rounded-[14px] bg-muted/70 px-3 py-2"><span className="block text-muted-foreground">Natal Feliz</span><b>{diaCurto(DIA_DO_NATAL_FELIZ)}</b><span className="block text-[12px] text-muted-foreground">o dia todo</span></div>
        </div>
      </Cartao>
      {PLANTA_DO_LOCAL ? (
        <Cartao className="overflow-hidden p-2">
          <a href={PLANTA_DO_LOCAL} target="_blank" rel="noopener noreferrer" aria-label="Abrir a planta em tela cheia">
            <img src={PLANTA_DO_LOCAL} alt={`Planta do ${TREINAMENTO.local}, com as áreas do evento`} className="block w-full rounded-[14px]" data-testid="planta" />
          </a>
          <p className="px-2 pb-1 pt-2 text-[12.5px] text-muted-foreground">Toque na planta para ampliar.</p>
        </Cartao>
      ) : (
        <div className="relative overflow-hidden rounded-[20px] border-2 border-dashed border-border p-5 text-center text-[14px] text-muted-foreground" data-testid="planta-em-breve">
          <img src={CAPA_DO_NATAL} alt="" aria-hidden className="mx-auto mb-3 w-24 rounded-[12px] opacity-80" />
          A planta do {TREINAMENTO.local}, com as áreas, os banheiros e os primeiros socorros, chega aqui em breve.
        </div>
      )}
    </div>
  );
}

// --- Perfil --------------------------------------------------------------------------------

export function PerfilDaCentral({ d, whatsapp, aoSair }: { d: DadosDaCentral; whatsapp: string; aoSair: () => void }) {
  const v = d.voluntario;
  const gestor = eGestor(v);
  const linhas: Array<[string, string]> = gestor
    ? [['WhatsApp', whatsappMascarado(whatsapp)], ['Acesso', 'Gestão: o cronograma inteiro e todos os avisos']]
    : [
      ['WhatsApp', whatsappMascarado(whatsapp)],
      ['Vínculo', quemE(v)],
      ...(v.igreja ? [['Igreja', v.igreja] as [string, string]] : []),
      ['Horário', turnoDe(v.horario) || '—'],
      ['Onde vou ajudar', rotuloDaAjuda(v.opcao1)],
      ...(v.opcao2 ? [['2ª opção', rotuloDaAjuda(v.opcao2)] as [string, string]] : []),
      ['Inscrição', `${dataDe(v.inscrito_em)} · ${v.protocolo}`],
    ];
  return (
    <div className="flex flex-col gap-3">
      <Cartao className="flex items-center gap-3.5">
        <AvatarDaPessoa nome={v.nome} grande />
        <div className="min-w-0 flex-1">
          <b className="block text-[17px] font-semibold leading-snug" style={{ fontFamily: 'Poppins, sans-serif' }}>{v.nome}</b>
          <span className="text-[13px] text-muted-foreground">{gestor ? 'Acompanha o voluntariado' : rotuloDoVinculo(v.vinculo as never)}</span>
        </div>
        <SeloDoPerfil v={v} />
      </Cartao>
      <Secao>{gestor ? 'Meu acesso' : 'Minha inscrição'}</Secao>
      <Cartao className="p-0">
        <dl className="divide-y divide-border" data-testid="dados-da-inscricao">
          {linhas.map(([r, val]) => (
            <div key={r} className="flex items-baseline justify-between gap-4 px-4 py-3">
              <dt className="shrink-0 text-[13px] text-muted-foreground">{r}</dt>
              <dd className="text-right text-[14px] font-semibold">{val}</dd>
            </div>
          ))}
        </dl>
      </Cartao>
      {!gestor && <p className="px-1 text-[13px] text-muted-foreground">Precisa mudar algo? Fale com a equipe no grupo dos voluntários.</p>}
      <Button asChild variant="outline" className="rounded-[16px]"><a href={GRUPO_DO_WHATSAPP} target="_blank" rel="noopener noreferrer"><Users className="h-4 w-4" /> Grupo dos voluntários</a></Button>
      <CartaoDosAvisos whatsapp={whatsapp} compacto />
      <Button variant="ghost" className="self-center text-muted-foreground" onClick={aoSair}><LogOut className="h-4 w-4" /> Sair deste celular</Button>
    </div>
  );
}
