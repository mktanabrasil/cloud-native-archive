import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { useUIVersions } from '@/hooks/useUIVersions';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole, useAccessRequests } from '@/hooks/useUserRole';
import { useIsMobile } from '@/hooks/use-mobile';
import { useDbUsers } from '@/hooks/useDbUsers';
import { useViewConfigs } from '@/hooks/useViewConfigs';
import { AppUser, UNITS, PERMISSION_LEVELS, BOND_LABELS, BOND_GROUPS, BOND_RULES, BondType, PARTNER_CATEGORIES, PartnerCategory } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Search, Edit2, Code2, Copy, Check, UserCheck, UserPlus, UserX, Clock, ShieldCheck, Shield, Eye, RefreshCw, KeyRound, UserCog, AlertTriangle, Trash2, ChevronDown, History, Rocket, ArrowLeft, FlaskConical, Building2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import BulkActionBar from '@/components/BulkActionBar';
import PageHeader from '@/components/PageHeader';
import { supabase } from '@/integrations/supabase/client';
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


const ROLE_ICONS: Record<string, React.ReactNode> = {
  admin: <ShieldCheck className="h-3.5 w-3.5" />,
  admin_geral: <ShieldCheck className="h-3.5 w-3.5" />,
  criador: <Edit2 className="h-3.5 w-3.5" />,
  editor: <Shield className="h-3.5 w-3.5" />,
  gestor_unidade: <Shield className="h-3.5 w-3.5" />,
  eventos_parceiros: <Shield className="h-3.5 w-3.5" />,
  usuario_padrao: <Shield className="h-3.5 w-3.5 opacity-50" />,
};

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
        let hasError = false;
        
        for (const id of ids) {
          const isDbUser = dbUsers.some(u => u.user_id === id);
          if (isDbUser) {
            const { data, error } = await supabase.functions.invoke('admin-delete-user', {
              body: { userId: id }
            });
            if (error || (data as any)?.error) {
              console.error('Erro ao excluir usuário:', id, error || (data as any)?.error);
              hasError = true;
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
        if (hasError) {
          toast({ 
            title: 'Alguns erros ocorreram', 
            description: 'Alguns usuários não puderam ser excluídos. Verifique se você tem permissão ou se o usuário ainda existe.',
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
              description: (data as any)?.error || error?.message || 'Falha ao excluir usuário.', 
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
      { id: 'admins', title: 'Administradores', users: admins, icon: <ShieldCheck className="h-5 w-5 text-primary" /> },
      { id: 'gestores', title: 'Gestores', users: gestores, icon: <Shield className="h-5 w-5 text-primary" /> },
      { id: 'normal', title: 'Usuários e Visualizadores', users: normalUsers, icon: <UserCog className="h-5 w-5 text-primary" /> }
    ];
  }, [filtered]);

  const baseUrl = useMemo(() => {
    const origin = window.location.origin;
    // Se estiver no ambiente de preview do Lovable, sugerimos a URL de produção para os embeds
    // Isso evita que ao colar o embed em outro site, peça login no Lovable
    if (origin.includes('lovable.app') && (origin.includes('-preview--') || origin.includes('lovableproject.com'))) {
      return 'https://r2-vault-craft.lovable.app';
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
      await approveRequest(req.id, req.user_id, req.requested_role, level, unit);
        
      toast({ title: 'Aprovado!', description: `Acesso de ${req.name} foi aprovado como ${ROLE_LABELS[req.requested_role]}.` });
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
                className="h-8 w-8 text-muted-foreground hover:text-primary"
              >
                <KeyRound className="h-4 w-4" />
              </Button>
            )}
            
            <Button variant="ghost" size="icon" onClick={() => handleEdit(user)} className="h-8 w-8 text-muted-foreground hover:text-primary" title="Editar usuário">
              <Edit2 className="h-4 w-4" />
            </Button>

            {isAdmin && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => { setSelectedUser(user); setBulkDelete(false); setShowDeleteConfirm(true); }} 
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                title="Excluir permanentemente"
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
            className="h-8 w-8 text-muted-foreground hover:text-primary"
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

    const envBadge = (env?: string | null) => {
      const map: Record<string, string> = {
        'lovable': 'bg-purple-500/10 text-purple-700 border-purple-500/30',
        'cloudflare-production': 'bg-orange-500/10 text-orange-700 border-orange-500/30',
        'cloudflare-preview': 'bg-amber-500/10 text-amber-700 border-amber-500/30',
      };
      const label = env || 'estável';
      return <Badge variant="outline" className={`text-[10px] ${map[env || ''] || ''}`}>{label}</Badge>;
    };

    const filtered = envFilter === 'all' ? versions : versions.filter(v => (v.environment || 'legado') === envFilter);

    return (
      <div className="space-y-6">
        <Alert className="bg-primary/5 border-primary/20">
          <FlaskConical className="h-4 w-4 text-primary" />
          <AlertTitle className="text-primary text-sm font-semibold">Configuração de Versões</AlertTitle>
          <AlertDescription className="text-muted-foreground text-xs leading-relaxed">
            Usuários com a chave <strong>Modo Teste</strong> ligada veem a versão marcada como <strong>Versão Teste</strong>. 
            Os demais veem a versão marcada como <strong>Versão Produção</strong>. 
          </AlertDescription>
        </Alert>

        <div className="flex flex-col md:flex-row gap-6">

          <Card className="flex-1 border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Rocket className="h-5 w-5 text-primary" />
                Publicação Geral
              </CardTitle>
            </CardHeader>
            <CardContent>
              {vLoading ? <p>Carregando...</p> : (
                <div className="space-y-4">
                  <div className="p-4 bg-background rounded-lg border">
                    <p className="font-bold text-xl">{currentVersion?.name || 'Versão Inicial'}</p>
                    <p className="text-sm text-muted-foreground">ID: {currentVersion?.id || 'stable'}</p>
                    {currentVersion?.config?.published_at && (
                      <p className="text-xs text-muted-foreground">Publicada em: {new Date(currentVersion.config.published_at).toLocaleString('pt-BR')}</p>
                    )}
                  </div>
                  <Button onClick={() => setShowPromote(true)} className="w-full gap-2">
                    <Rocket className="h-4 w-4" />
                    Publicar Versão Atual para Todos
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="flex-1">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <History className="h-5 w-5 text-primary" />
                  Histórico de Versões
                </CardTitle>
                <select
                  value={envFilter}
                  onChange={(e) => setEnvFilter(e.target.value)}
                  className="text-xs border rounded px-2 py-1 bg-background"
                >
                  <option value="all">Todos</option>
                  <option value="lovable">Lovable</option>
                  <option value="cloudflare-production">CF Production</option>
                  <option value="cloudflare-preview">CF Preview</option>
                  <option value="legado">Legado</option>
                </select>
              </div>
              <p className="text-xs text-muted-foreground">Últimas 30 versões.</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[480px] overflow-y-auto pr-2">
                {filtered.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma versão.</p> :
                  filtered.map(v => (
                    <div key={v.id} className="flex flex-col gap-2 p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm truncate">{v.name}</p>
                            {envBadge(v.environment)}
                            {v.is_active_beta && <Badge className="text-[10px] bg-blue-500/15 text-blue-700 border-blue-500/30" variant="outline">Versão Teste</Badge>}
                            {v.is_active_production && <Badge className="text-[10px] bg-green-500/15 text-green-700 border-green-500/30" variant="outline">Versão Produção</Badge>}
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {v.commit_sha ? <code className="font-mono">{v.commit_sha.slice(0, 7)}</code> : '—'} · {new Date(v.deployed_at || v.created_at).toLocaleString('pt-BR')}
                            {v.deployed_by && ` · ${v.deployed_by}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <Button variant="outline" size="sm" className="h-7 text-xs"
                          disabled={!!v.is_active_beta}
                          onClick={async () => { try { await setActiveBeta(v); toast({ title: 'Ativada para Beta Testers' }); } catch (e: any) { toast({ title: 'Erro', description: e.message, variant: 'destructive' }); } }}>
                          Ativar para Teste
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 text-xs"
                          disabled={!!v.is_active_production}
                          onClick={async () => { try { await promoteVersionToProduction(v); toast({ title: 'Promovida para Produção' }); } catch (e: any) { toast({ title: 'Erro', description: e.message, variant: 'destructive' }); } }}>
                          <Rocket className="h-3 w-3 mr-1" /> Produção
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs"
                          disabled={currentVersion?.id === v.id}
                          onClick={() => rollback(v)}>
                          Reverter config
                        </Button>
                      </div>
                    </div>
                  ))
                }
              </div>
            </CardContent>
          </Card>
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
    <div className="animate-fade-in space-y-8">
      <PageHeader
        title={hideTitleParam ? "" : "Painel"}
        description={hideTitleParam ? "" : "Gerencie usuários, permissões e configurações de visualização"}
        hidden={hideTitleParam}
        className="mb-4"
        actions={
          <div className="flex flex-wrap items-center justify-start sm:justify-end gap-3 w-full">

            {isAdmin && (
              <Button 
                onClick={() => setShowPreRegister(true)}
                className="gap-2 h-10 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <UserPlus className="h-4 w-4" />
                <span className="hidden sm:inline">Pré-cadastro</span>
                <span className="sm:hidden">Novo</span>
              </Button>
            )}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
              <TabsList className="h-10">
                <TabsTrigger value="users" className="h-8">Usuários</TabsTrigger>
                {isAdmin && (
                  <TabsTrigger value="beta-configs" className="gap-1.5 h-8">
                    <History className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Versões</span>
                  </TabsTrigger>
                )}
                {isAdmin && (
                  <TabsTrigger value="view-configs" className="gap-1.5 h-8">
                    <Eye className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Visualização</span>
                  </TabsTrigger>
                )}
                {isAdmin && (
                  <TabsTrigger value="embed" className="gap-1.5 h-8">
                    <Code2 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Embed</span>
                  </TabsTrigger>
                )}
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-2">
              {isAdmin && (
                <Button 
                  variant="outline" 
                  size="icon" 
                  title="Configuração de Versões"
                  onClick={() => setActiveTab('beta-configs')}
                  className={`h-10 w-10 ${activeTab === 'beta-configs' ? 'bg-primary/10 text-primary border-primary' : ''}`}
                >
                  <History className="h-4 w-4" />
                </Button>
              )}
              <div className="relative w-40 sm:w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input 
                  placeholder="Buscar usuário..." 
                  value={search} 
                  onChange={e => setSearch(e.target.value)} 
                  className="pl-9 h-10 shadow-sm border-muted-foreground/20 focus-visible:ring-primary bg-background" 
                />
              </div>
            </div>
          </div>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>

        <TabsContent value="users" className="space-y-6">
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

          <div className="space-y-4">
            <button
              onClick={() => setApprovalsExpanded(!approvalsExpanded)}
              className="w-full flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-all duration-200"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-primary/10">
                  <UserCheck className="h-5 w-5 text-primary" />
                </div>
                <div className="flex flex-col items-start">
                  <span className="font-semibold text-foreground">Solicitações de Aprovação</span>
                  <span className="text-xs text-muted-foreground">
                    {requests.length === 0 
                      ? "Nenhuma solicitação pendente" 
                      : `${requests.length} ${requests.length === 1 ? 'solicitação aguardando' : 'solicitações aguardando'} sua análise`}
                  </span>
                </div>
                {requests.length > 0 && (
                  <Badge variant="destructive" className="ml-1 h-5 w-5 rounded-full p-0 text-[10px] flex items-center justify-center animate-pulse">
                    {requests.length}
                  </Badge>
                )}
              </div>
              <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform duration-300 ${approvalsExpanded ? 'rotate-180' : ''}`} />
            </button>

            {approvalsExpanded && (
              <Card className="border-primary/20 bg-primary/5 animate-in slide-in-from-top-2 duration-300">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    {podeGerirTodos ? 'Solicitações de Acesso Pendentes' : 'Minha Solicitação de Acesso'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {requestsLoading ? (
                    <p className="text-sm text-muted-foreground">Carregando...</p>
                  ) : displayRequests.length === 0 ? (
                    <div className="text-center py-6">
                      <UserCheck className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">{podeGerirTodos ? 'Nenhuma solicitação pendente' : 'Você não possui solicitações de acesso pendentes'}</p>
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                      {displayRequests.map(req => (
                        <div key={req.id} className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-sm">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                                {req.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-foreground truncate">{req.name}</p>
                                <p className="text-xs text-muted-foreground truncate">{req.email}</p>
                              </div>
                            </div>
                            <Badge variant="secondary" className="text-[10px] shrink-0">
                              {new Date(req.requested_at).toLocaleDateString('pt-BR')}
                            </Badge>
                          </div>
                          <div className="flex flex-col gap-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className="gap-1 w-fit">
                                {ROLE_ICONS[req.requested_role]}
                                {ROLE_LABELS[req.requested_role] || req.requested_role}
                              </Badge>
                              {/* A unidade pedida fica à vista: é ela que decide qual
                                  jornal a pessoa vai enxergar, e quem aprova precisa
                                  conferir antes — não depois. */}
                              {req.requested_unit ? (
                                <Badge variant="secondary" className="gap-1 w-fit">
                                  <Building2 className="h-3 w-3" />
                                  {req.requested_unit}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="w-fit border-amber-400 text-amber-700 dark:text-amber-300">
                                  Sem unidade
                                </Badge>
                              )}
                            </div>
                            {podeGerirTodos && (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="flex-1 gap-1.5 h-8 text-xs"
                                  disabled={processingId === req.id}
                                  onClick={() => onApproveClick(req)}
                                >
                                  <UserCheck className="h-3.5 w-3.5" />
                                  Aprovar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="flex-1 gap-1.5 h-8 text-xs"
                                  disabled={processingId === req.id}
                                  onClick={() => handleReject(req)}
                                >
                                  <UserX className="h-3.5 w-3.5" />
                                  Rejeitar
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
          {dbUsersLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <RefreshCw className="h-8 w-8 text-primary animate-spin mb-4" />
              <p className="text-muted-foreground">Carregando usuários...</p>
            </div>
          ) : (
            <div className="space-y-8">
              {groupedUsers.map(group => group.users.length > 0 && (
                <div key={group.id} className="space-y-4">
                  <div className="flex items-center gap-2 px-1 border-b pb-2">
                    {group.icon}
                    <h2 className="text-lg font-semibold text-foreground">{group.title}</h2>
                    <Badge variant="secondary" className="ml-auto">{group.users.length}</Badge>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                    {group.users.map(user => (
                      <Card key={user.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="flex flex-col gap-4 p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {isAdmin && (
                                <Checkbox
                                  checked={selectedUsers.has(user.id)}
                                  onCheckedChange={() => toggleUserSelection(user.id)}
                                  className="h-4 w-4"
                                />
                              )}
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                                {user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className="font-medium text-foreground truncate">{user.name}</p>
                                </div>
                                <p className="text-xs text-muted-foreground truncate">{user.email}</p>

                              </div>
                            </div>
                            {renderActions(user)}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="text-[10px]">{user.unit}</Badge>
                            <Badge variant="secondary" className="text-[10px]">{permLabel(user.permission_level)}</Badge>
                            {user.bond_type && BOND_LABELS[user.bond_type as BondType] && (
                              <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">
                                {BOND_LABELS[user.bond_type as BondType]}
                              </Badge>
                            )}
                            <Badge variant={user.is_active ? 'default' : 'destructive'} className="text-[10px]">
                              {user.is_active ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="text-center py-12 border rounded-lg bg-muted/20">
                  <p className="text-muted-foreground">Nenhum usuário encontrado.</p>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {isAdmin && (
          <TabsContent value="beta-configs" className="mt-4 space-y-6">
            <BetaManager />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="view-configs" className="mt-4 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  Configuração de Visualização por Perfil
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Defina quais unidades cada tipo de usuário pode visualizar por padrão.
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className={`p-4 rounded-lg border transition-all duration-200 ${
                  configs?.enable_role_based_view 
                    ? "bg-primary/5 border-primary/20 shadow-sm" 
                    : "bg-muted/30 border-border"
                }`}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="enable-role-view" className="text-base font-bold">
                          Sistema de Restrição por Cargo
                        </Label>
                        {configs?.enable_role_based_view ? (
                          <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20 border-green-500/20 gap-1 px-1.5 py-0 h-5">
                            <Check className="h-3 w-3" /> Ativo
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground gap-1 px-1.5 py-0 h-5">
                            Inativo
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                        Quando <strong>Ligado</strong>, o sistema segue estritamente os padrões definidos por <strong>Cargo</strong> abaixo. 
                        Quando <strong>Desligado</strong>, o sistema permite <strong>Restrições Individuais</strong> personalizadas por usuário.
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Switch 
                        id="enable-role-view" 
                        checked={configs?.enable_role_based_view || false} 
                        onCheckedChange={(v) => setShowRoleToggleConfirm(v)}
                        className="data-[state=checked]:bg-primary"
                      />
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                        {configs?.enable_role_based_view ? "Ligado" : "Desligado"}
                      </span>
                    </div>
                  </div>
                </div>


                {!configs?.enable_role_based_view && (
                  <Alert className="bg-amber-50 border-amber-200 text-amber-800">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <div>
                      <AlertTitle className="text-amber-800 font-semibold">Configurações Inativas</AlertTitle>
                      <AlertDescription className="text-amber-700/90 text-xs">
                        O sistema de restrição global está desativado. As definições por cargo abaixo estão sendo ignoradas no momento.
                      </AlertDescription>
                    </div>
                  </Alert>
                )}

                <div className={`grid gap-6 md:grid-cols-2 transition-all duration-300 ${!configs?.enable_role_based_view ? "opacity-50 grayscale-[0.5] pointer-events-none select-none" : ""}`}>
                  {Object.entries(configs?.role_defaults || {}).map(([role, allowedUnits]) => (
                    <div key={role} className="space-y-3 p-4 border rounded-lg bg-card shadow-sm">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="space-y-1">
                          <Label className="font-bold capitalize">{ROLE_LABELS[role] || role}</Label>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-[10px] font-medium h-5">
                              {allowedUnits.length} de {UNITS.length} unidades
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            disabled={!configs?.enable_role_based_view}
                            className="h-7 px-2 text-[10px] font-semibold hover:text-primary hover:bg-primary/5 disabled:opacity-50"
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
                            className="h-7 px-2 text-[10px] font-semibold hover:text-destructive hover:bg-destructive/5 disabled:opacity-50"
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
                            className="h-7 w-7 text-muted-foreground hover:text-primary disabled:opacity-50"
                            title="Resetar usuários deste perfil"
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
                      <div className="grid grid-cols-2 gap-1.5 max-h-[180px] overflow-y-auto pr-1">
                        {UNITS.map(unit => (
                          <div key={unit} className="flex items-center justify-between p-1.5 border rounded-md bg-background/50 hover:bg-accent/50 transition-colors">
                            <Label htmlFor={`role-${role}-${unit}`} className="text-[11px] cursor-pointer font-medium truncate flex-1">{unit}</Label>
                            <Switch 
                              id={`role-${role}-${unit}`}
                              className="scale-[0.7] origin-right"
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
              </CardContent>
            </Card>

            <Card className={configs?.enable_role_based_view ? "border-primary/20 bg-muted/5" : ""}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Search className="h-5 w-5 text-primary" />
                      Restrições Personalizadas
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {configs?.enable_role_based_view 
                        ? "As restrições individuais estão desabilitadas pois o Sistema por Cargo está ativo." 
                        : "Busque um usuário para definir restrições específicas ou veja quem já possui configurações customizadas."}
                    </p>
                  </div>
                  {configs?.enable_role_based_view && (
                    <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 gap-1.5 py-1 px-3">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Sistema por Cargo Ativo
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className={`space-y-6 transition-opacity duration-300 ${configs?.enable_role_based_view ? "opacity-50 pointer-events-none grayscale-[0.5]" : ""}`}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input 
                    placeholder="Buscar usuário por nome ou email..." 
                    value={viewSearch} 
                    onChange={e => setViewSearch(e.target.value)} 
                    disabled={configs?.enable_role_based_view}
                    className="pl-9"
                  />
                  {viewSearch.length > 2 && (
                    <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
                      {combinedUsers
                        .filter(u => u.name.toLowerCase().includes(viewSearch.toLowerCase()) || u.email.toLowerCase().includes(viewSearch.toLowerCase()))
                        .map(u => (
                          <button
                            key={u.id}
                            className="w-full px-4 py-2 text-left hover:bg-accent transition-colors flex items-center justify-between"
                            onClick={() => {
                              setSelectedViewUser(u);
                              setViewSearch('');
                            }}
                          >
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">{u.name}</span>
                              <span className="text-xs text-muted-foreground">{u.email}</span>
                            </div>
                            <Badge variant="secondary" className="text-[10px]">{ROLE_LABELS[u.permission_level] || u.permission_level}</Badge>
                          </button>
                        ))
                      }
                    </div>
                  )}
                </div>

                {selectedViewUser && (
                  <div className="p-4 border rounded-lg bg-accent/30 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                          {selectedViewUser.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">{selectedViewUser.name}</p>
                          <p className="text-xs text-muted-foreground">{selectedViewUser.email}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedViewUser(null)}>Fechar</Button>
                    </div>

                    <div className="flex items-center justify-between p-3 border rounded-lg bg-primary/5">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-semibold flex items-center gap-2">
                          <Code2 className="h-4 w-4 text-primary" />
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
                      <div className="grid grid-cols-2 gap-2">
                        {UNITS.map(unit => {
                          const currentRestrictions = (selectedViewUser as any).view_restrictions || configs?.role_defaults[selectedViewUser.permission_level] || UNITS;
                          const isChecked = currentRestrictions.includes(unit);
                          
                          return (
                            <div key={unit} className="flex items-center justify-between p-2 border rounded-md bg-background/50">
                              <Label htmlFor={`user-${selectedViewUser.id}-${unit}`} className="text-sm cursor-pointer font-medium">{unit}</Label>
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
                      className="w-full gap-2"
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
                      <RefreshCw className="h-4 w-4" />
                      Redefinir para Padrão do Perfil
                    </Button>
                  </div>
                )}

                <div className="space-y-4">
                  <h3 className="text-sm font-semibold border-b pb-2">Usuários com Restrições Customizadas</h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {combinedUsers
                      .filter(u => (u as any).view_restrictions !== null && (u as any).view_restrictions !== undefined)
                      .map(u => (
                        <div key={u.id} className="p-3 border rounded-md flex items-center justify-between">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{u.name}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            disabled={configs?.enable_role_based_view}
                            className="h-8 w-8"
                            onClick={() => setSelectedViewUser(u)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    {combinedUsers.filter(u => (u as any).view_restrictions !== null && (u as any).view_restrictions !== undefined).length === 0 && (
                      <p className="text-xs text-muted-foreground text-center col-span-full py-4">Nenhum usuário com restrições customizadas.</p>
                    )}
                  </div>
                </div>
          </CardContent>
        </Card>
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="embed" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Code2 className="h-5 w-5 text-primary" />
                Links e Códigos Embed
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Use estes links para incorporar páginas em sites externos.
              </p>
              {window.location.origin.includes('-preview--') && (
                <Alert className="bg-primary/5 border-primary/10">
                  <Eye className="h-4 w-4 text-primary" />
                  <AlertTitle className="text-primary text-xs font-semibold">Nota de Publicação</AlertTitle>
                  <AlertDescription className="text-muted-foreground text-[11px]">
                    Detectamos que você está no ambiente de visualização. Os links abaixo já foram 
                    ajustados para usar o domínio público <strong>r2-vault-craft.lovable.app</strong> para que 
                    não peçam login do Lovable ao serem incorporados.
                  </AlertDescription>
                </Alert>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Switch id="show-header" checked={!hideHeader} onCheckedChange={(v) => setHideHeader(!v)} />
                    <Label htmlFor="show-header" className="text-sm font-medium cursor-pointer">Habilitar Cabeçalho e Menu</Label>
                  </div>
                  <p className="text-xs text-muted-foreground ml-11">
                    Exibe a barra de navegação superior e links de acesso.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Switch id="show-title" checked={!hideTitle} onCheckedChange={(v) => setHideTitle(!v)} />
                    <Label htmlFor="show-title" className="text-sm font-medium cursor-pointer">Habilitar Título da Página</Label>
                  </div>
                  <p className="text-xs text-muted-foreground ml-11">
                    Exibe o título principal no topo do conteúdo.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Switch id="hide-login" checked={hideLogin} onCheckedChange={setHideLogin} />
                    <Label htmlFor="hide-login" className="text-sm font-medium cursor-pointer">Ocultar Botão de Login</Label>
                  </div>
                  <p className="text-xs text-muted-foreground ml-11">
                    Remove o botão de login para visualização externa segura.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Switch id="hide-footer" checked={hideFooter} onCheckedChange={setHideFooter} />
                    <Label htmlFor="hide-footer" className="text-sm font-medium cursor-pointer">Ocultar Rodapé</Label>
                  </div>
                  <p className="text-xs text-muted-foreground ml-11">
                    Remove o rodapé do Lovable da página.
                  </p>
                </div>
              </div>
              {EMBED_PAGES.map((page, idx) => (
                <div key={idx} className="rounded-lg border border-border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-foreground">{page.name}</h3>
                    <Badge variant="outline" className="text-xs">{page.path}</Badge>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Link direto</Label>
                    <div className="flex items-center gap-2">
                      <Input readOnly value={getUrl(page.path)} className="font-mono text-xs bg-muted/50" />
                      <Button variant="outline" size="icon" className="shrink-0" onClick={() => handleCopyLink(idx, page.path)}>
                        {copiedIdx === 100 + idx ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Código embed (iframe)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        readOnly
                        value={getEmbedCode(page.path)}
                        className="font-mono text-xs bg-muted/50"
                      />
                      <Button variant="outline" size="icon" className="shrink-0" onClick={() => handleCopyEmbed(idx, page.path)} title="Copiar embed">
                        {copiedIdx === idx ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                      </Button>
                      <Button variant="outline" size="icon" className="shrink-0" onClick={() => handleCopyFixedEmbed(idx, page.path)} title="Copiar embed tela cheia">
                        {copiedIdx === 200 + idx ? <Check className="h-4 w-4 text-primary" /> : <RefreshCw className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Use <RefreshCw className="h-3 w-3 inline" /> para gerar embed que ocupa 100% da tela.
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      )}
    </Tabs>

      {/* Edit dialog */}
      <Dialog open={showEdit} onOpenChange={(v) => { setShowEdit(v); if (!v) setSelectedUser(null); }}>
        <DialogContent>
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

              <div className="flex flex-col gap-4 p-4 border rounded-lg bg-primary/5">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-semibold flex items-center gap-2">
                      <Rocket className="h-4 w-4 text-primary" />
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
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
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
              <Alert className="bg-warning/10 border-warning/20">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <AlertTitle className="text-warning-foreground font-semibold">Aviso de Ciência</AlertTitle>
                <AlertDescription className="text-warning-foreground/80">
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
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
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
              <p className="text-[10px] text-muted-foreground">
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