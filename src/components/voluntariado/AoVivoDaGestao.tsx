import { useEffect, useState } from 'react';
import { Copy, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { definirMeta, lerConfig, linkDoAoVivo, trocarCodigo, type ConfigDoAoVivo } from '@/lib/voluntariado/aoVivo';

/**
 * O link do painel ao vivo para a gestão (21/10/2026), no painel do
 * Marketing: copiar, abrir, trocar (desliga o antigo, se ele vazar) e a meta
 * de voluntários (sem número, a barra "rumo à meta" não aparece).
 */
export function AoVivoDaGestao() {
  const [cfg, setCfg] = useState<ConfigDoAoVivo | null>(null);
  const [meta, setMeta] = useState('');
  const [trocando, setTrocando] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => { lerConfig().then((c) => { setCfg(c); setMeta(c?.meta ? String(c.meta) : ''); }).catch(() => setCfg(null)); }, []);
  if (!cfg) return null;
  const link = linkDoAoVivo(cfg.codigo_acompanhamento);

  async function copiar() {
    try { await navigator.clipboard.writeText(link); toast.success('Link do painel ao vivo copiado.'); }
    catch { toast.message(link); }
  }

  async function trocar() {
    setOcupado(true); setTrocando(false);
    try { const novo = await trocarCodigo(); setCfg((c) => (c ? { ...c, codigo_acompanhamento: novo } : c)); toast.success('Link trocado', { description: 'O antigo parou de funcionar. Mande o novo para a gestão.' }); }
    catch { toast.error('Não deu para trocar o link.'); }
    finally { setOcupado(false); }
  }

  async function salvarMeta() {
    const n = meta.trim() ? Number(meta) : null;
    if (n !== null && (!Number.isInteger(n) || n < 1 || n > 5000)) { toast.error('A meta é um número de 1 a 5.000 (ou vazio, sem meta).'); return; }
    setOcupado(true);
    try { await definirMeta(n); setCfg((c) => (c ? { ...c, meta: n } : c)); toast.success(n ? `Meta de ${n} voluntários salva.` : 'Meta tirada: a barra some do painel.'); }
    catch { toast.error('Não deu para salvar a meta.'); }
    finally { setOcupado(false); }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-black/5 bg-card px-4 py-3.5 dark:border-white/5" data-testid="ao-vivo-da-gestao">
      {/* Esboço V2: título de bloco sem ícone; ações discretas */}
      <span className="min-w-0 flex-1 basis-72 text-sm">
        <b className="block text-[15px] font-semibold">Painel ao vivo para a gestão</b>
        <span className="text-muted-foreground">Link com código secreto; só mostra o andamento (sem WhatsApp) e se atualiza sozinho.</span>
      </span>
      <span className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-[13px] font-semibold">Meta
          <Input aria-label="Meta de voluntários" inputMode="numeric" className="h-9 w-20 tabular-nums" placeholder="sem" value={meta} onChange={(e) => setMeta(e.target.value.replace(/\D/g, '').slice(0, 4))} />
        </label>
        <Button variant="outline" size="sm" disabled={ocupado || (meta.trim() ? Number(meta) : null) === cfg.meta} onClick={salvarMeta}>Salvar meta</Button>
        <Button variant="outline" size="sm" onClick={copiar}><Copy className="h-4 w-4" /> Copiar link</Button>
        <Button asChild variant="outline" size="sm"><a href={link} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /> Abrir</a></Button>
        <Button variant="ghost" size="sm" disabled={ocupado} onClick={() => setTrocando(true)}>Trocar o link</Button>
      </span>
      <AlertDialog open={trocando} onOpenChange={setTrocando}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Trocar o link do painel ao vivo?</AlertDialogTitle>
            <AlertDialogDescription>O link de agora para de funcionar na hora, para todo mundo que o tem. Use se ele foi parar com quem não devia; depois mande o novo para a gestão.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={trocar}>Trocar o link</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
