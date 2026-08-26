import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTestView } from '@/contexts/TestViewContext';

export type UserRole = 'admin' | 'editor' | 'criador' | null;

export interface AccessRequest {
  id: string;
  user_id: string;
  requested_role: string;
  /** Unidade escolhida no formulário — o que a aprovação grava no perfil. */
  requested_unit: string | null;
  requested_permission_level: string | null;
  status: string;
  name: string;
  email: string;
  requested_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
}

export function useUserRole() {
  const { user, isAuthenticated } = useAuth();
  const { activePersona } = useTestView();
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);
  const [accessStatus, setAccessStatus] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [isBetaTester, setIsBetaTester] = useState<boolean>(false);
  const [viewRestrictions, setViewRestrictions] = useState<string[] | null>(null);
  const [permissionLevel, setPermissionLevel] = useState<string | null>(null);
  const [unit, setUnit] = useState<string | null>(null);
  const [delegatedUnits, setDelegatedUnits] = useState<string[]>([]);
  const [bondType, setBondType] = useState<string | null>(null);


  useEffect(() => {
    // If a test persona is active, use it instead of real DB role
    if (activePersona) {
      setRole(activePersona.role);
      setUserName(activePersona.name);
      setIsActive(activePersona.is_active);
      setIsBetaTester(false);
      setAccessStatus(activePersona.role ? 'approved' : 'pending');
      setPermissionLevel(activePersona.permission_level);
      setUnit(activePersona.unit);
      setDelegatedUnits(activePersona.delegated_units || []);
      setBondType((activePersona as any).bond_type || null);
      
      // If general admin, no restrictions. Otherwise, restrict to the persona's unit.
      setViewRestrictions(activePersona.permission_level === 'admin_geral' ? null : [activePersona.unit]);
      
      setLoading(false);
      return;
    }

    if (!isAuthenticated || !user) {
      setRole(null);
      setLoading(false);
      setAccessStatus(null);
      return;
    }

    const fetchRole = async () => {
      setLoading(true);
      
      // Get role from user_roles table
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      // Also check profile for permission_level and name
      const { data: profileData } = await supabase
        .from('profiles')
        .select('permission_level, name, is_active, view_restrictions, unit, delegated_units, is_beta_tester, bond_type')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (profileData) {
        setUserName(profileData.name);
  setIsActive(profileData.is_active !== false);
        setIsBetaTester(profileData.is_beta_tester === true);
        setViewRestrictions(profileData.view_restrictions as string[] | null);
        setPermissionLevel(profileData.permission_level);
        setUnit(profileData.unit);
        setDelegatedUnits(profileData.delegated_units as string[] || []);
        setBondType((profileData as any).bond_type || null);
      } else if (user.user_metadata?.name) {
        setUserName(user.user_metadata.name);
      } else {
        setUserName(user.email || 'Usuário');
      }

      let effectiveRole = roleData?.role;
      const isAdminEmail = user.email === 'mkt@anabrasil.org' || user.email === 'alyson-viana@hotmail.com' || user.email === 'contato@anabrasil.org' || user.email === 'transparencia@anabrasil.org';
      
      if (isAdminEmail) {
        effectiveRole = 'admin';
      } else if (!effectiveRole && profileData?.permission_level) {
        if (profileData.permission_level === 'admin_geral') effectiveRole = 'admin';
        else if (profileData.permission_level === 'gestor_unidade') effectiveRole = 'criador';
        else if (profileData.permission_level === 'eventos_parceiros') effectiveRole = 'criador';
        else if (profileData.permission_level === 'editor') effectiveRole = 'editor';
        else effectiveRole = null;
      }

      if (effectiveRole && (effectiveRole === 'admin' || effectiveRole === 'editor' || effectiveRole === 'criador')) {
        setRole(effectiveRole as UserRole);
        setAccessStatus('approved');
      } else {
        // Check if there's a pending access request
        const { data: requestData } = await (supabase
          .from('access_requests') as any)
        .select('status')
        .eq('user_id', user.id)
        .order('requested_at', { ascending: false })
        .limit(1)
        .maybeSingle();

        setRole(null);
        setAccessStatus(requestData?.status || null);
      }
      setLoading(false);
    };

    fetchRole();
  }, [user, isAuthenticated, activePersona]);

  const isAdminEmail = user?.email === 'mkt@anabrasil.org' || user?.email === 'alyson-viana@hotmail.com' || user?.email === 'contato@anabrasil.org' || user?.email === 'transparencia@anabrasil.org';
  const isAdmin = role === 'admin' || permissionLevel === 'admin_geral' || isAdminEmail;
  const isCreator = role === 'criador' || isAdmin;
  const isManager = role === 'editor' || isCreator || permissionLevel === 'gestor_unidade' || permissionLevel === 'eventos_parceiros' || permissionLevel === 'admin_geral' || isAdminEmail;
  const hasDelegatedAccess = delegatedUnits && delegatedUnits.length > 0;
  const canEdit = isAdmin || isCreator || role === 'editor';
  const canCreate = isAdmin || isCreator;
  const canViewAuditoria = isAdmin || isManager || hasDelegatedAccess;
  const canView = true; // System is public
  const isMarketing = isAdmin || bondType === 'marketing' || isAdminEmail;

  /**
   * Quem entra no Jornal: a comunicação e a gestão de uma unidade.
   *
   * Mora aqui, e não numa rota, porque a tela e a guarda precisam responder a
   * mesma coisa — e porque `MarketingRoute` protege outras quatro páginas
   * (Auditoria, Manual, Transparência, Widgets) que não devem abrir junto.
   *
   * A unidade entra na conta de propósito: gestora sem unidade não tem jornal
   * nenhum para ver, e cairia numa lista vazia sem entender o porquê.
   */
  const isUnitManager = permissionLevel === 'gestor_unidade' && isActive && !!unit;
  const canAccessJournal = isMarketing || isUnitManager;

  return { 
    role, 
    loading, 
    canEdit, 
    canCreate,
    isAdmin, 
    isManager, 
    isCreator,
    canView, 
    accessStatus, 
    userName, 
    isActive,
    isBetaTester,
    viewRestrictions,
    permissionLevel,
    unit,
    delegatedUnits,
    canViewAuditoria,
    bondType,
    isMarketing,
    isUnitManager,
    canAccessJournal,
  };
}

export function useAccessRequests() {
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = async () => {
    setLoading(true);
    const { data } = await (supabase
      .from('access_requests') as any)
      .select('*')
      .eq('status', 'pending')
      .order('requested_at', { ascending: true });
    setRequests((data as AccessRequest[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const approveRequest = async (requestId: string, userId: string, role: string, permissionLevel?: string, unit?: string) => {
    // Use edge function to approve, assign role AND confirm email
    const { data, error } = await supabase.functions.invoke('admin-approve-user', {
      body: { requestId, userId, role, permissionLevel, unit }
    });

    if (error) {
      console.error('Erro ao aprovar solicitação:', error);
      throw error;
    }

    await fetchRequests();
  };

  const rejectRequest = async (requestId: string) => {
    await (supabase
      .from('access_requests') as any)
      .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
      .eq('id', requestId);

    await fetchRequests();
  };

  return { requests, loading, approveRequest, rejectRequest, refetch: fetchRequests };
}
