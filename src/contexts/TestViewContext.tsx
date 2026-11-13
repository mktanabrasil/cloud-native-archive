import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export type TestPersona = {
  id: string;
  name: string;
  email: string;
  permission_level: 'admin_geral' | 'gestor_unidade' | 'usuario_padrao';
  role: 'admin' | 'editor' | null;
  unit: string;
  is_active: boolean;
  delegated_units?: string[];
};

export const TEST_PERSONAS: TestPersona[] = [
  {
    id: 'test-nao-logado',
    name: 'Visitante (Público)',
    email: 'visitante@publico.local',
    permission_level: 'usuario_padrao',
    role: null,
    unit: 'Público',
    is_active: false,
  },
  {
    id: 'test-admin',
    name: 'Admin Geral (Teste)',
    email: 'admin.teste@lovable.local',
    permission_level: 'admin_geral',
    role: 'admin',
    unit: 'Administração',
    is_active: true,
  },
  {
    id: 'test-gestor-dic',
    name: 'Gestor DIC (Teste)',
    email: 'gestor.dic@lovable.local',
    permission_level: 'gestor_unidade',
    role: 'editor',
    unit: 'DIC',
    is_active: true,
  },
  {
    id: 'test-gestor-nilopolis',
    name: 'Gestor Nilópolis (Teste)',
    email: 'gestor.nilopolis@lovable.local',
    permission_level: 'gestor_unidade',
    role: 'editor',
    unit: 'Nilópolis',
    is_active: true,
  },
  {
    id: 'test-usuario',
    name: 'Usuário Padrão (Teste)',
    email: 'usuario.teste@lovable.local',
    permission_level: 'usuario_padrao',
    role: null,
    unit: 'DIC',
    is_active: true,
  },
  {
    id: 'test-pendente',
    name: 'Usuário Pendente (Teste)',
    email: 'pendente.teste@lovable.local',
    permission_level: 'usuario_padrao',
    role: null,
    unit: 'Pendente',
    is_active: false,
  },
  {
    id: 'test-nao-logado',
    name: 'Visitante (Não Logado)',
    email: 'visitante@publico.local',
    permission_level: 'usuario_padrao',
    role: null,
    unit: 'Público',
    is_active: false,
  },
];

/**
 * Quem pode "ver como" outra pessoa. Só muda a tela (banco e funções seguem a
 * sessão de verdade), mas mostra as telas de admin. Até 13/11/2026 um `|| true`
 * liberava para qualquer conta logada, inclusive a de candidato.
 */
const ALLOWED_TESTERS = ['mkt@anabrasil.org', 'contato@anabrasil.org', 'alyson-viana@hotmail.com'];

const STORAGE_KEY = 'test_persona_id';

interface TestViewContextType {
  canUseTestMode: boolean;
  activePersona: TestPersona | null;
  setActivePersona: (persona: TestPersona | null) => void;
  resetView: () => void;
}

const TestViewContext = createContext<TestViewContextType | undefined>(undefined);

export function TestViewProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [activePersona, setActivePersonaState] = useState<TestPersona | null>(null);

  const canUseTestMode = !!user && ALLOWED_TESTERS.includes((user.email || '').toLowerCase());

  // Load persona from sessionStorage on mount / user change
  useEffect(() => {
    if (!canUseTestMode) {
      setActivePersonaState(null);
      sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    const savedId = sessionStorage.getItem(STORAGE_KEY);
    if (savedId) {
      const found = TEST_PERSONAS.find(p => p.id === savedId);
      if (found) setActivePersonaState(found);
    }
  }, [canUseTestMode, user?.id]);

  const setActivePersona = useCallback((persona: TestPersona | null) => {
    if (persona) {
      sessionStorage.setItem(STORAGE_KEY, persona.id);
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
    setActivePersonaState(persona);
  }, []);

  const resetView = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setActivePersonaState(null);
  }, []);

  return (
    <TestViewContext.Provider value={{ canUseTestMode, activePersona, setActivePersona, resetView }}>
      {children}
    </TestViewContext.Provider>
  );
}

export function useTestView() {
  const ctx = useContext(TestViewContext);
  if (!ctx) throw new Error('useTestView must be used within TestViewProvider');
  return ctx;
}
