import { useState, useMemo } from 'react';
import { PUBLIC_APP_ORIGIN } from '@/lib/utils';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { useUIVersions } from '@/hooks/useUIVersions';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole, useAccessRequests } from '@/hooks/useUserRole';
import { useIsMobile } from '@/hooks/use-mobile';
import { useDbUsers } from '@/hooks/useDbUsers';
import { useViewConfigs } from '@/hooks/useViewConfigs';
import { AppUser, Unit, UNITS, UNIT_BG_COLORS, PERMISSION_LEVELS, BOND_LABELS, BOND_GROUPS, BOND_RULES, BondType, PARTNER_CATEGORIES, PartnerCategory } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Edit2, Copy, Check, RefreshCw, KeyRound, UserCog, Trash2, ChevronDown, History } from 'lucide-react';
import { AgendaDoGoogle } from '@/components/events/AgendaDoGoogle';
import { ConfigDosAvisos } from '@/components/events/ConfigDosAvisos';
import { useToast } from '@/hooks/use-toast';
import BulkActionBar from '@/components/BulkActionBar';
import PageHeader from '@/components/PageHeader';
import { supabase } from '@/integrations/supabase/client';
import { mensagemDaFuncao } from '@/lib/erroDaFuncao';
import { useNavigate } from 'react-router-dom';
import PageGuide from '@/components/PageGuide';

const EMBED_PAGES = [
  { name: 'Visão Geral', path: '/' },
  { name: 'Calendário', path: '/calendario' },
];

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  criador: 'Criador e Editor',
  editor: 'Editor (Apenas Edição)',
  admin_geral: 'Admin Geral',
  gestor_unidade: 'Gestor',
  eventos_parceiros: 'Eventos e Parceiros',
  usuario_padrao: 'Usuário Padrão',
  usuario_padrao_admin: 'Admin',
};

// Deriva nível de acesso e unidade a partir do vínculo escolhido.
function deriveFromBond(bond: BondType | '' | null | undefined, currentUnit: string) {
  if (!bond) return null;
  const rule = BOND_RULES[bond as BondType];
  if (!rule) return null;
  let unit = currentUnit;
  if (rule.unitMode === 'fixed-admin') unit = 'Administração';
  else if (rule.unitMode === 'none') unit = '';
  else if (rule.unitMode === 'choose' && (!currentUnit || currentUnit === 'Administração')) unit = 'DIC';
  return { permission_level: rule.permission_level, unit, unitMode: rule.unitMode };
}


export default function UsersPage() {
  const [urlSearchParams] = useSearchParams();
  const hideTitleParam = urlSearchParams.get('hideTitle') === 'true';
  const { users, selectedUser, setSelectedUser, updateUser, deleteUser } = useApp();
  const { user: currentUser } = useAuth();
  const { isAdmin, isManager, isMarketing, unit, delegatedUnits, canView, loading: roleLoading } = useUserRole();
  const { dbUsers, loading: dbUsersLoading, refetch } = useDbUsers();
  const { configs, updateConfig, isLoading: configsLoading } = useViewConfigs();
  const { requests, loading: requestsLoading, approveRequest, rejectRequest } = useAccessRequests();
  const [showApprovalConfirm, setShowApprovalConfirm] = useState<{ req: any } | null>(null);
  const [viewSearch, setViewSearch] = useState('');
  const [activeTab, setActiveTab] = useState(urlSearchParams.get('tab') || 'users');
  const [selectedViewUser, setSelectedViewUser] = useState<AppUser | null>(null);
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const navigate = useNavigate();

  /**
   * Quem gerencia os outros: comunicação e admin geral.
   *
   * Não é `isManager`. A gestão de unidade entra no Painel para se ver, e só:
   * com `isManager` ela editava o próprio perfil, e o formulário de edição
   * grava `permission_level` e `unit` — dava para se promover a admin geral
   * pela tela.
   */
  const podeGerirTodos = isMarketing;

  const [search, setSearch] = useState('');
  const displayRequests = useMemo(
    () => (podeGerirTodos ? requests : requests.filter((r) => r.user_id === currentUser?.id)),
    [requests, podeGerirTodos, currentUser],
  );
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState<AppUser | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [hideLogin, setHideLogin] = useState(true);
  const [hideFooter, setHideFooter] = useState(true);
  const [hideHeader, setHideHeader] = useState(true);
  const [hideTitle, setHideTitle] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [bulkDelete, setBulkDelete] = useState(false);
  const [showRoleToggleConfirm, setShowRoleToggleConfirm] = useState<boolean | null>(null);
  const [approvalsExpanded, setApprovalsExpanded] = useState(true);
  
  const [showPreRegister, setShowPreRegister] = useState(false);
  const [preRegisterForm, setPreRegisterForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'viewer',
    unit: 'Administração',
    permission_level: 'visualizador',
    bond_type: '',
    partner_category: ''
  });
  const [preRegisterSubmitting, setPreRegisterSubmitting] = useState(false);

  // Reset password dialog
  const [resetTarget, setResetTarget] = useState<{ id: string; name: string; email: string } | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetSubmitting, setResetSubmitting] = useState(false);

  // Impersonation dialog
  const [impersonateTarget, setImpersonateTarget] = useState<{ id: string; name: string; email: string } | null>(null);
  const [impersonateSubmitting, setImpersonateSubmitting] = useState(false);

  const handlePreRegister = async () => {
    if (!preRegisterForm.name || !preRegisterForm.email || !preRegisterForm.password) {
      toast({ title: 'Campos obrigatórios', description: 'Preencha nome, e-mail e senha.', variant: 'destructive' });
      return;
    }
    if (preRegisterForm.password.length < 6) {
      toast({ title: 'Senha curta', description: 'Mínimo 6 caracteres.', variant: 'destructive' });
      return;
    }

    setPreRegisterSubmitting(true);
    const { data, error } = await supabase.functions.invoke('admin-create-user', {
      body: {
        ...preRegisterForm,
        role: preRegisterForm.permission_level === 'admin_geral' ? 'admin' : 
              preRegisterForm.permission_level === 'gestor_unidade' ? 'criador' : 
              preRegisterForm.permission_level === 'eventos_parceiros' ? 'criador' : 
              preRegisterForm.permission_level === 'editor' ? 'editor' : 'viewer'
      },
    });

    setPreRegisterSubmitting(false);

    if (error || (data as any)?.error) {
      toast({ 
        title: 'Erro ao cadastrar', 
        description: (data as any)?.error || error?.message || 'Falha ao criar usuário.', 
        variant: 'destructive' 
      });
      return;
    }

    toast({ title: 'Usuário cadastrado!', description: `${preRegisterForm.name} foi adicionado ao sistema.` });
    setShowPreRegister(false);
    setPreRegisterForm({
      name: '',
      email: '',
      password: '',
      role: 'viewer',
      unit: 'Administração',
      permission_level: 'visualizador',
      bond_type: '',
      partner_category: ''
    });
    refetch();
  };

  const handleResetPassword = async () => {
    if (!resetTarget) return;
    if (newPassword.length < 6) {
      toast({ title: 'Senha muito curta', description: 'Mínimo 6 caracteres.', variant: 'destructive' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: 'Senhas não coincidem', description: 'Confirme a mesma senha nos dois campos.', variant: 'destructive' });
      return;
    }
    setResetSubmitting(true);
    const { data, error } = await supabase.functions.invoke('admin-reset-user-password', {
      body: { userId: resetTarget.id, newPassword },
    });
    setResetSubmitting(false);
    if (error || (data as any)?.error) {
      toast({ title: 'Erro', description: (data as any)?.error || error?.message || 'Falha ao redefinir senha.', variant: 'destructive' });
      return;
    }
    toast({ title: 'Senha redefinida', description: `Nova senha definida para ${resetTarget.name}.` });
    setResetTarget(null);
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleImpersonate = async () => {
    if (!impersonateTarget || !currentUser) return;
    setImpersonateSubmitting(true);
    const { data, error } = await supabase.functions.invoke('admin-impersonate-user', {
      body: { userId: impersonateTarget.id },
    });
    if (error || (data as any)?.error || !(data as any)?.token_hash) {
      setImpersonateSubmitting(false);
      toast({ title: 'Erro', description: (data as any)?.error || error?.message || 'Falha ao impersonar.', variant: 'destructive' });
      return;
    }
    const { email, token_hash } = data as { email: string; token_hash: string };
    // Save impersonator marker BEFORE signOut
    sessionStorage.setItem('impersonator_id', currentUser.id);
    sessionStorage.setItem('impersonation_target_email', email);
    await supabase.auth.signOut();
    const { error: verifyErr } = await supabase.auth.verifyOtp({
      type: 'magiclink',
      token_hash,
    });
    setImpersonateSubmitting(false);
    if (verifyErr) {
      sessionStorage.removeItem('impersonator_id');
      sessionStorage.removeItem('impersonation_target_email');
      toast({ title: 'Erro', description: 'Não foi possível concluir o login.', variant: 'destructive' });
      return;
    }
    setImpersonateTarget(null);
    toast({ title: 'Logado como ' + impersonateTarget.name });
    navigate('/', { replace: true });
    window.location.reload();
  };

  const toggleUserSelection = (id: string) => {
    setSelectedUsers(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBulkDeleteUsers = () => {
    setBulkDelete(true);
    setShowDeleteConfirm(true);
  };

  const executeDelete = async () => {
    setProcessingId('deleting');
    try {
      if (bulkDelete) {
        const ids = Array.from(selectedUsers);
        let successCount = 0;
        const falhas: string[] = [];
                
        for (const id of ids) {
          const isDbUser = dbUsers.some(u => u.user_id === id);
          if (isDbUser) {
            const { data, error } = await supabase.functions.invoke('admin-delete-user', {
              body: { userId: id }
            });
            if (error || (data as any)?.error) {
              const motivo = await mensagemDaFuncao(error, data, 'Falha ao excluir usuário.');
              console.error('Erro ao excluir usuário:', id, motivo);
              falhas.push(`${dbUsers.find(u => u.user_id === id)?.name ?? id}: ${motivo}`);
            } else {
              successCount++;
            }
          } else {
            deleteUser(id);
            successCount++;
          }
        }
        
        setSelectedUsers(new Set());
        if (successCount > 0) {
          toast({ 
            title: 'Usuários excluídos', 
            description: `${successCount} usuário(s) excluído(s) permanentemente.` 
          });
          refetch();
        }
        if (falhas.length) {
          toast({
            title: falhas.length === 1 ? 'Um usuário não foi excluído' : `${falhas.length} usuários não foram excluídos`,
            description: falhas.join(' · '),
            variant: 'destructive'
          });
        }
      } else if (selectedUser) {
        const id = selectedUser.id;
        const isDbUser = dbUsers.some(u => u.user_id === id);
        
        if (isDbUser) {
          const { data, error } = await supabase.functions.invoke('admin-delete-user', {
            body: { userId: id }
          });
          
          if (error || (data as any)?.error) {
            toast({
              title: 'Erro ao excluir',
              description: await mensagemDaFuncao(error, data, 'Falha ao excluir usuário.'),
              variant: 'destructive'
            });
          } else {
            toast({ 
              title: 'Usuário excluído', 
              description: `${selectedUser.name} foi excluído permanentemente.` 
            });
            refetch();
            setSelectedUser(null);
          }
        } else {
          deleteUser(id);
          toast({ 
            title: 'Usuário excluído', 
            description: `${selectedUser.name} foi excluído permanentemente.` 
          });
          setSelectedUser(null);
        }
      }
    } catch (err) {
      console.error('Erro na exclusão:', err);
      toast({ 
        title: 'Erro', 
        description: 'Ocorreu um erro inesperado ao tentar excluir.', 
        variant: 'destructive' 
      });
    } finally {
      setProcessingId(null);
      setShowDeleteConfirm(false);
      setBulkDelete(false);
    }
  };

  const handleBulkToggleActive = async (active: boolean) => {
    const ids = Array.from(selectedUsers);
    setProcessingId('bulk-toggle');
    
    let successCount = 0;
    
    for (const id of ids) {
      const isDbUser = dbUsers.some(u => u.user_id === id);
      if (isDbUser) {
        const { error } = await supabase
          .from('profiles')
          .update({ is_active: active, updated_at: new Date().toISOString() })
          .eq('user_id', id);
        if (!error) successCount++;
      } else {
        const user = users.find(u => u.id === id);
        if (user) {
          updateUser({ ...user, is_active: active, updated_at: new Date().toISOString() });
          successCount++;
        }
      }
    }
    
    setSelectedUsers(new Set());
    setProcessingId(null);
    refetch();
    toast({ 
      title: active ? 'Usuários ativados' : 'Usuários desativados', 
      description: `${successCount} usuário(s) ${active ? 'ativado(s)' : 'desativado(s)'}.` 
    });
  };
  
  const handleBulkToggleBeta = async (beta: boolean) => {
    const ids = Array.from(selectedUsers);
    setProcessingId('bulk-beta');
    
    let successCount = 0;
    
    for (const id of ids) {
      const isDbUser = dbUsers.some(u => u.user_id === id);
      if (isDbUser) {
        const { error } = await supabase
          .from('profiles')
          .update({ is_beta_tester: beta, updated_at: new Date().toISOString() })
          .eq('user_id', id);
        if (!error) successCount++;
      }
    }
    
    setSelectedUsers(new Set());
    setProcessingId(null);
    refetch();
    toast({ 
      title: beta ? 'Beta ativado' : 'Beta desativado', 
      description: `${successCount} usuário(s) atualizado(s).` 
    });
  };


  const combinedUsers = useMemo(() => {
    const mappedDbUsers: AppUser[] = dbUsers.map(dbu => ({
      id: dbu.user_id,
      name: dbu.name,
      email: dbu.email,
      unit: (dbu.unit as any) || 'Administração',
      permission_level: (dbu.permission_level || 'usuario_padrao') as any,
      is_active: dbu.is_active !== false,
      created_at: dbu.created_at,
      updated_at: dbu.created_at,
      view_restrictions: dbu.view_restrictions,
      is_beta_tester: dbu.is_beta_tester,
      bond_type: (dbu.bond_type as any) ?? null,
      partner_category: (dbu.partner_category as any) ?? null,
    }));


    const dbEmails = new Set(mappedDbUsers.map(u => u.email.toLowerCase()));
    const uniqueMockUsers = users.filter(u => !dbEmails.has(u.email.toLowerCase()));

    return [...mappedDbUsers, ...uniqueMockUsers];
  }, [dbUsers, users]);

  const filtered = useMemo(() => {
    let baseUsers = combinedUsers;
    
    // Fora da comunicação, cada pessoa vê só o próprio perfil. Sem e-mail do
    // usuário atual não mostramos ninguém: é o lado seguro do erro.
    if (!podeGerirTodos) {
      if (!currentUser?.email) return [];
      baseUsers = baseUsers.filter(u => u.email.toLowerCase() === currentUser.email?.toLowerCase());
    }

    if (!search) return baseUsers;
    const q = search.toLowerCase();
    return baseUsers.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [combinedUsers, search, podeGerirTodos, currentUser]);

  const groupedUsers = useMemo(() => {
    const admins = filtered.filter(u => (u.permission_level as string) === 'admin' || (u.permission_level as string) === 'admin_geral' || u.email === 'mkt@anabrasil.org');
    const gestores = filtered.filter(u => (u.permission_level as string) === 'gestor_unidade');
    const normalUsers = filtered.filter(u => !['admin', 'admin_geral', 'gestor_unidade'].includes(u.permission_level as string));
    
    return [
      { id: 'admins', title: 'Administradores', users: admins },
      { id: 'gestores', title: 'Gestores', users: gestores },
      { id: 'normal', title: 'Usuários e Visualizadores', users: normalUsers }
    ];
  }, [filtered]);

  const baseUrl = useMemo(() => {
    const origin = window.location.origin;
    // Se estiver no ambiente de preview do Lovable, sugerimos a URL de produção para os embeds
    // Isso evita que ao colar o embed em outro site, peça login no Lovable
    if (origin.includes('lovable.app') && (origin.includes('-preview--') || origin.includes('lovableproject.com'))) {
      return PUBLIC_APP_ORIGIN;
    }
    return origin;
  }, []);

  const handleEdit = (user: AppUser) => {
    setSelectedUser(user);
    setEditForm({ ...user });
    setShowEdit(true);
  };

  const handleSave = async () => {
    if (editForm && selectedUser) {
      setProcessingId(selectedUser.id);
      
      const isDbUser = dbUsers.some(u => u.user_id === selectedUser.id);
      
      if (isDbUser) {
        console.log('Atualizando usuário no banco:', selectedUser.id);
        
        // 1. Atualiza Perfil
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            name: editForm.name,
            unit: editForm.unit,
            permission_level: editForm.permission_level,
            is_active: editForm.is_active,
            is_beta_tester: editForm.is_beta_tester,
            bond_type: (editForm.bond_type as any) || null,
            partner_category: editForm.bond_type === 'parceiro' ? ((editForm.partner_category as any) || null) : null,
            updated_at: new Date().toISOString(),
          })

          .eq('user_id', selectedUser.id);
          
        if (profileError) {
          console.error('Erro ao atualizar perfil:', profileError);
          toast({ 
            title: 'Erro ao salvar perfil', 
            description: profileError.message, 
            variant: 'destructive' 
          });
          setProcessingId(null);
          return;
        }

        // 2. Sincroniza com a tabela user_roles
        // Somente Admin Geral pode alterar cargos de sistema
        if (isAdmin) {
          let mappedRole: 'admin' | 'editor' | 'criador' | 'viewer' = 'viewer';
          if ((editForm.permission_level as string) === 'admin_geral') mappedRole = 'admin';
          else if ((editForm.permission_level as string) === 'gestor_unidade') mappedRole = 'criador';
          else if ((editForm.permission_level as string) === 'eventos_parceiros') mappedRole = 'criador';
          else if ((editForm.permission_level as string) === 'editor') mappedRole = 'editor';

          const { error: roleError } = await supabase
            .from('user_roles')
            .upsert({ 
              user_id: selectedUser.id, 
              role: mappedRole 
            }, { 
              onConflict: 'user_id' 
            });

          if (roleError) {
            console.error('Erro ao atualizar cargo:', roleError);
            toast({ 
              title: 'Aviso', 
              description: 'Perfil salvo, mas houve um erro ao sincronizar permissões de sistema.', 
              variant: 'destructive' 
            });
          } else {
            toast({ title: 'Sucesso', description: 'Usuário e permissões atualizados com sucesso.' });
          }
        } else {
          toast({ title: 'Sucesso', description: 'Perfil atualizado com sucesso.' });
        }
        
        refetch(); // Recarrega os usuários do banco
      } else {
        // Fallback para usuários mock
        updateUser({ ...editForm, updated_at: new Date().toISOString() });
        toast({ title: 'Sucesso', description: 'Usuário (mock) atualizado localmente.' });
      }
      
      setShowEdit(false);
      setSelectedUser(null);
      setProcessingId(null);
    }
  };

  const handleApprove = async (req: any) => {
    setProcessingId(req.id);
    
    // Define o nível e unidade baseados na regra solicitada
    let level: any = 'visualizador';
    let unit: any = 'Administração';
    
    if (req.requested_role === 'admin') {
      level = 'admin_geral';
      unit = 'Administração';
    } else if (req.requested_role === 'criador' || req.requested_role === 'editor') {
      level = req.requested_role === 'criador' ? 'gestor_unidade' : 'editor';
      unit = req.requested_unit;

      // Sem unidade não dá para aprovar: a pessoa entraria sem jornal nenhum.
      // Aqui já houve um 'DIC' fixo de fallback — um chute que ninguém revisava
      // e que acertava por acaso.
      if (!unit) {
        toast({
          title: 'Falta a unidade',
          description: `A solicitação de ${req.name} chegou sem unidade. Defina a unidade no perfil dela antes de aprovar.`,
          variant: 'destructive',
        });
        setProcessingId(null);
        setShowApprovalConfirm(null);
        return;
      }
    }
    
    try {
      const resultado = await approveRequest(req.id, req.user_id, req.requested_role, level, unit);

      toast(
        resultado?.avisoEnviado
          ? {
              title: 'Aprovado e avisado',
              description: `${req.name} recebeu um e-mail com o link de entrada.`,
            }
          : {
              title: 'Aprovado — avise a pessoa',
              description: `O acesso de ${req.name} está liberado, mas o e-mail de aviso não saiu. Fale com ela por outro caminho.`,
            },
      );
      refetch();
    } catch (error: any) {
      toast({ title: 'Erro ao aprovar', description: error.message, variant: 'destructive' });
    } finally {
      setProcessingId(null);
      setShowApprovalConfirm(null);
    }
  };

  const onApproveClick = (req: any) => {
    setShowApprovalConfirm({ req });
  };

  const handleReject = async (req: any) => {
    setProcessingId(req.id);
    await rejectRequest(req.id);
    toast({ title: 'Rejeitado', description: `Solicitação de ${req.name} foi rejeitada.`, variant: 'destructive' });
    setProcessingId(null);
  };

  const getUrl = (path: string) => {
    const params = new URLSearchParams();
    if (hideLogin) params.append('hideLogin', 'true');
    if (hideFooter) params.append('hideFooter', 'true');
    if (hideHeader) params.append('hideHeader', 'true');
    if (hideTitle) params.append('hideTitle', 'true');
    const queryString = params.toString();
    
    // Ensure baseUrl doesn't end with slash if path starts with one
    const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    
    return `${normalizedBase}${normalizedPath}${queryString ? `?${queryString}` : ''}`;
  };

  const getEmbedCode = (path: string) =>
    `<iframe src="${getUrl(path)}" style="width:100%;height:100vh;border:0;border-radius:8px;" allowfullscreen></iframe>`;

  const getFixedEmbedCode = (path: string) =>
    `<div style="position:fixed;top:0;left:0;width:100%;height:100%;z-index:9999;"><iframe src="${getUrl(path)}" style="width:100%;height:100%;border:0;" allowfullscreen></iframe></div>`;

  const handleCopyEmbed = (idx: number, path: string) => {
    navigator.clipboard.writeText(getEmbedCode(path));
    setCopiedIdx(idx);
    toast({ title: 'Copiado!', description: 'Código embed copiado.' });
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const handleCopyFixedEmbed = (idx: number, path: string) => {
    navigator.clipboard.writeText(getFixedEmbedCode(path));
    setCopiedIdx(200 + idx);
    toast({ title: 'Copiado!', description: 'Embed tela cheia copiado.' });
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const handleCopyLink = (idx: number, path: string) => {
    navigator.clipboard.writeText(getUrl(path));
    setCopiedIdx(100 + idx);
    toast({ title: 'Copiado!', description: 'Link copiado.' });
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const permLabel = (level: string) => PERMISSION_LEVELS.find(p => p.value === level)?.label || level;

  // Admin restricted actions check
  const renderActions = (user: AppUser) => {
    const dbMatch = dbUsers.find(d => d.email?.toLowerCase() === user.email.toLowerCase());
    const authUserId = dbMatch?.user_id || (user.id.length > 10 ? user.id : undefined);

    const canImpersonate = (() => {
      if (!authUserId) return false;
      
      // Não permitir entrar como si mesmo
      if (authUserId === currentUser?.id) return false;

      // Só administrador geral. A edge function `admin-impersonate-user` exige
      // isso desde 26/08 — mostrar o botão para mais gente só geraria erro.
      return isAdmin;
    })();

    // Editar perfil é da comunicação. Ninguém edita o próprio nível ou a
    // própria unidade — nem o próprio perfil.
    const canEdit = podeGerirTodos;

    return (
      <div className="flex items-center gap-1">
        {(isAdmin || canEdit) && (
          <>
            {isAdmin && (
              <Button 
                variant="ghost" 
                size="icon" 
                title={authUserId ? "Redefinir senha" : "Usuário sem conta no sistema"}
                disabled={!authUserId}
                onClick={() => { if (authUserId) { setResetTarget({ id: authUserId, name: user.name, email: user.email }); setNewPassword(''); setConfirmPassword(''); } }}
                aria-label={authUserId ? "Redefinir senha" : "Usuário sem conta no sistema"}
                className="h-11 w-11 text-muted-foreground hover:text-foreground md:h-8 md:w-8"
              >
                <KeyRound className="h-4 w-4" />
              </Button>
            )}
            
            <Button variant="ghost" size="icon" onClick={() => handleEdit(user)} className="h-11 w-11 text-muted-foreground hover:text-foreground md:h-8 md:w-8" title="Editar usuário" aria-label="Editar usuário">
              <Edit2 className="h-4 w-4" />
            </Button>

            {isAdmin && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => { setSelectedUser(user); setBulkDelete(false); setShowDeleteConfirm(true); }} 
                className="h-11 w-11 text-muted-foreground hover:text-destructive md:h-8 md:w-8"
                title="Excluir permanentemente"
                aria-label="Excluir permanentemente"
                disabled={authUserId === currentUser?.id}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </>
        )}
        
        {canImpersonate && (
          <Button
            variant="ghost"
            size="icon"
            title="Entrar como este usuário"
            onClick={() => setImpersonateTarget({ id: authUserId!, name: user.name, email: user.email })}
            aria-label="Entrar como este usuário"
            className="h-11 w-11 text-muted-foreground hover:text-foreground md:h-8 md:w-8"
          >
            <UserCog className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  };

  const BetaManager = () => {
    const { currentVersion, versions, loading: vLoading, promoteToProduction, rollback, setActiveBeta, promoteVersionToProduction } = useUIVersions();
    const [name, setName] = useState('');
    const [desc, setDesc] = useState('');
    const [showPromote, setShowPromote] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [envFilter, setEnvFilter] = useState<string>('all');

    const handlePromote = async () => {
      if (!name) return;
      setIsSubmitting(true);
      try {
        await promoteToProduction(name, desc, { published_at: new Date().toISOString() });
        toast({ title: "Versão publicada para todos!" });
        setShowPromote(false);
        setName('');
        setDesc('');
      } catch (err: any) {
        toast({ title: "Erro ao publicar", description: err.message, variant: "destructive" });
      } finally {
        setIsSubmitting(false);
      }
    };

    // Ambiente vira etiqueta neutra (contorno): a cor fica para a situação.
    const envBadge = (env?: string | null) => {
      const label = env || 'estável';
      return <Badge variant="outline" className="px-2 py-0 text-[11px] font-medium text-muted-foreground">{label}</Badge>;
    };

    const filtered = envFilter === 'all' ? versions : versions.filter(v => (v.environment || 'legado') === envFilter);

    return (
      <div className="space-y-5">
        <div className="space-y-1 px-1">
          <h2 className="text-[17px] font-semibold text-foreground">Configuração de Versões</h2>
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Usuários com a chave <strong className="text-foreground">Modo Teste</strong> ligada veem a versão marcada como <strong className="text-foreground">Versão Teste</strong>.
            Os demais veem a versão marcada como <strong className="text-foreground">Versão Produção</strong>.
          </p>
        </div>

        <div className="flex flex-col gap-5 md:flex-row md:items-start">

          <section className="flex-1 rounded-[20px] border border-black/5 bg-card p-5 dark:border-white/5" aria-labelledby="titulo-publicacao-geral">
            <h3 id="titulo-publicacao-geral" className="mb-4 text-[15px] font-semibold text-foreground">Publicação Geral</h3>
            {vLoading ? <p className="text-sm text-muted-foreground">Carregando...</p> : (
              <div className="space-y-4">
                <div className="rounded-[16px] bg-muted/60 p-4">
                  <p className="font-display text-xl font-semibold text-foreground">{currentVersion?.name || 'Versão Inicial'}</p>
                  <p className="text-[13px] text-[hsl(var(--fraco,0_0%_45%))]">ID: {currentVersion?.id || 'stable'}</p>
                  {currentVersion?.config?.published_at && (
                    <p className="text-[13px] tabular-nums text-[hsl(var(--fraco,0_0%_45%))]">Publicada em: {new Date(currentVersion.config.published_at).toLocaleString('pt-BR')}</p>
                  )}
                </div>
                <Button variant="outline" onClick={() => setShowPromote(true)} className="h-11 w-full">
                  Publicar Versão Atual para Todos
                </Button>
              </div>
            )}
          </section>

          <section className="flex-1 overflow-hidden rounded-[20px] border border-black/5 bg-card dark:border-white/5" aria-labelledby="titulo-historico-versoes">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4">
              <div>
                <h3 id="titulo-historico-versoes" className="text-[15px] font-semibold text-foreground">Histórico de Versões</h3>
                <p className="text-[13px] text-muted-foreground">Últimas 30 versões.</p>
              </div>
              <select
                value={envFilter}
                onChange={(e) => setEnvFilter(e.target.value)}
                aria-label="Filtrar por ambiente"
                className="h-10 rounded-[12px] border border-input bg-card px-2.5 text-[13px] text-foreground"
              >
                <option value="all">Todos</option>
                <option value="lovable">Lovable</option>
                <option value="cloudflare-production">CF Production</option>
                <option value="cloudflare-preview">CF Preview</option>
                <option value="legado">Legado</option>
              </select>
            </div>
            <div className="max-h-[480px] overflow-y-auto">
              {filtered.length === 0 ? <p className="px-5 py-6 text-sm text-muted-foreground">Nenhuma versão.</p> :
                filtered.map(v => (
                  <div key={v.id} className="flex flex-col gap-2 border-b border-border/70 px-5 py-3 transition-colors last:border-b-0 hover:bg-muted/40">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                        <p className="truncate text-sm font-semibold text-foreground">{v.name}</p>
                        {envBadge(v.environment)}
                        {v.is_active_beta && (
                          <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-info">
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            Versão Teste
                          </span>
                        )}
                        {v.is_active_production && (
                          <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-success">
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            Versão Produção
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs tabular-nums text-[hsl(var(--fraco,0_0%_45%))]">
                        {v.commit_sha ? <code className="font-mono">{v.commit_sha.slice(0, 7)}</code> : '—'} · {new Date(v.deployed_at || v.created_at).toLocaleString('pt-BR')}
                        {v.deployed_by && ` · ${v.deployed_by}`}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Button variant="outline" size="sm" className="h-9 text-xs"
                        disabled={!!v.is_active_beta}
                        onClick={async () => { try { await setActiveBeta(v); toast({ title: 'Ativada para Beta Testers' }); } catch (e: any) { toast({ title: 'Erro', description: e.message, variant: 'destructive' }); } }}>
                        Ativar para Teste
                      </Button>
                      <Button variant="outline" size="sm" className="h-9 text-xs"
                        disabled={!!v.is_active_production}
                        onClick={async () => { try { await promoteVersionToProduction(v); toast({ title: 'Promovida para Produção' }); } catch (e: any) { toast({ title: 'Erro', description: e.message, variant: 'destructive' }); } }}>
                        Produção
                      </Button>
                      <Button variant="ghost" size="sm" className="h-9 text-xs"
                        disabled={currentVersion?.id === v.id}
                        onClick={() => rollback(v)}>
                        Reverter config
                      </Button>
                    </div>
                  </div>
                ))
              }
            </div>
          </section>
        </div>


        <Dialog open={showPromote} onOpenChange={setShowPromote}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Publicar Versão de Produção</DialogTitle>
              <p className="text-sm text-muted-foreground">Isso tornará a interface atual visível para TODOS os usuários imediatamente.</p>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nome da Versão</Label>
                <Input placeholder="Ex: Redesign v2.0" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Descrição (Opcional)</Label>
                <Input placeholder="O que mudou nesta versão?" value={desc} onChange={e => setDesc(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPromote(false)}>Cancelar</Button>
              <Button onClick={handlePromote} disabled={!name || isSubmitting}>
                {isSubmitting ? 'Publicando...' : 'Publicar Agora'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  };

  if (roleLoading) return <div className="p-8 text-center">Carregando permissões...</div>;

  // Redireciona se o usuário não for admin ou gestor
  // Sem portão: a página é de todo mundo que está logado. O que muda é o que
  // ela mostra — ver `podeGerirTodos`.

  return (
    <div className="animate-fade-in space-y-5">
      <PageHeader
        title={hideTitleParam ? "" : "Painel"}
        description={hideTitleParam ? "" : "Gerencie usuários, permissões e configurações de visualização"}
        hidden={hideTitleParam}
        className="mb-0"
        actions={
          <div className="flex w-full flex-wrap items-center justify-start gap-2 sm:justify-end">
            {isAdmin && (
              <Button
                onClick={() => setShowPreRegister(true)}
                className="h-11 shrink-0 sm:h-10"
              >
                <span className="hidden sm:inline">Pré-cadastro</span>
                <span className="sm:hidden">Novo</span>
              </Button>
            )}
            {isAdmin && (
              <Button
                variant="outline"
                size="icon"
                title="Configuração de Versões"
                aria-label="Configuração de Versões"
                onClick={() => setActiveTab('beta-configs')}
                className={`h-11 w-11 shrink-0 sm:h-10 sm:w-10 ${activeTab === 'beta-configs' ? 'bg-[hsl(var(--ativo,0_0%_100%/0.75))] text-foreground border-foreground/30' : ''}`}
              >
                <History className="h-4 w-4" />
              </Button>
            )}
            <div className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                placeholder="Buscar usuário..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-11 pl-9 sm:h-10"
              />
            </div>
          </div>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
        <div className="-mx-1 overflow-x-auto px-1">
          <TabsList className="h-11 justify-start">
            <TabsTrigger value="users" className="h-9 px-3.5">Usuários</TabsTrigger>
            {isAdmin && <TabsTrigger value="beta-configs" className="h-9 px-3.5">Versões</TabsTrigger>}
            {isAdmin && <TabsTrigger value="view-configs" className="h-9 px-3.5">Visualização</TabsTrigger>}
            {isAdmin && <TabsTrigger value="embed" className="h-9 px-3.5">Embed</TabsTrigger>}
            {isAdmin && <TabsTrigger value="agenda" className="h-9 px-3.5">Agenda</TabsTrigger>}
          </TabsList>
        </div>

        <TabsContent value="users" className="mt-0 space-y-5">
          {isAdmin && (
            <BulkActionBar
              type="users"
              count={selectedUsers.size}
              onClearSelection={() => setSelectedUsers(new Set())}
              onDelete={handleBulkDeleteUsers}
              onToggleActive={handleBulkToggleActive}
              onToggleBeta={handleBulkToggleBeta}
            />

          )}
          <section className="space-y-3" aria-labelledby="titulo-solicitacoes">
            <button
              type="button"
              onClick={() => setApprovalsExpanded(!approvalsExpanded)}
              aria-expanded={approvalsExpanded}
              className="flex min-h-[44px] w-full items-center justify-between gap-3 rounded-[12px] text-left transition-colors hover:text-foreground"
            >
              <span className="flex min-w-0 flex-col">
                <span id="titulo-solicitacoes" className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
                  Solicitações de Aprovação
                  {requests.length > 0 && (
                    <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold tabular-nums text-destructive">
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {requests.length}
                    </span>
                  )}
                </span>
                <span className="text-[13px] text-muted-foreground">
                  {requests.length === 0
                    ? "Nenhuma solicitação pendente"
                    : `${requests.length} ${requests.length === 1 ? 'solicitação aguardando' : 'solicitações aguardando'} sua análise`}
                </span>
              </span>
              <ChevronDown className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-300 ${approvalsExpanded ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>

            {approvalsExpanded && (
              <div className="overflow-hidden rounded-[20px] border border-black/5 bg-card animate-in slide-in-from-top-2 duration-300 dark:border-white/5">
                <h3 className="border-b border-border/70 px-4 py-3 text-[15px] font-semibold text-foreground">
                  {podeGerirTodos ? 'Solicitações de Acesso Pendentes' : 'Minha Solicitação de Acesso'}
                </h3>
                {requestsLoading ? (
                  <p className="px-4 py-6 text-sm text-muted-foreground">Carregando...</p>
                ) : displayRequests.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-muted-foreground">{podeGerirTodos ? 'Nenhuma solicitação pendente' : 'Você não possui solicitações de acesso pendentes'}</p>
                ) : (
                  <ul>
                    {displayRequests.map(req => (
                      <li key={req.id} className="flex flex-col gap-3 border-b border-border/70 px-4 py-3.5 last:border-b-0 md:flex-row md:items-center md:gap-4">
                        <div className="min-w-0 flex-1 md:grid md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center md:gap-4">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-foreground">{req.name}</p>
                            <p className="truncate text-[13px] text-[hsl(var(--fraco,0_0%_45%))]">{req.email}</p>
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] md:contents">
                            <span className="text-foreground">{ROLE_LABELS[req.requested_role] || req.requested_role}</span>
                            {/* A unidade pedida fica à vista: é ela que decide qual
                                jornal a pessoa vai enxergar, e quem aprova precisa
                                conferir antes — não depois. */}
                            {req.requested_unit ? (
                              <span className="inline-flex min-w-0 items-center gap-1.5 text-foreground">
                                <span className={`h-2 w-2 shrink-0 rounded-full ring-1 ring-black/10 ${UNIT_BG_COLORS[req.requested_unit as Unit] ?? 'bg-muted-foreground/50'}`} />
                                <span className="truncate">{req.requested_unit}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 font-semibold text-warning">
                                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                Sem unidade
                              </span>
                            )}
                            <span className="tabular-nums text-[hsl(var(--fraco,0_0%_45%))]">
                              {new Date(req.requested_at).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                        </div>
                        {podeGerirTodos && (
                          <div className="flex shrink-0 gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-11 flex-1 md:h-9 md:flex-none"
                              disabled={processingId === req.id}
                              onClick={() => onApproveClick(req)}
                            >
                              Aprovar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-11 flex-1 text-destructive hover:text-destructive md:h-9 md:flex-none"
                              disabled={processingId === req.id}
                              onClick={() => handleReject(req)}
                            >
                              Rejeitar
                            </Button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>
          {dbUsersLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <RefreshCw className="mb-4 h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
              <p className="text-muted-foreground">Carregando usuários...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {groupedUsers.map(group => group.users.length > 0 && (
                <section key={group.id} className="space-y-3" aria-labelledby={`grupo-${group.id}`}>
                  <div className="flex items-baseline gap-2 px-1">
                    <h2 id={`grupo-${group.id}`} className="text-[17px] font-semibold text-foreground">{group.title}</h2>
                    <span className="text-[13px] font-medium tabular-nums text-[hsl(var(--fraco,0_0%_45%))]">{group.users.length}</span>
                  </div>
                  <div className="overflow-hidden rounded-[20px] border border-black/5 bg-card dark:border-white/5">
                    {/* cabeçalho das colunas, só no computador */}
                    <div className="hidden items-center gap-3 border-b border-border px-4 py-2.5 text-xs font-semibold text-muted-foreground md:flex">
                      {isAdmin && <span className="w-4 shrink-0" />}
                      <div className="grid flex-1 grid-cols-[minmax(0,1.6fr)_minmax(0,0.9fr)_minmax(0,1.3fr)_minmax(0,0.6fr)_auto] gap-4">
                        <span>Nome</span>
                        <span>Unidade</span>
                        <span>Nível de acesso</span>
                        <span>Situação</span>
                        <span className="sr-only">Ações</span>
                      </div>
                    </div>
                    <ul>
                      {group.users.map(user => (
                        <li key={user.id} className="flex items-start gap-3 border-b border-border/70 px-4 py-3 transition-colors last:border-b-0 hover:bg-muted/40 md:items-center">
                          {isAdmin && (
                            <Checkbox
                              checked={selectedUsers.has(user.id)}
                              onCheckedChange={() => toggleUserSelection(user.id)}
                              aria-label={`Selecionar ${user.name}`}
                              className="mt-1 h-4 w-4 shrink-0 md:mt-0"
                            />
                          )}
                          <div className="min-w-0 flex-1 md:grid md:grid-cols-[minmax(0,1.6fr)_minmax(0,0.9fr)_minmax(0,1.3fr)_minmax(0,0.6fr)_auto] md:items-center md:gap-4">
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-foreground">{user.name}</p>
                              <p className="truncate text-[13px] text-[hsl(var(--fraco,0_0%_45%))]">{user.email}</p>
                            </div>
                            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] md:contents">
                              <span className="inline-flex min-w-0 items-center gap-1.5 text-foreground">
                                <span className={`h-2 w-2 shrink-0 rounded-full ring-1 ring-black/10 ${UNIT_BG_COLORS[user.unit as Unit] ?? 'bg-muted-foreground/50'}`} />
                                <span className="truncate">{user.unit}</span>
                              </span>
                              <span className="min-w-0 text-foreground">
                                {permLabel(user.permission_level)}
                                {user.bond_type && BOND_LABELS[user.bond_type as BondType] && (
                                  <span className="text-[hsl(var(--fraco,0_0%_45%))]"> · {BOND_LABELS[user.bond_type as BondType]}</span>
                                )}
                              </span>
                              <span className={`inline-flex items-center gap-1.5 font-semibold ${user.is_active ? 'text-success' : 'text-destructive'}`}>
                                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                {user.is_active ? 'Ativo' : 'Inativo'}
                              </span>
                            </div>
                            <div className="-ml-2.5 mt-1 md:ml-0 md:mt-0 md:justify-self-end">
                              {renderActions(user)}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </section>
              ))}
              {filtered.length === 0 && (
                <div className="rounded-[20px] border border-dashed border-border py-12 text-center">
                  <p className="text-muted-foreground">Nenhum usuário encontrado.</p>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {isAdmin && (
          <TabsContent value="beta-configs" className="mt-0 space-y-5">
            <BetaManager />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="agenda" className="mt-0 space-y-5">
            <AgendaDoGoogle />
            <ConfigDosAvisos />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="view-configs" className="mt-0 space-y-5">
            <section className="rounded-[20px] border border-black/5 bg-card dark:border-white/5" aria-labelledby="titulo-visualizacao-perfil">
              <div className="space-y-1 border-b border-border px-5 py-4">
                <h2 id="titulo-visualizacao-perfil" className="text-[17px] font-semibold text-foreground">
                  Configuração de Visualização por Perfil
                </h2>
                <p className="text-sm text-muted-foreground">
                  Defina quais unidades cada tipo de usuário pode visualizar por padrão.
                </p>
              </div>
              <div className="space-y-5 p-5">
                <div className={`rounded-[16px] border p-4 transition-colors duration-200 ${
                  configs?.enable_role_based_view
                    ? "border-border bg-accent/50"
                    : "border-border bg-muted/40"
                }`}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <Label htmlFor="enable-role-view" className="text-[15px] font-semibold">
                          Sistema de Restrição por Cargo
                        </Label>
                        {configs?.enable_role_based_view ? (
                          <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-success">
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            Ativo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground">
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            Inativo
                          </span>
                        )}
                      </div>
                      <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                        Quando <strong className="text-foreground">Ligado</strong>, o sistema segue estritamente os padrões definidos por <strong className="text-foreground">Cargo</strong> abaixo.
                        Quando <strong className="text-foreground">Desligado</strong>, o sistema permite <strong className="text-foreground">Restrições Individuais</strong> personalizadas por usuário.
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <Switch
                        id="enable-role-view"
                        checked={configs?.enable_role_based_view || false}
                        onCheckedChange={(v) => setShowRoleToggleConfirm(v)}
                      />
                      <span className="text-xs font-medium text-muted-foreground">
                        {configs?.enable_role_based_view ? "Ligado" : "Desligado"}
                      </span>
                    </div>
                  </div>
                </div>


                {!configs?.enable_role_based_view && (
                  <Alert className="rounded-[16px] border-warning/40 bg-card">
                    <AlertTitle className="inline-flex items-center gap-1.5 font-semibold text-warning">
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      Configurações Inativas
                    </AlertTitle>
                    <AlertDescription className="text-[13px] text-muted-foreground">
                      O sistema de restrição global está desativado. As definições por cargo abaixo estão sendo ignoradas no momento.
                    </AlertDescription>
                  </Alert>
                )}

                <div className={`grid gap-4 md:grid-cols-2 transition-opacity duration-300 ${!configs?.enable_role_based_view ? "pointer-events-none select-none opacity-50" : ""}`}>
                  {Object.entries(configs?.role_defaults || {}).map(([role, allowedUnits]) => (
                    <div key={role} className="space-y-3 rounded-[16px] border border-border bg-card p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="space-y-0.5">
                          <Label className="text-[15px] font-semibold">{ROLE_LABELS[role] || role}</Label>
                          <p className="text-[13px] tabular-nums text-muted-foreground">
                            {allowedUnits.length} de {UNITS.length} unidades
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={!configs?.enable_role_based_view}
                            className="h-9 px-2.5 text-xs font-semibold"
                            onClick={() => {
                              const newValue = { ...configs?.role_defaults, [role]: UNITS };
                              updateConfig.mutate({ key: 'role_defaults', value: newValue });
                            }}
                          >
                            Tudo
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={!configs?.enable_role_based_view}
                            className="h-9 px-2.5 text-xs font-semibold hover:text-destructive"
                            onClick={() => {
                              const newValue = { ...configs?.role_defaults, [role]: [] };
                              updateConfig.mutate({ key: 'role_defaults', value: newValue });
                            }}
                          >
                            Limpar
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={!configs?.enable_role_based_view}
                            className="h-9 w-9 text-muted-foreground hover:text-foreground"
                            title="Resetar usuários deste perfil"
                            aria-label="Resetar usuários deste perfil"
                            onClick={async () => {
                              const usersToReset = combinedUsers.filter(u => u.permission_level === role && u.view_restrictions !== null);
                              if (usersToReset.length === 0) {
                                toast({ title: "Nenhum usuário com restrição customizada" });
                                return;
                              }

                              const { error } = await supabase
                                .from('profiles')
                                .update({ view_restrictions: null })
                                .eq('permission_level', role);

                              if (!error) {
                                toast({ title: `${usersToReset.length} usuários resetados` });
                                refetch();
                              }
                            }}
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <div className="grid max-h-[180px] grid-cols-2 gap-1.5 overflow-y-auto pr-1">
                        {UNITS.map(unit => (
                          <div key={unit} className="flex items-center justify-between gap-2 rounded-[12px] border border-border/70 px-2.5 py-1.5 transition-colors hover:bg-muted/40">
                            <Label htmlFor={`role-${role}-${unit}`} className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 text-[13px] font-medium">
                              <span className={`h-2 w-2 shrink-0 rounded-full ring-1 ring-black/10 ${UNIT_BG_COLORS[unit]}`} />
                              <span className="truncate">{unit}</span>
                            </Label>
                            <Switch
                              id={`role-${role}-${unit}`}
                              className="origin-right scale-[0.8]"
                              checked={allowedUnits.includes(unit)}
                              disabled={!configs?.enable_role_based_view}
                              onCheckedChange={(checked) => {
                                const newUnits = checked
                                  ? [...allowedUnits, unit]
                                  : allowedUnits.filter(u => u !== unit);
                                const newValue = { ...configs?.role_defaults, [role]: newUnits };
                                updateConfig.mutate({ key: 'role_defaults', value: newValue });
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded-[20px] border border-black/5 bg-card dark:border-white/5" aria-labelledby="titulo-restricoes-personalizadas">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
                <div className="space-y-1">
                  <h2 id="titulo-restricoes-personalizadas" className="text-[17px] font-semibold text-foreground">
                    Restrições Personalizadas
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {configs?.enable_role_based_view
                      ? "As restrições individuais estão desabilitadas pois o Sistema por Cargo está ativo."
                      : "Busque um usuário para definir restrições específicas ou veja quem já possui configurações customizadas."}
                  </p>
                </div>
                {configs?.enable_role_based_view && (
                  <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-info">
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    Sistema por Cargo Ativo
                  </span>
                )}
              </div>
              <div className={`space-y-5 p-5 transition-opacity duration-300 ${configs?.enable_role_based_view ? "pointer-events-none opacity-50" : ""}`}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input
                    placeholder="Buscar usuário por nome ou email..."
                    value={viewSearch}
                    onChange={e => setViewSearch(e.target.value)}
                    disabled={configs?.enable_role_based_view}
                    className="h-11 pl-9"
                  />
                  {viewSearch.length > 2 && (
                    <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-[14px] border border-border bg-popover py-1 shadow-lg">
                      {combinedUsers
                        .filter(u => u.name.toLowerCase().includes(viewSearch.toLowerCase()) || u.email.toLowerCase().includes(viewSearch.toLowerCase()))
                        .map(u => (
                          <button
                            key={u.id}
                            className="flex min-h-[44px] w-full items-center justify-between gap-3 px-4 py-2 text-left transition-colors hover:bg-accent"
                            onClick={() => {
                              setSelectedViewUser(u);
                              setViewSearch('');
                            }}
                          >
                            <div className="flex min-w-0 flex-col">
                              <span className="truncate text-sm font-medium">{u.name}</span>
                              <span className="truncate text-xs text-muted-foreground">{u.email}</span>
                            </div>
                            <span className="shrink-0 text-xs text-muted-foreground">{ROLE_LABELS[u.permission_level] || u.permission_level}</span>
                          </button>
                        ))
                      }
                    </div>
                  )}
                </div>

                {selectedViewUser && (
                  <div className="space-y-4 rounded-[16px] border border-border bg-muted/30 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{selectedViewUser.name}</p>
                        <p className="truncate text-[13px] text-[hsl(var(--fraco,0_0%_45%))]">{selectedViewUser.email}</p>
                      </div>
                      <Button variant="ghost" size="sm" className="h-9" onClick={() => setSelectedViewUser(null)}>Fechar</Button>
                    </div>

                    <div className="flex items-center justify-between gap-4 rounded-[12px] border border-border bg-card p-3">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-semibold">
                          Acesso Antecipado
                        </Label>
                        <p className="text-xs text-muted-foreground">Permite que este usuário veja novas funcionalidades antes do lançamento.</p>
                      </div>
                      <Switch
                        checked={selectedViewUser.is_beta_tester}
                        onCheckedChange={async (checked) => {
                          const { error } = await supabase
                            .from('profiles')
                            .update({ is_beta_tester: checked })
                            .eq('user_id', selectedViewUser.id);

                          if (!error) {
                            toast({ title: checked ? "Beta Tester habilitado" : "Beta Tester desabilitado" });
                            refetch();
                            setSelectedViewUser({ ...selectedViewUser, is_beta_tester: checked });
                          }
                        }}
                      />
                    </div>

                    <div className="space-y-3">
                      <Label className="text-sm font-semibold">Unidades que este usuário pode visualizar:</Label>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {UNITS.map(unit => {
                          const currentRestrictions = (selectedViewUser as any).view_restrictions || configs?.role_defaults[selectedViewUser.permission_level] || UNITS;
                          const isChecked = currentRestrictions.includes(unit);

                          return (
                            <div key={unit} className="flex items-center justify-between gap-2 rounded-[12px] border border-border bg-card px-3 py-2">
                              <Label htmlFor={`user-${selectedViewUser.id}-${unit}`} className="flex cursor-pointer items-center gap-1.5 text-sm font-medium">
                                <span className={`h-2 w-2 shrink-0 rounded-full ring-1 ring-black/10 ${UNIT_BG_COLORS[unit]}`} />
                                {unit}
                              </Label>
                              <Switch
                                id={`user-${selectedViewUser.id}-${unit}`}
                                checked={isChecked}
                                disabled={configs?.enable_role_based_view}
                                onCheckedChange={async (checked) => {
                                  const newRestrictions = checked
                                    ? [...currentRestrictions, unit]
                                    : currentRestrictions.filter((u: string) => u !== unit);

                                  const { error } = await supabase
                                    .from('profiles')
                                    .update({ view_restrictions: newRestrictions })
                                    .eq('user_id', selectedViewUser.id);

                                  if (!error) {
                                    toast({ title: "Restrições atualizadas" });
                                    refetch();
                                    setSelectedViewUser({ ...selectedViewUser, view_restrictions: newRestrictions } as any);
                                  }
                                }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      disabled={configs?.enable_role_based_view}
                      className="h-11 w-full"
                      onClick={async () => {
                        const { error } = await supabase
                          .from('profiles')
                          .update({ view_restrictions: null })
                          .eq('user_id', selectedViewUser.id);

                        if (!error) {
                          toast({ title: "Restrições resetadas para o padrão do perfil" });
                          refetch();
                          setSelectedViewUser({ ...selectedViewUser, view_restrictions: null } as any);
                        }
                      }}
                    >
                      Redefinir para Padrão do Perfil
                    </Button>
                  </div>
                )}

                <div className="space-y-3">
                  <h3 className="text-[15px] font-semibold text-foreground">Usuários com Restrições Customizadas</h3>
                  <ul className="overflow-hidden rounded-[16px] border border-border">
                    {combinedUsers
                      .filter(u => (u as any).view_restrictions !== null && (u as any).view_restrictions !== undefined)
                      .map(u => (
                        <li key={u.id} className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-2.5 last:border-b-0">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{u.name}</p>
                            <p className="truncate text-xs text-[hsl(var(--fraco,0_0%_45%))]">{u.email}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={configs?.enable_role_based_view}
                            className="h-11 w-11 shrink-0 text-muted-foreground hover:text-foreground md:h-9 md:w-9"
                            aria-label={`Editar restrições de ${u.name}`}
                            onClick={() => setSelectedViewUser(u)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </li>
                      ))}
                    {combinedUsers.filter(u => (u as any).view_restrictions !== null && (u as any).view_restrictions !== undefined).length === 0 && (
                      <li className="px-4 py-4 text-center text-[13px] text-muted-foreground">Nenhum usuário com restrições customizadas.</li>
                    )}
                  </ul>
                </div>
              </div>
            </section>
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="embed" className="mt-0">
          <section className="rounded-[20px] border border-black/5 bg-card dark:border-white/5" aria-labelledby="titulo-embed">
            <div className="space-y-3 border-b border-border px-5 py-4">
              <div className="space-y-1">
                <h2 id="titulo-embed" className="text-[17px] font-semibold text-foreground">
                  Links e Códigos Embed
                </h2>
                <p className="text-sm text-muted-foreground">
                  Use estes links para incorporar páginas em sites externos.
                </p>
              </div>
              {window.location.origin.includes('-preview--') && (
                <Alert className="rounded-[16px] border-border bg-muted/40">
                  <AlertTitle className="text-[13px] font-semibold text-foreground">Nota de Publicação</AlertTitle>
                  <AlertDescription className="text-xs text-muted-foreground">
                    Detectamos que você está no ambiente de visualização. Os links abaixo já foram
                    ajustados para usar o domínio público <strong className="text-foreground">app.anabrasil.org</strong> para que
                    não peçam login do Lovable ao serem incorporados.
                  </AlertDescription>
                </Alert>
              )}
            </div>
            <div className="space-y-5 p-5">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <div className="flex min-h-[44px] items-center gap-2 sm:min-h-0">
                    <Switch id="show-header" checked={!hideHeader} onCheckedChange={(v) => setHideHeader(!v)} />
                    <Label htmlFor="show-header" className="cursor-pointer text-sm font-medium">Habilitar Cabeçalho e Menu</Label>
                  </div>
                  <p className="ml-11 text-xs text-muted-foreground">
                    Exibe a barra de navegação superior e links de acesso.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex min-h-[44px] items-center gap-2 sm:min-h-0">
                    <Switch id="show-title" checked={!hideTitle} onCheckedChange={(v) => setHideTitle(!v)} />
                    <Label htmlFor="show-title" className="cursor-pointer text-sm font-medium">Habilitar Título da Página</Label>
                  </div>
                  <p className="ml-11 text-xs text-muted-foreground">
                    Exibe o título principal no topo do conteúdo.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex min-h-[44px] items-center gap-2 sm:min-h-0">
                    <Switch id="hide-login" checked={hideLogin} onCheckedChange={setHideLogin} />
                    <Label htmlFor="hide-login" className="cursor-pointer text-sm font-medium">Ocultar Botão de Login</Label>
                  </div>
                  <p className="ml-11 text-xs text-muted-foreground">
                    Remove o botão de login para visualização externa segura.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex min-h-[44px] items-center gap-2 sm:min-h-0">
                    <Switch id="hide-footer" checked={hideFooter} onCheckedChange={setHideFooter} />
                    <Label htmlFor="hide-footer" className="cursor-pointer text-sm font-medium">Ocultar Rodapé</Label>
                  </div>
                  <p className="ml-11 text-xs text-muted-foreground">
                    Remove o rodapé do Lovable da página.
                  </p>
                </div>
              </div>
              {EMBED_PAGES.map((page, idx) => (
                <div key={idx} className="space-y-3 rounded-[16px] border border-border p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-[15px] font-semibold text-foreground">{page.name}</h3>
                    <Badge variant="outline" className="font-mono text-xs font-medium text-muted-foreground">{page.path}</Badge>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Link direto</Label>
                    <div className="flex items-center gap-2">
                      <Input readOnly value={getUrl(page.path)} className="min-w-0 bg-muted/50 font-mono text-xs" />
                      <Button variant="outline" size="icon" className="h-11 w-11 shrink-0 md:h-10 md:w-10" onClick={() => handleCopyLink(idx, page.path)} title="Copiar link" aria-label="Copiar link">
                        {copiedIdx === 100 + idx ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Código embed (iframe)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        readOnly
                        value={getEmbedCode(page.path)}
                        className="min-w-0 bg-muted/50 font-mono text-xs"
                      />
                      <Button variant="outline" size="icon" className="h-11 w-11 shrink-0 md:h-10 md:w-10" onClick={() => handleCopyEmbed(idx, page.path)} title="Copiar embed" aria-label="Copiar embed">
                        {copiedIdx === idx ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                      </Button>
                      <Button variant="outline" size="icon" className="h-11 w-11 shrink-0 md:h-10 md:w-10" onClick={() => handleCopyFixedEmbed(idx, page.path)} title="Copiar embed tela cheia" aria-label="Copiar embed tela cheia">
                        {copiedIdx === 200 + idx ? <Check className="h-4 w-4 text-success" /> : <RefreshCw className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Use <RefreshCw className="inline h-3 w-3" aria-label="o botão de tela cheia" /> para gerar embed que ocupa 100% da tela.
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </TabsContent>
      )}
    </Tabs>

      {/* Edit dialog */}
      <Dialog open={showEdit} onOpenChange={(v) => { setShowEdit(v); if (!v) setSelectedUser(null); }}>
        <DialogContent className="folha-lateral left-auto right-0 top-0 h-[100svh] max-h-[100svh] w-full max-w-none translate-x-0 translate-y-0 content-start overflow-y-auto rounded-none p-5 sm:right-3 sm:top-3 sm:h-[calc(100svh-1.5rem)] sm:max-h-[calc(100svh-1.5rem)] sm:max-w-[480px] sm:rounded-[22px] sm:p-6">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
          </DialogHeader>
          {editForm && (
            <div className="space-y-4">
              <div>
                <Label>Nome</Label>
                <Input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
              </div>
              <div>
                <Label>Vínculo</Label>
                <Select 
                  value={editForm.bond_type || 'none'} 
                  onValueChange={v => {
                    const bond = v === 'none' ? null : (v as BondType);
                    const derived = deriveFromBond(bond, editForm.unit);
                    setEditForm({
                      ...editForm,
                      bond_type: bond,
                      ...(derived ? { permission_level: derived.permission_level as any, unit: derived.unit as any } : {}),
                    });
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione o vínculo" /></SelectTrigger>
                  <SelectContent>
                    {BOND_GROUPS.map(group => (
                      <div key={group.label}>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{group.label}</div>
                        {group.options.map(opt => (
                          <SelectItem key={opt} value={opt}>{BOND_LABELS[opt]}</SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {editForm.bond_type === 'parceiro' && (
                <div>
                  <Label>Categoria do Parceiro</Label>
                  <Select
                    value={editForm.partner_category || ''}
                    onValueChange={v => setEditForm({ ...editForm, partner_category: v as PartnerCategory })}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
                    <SelectContent>
                      {PARTNER_CATEGORIES.map(c => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label>Nível de Acesso</Label>
                <Select 
                  disabled={!!editForm.bond_type && !isAdmin}
                  value={editForm.permission_level} 
                  onValueChange={v => {
                    const newLevel = v as any;
                    let newUnit = editForm.unit;
                    
                    if (newLevel === 'admin_geral' || newLevel === 'eventos_parceiros') {
                      newUnit = 'Administração';
                    } else if (newLevel === 'gestor_unidade' && newUnit === 'Administração') {
                      newUnit = 'DIC'; // Valor padrão para gestores
                    }
                    
                    setEditForm({ ...editForm, permission_level: newLevel, unit: newUnit });
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PERMISSION_LEVELS
                      .filter(p => isAdmin || p.value !== 'admin_geral')
                      .map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Unidade</Label>
                {editForm.bond_type && BOND_RULES[editForm.bond_type as BondType]?.unitMode === 'none' ? (
                  <p className="text-sm text-muted-foreground py-2">Vínculo externo — sem unidade.</p>
                ) : (
                  <Select 
                    disabled={
                      editForm.permission_level === 'admin_geral' ||
                      editForm.permission_level === 'eventos_parceiros' ||
                      (!!editForm.bond_type && BOND_RULES[editForm.bond_type as BondType]?.unitMode === 'fixed-admin')
                    }
                    value={editForm.unit} 
                    onValueChange={v => setEditForm({ ...editForm, unit: v as any })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {UNITS.filter(u => {
                        const mode = editForm.bond_type ? BOND_RULES[editForm.bond_type as BondType]?.unitMode : undefined;
                        if (mode === 'fixed-admin') return u === 'Administração';
                        if (mode === 'choose') return u !== 'Administração';
                        if (editForm.permission_level === 'gestor_unidade') return u !== 'Administração';
                        return true;
                      }).map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="flex flex-col gap-4 rounded-[16px] border border-border bg-muted/40 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-semibold">
                      Acesso Antecipado
                    </Label>
                    <p className="text-xs text-muted-foreground">Este usuário verá o ambiente de testes/beta.</p>
                  </div>
                  <Switch 
                    checked={!!editForm.is_beta_tester}
                    onCheckedChange={checked => setEditForm({ ...editForm, is_beta_tester: checked })}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 px-1">

                <Switch checked={editForm.is_active} onCheckedChange={v => setEditForm({ ...editForm, is_active: v })} />
                <Label>Usuário ativo</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdit(false)}>Cancelar</Button>
            <Button onClick={handleSave}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset password dialog */}
      <Dialog open={!!resetTarget} onOpenChange={(v) => { if (!v) { setResetTarget(null); setNewPassword(''); setConfirmPassword(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redefinir senha</DialogTitle>
          </DialogHeader>
          {resetTarget && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Definir nova senha para <strong className="text-foreground">{resetTarget.name}</strong> ({resetTarget.email}).
                Anote e entregue ao usuário pelo canal interno.
              </p>
              <div className="space-y-1.5">
                <Label>Nova senha</Label>
                <Input type="text" autoComplete="off" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
              </div>
              <div className="space-y-1.5">
                <Label>Confirmar senha</Label>
                <Input type="text" autoComplete="off" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetTarget(null)} disabled={resetSubmitting}>Cancelar</Button>
            <Button onClick={handleResetPassword} disabled={resetSubmitting}>
              {resetSubmitting ? 'Salvando...' : 'Salvar nova senha'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Impersonate confirm dialog */}
      <Dialog open={!!impersonateTarget} onOpenChange={(v) => { if (!v && !impersonateSubmitting) setImpersonateTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Entrar como usuário</DialogTitle>
          </DialogHeader>
          {impersonateTarget && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Você entrará na conta de <strong className="text-foreground">{impersonateTarget.name}</strong> ({impersonateTarget.email}).
              </p>
              <p className="text-sm text-muted-foreground">
                Sua sessão atual será encerrada. Para voltar à sua conta, use o botão "Sair da impersonação" no banner do topo e faça login novamente.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setImpersonateTarget(null)} disabled={impersonateSubmitting}>Cancelar</Button>
            <Button onClick={handleImpersonate} disabled={impersonateSubmitting}>
              {impersonateSubmitting ? 'Entrando...' : 'Entrar como usuário'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={(v) => { setShowDeleteConfirm(v); if (!v) { setBulkDelete(false); if (!showEdit) setSelectedUser(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">
              Excluir Permanentemente
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              {bulkDelete 
                ? `Você está prestes a excluir ${selectedUsers.size} usuários permanentemente. Esta ação não pode ser desfeita.`
                : `Você está prestes a excluir o usuário ${selectedUser?.name} permanentemente. Esta ação não pode ser desfeita.`
              }
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={executeDelete} disabled={processingId === 'deleting'}>
              {processingId === 'deleting' ? 'Excluindo...' : 'Excluir Agora'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Approval confirmation dialog */}
      <Dialog open={!!showApprovalConfirm} onOpenChange={(v) => { if (!v) setShowApprovalConfirm(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Aprovação</DialogTitle>
          </DialogHeader>
          {showApprovalConfirm && (
            <div className="space-y-4">
              <Alert className="rounded-[16px] border-warning/40 bg-card">
                <AlertTitle className="inline-flex items-center gap-1.5 font-semibold text-warning">
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  Aviso de Ciência
                </AlertTitle>
                <AlertDescription className="text-muted-foreground">
                  Ao aprovar este usuário, você confirma estar ciente das permissões que serão concedidas a ele no sistema. 
                  Certifique-se de que a unidade e o nível de acesso solicitados estão corretos.
                </AlertDescription>
              </Alert>
              <p className="text-sm">
                Aprovar <strong className="text-foreground">{showApprovalConfirm.req.name}</strong> como <strong>{ROLE_LABELS[showApprovalConfirm.req.requested_role] || showApprovalConfirm.req.requested_role}</strong>?
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApprovalConfirm(null)}>Cancelar</Button>
            <Button onClick={() => handleApprove(showApprovalConfirm?.req)}>Confirmar Aprovação</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Role toggle confirmation dialog */}
      <Dialog open={showRoleToggleConfirm !== null} onOpenChange={(v) => { if (!v) setShowRoleToggleConfirm(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Confirmar Alteração de Restrição
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {showRoleToggleConfirm === true 
                ? "Você está prestes a ATIVAR as restrições globais. Os usuários deixarão de ver todas as unidades e passarão a ver apenas o que está configurado para seu cargo ou perfil individual."
                : "Você está prestes a DESATIVAR as restrições globais. Todos os usuários terão acesso irrestrito a todas as unidades do sistema, independente das configurações abaixo."
              }
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRoleToggleConfirm(null)}>Cancelar</Button>
            <Button onClick={() => {
              updateConfig.mutate({ key: 'enable_role_based_view', value: showRoleToggleConfirm });
              setShowRoleToggleConfirm(null);
            }}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Pre-register dialog */}
      <Dialog open={showPreRegister} onOpenChange={setShowPreRegister}>
        <DialogContent className="folha-lateral left-auto right-0 top-0 h-[100svh] max-h-[100svh] w-full max-w-none translate-x-0 translate-y-0 content-start overflow-y-auto rounded-none p-5 sm:right-3 sm:top-3 sm:h-[calc(100svh-1.5rem)] sm:max-h-[calc(100svh-1.5rem)] sm:max-w-[480px] sm:rounded-[22px] sm:p-6">
          <DialogHeader>
            <DialogTitle>
              Pré-cadastro de Usuário
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="pre-name">Nome Completo</Label>
              <Input 
                id="pre-name" 
                placeholder="Ex: João Silva" 
                value={preRegisterForm.name} 
                onChange={e => setPreRegisterForm({ ...preRegisterForm, name: e.target.value })} 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pre-email">E-mail</Label>
              <Input 
                id="pre-email" 
                type="email" 
                placeholder="exemplo@email.com" 
                value={preRegisterForm.email} 
                onChange={e => setPreRegisterForm({ ...preRegisterForm, email: e.target.value })} 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pre-password">Senha Provisória</Label>
              <Input 
                id="pre-password" 
                type="text" 
                placeholder="Mínimo 6 caracteres" 
                value={preRegisterForm.password} 
                onChange={e => setPreRegisterForm({ ...preRegisterForm, password: e.target.value })} 
              />
              <p className="text-xs text-muted-foreground">
                Informe esta senha ao usuário. Ele poderá alterá-la depois.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Vínculo</Label>
              <Select 
                value={preRegisterForm.bond_type || 'none'} 
                onValueChange={v => {
                  const bond = v === 'none' ? '' : (v as BondType);
                  const derived = deriveFromBond(bond as BondType, preRegisterForm.unit);
                  setPreRegisterForm({
                    ...preRegisterForm,
                    bond_type: bond,
                    ...(derived ? { permission_level: derived.permission_level, unit: derived.unit } : {}),
                  });
                }}
              >
                <SelectTrigger><SelectValue placeholder="Selecione o vínculo" /></SelectTrigger>
                <SelectContent>
                  {BOND_GROUPS.map(group => (
                    <div key={group.label}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{group.label}</div>
                      {group.options.map(opt => (
                        <SelectItem key={opt} value={opt}>{BOND_LABELS[opt]}</SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {preRegisterForm.bond_type === 'parceiro' && (
              <div className="space-y-2">
                <Label>Categoria do Parceiro</Label>
                <Select
                  value={preRegisterForm.partner_category || ''}
                  onValueChange={v => setPreRegisterForm({ ...preRegisterForm, partner_category: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
                  <SelectContent>
                    {PARTNER_CATEGORIES.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nível de Acesso</Label>
                <Select 
                  disabled={!!preRegisterForm.bond_type}
                  value={preRegisterForm.permission_level} 
                  onValueChange={v => {
                    const newLevel = v as any;
                    let newUnit = preRegisterForm.unit;
                    if (newLevel === 'admin_geral' || newLevel === 'eventos_parceiros') newUnit = 'Administração';
                    else if (newLevel === 'gestor_unidade' && newUnit === 'Administração') newUnit = 'DIC';
                    setPreRegisterForm({ ...preRegisterForm, permission_level: newLevel, unit: newUnit });
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PERMISSION_LEVELS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Unidade</Label>
                {preRegisterForm.bond_type && BOND_RULES[preRegisterForm.bond_type as BondType]?.unitMode === 'none' ? (
                  <p className="text-sm text-muted-foreground py-2">Vínculo externo — sem unidade.</p>
                ) : (
                  <Select 
                    disabled={
                      preRegisterForm.permission_level === 'admin_geral' ||
                      preRegisterForm.permission_level === 'eventos_parceiros' ||
                      (!!preRegisterForm.bond_type && BOND_RULES[preRegisterForm.bond_type as BondType]?.unitMode === 'fixed-admin')
                    }
                    value={preRegisterForm.unit} 
                    onValueChange={v => setPreRegisterForm({ ...preRegisterForm, unit: v as any })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {UNITS.filter(u => {
                        const mode = preRegisterForm.bond_type ? BOND_RULES[preRegisterForm.bond_type as BondType]?.unitMode : undefined;
                        if (mode === 'fixed-admin') return u === 'Administração';
                        if (mode === 'choose') return u !== 'Administração';
                        if (preRegisterForm.permission_level === 'gestor_unidade') return u !== 'Administração';
                        return true;
                      }).map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreRegister(false)} disabled={preRegisterSubmitting}>Cancelar</Button>
            <Button onClick={handlePreRegister} disabled={preRegisterSubmitting}>
              {preRegisterSubmitting ? 'Cadastrando...' : 'Finalizar Cadastro'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <PageGuide activeTab={activeTab} />
    </div>
  );
}