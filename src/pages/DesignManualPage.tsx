import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpRight, Download, RefreshCw, Search, X } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import logoImg from "@/assets/logo.png";
import { anaLogo } from "@/lib/anaLogo";

/**
 * O Manual de Design (V2, 26/10/2026): o kit visual dentro do app.
 *
 * Ele é vivo de propósito. Os botões, campos, abas e selos mostrados são os
 * componentes do próprio app, e as cores são lidas dos tokens na hora — quando
 * o app muda, o Manual muda junto. São 15 seções em três partes; o índice fica
 * à esquerda (no celular, um seletor preso no topo) e tem busca.
 *
 * Acesso: administração e marketing.
 */

type Secao = { id: string; n: string; titulo: string; parte: "Marca" | "Interface" | "Conduta"; busca: string };

const SECOES: Secao[] = [
  { id: "marca", n: "01", titulo: "Marca do app", parte: "Marca", busca: "logo assinatura icone anabrasil aviao" },
  { id: "institucional", n: "02", titulo: "Identidade institucional", parte: "Marca", busca: "logo padrao horizontal slogan unidade rodape foto" },
  { id: "cor", n: "03", titulo: "Cor", parte: "Marca", busca: "cor paleta token verde amarelo azul coral contraste area unidade" },
  { id: "tipografia", n: "04", titulo: "Tipografia", parte: "Marca", busca: "fonte poppins instrument texto titulo tamanho" },
  { id: "vidro", n: "05", titulo: "Vidro e superfícies", parte: "Interface", busca: "vidro glass transparencia superficie sombra malha fundo" },
  { id: "medidas", n: "06", titulo: "Medidas", parte: "Interface", busca: "espaco raio altura margem sombra grade" },
  { id: "componentes", n: "07", titulo: "Componentes", parte: "Interface", busca: "botao campo aba selo situacao chave selecao aviso vazio" },
  { id: "padroes", n: "08", titulo: "Padrões de tela", parte: "Interface", busca: "lista data faixa numeros semana folha lateral tabela cartao vaga" },
  { id: "celular", n: "09", titulo: "Celular", parte: "Interface", busca: "celular mobile doca toque 44 tabela" },
  { id: "escrita", n: "10", titulo: "Escrita", parte: "Conduta", busca: "texto voz vocabulario erro aviso botao data hora" },
  { id: "acessibilidade", n: "11", titulo: "Acessibilidade", parte: "Conduta", busca: "contraste foco teclado leitor movimento" },
  { id: "icones", n: "12", titulo: "Ícones e movimento", parte: "Conduta", busca: "icone lucide animacao tempo curva" },
  { id: "papeis", n: "13", titulo: "Papéis e permissões", parte: "Conduta", busca: "papel permissao acesso admin marketing gestao rh candidato" },
  { id: "regras", n: "14", titulo: "Faça e não faça", parte: "Conduta", busca: "regra modelo pronto pilula cartao icone caixa alta" },
  { id: "codigo", n: "15", titulo: "No código", parte: "Conduta", busca: "codigo token classe tailwind glass embed" },
];
const PARTES = ["Marca", "Interface", "Conduta"] as const;
const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/* ----------------------------------------------------------------- peças */

function CabecalhoDaSecao({ secao, intro, extra }: { secao: Secao; intro: ReactNode; extra?: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <span className="font-mono text-xs font-bold text-[hsl(var(--sel))]">{secao.n}</span>
      <h2 className="text-[26px] font-bold leading-tight">{secao.titulo}</h2>
      <p className="max-w-[70ch] text-[14.5px] text-muted-foreground">{intro}</p>
      {extra && <div className="mt-1 flex flex-wrap gap-2">{extra}</div>}
    </div>
  );
}

function Secao({ id, intro, extra, children }: { id: string; intro: ReactNode; extra?: ReactNode; children: ReactNode }) {
  const secao = SECOES.find(s => s.id === id)!;
  return (
    <section id={id} data-secao={id} className="grid scroll-mt-28 gap-4">
      <CabecalhoDaSecao secao={secao} intro={intro} extra={extra} />
      {children}
    </section>
  );
}

function Caixa({ titulo, children, className }: { titulo?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("grid min-w-0 content-start gap-2.5 rounded-[20px] border border-black/5 bg-card p-5 dark:border-white/5", className)}>
      {titulo && <h3 className="text-base font-semibold">{titulo}</h3>}
      <div className="grid gap-2 text-[13.5px] text-muted-foreground [&_b]:font-semibold [&_b]:text-foreground [&_code]:font-mono [&_code]:text-[12px] [&_code]:text-foreground [&_li]:ml-4 [&_li]:list-disc [&_ul]:grid [&_ul]:gap-1">
        {children}
      </div>
    </div>
  );
}

const Duas = ({ children }: { children: ReactNode }) => <div className="grid gap-3.5 md:grid-cols-2">{children}</div>;
const Tres = ({ children }: { children: ReactNode }) => <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;

/** Um componente vivo, com a regra em uma linha e o código para copiar. */
function Amostra({ titulo, regra, codigo, children }: { titulo: string; regra: string; codigo: string; children: ReactNode }) {
  const [ver, setVer] = useState<"ver" | "codigo">("ver");
  return (
    <div className="grid min-w-0 content-start gap-3 rounded-[20px] border border-black/5 bg-card p-5 dark:border-white/5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold">{titulo}</h3>
        <div className="inline-flex rounded-[10px] bg-muted p-[3px]" role="group" aria-label={`${titulo}: ver ou código`}>
          {(["ver", "codigo"] as const).map(v => (
            <button key={v} type="button" aria-pressed={ver === v} onClick={() => setVer(v)}
              className={cn("rounded-[8px] px-2.5 py-1 text-xs font-semibold", ver === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}>
              {v === "ver" ? "Ver" : "Código"}
            </button>
          ))}
        </div>
      </div>
      {ver === "ver" ? (
        <div className="flex min-h-[76px] flex-wrap items-center gap-2.5 rounded-[14px] bg-muted/60 p-4">{children}</div>
      ) : (
        <pre className="overflow-x-auto rounded-xl bg-[#151A19] p-3.5 font-mono text-xs leading-relaxed text-[#DDE5E2]">{codigo}</pre>
      )}
      <p className="text-[12.5px] text-muted-foreground">{regra}</p>
    </div>
  );
}

function Situacao({ cor, children }: { cor: string; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[13px] font-semibold", cor)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />{children}
    </span>
  );
}

function FacaNaoFaca({ nao, sim }: { nao: ReactNode; sim: ReactNode }) {
  return (
    <div className="grid gap-2.5 rounded-[20px] border border-black/5 bg-card p-4 dark:border-white/5">
      <div className="grid gap-2 rounded-[14px] border border-border p-3.5"><span className="text-xs font-bold text-destructive">Não faça</span><div className="text-[13.5px]">{nao}</div></div>
      <div className="grid gap-2 rounded-[14px] border border-border p-3.5"><span className="text-xs font-bold text-success">Faça</span><div className="text-[13.5px]">{sim}</div></div>
    </div>
  );
}

function Assinatura({ icone = 40, escuro = false }: { icone?: number; escuro?: boolean }) {
  return (
    <span className="inline-flex items-center" style={{ gap: icone / 4 }}>
      <img src={logoImg} alt="" width={icone} height={icone} />
      <span style={{ fontFamily: "Poppins, sans-serif", fontWeight: 700, letterSpacing: "-0.05em", fontSize: icone / 2, lineHeight: 1, color: escuro ? "#FFFFFF" : "#1F2322" }}>anabrasil</span>
    </span>
  );
}

/* ----------------------------------------------------------------- cor */

/** Lê um token do app (formato "h s% l%") e devolve o hex, para mostrar e copiar. */
function hexDoToken(token: string): string {
  if (typeof window === "undefined") return "";
  const v = getComputedStyle(document.body).getPropertyValue(token).trim().split("/")[0].trim();
  const m = v.match(/([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/);
  if (!m) return "";
  const [h, s, l] = [Number(m[1]), Number(m[2]) / 100, Number(m[3]) / 100];
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return "#" + [f(0), f(8), f(4)].map(x => Math.round(x * 255).toString(16).padStart(2, "0")).join("").toUpperCase();
}

const TOKENS: { token: string; nome: string; papel: string; contraste?: string }[] = [
  { token: "--primary", nome: "Verde ANA", papel: "Botão principal e seleção marcada", contraste: "11,0:1" },
  { token: "--foreground", nome: "Texto", papel: "Texto e títulos", contraste: "15,9:1" },
  { token: "--muted-foreground", nome: "Texto de apoio", papel: "Descrição, rótulo de número", contraste: "5,9:1" },
  { token: "--fraco", nome: "Texto fraco", papel: "Código, contagem, placeholder", contraste: "5,3:1" },
  { token: "--sel", nome: "Seleção", papel: "Foco e link de ação", contraste: "5,1:1" },
  { token: "--success", nome: "Confirmado", papel: "Confirmado, aprovado, enviado", contraste: "6,5:1" },
  { token: "--warning", nome: "Pendente", papel: "Aguardando, prazo perto", contraste: "5,9:1" },
  { token: "--destructive", nome: "Alerta", papel: "Conflito, erro, excluir", contraste: "5,6:1" },
  { token: "--info", nome: "Informação", papel: "Novo, aviso neutro", contraste: "6,5:1" },
  { token: "--background", nome: "Fundo", papel: "Fundo, sob a malha" },
  { token: "--card", nome: "Superfície", papel: "Cartão, tabela, campo" },
  { token: "--border", nome: "Contorno", papel: "Contorno e divisória" },
];

const PALETA: [string, string, string][] = [
  ["#81E2CF", "Verde-água", "Botão principal · Vagas · Nilópolis"],
  ["#01ADFF", "Azul", "Eventos · DIC"],
  ["#F37964", "Coral", "Jornal · Geral · contagem"],
  ["#FBCE00", "Amarelo", "Marketing · Santana"],
  ["#E2B979", "Areia forte", "Mercado Solidário"],
  ["#F5DFBB", "Areia", "Só no fio de cinco cores"],
  ["#484848", "Cinza ANA", "Logo institucional no claro"],
  ["#1F2322", "Grafite", "Texto"],
];

function copiar(texto: string, rotulo: string) {
  navigator.clipboard?.writeText(texto).then(
    () => toast.success(`${rotulo} copiado`),
    () => toast.error("Não consegui copiar. Selecione e copie à mão."),
  );
}

/* ----------------------------------------------------------------- página */

export default function DesignManualPage() {
  const { user } = useAuth();
  const { isAdmin, isMarketing, loading } = useUserRole();
  const [isExporting, setIsExporting] = useState(false);
  const [busca, setBusca] = useState("");
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [atual, setAtual] = useState("abertura");
  const [chave, setChave] = useState(true);
  const [escolha, setEscolha] = useState("publico");
  const [, setTema] = useState(0);

  const hasAccess = isAdmin || isMarketing || user?.email === "mkt@anabrasil.org";

  // Releitura das cores quando o tema muda (os tokens são lidos na hora).
  useEffect(() => {
    const obs = new MutationObserver(() => setTema(t => t + 1));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  // A seção à vista fica marcada no índice.
  useEffect(() => {
    if (loading || !hasAccess) return;
    const alvos = document.querySelectorAll<HTMLElement>("[data-secao]");
    const io = new IntersectionObserver(
      entradas => {
        const visivel = entradas.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visivel) setAtual((visivel.target as HTMLElement).dataset.secao!);
      },
      { rootMargin: "-120px 0px -60% 0px" },
    );
    alvos.forEach(a => io.observe(a));
    return () => io.disconnect();
  }, [loading, hasAccess]);

  const encontradas = useMemo(() => {
    const q = semAcento(busca.trim());
    if (!q) return SECOES;
    return SECOES.filter(s => semAcento(`${s.titulo} ${s.busca}`).includes(q));
  }, [busca]);

  const ir = (id: string) => {
    setAtual(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const exportToPDF = async () => {
    const element = document.getElementById("design-manual-content");
    if (!element) return;
    setIsExporting(true);
    toast.info("Gerando PDF, aguarde...");
    const originalStyle = element.style.cssText;
    const fundo = getComputedStyle(document.body).backgroundColor || "#EAF0EF";
    try {
      element.style.backgroundColor = fundo;
      element.style.padding = "20px";
      element.style.width = "1200px";
      const canvas = await html2canvas(element, { scale: 2, useCORS: true, logging: false, windowWidth: 1200, backgroundColor: fundo });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      const pageHeight = pdf.internal.pageSize.getHeight();
      let heightLeft = pdfHeight;
      let position = 0;
      pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;
      while (heightLeft >= 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }
      pdf.save("manual-de-design-ana-brasil.pdf");
      toast.success("PDF baixado.");
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast.error("Não consegui gerar o PDF. Tente de novo.");
    } finally {
      element.style.cssText = originalStyle;
      setIsExporting(false);
    }
  };

  // Espera as permissões: sem isso, "Acesso restrito" piscava antes de abrir (26/10/2026).
  if (loading) return null;

  if (!hasAccess) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-4 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Acesso restrito</h1>
        <p className="mt-2 text-muted-foreground">O Manual de Design é da administração e do marketing.</p>
      </div>
    );
  }

  const institucional = anaLogo(52);
  const botaoPdf = (
    <Button onClick={exportToPDF} disabled={isExporting} variant="outline" className="gap-2">
      {isExporting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      Baixar PDF
    </Button>
  );

  return (
    <div className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)] md:gap-8">
      {/* ÍNDICE: fixo à esquerda; no celular, seletor preso no topo */}
      <aside className="sticky top-[84px] z-10 self-start">
        <div className="flex gap-2 md:hidden">
          <Select value={SECOES.some(s => s.id === atual) ? atual : "abertura"} onValueChange={v => (v === "abertura" ? window.scrollTo({ top: 0, behavior: "smooth" }) : ir(v))}>
            <SelectTrigger className="glass-1 h-11 flex-1 rounded-[14px] font-semibold" aria-label="Ir para a seção">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="abertura">Abertura</SelectItem>
              {SECOES.map(s => <SelectItem key={s.id} value={s.id}>{s.n} · {s.titulo}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" className="h-11 w-11 shrink-0 rounded-[14px]" aria-label={buscaAberta ? "Fechar busca" : "Buscar no Manual"} onClick={() => setBuscaAberta(b => !b)}>
            {buscaAberta ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>

        <div className={cn("mt-2 grid gap-3 md:mt-0", buscaAberta ? "grid" : "hidden md:grid")}>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar no Manual" aria-label="Buscar no Manual" className="h-10 pl-9" />
          </div>
          <nav aria-label="Seções do Manual" className={cn("grid gap-3", buscaAberta && "glass-2 max-h-[60vh] overflow-y-auto rounded-[18px] p-2 md:max-h-none md:overflow-visible md:rounded-none md:border-0 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-none")}>
            {encontradas.length === 0 && <p className="px-2 text-[13px] text-muted-foreground">Nada com "{busca}".</p>}
            {PARTES.map(parte => {
              const itens = encontradas.filter(s => s.parte === parte);
              if (!itens.length) return null;
              return (
                <div key={parte} className="grid gap-0.5">
                  <span className="px-2 pb-1 text-xs font-semibold text-[hsl(var(--fraco))]">{parte}</span>
                  {itens.map(s => (
                    <button key={s.id} type="button" onClick={() => { ir(s.id); setBuscaAberta(false); }} aria-current={atual === s.id ? "true" : undefined}
                      className={cn("grid grid-cols-[24px_1fr] gap-1.5 rounded-[10px] px-2 py-1.5 text-left text-[13.5px] transition-colors",
                        atual === s.id ? "bg-card font-semibold text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                      <span className={cn("pt-px font-mono text-[11.5px]", atual === s.id ? "text-[hsl(var(--sel))]" : "text-[hsl(var(--fraco))]")}>{s.n}</span>
                      {s.titulo}
                    </button>
                  ))}
                </div>
              );
            })}
          </nav>
          <div className="hidden gap-2 px-2 text-xs text-[hsl(var(--fraco))] md:grid">
            <span>Versão 2.0 · V2 Vidro · atualizado em 26/10/2026</span>
          </div>
        </div>
      </aside>

      <div id="design-manual-content" className="grid min-w-0 content-start gap-12">
        {/* ABERTURA */}
        <section data-secao="abertura" className="grid gap-4">
          <div className="grid gap-3.5 rounded-[26px] border border-black/5 bg-card p-6 dark:border-white/5 sm:p-8">
            <span className="text-[12.5px] font-semibold text-muted-foreground">Manual de Design · app.anabrasil.org</span>
            <h1 className="max-w-[18ch] text-[30px] font-extrabold leading-[1.08] tracking-tight sm:text-[40px]">Como o app da ANA se parece, se escreve e se comporta.</h1>
            <p className="max-w-[60ch] text-muted-foreground">Tudo o que vale para criar ou mudar uma tela: a marca, as cores, o vidro, os componentes e os textos. As peças daqui são as do próprio app — quando o app muda, o Manual muda junto.</p>
            <div className="flex h-1.5 max-w-[280px] overflow-hidden rounded-full" aria-hidden>
              {["#f5dfbb", "#fbce00", "#f37964", "#81e2cf", "#01adff"].map(c => <i key={c} className="flex-1" style={{ background: c }} />)}
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-muted-foreground">
              <span>Versão <b className="font-semibold text-foreground">2.0 · V2 Vidro</b></span>
              <span>Atualizado em <b className="font-semibold text-foreground">26/10/2026</b></span>
              <span><b className="font-semibold text-foreground">15</b> seções</span>
            </div>
            <div className="flex flex-wrap gap-2"><Button onClick={() => ir("marca")}>Começar pela marca</Button>{botaoPdf}</div>
          </div>
          <Tres>
            {[["Parte 1 · 01–04", "Marca", "Assinatura do app, identidade institucional, cor e tipografia.", "marca"],
              ["Parte 2 · 05–09", "Interface", "Vidro, medidas, componentes vivos, padrões de tela e celular.", "vidro"],
              ["Parte 3 · 10–15", "Conduta", "Escrita, acessibilidade, movimento, permissões, regras e código.", "escrita"]].map(([k, t, d, id]) => (
              <button key={t} type="button" onClick={() => ir(id)} className="grid gap-1 rounded-[20px] border border-black/5 bg-card p-4 text-left transition-colors hover:border-[hsl(var(--sel))] dark:border-white/5">
                <span className="text-[11.5px] font-semibold text-[hsl(var(--sel))]">{k}</span>
                <span className="text-[15px] font-semibold" style={{ fontFamily: "Poppins, sans-serif" }}>{t}</span>
                <span className="text-[12.5px] text-muted-foreground">{d}</span>
              </button>
            ))}
          </Tres>
        </section>

        {/* 01 MARCA DO APP */}
        <Secao id="marca" intro="A assinatura do app é o ícone do avião em verde-água com o nome anabrasil em Poppins Bold. É uma versão modernizada da identidade; os logos com o avião em traço ficam nas artes, no site e nos documentos.">
          <Duas>
            <Caixa titulo="Assinatura · claro"><div className="grid min-h-[140px] place-items-center rounded-[14px] bg-white"><Assinatura icone={56} /></div>Ícone e nome lado a lado, nome em grafite. Vai na barra, na entrada e no topo do celular.</Caixa>
            <Caixa titulo="Assinatura · escuro"><div className="grid min-h-[140px] place-items-center rounded-[14px] bg-[#121514]"><Assinatura icone={56} escuro /></div>O ícone não muda de cor; só o nome fica branco.</Caixa>
          </Duas>
          <Tres>
            <Caixa titulo="Construção"><ul><li>O ícone tem o dobro da altura do nome.</li><li>Espaço entre os dois: 1/4 do ícone.</li><li>Nome sempre "anabrasil", junto, minúsculo, Poppins 700, letras juntas (−0,05 em).</li><li>Respiro em volta: metade do ícone.</li></ul></Caixa>
            <Caixa titulo="Tamanhos"><ul><li>Barra do computador: ícone 32 px, nome 17 px.</li><li>Topo do celular: ícone 28 px, nome 16 px.</li><li>Tela de entrada: ícone 56 px, nome 28 px.</li><li>Abaixo de 24 px, só o ícone.</li></ul></Caixa>
            <Caixa titulo="Não faça"><ul><li>Recolorir o ícone.</li><li>Trocar pelo avião em traço.</li><li>Escrever "Ana Brasil" ou "ana brasil" na assinatura.</li><li>Pôr o ícone em outra caixa, com contorno ou sombra marcada.</li></ul></Caixa>
          </Tres>
        </Secao>

        {/* 02 IDENTIDADE INSTITUCIONAL */}
        <Secao id="institucional" intro="Os logos da pasta “Id. Visual - Ana Brasil”: Padrão, Horizontal, com o slogan “inspirar voos mais altos” e os das unidades. Não entram na interface do app — só nas peças que o app gera (PDFs, Jornal) e nas artes e no site.">
          <Duas>
            <Caixa titulo="Logo Padrão"><div className="grid min-h-[120px] place-items-center rounded-[14px] bg-white"><img src={institucional.src} width={institucional.width} height={institucional.height} alt="Logo ANA Brasil" /></div>Cinza ANA (#484848) no claro; branco no escuro e sobre foto escurecida. Nunca em outra cor nem dentro de caixa colorida.</Caixa>
            <Caixa titulo="Onde estão os arquivos"><ul><li>Drive do Setor Marketing → <b>Id. Visual - Ana Brasil</b>: logos Padrão, Variação (horizontal), unidades, rodapés e paleta.</li><li>Logos de unidade (Dic, Nilópolis, Santana) usados como vieram, sem alterar.</li><li>No texto, a organização se escreve <b>ANA Brasil</b>.</li></ul></Caixa>
          </Duas>
          <Tres>
            <Caixa titulo="Rodapé Social"><div className="flex h-2 overflow-hidden rounded-full">{["#f5dfbb", "#fbce00", "#f37964", "#81e2cf", "#01adff"].map(c => <i key={c} className="flex-1" style={{ background: c }} />)}</div>Cinco faixas. Fecha as páginas públicas do app.</Caixa>
            <Caixa titulo="Rodapé Educação"><div className="flex h-2 overflow-hidden rounded-full">{["#f5dfbb", "#fbce00", "#f37964"].map(c => <i key={c} className="flex-1" style={{ background: c }} />)}</div>Três faixas. Só em peças de unidade de Educação.</Caixa>
            <Caixa titulo="Fotografia">Crianças e equipe reais, de uniforme, luz natural. Texto sobre foto: foto escurecida ou o vidro escuro, sempre em branco.</Caixa>
          </Tres>
        </Secao>

        {/* 03 COR */}
        <Secao id="cor" intro="A paleta da marca não muda; muda o papel de cada cor. Os tokens abaixo são lidos do app agora, no tema em que você está. Toque numa cor para copiar."
          extra={<Button variant="outline" size="sm" onClick={() => copiar(TOKENS.map(t => `${t.token}: ${hexDoToken(t.token)};`).join("\n"), "Tokens")}>Copiar todos os tokens</Button>}>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-2.5">
            {TOKENS.map(t => {
              const hex = hexDoToken(t.token);
              return (
                <button key={t.token} type="button" onClick={() => copiar(`hsl(var(${t.token}))`, t.nome)} className="grid overflow-hidden rounded-[16px] border border-border bg-card text-left transition-colors hover:border-[hsl(var(--sel))]">
                  <i className="block h-14 border-b border-border" style={{ background: `hsl(var(${t.token}))` }} />
                  <span className="grid gap-0.5 p-3 text-[12.5px]">
                    <b className="text-[13.5px] font-semibold">{t.nome}</b>
                    <code className="font-mono text-[11.5px] text-muted-foreground">{t.token} · {hex}</code>
                    <span className="text-[hsl(var(--fraco))]">{t.papel}</span>
                    {t.contraste && <span className="text-xs font-semibold text-success">AA · {t.contraste}</span>}
                  </span>
                </button>
              );
            })}
          </div>
          <h3 className="mt-2 text-base font-semibold">Paleta da marca</h3>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-2.5">
            {PALETA.map(([hex, nome, uso]) => (
              <button key={hex} type="button" onClick={() => copiar(hex, nome)} className="grid gap-1 text-left text-[12.5px]">
                <i className="block h-14 rounded-[12px] ring-1 ring-inset ring-black/10 dark:ring-white/10" style={{ background: hex }} />
                <b className="text-[13px] font-semibold">{nome}</b>
                <code className="font-mono text-[11.5px] text-muted-foreground">{hex}</code>
                <span className="text-[hsl(var(--fraco))]">{uso}</span>
              </button>
            ))}
          </div>
          <Duas>
            <Caixa titulo="Cor de área — só na navegação">O quadradinho atrás do ícone da área ativa, na doca do celular, e o sublinhado das abas da área: Eventos azul, Jornal coral, Mercado areia forte, Vagas verde-água, Marketing amarelo. Nunca pinta texto, fundo ou botão.</Caixa>
            <Caixa titulo="Cor de unidade — no conteúdo">DIC azul, Nilópolis verde-água, Santana amarelo, Geral coral. Sempre ao lado do nome, com anel de 1 px no claro: verde-água, amarelo e areia somem no branco.</Caixa>
          </Duas>
        </Secao>

        {/* 04 TIPOGRAFIA */}
        <Secao id="tipografia" intro="Poppins é a voz da marca, nos títulos e nos números. O texto da interface é Instrument Sans: mais estreita e firme em tamanho pequeno. O Jornal, os PDFs e as páginas de campanha continuam 100% em Poppins.">
          <div className="grid overflow-hidden rounded-[20px] border border-black/5 bg-card dark:border-white/5">
            {[
              ["Natal Feliz 2026", "Poppins 800 · 34 · banner", "text-[34px] font-extrabold leading-tight", true],
              ["Processos seletivos", "Poppins 700 · 28 · título da página", "text-[28px] font-bold leading-tight", true],
              ["Nova programação", "Poppins 600 · 20 · janela e seção", "text-xl font-semibold", true],
              ["39", "Poppins 700 · 28–30 · número", "text-[30px] font-bold tabular-nums leading-none", true],
              ["Conte o que vai acontecer, para quem é e o que levar.", "Instrument 400 · 14 · corpo", "text-sm", false],
              ["Unidade", "Instrument 600 · 13 · rótulo de campo", "text-[13px] font-semibold", false],
              ["EDU-2026-006 · Educação · aberto há 30 dias", "Instrument 500 · 12,5 · meta", "text-[12.5px] font-medium text-muted-foreground", false],
            ].map(([t, spec, cls, poppins]) => (
              <div key={spec as string} className="grid items-baseline gap-1 border-b border-border/70 px-5 py-3.5 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_260px] sm:gap-4">
                <span className={cls as string} style={poppins ? { fontFamily: "Poppins, sans-serif" } : undefined}>{t}</span>
                <span className="font-mono text-xs text-muted-foreground">{spec}</span>
              </div>
            ))}
          </div>
          <Caixa><ul><li>Caixa alta só no mês do bloco de data (NOV) e no selo sobre foto.</li><li>Números de contagem e tabela com algarismos de largura fixa (<code>tabular-nums</code>).</li><li>Títulos quebram em vez de cortar.</li></ul></Caixa>
        </Secao>

        {/* 05 VIDRO */}
        <Secao id="vidro" intro="O vidro só funciona porque há cor atrás dele: a malha do fundo, com azul, verde-água, coral e amarelo bem suaves. O conteúdo é sempre sólido; o vidro fica com o que está por cima.">
          <div className="relative isolate grid gap-3.5 overflow-hidden rounded-[24px] p-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="absolute inset-0 -z-10 opacity-90" style={{ background: "radial-gradient(50% 60% at 10% 20%,rgba(1,173,255,.55),transparent 70%),radial-gradient(45% 55% at 90% 10%,rgba(129,226,207,.7),transparent 70%),radial-gradient(50% 60% at 80% 100%,rgba(243,121,100,.5),transparent 70%),radial-gradient(40% 50% at 30% 100%,rgba(251,206,0,.45),transparent 70%)" }} />
            <div className="glass-1 grid content-start gap-1 rounded-[18px] p-4"><b className="font-semibold">Vidro 1</b><span className="text-[13px]">Barra, doca, faixa de números, botão secundário.</span><code className="font-mono text-[11px] opacity-80">.glass-1</code></div>
            <div className="glass-2 grid content-start gap-1 rounded-[18px] p-4"><b className="font-semibold">Vidro 2</b><span className="text-[13px]">Menus, avisos, popovers.</span><code className="font-mono text-[11px] opacity-80">.glass-2</code></div>
            <div className="grid content-start gap-1 rounded-[18px] bg-card/90 p-4"><b className="font-semibold">Janela</b><span className="text-[13px]">Folha lateral e diálogo: vidro mais opaco, para ler formulário.</span><code className="font-mono text-[11px] opacity-80">--glass-janela</code></div>
            <div className="glass-photo grid content-start gap-1 rounded-[18px] p-4 text-white"><b className="font-semibold">Vidro escuro</b><span className="text-[13px]">Texto sobre foto, sempre branco.</span><code className="font-mono text-[11px] opacity-80">.glass-photo</code></div>
          </div>
          <Duas>
            <Caixa titulo="Vidro pode"><ul><li>Barra superior e doca.</li><li>Menus, avisos, faixa de números.</li><li>Bloco de texto sobre foto.</li></ul></Caixa>
            <Caixa titulo="Vidro não pode"><ul><li>Tabela, formulário, lista e texto longo.</li><li>Vidro sobre vidro (no máximo duas camadas).</li><li>Animar o desfoque.</li></ul></Caixa>
          </Duas>
          <Caixa titulo="Quando o vidro não existe">Navegador sem desfoque ou pessoa que pediu menos transparência: o vidro vira superfície sólida com contorno e a malha some. Mesma posição, mesmo tamanho.</Caixa>
        </Secao>

        {/* 06 MEDIDAS */}
        <Secao id="medidas" intro="Tudo sai de uma régua de 4 px. Os raios crescem com o tamanho da peça e a sombra é exclusiva do vidro.">
          <Duas>
            <Caixa titulo="Espaço">
              <div className="flex flex-wrap items-end gap-2.5">{[4, 8, 12, 16, 20, 24, 32, 40].map(n => <span key={n} className="grid justify-items-center gap-1 text-xs"><i className="block w-3.5 rounded-sm bg-[hsl(var(--sel))] opacity-80" style={{ height: n }} />{n}</span>)}</div>
              <ul><li>Margem da página: 32 no computador, 16 no celular.</li><li>Entre blocos: 20. Dentro de um bloco: 12 a 16.</li><li>Altura de controle: 36–40 no computador, 44 no celular.</li></ul>
            </Caixa>
            <Caixa titulo="Raio">
              <div className="flex flex-wrap gap-3">{[[8, "bloco de evento"], [12, "botão, campo"], [16, "cartão na janela"], [20, "cartão, tabela"], [24, "folha, doca"]].map(([r, u]) => <span key={r} className="grid justify-items-center gap-1 text-center text-xs"><i className="block h-12 w-12 border-l-2 border-t-2 border-foreground/80" style={{ borderTopLeftRadius: r as number }} />{r}<br />{u}</span>)}</div>
              <ul><li>Cartão sólido sem sombra: contorno de 5% basta.</li><li>Pílula só em contagem e etiqueta neutra.</li></ul>
            </Caixa>
          </Duas>
        </Secao>

        {/* 07 COMPONENTES */}
        <Secao id="componentes" intro="Cada peça aparece funcionando, com a regra de uso e o código. São os componentes do app: troque o tema para ver os dois.">
          <div className="grid gap-3.5 md:grid-cols-2">
            <Amostra titulo="Botões" regra="Um botão verde por tela. O resto é contorno ou texto. Excluir só dentro de uma confirmação."
              codigo={'<Button>Enviar para aprovação</Button>\n<Button variant="outline">Guardar rascunho</Button>\n<Button variant="ghost">Cancelar</Button>'}>
              <Button>Enviar para aprovação</Button><Button variant="outline">Guardar rascunho</Button><Button variant="ghost">Cancelar</Button>
            </Amostra>
            <Amostra titulo="Situação" regra="Texto com bolinha, na cor da situação. Pílula só para contagem neutra."
              codigo={'<Badge>Confirmado</Badge>\n<Badge variant="secondary">Rascunho</Badge>\n<Badge variant="destructive">Com conflito</Badge>'}>
              <Situacao cor="text-success">Confirmado</Situacao><Situacao cor="text-warning">Pendente</Situacao><Situacao cor="text-destructive">Com conflito</Situacao><Badge variant="secondary">Rascunho</Badge><Badge variant="outline">12</Badge>
            </Amostra>
            <Amostra titulo="Abas" regra="Segmentadas para recortes da mesma lista; sublinhadas na cor da área para as seções de uma área."
              codigo={'<Tabs defaultValue="abertos">\n  <TabsList>\n    <TabsTrigger value="abertos">Abertos</TabsTrigger>\n  </TabsList>\n</Tabs>'}>
              <Tabs defaultValue="abertos"><TabsList><TabsTrigger value="abertos">Abertos 39</TabsTrigger><TabsTrigger value="meus">Meus 0</TabsTrigger><TabsTrigger value="enc">Encerrados 3</TabsTrigger></TabsList></Tabs>
            </Amostra>
            <Amostra titulo="Campos" regra="Foco em verde escuro com halo. O erro aparece no campo, em texto, sem caixa colorida."
              codigo={'<Input placeholder="Nome do evento" />\n<p className="text-sm font-semibold text-destructive">Escolha onde o evento acontece.</p>'}>
              <div className="grid w-full gap-1.5"><Input placeholder="Nome do evento" aria-label="Exemplo de campo" /><span className="text-[12.5px] font-semibold text-destructive">Escolha onde o evento acontece.</span></div>
            </Amostra>
            <Amostra titulo="Seleção" regra="A escolha marcada fica no verde ANA, como o botão principal; as outras em superfície com contorno."
              codigo={"<button aria-pressed={ativo} className={ativo ? 'bg-primary text-primary-foreground' : 'border bg-card'} />"}>
              {["DIC", "Nilópolis", "Santana"].map((u, i) => <span key={u} className={cn("inline-flex h-10 items-center rounded-xl border px-3.5 text-[13.5px] font-medium", i === 0 ? "border-primary bg-primary font-semibold text-primary-foreground" : "border-border bg-card")}>{u}</span>)}
            </Amostra>
            <Amostra titulo="Chave e opção" regra="Chave para ligar e desligar na hora; opção com explicação quando a escolha precisa de contexto."
              codigo={'<Switch checked={ligado} onCheckedChange={setLigado} />'}>
              <label className="flex items-center gap-2 text-sm"><Switch checked={chave} onCheckedChange={setChave} />Só conflitos</label>
              <div className="grid w-full grid-cols-2 gap-2" role="radiogroup" aria-label="Onde aparece">
                {[["publico", "Público", "Entra no site"], ["equipe", "Só a equipe", "Calendário interno"]].map(([v, t, d]) => (
                  <button key={v} type="button" role="radio" aria-checked={escolha === v} onClick={() => setEscolha(v)}
                    className={cn("grid gap-0.5 rounded-xl border-[1.5px] p-3 text-left", escolha === v ? "border-[hsl(var(--sel))] bg-accent" : "border-border bg-card")}>
                    <b className="text-sm font-semibold">{t}</b><span className="text-xs text-muted-foreground">{d}</span>
                  </button>
                ))}
              </div>
            </Amostra>
            <Amostra titulo="Aviso" regra="Um só sistema de aviso (sonner), em vidro. Frase curta e, quando cabe, uma ação."
              codigo={"toast.success('Rascunho guardado')"}>
              <Button variant="outline" onClick={() => toast.success("Rascunho guardado", { description: "Você pode voltar a ele pela Programação." })}>Mostrar um aviso</Button>
            </Amostra>
            <Amostra titulo="Estado vazio" regra="Sem ilustração: uma frase e, quando cabe, uma ação."
              codigo={'<div className="rounded-[20px] border border-dashed p-6">…</div>'}>
              <div className="grid w-full gap-1.5 rounded-[18px] border border-dashed border-border p-5"><b className="font-semibold">Nenhum evento em novembro</b><span className="text-[13px] text-muted-foreground">Os eventos aprovados aparecem aqui.</span></div>
            </Amostra>
          </div>
        </Secao>

        {/* 08 PADRÕES */}
        <Secao id="padroes" intro="Os arranjos que se repetem no app e onde cada um já está em uso. Use um destes antes de inventar outro.">
          <Tres>
            {[
              ["Lista com data em destaque", "Eventos em linhas, dia e mês à esquerda, miniatura à direita.", "Programação, Lixeira"],
              ["Faixa de números", "Até cinco números numa faixa de vidro; cor só no que pede ação.", "Visão Geral, Painel do RH, Pizza"],
              ["Semana por unidade", "Uma linha por unidade, cada evento no dia dele.", "Visão Geral, Calendário"],
              ["Folha lateral", "Formulários grandes e detalhes abrem pela direita, com a tela de trás à vista.", "Nova programação, Vaga, Detalhe do evento"],
              ["Tabela que vira lista", "Colunas no computador, linhas empilhadas no celular, sem rolar de lado.", "Processos, Auditoria, Relatórios"],
              ["Cartão de vaga", "Cargo grande, ícone como marca-d'água na cor da área; lista em faixas.", "Vitrine de vagas"],
              ["Pede atenção", "Bloco com o que espera alguém, cada item com a ação ao lado.", "Visão Geral, Painel do RH"],
              ["Abas sublinhadas da área", "As seções de uma área, sublinhadas na cor dela.", "Marketing, Vagas"],
              ["Banner com vidro escuro", "Foto com o texto num bloco de vidro escuro, canto grande arredondado.", "Programação"],
            ].map(([t, d, e]) => (
              <Caixa key={t} titulo={t}>{d}<span className="text-[11.5px] font-semibold text-[hsl(var(--sel))]">Em uso: {e}</span></Caixa>
            ))}
          </Tres>
        </Secao>

        {/* 09 CELULAR */}
        <Secao id="celular" intro="Boa parte do uso é no celular — Vagas, Programação e as páginas de campanha principalmente. Toda tela é pensada nas duas versões.">
          <Tres>
            <Caixa titulo="Barra e doca">No computador, as áreas ficam na barra, com ícone e nome; o nome de quem está logado só aparece ao lado do avatar a partir de 1280 px. No celular e no tablet (abaixo de 1100 px), a barra encolhe para a assinatura e a conta, e a navegação desce para a doca de vidro: ícone e nome de cada área, a ativa com o quadradinho na cor dela. Com mais de cinco áreas, "Mais" abre a própria doca para cima, com todas. No celular nenhum botão flutua: o tema é o do aparelho.</Caixa>
            <Caixa titulo="Ao alcance do polegar">Busca e ação principal descem para uma barra presa embaixo quando a tela é de busca (como a vitrine de vagas). Controles com 44 px; o cartão inteiro é o toque.</Caixa>
            <Caixa titulo="Sem rolar de lado">Tabela larga vira lista empilhada; filtros rolam de lado com o dedo; a página nunca passa da largura da tela.</Caixa>
          </Tres>
        </Secao>

        {/* 10 ESCRITA */}
        <Secao id="escrita" intro="Como o app fala: frases curtas, voz ativa e a palavra que a equipe usa no dia a dia.">
          <Duas>
            <Caixa titulo="Voz"><ul><li>Fale com a pessoa: "Você tem um rascunho".</li><li>O botão diz o que acontece: "Enviar para aprovação", não "OK" ou "Confirmar".</li><li>Sem caixa alta e sem ponto de exclamação.</li><li>Uma ideia por frase.</li></ul></Caixa>
            <Caixa titulo="Vocabulário"><ul><li><b>ANA Brasil</b> no texto; "anabrasil" só na assinatura.</li><li>"Unidade", "gestão", "programação", "processo seletivo".</li><li>Datas: "26 de setembro"; horas: "8h às 12h"; dia e mês em número: "28/11".</li><li>Números com ponto de milhar: "2.233".</li></ul></Caixa>
          </Duas>
          <div className="grid gap-3.5 md:grid-cols-3">
            <FacaNaoFaca nao="Erro ao processar a solicitação." sim="Não consegui salvar. Confira a internet e tente de novo." />
            <FacaNaoFaca nao="Campo obrigatório!" sim="Escolha onde o evento acontece." />
            <FacaNaoFaca nao="Tem certeza? Esta ação é irreversível." sim="Excluir “Cine pipoca”? Ele vai para a lixeira por 30 dias." />
          </div>
          <Caixa titulo="E-mails e avisos">O assunto diz o que aconteceu ("Sua candidatura foi recebida"). O primeiro parágrafo diz o que a pessoa precisa fazer, se precisar. Assinatura: <b>Equipe ANA Brasil</b>.</Caixa>
        </Secao>

        {/* 11 ACESSIBILIDADE */}
        <Secao id="acessibilidade" intro="O app precisa servir a todo mundo da equipe e às famílias que acessam pelo celular.">
          <Duas>
            <Caixa titulo="Contraste"><ul><li>Texto comum com pelo menos 4,5:1 (AA) nos dois temas — os tokens de cor já garantem.</li><li>Verde-água, amarelo e areia nunca como cor de texto sobre o claro.</li><li>Ponto de cor sempre ao lado de um nome: cor sozinha não identifica nada.</li></ul></Caixa>
            <Caixa titulo="Teclado e leitor de tela"><ul><li>Foco visível em tudo que é clicável (anel verde escuro).</li><li>Botão só com ícone leva <code>aria-label</code>.</li><li>Situação em texto, não só em cor.</li><li>Ações visíveis sem depender de passar o mouse.</li></ul></Caixa>
          </Duas>
          <Caixa titulo="Movimento e transparência">Com "reduzir movimento" ligado no aparelho, só a opacidade muda. Com "reduzir transparência", o vidro vira sólido.</Caixa>
        </Secao>

        {/* 12 ÍCONES E MOVIMENTO */}
        <Secao id="icones" intro="Ícone só onde ajuda a ler; movimento curto e com propósito.">
          <Duas>
            <Caixa titulo="Ícones"><ul><li>Biblioteca lucide-react, 16 px, traço 1,75, na cor do texto de apoio.</li><li>Sozinho só em ação universal: fechar, setas, ⋯, copiar, lixeira de linha.</li><li>Ao lado de texto só quando desfaz dúvida: baixar, abrir em nova aba.</li><li>Nunca antes de item de menu, aba, título ou rótulo de campo — com uma exceção: a navegação entre áreas. Na barra do computador (ícone ao lado do nome) e na doca do celular (ícone acima do nome), cada área tem o seu ícone, na cor do texto. Na barra, a área ativa ganha só o fundo claro; na doca, também o quadradinho na cor dela.</li></ul></Caixa>
            <Caixa titulo="Movimento"><ul><li><b>120 ms</b> em hover e toque.</li><li><b>200 ms</b> na troca de aba e na chave.</li><li><b>280 ms</b> para a folha lateral entrar, curva <code>cubic-bezier(.2,.8,.2,1)</code>.</li><li>O ícone de cada vaga se mexe do jeito dele ao passar o mouse.</li></ul></Caixa>
          </Duas>
        </Secao>

        {/* 13 PAPÉIS */}
        <Secao id="papeis" intro="O que cada papel vê no app. A tela se adapta: quem não tem acesso a uma área não vê o item no menu.">
          <div className="overflow-x-auto rounded-[20px] border border-black/5 bg-card dark:border-white/5">
            <table className="w-full min-w-[620px] text-sm">
              <thead><tr className="border-b border-border text-left text-xs font-semibold text-muted-foreground"><th className="px-4 py-3">Papel</th><th className="px-4 py-3">Vê</th><th className="px-4 py-3">Observação</th></tr></thead>
              <tbody>
                {[
                  ["Administração geral", "Tudo: Eventos, Jornal, Mercado, Vagas, Marketing, Painel", "Aprova eventos e gere usuários."],
                  ["Marketing", "Eventos, Jornal, Mercado, Marketing (Auditoria, Manual, Transparência, Widgets, Enquetes, campanhas), Painel", "Único papel, com a administração, que abre o Manual."],
                  ["Gestão de unidade", "Eventos da unidade, Jornal da unidade, Mercado, Painel", "Envia eventos para aprovação."],
                  ["RH", "Vagas: Painel, Processos, Gestão, Relatórios, Modelos de e-mail, Auditoria, Portal", "—"],
                  ["Responsável por processo", "Vagas: os processos dele", "Move candidatos até Entrevista."],
                  ["Candidato", "Vitrine de vagas e a área do candidato", "Não vê o menu da equipe."],
                  ["Visitante", "Programação pública, vitrine de vagas, páginas de campanha e embeds", "Sem login."],
                ].map(([p, v, o]) => (
                  <tr key={p} className="border-t border-border/70 align-top"><td className="px-4 py-3 font-semibold">{p}</td><td className="px-4 py-3 text-muted-foreground">{v}</td><td className="px-4 py-3 text-muted-foreground">{o}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </Secao>

        {/* 14 FAÇA E NÃO FAÇA */}
        <Secao id="regras" intro="Os hábitos de “modelo pronto” que o raio-X encontrou, e o que entra no lugar de cada um.">
          <div className="grid gap-3.5 md:grid-cols-2 lg:grid-cols-3">
            <FacaNaoFaca nao={<span className="flex gap-2"><span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">Confirmado</span><span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Pendente</span></span>} sim={<span className="flex gap-3"><Situacao cor="text-success">Confirmado</Situacao><Situacao cor="text-warning">Pendente</Situacao></span>} />
            <FacaNaoFaca nao="Quatro cartões de número, cada um com ícone pastel e sombra." sim="Uma faixa de números, com cor só no número que pede ação." />
            <FacaNaoFaca nao="Botão verde em toda ação: Salvar, Filtrar, Exportar, Novo." sim="Um botão verde por tela; o resto, contorno ou texto." />
            <FacaNaoFaca nao="Grade de cartões iguais, título repetido dentro e fora da foto." sim="Lista com a data em destaque; foto pequena ao lado." />
            <FacaNaoFaca nao={<span className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Informações gerais</span>} sim={<span className="font-semibold" style={{ fontFamily: "Poppins, sans-serif" }}>Informações gerais</span>} />
            <FacaNaoFaca nao="Botões redondos flutuando no canto, por cima do conteúdo." sim="Conta e sair no avatar da barra. O único botão flutuante é o do tema, no canto, do tablet para cima; no celular vale o tema do aparelho." />
          </div>
        </Secao>

        {/* 15 NO CÓDIGO */}
        <Secao id="codigo" intro="Onde cada regra mora no código, para quem for mexer no app.">
          <Duas>
            <Caixa titulo="Tokens e classes"><ul><li>Tokens em <code>src/index.css</code>, bloco “ESBOÇO V2”: valem só dentro de <code>body.ui-v2</code>.</li><li>Vidro: <code>.glass-1</code>, <code>.glass-2</code>, <code>.glass-photo</code>, fundo <code>.ana-mesh</code>.</li><li>Folha lateral: classe <code>folha-lateral</code> no <code>DialogContent</code>.</li><li>Cores de texto: <code>text-success</code>, <code>text-warning</code>, <code>text-destructive</code>, <code>text-info</code>, <code>text-[hsl(var(--fraco))]</code>.</li></ul></Caixa>
            <Caixa titulo="Embeds protegidos"><ul><li>Os componentes só usam o desenho novo dentro do contexto <code>UiV2</code> (barra do app, molduras de Vagas e da conta).</li><li>Fora dele — embeds do site, campanhas — desenham como antes.</li><li>Cópias do que o site incorpora ficam em <code>src/classico/</code>. Não editar.</li><li>Antes de publicar, comparar os embeds com o que está no ar.</li></ul></Caixa>
          </Duas>
          <Caixa titulo="Kit visual completo">
            <a href="https://claude.ai/artifact/WWG3Ms4vzhxVns5U8EepZh" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-[hsl(var(--sel))] hover:underline">Abrir o kit visual da V2 <ArrowUpRight className="h-4 w-4" /></a>
          </Caixa>
        </Secao>

        <footer className="grid gap-3 pb-6 text-xs text-[hsl(var(--fraco))]">
          <div className="flex h-1.5 overflow-hidden rounded-full" aria-hidden>{["#f5dfbb", "#fbce00", "#f37964", "#81e2cf", "#01adff"].map(c => <i key={c} className="flex-1" style={{ background: c }} />)}</div>
          <div className="flex flex-wrap items-center justify-between gap-3"><span>Manual de Design · ANA Brasil · versão 2.0 · 26/10/2026</span>{botaoPdf}</div>
        </footer>
      </div>
    </div>
  );
}
