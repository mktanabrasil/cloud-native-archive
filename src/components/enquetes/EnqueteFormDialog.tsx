import { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { CartaoDeOpcao, DiasEmDestaque, Marca, TextoDaEnquete } from './PecasDaEnquete';
import { CORES_DE_OPCAO, COR_HEX, LIMITES, novaOpcao, type CorDeOpcao, type DiaEmDestaque, type Enquete, type OpcaoDeEnquete } from '@/lib/enquetes/modelo';
import { criarEnquete } from '@/lib/enquetes/api';
import { slugDaPergunta } from '@/lib/enquetes/links';

/**
 * Nova enquete (23/09/2026, mockup aprovado): pergunta, texto com
 * **negrito**, 2 a 6 opções com cor, dias em destaque opcionais, os três
 * interruptores e o prazo com atalhos ("Hoje, 18:00"). Prévia ao lado.
 */
interface Props {
  open: boolean;
  onOpenChange: (aberto: boolean) => void;
  criadaPor: string;
  onCriada: (enquete: Enquete) => void;
}

/** "2026-09-23T18:00" no fuso local, para o input datetime-local. */
export const paraCampoLocal = (d: Date): string => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export function atalhosDePrazo(agora: Date = new Date()): Array<{ rotulo: string; valor: string | null }> {
  const hoje18 = new Date(agora); hoje18.setHours(18, 0, 0, 0);
  const hoje2359 = new Date(agora); hoje2359.setHours(23, 59, 0, 0);
  const amanha18 = new Date(agora); amanha18.setDate(agora.getDate() + 1); amanha18.setHours(18, 0, 0, 0);
  const lista: Array<{ rotulo: string; valor: string | null }> = [];
  if (hoje18 > agora) lista.push({ rotulo: 'Hoje, 18:00', valor: paraCampoLocal(hoje18) });
  lista.push({ rotulo: 'Hoje, 23:59', valor: paraCampoLocal(hoje2359) });
  lista.push({ rotulo: 'Amanhã, 18:00', valor: paraCampoLocal(amanha18) });
  lista.push({ rotulo: 'Sem prazo', valor: null });
  return lista;
}

const vazio = () => ({
  pergunta: '',
  texto: '',
  opcoes: [novaOpcao(0), novaOpcao(3)] as OpcaoDeEnquete[],
  dias: [] as DiaEmDestaque[],
  mostrar_resultado: true,
  identificar: true,
  permitir_troca: true,
  encerra_em: atalhosDePrazo()[0].valor as string | null,
});

export function EnqueteFormDialog({ open, onOpenChange, criadaPor, onCriada }: Props) {
  const { user } = useAuth();
  const [form, setForm] = useState(vazio);
  const [novoDia, setNovoDia] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const atalhos = useMemo(() => atalhosDePrazo(), []);

  const trocarOpcao = (i: number, m: Partial<OpcaoDeEnquete>) => setForm(f => ({ ...f, opcoes: f.opcoes.map((o, n) => (n === i ? { ...o, ...m } : o)) }));
  const trocarDia = (i: number, m: Partial<DiaEmDestaque>) => setForm(f => ({ ...f, dias: f.dias.map((d, n) => (n === i ? { ...d, ...m } : d)) }));

  const validar = (): string | null => {
    if (!form.pergunta.trim()) return 'Escreva a pergunta.';
    const validas = form.opcoes.filter(o => o.titulo.trim());
    if (validas.length < LIMITES.opcoes.min) return 'Pelo menos duas opções com título.';
    if (form.opcoes.some(o => !o.titulo.trim())) return 'Tem opção sem título: preencha ou remova.';
    if (form.encerra_em && new Date(form.encerra_em) <= new Date()) return 'O prazo já passou. Escolha um horário à frente.';
    return null;
  };

  const criar = async () => {
    const e = validar();
    if (e) return setErro(e);
    setErro(null);
    setSalvando(true);
    try {
      const base = slugDaPergunta(form.pergunta);
      let slug = base;
      let criada: Enquete | null = null;
      for (let tentativa = 0; tentativa < 4 && !criada; tentativa++) {
        try {
          criada = await criarEnquete({
            slug,
            pergunta: form.pergunta.trim(),
            texto: form.texto.trim(),
            opcoes: form.opcoes.map(o => ({ ...o, titulo: o.titulo.trim(), subtitulo: o.subtitulo.trim() })),
            dias: form.dias.filter(d => d.data).map(d => ({ ...d, rotulo: d.rotulo.trim() })),
            mostrar_resultado: form.mostrar_resultado,
            identificar: form.identificar,
            permitir_troca: form.permitir_troca,
            encerra_em: form.encerra_em ? new Date(form.encerra_em).toISOString() : null,
            criada_por: criadaPor,
          }, user?.id ?? null);
        } catch (err) {
          // Slug já usado: acrescenta um sufixo e tenta de novo.
          if (err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === '23505' && tentativa < 3) {
            slug = `${base}-${tentativa + 2}`;
            continue;
          }
          throw err;
        }
      }
      if (!criada) throw new Error('Não deu para criar.');
      toast.success('Enquete criada', { description: criada.pergunta });
      onOpenChange(false);
      setForm(vazio());
      onCriada(criada);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não deu para criar. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  };

  const previa: Enquete = {
    id: '', slug: '', created_at: new Date().toISOString(), deleted_at: null, encerrada_em: null, criada_por: criadaPor,
    ...form,
    encerra_em: form.encerra_em ? new Date(form.encerra_em).toISOString() : null,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] overflow-y-auto sm:max-w-4xl" data-testid="form-enquete">
        <DialogHeader>
          <DialogTitle>Nova enquete</DialogTitle>
          <DialogDescription>Pergunta, opções e prazo. Ao criar, você recebe os dois links.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-[1.3fr_1fr]">
          <div className="space-y-4">
            <div>
              <Label htmlFor="enq-pergunta" className="text-xs font-semibold">Pergunta *</Label>
              <Input id="enq-pergunta" className="mt-1" maxLength={LIMITES.pergunta} value={form.pergunta} onChange={e => setForm({ ...form, pergunta: e.target.value })} placeholder="Qual folga você prefere?" />
            </div>
            <div>
              <Label htmlFor="enq-texto" className="text-xs font-semibold">
                Texto de contexto <span className="font-normal text-muted-foreground">(opcional · **negrito** entre asteriscos)</span>
              </Label>
              <Textarea id="enq-texto" className="mt-1" rows={3} maxLength={LIMITES.texto} value={form.texto} onChange={e => setForm({ ...form, texto: e.target.value })} placeholder="Pessoal, teremos um **feriado no dia 12/10**…" />
            </div>

            <div>
              <Label className="text-xs font-semibold">
                Opções * <span className="font-normal text-muted-foreground">— de 2 a 6, cada uma com a sua cor</span>
              </Label>
              <div className="mt-1.5 space-y-2">
                {form.opcoes.map((o, i) => (
                  <div key={o.id} className="grid grid-cols-[28px_1fr_28px] gap-2 sm:grid-cols-[28px_1fr_1.3fr_28px]" data-testid={`opcao-edit-${i}`}>
                    <button
                      type="button"
                      aria-label={`Cor da opção ${i + 1}: ${o.cor}. Trocar`}
                      className="mt-1 h-6 w-6 rounded-full border-2 border-background ring-1 ring-border"
                      style={{ backgroundColor: COR_HEX[o.cor] }}
                      onClick={() => trocarOpcao(i, { cor: CORES_DE_OPCAO[(CORES_DE_OPCAO.indexOf(o.cor) + 1) % CORES_DE_OPCAO.length] as CorDeOpcao })}
                    />
                    <Input aria-label={`Título da opção ${i + 1}`} className="h-9" maxLength={LIMITES.titulo} value={o.titulo} onChange={e => trocarOpcao(i, { titulo: e.target.value })} placeholder={`Opção ${i + 1}`} />
                    <Input aria-label={`Subtítulo da opção ${i + 1}`} className="h-9 col-span-2 sm:col-span-1 col-start-2 sm:col-start-auto text-xs" maxLength={LIMITES.subtitulo} value={o.subtitulo} onChange={e => trocarOpcao(i, { subtitulo: e.target.value })} placeholder="Detalhe curto (opcional)" />
                    <button type="button" aria-label={`Remover opção ${i + 1}`} className="mt-1 grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-30 row-start-1 col-start-3 sm:col-start-4" disabled={form.opcoes.length <= LIMITES.opcoes.min} onClick={() => setForm(f => ({ ...f, opcoes: f.opcoes.filter((_, n) => n !== i) }))}>
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" size="sm" className="mt-2 gap-1.5 border-dashed" disabled={form.opcoes.length >= LIMITES.opcoes.max} onClick={() => setForm(f => ({ ...f, opcoes: [...f.opcoes, novaOpcao(f.opcoes.length)] }))}>
                <Plus className="h-3.5 w-3.5" /> Adicionar opção
              </Button>
            </div>

            <div>
              <Label className="text-xs font-semibold">
                Dias em destaque <span className="font-normal text-muted-foreground">(opcional · para folga, plantão, escala)</span>
              </Label>
              {form.dias.length > 0 && (
                <div className="mt-1.5 space-y-2">
                  {form.dias.map((d, i) => (
                    <div key={`${d.data}-${i}`} className="grid grid-cols-[28px_1fr_1fr_28px] gap-2 items-center">
                      <button type="button" aria-label={`Cor do dia ${d.data}`} className="h-6 w-6 rounded-full border-2 border-background ring-1 ring-border" style={{ backgroundColor: d.cor ? COR_HEX[d.cor] : 'transparent' }} onClick={() => trocarDia(i, { cor: d.cor === null ? CORES_DE_OPCAO[0] : CORES_DE_OPCAO.indexOf(d.cor) === CORES_DE_OPCAO.length - 2 ? null : CORES_DE_OPCAO[CORES_DE_OPCAO.indexOf(d.cor) + 1] })} />
                      <Input type="date" aria-label={`Data do dia ${i + 1}`} className="h-9" value={d.data} onChange={e => trocarDia(i, { data: e.target.value })} />
                      <Input aria-label={`Etiqueta do dia ${i + 1}`} className="h-9 text-xs" maxLength={LIMITES.rotuloDia} value={d.rotulo} onChange={e => trocarDia(i, { rotulo: e.target.value })} placeholder="Feriado, Facultativo…" />
                      <button type="button" aria-label={`Remover dia ${i + 1}`} className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:text-destructive" onClick={() => setForm(f => ({ ...f, dias: f.dias.filter((_, n) => n !== i) }))}><X className="h-4 w-4" /></button>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-2 flex items-center gap-2">
                <Input type="date" aria-label="Novo dia em destaque" className="h-9 max-w-[180px]" value={novoDia} onChange={e => setNovoDia(e.target.value)} />
                <Button type="button" variant="outline" size="sm" className="gap-1.5 border-dashed" disabled={!novoDia || form.dias.length >= LIMITES.dias} onClick={() => { setForm(f => ({ ...f, dias: [...f.dias, { data: novoDia, rotulo: '', cor: null }].sort((a, b) => a.data.localeCompare(b.data)) })); setNovoDia(''); }}>
                  <Plus className="h-3.5 w-3.5" /> Dia
                </Button>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">A bolinha troca a cor do dia; a etiqueta é o que aparece embaixo do número.</p>
            </div>

            <div className="space-y-2">
              {([
                ['mostrar_resultado', 'Mostrar o resultado para quem vota', 'Desligado, quem vota só vê a própria escolha; o resultado aparece no encerramento.'],
                ['identificar', 'Identificar quem vota pelo WhatsApp', 'Nome + número + PIN de 4 dígitos criado na hora. Um voto por número. Desligado, a enquete é anônima por aparelho.'],
                ['permitir_troca', 'Permitir trocar o voto até o prazo', 'Com o mesmo número e PIN. No prazo, congela.'],
              ] as const).map(([chave, titulo, sub]) => (
                <div key={chave} className="flex items-start gap-3 rounded-xl border border-border p-3">
                  <Switch id={`enq-${chave}`} checked={form[chave]} onCheckedChange={v => setForm({ ...form, [chave]: v })} className="mt-0.5" />
                  <Label htmlFor={`enq-${chave}`} className="cursor-pointer">
                    <b className="block text-[13.5px]">{titulo}</b>
                    <span className="block text-xs font-normal text-muted-foreground">{sub}</span>
                  </Label>
                </div>
              ))}
            </div>

            <div>
              <Label className="text-xs font-semibold">Encerra em *</Label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {atalhos.map(a => (
                  <button key={a.rotulo} type="button" className={`rounded-full border px-2.5 py-1.5 text-xs font-semibold ${form.encerra_em === a.valor ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground hover:bg-muted'}`} onClick={() => setForm({ ...form, encerra_em: a.valor })}>
                    {a.rotulo}
                  </button>
                ))}
              </div>
              <Input type="datetime-local" aria-label="Data e hora do encerramento" className="mt-2 h-9 max-w-[260px]" value={form.encerra_em ?? ''} onChange={e => setForm({ ...form, encerra_em: e.target.value || null })} />
              <p className="mt-1 text-[11px] text-muted-foreground">No horário, a enquete congela sozinha. "Sem prazo" fica aberta até você encerrar à mão.</p>
            </div>
          </div>

          <aside className="rounded-2xl bg-muted/50 p-4" aria-label="Prévia">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[.1em] text-muted-foreground">Prévia · como quem vota vê</p>
            <div className="flex flex-col gap-2.5 rounded-2xl bg-background p-4">
              <Marca />
              <h3 className="text-lg font-bold leading-tight [text-wrap:balance]">{form.pergunta || 'Sua pergunta aqui'}</h3>
              <TextoDaEnquete texto={form.texto} />
              <DiasEmDestaque dias={previa.dias.filter(d => d.data)} />
              <div className="flex flex-col gap-2">
                {form.opcoes.map(o => <CartaoDeOpcao key={o.id} opcao={{ ...o, titulo: o.titulo || 'Opção' }} compacta />)}
              </div>
            </div>
          </aside>
        </div>

        {erro && <p className="text-xs text-destructive" role="alert">{erro}</p>}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={criar} disabled={salvando} data-testid="criar-enquete">{salvando ? 'Criando…' : 'Criar enquete'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default EnqueteFormDialog;
