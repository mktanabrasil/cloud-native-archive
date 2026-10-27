import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DESCRICAO_DO_CAMPO, EXEMPLO, MODELOS, editado, listarModelos, mandarTeste, paragrafos, preencher, problemaDoModelo, salvarModelo, versoesDo,
  type ChaveDoModelo, type Modelo, type Versao,
} from '@/lib/vagas/emails';

/**
 * Vagas › Modelos de e-mail (passo 7 do roteiro, mockup aprovado e decisões
 * de 21/10/2026): o RH reescreve o assunto, o título e o texto de cada
 * e-mail do Trabalhe Conosco, inclusive o da equipe. A identidade (logo,
 * botão, fio de cores, quadros do protocolo e da entrevista) é fixa. Cada
 * mudança guarda a versão anterior; dá para voltar ao texto original e
 * mandar um teste para o próprio e-mail.
 */

type Campo = 'assunto' | 'titulo' | 'texto';

function Previa({ chave, assunto, titulo, texto }: { chave: ChaveDoModelo; assunto: string; titulo: string; texto: string }) {
  const info = MODELOS.find((m) => m.chave === chave)!;
  const destaque = chave === 'confirmacao' ? { rotulo: 'Protocolo', valor: EXEMPLO.protocolo, rodape: `enviada em ${EXEMPLO.data}` }
    : chave === 'convite' ? { rotulo: 'Entrevista', valor: 'sexta-feira, 24/10 às 14:00', rodape: 'Presencial · Sede' } : null;
  const comCor = ['entrevista', 'aprovado', 'convite'].includes(chave);
  return (
    <div className="overflow-hidden rounded-[16px] border border-border bg-white text-[#1F2322]" data-testid="previa">
      <div className="border-b border-border bg-[#F3F4F4] px-3 py-2 text-xs text-[#555]"><b>Assunto:</b> {preencher(assunto, EXEMPLO)}</div>
      <div className="flex flex-col gap-2.5 p-4 text-sm">
        <b className="text-[13px]">anabrasil</b>
        <h3 className={`text-lg font-bold leading-snug ${comCor ? 'rounded-xl bg-[#E6F8F3] px-3 py-2.5' : ''}`}>{preencher(titulo, EXEMPLO)}</h3>
        {paragrafos(preencher(texto, EXEMPLO)).map((p, i) => <p key={i} className="leading-relaxed text-[#333]">{p}</p>)}
        {destaque && (
          <div className="rounded-xl bg-[#E6F8F3] p-3 text-center">
            <div className="text-[11px] text-[#555]">{destaque.rotulo}</div>
            <div className="text-lg font-bold">{destaque.valor}</div>
            <div className="text-[11px] text-[#555]">{destaque.rodape}</div>
          </div>
        )}
        <span className="self-start rounded-xl bg-[#1F2322] px-4 py-2 text-[13px] font-semibold text-white">{info.botao}</span>
        <span className="text-[11px] text-[#777]">Trabalhe Conosco · ANA Brasil</span>
      </div>
      <div className="h-1.5" style={{ background: 'linear-gradient(90deg,#F5DFBB 0 20%,#FBCE00 20% 40%,#F37964 40% 60%,#81E2CF 60% 80%,#01ADFF 80% 100%)' }} />
    </div>
  );
}

export function ModelosDeEmail() {
  const [modelos, setModelos] = useState<Modelo[] | null>(null);
  const [erro, setErro] = useState(false);
  const [chave, setChave] = useState<ChaveDoModelo>('confirmacao');
  const [rascunho, setRascunho] = useState({ assunto: '', titulo: '', texto: '' });
  const [foco, setFoco] = useState<Campo>('texto');
  const [ocupado, setOcupado] = useState(false);
  const [versoes, setVersoes] = useState<Versao[] | null>(null);
  const refs = { assunto: useRef<HTMLInputElement>(null), titulo: useRef<HTMLInputElement>(null), texto: useRef<HTMLTextAreaElement>(null) };

  const carregar = () => listarModelos().then((l) => { setModelos(l); setErro(false); }).catch(() => { setErro(true); setModelos([]); });
  useEffect(() => { carregar(); }, []);

  const atual = modelos?.find((m) => m.chave === chave) ?? null;
  const info = MODELOS.find((m) => m.chave === chave)!;
  useEffect(() => { if (atual) setRascunho({ assunto: atual.assunto, titulo: atual.titulo, texto: atual.texto }); }, [atual]);

  const mudou = !!atual && (rascunho.assunto !== atual.assunto || rascunho.titulo !== atual.titulo || rascunho.texto !== atual.texto);
  const problema = useMemo(() => problemaDoModelo(info, rascunho), [info, rascunho]);

  function trocar(c: ChaveDoModelo) {
    if (mudou && !window.confirm('Sair sem salvar as mudanças deste modelo?')) return;
    setChave(c);
  }

  /** Põe {campo} onde está o cursor do último campo tocado. */
  function inserir(c: string) {
    const el = refs[foco].current;
    const valor = rascunho[foco];
    const ini = el?.selectionStart ?? valor.length, fim = el?.selectionEnd ?? valor.length;
    const novo = `${valor.slice(0, ini)}{${c}}${valor.slice(fim)}`;
    setRascunho((r) => ({ ...r, [foco]: novo }));
    requestAnimationFrame(() => { el?.focus(); const p = ini + c.length + 2; el?.setSelectionRange(p, p); });
  }

  async function salvar() {
    if (problema) { toast.error(problema); return; }
    setOcupado(true);
    try { await salvarModelo(chave, rascunho); toast.success('Modelo salvo', { description: 'Os próximos e-mails já saem com este texto.' }); await carregar(); }
    catch { toast.error('Não deu para salvar. Tente de novo.'); }
    finally { setOcupado(false); }
  }

  async function testar() {
    if (problema) { toast.error(problema); return; }
    setOcupado(true);
    try { const para = await mandarTeste(chave, rascunho); toast.success('Teste enviado', { description: para ? `Confira a caixa de ${para}.` : undefined }); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Não deu para mandar o teste.'); }
    finally { setOcupado(false); }
  }

  const original = () => atual && setRascunho({ assunto: atual.padrao_assunto, titulo: atual.padrao_titulo, texto: atual.padrao_texto });
  const abrirVersoes = () => versoesDo(chave).then(setVersoes).catch(() => toast.error('Não consegui abrir as versões.'));

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-[28px] font-bold leading-tight">Modelos de e-mail</h1>
        <p className="text-sm text-muted-foreground">{MODELOS.length} modelos · cada mudança guarda a versão anterior</p>
      </div>
      {erro && <p role="alert" className="text-sm font-semibold text-destructive">Não consegui carregar os modelos. Recarregue a página.</p>}
      {modelos === null ? <p className="text-sm text-muted-foreground">Carregando…</p> : (
        <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <nav aria-label="Modelos" className="flex flex-col self-start overflow-hidden rounded-[20px] border border-black/5 bg-card p-1.5 dark:border-white/5">
            {MODELOS.map((m) => {
              const linha = modelos.find((x) => x.chave === m.chave);
              return (
                <button key={m.chave} type="button" onClick={() => trocar(m.chave)} aria-current={chave === m.chave ? 'true' : undefined}
                  className={`rounded-[14px] px-3 py-2.5 text-left text-sm transition-colors ${chave === m.chave ? 'bg-[hsl(var(--ativo))]' : 'hover:bg-muted'}`}>
                  <b className={`block ${chave === m.chave ? 'font-semibold text-foreground' : 'font-medium text-foreground/85'}`}>{m.nome}</b>
                  <span className="text-xs text-[hsl(var(--fraco,0_0%_45%))]">{m.quando}{linha && editado(linha) ? ' · editado' : ''}</span>
                </button>
              );
            })}
          </nav>

          {atual && (
            <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="flex min-w-0 flex-col gap-3.5 rounded-[20px] border border-black/5 bg-card p-5 dark:border-white/5">
                <label className="grid gap-1.5 text-[13px] font-semibold">Assunto
                  <Input ref={refs.assunto} value={rascunho.assunto} maxLength={150} onFocus={() => setFoco('assunto')} onChange={(e) => setRascunho((r) => ({ ...r, assunto: e.target.value }))} />
                </label>
                <label className="grid gap-1.5 text-[13px] font-semibold">Título
                  <Input ref={refs.titulo} value={rascunho.titulo} maxLength={150} onFocus={() => setFoco('titulo')} onChange={(e) => setRascunho((r) => ({ ...r, titulo: e.target.value }))} />
                </label>
                <label className="grid gap-1.5 text-[13px] font-semibold">Texto <span className="font-normal text-muted-foreground">(linha em branco separa os parágrafos)</span>
                  <Textarea ref={refs.texto} rows={8} value={rascunho.texto} maxLength={2000} onFocus={() => setFoco('texto')} onChange={(e) => setRascunho((r) => ({ ...r, texto: e.target.value }))} />
                </label>
                <div className="flex flex-wrap items-center gap-1.5" aria-label="Inserir campo">
                  <span className="text-[13px] text-muted-foreground">Inserir:</span>
                  {info.campos.map((c) => (
                    <button key={c} type="button" title={DESCRICAO_DO_CAMPO[c]} onClick={() => inserir(c)}
                      className="rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-foreground transition-colors hover:bg-muted">{`{${c}}`}</button>
                  ))}
                </div>
                <p className="rounded-[12px] bg-muted px-3 py-2 text-xs text-muted-foreground">
                  {info.para === 'equipe' ? 'Este vai para a pessoa da equipe nomeada responsável.' : 'O e-mail nunca leva observações internas nem dados além do primeiro nome. Só entram os campos acima.'}
                  {info.campos.includes('mensagem') ? ' O {mensagem} é obrigatório: é onde entra o que foi escrito na ficha.' : ''}
                </p>
                {problema && <p role="alert" className="text-sm font-semibold text-destructive">{problema}</p>}
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={original} disabled={ocupado}>Voltar ao texto original</Button>
                    <Button variant="ghost" size="sm" onClick={abrirVersoes}>Versões</Button>
                  </span>
                  <span className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={testar} disabled={ocupado || !!problema}>Mandar teste para mim</Button>
                    <Button size="sm" onClick={salvar} disabled={ocupado || !mudou || !!problema}>Salvar</Button>
                  </span>
                </div>
                {atual.atualizado_em && <span className="text-xs text-[hsl(var(--fraco,0_0%_45%))]">Última mudança: {atual.atualizado_por ?? 'RH'} · {new Date(atual.atualizado_em).toLocaleString('pt-BR')}</span>}
              </div>
              <div className="flex min-w-0 flex-col gap-2">
                <h2 className="text-[15px] font-semibold">Prévia, com dados de exemplo</h2>
                <Previa chave={chave} {...rascunho} />
              </div>
            </div>
          )}
        </div>
      )}

      <Dialog open={versoes !== null} onOpenChange={(v) => { if (!v) setVersoes(null); }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Versões · {info.nome}</DialogTitle>
            <DialogDescription>Como o modelo era antes de cada mudança. "Usar esta" traz o texto para o editor; ele só vale depois de salvar.</DialogDescription>
          </DialogHeader>
          {versoes?.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma mudança ainda.</p>}
          {versoes?.map((v) => (
            <div key={v.id} className="flex flex-col gap-1.5 rounded-[16px] border border-border bg-card p-3.5 text-sm" data-testid="versao">
              <span className="text-xs text-[hsl(var(--fraco,0_0%_45%))]">{v.por ?? 'RH'} · {new Date(v.em).toLocaleString('pt-BR')}</span>
              <b>{v.assunto}</b>
              <span className="line-clamp-3 whitespace-pre-line text-muted-foreground">{v.titulo} — {v.texto}</span>
              <Button size="sm" variant="outline" className="self-start" onClick={() => { setRascunho({ assunto: v.assunto, titulo: v.titulo, texto: v.texto }); setVersoes(null); }}>Usar esta</Button>
            </div>
          ))}
        </DialogContent>
      </Dialog>
    </div>
  );
}
