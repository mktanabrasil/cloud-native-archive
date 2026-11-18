import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTestView } from '@/contexts/TestViewContext';
import { ehUnidadeDoJornal, newsUnitForProfileUnit, newsUnitSegment } from '@/lib/news/units';

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
  /** Para quem as permissões abaixo já foram lidas (ver `carregando`, no fim). */
  const [carregadoPara, setCarregadoPara] = useState<string | null>(null);
  const [accessStatus, setAccessStatus] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [isBetaTester, setIsBetaTester] = useState<boolean>(false);
  const [viewRestrictions, setViewRestrictions] = useState<string[] | null>(null);
  const [permissionLevel, setPermissionLevel] = useState<string | null>(null);
  const [unit, setUnit] = useState<string | null>(null);
  const [delegatedUnits, setDelegatedUnits] = useState<string[]>([]);
  const [bondType, setBondType] = useState<string | null>(null);

  /**
   * O que identifica a pessoa, e não o objeto que a carrega.
   *
   * Ao voltar de outra aba, o Supabase reconfere a sessão e avisa o app com um
   * evento de login, mesmo sem nada ter mudado — e o contexto entrega um
   * objeto de usuário novo para a mesma pessoa. Se o efeito abaixo dependesse
   * do objeto, ele voltaria a `loading` e refaria as consultas a cada volta; a
   * guarda da rota, enquanto isso, desmontava a página inteira, e no Jornal a
   * unidade escolhida voltava para a geral (08/09/2026). Dependendo só do id,
   * a mesma identidade não reinicia nada.
   */
  const userId = user?.id ?? null;
  const userEmail = user?.email ?? null;
  const userMetaName = (user?.user_metadata?.name as string | undefined) ?? null;

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
      
      setCarregadoPara(null);
      setLoading(false);
      return;
    }

    if (!isAuthenticated || !userId) {
      setRole(null);
      setLoading(false);
      setAccessStatus(null);
      setCarregadoPara(null);
      return;
    }

    const fetchRole = async () => {
      setLoading(true);
      
      // Get role from user_roles table
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      // Also check profile for permission_level and name
      const { data: profileData } = await supabase
        .from('profiles')
        .select('permission_level, name, is_active, view_restrictions, unit, delegated_units, is_beta_tester, bond_type')
        .eq('user_id', userId)
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
      } else if (userMetaName) {
        setUserName(userMetaName);
      } else {
        setUserName(userEmail || 'Usuário');
      }

      // Quem é admin, é admin no banco (`user_roles` ou `permission_level`).
      // Até 11/09/2026 uma lista fixa de quatro e-mails forçava 'admin' aqui:
      // três já eram admin no banco (a lista não fazia nada por eles) e a
      // quarta era leitora — para ela a aba Lixeira aparecia vazia e Restaurar
      // falhava, porque o RLS não conhece a lista. O front segue o banco.
      let effectiveRole = roleData?.role;
      if (!effectiveRole && profileData?.permission_level) {
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
        .eq('user_id', userId)
        .order('requested_at', { ascending: false })
        .limit(1)
        .maybeSingle();

        setRole(null);
        setAccessStatus(requestData?.status || null);
      }

      setCarregadoPara(userId);
      setLoading(false);
    };

    fetchRole();
  }, [userId, userEmail, userMetaName, isAuthenticated, activePersona]);

  const isAdmin = role === 'admin' || permissionLevel === 'admin_geral';
  const isCreator = role === 'criador' || isAdmin;
  const isManager = role === 'editor' || isCreator || permissionLevel === 'gestor_unidade' || permissionLevel === 'eventos_parceiros' || permissionLevel === 'admin_geral';
  const hasDelegatedAccess = delegatedUnits && delegatedUnits.length > 0;
  const canEdit = isAdmin || isCreator || role === 'editor';
  const canCreate = isAdmin || isCreator;
  const canViewAuditoria = isAdmin || isManager || hasDelegatedAccess;
  const canView = true; // System is public
  /**
   * Espelho de `is_marketing_user` no banco: admin, ou vínculo "marketing"
   * ativo. Desde a migração de 11/09/2026 esse mesmo predicado dá à
   * comunicação o poder do admin sobre eventos (criar confirmado, aprovar,
   * publicar) — antes o front prometia e o RLS recusava.
   */
  const isMarketing = isAdmin || bondType === 'marketing';
  /**
   * Só a equipe de comunicação: vínculo "marketing" ativo, sem os outros
   * admins (12/11/2026, pedido dele para o "Criar a partir de esboço" do
   * Jornal, que sai da pasta do marketing). `isMarketing` continua valendo
   * para tudo o que o banco também libera ao admin.
   */
  const isEquipeDeMarketing = bondType === 'marketing' && isActive;

  /**
   * Espelho de `is_rh_or_admin` no banco (vagas, 25/09/2026): admin, ou
   * vínculo "rh" ativo. É quem vê a aba Gestão em /vagas.
   */
  const isRh = isAdmin || (bondType === 'rh' && isActive);
  /** Quem cuida do voluntariado dos eventos (18/11/2026): o vínculo, ou o marketing. Espelha `eh_do_voluntariado`. */
  const isVoluntariado = bondType === 'voluntariado' && isActive;
  // O banco (`is_marketing_user`) exige o perfil ativo; o admin sempre entra.
  const temVoluntariado = (isMarketing && (isAdmin || isActive)) || isVoluntariado;
  /** O Financeiro (18/11/2026, PR 6): o vínculo financeiro ou o marketing. Espelha `pode_ver_pizza`. */
  const temFinanceiro = (isMarketing && (isAdmin || isActive)) || (bondType === 'financeiro' && isActive);

  const isUnitManager = permissionLevel === 'gestor_unidade' && isActive && !!unit;
  /**
   * A gestão de um CEI ou do GOE (16/11/2026): o setor dela é a Educação. A
   * gestão de uma NAVE é do Social, e a de uma unidade fora do catálogo não
   * é de nenhum dos dois (fica com o que toda a equipe vê).
   */
  const isGestaoDaEducacao = isUnitManager && ehUnidadeDoJornal(newsUnitForProfileUnit(unit)?.id);
  /** A gestão de uma NAVE: o setor dela é o Social. */
  const isGestaoDoSocial = isUnitManager && newsUnitSegment(newsUnitForProfileUnit(unit)?.id) === 'social';
  /**
   * Quem preenche o Calendário Anual (17/11/2026): o marketing e a gestão do
   * Social, pela regra do setor; não há mais lista de acesso. Espelho de
   * `eh_do_calendario` no banco.
   */
  const temCalendarioAnual = isMarketing || isGestaoDoSocial;

  /**
   * Quem entra no Jornal: a comunicação e a gestão da Educação. Desde
   * 16/11/2026 o Jornal é da Educação; a gestão do Social saiu dele (espelho
   * de `journal_unit_of` no banco, que devolve só as unidades da Educação).
   *
   * Mora aqui, e não numa rota, porque a tela e a guarda precisam responder a
   * mesma coisa — e porque `MarketingRoute` protege outras quatro páginas
   * (Auditoria, Manual, Transparência, Widgets) que não devem abrir junto.
   *
   * A unidade entra na conta de propósito: gestora sem unidade não tem jornal
   * nenhum para ver, e cairia numa lista vazia sem entender o porquê.
   */
  const canAccessJournal = isMarketing || isGestaoDaEducacao;

  /**
   * O Semanário (17/11/2026): a professora preenche e a orientadora
   * pedagógica dá a devolutiva, cada uma no CEI (ou no GOE) do perfil. O papel
   * vem do vínculo, com o nível de usuário padrão: nenhuma das duas é gestão
   * do CEI nem entra no Jornal. Sem unidade da Educação, o vínculo não vale.
   */
  const unidadeDaEducacao = isActive && ehUnidadeDoJornal(newsUnitForProfileUnit(unit)?.id);
  const isProfessora = bondType === 'professora' && unidadeDaEducacao;
  const isOrientadora = bondType === 'orientacao_pedagogica' && unidadeDaEducacao;
  /** Quem entra no Semanário: quem preenche, quem orienta e o marketing (só leitura). */
  const temSemanario = isMarketing || isProfessora || isOrientadora;

  /**
   * Só a Educação no menu: a gestão da Educação não vê o Social (16/11/2026).
   * A professora e a orientadora pedagógica também (17/11/2026): o setor
   * delas é a Educação, e lá elas veem só o Semanário.
   */
  const soEducacao = (isGestaoDaEducacao || isProfessora || isOrientadora) && !isMarketing;
  /**
   * Quem vê só o Semanário: a professora e a orientadora que não são gestão
   * nem marketing. A página inicial delas é o próprio Semanário.
   */
  const soSemanario = (isProfessora || isOrientadora) && !isGestaoDaEducacao && !isMarketing;

  /**
   * Ainda carregando enquanto as permissões não forem desta pessoa (26/10/2026).
   * Quando a sessão chega, a tela redesenha antes de o efeito acima marcar
   * `loading`: por um instante o usuário existe, mas o papel ainda é o de
   * ninguém. As guardas liam esse instante como "sem acesso" — o F5 no Jornal,
   * na Auditoria ou no Portal da Transparência mandava para o início, e o
   * Manual de Design piscava "Acesso restrito".
   */
  const carregando = loading || (!activePersona && isAuthenticated && !!userId && carregadoPara !== userId);

  return { 
    role, 
    loading: carregando, 
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
    isEquipeDeMarketing,
    isRh,
    isVoluntariado,
    temVoluntariado,
    temFinanceiro,
    isUnitManager,
    isGestaoDaEducacao,
    isProfessora,
    isOrientadora,
    temSemanario,
    soSemanario,
    canAccessJournal,
    soEducacao,
    isGestaoDoSocial,
    temCalendarioAnual,
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

    // Quem aprovou precisa saber se o aviso saiu: se não saiu, o acesso está
    // liberado do mesmo jeito e a pessoa só descobre se alguém contar.
    return { avisoEnviado: data?.avisoEnviado === true, avisoErro: data?.avisoErro ?? null };
  };

  /** Recusa. Devolve false se o pedido já tinha sido resolvido (por exemplo, pela orientadora no Semanário). */
  const rejectRequest = async (requestId: string): Promise<boolean> => {
    const { data } = await (supabase
      .from('access_requests') as any)
      .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
      .eq('id', requestId)
      .eq('status', 'pending')
      .select('id');

    await fetchRequests();
    return !!data?.length;
  };

  return { requests, loading, approveRequest, rejectRequest, refetch: fetchRequests };
}
