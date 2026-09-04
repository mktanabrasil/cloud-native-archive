import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { useUserRole } from '@/hooks/useUserRole';
import { AppEvent, UNITS, EVENT_TYPES, EVENT_STATUSES, PARTNER_TYPES, Unit, EventType, EventStatus, PartnerType, SYSTEM_COLORS, eventUnitLabel, TRANSPORT_VEHICLES, TransportVehicle } from '@/types';
import { getStatusDotClass } from '@/lib/statusColors';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, Plus, X, Globe, Eye, Layout, CalendarDays, Lock, Share2, Info, EyeOff, Clock, Truck, AlertTriangle } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { FileUpload } from './FileUpload';
import { EventDetailDialog } from './EventDetailDialog';
import { BannerMissingDialog } from './BannerMissingDialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { GrupoDeOpcoes } from './events/GrupoDeOpcoes';
import { TituloDoEvento } from './events/TituloDoEvento';
import { paraCampoDataHora, rotuloDoFuso } from '@/lib/events/horaLocal';
import { linkPublicoDoEvento, prefixoDoLinkPublico, proximoSlug } from '@/lib/events/linkPublico';
import { descreverErroDeGravacao } from '@/lib/events/mensagemDeErro';
import { contar, erroDeLimite, type CampoComLimite } from '@/lib/events/limites';
import { apagarDoBalde, urlDoAnexo } from '@/lib/events/anexos';
import { errosDeTransporte, motivoDoApoio, resumoDoTransporte } from '@/lib/events/transporte';
import { errosDasListas, limparListas } from '@/lib/events/listas';
import { toast } from 'sonner';
import { format as formatarData } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: AppEvent | null;
  /**
   * Aberto a partir de "Aprovações pendentes": o admin geral completa o que
   * só ele preenche e confirma, ou devolve com observação.
   */
  revisao?: boolean;
}

const slugify = (text: string): string =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-z0-9\s-]/g, '') // remove caracteres especiais
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

/**
 * Onde cada erro mora na tela, e como ele se chama para quem lê.
 *
 * Os quatro campos de logística ficam entre 1300px e 2400px de altura, numa
 * janela de 745px: quem aperta "Criar Programação" com eles em branco vê o
 * botão não fazer nada, porque o motivo está muito abaixo da dobra.
 */
const CAMPOS_COM_ERRO: { chave: string; ancora: string; rotulo: string }[] = [
  { chave: 'title', ancora: 'campo-title', rotulo: 'Título' },
  { chave: 'description', ancora: 'campo-description', rotulo: 'Descrição' },
  { chave: 'start_datetime', ancora: 'campo-start_datetime', rotulo: 'Início' },
  { chave: 'end_datetime', ancora: 'campo-end_datetime', rotulo: 'Término' },
  { chave: 'location', ancora: 'campo-location', rotulo: 'Localização' },
  { chave: 'target_audience', ancora: 'campo-publico', rotulo: 'Público-alvo' },
  { chave: 'support_team', ancora: 'campo-apoio', rotulo: 'Equipe de apoio' },
  { chave: 'food_logistics', ancora: 'campo-comida', rotulo: 'Logística de alimentação' },
  { chave: 'equipment_needed', ancora: 'campo-equip', rotulo: 'Equipamentos necessários' },
  { chave: 'transport_vehicle', ancora: 'campo-transporte', rotulo: 'Transporte' },
  { chave: 'transport_passengers', ancora: 'campo-transporte', rotulo: 'Passageiros' },
  { chave: 'marketing_items', ancora: 'campo-marketing', rotulo: 'Solicitação de marketing' },
  { chave: 'partners', ancora: 'campo-parceiros', rotulo: 'Parceiros' },
  { chave: 'external_collaborators', ancora: 'campo-parceria', rotulo: 'Parceria com unidade ou instituição' },
];

/**
 * "61/120" embaixo do campo; vermelho e com instrução quando passou.
 * Discreto de propósito: quem escreve dentro do limite nem repara.
 */
function Contador({ campo, valor }: { campo: CampoComLimite; valor: string | null | undefined }) {
  const c = contar(campo, valor);
  return (
    <p
      className={`mt-1 text-right text-[11px] tabular-nums ${c.excedeu ? 'text-destructive' : 'text-muted-foreground'}`}
      aria-live={c.excedeu ? 'polite' : undefined}
    >
      {c.texto}
      {c.aviso && ` — ${c.aviso}`}
    </p>
  );
}

/** O resumo no topo: diz quantas faltam e leva até cada uma. */
function ResumoDePendencias({ erros, acao }: { erros: Record<string, string>; acao: string }) {
  const pendentes = CAMPOS_COM_ERRO.filter(c => erros[c.chave]);
  if (pendentes.length === 0) return null;

  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
      <p className="text-sm font-semibold text-destructive">
        {pendentes.length === 1
          ? `Falta 1 campo para ${acao}`
          : `Faltam ${pendentes.length} campos para ${acao}`}
      </p>
      <ul className="mt-2 space-y-1">
        {pendentes.map(c => (
          <li key={c.chave}>
            <button
              type="button"
              className="text-left text-xs text-foreground underline underline-offset-4 decoration-destructive/60 hover:decoration-destructive"
              onClick={() => document.getElementById(c.ancora)?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })}
            >
              {c.rotulo} — {erros[c.chave]}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
const emptyEvent = (): Partial<AppEvent> => ({
  title: '',
  description: '',
  unit: 'DIC',
  event_type: 'reunião',
  start_datetime: '',
  end_datetime: '',
  location: '',
  status: 'pendente',
  visibility: 'interno',
  notes: '',
  marketing_request: false,
  partner_involved: false,
  partner_type: '',
  partner_name: '',
  partners: [],
  has_unit_collaboration: false,
  collaborating_units: [],
  external_collaborators: [],
  attachments: [],
  banner_url_desktop: '',
  banner_url_mobile: '',
  banner_image_desktop: '',
  banner_image_mobile: '',
  custom_color: SYSTEM_COLORS[Math.floor(Math.random() * SYSTEM_COLORS.length)],
  show_in_banner: false,
  slug: '',
  use_logo_as_title: false,
  event_logo_url: '',
  show_banner_fade: true,
  full_height_title: false,
  banner_display_time: 5,
  show_banner_overlay: true,
  target_audience: '',
  support_team: '',
  food_logistics: '',
  food_details: '',
  printed_materials: '',
  equipment_needed: '',
  marketing_items: [],
  marketing_coverage: false,
  transport_needed: false,
  transport_vehicle: '',
  transport_passengers: 0,
  transport_extra_equipment: false,
});

export default function EventFormDialog({ open, onOpenChange, event, revisao = false }: Props) {
  const { addEvent, updateEvent, detectConflicts, setSelectedEvent, events } = useApp();
  const { userName, unit, isAdmin, isMarketing } = useUserRole();
  const [form, setForm] = useState<Partial<AppEvent>>(emptyEvent());
  const [conflicts, setConflicts] = useState<AppEvent[]>([]);
  const [showConflictAlert, setShowConflictAlert] = useState(false);
  const [showBannerWarning, setShowBannerWarning] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  /**
   * Já houve uma tentativa de enviar. A partir daí, os campos que erraram
   * são reavaliados a cada mudança — o botão dizia "(4 pendências)" até o
   * próximo clique, mesmo com três já corrigidas. Só os que já erraram: o
   * formulário não grita antes da primeira tentativa.
   */
  const [tentou, setTentou] = useState(false);
  const [slugMode, setSlugMode] = useState<'auto' | 'custom'>('auto');
  const [showSlugPrompt, setShowSlugPrompt] = useState(false);
  const [autoSlugPreview, setAutoSlugPreview] = useState('');
  /**
   * Quais interruptores "Outro" estão ligados.
   *
   * Fica aqui, e não dentro do grupo, porque a validação precisa saber que
   * alguém abriu a caixa e não escreveu nada — o valor guardado não conta isso.
   */
  const [outroAberto, setOutroAberto] = useState<Record<string, boolean>>({});
  /** Uma gravação em curso. Trava o botão e segura o diálogo aberto.
   *
   *  Sem isto, dois cliques rápidos criavam dois eventos: o primeiro ainda
   *  estava indo quando o segundo saía. */
  const [salvando, setSalvando] = useState(false);
  /** A caixa de "Devolver com observação" e o que foi escrito nela. */
  const [devolvendo, setDevolvendo] = useState(false);
  const [observacao, setObservacao] = useState('');
  /**
   * O que "Aprovar" muda no evento antes de gravar. Fica numa ref porque a
   * tela de conflito ("Salvar mesmo assim") precisa aplicar o mesmo ajuste
   * depois, sem que ele tenha ficado no estado.
   */
  const ajusteRef = useRef<((e: AppEvent) => AppEvent) | null>(null);
  const avisoRef = useRef<{ titulo: string; descricao: string } | null>(null);
  /**
   * O formulário como estava ao abrir, para saber se algo foi mexido.
   *
   * Esc, clique fora e "Cancelar" fechavam na hora e levavam tudo junto: nove
   * obrigatórios, quatro grupos de interruptores, listas. Um Esc para fechar
   * o seletor de data no momento errado apagava minutos de trabalho. Agora,
   * com algo digitado, fechar pergunta antes.
   */
  const inicialRef = useRef<string>('');
  const [confirmarSaida, setConfirmarSaida] = useState(false);

  const isEditing = !!event;
  /** Revisão só faz sentido para quem publica, sobre um evento que existe. */
  const emRevisao = revisao && isEditing && isMarketing;

  /**
   * Quem não é da comunicação não publica: **envia**, e o admin geral
   * completa (link, onde aparece) e confirma. O evento dela nasce pendente e
   * interno — é só isso que o banco aceita (`events_gestor_insert`).
   */
  const enviaParaAprovacao = !isMarketing;
  /**
   * Já confirmado pela administração: ela não altera mais. O banco também
   * recusa (`events_gestor_update`), mas recusa em silêncio — zero linhas —,
   * então a trava precisa estar aqui, com explicação.
   */
  const travadoParaEla = enviaParaAprovacao && isEditing && event?.status === 'confirmado';
  const statusDisponiveis: EventStatus[] = enviaParaAprovacao ? ['pendente', 'cancelado'] : EVENT_STATUSES;
  const acaoDoBotao = isEditing ? 'salvar as alterações' : enviaParaAprovacao ? 'enviar a programação' : 'criar a programação';

  /** Quantos campos o botão ainda espera. Zero antes da primeira tentativa. */
  const pendencias = Object.keys(errors).length;

  // Gera um slug único a partir de um texto base, adicionando um sufixo numérico
  // caso já exista outro evento com o mesmo slug.
  const generateUniqueSlug = (base: string): string => {
    const baseSlug = slugify(base);
    if (!baseSlug) return '';
    const taken = new Set(
      events
        .filter(e => e.id !== event?.id && e.slug)
        .map(e => e.slug as string)
    );
    if (!taken.has(baseSlug)) return baseSlug;
    let i = 2;
    while (taken.has(`${baseSlug}-${i}`)) i++;
    return `${baseSlug}-${i}`;
  };

  // Ao digitar o título: se o slug estiver em modo automático, atualiza direto.
  // Se estiver personalizado, aguarda 5s sem digitação antes de abrir o pop-up
  // (debounce) para o usuário decidir entre usar o automático ou manter o atual.
  useEffect(() => {
    const auto = generateUniqueSlug(form.title || '');
    if (slugMode === 'auto') {
      if (auto !== (form.slug || '')) {
        setForm(prev => ({ ...prev, slug: auto }));
      }
      return;
    }
    // Modo personalizado: só pergunta se o automático diferir do slug atual.
    if (!auto || auto === (form.slug || '')) return;
    const timer = setTimeout(() => {
      setAutoSlugPreview(auto);
      setShowSlugPrompt(true);
    }, 5000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.title, slugMode]);



  useEffect(() => {
    if (event) {
      // Hora local, e não `toISOString().slice(0, 16)`: aquilo era UTC num
      // campo que fala hora local, e cada edição adiantava o evento em 3 h.
      // Ver `horaLocal.ts`.
      const aberto = {
        ...event,
        start_datetime: paraCampoDataHora(event.start_datetime),
        end_datetime: paraCampoDataHora(event.end_datetime),
      };
      setForm(aberto);
      inicialRef.current = JSON.stringify(aberto);
    } else {
      const vazio = { ...emptyEvent(), unit: (unit as Unit) || 'DIC' };
      setForm(vazio);
      inicialRef.current = JSON.stringify(vazio);
    }
    setConfirmarSaida(false);
    // Ao editar um evento que já possui slug, preserva o valor existente.
    setSlugMode(event?.slug ? 'custom' : 'auto');
    setShowSlugPrompt(false);
    setConflicts([]);
    setShowConflictAlert(false);
    setShowBannerWarning(false);
    setOutroAberto({});
    setErrors({});
    setTentou(false);
    setDevolvendo(false);
    setObservacao('');
    ajusteRef.current = null;
    avisoRef.current = null;
  }, [event, open]);

  /**
   * O que a pessoa mexeu, sem o que a tela derivou sozinha.
   *
   * Em modo automático o slug nasce do título — inclusive ao abrir um evento
   * antigo que não tinha slug, o que faria o formulário parecer alterado
   * antes de qualquer tecla. Mudança de título já conta pelo título.
   */
  const soOQueElaMexeu = (obj: Record<string, unknown>): Record<string, unknown> => {
    if (slugMode !== 'auto') return obj;
    const { slug: _slug, ...resto } = obj;
    return resto;
  };

  const camposMexidosLista = (): string[] => {
    if (!inicialRef.current) return [];
    const inicial = soOQueElaMexeu(JSON.parse(inicialRef.current) as Record<string, unknown>);
    const atual = soOQueElaMexeu(form as Record<string, unknown>);
    return Object.keys({ ...inicial, ...atual }).filter(k => JSON.stringify(inicial[k]) !== JSON.stringify(atual[k]));
  };

  /** Algo mudou desde que abriu. */
  const mexido = camposMexidosLista().length > 0;

  /** Quantos campos diferem do que estava ao abrir — para a pergunta dizer o tamanho da perda. */
  const camposMexidos = (): number => camposMexidosLista().length;

  /**
   * Todo caminho de fechar passa aqui: Esc, clique fora, "Cancelar".
   * Salvar com sucesso chama `onOpenChange(false)` direto — não pergunta.
   */
  const pedirParaFechar = (aberto: boolean) => {
    if (aberto) return onOpenChange(true);
    if (mexido && !salvando) {
      setConfirmarSaida(true);
      return;
    }
    onOpenChange(false);
  };

  const descartar = () => {
    setConfirmarSaida(false);
    onOpenChange(false);
  };

  /** Tudo o que está errado agora. Puro: não mexe no estado. */
  const calcularErros = (): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (!form.title?.trim()) errs.title = 'Título obrigatório';
    if (!form.start_datetime) errs.start_datetime = 'Data/hora início obrigatória';
    if (!form.end_datetime) errs.end_datetime = 'Data/hora término obrigatória';
    if (!form.location?.trim()) errs.location = 'Localização obrigatória';

    // Limites de texto: o banco também recusa (CHECK), mas aqui a pessoa
    // sabe antes, com o campo apontado e quanto encurtar.
    for (const campo of ['title', 'location', 'description'] as CampoComLimite[]) {
      const erro = erroDeLimite(campo, form[campo]);
      if (erro && !errs[campo]) errs[campo] = erro;
    }
    
    // Novos campos obrigatórios
    if (!form.target_audience?.trim()) errs.target_audience = 'Selecione o público-alvo';
    if (!form.support_team?.trim()) errs.support_team = 'Informe a equipe de apoio';
    if (!form.food_logistics?.trim()) errs.food_logistics = 'Informe a logística de alimentação';
    if (!form.equipment_needed?.trim()) errs.equipment_needed = 'Informe os equipamentos necessários';

    // Interruptor "Outro" ligado e caixa vazia: antes isso passava — o valor
    // virava "Outro: ", que conta como preenchido e não diz nada a ninguém.
    const outroVazio = (campo: keyof AppEvent, opcoes: string[]) => {
      const valor = ((form[campo] as string) || '').split(', ').map(v => v.trim()).filter(Boolean);
      return !valor.some(v => !opcoes.includes(v));
    };
    if (outroAberto.publico && outroVazio('target_audience', ["Os funcionários", "Os atendidos", "Os atendidos e suas famílias", "Será aberto para a comunidade"]))
      errs.target_audience = 'Escreva qual público, ou desligue “Outro público”';
    if (outroAberto.apoio && outroVazio('support_team', ["Funcionários", "Voluntários"]))
      errs.support_team = 'Escreva qual equipe, ou desligue “Outra equipe”';
    if (outroAberto.comida && outroVazio('food_logistics', ["Almoço", "Coffee Break", "Lanche", "Jantar", "Nenhum"]))
      errs.food_logistics = 'Escreva qual logística, ou desligue “Outra logística”';
    if (outroAberto.equip && outroVazio('equipment_needed', ["Som", "Microfone", "Projetor", "Televisão", "Notebook", "Nenhum"]))
      errs.equipment_needed = 'Escreva qual equipamento, ou desligue “Outro equipamento”';
    
    // Transporte ligado pede veículo e gente: sem isso a logística não sabe
    // o que reservar.
    Object.assign(errs, errosDeTransporte(form));

    // Condicional para marketing
    if (form.marketing_request) {
      const hasCoverage = form.marketing_coverage;
      const hasGraphics = (form.marketing_items || []).some(i => i.type === 'demanda_grafica');
      
      if (!hasCoverage && !hasGraphics) {
        errs.marketing_items = 'Selecione ao menos um tipo de solicitação (Cobertura ou Demanda Gráfica)';
      } else if (hasGraphics && (form.marketing_items || []).filter(i => i.type === 'demanda_grafica').some(item => !item.item.trim())) {
        errs.marketing_items = 'Preencha todos os campos das demandas gráficas';
      }
    }

    if (form.start_datetime && form.end_datetime && new Date(form.start_datetime) >= new Date(form.end_datetime)) {
      errs.end_datetime = 'Término deve ser após o início';
    }

    // Listas: linha em branco não passa — e instituição vazia iria para o site.
    Object.assign(errs, errosDasListas(form));

    return errs;
  };

  const validate = (): boolean => {
    const errs = calcularErros();
    setErrors(errs);
    setTentou(true);
    return Object.keys(errs).length === 0;
  };

  // Depois da primeira tentativa, o que já errou é reavaliado a cada mudança.
  // Só remove: um erro novo só aparece no próximo clique, para o formulário
  // não gritar enquanto a pessoa ainda está escrevendo.
  useEffect(() => {
    if (!tentou) return;
    const agora = calcularErros();
    setErrors(prev => {
      const mantidos: Record<string, string> = {};
      for (const chave of Object.keys(prev)) if (agora[chave]) mantidos[chave] = agora[chave];
      return Object.keys(mantidos).length === Object.keys(prev).length && Object.keys(mantidos).every(k => mantidos[k] === prev[k])
        ? prev
        : mantidos;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, outroAberto, tentou]);

  const getFullEvent = (): AppEvent => {
    return {
      id: event?.id || crypto.randomUUID(),
      title: form.title!.trim(),
      description: form.description || '',
      unit: form.unit as Unit,
      event_type: form.event_type as EventType,
      start_datetime: form.start_datetime ? new Date(form.start_datetime).toISOString() : new Date().toISOString(),
      end_datetime: form.end_datetime ? new Date(form.end_datetime).toISOString() : new Date().toISOString(),
      location: form.location!.trim(),
      // A gestora só envia pendente e interno; cancelar o próprio pedido pode.
      status: enviaParaAprovacao
        ? (form.status === 'cancelado' ? 'cancelado' : 'pendente')
        : (form.status as EventStatus),
      visibility: enviaParaAprovacao ? 'interno' : ((form.visibility as 'publico' | 'interno') || 'interno'),
      submitted_at: enviaParaAprovacao ? (event?.submitted_at || new Date().toISOString()) : (event?.submitted_at ?? null),
      reviewed_at: event?.reviewed_at ?? null,
      reviewed_by: event?.reviewed_by ?? null,
      review_note: event?.review_note ?? null,
      has_conflict: false,
      created_by: event?.created_by || userName || 'Usuário',
      updated_by: isEditing ? (userName || 'Usuário') : undefined,
      created_at: event?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      notes: form.notes || '',
      marketing_request: form.marketing_request || false,
      partner_involved: form.partner_involved || false,
      partner_type: (form.partner_type as PartnerType) || '',
      partner_name: form.partner_name || '',
      // Sem linhas em branco, mesmo que a validação não tenha barrado
      // (devolver, por exemplo, não valida).
      partners: limparListas(form).partners,
      has_unit_collaboration: form.has_unit_collaboration || false,
      collaborating_units: form.collaborating_units || [],
      external_collaborators: limparListas(form).external_collaborators,
      attachments: form.attachments || [],
      banner_url_desktop: form.banner_url_desktop || '',
      banner_url_mobile: form.banner_url_mobile || '',
      banner_image_desktop: form.banner_image_desktop || '',
      banner_image_mobile: form.banner_image_mobile || '',
      custom_color: form.custom_color || SYSTEM_COLORS[0],
      show_in_banner: form.show_in_banner || false,
      // `null`, e não `''`: `events_slug_key` é única. Já existe uma linha com
      // slug vazio, e a segunda quebrava com "duplicate key" — mensagem que não
      // diz nada a quem só queria salvar um evento. `null` nunca colide.
      slug: form.slug?.trim() ? form.slug.trim() : null,
      use_logo_as_title: form.use_logo_as_title || false,
      event_logo_url: form.event_logo_url || '',
      show_banner_fade: form.show_banner_fade !== undefined ? form.show_banner_fade : true,
      full_height_title: form.full_height_title || false,
      banner_display_time: form.banner_display_time || 5,
      show_banner_overlay: form.show_banner_overlay !== undefined ? form.show_banner_overlay : true,
      target_audience: form.target_audience || '',
      support_team: form.support_team || '',
      food_logistics: form.food_logistics || '',
      food_details: form.food_details || '',
      // `marketing_info` deixou de ser gravado: nenhuma linha o usava (0/108
      // em 04/09/2026) e não havia campo. A coluna fica no banco até um DROP.
      printed_materials: form.printed_materials?.trim() || '',
      equipment_needed: form.equipment_needed || '',
      marketing_items: form.marketing_items || [],
      marketing_coverage: form.marketing_coverage || false,
      transport_needed: form.transport_needed || false,
      transport_vehicle: form.transport_needed ? (form.transport_vehicle || '') : '',
      transport_passengers: form.transport_needed ? (Number(form.transport_passengers) || 0) : 0,
      transport_extra_equipment: form.transport_needed ? !!form.transport_extra_equipment : false,
    };
  };

  /**
   * Grava o evento e só então fecha o formulário.
   *
   * Antes o `addEvent` era disparado sem `await` e sem `catch`, e a linha
   * seguinte já fechava o diálogo. Se o banco recusasse, a pessoa via um toast
   * de erro com o formulário fechado e **tudo o que digitou perdido** — sem
   * chance de tentar de novo.
   *
   * O conflito não é mais gravado nos outros eventos: a bandeira é calculada
   * das datas ao carregar (`conflitos.ts`), então mover este evento já limpa
   * o outro lado sozinho.
   */
  const salvar = async (
    evento: AppEvent,
    aviso: { titulo: string; descricao: string } | null = null,
  ) => {
    if (salvando) return;
    setSalvando(true);

    // O slug é conferido contra os eventos carregados — e quem enxerga só a
    // própria unidade pode escolher um que outra unidade já usa. O banco
    // recusa (`events_slug_key`). Em vez de desistir, avançamos o sufixo e
    // tentamos de novo, até três vezes; a pessoa fica sabendo no aviso final.
    const slugPedido = evento.slug;
    let gravado = evento;
    for (let tentativa = 0; ; tentativa++) {
      try {
        if (isEditing) await updateEvent(gravado);
        else await addEvent(gravado);
        break;
      } catch (erro) {
        const d = descreverErroDeGravacao(erro, { acao: isEditing ? 'atualizar' : 'criar', unidade: gravado.unit, slug: gravado.slug });
        if (d.tipo === 'slug' && gravado.slug && tentativa < 3) {
          gravado = { ...gravado, slug: proximoSlug(gravado.slug) };
          continue;
        }
        if (d.tipo === 'slug') toast.error(d.titulo, { description: 'Escolha outro link e tente de novo.' });
        // Nos demais casos o contexto já avisou. O formulário fica aberto,
        // preenchido, para ela tentar de novo.
        if (gravado.slug !== slugPedido) {
          setSlugMode('custom');
          setForm(prev => ({ ...prev, slug: gravado.slug }));
        }
        setSalvando(false);
        return;
      }
    }

    // Anexos que estavam no evento e saíram da lista: agora que o evento
    // gravou sem eles, o arquivo pode ir. (Os que subiram e saíram antes de
    // salvar o próprio FileUpload já apagou.)
    if (event) {
      const ficaram = new Set((gravado.attachments || []).map(urlDoAnexo));
      const removidos = (event.attachments || []).map(urlDoAnexo).filter(u => !ficaram.has(u));
      if (removidos.length > 0) await apagarDoBalde(removidos);
    }

    const quando = formatarData(new Date(gravado.start_datetime), "d MMM", { locale: ptBR });
    const linkAjustado = gravado.slug !== slugPedido && gravado.slug
      ? ` Link ajustado para “${gravado.slug}”: o original já estava em uso.`
      : '';
    if (aviso) {
      toast.success(aviso.titulo, { description: aviso.descricao });
    } else if (enviaParaAprovacao && !isEditing) {
      toast.success('Enviado para aprovação', {
        description: `“${gravado.title}”, ${quando} · ${eventUnitLabel(gravado.unit)}, está como pendente. A administração geral vai revisar.`,
      });
    } else {
      toast.success(isEditing ? 'Alterações salvas' : 'Programação criada', {
        description: `“${gravado.title}”, ${quando} · ${eventUnitLabel(gravado.unit)}.${linkAjustado}`,
      });
    }

    setSalvando(false);
    setSelectedEvent(null);
    onOpenChange(false);
  };

  const handleSubmit = async (
    ajuste: ((e: AppEvent) => AppEvent) | null = null,
    aviso: { titulo: string; descricao: string } | null = null,
  ) => {
    if (travadoParaEla) return;
    if (!validate()) {
      // Quem apertou o botão estava no fim do formulário; o resumo fica no topo.
      // `?.scrollIntoView?.` porque nem todo ambiente tem o método — o jsdom
      // não tem, e uma rolagem que falha não pode derrubar o envio.
      document.getElementById('campo-title')?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      return;
    }

    ajusteRef.current = ajuste;
    avisoRef.current = aviso;
    const fullEvent = ajuste ? ajuste(getFullEvent()) : getFullEvent();

    const found = detectConflicts(fullEvent);
    if (found.length > 0 && !showConflictAlert) {
      setConflicts(found);
      setShowConflictAlert(true);
      return;
    }

    fullEvent.has_conflict = found.length > 0;
    await salvar(fullEvent, aviso);
  };

  const handleForceSubmit = async () => {
    const fullEvent = ajusteRef.current ? ajusteRef.current(getFullEvent()) : getFullEvent();
    fullEvent.has_conflict = true;
    await salvar(fullEvent, avisoRef.current);
  };

  /**
   * Aprovar = confirmar, com a visibilidade que o admin escolheu na tela,
   * assinando a revisão. A observação de uma devolução anterior é apagada:
   * o pedido foi atendido.
   */
  const aprovar = () =>
    handleSubmit(
      e => ({ ...e, status: 'confirmado', reviewed_at: new Date().toISOString(), reviewed_by: userName || 'Administração', review_note: null }),
      {
        titulo: 'Programação aprovada',
        descricao: `“${form.title?.trim()}” está confirmada${form.visibility === 'publico' ? ' e vai aparecer no site' : ''}.`,
      },
    );

  /**
   * Devolver = continua pendente, com a observação para a unidade ler no
   * topo do formulário dela. Não passa pela validação: o motivo de devolver
   * costuma ser justamente algo que falta.
   */
  const devolver = async () => {
    const nota = observacao.trim();
    if (!nota || !event) return;
    setDevolvendo(false);
    const evento: AppEvent = {
      ...getFullEvent(),
      status: 'pendente',
      visibility: 'interno',
      review_note: nota,
      reviewed_at: new Date().toISOString(),
      reviewed_by: userName || 'Administração',
    };
    await salvar(evento, {
      titulo: `Devolvido para ${eventUnitLabel(evento.unit)}`,
      descricao: 'A unidade vê a observação ao abrir o evento.',
    });
  };

  return (
    <Dialog open={open} onOpenChange={pedirParaFechar}>
      <DialogContent className={`max-h-[95vh] overflow-y-auto ${isAdmin ? 'sm:max-w-[95vw] lg:max-w-[90vw]' : 'sm:max-w-lg'}`}>
        <DialogHeader>
          <div className="flex justify-between items-center pr-8">
            <div className="flex flex-wrap items-center gap-2">
              <DialogTitle>{emRevisao ? 'Revisar programação' : isEditing ? 'Editar Evento' : 'Nova Programação'}</DialogTitle>
              {emRevisao && event && (
                <Badge variant="outline" className="border-warning/60 bg-warning/15 text-foreground text-[11px] font-medium">
                  Pendente · {eventUnitLabel(event.unit)} · {event.created_by}
                  {event.submitted_at && ` · enviado ${formatarData(new Date(event.submitted_at), "dd/MM 'às' HH:mm", { locale: ptBR })}`}
                </Badge>
              )}
            </div>
            {isAdmin && (
              <Badge variant="outline" className="text-primary border-primary/20 bg-primary/5 flex items-center gap-1.5 px-3 py-1">
                <Layout className="h-3.5 w-3.5" /> Modo Split (Admin)
              </Badge>
            )}
          </div>
        </DialogHeader>

        <div className={`grid gap-8 ${isAdmin ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
          {/* LADO ESQUERDO: FORMULÁRIO */}
          <div className="space-y-6">
            {showConflictAlert ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-4">
                  <div>
                    <p className="font-semibold text-foreground">Conflito de horário detectado!</p>
                    <p className="text-sm text-muted-foreground">Este evento conflita com {conflicts.length} evento(s):</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {conflicts.map(c => (
                    <div key={c.id} className="rounded-lg border border-border p-3">
                      <p className="font-medium text-foreground">{c.title}</p>
                      <p className="text-xs text-muted-foreground">{eventUnitLabel(c.unit)} · {new Date(c.start_datetime).toLocaleString('pt-BR')}</p>
                    </div>
                  ))}
                </div>
                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={() => setShowConflictAlert(false)}>Voltar e Corrigir</Button>
                  <Button onClick={handleForceSubmit} disabled={salvando}>
                    {salvando ? 'Salvando…' : enviaParaAprovacao && !isEditing ? 'Enviar mesmo assim' : 'Salvar Mesmo Assim'}
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              <div className="space-y-4">
                <ResumoDePendencias erros={errors} acao={acaoDoBotao} />

                {travadoParaEla && (
                  <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
                    <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <p className="text-xs text-amber-900">
                      <strong>Já confirmado pela administração geral.</strong> Para alterar, peça à administração —
                      ela pode devolver o evento para pendente.
                    </p>
                  </div>
                )}

                {event?.review_note && event.status !== 'confirmado' && (
                  <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <p className="text-xs text-amber-900">
                      <strong>Devolvido pela administração{event.reviewed_by ? ` (${event.reviewed_by})` : ''}:</strong>{' '}
                      {event.review_note}
                    </p>
                  </div>
                )}

                <div id="campo-title">
                  <Label className="text-sm font-semibold mb-1.5 block">Título *</Label>
                  <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Nome do evento" />
                  {errors.title && <p className="mt-1 text-xs text-destructive">{errors.title}</p>}
                  <Contador campo="title" valor={form.title} />
                </div>
                <div id="campo-description">
                  <Label className="text-sm font-semibold mb-1.5 block">Descrição</Label>
                  <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Descrição do evento" rows={2} />
                  {errors.description && <p className="mt-1 text-xs text-destructive">{errors.description}</p>}
                  <Contador campo="description" valor={form.description} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm font-semibold mb-1.5 block">Unidade *</Label>
                    <Select value={form.unit} onValueChange={v => setForm({ ...form, unit: v as Unit })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {UNITS.map(u => <SelectItem key={u} value={u}>{eventUnitLabel(u)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold mb-1.5 block">Tipo *</Label>
                    <Select value={form.event_type} onValueChange={v => setForm({ ...form, event_type: v as EventType })}>
                      {/* `capitalize` nos dois: sem ele no gatilho, a lista mostrava
                          "Evento Institucional" e o campo, depois de escolhido,
                          "evento institucional". O valor guardado é minúsculo nos dois. */}
                      <SelectTrigger className="capitalize"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {EVENT_TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative group" id="campo-start_datetime">
                    <Label className="text-sm font-semibold mb-1.5 block">Início *</Label>
                    <div className="relative">
                      <Input 
                        type="datetime-local" 
                        value={form.start_datetime} 
                        onChange={e => setForm({ ...form, start_datetime: e.target.value })}
                        className="pl-10 pr-4 h-11 border-border focus-visible:ring-primary/20 focus-visible:border-primary transition-all cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                      />
                      <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors pointer-events-none" />
                    </div>
                    {errors.start_datetime && <p className="mt-1 text-xs text-destructive">{errors.start_datetime}</p>}
                  </div>
                  <div className="relative group" id="campo-end_datetime">
                    <Label className="text-sm font-semibold mb-1.5 block">Término *</Label>
                    <div className="relative">
                      <Input 
                        type="datetime-local" 
                        value={form.end_datetime} 
                        onChange={e => setForm({ ...form, end_datetime: e.target.value })}
                        className="pl-10 pr-4 h-11 border-border focus-visible:ring-primary/20 focus-visible:border-primary transition-all cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                      />
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors pointer-events-none" />
                    </div>
                    {errors.end_datetime && <p className="mt-1 text-xs text-destructive">{errors.end_datetime}</p>}
                  </div>
                  {/* Quem edita de outro estado precisa saber em que relógio o
                      horário está. O fuso é o do computador de quem preenche. */}
                  <p className="col-span-2 -mt-1 text-[11px] text-muted-foreground">
                    Horários no fuso deste computador ({rotuloDoFuso()}).
                  </p>
                </div>
                <div id="campo-location">
                  <Label className="text-sm font-semibold mb-1.5 block">Localização *</Label>
                  <Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="Local do evento" />
                  {errors.location && <p className="mt-1 text-xs text-destructive">{errors.location}</p>}
                  <Contador campo="location" valor={form.location} />
                </div>

                {/* `isMarketing` é "admin geral ou comunicação". Com `isAdmin`, quem
                    cuida da comunicação e não é admin não via este bloco. */}
                {emRevisao && (
                  <p className="text-xs text-muted-foreground">
                    Preenchido pela unidade. Os blocos destacados são da administração geral.
                  </p>
                )}

                {isMarketing && (
                  <div className={emRevisao ? 'space-y-4 rounded-xl border-2 border-primary/50 bg-primary/5 p-3' : 'space-y-4 border-t pt-4'}>
                    <Label className="flex items-center gap-2 text-sm font-semibold text-primary">
                      <Globe className="h-4 w-4" /> Configurações de Compartilhamento (Público)
                    </Label>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Label htmlFor="slug" className="text-xs font-medium block">Link personalizado (Slug)</Label>
                        {slugMode === 'auto' ? (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Automático</Badge>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setSlugMode('auto');
                              setForm(prev => ({ ...prev, slug: generateUniqueSlug(prev.title || '') }));
                            }}
                            className="text-[10px] text-primary hover:underline"
                          >
                            Personalizado · Usar título
                          </button>
                        )}
                      </div>
                      {/* O prefixo é o endereço que abre de verdade (era
                          `anabrasil.com/eventos/`, que responde 404). */}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{prefixoDoLinkPublico()}</span>
                        <Input
                          id="slug"
                          value={form.slug ?? ''}
                          onChange={e => {
                            setSlugMode('custom');
                            setForm({ ...form, slug: slugify(e.target.value) });
                          }}
                          placeholder="meu-evento-especial"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 shrink-0"
                          disabled={!form.slug}
                          onClick={() => {
                            navigator.clipboard?.writeText(linkPublicoDoEvento(form.slug || ''));
                            toast.success('Link copiado', { description: linkPublicoDoEvento(form.slug || '') });
                          }}
                        >
                          Copiar
                        </Button>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">Gerado do título; só letras, números e hífen. Edite para personalizar.</p>
                    </div>
                  </div>
                )}

                <div>
                  <Label className="text-sm font-semibold mb-1.5 block">Status</Label>
                  <Select value={form.status} onValueChange={v => setForm({ ...form, status: v as EventStatus })}>
                    <SelectTrigger className="capitalize"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {statusDisponiveis.map(s => (
                        <SelectItem key={s} value={s} className="capitalize">
                          <span className="flex items-center gap-2">
                            <span className={`h-2.5 w-2.5 rounded-full ${getStatusDotClass(s)}`} />
                            {s}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.status === 'concluido' && (
                    <p className="text-[11px] text-muted-foreground mt-1 italic">
                      Este evento será mantido no histórico como concluído.
                    </p>
                  )}
                  {enviaParaAprovacao && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      A administração geral confirma ao aprovar.
                    </p>
                  )}
                </div>
                {/* Publicar no site é decisão da administração geral e da comunicação.
                    Para os demais o bloco não aparece, e o evento fica interno — que
                    já é o padrão de um evento novo. */}
                {isMarketing && (
                <div className={emRevisao ? 'rounded-xl border-2 border-primary/50 bg-primary/5 p-3' : undefined}>
                  <div className="flex items-center gap-2 mb-3">
                    <Label className="text-sm font-semibold">Onde este evento deve aparecer?</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs text-xs">Eventos públicos ficam visíveis para visitantes sem login na página pública de eventos. Eventos internos aparecem apenas para a equipe no calendário restrito.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 mt-1">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, visibility: 'interno' })}
                      className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                        form.visibility === 'interno' 
                          ? 'border-primary bg-primary/5 text-primary shadow-sm' 
                          : 'border-border bg-card text-muted-foreground hover:border-muted-foreground/30'
                      }`}
                    >
                      <Lock className={`h-6 w-6 mb-2 ${form.visibility === 'interno' ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className="text-sm font-bold">Privado / Interno</span>
                      <span className="text-[11px] opacity-70">Apenas para equipe</span>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, visibility: 'publico' })}
                      className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                        form.visibility === 'publico' 
                          ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm' 
                          : 'border-border bg-card text-muted-foreground hover:border-muted-foreground/30'
                      }`}
                    >
                      <Globe className={`h-6 w-6 mb-2 ${form.visibility === 'publico' ? 'text-blue-500' : 'text-muted-foreground'}`} />
                      <span className="text-sm font-bold">Público / Site</span>
                      <span className="text-[11px] opacity-70">Visível para todos</span>
                    </button>
                  </div>

                  {/* A página pública mostra só evento confirmado. Sem este aviso, a
                      pessoa marca "Visível para todos", cumpre o checklist inteiro e o
                      evento nunca aparece — sem nada explicando por quê. */}
                  {form.visibility === 'publico' && form.status !== 'confirmado' && (
                    <div className="mt-3 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                      <div className="space-y-2">
                        <p className="text-xs text-amber-900">
                          <strong>Ainda não vai aparecer no site.</strong> A página pública mostra só
                          eventos confirmados, e este está como {form.status}.
                        </p>
                        <Button
                          type="button"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setForm({ ...form, status: 'confirmado' })}
                        >
                          Marcar como confirmado
                        </Button>
                      </div>
                    </div>
                  )}

                  {form.visibility === 'publico' && form.status === 'confirmado' && (
                    <p className="mt-3 flex items-center gap-2 text-xs text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Vai aparecer no site assim que for salvo.
                    </p>
                  )}
                </div>
                )}

                {isMarketing && form.visibility === 'publico' && (
                  <div className="space-y-6 rounded-2xl border-2 border-blue-200 p-5 bg-blue-50/30">
                    <div className="flex justify-between items-center border-b border-blue-100 pb-3">
                      <div className="flex items-center gap-2">
                        <Share2 className="h-4 w-4 text-blue-600" />
                        <Label className="text-sm font-semibold text-blue-800 uppercase tracking-wider">Checklist de publicação</Label>
                      </div>

                    </div>
                    
                    <div className="flex items-center justify-between gap-3 p-2 bg-primary/5 rounded-md border border-primary/10">
                      <div className="flex flex-col">
                        <Label htmlFor="show_in_banner" className="text-sm font-semibold text-foreground">Exibir no banner superior</Label>
                        <p className="text-[11px] text-muted-foreground">Destacar no carrossel da página pública.</p>
                      </div>
                      <Switch
                        id="show_in_banner"
                        checked={form.show_in_banner || false}
                        onCheckedChange={v => setForm({ ...form, show_in_banner: v })}
                      />
                    </div>

                    {/* Antes passava em silêncio: o carrossel mostrava um bloco só de
                        cor. A ordem de fallback é a mesma do preview ao lado. */}
                    {form.show_in_banner && !form.banner_image_desktop && !form.banner_url_desktop && !form.banner_url_mobile && (
                      <div className="flex items-start gap-3 rounded-lg border border-dashed border-amber-300 bg-amber-50 p-3">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                        <p className="text-xs text-amber-900">
                          <strong>“Exibir no banner” ligado sem imagem.</strong> O carrossel vai usar só a cor do card.
                          Envie ao menos o Banner Desktop (21:9) abaixo.
                        </p>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-3 p-2 bg-muted rounded-md border border-border">
                      <div className="flex flex-col">
                        <Label htmlFor="use_logo_as_title" className="text-sm font-semibold text-foreground">Usar logo como título</Label>
                        <p className="text-[11px] text-muted-foreground">Estilo streaming: substitui o texto por uma imagem da logo.</p>
                      </div>
                      <Switch
                        id="use_logo_as_title"
                        checked={form.use_logo_as_title || false}
                        onCheckedChange={v => setForm({ ...form, use_logo_as_title: v })}
                      />
                    </div>

                    <div className="flex items-center justify-between gap-3 p-2 bg-muted rounded-md border border-border">
                      <div className="flex flex-col">
                        <Label htmlFor="show_banner_overlay" className="text-sm font-semibold text-foreground">Cortina de opacidade</Label>
                        <p className="text-[11px] text-muted-foreground">Escurece levemente a imagem para destacar o texto.</p>
                      </div>
                      <Switch
                        id="show_banner_overlay"
                        checked={form.show_banner_overlay !== undefined ? form.show_banner_overlay : true}
                        onCheckedChange={v => setForm({ ...form, show_banner_overlay: v })}
                      />
                    </div>

                    <div className="flex items-center justify-between gap-3 p-2 bg-muted rounded-md border border-border">
                      <div className="flex flex-col">
                        <Label htmlFor="show_banner_fade" className="text-sm font-semibold text-foreground">Efeito de sombreamento (Fade)</Label>
                        <p className="text-[11px] text-muted-foreground">Adiciona um degradê na base do banner para melhorar a leitura.</p>
                      </div>
                      <Switch
                        id="show_banner_fade"
                        checked={form.show_banner_fade !== undefined ? form.show_banner_fade : true}
                        onCheckedChange={v => setForm({ ...form, show_banner_fade: v })}
                      />
                    </div>

                    <div className="flex items-center justify-between gap-3 p-2 bg-muted rounded-md border border-border">
                      <div className="flex flex-col">
                        <Label htmlFor="full_height_title" className="text-sm font-semibold text-foreground">Ocupar toda a altura</Label>
                        <p className="text-[11px] text-muted-foreground">O título ou logo cresce para preencher o banner (estilo cinema).</p>
                      </div>
                      <Switch
                        id="full_height_title"
                        checked={form.full_height_title || false}
                        onCheckedChange={v => setForm({ ...form, full_height_title: v })}
                      />
                    </div>

                    <div className="flex flex-col gap-2 p-2 bg-muted rounded-md border border-border">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="banner_display_time" className="text-sm font-semibold text-foreground">Tempo de exibição</Label>
                        <Badge variant="secondary" className="text-[11px] font-mono">{form.banner_display_time || 5}s</Badge>
                      </div>
                      <input 
                        type="range"
                        id="banner_display_time"
                        min="3"
                        max="30"
                        step="1"
                        value={form.banner_display_time || 5}
                        onChange={(e) => setForm({ ...form, banner_display_time: parseInt(e.target.value) })}                        className="w-full h-1.5 bg-muted-foreground/20 rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                      
                    </div>

                    {form.use_logo_as_title && (
                      <div className="p-3 bg-card rounded-lg border border-dashed border-border">
                        <FileUpload 
                          label="Logo/ID Visual do Evento"
                          mode="single"
                          url={form.event_logo_url}
                          onChange={(url) => setForm({ ...form, event_logo_url: url })}
                        />
                        <p className="text-[10px] text-muted-foreground mt-1 italic text-center">Recomendado: PNG com fundo transparente.</p>
                      </div>
                    )}
                    
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <FileUpload 
                            label="Capa Desktop (16:9)"
                            mode="single"
                            url={form.banner_url_desktop}
                            onChange={(url) => setForm({ ...form, banner_url_desktop: url })}
                          />
                        </div>
                        <div>
                          <FileUpload 
                            label="Capa Mobile (4:3)"
                            mode="single"
                            url={form.banner_url_mobile}
                            onChange={(url) => setForm({ ...form, banner_url_mobile: url })}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-4">
                        <div>
                          <FileUpload 
                            label="Banner Desktop (21:9)"
                            mode="single"
                            url={form.banner_image_desktop}
                            onChange={(url) => setForm({ ...form, banner_image_desktop: url })}
                          />
                        </div>
                        <div>
                          <FileUpload 
                            label="Banner Mobile (9:16)"
                            mode="single"
                            url={form.banner_image_mobile}
                            onChange={(url) => setForm({ ...form, banner_image_mobile: url })}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="pt-2">
                      <Label className="text-xs mb-2 block">Cor do Card</Label>
                      <div className="flex flex-wrap gap-2">
                        {SYSTEM_COLORS.map(color => (
                          <button
                            key={color}
                            type="button"
                            className={`h-6 w-6 rounded-full border border-white/20 transition-transform ${form.custom_color === color ? 'scale-125 ring-2 ring-primary ring-offset-2 ring-offset-background' : 'hover:scale-110'}`}
                            style={{ backgroundColor: color }}
                            onClick={() => setForm({ ...form, custom_color: color })}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="space-y-6 pt-4 border-t">
                  <Label className="text-sm font-semibold mb-1.5 block">Detalhes logísticos e público-alvo</Label>
                  
                  <div className="space-y-4">
                    <GrupoDeOpcoes
                      id="publico"
                      titulo="Público-alvo *"
                      opcoes={["Os funcionários", "Os atendidos", "Os atendidos e suas famílias", "Será aberto para a comunidade"]}
                      valor={form.target_audience || ''}
                      onChange={v => setForm({ ...form, target_audience: v })}
                      rotuloOutro="Outro público"
                      pistaOutro="Qual público?"
                      outroAberto={!!outroAberto.publico}
                      onOutroAberto={a => setOutroAberto(prev => ({ ...prev, publico: a }))}
                      erro={errors.target_audience}
                    />

                    <GrupoDeOpcoes
                      id="apoio"
                      titulo="Equipe de apoio (Auxílio) *"
                      opcoes={["Funcionários", "Voluntários"]}
                      valor={form.support_team || ''}
                      onChange={v => setForm({ ...form, support_team: v })}
                      rotuloOutro="Outra equipe"
                      pistaOutro="Especifique a equipe..."
                      outroAberto={!!outroAberto.apoio}
                      onOutroAberto={a => setOutroAberto(prev => ({ ...prev, apoio: a }))}
                      erro={errors.support_team}
                    />

                    <div>
                      <GrupoDeOpcoes
                        id="comida"
                        titulo="Logística de alimentação *"
                        opcoes={["Almoço", "Coffee Break", "Lanche", "Jantar", "Nenhum"]}
                        valor={form.food_logistics || ''}
                        onChange={v => setForm({ ...form, food_logistics: v })}
                        rotuloOutro="Outra logística"
                        pistaOutro="Especifique a alimentação..."
                        temNenhum
                        outroAberto={!!outroAberto.comida}
                        onOutroAberto={a => setOutroAberto(prev => ({ ...prev, comida: a }))}
                        erro={errors.food_logistics}
                      />
                      {/* Espaço livre para o que as opções não cabem: quantas pessoas,
                          restrição alimentar, horário. Coluna própria, e não grudado
                          em `food_logistics` — misturar escolha com texto livre foi o
                          que tornou o `notes` ilegível. */}
                      <Label htmlFor="food_details" className="text-xs font-medium mt-3 mb-1 block text-muted-foreground">
                        Mais detalhes da alimentação (opcional)
                      </Label>
                      <Textarea
                        id="food_details"
                        rows={2}
                        value={form.food_details || ''}
                        onChange={e => setForm({ ...form, food_details: e.target.value })}
                        placeholder="Quantas pessoas, restrição alimentar, horário…"
                      />
                    </div>

                    <GrupoDeOpcoes
                      id="equip"
                      titulo="Equipamentos necessários *"
                      opcoes={["Som", "Microfone", "Projetor", "Televisão", "Notebook", "Nenhum"]}
                      valor={form.equipment_needed || ''}
                      onChange={v => setForm({ ...form, equipment_needed: v })}
                      rotuloOutro="Outro equipamento"
                      pistaOutro="Especifique os equipamentos..."
                      temNenhum
                      outroAberto={!!outroAberto.equip}
                      onOutroAberto={a => setOutroAberto(prev => ({ ...prev, equip: a }))}
                      erro={errors.equipment_needed}
                    />
                  </div>
                </div>

                <div className="space-y-3" id="campo-transporte">
                  <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                    <Switch
                      id="transport_needed"
                      checked={form.transport_needed || false}
                      onCheckedChange={v => setForm({ ...form, transport_needed: v })}
                    />
                    <Label htmlFor="transport_needed" className="cursor-pointer flex-1 text-sm font-semibold flex items-center gap-2">
                      <Truck className="h-4 w-4" /> Logística de Transporte
                    </Label>
                  </div>

                  {form.transport_needed && (() => {
                    // A conta mora em `transporte.ts`, a mesma que os painéis
                    // de detalhe usam. Aqui só se desenha.
                    const r = resumoDoTransporte(form)!;
                    const apoio = motivoDoApoio(r);
                    return (
                      <div className="rounded-lg border border-amber-100 bg-amber-50/30 p-4 space-y-4 animate-in fade-in slide-in-from-top-1">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <Label className="text-xs font-medium mb-1 block">Veículo *</Label>
                            <Select
                              value={form.transport_vehicle || ''}
                              onValueChange={v => setForm({ ...form, transport_vehicle: v as TransportVehicle })}
                            >
                              <SelectTrigger className={errors.transport_vehicle ? 'border-destructive' : undefined}>
                                <SelectValue placeholder="Selecione o veículo" />
                              </SelectTrigger>
                              <SelectContent>
                                {TRANSPORT_VEHICLES.map(v => (
                                  <SelectItem key={v.value} value={v.value}>{v.label} — {v.capacity} assentos</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {errors.transport_vehicle && <p className="mt-1 text-xs text-destructive">{errors.transport_vehicle}</p>}
                          </div>
                          <div>
                            <Label htmlFor="transport_passengers" className="text-xs font-medium mb-1 block">Passageiros previstos *</Label>
                            <Input
                              id="transport_passengers"
                              type="number"
                              min={0}
                              value={form.transport_passengers ?? 0}
                              onChange={e => setForm({ ...form, transport_passengers: Math.max(0, Number(e.target.value) || 0) })}
                              className={errors.transport_passengers ? 'border-destructive' : undefined}
                            />
                            {errors.transport_passengers && <p className="mt-1 text-xs text-destructive">{errors.transport_passengers}</p>}
                          </div>
                        </div>

                        <p className="text-[11px] text-muted-foreground">Capacidade já inclui o motorista.</p>

                        {r.vagaMarketing > 0 && (
                          <div className="px-3 py-2 bg-amber-50/60 rounded-md border border-dashed border-amber-300">
                            <p className="text-[11px] text-amber-700 flex items-center gap-1.5 font-medium">
                              <CheckCircle2 className="h-3 w-3" /> 1 vaga do marketing está sendo contabilizada na logística de transporte
                            </p>
                          </div>
                        )}

                        {r.capacidade > 0 && (
                          <p className="text-xs text-foreground">
                            Ocupação: <span className="font-semibold">{r.ocupados}</span> / {r.capacidade} assentos
                            {r.vagaMarketing > 0 && <span className="text-muted-foreground"> (inclui 1 do marketing)</span>}
                          </p>
                        )}

                        {/* Gravado em `transport_extra_equipment` — antes era só
                            estado da tela e sumia ao salvar. */}
                        <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-sm">
                          <Switch
                            id="transport_extra_equipment"
                            checked={!!form.transport_extra_equipment}
                            onCheckedChange={v => setForm({ ...form, transport_extra_equipment: !!v })}
                          />
                          <Label htmlFor="transport_extra_equipment" className="cursor-pointer flex-1 text-sm font-medium">
                            Leva equipamentos/materiais volumosos
                          </Label>
                        </div>

                        {apoio && (
                          <div className="px-3 py-2 bg-destructive/10 rounded-md border border-dashed border-destructive/40 animate-in fade-in zoom-in-95 duration-200">
                            <p className="text-[11px] text-destructive flex items-center gap-1.5 font-medium">
                              <AlertTriangle className="h-3 w-3" /> {apoio}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>



                <div className="space-y-4 pt-4 border-t">
                  <Label className="text-sm font-semibold mb-1.5 block">Observações internas</Label>
                  <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Notas internas gerais..." rows={2} />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3 rounded-lg border border-border p-3" id="campo-marketing">
                    <Switch
                      id="marketing_request"
                      checked={form.marketing_request || false}
                      onCheckedChange={v => setForm({ ...form, marketing_request: v })}
                    />
                    <Label htmlFor="marketing_request" className="cursor-pointer flex-1 text-sm font-semibold">Solicitação de Marketing</Label>
                  </div>

                  {form.marketing_request && (
                    <div className="rounded-lg border border-blue-100 bg-blue-50/30 p-4 space-y-4 animate-in fade-in slide-in-from-top-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-semibold text-blue-900">Itens de marketing *</Label>
                        <Badge variant="outline" className="text-[11px] bg-blue-100 text-blue-700 border-blue-200 uppercase font-bold tracking-tight">Briefing / Materiais</Badge>
                      </div>
                      
                      <div className="space-y-4">
                        <div className="space-y-3">
                          <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-sm">
                            <Switch
                              id="marketing_cobertura"
                              checked={form.marketing_coverage || false}
                              onCheckedChange={v => setForm({ ...form, marketing_coverage: v })}
                            />
                            <Label htmlFor="marketing_cobertura" className="cursor-pointer flex-1 text-sm font-medium text-blue-900">Solicitar Cobertura do Evento</Label>
                          </div>
                          
                          {form.marketing_coverage && (
                            <div className="space-y-2 animate-in fade-in zoom-in-95 duration-200">
                              <div className="px-3 py-2 bg-blue-50/50 rounded-md border border-dashed border-blue-200">
                                <p className="text-[11px] text-blue-600 flex items-center gap-1.5 font-medium">
                                  <CheckCircle2 className="h-3 w-3" /> Cobertura fotográfica e/ou vídeo solicitada
                                </p>
                              </div>
                              <div className="px-3 py-2 bg-amber-50/60 rounded-md border border-dashed border-amber-300">
                                <p className="text-[11px] text-amber-700 flex items-center gap-1.5 font-medium">
                                  <CheckCircle2 className="h-3 w-3" /> 1 vaga do marketing está sendo contabilizada na logística de transporte
                                </p>
                              </div>
                            </div>
                          )}

                          <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-sm">
                            <Switch
                              id="marketing_grafica"
                              checked={(form.marketing_items || []).some(i => i.type === 'demanda_grafica')}
                              onCheckedChange={v => {
                                const current = form.marketing_items || [];
                                if (v) {
                                  setForm({ ...form, marketing_items: [...current, { type: 'demanda_grafica', item: '', description: '' }] });
                                } else {
                                  setForm({ ...form, marketing_items: current.filter(i => i.type !== 'demanda_grafica') });
                                }
                              }}
                            />
                            <Label htmlFor="marketing_grafica" className="cursor-pointer flex-1 text-sm font-medium text-blue-900">Demanda Gráfica (Arte/Impressão)</Label>
                          </div>

                          {(form.marketing_items || []).filter(i => i.type === 'demanda_grafica').map((item, idx) => {
                            const originalIdx = (form.marketing_items || []).findIndex(mi => mi === item);
                            return (
                              <div key={`grafica-${idx}`} className="space-y-2 p-3 bg-card rounded-md border border-border shadow-sm animate-in fade-in slide-in-from-top-1">
                                <div className="flex items-center gap-2">
                                  <Input 
                                    value={item.item} 
                                    onChange={e => {
                                      const updated = [...(form.marketing_items || [])];
                                      updated[originalIdx] = { ...updated[originalIdx], item: e.target.value };
                                      setForm({ ...form, marketing_items: updated });
                                    }} 
                                    placeholder="Ex: Card Instagram, Banner..." 
                                    className="flex-1 bg-background border-border focus-visible:ring-ring h-8 text-sm"
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="shrink-0 h-8 w-8 text-blue-400 hover:text-blue-600 hover:bg-blue-50"
                                    onClick={() => {
                                      const updated = (form.marketing_items || []).filter((_, i) => i !== originalIdx);
                                      setForm({ ...form, marketing_items: updated });
                                    }}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                                <Textarea 
                                  value={item.description} 
                                  onChange={e => {
                                    const updated = [...(form.marketing_items || [])];
                                    updated[originalIdx] = { ...updated[originalIdx], description: e.target.value };
                                    setForm({ ...form, marketing_items: updated });
                                  }} 
                                  placeholder="Detalhes: formato, arte, impressão..." 
                                  rows={2}
                                  className="bg-muted/50 border-blue-100 focus-visible:ring-blue-500 text-xs"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="w-full h-7 text-[10px] text-blue-600 hover:bg-blue-50 gap-1"
                                  onClick={() => setForm({ 
                                    ...form, 
                                    marketing_items: [...(form.marketing_items || []), { type: 'demanda_grafica', item: '', description: '' }] 
                                  })}
                                >
                                  <Plus className="h-3 w-3" /> Adicionar mais um item gráfico
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                        {errors.marketing_items && <p className="mt-1 text-xs text-destructive">{errors.marketing_items}</p>}

                        {/* A coluna existia e o detalhe a exibia ("Materiais
                            Impressos"), mas não havia onde escrever: o único
                            valor entrou por migração. Aqui, junto do pedido de
                            marketing, é onde a pessoa diz o que já está pronto. */}
                        <div className="pt-2 border-t border-blue-100">
                          <Label htmlFor="printed_materials" className="text-xs font-medium mb-1 block text-blue-900">
                            Materiais impressos já existentes <span className="font-normal text-muted-foreground">(opcional)</span>
                          </Label>
                          <Input
                            id="printed_materials"
                            value={form.printed_materials || ''}
                            onChange={e => setForm({ ...form, printed_materials: e.target.value })}
                            placeholder="Link ou descrição: cartaz, folder, lista de presença…"
                            className="bg-background h-9 text-sm"
                          />
                          <p className="text-[11px] text-muted-foreground mt-1">O que já está pronto, para o marketing não refazer.</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <Switch
                    id="partner_involved"
                    checked={form.partner_involved || false}
                    onCheckedChange={v => setForm({ ...form, partner_involved: v, ...(!v ? { partner_type: '', partner_name: '', partners: [] } : {}) })}
                  />
                  <Label htmlFor="partner_involved" className="cursor-pointer flex-1 text-sm font-semibold">Parceiro envolvido</Label>
                </div>

                {form.partner_involved && (
                  <div className={`space-y-2 rounded-lg border p-3 ${errors.partners ? 'border-destructive/60' : 'border-border'}`} id="campo-parceiros">
                    <Label className="text-sm font-medium">Parceiros</Label>
                    {(form.partners || []).map((partner, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Select
                          value={partner.type || ''}
                          onValueChange={v => {
                            const updated = [...(form.partners || [])];
                            updated[idx] = { ...updated[idx], type: v as PartnerType };
                            setForm({ ...form, partners: updated });
                          }}
                        >
                          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Tipo..." /></SelectTrigger>
                          <SelectContent>
                            {PARTNER_TYPES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Input
                          value={partner.name}
                          onChange={e => {
                            const updated = [...(form.partners || [])];
                            updated[idx] = { ...updated[idx], name: e.target.value };
                            setForm({ ...form, partners: updated });
                          }}
                          placeholder="Nome do parceiro"
                          className={`flex-1 ${errors.partners && !partner.name.trim() ? 'border-destructive' : ''}`}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0 h-8 w-8"
                          onClick={() => {
                            const updated = (form.partners || []).filter((_, i) => i !== idx);
                            setForm({ ...form, partners: updated });
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => setForm({ ...form, partners: [...(form.partners || []), { type: '' as PartnerType, name: '' }] })}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Adicionar Parceiro
                    </Button>
                    {errors.partners && <p className="text-xs text-destructive">{errors.partners}</p>}
                  </div>
                )}

                <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <Switch
                    id="unit_collaboration"
                    checked={form.has_unit_collaboration || false}
                    onCheckedChange={v => setForm({ ...form, has_unit_collaboration: v, ...(!v ? { collaborating_units: [], external_collaborators: [] } : {}) })}
                  />
                  <Label htmlFor="unit_collaboration" className="cursor-pointer flex-1 text-sm font-semibold">Parceria com unidade ou instituição</Label>
                </div>

                {form.has_unit_collaboration && (
                  <div className={`space-y-3 rounded-lg border p-3 ${errors.external_collaborators ? 'border-destructive/60' : 'border-border'}`} id="campo-parceria">
                    <div>
                      <Label className="text-sm font-semibold mb-2 block">Unidades parceiras</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {UNITS.filter(u => u !== form.unit).map(u => (
                          <label key={u} className="flex items-center gap-1.5 text-sm cursor-pointer">
                            <Checkbox
                              checked={(form.collaborating_units || []).includes(u)}
                              onCheckedChange={(checked) => {
                                const current = form.collaborating_units || [];
                                setForm({
                                  ...form,
                                  collaborating_units: checked
                                    ? [...current, u]
                                    : current.filter(cu => cu !== u),
                                });
                              }}
                            />
                            {eventUnitLabel(u)}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-semibold mb-2 block">Instituições externas</Label>
                      <div className="space-y-2 mt-2">
                        {(form.external_collaborators || []).map((ext, idx) => (
                          <div key={idx} className="space-y-2 p-3 bg-muted/30 rounded-md border border-border">
                            <div className="flex items-center gap-2">
                              <Input
                                value={typeof ext === 'string' ? ext : (ext as any).name}
                                onChange={e => {
                                  const updated = [...(form.external_collaborators || [])];
                                  if (typeof ext === 'string') {
                                    updated[idx] = { name: e.target.value, details: '' };
                                  } else {
                                    updated[idx] = { ...(ext as any), name: e.target.value };
                                  }
                                  setForm({ ...form, external_collaborators: updated });
                                }}
                                placeholder="Nome da instituição"
                                className={`flex-1 h-8 text-sm ${errors.external_collaborators && !(typeof ext === 'string' ? ext : ext.name).trim() ? 'border-destructive' : ''}`}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="shrink-0 h-8 w-8"
                                onClick={() => {
                                  const updated = (form.external_collaborators || []).filter((_, i) => i !== idx);
                                  setForm({ ...form, external_collaborators: updated });
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                            <Input
                              value={typeof ext === 'string' ? '' : (ext as any).details}
                              onChange={e => {
                                const updated = [...(form.external_collaborators || [])];
                                if (typeof ext === 'string') {
                                  updated[idx] = { name: ext, details: e.target.value };
                                } else {
                                  updated[idx] = { ...(ext as any), details: e.target.value };
                                }
                                setForm({ ...form, external_collaborators: updated });
                              }}
                              placeholder="Tipo de parceria / Detalhes..."
                              className="h-8 text-xs bg-background/50"
                            />
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full gap-1 border-dashed"
                          onClick={() => setForm({ 
                            ...form, 
                            external_collaborators: [...(form.external_collaborators || []), { name: '', details: '' }] 
                          })}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Adicionar Instituição
                        </Button>
                      </div>
                    </div>
                    {errors.external_collaborators && <p className="text-xs text-destructive">{errors.external_collaborators}</p>}
                  </div>
                )}

                {/* Um rótulo só: o de dentro. Antes "Anexos" aparecia duas vezes. */}
                <div className="rounded-lg border border-border p-3">
                  <FileUpload
                    mode="multiple"
                    attachments={form.attachments || []}
                    onChange={(lista) => setForm({ ...form, attachments: lista as AppEvent['attachments'] })}
                  />
                </div>
              </div>
            )}
            
            {!showConflictAlert && enviaParaAprovacao && !isEditing && (
              <div className="flex items-start gap-3 rounded-lg border border-dashed border-blue-200 bg-blue-50/60 p-3">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                <p className="text-xs text-blue-900">
                  Vai para a administração geral, que define o link e onde o evento aparece, e confirma.
                </p>
              </div>
            )}

            {!showConflictAlert && emRevisao && (
              <DialogFooter className="sticky bottom-0 bg-background pt-4 pb-2 gap-2">
                <Button variant="outline" onClick={() => pedirParaFechar(false)}>Cancelar</Button>
                <Button variant="outline" onClick={() => setDevolvendo(true)} disabled={salvando}>
                  Devolver com observação
                </Button>
                <Button onClick={() => aprovar()} disabled={salvando}>
                  {salvando ? 'Salvando…' : 'Aprovar e confirmar'}
                  {pendencias > 0 && ` (${pendencias} ${pendencias === 1 ? 'pendência' : 'pendências'})`}
                </Button>
              </DialogFooter>
            )}

            {!showConflictAlert && !emRevisao && (
              <DialogFooter className="sticky bottom-0 bg-background pt-4 pb-2">
                <Button variant="outline" onClick={() => pedirParaFechar(false)}>Cancelar</Button>
                {/* A contagem no botão é o que responde "por que não salvou?"
                    sem obrigar a pessoa a caçar campo pela tela. */}
                <Button onClick={() => handleSubmit()} disabled={salvando || travadoParaEla}>
                  {salvando
                    ? 'Salvando…'
                    : isEditing
                      ? 'Salvar Alterações'
                      : enviaParaAprovacao
                        ? 'Enviar para aprovação'
                        : 'Criar Programação'}
                  {pendencias > 0 && ` (${pendencias} ${pendencias === 1 ? 'pendência' : 'pendências'})`}
                </Button>
              </DialogFooter>
            )}
          </div>

          {/* LADO DIREITO: PREVIEW (Admin Only) */}
          {isAdmin && (
            <div className="hidden lg:block border-l pl-8 space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Preview público (Banner)</Label>
                <Badge variant="outline" className="text-[10px] text-amber-600 bg-amber-50">Exclusivo Banner</Badge>
              </div>
              <div className="rounded-2xl border bg-muted/50 overflow-hidden shadow-inner h-full flex flex-col">
                <div className="bg-white border-b px-4 py-2 flex items-center justify-between">
                  <div className="flex gap-1">
                    <div className="h-2 w-2 rounded-full bg-red-400" />
                    <div className="h-2 w-2 rounded-full bg-amber-400" />
                    <div className="h-2 w-2 rounded-full bg-emerald-400" />
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono">
                    {prefixoDoLinkPublico()}{form.slug || 'preview'}
                  </div>
                </div>
                <div className="p-0 overflow-y-auto max-h-[75vh] flex-1">
                  <div className="bg-white h-full">
                    {/* Visualização de Slide do Banner */}
                    <div className={`relative ${(!form.banner_image_desktop && !form.banner_url_desktop && !form.banner_url_mobile) ? 'aspect-[21/12]' : 'aspect-[21/9]'} bg-slate-900 overflow-hidden`}>
                      {form.show_banner_overlay !== false && (
                        <div className="absolute inset-0 z-[5] bg-slate-950/40" />
                      )}
                      
                      {form.show_banner_fade !== false && (
                        <div className="absolute inset-0 z-[10] bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
                      )}
                      
                      {(form.banner_image_desktop || form.banner_url_desktop || form.banner_url_mobile) ? (
                        <img 
                          src={form.banner_image_desktop || form.banner_url_desktop || form.banner_url_mobile} 
                          alt="Preview"
                          className="w-full h-full object-cover opacity-80"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-start p-6" style={{ backgroundColor: form.custom_color || '#1e293b' }}>
                          <Layout className="h-10 w-10 text-white/20" />
                        </div>
                      )}

                      <div className="absolute bottom-0 left-0 right-0 p-4 z-[20] flex flex-col items-start justify-end h-full">
                        <Badge className="bg-primary/80 text-white mb-2 text-[10px] border-none backdrop-blur-sm shrink-0">{form.unit ? eventUnitLabel(form.unit) : 'UNIDADE'}</Badge>
                        
                        {form.use_logo_as_title && form.event_logo_url ? (
                          <div className={`flex items-center justify-start ${form.full_height_title ? 'h-1/2 w-full mb-2' : 'h-12 w-full mb-1'}`}>
                            <img 
                              src={form.event_logo_url} 
                              alt="Logo Preview" 
                              className={`object-contain object-left h-full max-w-full filter drop-shadow-md`} 
                            />
                          </div>
                        ) : (
                          <h3 
                            className={`font-bold text-white drop-shadow-xl line-clamp-3 ${form.full_height_title ? 'text-3xl md:text-5xl' : 'text-xl'}`}
                          >
                            <TituloDoEvento texto={form.title || 'Título do Evento'} />
                          </h3>
                        )}
                        
                        <div className="flex items-center gap-2 text-[10px] text-white/80 mt-2">
                          <CalendarDays className="h-3 w-3" />
                          <span>{form.start_datetime ? new Date(form.start_datetime).toLocaleDateString('pt-BR') : 'Data'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-6 border-t bg-muted/50/50">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-tighter">Detalhes do evento (Card/Modal)</span>
                      </div>
                      <h4 className="text-sm font-bold text-foreground mb-1">{form.title || 'Título do evento'}</h4>
                      <p className="text-[11px] text-muted-foreground line-clamp-3 leading-relaxed">{form.description || 'Sem descrição.'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>

      <AlertDialog open={confirmarSaida} onOpenChange={setConfirmarSaida}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isEditing ? 'Descartar as alterações?' : 'Descartar esta programação?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                const n = camposMexidos();
                const titulo = form.title?.trim();
                const oque = titulo ? ` de “${titulo}”` : '';
                return isEditing
                  ? `Você alterou ${n} ${n === 1 ? 'campo' : 'campos'}${oque}. Se sair agora, o evento fica como estava.`
                  : `Você preencheu ${n} ${n === 1 ? 'campo' : 'campos'}${oque}. Se sair agora, isso se perde.`;
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction onClick={descartar} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={devolvendo} onOpenChange={setDevolvendo}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Devolver para {event ? eventUnitLabel(event.unit) : 'a unidade'}</AlertDialogTitle>
            <AlertDialogDescription>
              O evento continua pendente. Quem enviou vê esta observação ao abrir o formulário.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            autoFocus
            rows={3}
            value={observacao}
            onChange={e => setObservacao(e.target.value)}
            placeholder="O que falta ou precisa mudar…"
            aria-label="Observação da devolução"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={devolver} disabled={!observacao.trim() || salvando}>
              Devolver
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showSlugPrompt} onOpenChange={setShowSlugPrompt}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slug personalizado detectado</AlertDialogTitle>
            <AlertDialogDescription>
              Você editou o link manualmente, mas o título mudou. O que deseja fazer com o link do evento?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-1">
            <button
              type="button"
              onClick={() => {
                setSlugMode('auto');
                setForm(prev => ({ ...prev, slug: autoSlugPreview }));
                setShowSlugPrompt(false);
              }}
              className="w-full text-left rounded-md border border-border p-3 transition-colors hover:border-primary hover:bg-accent"
            >
              <p className="text-xs font-medium text-foreground mb-0.5">Usar automático (baseado no título)</p>
              <p className="text-xs text-muted-foreground break-all">{prefixoDoLinkPublico()}{autoSlugPreview}</p>
            </button>
            <button
              type="button"
              onClick={() => setShowSlugPrompt(false)}
              className="w-full text-left rounded-md border border-border p-3 transition-colors hover:border-primary hover:bg-accent"
            >
              <p className="text-xs font-medium text-foreground mb-0.5">Manter personalizado</p>
              <p className="text-xs text-muted-foreground break-all">{prefixoDoLinkPublico()}{form.slug || 'preview'}</p>
            </button>
          </div>
        </AlertDialogContent>
      </AlertDialog>

    </Dialog>
  );
}
