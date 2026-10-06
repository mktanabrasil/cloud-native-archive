import { useEffect, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Camera, Check, FileUp, Info, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useTituloDaAba } from '@/hooks/useTituloDaAba';
import { MolduraDaConta } from '@/components/vagas/MolduraDaConta';
import { ROTAS_DO_CANDIDATO, ehCandidato } from '@/lib/vagas/conta';
import {
  CURRICULO_MAX_MB, carregarPerfil, conferirCurriculo, enviarCurriculo, linkDoCurriculo, removerCurriculo, tamanhoLegivel,
  type Perfil,
} from '@/lib/vagas/perfil';

/**
 * /vagas/curriculo — um arquivo para todas as vagas (mockup de 06/10/2026).
 * PDF, JPG ou PNG, até 10 MB, num balde privado. "Tirar foto do impresso"
 * abre a câmera do celular: muita gente só tem o currículo em papel. Trocar
 * apaga o anterior; remover pede confirmação na própria tela.
 */

type Arquivo = Pick<Perfil, 'curriculo_caminho' | 'curriculo_nome' | 'curriculo_tamanho' | 'curriculo_enviado_em'>;

const quando = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', ' às') : '';

export default function CurriculoCandidatoPage() {
  useTituloDaAba('Currículo · Trabalhe Conosco ANA Brasil');
  const { user, isAuthenticated, loading } = useAuth();
  const [arquivo, setArquivo] = useState<Arquivo | null>(null);
  const [carregado, setCarregado] = useState(false);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmarRemocao, setConfirmarRemocao] = useState(false);
  const escolher = useRef<HTMLInputElement>(null);
  const foto = useRef<HTMLInputElement>(null);

  const idDoCandidato = user && ehCandidato(user) ? user.id : null;
  useEffect(() => {
    if (!idDoCandidato) return;
    carregarPerfil(idDoCandidato)
      .then(({ perfil }) => setArquivo(perfil))
      .catch(() => setErro('Não consegui abrir. Confira a internet e recarregue a página.'))
      .finally(() => setCarregado(true));
  }, [idDoCandidato]);

  if (loading) return null;
  if (!isAuthenticated) return <Navigate to={`${ROTAS_DO_CANDIDATO.entrar}?volta=${encodeURIComponent(ROTAS_DO_CANDIDATO.curriculo)}`} replace />;
  if (!ehCandidato(user)) return <Navigate to="/" replace />;
  const userId = user!.id;
  const tem = !!arquivo?.curriculo_caminho;

  async function aoEscolher(lista: FileList | null) {
    const f = lista?.[0];
    if (escolher.current) escolher.current.value = '';
    if (foto.current) foto.current.value = '';
    if (!f) return;
    const recusa = conferirCurriculo(f);
    if (recusa) { setErro(recusa); return; }
    setErro(null); setConfirmarRemocao(false); setEnviando(f.name);
    try {
      const novo = await enviarCurriculo(userId, f, arquivo?.curriculo_caminho ?? null);
      setArquivo(novo);
    } catch {
      setErro('O envio não terminou. Confira a internet e tente de novo.');
    } finally {
      setEnviando(null);
    }
  }

  async function ver() {
    if (!arquivo?.curriculo_caminho) return;
    // Abre a aba já no clique (o navegador barra janela aberta depois de um await).
    const aba = window.open('', '_blank');
    try {
      const url = await linkDoCurriculo(arquivo.curriculo_caminho);
      if (aba) aba.location.href = url; else window.location.href = url;
    } catch {
      aba?.close();
      setErro('Não consegui abrir o arquivo agora. Tente de novo.');
    }
  }

  async function remover() {
    if (!arquivo?.curriculo_caminho) return;
    try {
      await removerCurriculo(userId, arquivo.curriculo_caminho);
      setArquivo({ curriculo_caminho: null, curriculo_nome: null, curriculo_tamanho: null, curriculo_enviado_em: null });
      setConfirmarRemocao(false);
    } catch {
      setErro('Não deu para remover. Tente de novo.');
    }
  }

  const ext = (arquivo?.curriculo_nome ?? '').split('.').pop()?.toUpperCase().slice(0, 4) || 'PDF';

  return (
    <MolduraDaConta atalho={<Link to={ROTAS_DO_CANDIDATO.minhaArea} className="text-foreground hover:text-primary">Minha área</Link>}>
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 pb-10 pt-4 sm:px-6">
        <div className="flex items-center justify-between">
          <h1 className="text-[26px] font-bold leading-tight sm:text-[30px]">Seu currículo</h1>
          {tem && !enviando && <span className="flex items-center gap-1 text-sm font-semibold text-emerald-700 dark:text-emerald-400"><Check className="h-4 w-4" /> Recebido</span>}
        </div>

        <input ref={escolher} type="file" accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png" className="hidden" data-testid="escolher-curriculo" onChange={(e) => aoEscolher(e.target.files)} />
        <input ref={foto} type="file" accept="image/*" capture="environment" className="hidden" data-testid="foto-do-curriculo" onChange={(e) => aoEscolher(e.target.files)} />

        {!carregado ? (
          <p className="text-muted-foreground">Abrindo…</p>
        ) : enviando ? (
          <div className="flex items-center gap-3 rounded-2xl bg-muted/60 p-3" aria-live="polite">
            <span className="grid h-14 w-11 shrink-0 place-items-center rounded-lg bg-[#FDE7E2] text-xs font-bold text-[#B23A25]">…</span>
            <div className="min-w-0 flex-1">
              <b className="block truncate text-sm">{enviando}</b>
              <span className="text-sm text-muted-foreground">Enviando…</span>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full w-2/3 animate-pulse rounded-full bg-[#81E2CF]" /></div>
            </div>
          </div>
        ) : tem ? (
          <>
            <div className="flex items-center gap-3 rounded-2xl bg-muted/60 p-3">
              <span className="grid h-14 w-11 shrink-0 place-items-center rounded-lg bg-[#FDE7E2] text-xs font-bold text-[#B23A25]">{ext}</span>
              <div className="min-w-0">
                <b className="block break-all text-sm">{arquivo!.curriculo_nome}</b>
                <span className="text-sm text-muted-foreground">{tamanhoLegivel(arquivo!.curriculo_tamanho)} · enviado em {quando(arquivo!.curriculo_enviado_em)}</span>
              </div>
            </div>
            {confirmarRemocao ? (
              <div className="flex flex-col gap-3 rounded-2xl bg-red-50 p-4 text-red-950 dark:bg-red-950/50 dark:text-red-100" role="alert">
                <p className="font-semibold">Remover o currículo?</p>
                <p className="text-sm">O arquivo é apagado. Seu perfil continua.</p>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setConfirmarRemocao(false)}>Cancelar</Button>
                  <Button variant="destructive" onClick={remover}>Remover</Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                <Button variant="secondary" className="h-12 rounded-xl" onClick={ver}>Ver</Button>
                <Button variant="secondary" className="h-12 rounded-xl" onClick={() => escolher.current?.click()}>Trocar</Button>
                <Button variant="secondary" className="h-12 rounded-xl text-red-700 dark:text-red-400" onClick={() => setConfirmarRemocao(true)}>Remover</Button>
              </div>
            )}
            <ul className="flex flex-col gap-2 text-sm">
              <li className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"><Check className="h-4 w-4" /></span>Vale para todas as candidaturas</li>
              <li className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-sky-50 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300"><Lock className="h-4 w-4" /></span>Só o RH do processo vê</li>
            </ul>
          </>
        ) : (
          <>
            <div className="flex flex-col items-center gap-3 rounded-[20px] bg-[#FFF5CC] p-5 text-center text-[#1F2322] dark:bg-[#3A3212] dark:text-foreground">
              <FileUp className="h-10 w-10" aria-hidden />
              <Button className="h-12 w-full rounded-xl" onClick={() => escolher.current?.click()}>Escolher arquivo</Button>
              <Button variant="outline" className="h-12 w-full rounded-xl" onClick={() => foto.current?.click()}><Camera className="h-4 w-4" /> Tirar foto do impresso</Button>
              <span className="text-xs">PDF, JPG ou PNG · até {CURRICULO_MAX_MB} MB</span>
            </div>
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><Info className="h-4 w-4 shrink-0 text-sky-700 dark:text-sky-400" /> Sem currículo? Seu perfil já conta sua história.</p>
          </>
        )}

        {erro && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-900 dark:bg-red-950/60 dark:text-red-100">{erro}</p>}
      </div>
    </MolduraDaConta>
  );
}
