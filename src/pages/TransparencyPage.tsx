import { useState, useEffect, useCallback } from 'react';
import { PUBLIC_APP_ORIGIN } from '@/lib/utils';
import { useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { 
  Folder, 
  ChevronRight, 
  ChevronDown, 
  FileText, 
  ExternalLink, 
  Loader2, 
  Search,
  Settings,
  Plus,
  Trash2,
  Copy,
  Check,
  LogIn,
  Download,
  Maximize2,
  X,
  FileCode,
  FileSpreadsheet,
  FileVideo,
  FileImage,
  FileArchive,
  File,
  Edit2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Layers,
  CheckCircle2,
  Globe
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import PageHeader from '@/components/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface DriveItem {
  id: string;
  name: string;
  mimeType: string;
  shortcutDetails?: {
    targetId: string;
    targetMimeType: string;
  };
  children?: DriveItem[];
}

const TransparencyPage = () => {
  const { isAdmin } = useUserRole();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [configs, setConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [newFolderId, setNewFolderId] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [originalFolderName, setOriginalFolderName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [publicUrlConfig, setPublicUrlConfig] = useState<{ id: string; label: string } | null>(null);
  const [publicUrlCopied, setPublicUrlCopied] = useState<'url' | 'html' | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [hasGoogleAuth, setHasGoogleAuth] = useState<boolean | null>(null);
  const [googleAccount, setGoogleAccount] = useState<string | null>(null);
  const [editingConfig, setEditingConfig] = useState<{ id: string, label: string } | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | 'none'>('asc');
  const [isBatchAdding, setIsBatchAdding] = useState(false);
  const [batchStep, setBatchAddingStep] = useState<'select' | 'rename'>('select');
  const [selectedItems, setSelectedItems] = useState<DriveItem[]>([]);
  const [expandedConfigs, setExpandedConfigs] = useState<Set<string>>(new Set());
  const rootBatchFolderId = "14JkYMo16TCP1YT2ZO-EH1g2OJ-rdB0Mg";

  const toggleConfig = (id: string) => {
    setExpandedConfigs(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const checkGoogleAuth = useCallback(async () => {
    // Use the edge function (service role) to check the global connection,
    // since global_settings is not readable by non-admin users via RLS.
    const { data } = await supabase.functions.invoke('google-drive-proxy', {
      body: { action: 'check_auth' }
    });
    setHasGoogleAuth(!!(data as any)?.connected);
    setGoogleAccount((data as any)?.email ?? null);
  }, []);

  useEffect(() => {
    const handleOAuthResponse = async () => {
      const code = searchParams.get('code');
      const isGoogleConnect = searchParams.get('type') === 'google_connect' && code;

      if (isGoogleConnect) {
        setLoading(true);
        try {
          const redirectUri = window.location.origin + '/portal-transparencia?type=google_connect';
          const { data, error } = await supabase.functions.invoke('google-drive-proxy', {
            body: { action: 'exchange_code', code, redirectUri }
          });
          if (!error && (data as any)?.connected) {
            toast.success('Google Drive conectado globalmente!');
            setHasGoogleAuth(true);
          } else {
            toast.error('Não foi possível conectar o Google Drive');
          }
        } catch (err: any) {
          console.error(err);
        } finally {
          searchParams.delete('type');
          searchParams.delete('code');
          searchParams.delete('scope');
          searchParams.delete('authuser');
          searchParams.delete('prompt');
          setSearchParams(searchParams, { replace: true });
          setLoading(false);
          checkGoogleAuth();
        }
      }
    };

    handleOAuthResponse();
    checkGoogleAuth();
  }, [checkGoogleAuth, searchParams, setSearchParams]);


  useEffect(() => {
    if (searchParams.get('embed') === 'true') {
      const calculateHeight = () => {
        const root = document.getElementById('root');
        if (root) {
          const openViewer = document.querySelector('[id^="viewer-"]');
          
          if (openViewer) {
            window.parent.postMessage({ type: 'resize-iframe', height: window.innerHeight, isFullscreen: true }, '*');
          } else {
            const contentElement = root.querySelector('.bg-transparent.w-full.overflow-hidden.m-0');
            const height = contentElement ? (contentElement as HTMLElement).offsetHeight : root.offsetHeight;
            if (height > 0) {
              window.parent.postMessage({ type: 'resize-iframe', height, isFullscreen: false }, '*');
            }
          }
        }
      };

      // Set up MutationObserver to detect when the viewer is added to the DOM immediately
      const observer = new MutationObserver(() => {
        calculateHeight();
      });

      observer.observe(document.body, { 
        childList: true, 
        subtree: true 
      });

      const interval = setInterval(calculateHeight, 100);
      return () => {
        observer.disconnect();
        clearInterval(interval);
      };
    }
  }, [searchParams, loading, configs]);

  const handleGoogleLogin = async () => {
    setIsAuthenticating(true);
    try {
      const redirectUri = window.location.origin + '/portal-transparencia?type=google_connect';
      const { data, error } = await supabase.functions.invoke('google-drive-proxy', {
        body: { action: 'get_auth_url', redirectUri }
      });
      if (error || !(data as any)?.url) throw error || new Error('no_url');
      // Redirect straight to Google's consent screen (keeps the current app session intact)
      window.location.href = (data as any).url;
    } catch (error) {
      console.error('Error Google OAuth:', error);
      toast.error('Erro ao iniciar autenticação Google');
      setIsAuthenticating(false);
    }
  };

  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);

  const handleGoogleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-drive-proxy', {
        body: { action: 'disconnect' }
      });
      if (error || (data as any)?.connected) throw error || new Error('failed');
      setHasGoogleAuth(false);
      setGoogleAccount(null);
      toast.success('Google Drive desconectado');
    } catch (err) {
      console.error('Error disconnecting Drive:', err);
      toast.error('Erro ao desconectar o Google Drive');
    } finally {
      setIsDisconnecting(false);
      setShowDisconnectDialog(false);
    }
  };

  const syncOriginalName = async (config: any) => {
    try {
      const { data, error } = await supabase.functions.invoke('google-drive-proxy', {
        body: { action: 'get_folder_name', folderId: config.folder_id }
      });
      if (!error && data?.name) {
        await supabase.from('transparency_configs').update({ original_folder_name: data.name }).eq('id', config.id);
        setConfigs(prev => prev.map(c => c.id === config.id ? { ...c, original_folder_name: data.name } : c));
      }
    } catch (err) {
      console.error('Error syncing name:', err);
    }
  };

  const fetchConfigs = async () => {
    try {
      const { data, error } = await supabase
        .from('transparency_configs')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const fetchedConfigs = data || [];
      setConfigs(fetchedConfigs);
      fetchedConfigs.forEach(config => {
        if (!config.original_folder_name) syncOriginalName(config);
      });
    } catch (error) {
      console.error('Error fetching configs:', error);
      toast.error('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  const extractFolderId = (input: string) => {
    let id = input.trim();
    const patterns = [/\/folders\/([a-zA-Z0-9_-]{25,})/, /[?&]id=([a-zA-Z0-9_-]{25,})/, /\/file\/d\/([a-zA-Z0-9_-]{25,})/, /\/d\/([a-zA-Z0-9_-]{25,})/];
    for (const pattern of patterns) {
      const match = id.match(pattern);
      if (match && match[1]) { id = match[1]; break; }
    }
    return id.includes('?') ? id.split('?')[0] : id;
  };

  const [isFetchingName, setIsFetchingName] = useState(false);
  const fetchFolderName = async (input: string) => {
    const id = extractFolderId(input);
    if (id.length < 25) return;
    setIsFetchingName(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-drive-proxy', {
        body: { action: 'get_folder_name', folderId: id }
      });
      if (!error && data?.name) {
        setOriginalFolderName(data.name);
        if (!newLabel) {
          setNewLabel(data.name);
          toast.info(`Título preenchido automaticamente: ${data.name}`);
        }
      }
    } catch (err) {
      console.error('Error fetching folder name:', err);
    } finally {
      setIsFetchingName(false);
    }
  };

  const handleAddConfig = async () => {
    if (!newFolderId || !newLabel) { toast.error('Preencha todos os campos'); return; }
    const folderId = extractFolderId(newFolderId);
    try {
      const { error } = await supabase.from('transparency_configs').insert([{ folder_id: folderId, label: newLabel, original_folder_name: originalFolderName }]);
      if (error) throw error;
      toast.success('Configuração adicionada');
      setNewFolderId(''); setNewLabel(''); setOriginalFolderName(''); setIsAdding(false);
      fetchConfigs();
    } catch (error: any) {
      toast.error('Erro ao salvar configuração');
    }
  };

  const handleBatchSave = async (itemsWithNames: { id: string, name: string, originalName: string }[]) => {
    try {
      const inserts = itemsWithNames.map(item => ({
        folder_id: item.id,
        label: item.name,
        original_folder_name: item.originalName
      }));

      const { error } = await supabase
        .from('transparency_configs')
        .insert(inserts);
      
      if (error) throw error;
      
      toast.success(`${inserts.length} pastas adicionadas com sucesso!`);
      setIsBatchAdding(false);
      setSelectedItems([]);
      setBatchAddingStep('select');
      fetchConfigs();
    } catch (error: any) {
      console.error('Error batch adding:', error);
      toast.error('Erro ao salvar em lote');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('transparency_configs').delete().eq('id', id);
      if (error) throw error;
      toast.success('Configuração removida');
      fetchConfigs();
    } catch (error) {
      toast.error('Erro ao remover configuração');
    }
  };

  const handleUpdateLabel = async () => {
    if (!editingConfig) return;
    try {
      const { error } = await supabase.from('transparency_configs').update({ label: editingConfig.label }).eq('id', editingConfig.id);
      if (error) throw error;
      toast.success('Nome atualizado');
      setEditingConfig(null);
      fetchConfigs();
    } catch (error) {
      toast.error('Erro ao atualizar nome');
    }
  };

  const copyEmbedCode = (id: string) => {
    const publicOrigin = PUBLIC_APP_ORIGIN;
    const embedUrl = `${publicOrigin}/portal-transparencia-publico?id=${id}&embed=true`;
    const embedCode = `<iframe id="iframe-${id}" src="${embedUrl}" width="100%" frameborder="0" scrolling="no" style="overflow:hidden; transition: height 0.1s ease-out; border: none;" allow="fullscreen; clipboard-write"></iframe>
<script>
(function() {
  var iframe = document.getElementById('iframe-${id}');
  var isFS = false;
  
  window.addEventListener('message', function(e) {
    if (e.data.type === 'resize-iframe' && e.data.height) {
      if (e.data.isFullscreen) {
        if (!isFS) {
          isFS = true;
          iframe.style.setProperty('position', 'fixed', 'important');
          iframe.style.setProperty('top', '0', 'important');
          iframe.style.setProperty('left', '0', 'important');
          iframe.style.setProperty('width', '100vw', 'important');
          iframe.style.setProperty('height', '100vh', 'important');
          iframe.style.setProperty('z-index', '2147483647', 'important');
          iframe.style.setProperty('margin', '0', 'important');
          document.body.style.overflow = 'hidden';
        }
      } else if (isFS || !iframe.style.height) {
        isFS = false;
        iframe.style.position = 'relative';
        iframe.style.width = '100%';
        iframe.style.height = e.data.height + 'px';
        iframe.style.zIndex = 'auto';
        iframe.style.top = 'auto';
        iframe.style.left = 'auto';
        document.body.style.overflow = 'auto';
      } else {
        iframe.style.height = e.data.height + 'px';
      }
    }
  }, false);
})();
</script>`;
    navigator.clipboard.writeText(embedCode);
    setCopiedId(id);
    toast.success('Código embed atualizado copiado!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const copyEmbedCodeV2 = (id: string) => {
    const publicOrigin = PUBLIC_APP_ORIGIN;
    const embedUrl = `${publicOrigin}/portal-transparencia-publico?id=${id}&embed=true&v=2`;
    const embedCode = `<iframe id="iframe-${id}" src="${embedUrl}" width="100%" frameborder="0" scrolling="no" style="overflow:hidden; transition: height 0.1s ease-out; border: none;" allow="fullscreen; clipboard-write"></iframe>
<script>
(function() {
  var iframe = document.getElementById('iframe-${id}');
  var isFS = false;
  window.addEventListener('message', function(e) {
    if (e.data.type === 'resize-iframe' && e.data.height) {
      if (e.data.isFullscreen) {
        if (!isFS) {
          isFS = true;
          iframe.style.setProperty('position', 'fixed', 'important');
          iframe.style.setProperty('top', '0', 'important');
          iframe.style.setProperty('left', '0', 'important');
          iframe.style.setProperty('width', '100vw', 'important');
          iframe.style.setProperty('height', '100vh', 'important');
          iframe.style.setProperty('z-index', '2147483647', 'important');
          iframe.style.setProperty('margin', '0', 'important');
          document.body.style.overflow = 'hidden';
        }
      } else if (isFS || !iframe.style.height) {
        isFS = false;
        iframe.style.position = 'relative';
        iframe.style.width = '100%';
        iframe.style.height = e.data.height + 'px';
        iframe.style.zIndex = 'auto';
        iframe.style.top = 'auto';
        iframe.style.left = 'auto';
        document.body.style.overflow = 'auto';
      } else {
        iframe.style.height = e.data.height + 'px';
      }
    }
  }, false);
})();
</script>`;
    navigator.clipboard.writeText(embedCode);
    setCopiedId(id + '-v2');
    toast.success('Novo código embed copiado!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const isEmbed = searchParams.get('embed') === 'true';
  const embedId = searchParams.get('id');

  if (!isEmbed && !isAdmin && user?.email !== 'mkt@anabrasil.org' && user?.email !== 'transparencia@anabrasil.org' && user?.email !== 'contato@anabrasil.org') {
    return <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4"><h1 className="text-2xl font-bold text-destructive">Acesso Restrito</h1></div>;
  }

  const filteredConfigs = embedId ? configs.filter(c => c.id === embedId) : configs;
  const sortedConfigs = [...filteredConfigs].sort((a, b) => {
    const nameA = (a.original_folder_name || a.label || '').toLowerCase();
    const nameB = (b.original_folder_name || b.label || '').toLowerCase();
    
    if (sortOrder === 'desc') return nameB.localeCompare(nameA, undefined, { numeric: true, sensitivity: 'base' });
    return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
  });

  if (isEmbed) {
    return (
      <div className="p-0 bg-transparent w-full overflow-hidden m-0">
        {loading ? <div className="flex justify-center py-2"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : 
         sortedConfigs.length === 0 ? <div className="p-2 text-center text-muted-foreground text-sm">Pasta não encontrada.</div> : (
          <div className="flex flex-col gap-0 w-full m-0 p-0">
            {sortedConfigs.map((config) => (
              <div key={config.id} className="w-full m-0">
                <div className="p-0 flex flex-col gap-1 w-full overflow-visible">
                  <DriveExplorer folderId={config.folder_id} folderName={config.label} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {hasGoogleAuth === false && (
        <Card className="mb-8 border-amber-200 bg-amber-50">
          <CardHeader><CardTitle className="text-amber-800 flex items-center gap-2"><LogIn className="h-5 w-5" /> Conexão Necessária</CardTitle></CardHeader>
          <CardContent><Button onClick={handleGoogleLogin} className="bg-[#4285F4] hover:bg-[#357abd]">{isAuthenticating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />} Conectar Google Drive</Button></CardContent>
        </Card>
      )}

      <PageHeader
        title="Portal da Transparência"
        description="Documentos e pastas compartilhadas para consulta pública."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => { const next: Record<string, any> = { none: 'asc', asc: 'desc', desc: 'none' }; setSortOrder(next[sortOrder]); }} className="gap-2 h-10">
              {sortOrder === 'none' && <ArrowUpDown className="h-4 w-4" />}
              {sortOrder === 'asc' && <ArrowUp className="h-4 w-4" />}
              {sortOrder === 'desc' && <ArrowDown className="h-4 w-4" />}
              Ordenar {sortOrder !== 'none' && (sortOrder === 'asc' ? '(A-Z)' : '(Z-A)')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsBatchAdding(true);
                setBatchAddingStep('select');
                setSelectedItems([]);
              }}
              className="gap-2 h-10"
            >
              <Layers className="h-4 w-4" />
              Adicionar em Lote
            </Button>
            <Dialog open={isAdding} onOpenChange={setIsAdding}>
              <DialogTrigger asChild><Button className="gap-2 h-10"><Plus className="h-4 w-4" /> Nova Pasta</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Adicionar Pasta</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2"><label className="text-sm font-medium">Nome / Rótulo</label><Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} /></div>
                  <div className="space-y-2"><label className="text-sm font-medium">Link ou ID da Pasta</label><div className="relative"><Input value={newFolderId} onChange={(e) => { setNewFolderId(e.target.value); if (e.target.value.length > 20) fetchFolderName(e.target.value); }} className={isFetchingName ? "pr-10" : ""} />{isFetchingName && <div className="absolute right-3 top-1/2 -translate-y-1/2"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>}</div></div>
                </div>
                <DialogFooter><Button onClick={handleAddConfig}>Salvar</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      {hasGoogleAuth === true && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
            <CheckCircle2 className="h-3.5 w-3.5" /> Google Drive conectado
            {googleAccount && <span className="font-semibold">· {googleAccount}</span>}
          </span>
          {isAdmin && (
            <Dialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-destructive hover:text-destructive">
                  <X className="h-3.5 w-3.5" /> Desconectar Google Drive
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Desconectar Google Drive?</DialogTitle>
                  <DialogDescription>
                    Isso removerá a conexão global com o Google Drive{googleAccount ? ` (${googleAccount})` : ''}. As pastas continuarão salvas, mas o conteúdo (arquivos e embeds) não carregará até reconectar.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowDisconnectDialog(false)} disabled={isDisconnecting}>Cancelar</Button>
                  <Button variant="destructive" onClick={handleGoogleDisconnect} disabled={isDisconnecting}>
                    {isDisconnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Desconectar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      )}


      {loading ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : (
        <div className="grid gap-6">
          {sortedConfigs.map((config) => {
            const isExpanded = expandedConfigs.has(config.id);
            return (
              <Card key={config.id} className="overflow-hidden">
                <CardHeader 
                  className="bg-muted/30 pb-4 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => toggleConfig(config.id)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div>
                        <CardTitle className="text-xl flex items-center gap-2">
                          {config.label}
                          {config.original_folder_name && config.original_folder_name !== config.label && (
                            <span className="text-sm font-normal text-muted-foreground">({config.original_folder_name})</span>
                          )}
                          <ChevronRight className={cn("h-5 w-5 text-muted-foreground ml-2 transition-transform duration-200", isExpanded ? "rotate-90" : "rotate-0")} />
                        </CardTitle>
                        <CardDescription className="font-mono text-xs mt-1">ID: {config.folder_id}</CardDescription>
                      </div>
                    </div>
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" onClick={() => setEditingConfig({ id: config.id, label: config.label })}><Edit2 className="h-4 w-4" /></Button>
                      <Button variant="outline" size="sm" onClick={() => copyEmbedCode(config.id)}>{copiedId === config.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} Embed</Button>
                      <Button variant="outline" size="sm" onClick={() => copyEmbedCodeV2(config.id)}>{copiedId === config.id + '-v2' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} Embed v2</Button>
                      <Button variant="outline" size="sm" onClick={() => setPublicUrlConfig({ id: config.id, label: config.label })}><Globe className="h-4 w-4" /> URL Pública</Button>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(config.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                </CardHeader>
                {isExpanded && (
                  <CardContent className="p-0 border-t">
                    <div className="p-6">
                      <div className="bg-card border rounded-lg overflow-hidden">
                        <div className="p-4 min-h-[200px] flex flex-col gap-1">
                          <DriveExplorer folderId={config.folder_id} folderName={config.label} />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
      <Dialog open={!!editingConfig} onOpenChange={(open) => !open && setEditingConfig(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Nome</DialogTitle></DialogHeader>
          <div className="py-4"><Input value={editingConfig?.label || ''} onChange={(e) => setEditingConfig(prev => prev ? { ...prev, label: e.target.value } : null)} /></div>
          <DialogFooter><Button onClick={handleUpdateLabel}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!publicUrlConfig} onOpenChange={(open) => { if (!open) { setPublicUrlConfig(null); setPublicUrlCopied(null); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Globe className="h-5 w-5" /> URL Pública</DialogTitle>
            <DialogDescription>
              Compartilhe esta unidade como uma página pública ou incorpore-a nativamente em um site WordPress.
            </DialogDescription>
          </DialogHeader>
          {publicUrlConfig && (() => {
            const publicOrigin = PUBLIC_APP_ORIGIN;
            const publicUrl = `${publicOrigin}/portal-transparencia-publico?id=${publicUrlConfig.id}&v=2`;
            const wpHtml = `<iframe src="${publicUrl}&embed=true" width="100%" style="border:0;min-height:600px" loading="lazy" title="${publicUrlConfig.label}"></iframe>`;
            const copy = (text: string, kind: 'url' | 'html') => {
              navigator.clipboard.writeText(text);
              setPublicUrlCopied(kind);
              toast.success(kind === 'url' ? 'URL copiada!' : 'HTML copiado!');
              setTimeout(() => setPublicUrlCopied(null), 2000);
            };
            return (
              <div className="space-y-5 py-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">URL Pública</label>
                  <div className="flex gap-2">
                    <Input readOnly value={publicUrl} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
                    <Button variant="outline" size="sm" onClick={() => copy(publicUrl, 'url')} className="shrink-0 gap-1.5">
                      {publicUrlCopied === 'url' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} Copiar URL
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Página pública sem login, layout enxuto (apenas pastas + rodapé com o nome da unidade).</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Código para WordPress</label>
                  <textarea readOnly value={wpHtml} className="w-full h-24 font-mono text-xs p-3 rounded-md border bg-muted/30 resize-none" onFocus={(e) => e.currentTarget.select()} />
                  <div className="flex justify-end">
                    <Button variant="outline" size="sm" onClick={() => copy(wpHtml, 'html')} className="gap-1.5">
                      {publicUrlCopied === 'html' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} Copiar HTML
                    </Button>
                  </div>
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPublicUrlConfig(null); setPublicUrlCopied(null); }}>Fechar</Button>
            {publicUrlConfig && (
              <Button onClick={() => window.open(`${PUBLIC_APP_ORIGIN}/portal-transparencia-publico?id=${publicUrlConfig.id}&v=2`, '_blank')} className="gap-1.5">
                <ExternalLink className="h-4 w-4" /> Abrir Página Pública
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <BatchAddDialog 
        isOpen={isBatchAdding} 
        onClose={() => setIsBatchAdding(false)} 
        rootFolderId={rootBatchFolderId}
        onSave={handleBatchSave}
      />
    </div>
  );
};

const BatchAddDialog = ({ isOpen, onClose, rootFolderId, onSave }: { 
  isOpen: boolean, 
  onClose: () => void, 
  rootFolderId: string,
  onSave: (items: { id: string, name: string, originalName: string }[]) => void
}) => {
  const [step, setStep] = useState<'select' | 'rename'>('select');
  const [selectedItems, setSelectedItems] = useState<DriveItem[]>([]);
  const [renameList, setRenameList] = useState<{ id: string, name: string, originalName: string }[]>([]);

  useEffect(() => {
    if (!isOpen) {
      setStep('select');
      setSelectedItems([]);
      setRenameList([]);
    }
  }, [isOpen]);

  const toggleItemSelection = (item: DriveItem) => {
    setSelectedItems(prev => {
      const exists = prev.find(i => i.id === item.id);
      if (exists) return prev.filter(i => i.id !== item.id);
      return [...prev, item];
    });
  };

  const handleNextStep = () => {
    setRenameList(selectedItems.map(item => ({
      id: item.id,
      name: item.name,
      originalName: item.name
    })));
    setStep('rename');
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{step === 'select' ? 'Selecionar Pastas em Lote' : 'Renomear Unidades'}</DialogTitle>
          <DialogDescription>
            {step === 'select' ? 'Navegue e selecione as pastas que deseja adicionar.' : 'Ajuste os nomes das unidades antes de salvar.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-[400px] py-4">
          {step === 'select' ? (
            <BatchDriveExplorer 
              folderId={rootFolderId} 
              selectedIds={selectedItems.map(i => i.id)}
              onToggleSelection={toggleItemSelection}
            />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 font-medium border-b pb-2 text-sm text-muted-foreground">
                <div>Nome Original</div>
                <div>Nome Personalizado</div>
              </div>
              {renameList.map((item, index) => (
                <div key={item.id} className="grid grid-cols-2 gap-4 items-center">
                  <div className="text-sm truncate">{item.originalName}</div>
                  <Input 
                    value={item.name}
                    onChange={(e) => {
                      const newList = [...renameList];
                      newList[index].name = e.target.value;
                      setRenameList(newList);
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          {step === 'select' ? (
            <Button 
              disabled={selectedItems.length === 0}
              onClick={handleNextStep}
            >
              Prosseguir ({selectedItems.length})
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setStep('select')}>Voltar</Button>
              <Button onClick={() => onSave(renameList)}>Salvar em Lote</Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const BatchDriveExplorer = ({ folderId, selectedIds, onToggleSelection }: { 
  folderId: string, 
  selectedIds: string[],
  onToggleSelection: (item: DriveItem) => void 
}) => {
  const [items, setItems] = useState<DriveItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFiles = async () => {
      setLoading(true);
      try {
        const { data } = await supabase.functions.invoke('google-drive-proxy', {
          body: { action: 'list_files', folderId }
        });
        setItems(data.files || []);
      } catch (err) {
        console.error('Error batch exploring:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchFiles();
  }, [folderId]);

  if (loading) return <div className="flex items-center justify-center p-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="space-y-1">
      {items.map(item => (
        <BatchDriveItem 
          key={item.id} 
          item={item} 
          depth={0} 
          selectedIds={selectedIds}
          onToggleSelection={onToggleSelection}
        />
      ))}
    </div>
  );
};

const BatchDriveItem = ({ item, depth, selectedIds, onToggleSelection }: { 
  item: DriveItem, 
  depth: number,
  selectedIds: string[],
  onToggleSelection: (item: DriveItem) => void
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [children, setChildren] = useState<DriveItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showEmpty, setShowEmpty] = useState(false);
  const isFolder = item.mimeType === 'application/vnd.google-apps.folder' || 
                 (item.mimeType === 'application/vnd.google-apps.shortcut' && item.shortcutDetails?.targetMimeType === 'application/vnd.google-apps.folder');
  const actualId = (item.mimeType === 'application/vnd.google-apps.shortcut' && item.shortcutDetails?.targetId) || item.id;
  const isSelected = selectedIds.includes(item.id);

  const toggleFolder = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFolder) {
      if (!isOpen && children.length === 0) {
        setLoading(true);
        try {
          const { data } = await supabase.functions.invoke('google-drive-proxy', {
            body: { action: 'list_files', folderId: actualId }
          });
          const files = data.files || [];
          if (files.length === 0) {
            setShowEmpty(true);
            setTimeout(() => setShowEmpty(false), 2000);
            return;
          }
          setChildren(files);
          setIsOpen(true);
        } catch (err) {
          toast.error('Erro ao abrir pasta');
        } finally {
          setLoading(false);
        }
      } else {
        setIsOpen(!isOpen);
      }
    }
  };

  return (
    <div className="flex flex-col">
      <div 
        className={cn(
          "flex items-center gap-2 p-2 rounded-md transition-all duration-200 cursor-pointer group relative overflow-hidden",
          isSelected ? "bg-primary/10 hover:bg-primary/20" : "hover:bg-muted/50"
        )}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={() => onToggleSelection(item)}
      >
        <div className="flex items-center gap-2">
          {isFolder ? (
            <div onClick={toggleFolder} className="p-1 hover:bg-muted rounded transition-colors duration-200">
              <ChevronRight className={cn("h-4 w-4 transition-transform duration-300 ease-in-out", isOpen ? "rotate-90" : "rotate-0")} />
            </div>
          ) : <div className="w-6" />}
          <Check className={cn("h-4 w-4 transition-opacity", isSelected ? "opacity-100 text-primary" : "opacity-0")} />
          <FileIcon mimeType={item.mimeType} className="h-4 w-4" />
        </div>
        
        <div className="flex-1 relative h-5 overflow-hidden">
          <span 
            className={cn(
              "text-sm absolute inset-0 truncate transition-all duration-500 ease-in-out transform",
              showEmpty ? "-translate-y-full opacity-0" : "translate-y-0 opacity-100"
            )}
          >
            {item.name}
          </span>
          <span 
            className={cn(
              "text-sm absolute inset-0 truncate transition-all duration-500 ease-in-out transform text-muted-foreground italic font-normal flex items-center gap-2",
              showEmpty ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
            )}
          >
            <div className="w-1 h-1 rounded-full bg-muted-foreground animate-ping" />
            Pasta vazia
          </span>
        </div>
      </div>
      
      <div 
        className={cn(
          "grid transition-all duration-300 ease-in-out",
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col py-0.5">
            {loading ? (
              <div className="p-2 ml-12 text-xs text-muted-foreground flex items-center gap-2 animate-pulse">
                <Loader2 className="h-3 w-3 animate-spin" /> Carregando...
              </div>
            ) : (
              children.map(child => (
                <BatchDriveItem 
                  key={child.id} 
                  item={child} 
                  depth={depth + 1} 
                  selectedIds={selectedIds}
                  onToggleSelection={onToggleSelection}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const FileViewerDialog = ({ item, isOpen, onClose }: { item: DriveItem, isOpen: boolean, onClose: () => void }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    const viewerElement = document.getElementById(`viewer-${item.id}`);
    if (!viewerElement) return;

    if (!document.fullscreenElement) {
      viewerElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          onClose();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      id={`viewer-${item.id}`}
      className={cn(
        "fixed inset-0 z-[2147483647] flex flex-col bg-background overflow-hidden w-screen h-screen"
      )}
      style={{ 
        position: 'fixed', 
        top: 0,
        left: 0,
        width: '100vw', 
        height: '100vh',
        margin: 0,
        padding: 0,
        zIndex: 2147483647
      }}
    >
      <div className="p-2 border-b flex flex-row items-center justify-between bg-background h-10 shrink-0 w-full">
        <div className="flex items-center gap-1.5 overflow-hidden">
          <FileIcon mimeType={item.mimeType} className="h-4 w-4 shrink-0" />
          <span className="text-sm font-medium truncate max-w-[70vw] leading-tight">{item.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={toggleFullscreen}>
            <Maximize2 className="h-3.5 w-3.5 mr-1" /> {isFullscreen ? 'Sair Tela Cheia' : 'Tela Cheia'}
          </Button>
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" asChild>
            <a href={`https://drive.google.com/uc?export=download&id=${item.id}`} target="_blank" rel="noreferrer">
              <Download className="h-3.5 w-3.5 mr-1" /> Download
            </a>
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
            if (document.fullscreenElement) document.exitFullscreen();
            onClose();
          }}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="flex-1 bg-white relative w-full h-full overflow-hidden">
        <iframe 
          src={`https://drive.google.com/file/d/${item.id}/preview`} 
          className="w-full h-full border-none" 
          style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
          title={item.name} 
          allow="autoplay; fullscreen" 
          allowFullScreen 
        />
      </div>
    </div>
  );
};

const FileIcon = ({ mimeType, className }: { mimeType: string, className?: string }) => {
  const isShortcut = mimeType === 'application/vnd.google-apps.shortcut';
  const folderMimeType = 'application/vnd.google-apps.folder';

  if (mimeType === folderMimeType) return <Folder className={cn("text-amber-500 fill-amber-500", className)} />;
  if (mimeType === 'application/pdf') return <FileText className={cn("text-red-500", className)} />;
  if (mimeType.includes('word') || mimeType.includes('officedocument.wordprocessingml')) return <FileCode className={cn("text-blue-600", className)} />;
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet') || mimeType.includes('officedocument.spreadsheetml')) return <FileSpreadsheet className={cn("text-emerald-600", className)} />;
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return <FileText className={cn("text-orange-600", className)} />;
  if (mimeType.startsWith('image/')) return <FileImage className={cn("text-purple-500", className)} />;
  if (mimeType.startsWith('video/')) return <FileVideo className={cn("text-slate-700", className)} />;
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('compressed')) return <FileArchive className={cn("text-amber-700", className)} />;
  return <File className={cn("text-slate-400", className)} />;
};

export const DriveExplorer = ({ folderId, folderName }: { folderId: string, folderName: string }) => {
  const [items, setItems] = useState<DriveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFiles = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data, error } = await supabase.functions.invoke('google-drive-proxy', { body: { action: 'list_files', folderId } });
      if (error) throw error;
      if (data.error === 'google_auth_required') { setError('authentication_required'); return; }
      const sortedFiles = (data.files || []).sort((a: any, b: any) => 
        (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase(), undefined, { numeric: true, sensitivity: 'base' })
      );
      setItems(sortedFiles);
    } catch (err: any) { setError(err.message || 'Erro ao carregar arquivos'); }
    finally { setLoading(false); }
  }, [folderId]);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  if (loading) return <div className="flex items-center justify-center p-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (error === 'authentication_required') return (
    <div className="p-8 text-center border rounded-lg bg-muted/20">
      <p className="text-sm font-medium mb-4">Conteúdo temporariamente indisponível</p>
      <Button variant="outline" size="sm" onClick={fetchFiles}>Tentar novamente</Button>
    </div>
  );
  if (error) return (
    <div className="p-8 text-center border rounded-lg bg-muted/20">
      <p className="text-sm font-medium mb-1">Não foi possível carregar os documentos</p>
      <p className="text-xs text-muted-foreground mb-4">Ocorreu um erro ao acessar o Google Drive. Tente novamente em instantes.</p>
      <Button variant="outline" size="sm" onClick={fetchFiles}>Tentar novamente</Button>
    </div>
  );
  if (items.length === 0) return <div className="p-8 text-center text-muted-foreground text-sm">Nenhum arquivo encontrado.</div>;

  return <div className="space-y-1">{items.map(item => <DriveItemComponent key={item.id} item={item} depth={0} />)}</div>;
};

const DriveItemComponent = ({ item, depth }: { item: DriveItem, depth: number }) => {
  const [searchParams] = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const [children, setChildren] = useState<DriveItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewingFile, setViewingFile] = useState(false);
  const [showEmpty, setShowEmpty] = useState(false);
  const isFolder = item.mimeType === 'application/vnd.google-apps.folder' || 
                 (item.mimeType === 'application/vnd.google-apps.shortcut' && item.shortcutDetails?.targetMimeType === 'application/vnd.google-apps.folder');
  const actualId = (item.mimeType === 'application/vnd.google-apps.shortcut' && item.shortcutDetails?.targetId) || item.id;
  const actualMimeType = (item.mimeType === 'application/vnd.google-apps.shortcut' && item.shortcutDetails?.targetMimeType) || item.mimeType;

  const handleClick = async () => {
    if (isFolder) {
      if (!isOpen && children.length === 0) {
        setLoading(true);
        try {
          const { data, error } = await supabase.functions.invoke('google-drive-proxy', { body: { action: 'list_files', folderId: actualId } });
          if (error) throw error;
          const files = (data.files || []);
          if (files.length === 0) {
            setShowEmpty(true);
            setTimeout(() => setShowEmpty(false), 2000);
            return;
          }
          const sortedFiles = files.sort((a: any, b: any) => 
            (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase(), undefined, { numeric: true, sensitivity: 'base' })
          );
          setChildren(sortedFiles);
          setIsOpen(true);
        } catch (err) { toast.error('Erro ao abrir pasta'); }
        finally { setLoading(false); }
      } else { setIsOpen(!isOpen); }
    } else { 
      const isEmbed = searchParams.get('embed') === 'true';
      if (isEmbed) {
        // Find if we are in an iframe
        const inIframe = window.self !== window.top;
        if (inIframe) {
          // If we are in an iframe, we need to communicate with parent to show the file
          setViewingFile(true);
        } else {
          setViewingFile(true);
        }
      } else {
        setViewingFile(true); 
      }
    }
  };

  return (
    <div className="flex flex-col">
      <div 
        className={cn(
          "flex items-center gap-2 p-2 rounded-md transition-all duration-200 cursor-pointer group relative overflow-hidden", 
          isFolder ? "hover:bg-muted font-medium" : "hover:bg-muted/50"
        )} 
        style={{ paddingLeft: `${depth * 20 + 8}px` }} 
        onClick={handleClick}
      >
        <div className="flex items-center gap-2">
          {isFolder && (
            <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform duration-300 ease-in-out", isOpen ? "rotate-90" : "rotate-0")} />
          )}
          <FileIcon mimeType={item.mimeType} className="h-4 w-4" />
        </div>
        
        <div className="flex-1 relative h-5 overflow-hidden">
          <span 
            className={cn(
              "text-sm absolute inset-0 truncate transition-all duration-500 ease-in-out transform",
              showEmpty ? "-translate-y-full opacity-0" : "translate-y-0 opacity-100"
            )}
          >
            {item.name}
          </span>
          <span 
            className={cn(
              "text-sm absolute inset-0 truncate transition-all duration-500 ease-in-out transform text-muted-foreground italic font-normal flex items-center gap-2",
              showEmpty ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
            )}
          >
            <div className="w-1 h-1 rounded-full bg-muted-foreground animate-ping" />
            Pasta vazia
          </span>
        </div>

        {!isFolder && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={(e) => { 
              e.stopPropagation(); 
              setViewingFile(true); 
            }}><Maximize2 className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" asChild onClick={(e) => e.stopPropagation()}><a href={`https://drive.google.com/file/d/${item.id}/preview`} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" asChild onClick={(e) => e.stopPropagation()}><a href={`https://drive.google.com/uc?export=download&id=${item.id}`} target="_blank" rel="noreferrer"><Download className="h-3.5 w-3.5" /></a></Button>
          </div>
        )}
      </div>
      {!isFolder && <FileViewerDialog item={item} isOpen={viewingFile} onClose={() => setViewingFile(false)} />}
      
      <div 
        className={cn(
          "grid transition-all duration-300 ease-in-out",
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col py-0.5">
            {loading ? (
              <div className="p-2 ml-8 flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
                <Loader2 className="h-3 w-3 animate-spin" /> Carregando...
              </div>
            ) : (
              children.map(child => (
                <DriveItemComponent key={child.id} item={child} depth={depth + 1} />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransparencyPage;

