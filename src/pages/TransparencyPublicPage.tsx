import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
// O embed usa a versão de antes do redesenho (26/10/2026): o site já o incorpora.
import { DriveExplorer } from '@/classico/TransparencyPage';
import { InstitutionalFooterBar } from '@/components/news/InstitutionalFooterBar';
import { useIframeHeightReporter } from '@/hooks/useIframeHeightReporter';

interface TransparencyConfig {
  id: string;
  label: string;
  folder_id: string;
  original_folder_name: string | null;
}

export default function TransparencyPublicPage() {
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id');
  const isEmbed = searchParams.get('embed') === 'true';

  const [config, setConfig] = useState<TransparencyConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useIframeHeightReporter('resize-iframe');

  useEffect(() => {
    if (isEmbed) {
      document.documentElement.classList.add('mercado-embed');
      return () => document.documentElement.classList.remove('mercado-embed');
    }
  }, [isEmbed]);

  useEffect(() => {
    if (!id) { setNotFound(true); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('transparency_configs')
        .select('id, label, folder_id, original_folder_name')
        .eq('id', id)
        .maybeSingle();
      if (cancelled) return;
      if (!data) { setNotFound(true); } else { setConfig(data as TransparencyConfig); }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound || !config) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-2 text-center px-4">
        <h1 className="text-xl font-semibold">Unidade não encontrada</h1>
        <p className="text-sm text-muted-foreground">O link acessado não corresponde a nenhuma unidade publicada.</p>
      </div>
    );
  }

  const isV2 = searchParams.get('v') === '2';
  const rawUnitName = config.original_folder_name || config.label;
  const unitName = rawUnitName.replace(/^\d+[\.\-\)\s]*\s*/, '').trim();


  if (isV2) {
    return (
      <div className="bg-background min-h-screen">
        <main className="w-full px-4 py-6 lg:px-8">
          <div className="mx-auto max-w-5xl space-y-6">
            <div className="bg-card border rounded-lg overflow-hidden">
              <div className="p-4 md:p-6 min-h-[200px] flex flex-col gap-1">
                <DriveExplorer folderId={config.folder_id} folderName={config.label} />
              </div>
            </div>
            <div className="pt-4">
              <InstitutionalFooterBar className="rounded-md" />
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Portal da Transparência — {unitName}.
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen">
      <main className="w-full px-4 py-6 lg:px-8">
        <div className="mx-auto max-w-5xl space-y-6">
          <header className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Portal da Transparência</p>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">{config.label}</h1>
            {config.original_folder_name && config.original_folder_name !== config.label && (
              <p className="text-sm text-muted-foreground">{config.original_folder_name}</p>
            )}
          </header>

          <div className="bg-card border rounded-lg overflow-hidden">
            <div className="p-4 md:p-6 min-h-[200px] flex flex-col gap-1">
              <DriveExplorer folderId={config.folder_id} folderName={config.label} />
            </div>
          </div>

          <div className="pt-4">
            <InstitutionalFooterBar className="rounded-md" />
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Portal da Transparência — Grupo ANA Brasil.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
