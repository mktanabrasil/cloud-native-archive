import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { 
  Palette, 
  Type, 
  Layout, 
  Component as ComponentIcon, 
  Smartphone, 
  Monitor, 
  CheckCircle2, 
  AlertCircle,
  ShieldCheck,
  MousePointer2,
  Accessibility,
  RefreshCw,
  Plus,
  LayoutGrid,
  List,
  Search,
  LayoutDashboard,
  Download,
  FileText,
  MousePointerClick,
  Info,
  Layers,
  Table as TableIcon,
  ChevronRight,
  AlertTriangle,
  Zap,
  Lock,
  Eye,
  Settings,
  Grid,
  Moon,
  Sun,
  Globe,
  Calendar,
  Users
} from "lucide-react";

import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import PageHeader from "@/components/PageHeader";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { toast } from "sonner";
import logoImg from '@/assets/logo.png';

export default function DesignManualPage() {
  const { user } = useAuth();
  const { isAdmin, loading } = useUserRole();
  const [isExporting, setIsExporting] = useState(false);

  const isMktUser = user?.email === 'mkt@anabrasil.org';
  const hasAccess = isAdmin || isMktUser;

  const exportToPDF = async () => {
    const element = document.getElementById('design-manual-content');
    if (!element) return;

    setIsExporting(true);
    toast.info("Gerando PDF, aguarde...");

    // Store original styles to restore them later
    const originalStyle = element.style.cssText;
    const isDarkMode = document.documentElement.classList.contains('dark');
    
    try {
      // Force light mode for PDF generation if needed, or ensure consistent background
      element.style.backgroundColor = isDarkMode ? '#1a1a1a' : '#fcfbf7'; // Match HSL 40 27% 96% roughly
      element.style.color = isDarkMode ? '#fcfbf7' : '#1a1a1a';
      element.style.padding = '20px';
      element.style.width = '1200px';

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        windowWidth: 1200,
        backgroundColor: isDarkMode ? '#1a1a1a' : '#fcfbf7',
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      // Calculate how many pages we need
      const pageHeight = pdf.internal.pageSize.getHeight();
      let heightLeft = pdfHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }

      pdf.save('anabrasil-design-manual.pdf');
      toast.success("PDF baixado com sucesso!");
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error("Erro ao gerar PDF.");
    } finally {
      // Restore original styles
      element.style.cssText = originalStyle;
      setIsExporting(false);
    }
  };


  // Espera as permissões: sem isso, "Acesso restrito" piscava antes de abrir (26/10/2026).
  if (loading) return null;

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
        <ShieldCheck className="h-16 w-16 text-muted-foreground mb-4 opacity-20" />
        <h1 className="text-2xl font-bold tracking-tight">Acesso Restrito</h1>
        <p className="text-muted-foreground mt-2">
          Esta página é um manual técnico acessível apenas para administradores e equipe de marketing.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500" id="design-manual-content">
      <PageHeader
        title="Manual de UX/UI Design"
        description="Diretrizes visuais e de experiência do usuário do ecossistema anabrasil."
        actions={
          <Button onClick={exportToPDF} disabled={isExporting} variant="outline" className="gap-2">
            {isExporting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Exportar PDF
          </Button>
        }
      />


      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <aside className="md:col-span-1 space-y-4">
          <Card className="sticky top-24">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Sumário</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-1">
              {[
                { label: "Identidade Visual", icon: Palette, id: "identidade" },
                { label: "Tipografia", icon: Type, id: "tipografia" },
                { label: "Temas", icon: Moon, id: "temas" },
                { label: "Componentes", icon: ComponentIcon, id: "componentes" },

                { label: "Layout & Grid", icon: Layout, id: "layout" },
                { label: "Interações & Animação", icon: Zap, id: "interacoes" },
                { label: "Permissões & UX", icon: Lock, id: "permissoes" },
                { label: "Acessibilidade", icon: Accessibility, id: "acessibilidade" },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={() => document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' })}
                  className="flex items-center gap-2 px-2 py-1.5 text-sm font-medium rounded-md hover:bg-accent text-left transition-colors"
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </button>
              ))}
            </CardContent>
          </Card>
        </aside>

        <main className="md:col-span-3 space-y-16">
          <section id="identidade" className="space-y-6 scroll-mt-24">
            <div className="flex items-center gap-3 border-b pb-4">
              <div className="p-2 bg-primary/20 rounded-lg">
                <Palette className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Identidade Visual</h2>
                <p className="text-muted-foreground text-sm">Cores, logotipo e fundamentos visuais.</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-6">
              <Card className="overflow-hidden border-none shadow-md bg-white/50 backdrop-blur-sm">
                <CardHeader className="bg-slate-50/50">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    Logotipo & Símbolo
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                    <div className="space-y-4">
                      <div className="p-8 bg-slate-50 rounded-2xl flex items-center justify-center border border-dashed border-slate-200">
                        <img src={logoImg} alt="anabrasil Logo" className="h-24 w-auto object-contain" />
                      </div>
                      <p className="text-xs text-muted-foreground text-center">
                        O símbolo circular representa unidade e dinamismo.
                      </p>
                    </div>
                    <div className="space-y-4">
                      <div className="p-8 bg-slate-900 rounded-2xl flex flex-col items-center justify-center gap-4 border border-slate-800">
                        <div className="flex items-center gap-3">
                          <img src={logoImg} alt="anabrasil" className="h-10 w-10 rounded-xl" />
                          <span className="text-2xl font-bold text-white tracking-tighter lowercase" style={{ fontFamily: 'Poppins, sans-serif' }}>anabrasil</span>
                        </div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-widest">Versão Negativa / Dark Mode</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-semibold">Uso Correto:</p>
                        <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                          <li>Manter área de respiro de 50% da altura do logo.</li>
                          <li>Não alterar as cores oficiais do símbolo.</li>
                          <li>O nome "anabrasil" deve ser sempre em lowercase.</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="overflow-hidden border-none shadow-md bg-white/50 backdrop-blur-sm">
                <CardHeader className="bg-slate-50/50">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    Paleta de Cores
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="space-y-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Paleta Oficial anabrasil</p>
                    <div className="grid grid-cols-5 gap-3">
                      {[
                        { hex: "#484848", name: "Grafite" },
                        { hex: "#fbce00", name: "Santana" },
                        { hex: "#81e2cf", name: "Nilópolis" },
                        { hex: "#01adff", name: "DIC" },
                        { hex: "#f37964", name: "Geral" },
                        { hex: "#f5dfbb", name: "Accent" },
                        { hex: "#f0eee4", name: "Background" },
                        { hex: "#1f2322", name: "Dark" },
                        { hex: "#000000", name: "Preto" },
                        { hex: "#ffffff", name: "Branco" },
                      ].map((c) => (
                        <div key={c.hex} className="space-y-1.5">
                          <div
                            className="aspect-square w-full rounded-full shadow-sm ring-1 ring-black/10"
                            style={{ backgroundColor: c.hex }}
                          />
                          <p className="text-[10px] font-bold text-center leading-tight">{c.name}</p>
                          <p className="text-[9px] font-mono text-center text-muted-foreground uppercase">{c.hex}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-4 pt-4 border-t">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cores das Unidades</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="space-y-1">
                        <div className="h-10 w-full rounded-lg bg-[#00a3ff]" />
                        <p className="text-[9px] font-bold text-center">DIC</p>
                      </div>
                      <div className="space-y-1">
                        <div className="h-10 w-full rounded-lg bg-[#81e2cf]" />
                        <p className="text-[9px] font-bold text-center">Nilópolis</p>
                      </div>
                      <div className="space-y-1">
                        <div className="h-10 w-full rounded-lg bg-[#fbce00]" />
                        <p className="text-[9px] font-bold text-center">Santana</p>
                      </div>
                      <div className="space-y-1">
                        <div className="h-10 w-full rounded-lg bg-[#f37964]" />
                        <p className="text-[9px] font-bold text-center">Geral</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="overflow-hidden border-none shadow-md bg-white/50 backdrop-blur-sm">
                <CardHeader className="bg-slate-50/50">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    Elevação e Superfícies
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    <div className="flex items-start gap-4 p-3 bg-white rounded-xl shadow-sm border border-border/50">
                      <div className="p-2 bg-muted rounded-lg"><Layers className="h-4 w-4 text-muted-foreground" /></div>
                      <div>
                        <p className="font-bold text-sm">Cards (Base)</p>
                        <p className="text-xs text-muted-foreground">Radius: 0.75rem (xl), Shadow: shadow-sm, Border: 1px border</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4 p-3 bg-white rounded-xl shadow-md border border-border/50">
                      <div className="p-2 bg-primary/10 rounded-lg"><Layers className="h-4 w-4 text-primary" /></div>
                      <div>
                        <p className="font-bold text-sm">Dialogs & Popovers</p>
                        <p className="text-xs text-muted-foreground">Shadow: shadow-md, Backdrop: blur-sm (8px)</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          <section id="tipografia" className="space-y-6 scroll-mt-24">
            <div className="flex items-center gap-2 border-b pb-2">
              <Type className="h-6 w-6 text-primary" />
              <h2 className="text-2xl font-bold tracking-tight">Tipografia</h2>
            </div>
            <Card>
              <CardContent className="pt-6 space-y-6">
                <div>
                  <h3 className="text-4xl font-bold tracking-tighter lowercase mb-1" style={{ fontFamily: 'Poppins, sans-serif' }}>
                    anabrasil (Poppins Bold)
                  </h3>
                  <p className="text-sm text-muted-foreground">Usada para branding e títulos.</p>
                </div>
                <Separator />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <p className="text-xl font-medium mb-1">Inter (Interface & Body)</p>
                    <p className="text-muted-foreground text-sm mb-4">Fonte padrão otimizada para legibilidade em telas.</p>
                    <div className="space-y-1 p-4 bg-slate-50 rounded-lg border">
                      <p className="text-sm">Regular: The quick brown fox jumps over the lazy dog.</p>
                      <p className="text-sm font-medium">Medium: The quick brown fox jumps over the lazy dog.</p>
                      <p className="text-sm font-bold">Bold: The quick brown fox jumps over the lazy dog.</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Hierarquia</p>
                    <div className="space-y-2">
                      <h1 className="text-3xl font-bold">Título H1 (30px)</h1>
                      <h2 className="text-2xl font-semibold">Subtítulo H2 (24px)</h2>
                      <h3 className="text-xl font-medium">Seção H3 (20px)</h3>
                      <p className="text-base">Corpo de texto (16px)</p>
                      <p className="text-sm text-muted-foreground">Legendas (14px)</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-none shadow-md bg-white/50 backdrop-blur-sm">
              <CardHeader className="bg-slate-50/50">
                <CardTitle className="text-lg flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  Iconografia
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { icon: Globe, label: "Global / Geral" },
                    { icon: Calendar, label: "Temporal" },
                    { icon: Users, label: "Social / Pessoas" },
                    { icon: Settings, label: "Configuração" },
                  ].map((item, i) => (
                    <div key={i} className="flex flex-col items-center gap-2 p-4 rounded-xl bg-slate-50/50 border border-slate-100">
                      <item.icon className="h-8 w-8 text-primary" />
                      <p className="text-[10px] font-medium text-muted-foreground">{item.label}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-4 italic">
                  Utilizamos o set de ícones <strong>Lucide React</strong> com stroke de 2px para garantir consistência e leveza visual.
                </p>
              </CardContent>
            </Card>
          </section>

          <section id="temas" className="space-y-6 scroll-mt-24">
            <div className="flex items-center gap-3 border-b pb-4">
              <div className="p-2 bg-primary/20 rounded-lg">
                <Moon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Temas</h2>
                <p className="text-muted-foreground text-sm">Suporte nativo para modo claro e escuro.</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border-2 border-slate-100 dark:border-slate-800">
                <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                  <Sun className="h-5 w-5 text-yellow-500" />
                  <CardTitle className="text-lg">Modo Claro</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 rounded-lg bg-[#f0eee4] border border-slate-200">
                    <p className="text-slate-900 font-medium">Visual Padrão</p>
                    <p className="text-slate-600 text-sm">Fundo claro com tons pastéis e alto contraste de leitura.</p>
                  </div>
                  <p className="text-xs text-muted-foreground italic">
                    Utiliza a paleta principal com fundo HSL 40 27% 96%.
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-slate-900 text-slate-100 border-none">
                <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                  <Moon className="h-5 w-5 text-blue-400" />
                  <CardTitle className="text-lg">Modo Escuro</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 rounded-lg bg-slate-800 border border-slate-700">
                    <p className="text-slate-100 font-medium">Visual Noturno</p>
                    <p className="text-slate-400 text-sm">Redução de fadiga ocular com tons profundos de cinza e azul.</p>
                  </div>
                  <p className="text-xs text-slate-500 italic">
                    Inverte cores base mantendo a identidade das unidades.
                  </p>
                </CardContent>
              </Card>
            </div>
            
            <div className="bg-muted/30 p-4 rounded-xl border border-dashed border-muted-foreground/20 text-center">
              <p className="text-sm text-muted-foreground">
                O sistema detecta automaticamente a preferência do dispositivo, mas permite a troca manual via botão flutuante.
              </p>
            </div>
          </section>

          <section id="componentes" className="space-y-6 scroll-mt-24">

            <div className="flex items-center gap-2 border-b pb-2">
              <ComponentIcon className="h-6 w-6 text-primary" />
              <h2 className="text-2xl font-bold tracking-tight">Componentes do Sistema</h2>
            </div>
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-4 space-y-4">
                  <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Botões</h4>
                  <div className="flex flex-wrap gap-2">
                    <Button>Primary</Button>
                    <Button variant="secondary">Secondary</Button>
                    <Button variant="outline">Outline</Button>
                    <Button variant="ghost">Ghost</Button>
                  </div>
                </Card>
                <Card className="p-4 space-y-4">
                  <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Badges de Status</h4>
                  <div className="flex flex-wrap gap-2">
                    <Badge className="bg-green-500/15 text-green-700 border-green-300">Confirmado</Badge>
                    <Badge className="bg-yellow-500/15 text-yellow-700 border-yellow-300">Pendente</Badge>
                    <Badge className="bg-red-500/15 text-red-700 border-red-300">Cancelado</Badge>
                  </div>
                </Card>
              </div>
            </div>
          </section>

          <section id="layout" className="space-y-6 scroll-mt-24">
            <div className="flex items-center gap-2 border-b pb-2">
              <Layout className="h-6 w-6 text-primary" />
              <h2 className="text-2xl font-bold tracking-tight">Layout & Grid</h2>
            </div>
            <Card>
              <CardContent className="pt-6 space-y-4">
                <p className="text-sm">Grid de 12 colunas padrão Tailwind CSS.</p>
                <div className="grid grid-cols-12 gap-2 h-16">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className="bg-primary/10 border border-primary/20 rounded flex items-center justify-center text-[10px] text-primary/60 font-mono">{i+1}</div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>

          <section id="interacoes" className="space-y-6 scroll-mt-24">
            <div className="flex items-center gap-3 border-b pb-4">
              <div className="p-2 bg-primary/20 rounded-lg">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Interações & Animação</h2>
                <p className="text-muted-foreground text-sm">Estados dinâmicos e micro-interações.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle className="text-base">Animações de Status</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3"><div className="h-3 w-3 rounded-full bg-red-500 animate-conflict-pulse" /><span className="text-sm">Conflito</span></div>
                  <div className="flex items-center gap-3"><div className="h-3 w-3 rounded-full bg-yellow-500 animate-pending-pulse" /><span className="text-sm">Pendente</span></div>
                  <div className="flex items-center gap-3"><div className="h-3 w-3 rounded-full bg-green-500 animate-confirmed-pulse" /><span className="text-sm">Confirmado</span></div>
                </CardContent>
              </Card>
            </div>
          </section>

          <section id="permissoes" className="space-y-6 scroll-mt-24">
            <div className="flex items-center gap-3 border-b pb-4">
              <div className="p-2 bg-primary/20 rounded-lg">
                <Lock className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Permissões & UX</h2>
              </div>
            </div>
            <Card>
              <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1"><h4 className="font-bold">Admin</h4><p className="text-xs text-muted-foreground">Acesso total e gestão.</p></div>
                <div className="space-y-1"><h4 className="font-bold">Gestor</h4><p className="text-xs text-muted-foreground">Acesso restrito à unidade.</p></div>
                <div className="space-y-1"><h4 className="font-bold">Editor</h4><p className="text-xs text-muted-foreground">Criação e edição básica.</p></div>
              </CardContent>
            </Card>
          </section>

          <section id="acessibilidade" className="space-y-6 scroll-mt-24 pb-20">
            <div className="flex items-center gap-2 border-b pb-2">
              <Accessibility className="h-6 w-6 text-primary" />
              <h2 className="text-2xl font-bold tracking-tight">Acessibilidade</h2>
            </div>
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">O sistema segue padrões WCAG AA de contraste e suporta navegação por teclado.</p></CardContent></Card>
          </section>

          <footer className="pt-12 pb-24 text-center space-y-6">
            <div className="flex flex-col items-center gap-4 py-8 border-t border-slate-100 bg-slate-50/30 rounded-2xl">
              <Button onClick={exportToPDF} disabled={isExporting} className="gap-2 shadow-lg hover:shadow-xl transition-all">
                {isExporting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Download Manual Design System (PDF)
              </Button>
              <p className="text-sm text-muted-foreground">© 2026 anabrasil Design System. Documentação gerada via Lovable Cloud.</p>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}