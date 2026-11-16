import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HelpCircle, Info, BookOpen, Lightbulb, Clock, ShieldCheck, Search, LayoutGrid, List, Calendar as CalendarIcon, UserCog, Code2, ChevronDown } from 'lucide-react';
import { Separator } from "@/components/ui/separator";

interface GuideSection {
  title: string;
  content: string;
  icon?: React.ReactNode;
}

interface GuideContent {
  title: string;
  description: string;
  sections: GuideSection[];
  footer?: {
    title: string;
    items: Array<{
      title: string;
      content: string;
      color?: string;
    }>;
  };
}

const GUIDES: Record<string, GuideContent | Record<string, GuideContent>> = {
  '/': {
    title: 'Guia da Visão Geral',
    description: 'Aprenda a navegar pelo painel principal de eventos.',
    sections: [
      {
        title: 'Indicadores em Tempo Real',
        content: 'Visualize o total de eventos, confirmados, pendentes e conflitos do mês selecionado. Clique nos cards para filtrar a lista.',
        icon: <Info className="h-4 w-4 text-blue-500" />
      },
      {
        title: 'Filtros Avançados',
        content: 'Filtre por unidade, status ou identifique conflitos de agenda instantaneamente com o botão "Conflitos".',
        icon: <Lightbulb className="h-4 w-4 text-yellow-500" />
      },
      {
        title: 'Busca Inteligente',
        content: 'A barra de busca permite encontrar eventos por título, local ou descrição em todas as unidades.',
        icon: <Search className="h-4 w-4 text-primary" />
      },
      {
        title: 'Timeline Semanal',
        content: 'Acompanhe os próximos eventos da semana com cores identificando cada unidade do grupo.',
        icon: <BookOpen className="h-4 w-4 text-green-500" />
      }
    ],
    footer: {
      title: 'Legenda e Funcionamento',
      items: [
        { title: 'Confirmado', content: 'Evento validado e pronto para realização.', color: 'bg-green-500' },
        { title: 'Pendente', content: 'Aguardando aprovação ou detalhes finais.', color: 'bg-amber-500' },
        { title: 'Conflito', content: 'Horários sobrepostos em uma mesma unidade.', color: 'bg-destructive' },
        { title: 'Marketing', content: 'Eventos que possuem solicitação de cobertura.', color: 'bg-blue-500' }
      ]
    }
  },
  '/calendario': {
    'month': {
      title: 'Guia do Calendário (Mensal)',
      description: 'Visualize todos os eventos do mês de forma organizada.',
      sections: [
        {
          title: 'Navegação e Data',
          content: 'Navegue entre os meses ou selecione uma data específica no seletor central.',
          icon: <LayoutGrid className="h-4 w-4 text-blue-500" />
        },
        {
          title: 'Drag and Drop',
          content: 'Arraste e solte eventos entre os dias para reagendar rapidamente (apenas computadores).',
          icon: <Info className="h-4 w-4 text-primary" />
        },
        {
          title: 'Ações em Massa',
          content: 'Selecione múltiplos eventos para excluir ou alterar status simultaneamente.',
          icon: <Lightbulb className="h-4 w-4 text-yellow-500" />
        }
      ],
      footer: {
        title: 'Legenda e Funcionamento',
        items: [
          { title: 'Unidades', content: 'Cores laterais identificam a unidade (DIC, Nilópolis, etc).', color: 'bg-primary' },
          { title: 'Status', content: 'Cores de fundo e bordas indicam se está Confirmado ou Pendente.', color: 'bg-amber-500' },
          { title: 'Conflitos', content: 'Dias com múltiplos eventos no mesmo horário são destacados.', color: 'bg-destructive' },
          { title: 'Hoje', content: 'O dia atual é destacado com um fundo suave azulado.', color: 'bg-blue-400' }
        ]
      }
    },
    'week': {
      title: 'Guia do Calendário (Semanal)',
      description: 'Foque nos eventos da semana selecionada.',
      sections: [
        {
          title: 'Visão Detalhada',
          content: 'Visualize a distribuição horária dos eventos ao longo de cada dia da semana.',
          icon: <CalendarIcon className="h-4 w-4 text-blue-500" />
        }
      ],
      footer: {
        title: 'Legenda e Funcionamento',
        items: [
          { title: 'Horários', content: 'Visualize a ocupação diária por faixas de horário.', color: 'bg-primary' },
          { title: 'Unidades', content: 'Identificação por cores laterais em cada bloco.', color: 'bg-blue-500' }
        ]
      }
    },
    'list': {
      title: 'Guia do Calendário (Lista)',
      description: 'Visualize os eventos em formato de lista cronológica.',
      sections: [
        {
          title: 'Fácil Leitura',
          content: 'Ideal para uma visualização rápida e sequencial dos próximos compromissos em todas as unidades.',
          icon: <List className="h-4 w-4 text-blue-500" />
        }
      ],
      footer: {
        title: 'Legenda e Funcionamento',
        items: [
          { title: 'Cronologia', content: 'Eventos ordenados do mais próximo para o futuro.', color: 'bg-primary' },
          { title: 'Filtros', content: 'A lista respeita todos os filtros ativos no topo.', color: 'bg-amber-500' }
        ]
      }
    }
  },
  '/usuarios': {
    'users': {
      title: 'Guia de Usuários',
      description: 'Administre o acesso e as permissões de todos os colaboradores.',
      sections: [
        {
          title: 'Níveis de Acesso',
          content: 'Admin Geral (acesso total), Gestor (sua unidade), Editor e Visualizador.',
          icon: <ShieldCheck className="h-4 w-4 text-blue-500" />
        },
        {
          title: 'Aprovação de Cadastros',
          content: 'Gerencie solicitações de novos usuários que aguardam permissão para acessar o sistema.',
          icon: <UserCog className="h-4 w-4 text-green-500" />
        }
      ],
    footer: {
      title: 'Legenda e Funcionamento do Sistema',
      items: [
        { title: 'Admin Geral', content: 'Acesso total e irrestrito. Único que gerencia usuários, aprova acessos e configurações globais.', color: 'bg-primary' },
        { title: 'Gestor de Unidade', content: 'Gestão da sua unidade. Pode criar/editar eventos e aprovar usuários (com aviso de confirmação).', color: 'bg-blue-500' },
        { title: 'Usuário Padrão', content: 'Visualização e acompanhamento operacional da unidade de atuação.', color: 'bg-amber-500' },
        { title: 'Visualizador', content: 'Somente leitura. Apenas consulta de informações sem permissão de alteração.', color: 'bg-slate-400' }
      ]
    }
    },
    'view-configs': {
      title: 'Guia de Configurações de Visualização',
      description: 'Personalize as restrições de acesso padrão por cargo.',
      sections: [
        {
          title: 'Visualização por Perfil',
          content: 'Defina quais unidades cada tipo de cargo (ex: Visualizador) pode ver por padrão.',
          icon: <Lightbulb className="h-4 w-4 text-yellow-500" />
        },
        {
          title: 'Sistema Híbrido',
          content: 'Escolha entre usar restrições rígidas por cargo ou permissões manuais individualizadas.',
          icon: <Info className="h-4 w-4 text-blue-500" />
        }
      ],
    footer: {
      title: 'Legenda e Funcionamento do Sistema',
      items: [
        { title: 'Sistema por Cargo Ativo', content: 'O acesso às unidades é determinado exclusivamente pelo cargo. Ignora restrições manuais. Ex: Gestor vê apenas sua unidade.', color: 'bg-primary' },
        { title: 'Sistema por Cargo Inativo', content: 'Prioriza as Restrições Personalizadas de cada usuário. Ex: Visualizador pode ver múltiplas unidades específicas.', color: 'bg-amber-500' },
        { title: 'Restrição Manual', content: 'Definições individuais que prevalecem quando o sistema por cargo está inativo.', color: 'bg-blue-500' },
        { title: 'Herança de Acesso', content: 'Se não houver restrição manual ou cargo ativo, o acesso padrão é aplicado conforme o nível.', color: 'bg-slate-400' }
      ]
    }
    },
    'embed': {
      title: 'Guia de Integração e Embed',
      description: 'Incorpore o calendário em portais externos ou intranets.',
      sections: [
        {
          title: 'Links Públicos',
          content: 'Gere links que não exigem login Lovable para visualização externa.',
          icon: <Code2 className="h-4 w-4 text-blue-500" />
        },
        {
          title: 'Personalização',
          content: 'Oculte cabeçalhos ou menus para uma integração limpa em iFrames.',
          icon: <Search className="h-4 w-4 text-primary" />
        }
      ],
      footer: {
        title: 'Legenda e Funcionamento',
        items: [
          { title: 'Domínio', content: 'Sempre use a URL de produção para evitar pedidos de login.', color: 'bg-green-600' },
          { title: 'iFrame', content: 'Use width="100%" para garantir a responsividade do widget.', color: 'bg-primary' }
        ]
      }
    }
  },
  '/auditoria': {
    title: 'Guia da Auditoria',
    description: 'Rastreabilidade completa de todas as ações importantes no sistema.',
    sections: [
      {
        title: 'Histórico de Ações',
        content: 'Veja quem criou, editou ou excluiu qualquer evento, incluindo a data e hora exata.',
        icon: <Clock className="h-4 w-4 text-blue-500" />
      },
      {
        title: 'Detalhes Técnicos',
        content: 'A coluna "Detalhes" mostra exatamente quais campos foram alterados durante a edição.',
        icon: <Info className="h-4 w-4 text-primary" />
      }
    ],
    footer: {
      title: 'Legenda e Funcionamento',
      items: [
        { title: 'Imutabilidade', content: 'Os logs de auditoria não podem ser editados ou excluídos.', color: 'bg-destructive' },
        { title: 'Retenção', content: 'O sistema mantém o histórico recente de todas as unidades.', color: 'bg-info' }
      ]
    }
  }
};

interface PageGuideProps {
  activeTab?: string;
}

/** Os endereços por setor (16/11/2026) usam os guias dos endereços de antes. */
const GUIA_DO_ENDERECO: Record<string, string> = {
  '/social/eventos': '/',
  '/marketing/auditoria': '/auditoria',
  '/painel': '/usuarios',
};

export default function PageGuide({ activeTab }: PageGuideProps) {
  const [expanded, setExpanded] = useState(false);
  const location = useLocation();
  const path = GUIA_DO_ENDERECO[location.pathname] ?? location.pathname;

  const getGuideContent = (): GuideContent | null => {
    const guide = GUIDES[path];
    if (!guide) return null;
    
    if ('title' in guide) {
      return guide as GuideContent;
    }
    
    if (activeTab && (guide as Record<string, GuideContent>)[activeTab]) {
      return (guide as Record<string, GuideContent>)[activeTab];
    }
    
    const firstTab = Object.keys(guide)[0];
    return (guide as Record<string, GuideContent>)[firstTab];
  };

  const content = getGuideContent();

  if (!content) return null;

  return (
    <div className="mt-12 pb-8 space-y-4 border-t pt-8">
      <div className="flex flex-col gap-1 mb-2">
        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider px-1">Guia e Suporte</h3>
      </div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-all duration-200"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-primary/10">
            <HelpCircle className="h-5 w-5 text-primary" />
          </div>
          <div className="flex flex-col items-start text-left">
            <span className="font-semibold text-foreground">{content.title}</span>
            <span className="text-xs text-muted-foreground">
              {expanded ? "Clique para recolher o guia" : "Clique para ver dicas e informações desta página"}
            </span>
          </div>
        </div>
        <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <Card className="border-primary/20 bg-primary/5 animate-in slide-in-from-top-2 duration-300">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              {content.title}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {content.description}
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              {content.sections.map((section, idx) => (
                <div key={idx} className="flex gap-3 p-3 rounded-lg border border-border bg-background/50">
                  <div className="mt-0.5 shrink-0 text-primary">
                    {section.icon || <Info className="h-4 w-4" />}
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold text-foreground">{section.title}</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {section.content}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {content.footer && (
              <>
                <Separator className="my-2" />
                <div className="rounded-lg border border-dashed bg-muted/30 overflow-hidden">
                  <div className="px-3 py-2 border-b border-dashed bg-muted/50 flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-bold uppercase tracking-wider">{content.footer.title}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 p-3">
                    {content.footer.items.map((item, idx) => (
                      <div key={idx} className="space-y-1.5 p-2 rounded-md bg-background/50 border">
                        <h5 className="text-[11px] font-bold text-primary flex items-center gap-1.5">
                          <div className={`h-2 w-2 rounded-full ${item.color || 'bg-primary'}`} />
                          {item.title}
                        </h5>
                        <p className="text-[10px] text-muted-foreground leading-normal">
                          {item.content}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
