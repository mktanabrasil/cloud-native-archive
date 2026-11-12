import { supabase } from '@/integrations/supabase/client';
import { ePara, whatsappDoFormulario } from '../../../supabase/functions/voluntariado-avisos/regras';
import { CAMINHO_DO_FORMULARIO, type AreaDeAjuda, type Horario, type Vinculo } from './modelo';

/**
 * A Central do Voluntário (13/11/2026): /voluntariado/natalfeliz26/central.
 *
 * Depois da inscrição, a pessoa entra com o WhatsApp da inscrição e acompanha
 * tudo até o Natal Feliz: a credencial (QR com o protocolo, lido na entrada do
 * treinamento e do evento), o cronograma, o local e os avisos no celular.
 * O celular guarda o número: no treinamento e no dia, é só abrir o link.
 *
 * A regra de "para quem é" (área e turno) é a mesma da função dos avisos e do
 * banco: vem de supabase/functions/voluntariado-avisos/regras.ts.
 *
 * 12/11/2026, a pedido dele: o QR da credencial saiu (a presença é pelo nome)
 * e a aba do meio virou Avisos. Os gestores entram pelo número, sem inscrição:
 * veem o cronograma inteiro e recebem todos os avisos.
 */

export { ePara, whatsappDoFormulario };

export const CAMINHO_DA_CENTRAL = `${CAMINHO_DO_FORMULARIO}/central`;
export const CAMINHO_DA_PRESENCA = `${CAMINHO_DO_FORMULARIO}/presenca`;
export const ORIGEM_DO_APP = 'https://app.anabrasil.org';

/** As abas da Central (o endereço de cada uma). */
export const ABAS_DA_CENTRAL = ['inicio', 'cronograma', 'avisos', 'local', 'perfil'] as const;
export type AbaDaCentral = (typeof ABAS_DA_CENTRAL)[number];
export const caminhoDaAba = (aba: AbaDaCentral) => (aba === 'inicio' ? CAMINHO_DA_CENTRAL : `${CAMINHO_DA_CENTRAL}/${aba}`);

/**
 * A planta do Recanto Maanaim na aba Local. Vazio, a aba mostra "chega em
 * breve". Quando a imagem chegar: public/ com nome novo e o caminho aqui.
 */
export const PLANTA_DO_LOCAL: string | null = null;

/** Os dois dias com presença na entrada. */
export const DIA_DO_TREINAMENTO = '2026-11-28';
export const DIA_DO_NATAL_FELIZ = '2026-12-08';
export type Momento = 'treinamento' | 'evento';

export interface VoluntarioNaCentral {
  /** O gestor não tem inscrição: sem protocolo, área nem turno. */
  protocolo: string | null;
  nome: string;
  vinculo: Vinculo | 'gestao';
  unidade_nome: string | null;
  igreja: string | null;
  horario: Horario | null;
  opcao1: AreaDeAjuda | null;
  opcao2: AreaDeAjuda | null;
  inscrito_em: string;
}

export type TipoDoItem = 'checkin' | 'atividade' | 'evento' | 'intervalo' | 'transicao';

export interface ItemDoCronograma {
  id: string;
  dia: string; // AAAA-MM-DD
  inicio: string; // HH:MM
  fim: string | null;
  titulo: string;
  tipo: TipoDoItem;
  local: string | null;
  detalhe: string | null;
  areas: string[];
  horarios: string[];
}

export interface AvisoEnviado {
  id: string;
  titulo: string;
  texto: string;
  enviado_em: string;
}

export interface DadosDaCentral {
  perfil: 'voluntario' | 'gestor';
  voluntario: VoluntarioNaCentral;
  presencas: Partial<Record<Momento, string>>;
  cronograma: ItemDoCronograma[];
  avisos: AvisoEnviado[];
  celulares: number;
}

export const ROTULO_DO_TIPO: Record<TipoDoItem, string> = {
  checkin: 'Check-in',
  atividade: 'Atividade',
  evento: 'Evento',
  intervalo: 'Intervalo',
  transicao: 'Transição',
};
/** A cor da faixa de cada tipo no cronograma (as cores do rodapé do app). */
export const COR_DO_TIPO: Record<TipoDoItem, string> = {
  checkin: '#81E2CF',
  atividade: '#01ADFF',
  evento: '#F37964',
  intervalo: '#E2B979',
  transicao: '#8A938F',
};

// --- O número guardado no celular ------------------------------------------------------------

const CHAVE = 'ana.central-do-voluntario.whatsapp';

export function numeroGuardado(): string | null {
  try { return localStorage.getItem(CHAVE); } catch { return null; }
}
export function guardarNumero(whatsapp: string): void {
  try { localStorage.setItem(CHAVE, whatsappDoFormulario(whatsapp)); } catch { /* sem guardar, pede de novo */ }
}
export function esquecerNumero(): void {
  try { localStorage.removeItem(CHAVE); } catch { /* nada */ }
}

// --- Leitura ---------------------------------------------------------------------------------

export class NaoEncontrado extends Error {
  constructor() { super('nao_encontrado'); }
}

export async function lerCentral(whatsapp: string): Promise<DadosDaCentral> {
  const { data, error } = await supabase.rpc('central_do_voluntario', { p_whatsapp: whatsappDoFormulario(whatsapp) });
  if (error) {
    if (/nao_encontrado/.test(error.message ?? '')) throw new NaoEncontrado();
    throw error;
  }
  return data as unknown as DadosDaCentral;
}

// --- Regras da tela --------------------------------------------------------------------------

/** "dia" e "hora" de agora em Brasília. */
export function agoraEmBrasilia(agora: Date = new Date()): { dia: string; hora: string } {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(agora).map((x) => [x.type, x.value]));
  return { dia: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}` };
}

export const eGestor = (v: Pick<VoluntarioNaCentral, 'vinculo'>) => v.vinculo === 'gestao';

/** O gestor vê tudo; o voluntário, o que é da área e do turno dele. */
export const eParaMim = (item: Pick<ItemDoCronograma, 'areas' | 'horarios'>, v: Pick<VoluntarioNaCentral, 'opcao1' | 'horario' | 'vinculo'>) =>
  eGestor(v) || ePara(item.areas, item.horarios, v.opcao1, v.horario);

/** Item só da área ou do turno da pessoa (os gerais não ganham o selo "Sua área"). */
export const eSoDoMeuGrupo = (item: Pick<ItemDoCronograma, 'areas' | 'horarios'>, v: Pick<VoluntarioNaCentral, 'opcao1' | 'horario' | 'vinculo'>) =>
  !eGestor(v) && (item.areas.length > 0 || item.horarios.length > 0) && eParaMim(item, v);

export const diasDoCronograma = (c: ItemDoCronograma[]) => [...new Set(c.map((i) => i.dia))].sort();

/** O dia que abre: hoje, se tiver; senão o próximo; senão o último. */
export function diaQueAbre(dias: string[], hoje: string): string | null {
  if (!dias.length) return null;
  if (dias.includes(hoje)) return hoje;
  return dias.find((d) => d > hoje) ?? dias[dias.length - 1];
}

/** Os itens do dia, todos ou só os da pessoa, em ordem. */
export const itensDoDia = (c: ItemDoCronograma[], dia: string, v: VoluntarioNaCentral, soMeus: boolean) =>
  c.filter((i) => i.dia === dia && (!soMeus || eParaMim(i, v))).sort((a, b) => a.inicio.localeCompare(b.inicio) || a.titulo.localeCompare(b.titulo));

/** Onde fica a linha do "agora": antes do primeiro item que ainda não começou (-1 = fora do dia). */
export function posicaoDoAgora(itens: ItemDoCronograma[], dia: string, agora: { dia: string; hora: string }): number {
  if (dia !== agora.dia || !itens.length) return -1;
  const i = itens.findIndex((x) => x.inicio > agora.hora);
  return i === -1 ? itens.length : i;
}

/** O que está acontecendo e o que vem a seguir para a pessoa, hoje. */
export function agoraEProximo(c: ItemDoCronograma[], v: VoluntarioNaCentral, agora: { dia: string; hora: string }) {
  const hoje = itensDoDia(c, agora.dia, v, true);
  const acontecendo = hoje.filter((i) => i.inicio <= agora.hora && (i.fim ? i.fim > agora.hora : false));
  const proximo = hoje.find((i) => i.inicio > agora.hora) ?? null;
  return { acontecendo: acontecendo[acontecendo.length - 1] ?? null, proximo };
}

export type EstadoDoPasso = 'feito' | 'agora' | 'depois';

/** O caminho da pessoa: inscrição → treinamento → Natal Feliz. */
export function caminho(d: Pick<DadosDaCentral, 'presencas'>, hoje: string): Array<{ chave: 'inscricao' | Momento; estado: EstadoDoPasso }> {
  const treinou = !!d.presencas.treinamento;
  const foi = !!d.presencas.evento;
  return [
    { chave: 'inscricao', estado: 'feito' },
    { chave: 'treinamento', estado: treinou ? 'feito' : hoje <= DIA_DO_TREINAMENTO ? 'agora' : 'depois' },
    { chave: 'evento', estado: foi ? 'feito' : treinou || hoje > DIA_DO_TREINAMENTO ? 'agora' : 'depois' },
  ];
}

/** "Seg, 08/12" */
export function diaCurto(iso: string): string {
  const d = new Date(`${iso}T12:00:00-03:00`);
  const sem = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'America/Sao_Paulo' }).format(d).replace('.', '');
  return `${sem.charAt(0).toUpperCase()}${sem.slice(1)}, ${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

/** "08:00" → "8h"; "07:30" → "7h30". */
export const horaCurta = (h: string) => { const [hh, mm] = h.split(':'); return `${Number(hh)}h${mm === '00' ? '' : mm}`; };

/** "(19) 9••••-4821" */
export function whatsappMascarado(w: string): string {
  const d = whatsappDoFormulario(w);
  if (d.length < 10) return d;
  return `(${d.slice(0, 2)}) ${d.length === 11 ? '9••••' : '••••'}-${d.slice(-4)}`;
}

export const iniciais = (nome: string) => {
  const p = nome.trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
};
export const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0] ?? '';

/** O protocolo dentro do que o leitor "digitou" (o link do QR, o código ou o código sem o hífen). */
export function protocoloLido(texto: string): string | null {
  const t = texto.trim().toUpperCase();
  const m = t.match(/[?&]P=(VL-?[23456789A-HJ-NP-Z]{5})\b/) ?? t.match(/^(VL-?[23456789A-HJ-NP-Z]{5})$/);
  if (!m) return null;
  return m[1].startsWith('VL-') ? m[1] : `VL-${m[1].slice(2)}`;
}

/** Na entrada: até o dia do treinamento, presença do treinamento; depois, do evento. */
export const momentoDoDia = (hoje: string): Momento => (hoje <= DIA_DO_TREINAMENTO ? 'treinamento' : 'evento');

// --- Avisos no celular (Web Push) ---------------------------------------------------------

export type SuporteDeAvisos = 'ok' | 'iphone_instalar' | 'sem_suporte';

/** No iPhone, os avisos só funcionam com a Central adicionada à Tela de Início (iOS 16.4+). */
export function suporteDeAvisos(n: Navigator = navigator, w: Window = window): SuporteDeAvisos {
  const temPush = 'serviceWorker' in n && 'PushManager' in w && 'Notification' in w;
  const iphone = /iPhone|iPad|iPod/.test(n.userAgent) || (n.platform === 'MacIntel' && (n as Navigator & { maxTouchPoints?: number }).maxTouchPoints! > 1);
  const instalado = w.matchMedia?.('(display-mode: standalone)').matches || (n as Navigator & { standalone?: boolean }).standalone === true;
  if (iphone && !instalado) return 'iphone_instalar';
  return temPush ? 'ok' : 'sem_suporte';
}

const ESCOPO = `${CAMINHO_DO_FORMULARIO}/`;

async function registroDosAvisos(): Promise<ServiceWorkerRegistration> {
  const r = await navigator.serviceWorker.register('/sw-central.js', { scope: ESCOPO, updateViaCache: 'none' });
  await navigator.serviceWorker.ready;
  return r;
}

/** Os avisos já estão ligados neste celular? */
export async function avisosLigadosAqui(): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator) || Notification.permission !== 'granted') return false;
    const r = await navigator.serviceWorker.getRegistration(ESCOPO);
    return !!(await r?.pushManager.getSubscription());
  } catch { return false; }
}

const deBase64Url = (s: string) => {
  const b = atob((s + '='.repeat((4 - (s.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};

async function chamarAvisos<T>(corpo: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('voluntariado-avisos', { body: corpo });
  if (error) throw error;
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  return data as T;
}

/** Liga os avisos neste celular: permissão, assinatura e a primeira notificação. */
export async function ligarAvisos(whatsapp: string): Promise<'ligado' | 'negado'> {
  const permissao = await Notification.requestPermission();
  if (permissao !== 'granted') return 'negado';
  const reg = await registroDosAvisos();
  const { chave } = await chamarAvisos<{ chave: string }>({ acao: 'chave' });
  let sub = await reg.pushManager.getSubscription();
  // Assinatura com outra chave (trocaram as chaves no servidor): refaz.
  if (sub && sub.options.applicationServerKey) {
    const atual = new Uint8Array(sub.options.applicationServerKey as ArrayBuffer);
    const nova = deBase64Url(chave);
    if (atual.length !== nova.length || atual.some((b, i) => b !== nova[i])) { await sub.unsubscribe(); sub = null; }
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: deBase64Url(chave) });
  const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  const { error } = await supabase.rpc('ativar_avisos_voluntario', { p_whatsapp: whatsappDoFormulario(whatsapp), p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth });
  if (error) throw error;
  await chamarAvisos({ acao: 'boas_vindas', whatsapp: whatsappDoFormulario(whatsapp), endpoint: j.endpoint }).catch(() => { /* a primeira notificação é só um sinal */ });
  return 'ligado';
}

export async function desligarAvisos(whatsapp: string): Promise<void> {
  const r = await navigator.serviceWorker.getRegistration(ESCOPO);
  const sub = await r?.pushManager.getSubscription();
  if (!sub) return;
  await supabase.rpc('desativar_avisos_voluntario', { p_whatsapp: whatsappDoFormulario(whatsapp), p_endpoint: sub.endpoint });
  await sub.unsubscribe();
}

// --- O painel e a presença (comunicação) ------------------------------------------------------

export interface ResultadoDaPresenca {
  status: 'registrada' | 'ja_registrada' | 'nao_encontrado';
  momento?: Momento;
  protocolo?: string;
  registrado_em?: string;
  voluntario?: { id: string; protocolo: string; nome: string; vinculo: Vinculo; unidade_nome: string | null; horario: Horario | null; opcao1: AreaDeAjuda };
}

export async function registrarPresenca(protocolo: string, momento: Momento): Promise<ResultadoDaPresenca> {
  const { data, error } = await supabase.rpc('registrar_presenca_voluntario', { p_protocolo: protocolo, p_momento: momento });
  if (error) throw error;
  return data as unknown as ResultadoDaPresenca;
}

export async function desfazerPresenca(protocolo: string, momento: Momento): Promise<void> {
  const { error } = await supabase.rpc('desfazer_presenca_voluntario', { p_protocolo: protocolo, p_momento: momento });
  if (error) throw error;
}

export interface Presenca { voluntario_id: string; momento: Momento; registrado_em: string }

export async function listarPresencas(): Promise<Presenca[]> {
  const { data, error } = await supabase.from('voluntariado_presencas').select('voluntario_id, momento, registrado_em');
  if (error) throw error;
  return (data ?? []) as unknown as Presenca[];
}

/** Quem tem os avisos ligados em pelo menos um celular: as inscrições (ids) e quantos gestores. */
export async function celularesComAvisos(): Promise<{ voluntarios: Set<string>; gestores: number }> {
  const { data, error } = await supabase.from('voluntariado_dispositivos').select('voluntario_id, gestor_id');
  if (error) throw error;
  const l = data ?? [];
  return {
    voluntarios: new Set(l.flatMap((d) => (d.voluntario_id ? [d.voluntario_id] : []))),
    gestores: new Set(l.flatMap((d) => (d.gestor_id ? [d.gestor_id] : []))).size,
  };
}

// --- O botão da Central no formulário e os gestores (12/11/2026) -------------------------------

export async function definirCentralNoFormulario(ligado: boolean): Promise<void> {
  const { error } = await supabase.rpc('definir_central_no_formulario', { p_ligado: ligado });
  if (error) throw error;
}

export interface Gestor { id: string; nome: string; whatsapp: string; criado_em: string }

export async function listarGestores(): Promise<Gestor[]> {
  const { data, error } = await supabase.from('voluntariado_gestores').select('id, nome, whatsapp, criado_em').order('nome');
  if (error) throw error;
  return (data ?? []) as Gestor[];
}

/** Grava só os dígitos, sem o 55. Número repetido: 'ja_cadastrado'. */
export async function adicionarGestor(nome: string, whatsapp: string): Promise<void> {
  const { error } = await supabase.from('voluntariado_gestores').insert({ nome: nome.trim().replace(/\s+/g, ' '), whatsapp: whatsappDoFormulario(whatsapp) });
  if (error) throw new Error(/duplicate|unique/i.test(error.message) ? 'ja_cadastrado' : error.message);
}

export async function removerGestor(id: string): Promise<void> {
  const { error } = await supabase.from('voluntariado_gestores').delete().eq('id', id);
  if (error) throw error;
}

export type NovoItem = Omit<ItemDoCronograma, 'id'> & { avisar_min: number | null; aviso_texto: string | null };
export type ItemDoPainel = ItemDoCronograma & { avisar_min: number | null; aviso_texto: string | null };

export async function listarCronograma(): Promise<ItemDoPainel[]> {
  const { data, error } = await supabase.from('voluntariado_cronograma')
    .select('id, dia, inicio, fim, titulo, tipo, local, detalhe, areas, horarios, avisar_min, aviso_texto')
    .order('dia').order('inicio');
  if (error) throw error;
  return ((data ?? []) as unknown as ItemDoPainel[]).map((i) => ({ ...i, inicio: i.inicio.slice(0, 5), fim: i.fim ? i.fim.slice(0, 5) : null }));
}

export async function salvarItem(item: NovoItem, id?: string): Promise<void> {
  const linha = { ...item, local: item.local?.trim() || null, detalhe: item.detalhe?.trim() || null, aviso_texto: item.aviso_texto?.trim() || null, fim: item.fim || null };
  const q = id
    ? supabase.from('voluntariado_cronograma').update(linha).eq('id', id)
    : supabase.from('voluntariado_cronograma').insert(linha);
  const { error } = await q;
  if (error) throw error;
}

export async function apagarItem(id: string): Promise<void> {
  const { error } = await supabase.from('voluntariado_cronograma').delete().eq('id', id);
  if (error) throw error;
}

export interface AvisoDoPainel {
  id: string;
  titulo: string;
  texto: string;
  enviar_em: string;
  areas: string[];
  horarios: string[];
  cronograma_id: string | null;
  enviado_em: string | null;
  pulado: boolean;
  entregues: number;
  falhas: number;
}

export async function listarAvisos(): Promise<AvisoDoPainel[]> {
  const { data, error } = await supabase.from('voluntariado_avisos')
    .select('id, titulo, texto, enviar_em, areas, horarios, cronograma_id, enviado_em, pulado, entregues, falhas')
    .order('enviar_em', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as AvisoDoPainel[];
}

/** Um aviso avulso: agora (manda na hora) ou agendado. */
export async function criarAviso(a: { titulo: string; texto: string; enviar_em: string | null; areas: string[]; horarios: string[] }): Promise<void> {
  const { error } = await supabase.from('voluntariado_avisos').insert({
    titulo: a.titulo.trim(), texto: a.texto.trim(), areas: a.areas, horarios: a.horarios,
    ...(a.enviar_em ? { enviar_em: a.enviar_em } : {}),
  });
  if (error) throw error;
  if (!a.enviar_em) await processarAvisos();
}

export async function apagarAviso(id: string): Promise<void> {
  const { error } = await supabase.from('voluntariado_avisos').delete().eq('id', id);
  if (error) throw error;
}

/** Manda já o que está na hora (o agendamento também faz isso a cada minuto). */
export async function processarAvisos(): Promise<void> {
  await chamarAvisos({ acao: 'processar' });
}
