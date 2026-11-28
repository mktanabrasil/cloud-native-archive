import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileSpreadsheet, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { Inscricao } from '@/lib/voluntariado/api';
import { ROTULO_DA_AREA, UNIDADES_POR_AREA } from '@/lib/pizza/modelo';
import { AREAS_DE_AJUDA, HORARIOS, VINCULOS, mascaraDoWhatsapp, rotuloDaAjuda, type AreaDeAjuda, type Horario, type Vinculo } from '@/lib/voluntariado/modelo';
import {
  cadastrarManual, lerGrupo, linhasDaPlanilha, mensagemDoCadastro, numerosDoTexto, substituirGrupo, whatsappValidoParaCadastro,
  type EstadoDoGrupo,
} from '@/lib/voluntariado/semFormulario';

/**
 * Quem entra na Central sem o formulário (28/11/2026, a pedido): cadastro pelo
 * painel, importação das linhas digitadas à mão na planilha e a lista de
 * números do grupo geral do WhatsApp. Fica no bloco da Central, embaixo dos gestores.
 */

const select = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm';
const DIA_ANTERIOR = { chave: 'dia_anterior' as const, rotulo: 'Dia anterior', detalhe: 'Montagem e decoração' };

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1.5 text-sm"><span className="font-semibold">{rotulo}</span>{children}</label>;
}

// --- 1. Adicionar voluntário ---------------------------------------------------------------------

function AdicionarVoluntario({ aoFechar, aoSalvar }: { aoFechar: () => void; aoSalvar: () => void }) {
  const [nome, setNome] = useState('');
  const [tel, setTel] = useState('');
  const [vinculo, setVinculo] = useState<Vinculo>('comunidade');
  const [unidade, setUnidade] = useState('');
  const [opcao1, setOpcao1] = useState<AreaDeAjuda | ''>('');
  const [opcao2, setOpcao2] = useState<AreaDeAjuda | ''>('');
  const [horario, setHorario] = useState<Horario | ''>('');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (nome.trim().length < 3) { setErro('Escreva o nome completo.'); return; }
    if (!whatsappValidoParaCadastro(tel)) { setErro('Confira o WhatsApp, com DDD.'); return; }
    if (vinculo === 'funcionario' && !unidade) { setErro('Escolha a unidade.'); return; }
    if (!opcao1) { setErro('Escolha a área.'); return; }
    setSalvando(true); setErro(null);
    try {
      const protocolo = await cadastrarManual({ nome, whatsapp: tel, vinculo, unidadeId: vinculo === 'funcionario' ? unidade : null, opcao1, opcao2: opcao2 || null, horario: horario || null });
      toast.success(`${nome.trim().split(/\s+/)[0]} cadastrado(a) · ${protocolo}. Já entra na Central e vai para a planilha.`);
      aoSalvar(); aoFechar();
    } catch (x) { setErro(mensagemDoCadastro(x)); }
    finally { setSalvando(false); }
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) aoFechar(); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar voluntário</DialogTitle>
          <DialogDescription>Para quem entrou sem o formulário. Ganha protocolo, vai para a planilha e entra na Central pelo WhatsApp. Sem prazo e sem meta.</DialogDescription>
        </DialogHeader>
        <form id="form-voluntario-manual" onSubmit={salvar} className="flex flex-col gap-3">
          <Campo rotulo="Nome completo"><Input value={nome} maxLength={120} onChange={(e) => { setNome(e.target.value); setErro(null); }} /></Campo>
          <Campo rotulo="WhatsApp"><Input inputMode="numeric" placeholder="(19) 99999-9999" value={tel} onChange={(e) => { setTel(mascaraDoWhatsapp(e.target.value)); setErro(null); }} /></Campo>
          <Campo rotulo="Vínculo">
            <select className={select} value={vinculo} onChange={(e) => { setVinculo(e.target.value as Vinculo); setErro(null); }}>
              {VINCULOS.map((v) => <option key={v.chave} value={v.chave}>{v.curto}</option>)}
            </select>
          </Campo>
          {vinculo === 'funcionario' && (
            <Campo rotulo="Unidade">
              <select className={select} value={unidade} onChange={(e) => { setUnidade(e.target.value); setErro(null); }}>
                <option value="">Escolha a unidade</option>
                {UNIDADES_POR_AREA.map(({ area, unidades }) => (
                  <optgroup key={area} label={ROTULO_DA_AREA[area]}>{unidades.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</optgroup>
                ))}
              </select>
            </Campo>
          )}
          <Campo rotulo="Área">
            <select className={select} value={opcao1} onChange={(e) => { setOpcao1(e.target.value as AreaDeAjuda); setErro(null); }}>
              <option value="">Escolha a área</option>
              {AREAS_DE_AJUDA.map((a) => <option key={a.chave} value={a.chave}>{a.rotulo}</option>)}
            </select>
          </Campo>
          <Campo rotulo="2ª opção (opcional)">
            <select className={select} value={opcao2} onChange={(e) => setOpcao2(e.target.value as AreaDeAjuda)}>
              <option value="">Nenhuma</option>
              {AREAS_DE_AJUDA.filter((a) => a.chave !== opcao1).map((a) => <option key={a.chave} value={a.chave}>{a.rotulo}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Horário (opcional)">
            <select className={select} value={horario} onChange={(e) => setHorario(e.target.value as Horario)}>
              <option value="">Sem horário</option>
              {[...HORARIOS, DIA_ANTERIOR].map((h) => <option key={h.chave} value={h.chave}>{h.rotulo} · {h.detalhe}</option>)}
            </select>
          </Campo>
          {erro && <p role="alert" className="text-sm font-semibold text-destructive">{erro}</p>}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={aoFechar}>Cancelar</Button>
          <Button type="submit" form="form-voluntario-manual" disabled={salvando}>{salvando ? 'Cadastrando…' : 'Cadastrar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- 2. Importar da planilha ---------------------------------------------------------------------

function ImportarDaPlanilha({ inscricoes, aoFechar, aoSalvar }: { inscricoes: Inscricao[]; aoFechar: () => void; aoSalvar: () => void }) {
  const [texto, setTexto] = useState('');
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState<{ ok: number; falhas: Array<{ nome: string; motivo: string }> } | null>(null);
  const lido = useMemo(() => linhasDaPlanilha(texto, inscricoes.map((i) => i.whatsapp)), [texto, inscricoes]);

  async function importar() {
    setImportando(true);
    let ok = 0;
    const falhas: Array<{ nome: string; motivo: string }> = [];
    for (const { cadastro } of lido.entram) {
      try { await cadastrarManual(cadastro, 'planilha'); ok++; }
      catch (x) { falhas.push({ nome: cadastro.nome, motivo: mensagemDoCadastro(x) }); }
    }
    setResultado({ ok, falhas });
    setImportando(false);
    if (ok) { toast.success(`${ok} ${ok === 1 ? 'pessoa cadastrada' : 'pessoas cadastradas'} da planilha.`); aoSalvar(); }
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v && !importando) aoFechar(); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar da planilha</DialogTitle>
          <DialogDescription>
            Na planilha do Google, selecione as linhas das pessoas colocadas à mão (da coluna Nome até a Protocolo), copie e cole aqui.
            Entra só quem ainda não tem protocolo; quem veio do formulário já está no app.
          </DialogDescription>
        </DialogHeader>
        {resultado ? (
          <div className="flex flex-col gap-2 text-sm" data-testid="resultado-da-importacao">
            <b>{resultado.ok} {resultado.ok === 1 ? 'pessoa cadastrada' : 'pessoas cadastradas'}.</b>
            {resultado.falhas.length > 0 && (
              <ul className="list-disc pl-5 text-destructive">{resultado.falhas.map((f, i) => <li key={i}>{f.nome}: {f.motivo}</li>)}</ul>
            )}
          </div>
        ) : (
          <>
            <Textarea rows={8} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Cole aqui as linhas copiadas da planilha" aria-label="Linhas da planilha" className="font-mono text-xs" />
            {texto.trim() && (
              <div className="flex flex-col gap-2 text-sm" data-testid="previa-da-importacao">
                <b>{lido.entram.length} {lido.entram.length === 1 ? 'pessoa vai entrar' : 'pessoas vão entrar'}</b>
                {lido.entram.length > 0 && (
                  <ul className="max-h-40 overflow-y-auto rounded-md border border-border text-xs">
                    {lido.entram.map(({ linha, cadastro: c }) => <li key={linha} className="border-b border-border/60 px-2 py-1 last:border-b-0">{c.nome} · {rotuloDaAjuda(c.opcao1)}</li>)}
                  </ul>
                )}
                {lido.ignoradas.length > 0 && (
                  <details>
                    <summary className="cursor-pointer text-muted-foreground">{lido.ignoradas.length} {lido.ignoradas.length === 1 ? 'linha fica' : 'linhas ficam'} de fora</summary>
                    <ul className="mt-1 list-disc pl-5 text-xs text-muted-foreground">{lido.ignoradas.map((l) => <li key={l.linha}>Linha {l.linha} · {l.nome}: {l.motivo}</li>)}</ul>
                  </details>
                )}
              </div>
            )}
          </>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={aoFechar} disabled={importando}>{resultado ? 'Fechar' : 'Cancelar'}</Button>
          {!resultado && <Button onClick={importar} disabled={importando || !lido.entram.length}>{importando ? 'Cadastrando…' : `Cadastrar ${lido.entram.length || ''}`.trim()}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- 3. O grupo geral ----------------------------------------------------------------------------

function ListaDoGrupo({ aoFechar, aoSalvar }: { aoFechar: () => void; aoSalvar: () => void }) {
  const [texto, setTexto] = useState('');
  const [salvando, setSalvando] = useState(false);
  const numeros = useMemo(() => numerosDoTexto(texto), [texto]);

  async function salvar() {
    setSalvando(true);
    try { const n = await substituirGrupo(numeros); toast.success(`${n} ${n === 1 ? 'número' : 'números'} do grupo já entram na Central.`); aoSalvar(); aoFechar(); }
    catch (x) { toast.error(/substituir_grupo|schema cache|PGRST202/.test((x as Error).message) ? 'O banco ainda não foi atualizado para a lista do grupo.' : 'Não deu para salvar a lista. Tente de novo.'); }
    finally { setSalvando(false); }
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v && !salvando) aoFechar(); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Lista do grupo geral</DialogTitle>
          <DialogDescription>Cole os números de quem está no grupo "Natal Feliz 26 - Voluntariado", um por linha (com ou sem nome). A lista nova substitui a anterior. Quem já é inscrito ou gestor continua entrando como antes.</DialogDescription>
        </DialogHeader>
        <Textarea rows={8} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={'Maria Souza · (19) 99999-8888\n+55 19 98888-7777'} aria-label="Números do grupo" className="font-mono text-xs" />
        <span className="text-sm text-muted-foreground" data-testid="numeros-lidos">{numeros.length} {numeros.length === 1 ? 'número reconhecido' : 'números reconhecidos'}</span>
        <DialogFooter>
          <Button variant="outline" onClick={aoFechar} disabled={salvando}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando || !numeros.length}>{salvando ? 'Salvando…' : 'Substituir a lista'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- O bloco ---------------------------------------------------------------------------------------

export function QuemEntraSemFormulario({ inscricoes, aoMudarInscricoes }: { inscricoes: Inscricao[]; aoMudarInscricoes?: () => void }) {
  const [aberto, setAberto] = useState<'adicionar' | 'planilha' | 'grupo' | null>(null);
  const [grupo, setGrupo] = useState<EstadoDoGrupo | null>(null);
  const carregarGrupo = useCallback(() => { lerGrupo().then(setGrupo).catch(() => setGrupo(null)); }, []);
  useEffect(() => { carregarGrupo(); }, [carregarGrupo]);
  const manuais = inscricoes.filter((i) => i.origem && i.origem !== 'formulario').length;

  return (
    <div className="flex flex-col gap-2" data-testid="sem-formulario">
      <div className="text-sm">
        <b className="block text-[14.5px] font-semibold">Quem entrou sem o formulário</b>
        <span className="text-muted-foreground">
          Cadastre quem foi colocado à mão na planilha ou no grupo para entrar na Central.
          {manuais > 0 ? ` ${manuais} ${manuais === 1 ? 'cadastro feito' : 'cadastros feitos'} pelo painel ou pela planilha.` : ''}
          {grupo ? ` Grupo geral: ${grupo.total} ${grupo.total === 1 ? 'número' : 'números'} com acesso.` : ''}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => setAberto('adicionar')}><UserPlus className="h-4 w-4" /> Adicionar voluntário</Button>
        <Button size="sm" variant="outline" onClick={() => setAberto('planilha')}><FileSpreadsheet className="h-4 w-4" /> Importar da planilha</Button>
        <Button size="sm" variant="outline" onClick={() => setAberto('grupo')}><Users className="h-4 w-4" /> Atualizar lista do grupo</Button>
      </div>
      {aberto === 'adicionar' && <AdicionarVoluntario aoFechar={() => setAberto(null)} aoSalvar={() => aoMudarInscricoes?.()} />}
      {aberto === 'planilha' && <ImportarDaPlanilha inscricoes={inscricoes} aoFechar={() => setAberto(null)} aoSalvar={() => aoMudarInscricoes?.()} />}
      {aberto === 'grupo' && <ListaDoGrupo aoFechar={() => setAberto(null)} aoSalvar={carregarGrupo} />}
    </div>
  );
}
