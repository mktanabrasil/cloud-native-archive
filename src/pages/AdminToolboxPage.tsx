import React, { useState, useEffect } from 'react';
import { Settings, Code, Eye, Copy, Check, MessageCircle, AlertTriangle, Monitor, Smartphone, Tablet, ShieldAlert, Lock, Terminal, Menu as MenuIcon, RefreshCw, Globe, LayoutDashboard, Save, FolderOpen, Trash2, Edit, LayoutGrid, Plus, PanelRight, ChevronDown, History, RotateCcw, Images, ArrowUp, ArrowDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { navItems } from '@/config/navigation';
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ColorField } from "@/components/ColorField";
import { FileUpload } from "@/components/FileUpload";

type DeviceView = 'desktop' | 'tablet' | 'mobile';

// Lê um JSON Lottie (Lordicon/Flaticon) e extrai todas as cores sólidas únicas
// presentes nas camadas, retornando-as como hex para personalização.
const toHex = (n: number) => {
  const normalized = n > 1 ? n : n * 255;
  return Math.max(0, Math.min(255, Math.round(normalized))).toString(16).padStart(2, '0');
};
// Helpers compartilhados para ler cores de um Lottie. Detecção e recoloração
// DEVEM usar exatamente a mesma lógica para que o índice de cada "slot" (swatch)
// corresponda 1:1 ao elemento correto do ícone.
const isSimpleLottieColor = (value: any) =>
  Array.isArray(value) &&
  (value.length === 3 || value.length === 4) &&
  value.slice(0, 3).every((v) => typeof v === 'number');

const lottieFirstColorHex = (value: any): string | null => {
  if (isSimpleLottieColor(value)) {
    const [r, g, b] = value;
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toLowerCase();
  }
  if (Array.isArray(value)) {
    for (const frame of value) {
      if (frame && typeof frame === 'object') {
        const fromS = lottieFirstColorHex(frame.s);
        if (fromS) return fromS;
        const fromE = lottieFirstColorHex(frame.e);
        if (fromE) return fromE;
      }
    }
  }
  return null;
};

const lottieGradientStopHexes = (value: any, points: number): (string | null)[] => {
  if (Array.isArray(value) && value.length >= points * 4 && value.slice(0, points * 4).every((v) => typeof v === 'number')) {
    const out: (string | null)[] = [];
    for (let i = 0; i < points; i += 1) {
      const base = i * 4;
      out.push(`#${toHex(value[base + 1])}${toHex(value[base + 2])}${toHex(value[base + 3])}`.toLowerCase());
    }
    return out;
  }
  if (Array.isArray(value)) {
    for (const frame of value) {
      if (frame && typeof frame === 'object') {
        const fromS = lottieGradientStopHexes(frame.s, points);
        if (fromS.length) return fromS;
        const fromE = lottieGradientStopHexes(frame.e, points);
        if (fromE.length) return fromE;
      }
    }
  }
  return [];
};

function extractLordColors(data: any): Array<{ index: number; original: string }> {
  const slots: Array<{ index: number; original: string }> = [];
  const walk = (node: any) => {
    if (!node || typeof node !== 'object') return;
    // Cor sólida/animada: uma slot por nó "c" com cor representável.
    if (node.c && node.c.k) {
      const hex = lottieFirstColorHex(node.c.k);
      if (hex) slots.push({ index: slots.length, original: hex });
    }
    // Gradientes: uma slot por parada representável do gradiente.
    if (node.g && node.g.k) {
      const points = Number(node.g.p || node.p || 0);
      const gradientValue = node.g.k.k ?? node.g.k;
      if (points > 0) {
        const hexes = lottieGradientStopHexes(gradientValue, points);
        for (let i = 0; i < points; i += 1) {
          if (hexes[i]) slots.push({ index: slots.length, original: hexes[i] as string });
        }
      }
    }
    if (Array.isArray(node)) node.forEach(walk);
    else Object.values(node).forEach(walk);
  };
  walk(data);
  return slots;
}


const normalizeLottieHex = (value?: string): string => {
  let h = String(value || '').trim().toLowerCase();
  if (!h || h === 'none' || h === 'transparent') return '';
  if (!h.startsWith('#')) h = `#${h}`;
  if (/^#[0-9a-f]{3}$/.test(h)) h = `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
  if (/^#[0-9a-f]{8}$/.test(h)) h = h.slice(0, 7);
  return /^#[0-9a-f]{6}$/.test(h) ? h : '';
};

const parseLottieColorTarget = (value?: string) => {
  let raw = String(value || '').trim().toLowerCase();
  if (!raw) return null;
  if (raw === 'transparent' || raw === 'none') {
    return { hex: '#000000', rgb: [0, 0, 0], a: 0, hasAlpha: true };
  }
  if (!raw.startsWith('#')) raw = `#${raw}`;
  if (/^#[0-9a-f]{3}$/.test(raw)) raw = `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`;
  const hasAlpha = /^#[0-9a-f]{8}$/.test(raw);
  const a = hasAlpha ? parseInt(raw.slice(7, 9), 16) / 255 : 1;
  if (hasAlpha) raw = raw.slice(0, 7);
  if (!/^#[0-9a-f]{6}$/.test(raw)) return null;
  const r = parseInt(raw.slice(1, 3), 16) / 255;
  const g = parseInt(raw.slice(3, 5), 16) / 255;
  const b = parseInt(raw.slice(5, 7), 16) / 255;
  return { hex: raw, rgb: [r, g, b], a, hasAlpha };
};

const rgb01ToLottieHex = (arr: number[]) => {
  const c = (n: number) => Math.round(Math.max(0, Math.min(1, n)) * 255).toString(16).padStart(2, '0');
  return `#${c(arr[0])}${c(arr[1])}${c(arr[2])}`.toLowerCase();
};

const normalizeLottieRgbArray = (arr: any): number[] | null => {
  if (!Array.isArray(arr) || (arr.length !== 3 && arr.length !== 4)) return null;
  if (typeof arr[0] !== 'number' || typeof arr[1] !== 'number' || typeof arr[2] !== 'number') return null;
  const max = Math.max(Number(arr[0]) || 0, Number(arr[1]) || 0, Number(arr[2]) || 0);
  return max > 1 ? [arr[0] / 255, arr[1] / 255, arr[2] / 255] : [arr[0], arr[1], arr[2]];
};

const writeLottieRgbArray = (target: any[], rgb: number[]) => {
  const max = Math.max(Number(target[0]) || 0, Number(target[1]) || 0, Number(target[2]) || 0);
  if (max > 1) {
    target[0] = rgb[0] * 255;
    target[1] = rgb[1] * 255;
    target[2] = rgb[2] * 255;
  } else {
    target[0] = rgb[0];
    target[1] = rgb[1];
    target[2] = rgb[2];
  }
};

const applyLottieOpacityValue = (value: any, alpha: number) => {
  const next = Math.max(0, Math.min(1, Number(alpha))) * 100;
  if (!Array.isArray(value)) return;
  if (value.length && value.every((v) => typeof v === 'number')) {
    value[0] = next;
    return;
  }
  value.forEach((frame) => {
    if (!frame || typeof frame !== 'object') return;
    if (Array.isArray(frame.s)) frame.s[0] = next;
    else if (typeof frame.s === 'number') frame.s = next;
    if (Array.isArray(frame.e)) frame.e[0] = next;
    else if (typeof frame.e === 'number') frame.e = next;
  });
};

const recolorLottieDataForGateway = (data: any, map: Record<string, string>) => {
  if (!data || !map || !Object.keys(map).length) return data;
  // Mapa por índice de ocorrência (slot), não por valor de cor.
  const targets: Record<number, ReturnType<typeof parseLottieColorTarget>> = {};
  Object.keys(map).forEach((key) => {
    const idx = Number(key);
    const to = parseLottieColorTarget(map[key]);
    if (Number.isFinite(idx) && to) targets[idx] = to;
  });
  if (!Object.keys(targets).length) return data;

  const copy = JSON.parse(JSON.stringify(data));
  // Aplica a cor alvo em todos os keyframes de um nó "c" (sólido/animado).
  const applyColorTarget = (value: any, target: NonNullable<ReturnType<typeof parseLottieColorTarget>>) => {
    const normalized = normalizeLottieRgbArray(value);
    if (normalized) {
      writeLottieRgbArray(value, target.rgb);
      if (value.length >= 4 && target.hasAlpha) value[3] = target.a;
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((frame) => {
        if (!frame || typeof frame !== 'object') return;
        if (Array.isArray(frame.s)) applyColorTarget(frame.s, target);
        if (Array.isArray(frame.e)) applyColorTarget(frame.e, target);
      });
    }
  };
  const applyNodeOpacity = (node: any, target: ReturnType<typeof parseLottieColorTarget>) => {
    if (!target?.hasAlpha || !node?.o || node.o.k == null) return;
    if (typeof node.o.k === 'number') node.o.k = Math.max(0, Math.min(1, target.a)) * 100;
    else applyLottieOpacityValue(node.o.k, target.a);
  };
  // Aplica cores alvo nas paradas do gradiente, com alvos por índice de parada (i).
  const applyGradientTargets = (value: any, points: number, stopTargets: Record<number, NonNullable<ReturnType<typeof parseLottieColorTarget>>>) => {
    if (Array.isArray(value) && value.length >= points * 4 && value.slice(0, points * 4).every((v) => typeof v === 'number')) {
      const matches: Array<{ offset: number; target: NonNullable<ReturnType<typeof parseLottieColorTarget>> }> = [];
      for (let i = 0; i < points; i += 1) {
        const target = stopTargets[i];
        if (!target) continue;
        const base = i * 4;
        const triplet = [value[base + 1], value[base + 2], value[base + 3]];
        writeLottieRgbArray(triplet, target.rgb);
        value[base + 1] = triplet[0];
        value[base + 2] = triplet[1];
        value[base + 3] = triplet[2];
        if (target.hasAlpha) matches.push({ offset: value[base], target });
      }
      if (matches.length) {
        const opacityStart = points * 4;
        let scale = 1;
        for (let oi = opacityStart + 1; oi < value.length; oi += 2) if (Number(value[oi]) > 1) scale = 100;
        matches.forEach((match) => {
          let wrote = false;
          for (let oi = opacityStart; oi + 1 < value.length; oi += 2) {
            if (Math.abs(Number(value[oi]) - Number(match.offset)) < 0.001) {
              value[oi + 1] = match.target.a * scale;
              wrote = true;
            }
          }
          if (!wrote) value.push(match.offset, match.target.a * scale);
        });
      }
      return true;
    }
    if (Array.isArray(value)) {
      for (const frame of value) {
        if (!frame || typeof frame !== 'object') continue;
        if (Array.isArray(frame.s) && applyGradientTargets(frame.s, points, stopTargets)) return true;
        if (Array.isArray(frame.e) && applyGradientTargets(frame.e, points, stopTargets)) return true;
      }
    }
    return false;
  };
  // slot = posição sequencial entre as cores representáveis (idêntico a extractLordColors).
  let slot = 0;
  const walk = (node: any) => {
    if (!node || typeof node !== 'object') return;
    if (node.c && node.c.k) {
      const hex = lottieFirstColorHex(node.c.k);
      if (hex) {
        const target = targets[slot];
        if (target) {
          applyColorTarget(node.c.k, target);
          applyNodeOpacity(node, target);
        }
        slot += 1;
      }
    }
    if (node.g && node.g.k) {
      const points = Number(node.g.p || node.p || 0);
      const gradientValue = node.g.k.k ?? node.g.k;
      if (points > 0) {
        const hexes = lottieGradientStopHexes(gradientValue, points);
        const stopTargets: Record<number, NonNullable<ReturnType<typeof parseLottieColorTarget>>> = {};
        for (let i = 0; i < points; i += 1) {
          if (!hexes[i]) continue;
          const target = targets[slot];
          if (target) stopTargets[i] = target;
          slot += 1;
        }
        if (Object.keys(stopTargets).length) applyGradientTargets(gradientValue, points, stopTargets);
      }
    }
    if (Array.isArray(node)) node.forEach(walk);
    else Object.values(node).forEach(walk);
  };
  walk(copy);
  return copy;
};


// Configurações padrão (fonte da verdade das propriedades de edição atuais).
// Usadas para inicializar os estados e para "atualizar" modelos antigos,
// preenchendo propriedades novas que ainda não existiam quando foram salvos.
const DEFAULT_WHATSAPP_CONFIG = {
  phone: '5511999999999',
  text: 'Fale com nosso time',
  bgColor: '#25D366',
  textColor: '#ffffff',
  position: 'right',
  borderRadius: '50',
};

const DEFAULT_BANNER_CONFIG = {
  message: '🎉 Aproveite 20% de desconto usando o cupom PROMO20!',
  bgColor: '#111827',
  textColor: '#ffffff',
  link: 'https://seusite.com/promo',
  isDismissible: true,
};

const makeSlideId = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    ? crypto.randomUUID()
    : `slide-${Math.random().toString(36).slice(2, 10)}`;

const DEFAULT_BANNER_SLIDER_CONFIG = {
  slides: [
    {
      id: 'slide-1',
      name: 'Slide 1',
      active: true,
      imageDesktop: '',
      imageTablet: '',
      imageMobile: '',
      alt: 'Banner institucional',
      href: '',
      newTab: false,
    },
  ],
  autoplay: true,
  intervalMs: 5000,
  transitionMs: 600,
  loop: true,
  showArrows: true,
  showPagination: true,
  effect: 'slide' as 'slide' | 'fade',
  lazyLoad: true,
  pauseOnHover: true,
};

const DEFAULT_MENU_CONFIG = {
  logoUrl: 'https://anabrasil.org/wp-content/uploads/2023/04/Ativo-3.webp',
  logoUrlMobile: '',
  logoColor: '',
  bgColor: '#ffffff',
  textColor: '#1f2937',
  accentColor: '#4f46e5',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontWeight: '400',
  fontStyle: 'normal',
  fontSize: 15,
  itemSpacing: 5,
  itemPadding: 15,
  hoverBgColor: '#f1f0fb',
  hoverTextColor: '#4f46e5',
  activeBorderColor: '#4f46e5',
  activeBorderWidth: 2,
  activeAnimDuration: 3,
  hoverBorderColor: '#4f46e5',
  hoverBorderWidth: 2,
  activeRadius: 30,
  activeRadiusTablet: 30,
  activeRadiusMobile: 30,
  itemRadius: 10,
  itemRadiusTablet: 10,
  itemRadiusMobile: 0,
  submenuGap: 0,
  submenuGapTablet: 0,
  submenuGapMobile: 0,
  submenuItemSpacing: 4,
  submenuItemSpacingTablet: 4,
  submenuItemSpacingMobile: 4,
  shadowSize: 28,
  shadowIntensity: 22,
  tabletMenuMode: 'header',
  activeBgColor: 'transparent',
  activeTextColor: '#4f46e5',
  items: [
    { label: 'Início', link: '#', children: [] as any[] },
    { label: 'Sobre', link: '#', children: [] as any[] },
    { label: 'Serviços', link: '#', children: [] as any[] },
    { label: 'Contato', link: '#', children: [] as any[] },
  ] as any[],
  sticky: true,
  searchEnabled: true,
  searchRadius: 100,
  searchBgColor: '#00000010',
  searchIconColor: '#1f2937',
  hamburgerColor: '#1f2937',
  hamburgerBgColor: '#00000000',
  hamburgerRadius: 32,
  spotlightRadius: 24,
  searchIconSize: 16,
  hamburgerSize: 24,
  toggleSize: 38,
  spotlightPaddingX: 20,
  spotlightAlign: 'top',
  searchUrl: 'https://anabrasil.org/',
  enableAutoDetect: false,
  enableWpApi: true,
  wpApiUrl: '',
  testUrl: 'https://anabrasil.org/ana/',
};

const DEFAULT_GATEWAY_CONFIG = {
  mobileFooterBar: false,
  backgroundImage: '',
  bgColor: '#0f172a',
  overlayOpacity: 60,
  cardHeight: 176,
  cardWidth: 176,
  cardBgColor: '#ffffff',
  cardRadius: 24,
  pillBgColor: '#ffffff',
  pillTextColor: '#ffffff',
  pillHeight: 24,
  pillWidth: 0,
  // Overrides por dispositivo (undefined = herda do desktop/base).
  cardWidthTablet: undefined as number | undefined,
  cardWidthMobile: undefined as number | undefined,
  cardHeightTablet: undefined as number | undefined,
  cardHeightMobile: undefined as number | undefined,
  cardRadiusTablet: undefined as number | undefined,
  cardRadiusMobile: undefined as number | undefined,
  pillHeightTablet: undefined as number | undefined,
  pillHeightMobile: undefined as number | undefined,
  pillWidthTablet: undefined as number | undefined,
  pillWidthMobile: undefined as number | undefined,
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontWeight: '400',
  fontStyle: 'normal',
  titleFont: '',
  titleFontWeight: '800',
  titleFontStyle: 'normal',
  subtitleFont: '',
  subtitleFontWeight: '400',
  subtitleFontStyle: 'normal',
  labelHoverFromIcon: false,
  layout: 'top-center',
  entranceAnim: 'none',
  entranceDuration: 600,
  entranceSync: false,
  title: 'Bem-vindo',
  subtitle: 'Escolha por onde deseja começar',
  titleColor: '#ffffff',
  options: [
    { id: 'social', icon: '👥', iconColor: '#14b8a6', cardLabel: 'Social', labelFont: '', labelFontWeight: '700', labelFontStyle: 'normal', pillText: 'Associação Nazarena', pillFont: '', pillFontWeight: '500', pillFontStyle: 'normal', link: '#' },
    { id: 'educacao', icon: '🎓', iconColor: '#eab308', cardLabel: 'Educação', labelFont: '', labelFontWeight: '700', labelFontStyle: 'normal', pillText: 'Grupo de Oração', pillFont: '', pillFontWeight: '500', pillFontStyle: 'normal', link: '#' },
  ] as any[],
};

// Modelos de layout / variações visuais pré-definidas para o Gateway.
// Aplicam apenas propriedades visuais; mantêm título, subtítulo e options do usuário.
const GATEWAY_PRESETS: { id: string; name: string; style: Record<string, any> }[] = [
  {
    id: 'classic',
    name: 'Clássico (título topo)',
    style: {
      layout: 'top-center',
      cardWidth: 176, cardHeight: 176, cardBgColor: '#ffffff', cardRadius: 24,
      pillBgColor: '#ffffff', pillTextColor: '#0f172a', pillHeight: 24, pillWidth: 0,
      titleColor: '#ffffff', fontFamily: 'system-ui, -apple-system, sans-serif',
      entranceAnim: 'none', entranceDuration: 600,
    },
  },
  {
    id: 'split',
    name: 'Dividido (título lateral)',
    style: {
      layout: 'split',
      cardWidth: 170, cardHeight: 170, cardBgColor: '#ffffff', cardRadius: 20,
      pillBgColor: '#6366f1', pillTextColor: '#ffffff', pillHeight: 26, pillWidth: 0,
      titleColor: '#0f172a', fontFamily: 'Poppins, system-ui, sans-serif',
      entranceAnim: 'slide', entranceDuration: 550,
    },
  },
  {
    id: 'list',
    name: 'Lista (linhas)',
    style: {
      layout: 'list',
      cardWidth: 176, cardHeight: 88, cardBgColor: '#ffffff', cardRadius: 16,
      pillBgColor: '#0ea5e9', pillTextColor: '#ffffff', pillHeight: 24, pillWidth: 0,
      titleColor: '#ffffff', fontFamily: 'Inter, system-ui, sans-serif',
      entranceAnim: 'up', entranceDuration: 500,
    },
  },
  {
    id: 'grid2',
    name: 'Grade 2 colunas',
    style: {
      layout: 'grid2',
      cardWidth: 176, cardHeight: 176, cardBgColor: '#ffffff', cardRadius: 24,
      pillBgColor: '#f43f5e', pillTextColor: '#ffffff', pillHeight: 26, pillWidth: 0,
      titleColor: '#ffffff', fontFamily: 'Poppins, system-ui, sans-serif',
      entranceAnim: 'zoom', entranceDuration: 600,
    },
  },
  {
    id: 'grid3',
    name: 'Grade 3 colunas',
    style: {
      layout: 'grid3',
      cardWidth: 160, cardHeight: 160, cardBgColor: '#ffffff', cardRadius: 18,
      pillBgColor: '#6366f1', pillTextColor: '#ffffff', pillHeight: 24, pillWidth: 0,
      titleColor: '#ffffff', fontFamily: 'Inter, system-ui, sans-serif',
      entranceAnim: 'fade', entranceDuration: 550,
    },
  },
  {
    id: 'left',
    name: 'Alinhado à esquerda',
    style: {
      layout: 'top-left',
      cardWidth: 176, cardHeight: 176, cardBgColor: '#f8fafc', cardRadius: 14,
      pillBgColor: '#e2e8f0', pillTextColor: '#0f172a', pillHeight: 22, pillWidth: 0,
      titleColor: '#0f172a', fontFamily: 'Inter, system-ui, sans-serif',
      entranceAnim: 'fade', entranceDuration: 500,
    },
  },
  {
    id: 'no-title',
    name: 'Só cards (sem título)',
    style: {
      layout: 'no-title',
      cardWidth: 184, cardHeight: 184, cardBgColor: '#ffffff', cardRadius: 28,
      pillBgColor: '#6366f1', pillTextColor: '#ffffff', pillHeight: 26, pillWidth: 0,
      titleColor: '#ffffff', fontFamily: 'Poppins, system-ui, sans-serif',
      entranceAnim: 'zoom', entranceDuration: 600,
    },
  },
  {
    id: 'rounded',
    name: 'Arredondado',
    style: {
      layout: 'top-center',
      cardWidth: 184, cardHeight: 184, cardBgColor: '#ffffff', cardRadius: 48,
      pillBgColor: '#6366f1', pillTextColor: '#ffffff', pillHeight: 28, pillWidth: 0,
      titleColor: '#ffffff', fontFamily: 'Poppins, system-ui, sans-serif',
      entranceAnim: 'zoom', entranceDuration: 600,
    },
  },
  {
    id: 'dark',
    name: 'Escuro',
    style: {
      layout: 'top-center',
      cardWidth: 176, cardHeight: 176, cardBgColor: '#1e293b', cardRadius: 20,
      pillBgColor: '#334155', pillTextColor: '#f8fafc', pillHeight: 26, pillWidth: 0,
      titleColor: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif',
      entranceAnim: 'up', entranceDuration: 700,
    },
  },
  {
    id: 'list-dark',
    name: 'Lista escura',
    style: {
      layout: 'list',
      cardWidth: 176, cardHeight: 88, cardBgColor: '#1e293b', cardRadius: 14,
      pillBgColor: '#0ea5e9', pillTextColor: '#ffffff', pillHeight: 24, pillWidth: 0,
      titleColor: '#f8fafc', fontFamily: 'Inter, system-ui, sans-serif',
      entranceAnim: 'slide', entranceDuration: 500,
    },
  },
  {
    id: 'glass',
    name: 'Vidro',
    style: {
      layout: 'top-center',
      cardWidth: 180, cardHeight: 180, cardBgColor: '#ffffff26', cardRadius: 28,
      pillBgColor: '#ffffff33', pillTextColor: '#ffffff', pillHeight: 26, pillWidth: 0,
      titleColor: '#ffffff', fontFamily: 'Inter, system-ui, sans-serif',
      entranceAnim: 'fade', entranceDuration: 700,
    },
  },
  {
    id: 'neon',
    name: 'Neon',
    style: {
      layout: 'grid2',
      cardWidth: 176, cardHeight: 176, cardBgColor: '#0d1b2a', cardRadius: 18,
      pillBgColor: '#2dd4a8', pillTextColor: '#0d1b2a', pillHeight: 26, pillWidth: 0,
      titleColor: '#73ffb8', fontFamily: 'Poppins, system-ui, sans-serif',
      entranceAnim: 'up', entranceDuration: 600,
    },
  },
  {
    id: 'gold',
    name: 'Dourado',
    style: {
      layout: 'split',
      cardWidth: 180, cardHeight: 180, cardBgColor: '#1a1a1a', cardRadius: 22,
      pillBgColor: '#c9a84c', pillTextColor: '#1a1a1a', pillHeight: 26, pillWidth: 0,
      titleColor: '#f0d78c', fontFamily: 'Poppins, system-ui, sans-serif',
      entranceAnim: 'zoom', entranceDuration: 700,
    },
  },
];

const DEFAULT_SIDETAB_CONFIG = {
  label: 'Quero ajudar',
  link: '#',
  bgColor: '#4f46e5',
  textColor: '#ffffff',
  side: 'right',
  position: 96,
  fontSize: 14,
  radius: 8,
};

const getDefaultConfig = (type: string) =>
  type === 'whatsapp' ? DEFAULT_WHATSAPP_CONFIG :
  type === 'banner' ? DEFAULT_BANNER_CONFIG :
  type === 'banner-slider' ? DEFAULT_BANNER_SLIDER_CONFIG :
  type === 'gateway' ? DEFAULT_GATEWAY_CONFIG :
  type === 'sidetab' ? DEFAULT_SIDETAB_CONFIG : DEFAULT_MENU_CONFIG;


// Mescla a config padrão atual com a config salva: novas propriedades de
// edição passam a existir, mas tudo que o usuário já configurou é preservado.
const upgradeConfig = (type: string, saved: any) => {
  const base = JSON.parse(JSON.stringify(getDefaultConfig(type)));
  const merged = { ...base, ...(saved && typeof saved === 'object' ? saved : {}) };
  // Mescla campos novos de cada item/opção, preservando valores salvos.
  if (type === 'gateway' && Array.isArray(merged.options)) {
    const itemBase = (base.options && base.options[0]) || {};
    merged.options = merged.options.map((o: any) => ({ ...itemBase, ...o }));
  }
  if (type === 'menu' && Array.isArray(merged.items)) {
    merged.items = merged.items.map((it: any) => ({
      ...it,
      children: Array.isArray(it.children) ? it.children : [],
    }));
  }
  return merged;
};

const templateStateString = (type: string, config: any) =>
  JSON.stringify({ type, config: upgradeConfig(type, config) });

// Lista única de famílias, pesos e estilos para todos os campos de texto personalizável.
const FONT_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Padrão do widget' },
  { value: "system-ui, -apple-system, sans-serif", label: 'Sistema' },
  { value: "'Inter', sans-serif", label: 'Inter' },
  { value: "'Poppins', sans-serif", label: 'Poppins' },
  { value: "'Roboto', sans-serif", label: 'Roboto' },
  { value: "'Montserrat', sans-serif", label: 'Montserrat' },
  { value: 'Georgia, serif', label: 'Georgia (serifada)' },
  { value: "'Courier New', monospace", label: 'Monoespaçada' },
];

const FONT_WEIGHT_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Peso padrão' },
  { value: '100', label: '100 — Thin' },
  { value: '200', label: '200 — ExtraLight' },
  { value: '300', label: '300 — Light' },
  { value: '400', label: '400 — Regular' },
  { value: '500', label: '500 — Medium' },
  { value: '600', label: '600 — SemiBold' },
  { value: '700', label: '700 — Bold' },
  { value: '800', label: '800 — ExtraBold' },
  { value: '900', label: '900 — Black' },
];

const FONT_STYLE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Estilo padrão' },
  { value: 'normal', label: 'Normal' },
  { value: 'italic', label: 'Itálico' },
];

const fontRules = (family?: string, weight?: string | number, style?: string) => {
  const rules: string[] = [];
  if (family) rules.push(`font-family:${family};`);
  if (weight) rules.push(`font-weight:${weight};`);
  if (style) rules.push(`font-style:${style};`);
  return rules.length ? ` ${rules.join(' ')}` : '';
};

// Seletor reutilizável de família + peso + variação para qualquer texto editável.
const CollapsibleSection: React.FC<{
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = ({ title, defaultOpen = false, children }) => {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className={cn(
      "overflow-hidden rounded-2xl border transition-colors",
      open ? "border-foreground/25 bg-card" : "border-border bg-card"
    )}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center justify-between gap-2 px-3.5 py-3 text-left transition-colors",
          open ? "bg-muted/40" : "hover:bg-muted/50"
        )}
      >
        <span className="text-[13.5px] font-semibold text-foreground">
          {title}
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180 text-foreground")} />
      </button>
      {open && <div className="space-y-3 border-t bg-background/40 p-3">{children}</div>}
    </div>

  );
};

const FontSelect: React.FC<{
  value?: string;
  weight?: string | number;
  style?: string;
  onChange: (v: string) => void;
  onWeightChange?: (v: string) => void;
  onStyleChange?: (v: string) => void;
  className?: string;
}> = ({ value, weight, style, onChange, onWeightChange, onStyleChange, className }) => (
  <div className={cn('space-y-2', className)}>
    <select
      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Família da fonte"
    >
      {FONT_OPTIONS.map((f) => (
        <option key={f.label} value={f.value}>{f.label}</option>
      ))}
    </select>
    <div className="grid grid-cols-2 gap-2">
    <select
      className="h-9 min-w-0 w-full rounded-md border border-input bg-background px-2 text-sm"
      value={String(weight ?? '')}
      onChange={(e) => onWeightChange?.(e.target.value)}
      aria-label="Peso da fonte"
    >
      {FONT_WEIGHT_OPTIONS.map((f) => (
        <option key={f.value || f.label} value={f.value}>{f.label}</option>
      ))}
    </select>
    <select
      className="h-9 min-w-0 w-full rounded-md border border-input bg-background px-2 text-sm"
      value={style ?? ''}
      onChange={(e) => onStyleChange?.(e.target.value)}
      aria-label="Estilo da fonte"
    >
      {FONT_STYLE_OPTIONS.map((f) => (
        <option key={f.value || f.label} value={f.value}>{f.label}</option>
      ))}
    </select>
    </div>

  </div>
);







export default function AdminToolboxPage() {
  const { toast } = useToast();
  // Estado geral
  const [activeWidgetType, setActiveWidgetType] = useState('whatsapp');
  const [viewMode, setViewMode] = useState('preview'); // 'preview' ou 'code'
  const [deviceView, setDeviceView] = useState<DeviceView>('desktop');
  const [panelDevice, setPanelDevice] = useState<DeviceView>('desktop'); // aba de dispositivo no painel
  // Foco de edição: revela elementos ocultos na demo enquanto o usuário ajusta.
  const [editingFocus, setEditingFocus] = useState<'submenu' | null>(null);
  const editingFocusRef = React.useRef<'submenu' | null>(null);
  editingFocusRef.current = editingFocus;
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [savedTemplates, setSavedTemplates] = useState<any[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentTemplateId, setCurrentTemplateId] = useState<string | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [historyTemplate, setHistoryTemplate] = useState<any | null>(null);
  const skipDraftRef = React.useRef(false);
  const baselineRef = React.useRef<string | null>(null);

  // ---- Histórico de versões por modelo (salvo localmente) ----
  const HISTORY_LIMIT = 30;
  const cleanName = (n: string) => (n || '').replace(/(\s*\((atualizado|cópia|copia)\))+/gi, '').trim();
  const getHistory = (id: string): any[] => {
    try { return JSON.parse(localStorage.getItem(`widget_history_${id}`) || '[]'); } catch { return []; }
  };
  const pushHistory = (template: any, note?: string) => {
    if (!template?.id) return;
    const entry = { savedAt: new Date().toISOString(), name: template.name, config: template.config, note: note || 'Versão anterior' };
    const list = [entry, ...getHistory(template.id)].slice(0, HISTORY_LIMIT);
    localStorage.setItem(`widget_history_${template.id}`, JSON.stringify(list));
  };
  
  // Ref para controle de debounce na detecção de URL
  const debounceRef = React.useRef<NodeJS.Timeout | null>(null);

  // Resoluções "nativas" simuladas por dispositivo (a janela mantém a proporção,
  // mas o conteúdo é renderizado nessas dimensões e escalado para caber).
  const DEVICE_RESOLUTIONS: Record<string, { width: number; height: number }> = {
    desktop: { width: 1366, height: 768 }, // 16:9
    tablet: { width: 900, height: 1200 },  // ~3:4, dentro do breakpoint tablet
    mobile: { width: 390, height: 844 },   // ~9:19.5 (smartphone moderno)
  };
  const frameRef = React.useRef<HTMLDivElement | null>(null);
  const [previewScale, setPreviewScale] = useState(1);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const native = DEVICE_RESOLUTIONS[deviceView] ?? DEVICE_RESOLUTIONS.desktop;
    const update = () => {
      // clientWidth/Height excluem a borda do "dispositivo", evitando overflow do conteúdo.
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0) {
        // Usa a menor escala para garantir que o conteúdo caiba sem cortar.
        setPreviewScale(Math.min(w / native.width, h / native.height));
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [deviceView]);

  const demoRef = React.useRef<HTMLDivElement | null>(null);
  const [demoScale, setDemoScale] = useState(0.6);
  useEffect(() => {
    const el = demoRef.current;
    if (!el) return;
    const native = DEVICE_RESOLUTIONS[deviceView] ?? DEVICE_RESOLUTIONS.desktop;
    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      // Encaixa nas duas dimensões para respeitar a proporção final do dispositivo.
      if (w > 0 && h > 0) setDemoScale(Math.min(w / native.width, h / native.height));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [deviceView]);





  // No preview inline, media queries usam a viewport real do app; por isso
  // espelhamos o dispositivo selecionado com classes auxiliares no widget.
  useEffect(() => {
    const t = setTimeout(() => {
      const root = frameRef.current;
      if (!root) return;
      root.querySelectorAll('.custom-nav-992').forEach((nav) => {
        nav.classList.toggle('force-tablet', deviceView === 'tablet');
        nav.classList.toggle('force-mobile', deviceView === 'mobile');
      });
    }, 60);
    return () => clearTimeout(t);
  });
  const [menuDetectionDetails, setMenuDetectionDetails] = useState<{
    status: 'checking' | 'success' | 'warning' | 'error';
    message: string;
    endpoint?: string;
    itemCount?: number;
    submenuCount?: number;
  } | null>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('widget_templates')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setSavedTemplates(data || []);
    } catch (error: any) {
      console.error('Erro ao buscar modelos:', error.message);
    }
  };

  const currentConfig = () => activeWidgetType === 'whatsapp' ? whatsappConfig :
    activeWidgetType === 'banner' ? bannerConfig :
    activeWidgetType === 'banner-slider' ? bannerSliderConfig :
    activeWidgetType === 'gateway' ? gatewayConfig :
    activeWidgetType === 'sidetab' ? sidetabConfig : menuConfig;

  const applyConfig = (type: string, config: any) => {
    if (type === 'whatsapp') setWhatsappConfig(config);
    else if (type === 'banner') setBannerConfig(config);
    else if (type === 'banner-slider') setBannerSliderConfig(config);
    else if (type === 'gateway') setGatewayConfig(config);
    else if (type === 'sidetab') setSidetabConfig(config);
    else setMenuConfig(prev => ({
      ...prev,
      ...config,
      activeRadiusTablet: config.activeRadiusTablet ?? config.activeRadius ?? prev.activeRadiusTablet,
      activeRadiusMobile: config.activeRadiusMobile ?? config.activeRadius ?? prev.activeRadiusMobile,
      itemRadiusTablet: config.itemRadiusTablet ?? config.itemRadius ?? prev.itemRadiusTablet,
      itemRadiusMobile: config.itemRadiusMobile ?? config.itemRadius ?? prev.itemRadiusMobile,
      submenuItemSpacingTablet: config.submenuItemSpacingTablet ?? config.submenuItemSpacing ?? prev.submenuItemSpacingTablet,
      submenuItemSpacingMobile: config.submenuItemSpacingMobile ?? config.submenuItemSpacing ?? prev.submenuItemSpacingMobile,
    }));
  };

  const saveTemplate = async () => {
    if (!templateName.trim()) {
      toast({ title: "Erro", description: "Dê um nome ao seu modelo.", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Erro", description: "Você precisa estar logado.", variant: "destructive" });
        return;
      }

      const rawConfig = activeWidgetType === 'whatsapp' ? whatsappConfig : 
                     activeWidgetType === 'banner' ? bannerConfig :
                     activeWidgetType === 'banner-slider' ? bannerSliderConfig :
                     activeWidgetType === 'gateway' ? gatewayConfig :
                     activeWidgetType === 'sidetab' ? sidetabConfig : menuConfig;
      // Deep clone para evitar referências compartilhadas/mutações em items.activePaths
      const config = JSON.parse(JSON.stringify(rawConfig));

      const templateData = {
        name: templateName,
        type: activeWidgetType,
        config,
        user_id: user.id
      };

      let error;
      if (currentTemplateId) {
        const { error: updateError } = await supabase
          .from('widget_templates')
          .update(templateData)
          .eq('id', currentTemplateId);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('widget_templates')
          .insert(templateData);
        error = insertError;
      }

      if (error) throw error;

      toast({ title: "Sucesso", description: `Modelo "${templateName}" salvo!` });
      if (currentTemplateId) localStorage.removeItem(`widget_draft_${currentTemplateId}`);
      setDraftSavedAt(null);
      setTemplateName('');
      setCurrentTemplateId(null);
      setIsDialogOpen(false);
      fetchTemplates();
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const loadTemplate = (template: any) => {
    skipDraftRef.current = true;
    // Baseline normalizado: novos campos padrão do editor não contam como
    // alteração do usuário. Só diferenças reais exibem rascunho/atualização.
    const baseStr = templateStateString(template.type, template.config);

    let cfg = upgradeConfig(template.type, template.config);
    let savedAt: string | null = null;
    try {
      const raw = localStorage.getItem(`widget_draft_${template.id}`);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && d.config) {
          cfg = upgradeConfig(template.type, d.config);
          savedAt = d.savedAt ?? null;
        }
      }
    } catch { /* ignore drafts corrompidos */ }

    setActiveWidgetType(template.type);
    setCurrentTemplateId(template.id);
    setTemplateName(template.name);
    applyConfig(template.type, cfg);
    baselineRef.current = baseStr;
    // Mostra aviso se o config carregado já difere do salvo (edição ou novos recursos).
    const diff = templateStateString(template.type, cfg) !== baseStr;
    if (!diff) localStorage.removeItem(`widget_draft_${template.id}`);
    setDraftSavedAt(diff ? (savedAt ?? new Date().toISOString()) : null);

    toast(diff && savedAt
      ? { title: "Rascunho restaurado", description: `Alterações não salvas de "${template.name}".` }
      : { title: "Modelo carregado", description: `Editando: ${template.name}` });
  };

  // Sobrepõe o modelo no banco com o rascunho atual.
  const overwriteWithDraft = async () => {
    if (!currentTemplateId) return;
    setIsSaving(true);
    try {
      // Guarda a versão atual no histórico antes de sobrepor.
      const prev = savedTemplates.find((t) => t.id === currentTemplateId);
      if (prev) pushHistory(prev, 'Antes de sobrepor');
      const { error } = await supabase
        .from('widget_templates')
        .update({ config: currentConfig() })
        .eq('id', currentTemplateId);
      if (error) throw error;
      localStorage.removeItem(`widget_draft_${currentTemplateId}`);
      baselineRef.current = templateStateString(activeWidgetType, currentConfig());
      setDraftSavedAt(null);
      toast({ title: "Modelo atualizado", description: "O rascunho sobrepôs o modelo. Versão anterior salva no histórico." });
      fetchTemplates();
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  // Restaura uma versão do histórico de um modelo.
  const restoreHistory = async (entry: any) => {
    if (!historyTemplate) return;
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Erro", description: "Você precisa estar logado.", variant: "destructive" });
        return;
      }
      // Restaurar cria uma cópia nova "(restaurado)", preservando o modelo atual.
      const merged = upgradeConfig(historyTemplate.type, entry.config);
      const { error } = await supabase
        .from('widget_templates')
        .insert({
          name: `${cleanName(historyTemplate.name)} (restaurado)`,
          type: historyTemplate.type,
          config: merged,
          user_id: user.id,
        });
      if (error) throw error;
      toast({ title: "Versão restaurada", description: `Criada uma cópia "(restaurado)" da versão de ${new Date(entry.savedAt).toLocaleString('pt-BR')}. O modelo original foi mantido.` });
      setHistoryTemplate(null);
      fetchTemplates();
    } catch (error: any) {
      toast({ title: "Erro ao restaurar", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };


  // Salva o rascunho atual como um novo modelo.
  const saveDraftAsNew = () => {
    if (currentTemplateId) localStorage.removeItem(`widget_draft_${currentTemplateId}`);
    setDraftSavedAt(null);
    setCurrentTemplateId(null);
    setTemplateName(prev => { const base = cleanName(prev); return base ? `${base} (cópia)` : ''; });
    setIsDialogOpen(true);
  };

  const discardDraft = () => {
    if (!currentTemplateId) return;
    const template = savedTemplates.find((t) => t.id === currentTemplateId);
    if (!template) return;
    skipDraftRef.current = true;
    localStorage.removeItem(`widget_draft_${currentTemplateId}`);
    const cfg = upgradeConfig(template.type, template.config);
    setActiveWidgetType(template.type);
    setTemplateName(template.name);
    applyConfig(template.type, cfg);
    baselineRef.current = templateStateString(template.type, template.config);
    setDraftSavedAt(null);
    toast({ title: "Rascunho descartado", description: "O modelo voltou para a versão salva." });
  };


  // Cria uma CÓPIA atualizada do modelo (mantém o original intacto),
  // mesclando as propriedades de edição novas do sistema com a config salva.
  const upgradeTemplate = async (template: any) => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Erro", description: "Você precisa estar logado.", variant: "destructive" });
        return;
      }
      const merged = upgradeConfig(template.type, template.config);
      const { error } = await supabase
        .from('widget_templates')
        .insert({
          name: `${template.name} (atualizado)`,
          type: template.type,
          config: merged,
          user_id: user.id,
        });
      if (error) throw error;
      toast({ title: "Modelo atualizado", description: `Criada uma versão atualizada de "${template.name}". O original foi mantido.` });
      fetchTemplates();
    } catch (error: any) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteTemplate = async (id: string) => {

    try {
      const { error } = await supabase.from('widget_templates').delete().eq('id', id);
      if (error) throw error;
      setSavedTemplates(savedTemplates.filter(t => t.id !== id));
      if (currentTemplateId === id) {
        setCurrentTemplateId(null);
        setTemplateName('');
        setDraftSavedAt(null);
        baselineRef.current = null;
      }
      toast({ title: "Excluído", description: "Modelo removido com sucesso." });
    } catch (error: any) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    }
  };


  const WIDGET_DEMOS = {
    whatsapp: {
      phone: '5511999999999',
      text: 'Fale com nosso suporte',
      bgColor: '#25D366',
      textColor: '#ffffff',
      position: 'right',
      borderRadius: '50'
    },
    banner: {
      message: '🚀 Nova funcionalidade de submenus liberada! Confira agora.',
      bgColor: '#4f46e5',
      textColor: '#ffffff',
      link: '#',
      isDismissible: true
    },
    menu: {
      logoUrl: 'https://anabrasil.org/wp-content/uploads/2023/04/Ativo-3.webp',
      logoUrlMobile: '',
      logoColor: '',
      bgColor: '#ffffff',
      textColor: '#1f2937',
      accentColor: '#4f46e5',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: 15,
      itemSpacing: 5,
      itemPadding: 15,
      hoverBgColor: '#f1f0fb',
      hoverTextColor: '#4f46e5',
      activeBorderColor: '#4f46e5',
      activeBorderWidth: 2,
      activeAnimDuration: 3,
      hoverBorderColor: '#4f46e5',
      hoverBorderWidth: 2,
      activeRadius: 30,
      activeRadiusTablet: 30,
      activeRadiusMobile: 30,
      itemRadius: 10,
      itemRadiusTablet: 10,
      itemRadiusMobile: 0,
      submenuGap: 0,
      submenuGapTablet: 0,
      submenuGapMobile: 0,
      submenuItemSpacing: 4,
      submenuItemSpacingTablet: 4,
      submenuItemSpacingMobile: 4,
      shadowSize: 28,
      shadowIntensity: 22,
      tabletMenuMode: 'header',
      activeBgColor: 'transparent',
      activeTextColor: '#4f46e5',
      items: [
        { label: 'Início', link: '#' },
        { 
          label: 'Serviços', 
          link: '#', 
          children: [
            { label: 'Consultoria Especializada', link: '#' },
            { label: 'Desenvolvimento Web', link: '#' },
            { label: 'Marketing Digital', link: '#' }
          ] 
        },
        { 
          label: 'Soluções', 
          link: '#', 
          children: [
            { label: 'Sistemas ERP', link: '#' },
            { label: 'Aplicativos Mobile', link: '#' }
          ] 
        },
        { label: 'Sobre Nós', link: '#' }
      ],
      sticky: true,
      searchEnabled: true,
      searchRadius: 100,
      searchBgColor: '#00000010',
      searchIconColor: '#1f2937',
      hamburgerColor: '#1f2937',
      hamburgerBgColor: '#00000000',
      hamburgerRadius: 32,
      spotlightRadius: 24,
      searchIconSize: 16,
      hamburgerSize: 24,
      toggleSize: 38,
      spotlightPaddingX: 20,
      spotlightAlign: 'top',
      searchUrl: 'https://anabrasil.org/',
      enableAutoDetect: false,
      enableWpApi: false,
      wpApiUrl: '',
      testUrl: 'https://anabrasil.org/ana/'
    },
    gateway: DEFAULT_GATEWAY_CONFIG,
    sidetab: DEFAULT_SIDETAB_CONFIG,
    'banner-slider': {
      ...DEFAULT_BANNER_SLIDER_CONFIG,
      slides: [
        {
          id: 'demo-slide-1',
          name: 'Campanha 1',
          active: true,
          imageDesktop: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=1916&h=821&fit=crop',
          imageTablet: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=1536&h=1024&fit=crop',
          imageMobile: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=1080&h=1440&fit=crop',
          alt: 'Campanha de destaque',
          href: '#',
          newTab: false,
        },
        {
          id: 'demo-slide-2',
          name: 'Campanha 2',
          active: true,
          imageDesktop: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=1916&h=821&fit=crop',
          imageTablet: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=1536&h=1024&fit=crop',
          imageMobile: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=1080&h=1440&fit=crop',
          alt: 'Segunda campanha',
          href: '#',
          newTab: false,
        },
      ],
    },
  };

  const loadDemo = (type: 'whatsapp' | 'banner' | 'menu' | 'gateway' | 'sidetab' | 'banner-slider') => {
    setActiveWidgetType(type);
    if (type === 'whatsapp') setWhatsappConfig(WIDGET_DEMOS.whatsapp);
    else if (type === 'banner') setBannerConfig(WIDGET_DEMOS.banner);
    else if (type === 'menu') setMenuConfig(WIDGET_DEMOS.menu);
    else if (type === 'gateway') setGatewayConfig(JSON.parse(JSON.stringify(WIDGET_DEMOS.gateway)));
    else if (type === 'sidetab') setSidetabConfig(JSON.parse(JSON.stringify(WIDGET_DEMOS.sidetab)));
    else if (type === 'banner-slider') setBannerSliderConfig(JSON.parse(JSON.stringify(WIDGET_DEMOS['banner-slider'])));
    
    toast({
      title: `Demo de ${type === 'menu' ? 'Menu' : type} carregada`,
      description: "Você já pode ver o resultado no preview ao lado.",
    });
  };

  // Estados de configuração dos widgets
  const [whatsappConfig, setWhatsappConfig] = useState(() => JSON.parse(JSON.stringify(DEFAULT_WHATSAPP_CONFIG)));

  const [bannerConfig, setBannerConfig] = useState(() => JSON.parse(JSON.stringify(DEFAULT_BANNER_CONFIG)));

  const [menuConfig, setMenuConfig] = useState(() => JSON.parse(JSON.stringify(DEFAULT_MENU_CONFIG)));

  const [gatewayConfig, setGatewayConfig] = useState(() => JSON.parse(JSON.stringify(DEFAULT_GATEWAY_CONFIG)));
  // Personalização por dispositivo do Gateway (tablet/mobile herdam do desktop).
  const gwKey = (base: string, dev: DeviceView) =>
    dev === 'desktop' ? base : base + (dev === 'tablet' ? 'Tablet' : 'Mobile');
  const gwGet = (base: string, dev: DeviceView): number =>
    (gatewayConfig[gwKey(base, dev)] ?? gatewayConfig[base]) as number;
  const gwSet = (base: string, dev: DeviceView, val: number) =>
    setGatewayConfig({ ...gatewayConfig, [gwKey(base, dev)]: val });

  const [sidetabConfig, setSidetabConfig] = useState(() => JSON.parse(JSON.stringify(DEFAULT_SIDETAB_CONFIG)));

  const [bannerSliderConfig, setBannerSliderConfig] = useState(() => JSON.parse(JSON.stringify(DEFAULT_BANNER_SLIDER_CONFIG)));



  // ===== Preview "demo" orientado pelo código final =====
  // Regra de paridade: o iframe recebe SEMPRE o HTML/CSS gerado por
  // getGeneratedCode(). A demo só injeta um script de clique para simular
  // interação; nenhum CSS visual extra é permitido aqui.
  const demoIframeRef = React.useRef<HTMLIFrameElement | null>(null);
  const [demoDoc, setDemoDoc] = useState('');
  const [demoVersion, setDemoVersion] = useState(0);
  const demoScript = `<script>window.open=function(){return null;};document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('.menu-items a');if(!a){document.querySelectorAll('.has-submenu.open').forEach(function(x){x.classList.remove('open');});return;}e.preventDefault();e.stopPropagation();var parent=a.parentElement;var hs=(parent&&parent.classList.contains('has-submenu')&&parent.querySelector(':scope > .submenu'))?parent:null;var sub=a.closest('.submenu');var keep=hs||(sub?sub.closest('.has-submenu'):null);document.querySelectorAll('.has-submenu.open').forEach(function(x){if(!(keep&&(x===keep||x.contains(keep)))){x.classList.remove('open');}});if(hs){hs.classList.toggle('open');}var top=sub?(sub.closest('.has-submenu')||a):a;var topLink=top.querySelector?(top.matches('a')?top:top.querySelector(':scope > a')):a;document.querySelectorAll('.menu-items a.active').forEach(function(x){x.classList.remove('active');});a.classList.add('active');if(topLink)topLink.classList.add('active');},true);</scr`+`ipt>`;

  useEffect(() => {
    // Fundo de teste APENAS no preview (não faz parte do código final).
    const previewBg = activeWidgetType === 'gateway'
      ? `<style>body{background:linear-gradient(135deg,#1e293b,#334155);min-height:100vh;margin:0;display:flex;align-items:center;justify-content:center;padding:48px 24px;box-sizing:border-box;}</style>`
      : '';
    setDemoDoc(getGeneratedCode() + previewBg + demoScript);
    setDemoVersion((v) => v + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceView, activeWidgetType, whatsappConfig, bannerConfig, menuConfig, gatewayConfig, sidetabConfig, bannerSliderConfig]);


  // A demo não altera CSS. Este efeito só espelha classe de dispositivo para o
  // modo "Site" (fora do iframe isolado) e mantém o foco automático de submenu.
  useEffect(() => {
    try {
      const ifr = demoIframeRef.current;
      const doc = ifr && ifr.contentDocument;
      const target = doc && (doc.body || doc.head);
      if (!target) return;

      // Espelha o dispositivo selecionado dentro do iframe da demo para que as
      // regras .force-tablet / .force-mobile (espaçamento, raios, stacking)
      // sejam aplicadas mesmo sem media query correspondente.
      doc.querySelectorAll('.custom-nav-992').forEach((nav) => {
        nav.classList.toggle('force-tablet', deviceView === 'tablet');
        nav.classList.toggle('force-mobile', deviceView === 'mobile');
      });

      // Auto-revelar elemento oculto enquanto o usuário ajusta controles relacionados.
      // Ex.: ao mexer no espaçamento/raio do submenu, abrimos o 1º submenu para
      // mostrar a alteração ao vivo. Permanece aberto até o usuário clicar na demo.
      if (editingFocus === 'submenu') {
        const firstSub = doc.querySelector('.custom-nav-992 .has-submenu');
        doc.querySelectorAll('.custom-nav-992 .has-submenu.open').forEach((sub) => {
          if (sub !== firstSub) {
            sub.classList.remove('open');
          }
        });
        if (firstSub) firstSub.classList.add('open');
      }

      // Quando o usuário clica dentro da demo, ele assume o controle: limpamos o
      // foco automático para não forçar reabertura nos próximos ajustes.
      if (!doc.getElementById('__focusClearAttached')) {
        const marker = doc.createElement('span');
        marker.id = '__focusClearAttached';
        marker.style.display = 'none';
        target.appendChild(marker);
        doc.addEventListener('click', () => {
          if (editingFocusRef.current) setEditingFocus(null);
        }, true);
      }

    } catch {
      /* iframe ainda em origem opaca / não acessível; ignora */
    }
  });

  // ===== Auto-save de rascunho =====
  // Com um modelo selecionado, qualquer alteração salva automaticamente um
  // rascunho local (sem sobrepor o modelo no banco). O usuário decide depois
  // entre "Sobrepor modelo" ou "Salvar como novo".
  useEffect(() => {
    if (!currentTemplateId) return;
    if (skipDraftRef.current) { skipDraftRef.current = false; return; }
    const config = activeWidgetType === 'whatsapp' ? whatsappConfig :
      activeWidgetType === 'banner' ? bannerConfig :
      activeWidgetType === 'banner-slider' ? bannerSliderConfig :
      activeWidgetType === 'gateway' ? gatewayConfig :
      activeWidgetType === 'sidetab' ? sidetabConfig : menuConfig;
    const t = setTimeout(() => {
      // Só registra rascunho se houver alteração real em relação ao modelo carregado.
      if (baselineRef.current !== null &&
          baselineRef.current === templateStateString(activeWidgetType, config)) {
        localStorage.removeItem(`widget_draft_${currentTemplateId}`);
        setDraftSavedAt(null);
        return;
      }
      try {
        const at = new Date().toISOString();
        localStorage.setItem(`widget_draft_${currentTemplateId}`, JSON.stringify({ type: activeWidgetType, config, savedAt: at }));
        setDraftSavedAt(at);
      } catch { /* storage indisponível */ }
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [whatsappConfig, bannerConfig, menuConfig, gatewayConfig, sidetabConfig, bannerSliderConfig, activeWidgetType, currentTemplateId]);





  const [jsonInput, setJsonInput] = useState('');

  // Fallback robusto: mesmo quando o JSON está truncado/inválido (ex.: colado
  // pela metade), tentamos extrair diretamente o HTML do menu que vem dentro
  // do campo content.rendered (formato wp_navigation do WordPress).
  const extractMenuFromRawText = (raw: string): any[] => {
    if (!raw) return [];
    // Captura todos os blocos "rendered":"...". Aceita conteúdo truncado.
    const matches = Array.from(raw.matchAll(/"rendered"\s*:\s*"((?:\\.|[^"\\])*)"?/g));
    let bestHtml = '';
    for (const m of matches) {
      // Desescapa a string JSON manualmente (a string pode estar incompleta).
      let html = m[1]
        .replace(/\\\//g, '/')
        .replace(/\\"/g, '"')
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\\\/g, '\\');
      // Só nos interessa o conteúdo que realmente parece um menu.
      if (/<li[\s>]/i.test(html) && html.length > bestHtml.length) bestHtml = html;
    }
    if (!bestHtml) return [];
    return extractWPItems([{ content: { rendered: bestHtml } }]);
  };

  const importMenuFromJson = () => {
    let items: any[] = [];
    try {
      const parsed = JSON.parse(jsonInput);
      items = extractWPItems(parsed);
    } catch {
      // JSON inválido/truncado — seguimos para o fallback de texto bruto.
    }

    // Se a leitura estruturada não retornou nada, tentamos extrair o HTML do menu.
    if (items.length === 0) {
      items = extractMenuFromRawText(jsonInput);
    }

    if (items.length > 0) {
      setMenuConfig(prev => ({ ...prev, items }));
      const subCount = countSubmenuItems(items);
      toast({
        title: 'Menu importado',
        description: `${items.length} item(ns) de topo e ${subCount} subitem(ns) detectado(s).`,
      });
    } else {
      toast({
        title: 'Nenhum item encontrado',
        description: 'Não foi possível extrair itens. Cole o JSON completo de /wp-json/wp/v2/navigation.',
        variant: 'destructive',
      });
    }
  };

  const importMenuFromUrl = async (url: string) => {
    if (!url.startsWith('http')) return false;

    try {
      const { data, error } = await supabase.functions.invoke('menu-html-proxy', {
        body: { url },
      });

      if (error) throw error;
      const html = typeof data?.html === 'string' ? data.html : '';
      const items = extractWPItems([{ content: { rendered: html } }]);
      const submenuCount = countSubmenuItems(items);

      if (items.length === 0) return false;

      setMenuConfig(prev => ({ ...prev, testUrl: url, items }));
      setMenuDetectionDetails({
        status: 'success',
        message: 'Menu detectado pela URL padrão via leitura completa do HTML.',
        endpoint: url,
        itemCount: items.length,
        submenuCount,
      });
      toast({
        title: 'Menu importado pela URL',
        description: `${items.length} item(ns) principais e ${submenuCount} subitem(ns) detectados.`,
      });
      return true;
    } catch (error: any) {
      setMenuDetectionDetails({
        status: 'warning',
        message: error?.message || 'Não foi possível ler a URL pelo proxy interno.',
        endpoint: url,
      });
      return false;
    }
  };

  // Carrega automaticamente o menu da URL padrão ao montar/recarregar a página.
  useEffect(() => {
    if (menuConfig.testUrl) {
      importMenuFromUrl(menuConfig.testUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);



  const extractWPItems = (data: any): any[] => {
    if (!data) return [];
    
    const cleanLabel = (text: string) => {
      if (!text) return '';
      return text.toString().replace(/[\u25BC\u25BE\u25B6\u25B8\u2304\u22EE\u00BB\u203A\u25B2\u25BC]/g, '').trim();
    };

    const firstPresent = (...values: any[]) => values.find(value => value !== undefined && value !== null && value !== '');

    const normalizeLink = (value: any) => {
      if (!value) return undefined;
      if (typeof value === 'object') return value.rendered || value.url || value.href;
      return value;
    };

    const normalizeItems = (rawList: any[]) => {
      return rawList.map(item => {
        const id = (firstPresent(item.id, item.ID, item.db_id, item.object_id, item.key, item.node?.id) || Math.random().toString(36).substr(2, 9)).toString();
        const parent = (firstPresent(item.parent, item.menu_item_parent, item.parentId, item.meta?.menu_item_parent, item.node?.parentId) || 0).toString();
        const label = cleanLabel(item.title?.rendered || item.title || item.label || item.name || item.post_title || item.text || item.node?.title || 'Sem título');
        const link = normalizeLink(firstPresent(item.url, item.link, item.guid, item.href, item.node?.url)) || '#';
        const children = item.child_items || item.children || item.items || item.sub_items || item.nodes || item.edges || [];
        return { id, parent, label, link, children };
      });
    };

    const parseMenuHTML = (html: string): any[] => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const parseList = (root: Element): any[] => {
        const listItems = Array.from(root.children).filter(child => child.tagName === 'LI');

        if (listItems.length === 0) {
          return Array.from(root.querySelectorAll(':scope > a, :scope > .wp-block-navigation-item__content'))
            .map((a: any) => ({
              label: cleanLabel(a.querySelector?.('.wp-block-navigation-item__label')?.textContent || a.textContent || ''),
              link: a.getAttribute('href') || '#',
              children: []
            }))
            .filter(item => item.label);
        }

        return listItems.map((li: Element) => {
          const link = li.querySelector(':scope > a, :scope > .wp-block-navigation-item__content, :scope > div > a');
          const subList = li.querySelector(':scope > ul, :scope > ol, :scope > .wp-block-navigation__submenu-container, :scope > .sub-menu, :scope > div > ul');
          return {
            label: cleanLabel((link as HTMLElement)?.textContent || ''),
            link: (link as HTMLAnchorElement)?.getAttribute?.('href') || '#',
            children: subList ? parseList(subList) : []
          };
        }).filter(item => item.label);
      };

      // O endpoint /wp-json/wp/v2/navigation costuma devolver vários <li> irmãos
      // sem um <ul> raiz. Nessa situação, o menu correto é o body inteiro; se
      // deixarmos a pontuação escolher entre todos os <ul>, ela pode pegar sempre
      // apenas um submenu interno.
      const bodyHasDirectMenuItems = Array.from(doc.body.children).some(child => child.tagName === 'LI');
      if (bodyHasDirectMenuItems) {
        const bodyItems = parseList(doc.body);
        if (bodyItems.length > 0) return bodyItems;
      }

      // Em vez de pegar apenas a primeira lista (que costuma ser um subgrupo),
      // avaliamos TODOS os candidatos a container de menu e escolhemos o mais rico
      // (o que produz mais itens de topo + subitens). Esse é o mesmo princípio
      // de detecção usado nos itens que já funcionavam.
      const candidates = Array.from(
        doc.querySelectorAll(
          '#main-menu, .ha-navbar-nav, .elementor-nav-menu, .wp-block-navigation__container, nav ul, nav, ul[class*="menu"], ul[class*="nav"], ul, ol'
        )
      );

      const countDeep = (items: any[]): number =>
        items.reduce((acc, it) => acc + 1 + countDeep(it.children || []), 0);

      const hasMenuSignal = (element: Element): boolean => {
        const signature = `${element.id || ''} ${element.className || ''} ${element.getAttribute('role') || ''}`.toLowerCase();
        return /main-menu|nav|navbar|navigation|menu/.test(signature);
      };

      const isNestedSubmenuCandidate = (element: Element): boolean => {
        const tokens = Array.from(element.classList || []).map(token => token.toLowerCase());
        return tokens.some(token =>
          token === 'sub-menu' ||
          token === 'submenu' ||
          token === 'dropdown' ||
          token === 'children' ||
          token.includes('__submenu') ||
          token.includes('submenu-panel') ||
          token.includes('dropdown-menu') ||
          token.includes('wp-block-navigation-submenu')
        );
      };

      let best: any[] = [];
      let bestScore = -1;
      for (const candidate of candidates) {
        if (isNestedSubmenuCandidate(candidate)) continue;
        const parsed = parseList(candidate);
        const submenuScore = countSubmenuItems(parsed);
        const directScore = parsed.length;
        const signalScore = hasMenuSignal(candidate) ? 1000 : 0;
        const nestedPenalty = candidate.closest('li') ? 300 : 0;
        const submenuBonus = submenuScore > 0 ? 50 : 0;
        const score = signalScore + (directScore * 25) + (countDeep(parsed) * 2) + submenuBonus - nestedPenalty;
        // Priorizamos containers com assinatura clara de menu e submenus reais,
        // evitando aceitar uma lista de páginas/posts como se fosse navegação.
        if (score > bestScore) {
          bestScore = score;
          best = parsed;
        }
      }

      return best.length ? best : parseList(doc.body);
    };

    const buildTree = (flatItems: any[]) => {
      const normalized = normalizeItems(flatItems);

      // Caso os dados já venham aninhados (ex.: campo child_items dos plugins de menu),
      // preservamos a hierarquia recursivamente em vez de achatar tudo.
      const hasNested = normalized.some(i => Array.isArray(i.children) && i.children.length > 0);

      if (hasNested) {
        const ids = new Set(normalized.map(i => i.id));
        const rootItems = normalized.filter(i => i.parent === "0" || i.parent === "" || !ids.has(i.parent));
        const mapNested = (list: any[]): any[] => normalizeItems(list).map(i => ({
          ...i,
          children: Array.isArray(i.children) && i.children.length > 0 ? mapNested(i.children) : []
        }));
        return mapNested(rootItems.length > 0 ? rootItems : normalized);
      }

      const itemMap = new Map();
      const tree: any[] = [];
      normalized.forEach(item => itemMap.set(item.id, { ...item, children: [] }));
      normalized.forEach(item => {
        const node = itemMap.get(item.id);
        const pId = item.parent;
        const parentNode = itemMap.get(pId);
        if (pId !== "0" && pId !== "" && parentNode && pId !== item.id) {
          parentNode.children.push(node);
        } else {
          tree.push(node);
        }
      });
      return tree.length > 0 ? tree : normalized;
    };

    let itemsSource = data;
    if (!Array.isArray(data)) {
      itemsSource = data.items || data.children || data.menu_items || data.data || data.nodes || data.edges || [data];
    }

      if (Array.isArray(itemsSource)) {
        const renderedMenus = itemsSource
          .map(item => item?.content?.rendered)
          .filter((html): html is string => typeof html === 'string' && /<\s*(li|ul|nav|a)\b/i.test(html));
        if (renderedMenus.length > 0) {
          return renderedMenus.flatMap(html => parseMenuHTML(html));
      }
      return buildTree(itemsSource);
    }
    return [];
  };

  const countSubmenuItems = (items: any[]): number => {
    return items.reduce((total, item) => {
      const children = Array.isArray(item.children) ? item.children : [];
      return total + children.length + countSubmenuItems(children);
    }, 0);
  };

  const syncWithSystemMenu = () => {
    setMenuConfig({
      ...menuConfig,
      items: navItems.map(item => ({ label: item.label, link: item.to }))
    });
    toast({
      title: "Menu Sincronizado",
      description: "Os itens foram carregados apenas para referência no construtor.",
    });
  };


  // Função para copiar o código
  const handleCopyCode = (codeText: string) => {
    navigator.clipboard.writeText(codeText);
    setCopied(true);
    toast({
      title: "Código copiado!",
      description: "O código do widget foi copiado para sua área de transferência.",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  // ==========================================
  // GERADORES DE CÓDIGO CRU (ANTI-ADBLOCK)
  // ==========================================

  const generateWhatsappCode = () => {
    const css = `<style>
  .custom-wa-widget-9982 {
    position: fixed;
    bottom: 24px;
    ${whatsappConfig.position}: 24px;
    background-color: ${whatsappConfig.bgColor};
    color: ${whatsappConfig.textColor};
    padding: 12px 20px;
    border-radius: ${whatsappConfig.borderRadius}px;
    text-decoration: none;
    font-family: system-ui, -apple-system, sans-serif;
    display: flex;
    align-items: center;
    gap: 10px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 999999;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    font-weight: 500;
    font-size: 15px;
  }
  .custom-wa-widget-9982:hover {
    transform: translateY(-3px);
    box-shadow: 0 6px 16px rgba(0,0,0,0.2);
  }
  .custom-wa-widget-9982 svg {
    width: 24px;
    height: 24px;
    fill: currentColor;
  }
</style>`;

    const html = `
<!-- Início: Widget WhatsApp Nativo -->
<a href="https://wa.me/${whatsappConfig.phone.replace(/\D/g, '')}" target="_blank" rel="noopener noreferrer" class="custom-wa-widget-9982">
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.82 9.82 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
  </svg>
  <span>${whatsappConfig.text}</span>
</a>
<!-- Fim: Widget WhatsApp Nativo -->`;

    return css + "\n" + html;
  };

  const generateBannerCode = () => {
    const css = `<style>
  .custom-top-banner-773 {
    width: 100%;
    background-color: ${bannerConfig.bgColor};
    color: ${bannerConfig.textColor};
    text-align: center;
    padding: 12px 20px;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 14px;
    position: relative;
    box-sizing: border-box;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 16px;
    z-index: 999998;
  }
  .custom-top-banner-773 a {
    color: inherit;
    font-weight: bold;
    text-decoration: underline;
  }
  .custom-top-banner-773 .close-btn {
    position: absolute;
    right: 16px;
    background: transparent;
    border: none;
    color: inherit;
    cursor: pointer;
    font-size: 20px;
    opacity: 0.8;
  }
  .custom-top-banner-773 .close-btn:hover { opacity: 1; }
</style>`;

    const script = bannerConfig.isDismissible ? `
<script>
  function closeCustomBanner(el) {
    el.closest('.custom-top-banner-773').style.display = 'none';
  }
</script>` : '';

    const html = `
<!-- Início: Top Banner Nativo -->
<div class="custom-top-banner-773">
  <span>${bannerConfig.message}</span>
  ${bannerConfig.link ? `<a href="${bannerConfig.link}">Saiba mais</a>` : ''}
  ${bannerConfig.isDismissible ? `<button class="close-btn" onclick="closeCustomBanner(this)" aria-label="Fechar">&times;</button>` : ''}
</div>
<!-- Fim: Top Banner Nativo -->`;

    return css + "\n" + html + "\n" + script;
  };

  const generateMenuCode = () => {
    const activeRadiusDesktop = ((menuConfig.activeRadius ?? 0) / 100 * 2.5).toFixed(3);
    const activeRadiusTablet = ((menuConfig.activeRadiusTablet ?? menuConfig.activeRadius ?? 0) / 100 * 2.5).toFixed(3);
    const activeRadiusMobile = ((menuConfig.activeRadiusMobile ?? menuConfig.activeRadius ?? 0) / 100 * 2.5).toFixed(3);
    const itemRadiusDesktop = ((menuConfig.itemRadius ?? 0) / 100 * 2.5).toFixed(3);
    const itemRadiusTablet = ((menuConfig.itemRadiusTablet ?? menuConfig.itemRadius ?? 0) / 100 * 2.5).toFixed(3);
    const itemRadiusMobile = ((menuConfig.itemRadiusMobile ?? menuConfig.itemRadius ?? 0) / 100 * 2.5).toFixed(3);
    const submenuPanelRadiusDesktop = activeRadiusDesktop;
    const submenuPanelRadiusTablet = activeRadiusTablet;
    const submenuPanelRadiusMobile = activeRadiusMobile;
    const submenuGapDesktop = Math.max(0, Number(menuConfig.submenuGap ?? 0));
    const submenuGapTablet = Math.max(0, Number(menuConfig.submenuGapTablet ?? menuConfig.submenuGap ?? 0));
    const submenuGapMobile = Math.max(0, Number(menuConfig.submenuGapMobile ?? menuConfig.submenuGap ?? 0));
    const submenuItemSpacingDesktop = Math.max(0, Number(menuConfig.submenuItemSpacing ?? 4));
    const submenuItemSpacingTablet = Math.max(0, Number(menuConfig.submenuItemSpacingTablet ?? menuConfig.submenuItemSpacing ?? 4));
    const submenuItemSpacingMobile = Math.max(0, Number(menuConfig.submenuItemSpacingMobile ?? menuConfig.submenuItemSpacing ?? 4));
    const shadowSize = Math.max(0, Number(menuConfig.shadowSize ?? 28));
    const shadowIntensity = Math.min(100, Math.max(0, Number(menuConfig.shadowIntensity ?? 22)));
    const menuShadow = (shadowSize === 0 || shadowIntensity === 0)
      ? 'none'
      : `0 ${Math.round(shadowSize * 0.5)}px ${shadowSize}px rgba(0,0,0,${(shadowIntensity / 100).toFixed(3)})`;
    const activeAnimSeconds = Math.max(0, Number(menuConfig.activeAnimDuration ?? 3));
    const tabletHamburger = (menuConfig.tabletMenuMode ?? 'header') === 'hamburger';
    const tabletStackMetrics = {
      activeRadius: activeRadiusTablet,
      itemRadius: itemRadiusTablet,
      submenuPanelRadius: submenuPanelRadiusTablet,
      submenuGap: submenuGapTablet,
      submenuItemSpacing: submenuItemSpacingTablet,
    };
    const mobileRules = (
      p: string,
      metric: {
        activeRadius: string;
        itemRadius: string;
        submenuPanelRadius: string;
        submenuGap: number;
        submenuItemSpacing: number;
      } = {
        activeRadius: activeRadiusMobile,
        itemRadius: itemRadiusMobile,
        submenuPanelRadius: submenuPanelRadiusMobile,
        submenuGap: submenuGapMobile,
        submenuItemSpacing: submenuItemSpacingMobile,
      }
    ) => `
    ${p} {
      padding: 0 14px;
      min-height: 60px;
    }
    ${p} .logo img {
      height: 34px;
      max-width: 140px;
    }
    ${p} .logo .logo-svg {
      height: 34px;
      width: 140px;
      max-width: 140px;
    }
    ${menuConfig.logoUrlMobile ? `${p} .logo .logo-desktop { display: none; } ${p} .logo .logo-mobile { display: block; }` : ''}
    ${p} .mobile-toggle {
      display: flex;
      align-items: center;
      justify-content: center;
      order: 3;
    }
    ${p} .logo { order: 1; margin-right: auto; }
    ${p} .nav-search { display: none !important; }
    ${p} .search-toggle { display: flex !important; order: 2; margin-right: 8px; }
    ${p} .menu-items {
      position: absolute;
      top: calc(100% + ${metric.submenuGap}px);
      left: 14px;
      width: calc(100% - 28px);
      background-color: ${menuConfig.bgColor};
      flex-direction: column;
      align-items: stretch;
      padding: 0 8px;
      gap: 0;
      box-shadow: none;
      border: 1px solid transparent;
      border-radius: ${metric.activeRadius}em;
      max-height: 0;
      overflow: hidden;
      opacity: 0;
      transform: translateY(-8px);
      pointer-events: none;
      transition: max-height 0.35s ease, opacity 0.25s ease, transform 0.25s ease, padding 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
      z-index: 999998;
    }
    ${p} .menu-items.active {
      max-height: 2000px;
      padding: 8px;
      box-shadow: ${menuShadow};
      border-color: rgba(0,0,0,0.08);
      overflow: visible;
      opacity: 1;
      transform: translateY(0);
      pointer-events: auto;
    }
    ${p} .menu-items a {
      display: flex;
      align-items: center;
      width: 100%;
      padding: 14px 22px;
      border-radius: ${metric.itemRadius}em;
      font-size: 15.5px;
       border: ${menuConfig.activeBorderWidth}px solid transparent;
       box-shadow: none !important;
       justify-content: space-between;
       white-space: nowrap !important;
       word-break: keep-all !important;
       overflow-wrap: normal !important;
       overflow: hidden !important;
       text-overflow: ellipsis !important;
       opacity: 0.8;
       transition: color ${activeAnimSeconds}s ease, background-color ${activeAnimSeconds}s ease, border-color ${activeAnimSeconds}s ease, opacity ${activeAnimSeconds}s ease;
    }
    ${p} .menu-items > .has-submenu:last-child > a,
     ${p} .menu-items > a:last-child { border-bottom-color: transparent; }
    ${p} .menu-items .has-submenu {
      flex-direction: column;
      align-items: stretch !important;
    }
    ${p} .menu-items .has-submenu > a {
      width: 100%;
    }
    ${p} .submenu {
      position: static !important;
      width: calc(100% - 12px) !important;
      margin: 0 0 0 12px !important;
      box-shadow: none !important;
      border-radius: 0 !important;
      padding: 0 0 0 6px !important;
      background-color: transparent !important;
      border: none !important;
      border-left: 2px solid rgba(0,0,0,0.08) !important;
      display: flex !important;
      flex-direction: column !important;
      gap: ${metric.submenuItemSpacing}px !important;
      opacity: 0 !important;
      visibility: hidden !important;
      max-height: 0 !important;
      overflow: hidden !important;
      transform: none !important;
      transition: max-height 0.32s cubic-bezier(.2,.8,.2,1), opacity 0.25s ease, margin-top 0.25s ease, padding 0.25s ease, visibility 0.25s ease;
    }
    ${p} .has-submenu.open > .submenu {
      opacity: 1 !important;
      visibility: visible !important;
      max-height: 1500px !important;
      margin: ${metric.submenuGap}px 0 8px 12px !important;
      padding: 4px 0 4px 6px !important;
      border-left-color: ${menuConfig.activeBorderColor} !important;
    }
    ${p} .has-submenu.open > a::after {
      transform: rotate(180deg);
    }
    ${p} .has-submenu.open > a {
      color: ${menuConfig.activeTextColor} !important;
      background-color: ${menuConfig.activeBgColor === 'transparent' ? 'rgba(0,0,0,0.05)' : menuConfig.activeBgColor} !important;
      border-radius: ${metric.activeRadius}em !important;
    }
    ${p} .submenu a {
      padding: 10px 16px !important;
      font-size: 14.5px !important;
      border-radius: ${metric.itemRadius}em !important;
      justify-content: flex-start !important;
      border-bottom: none !important;
      white-space: nowrap !important;
      word-break: keep-all !important;
      overflow-wrap: normal !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
    }
    ${p} .menu-items a.active {
      border-color: ${menuConfig.activeBorderColor} !important;
      color: ${menuConfig.activeTextColor};
      opacity: 1;
      background-color: ${menuConfig.activeBgColor === 'transparent' ? 'rgba(0,0,0,0.05)' : menuConfig.activeBgColor};
      box-shadow: none !important;
      border-radius: ${metric.activeRadius}em !important;
    }`;

    const css = `<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@100..900&family=Montserrat:ital,wght@0,100..900;1,100..900&family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&family=Roboto:ital,wght@0,100..900;1,100..900&display=swap');
  .custom-nav-992 {
    width: 100%;
    background-color: ${menuConfig.bgColor};
    color: ${menuConfig.textColor};
    padding: 0 20px;
    min-height: 70px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-family: ${menuConfig.fontFamily};
    font-weight: ${menuConfig.fontWeight ?? '400'};
    font-style: ${menuConfig.fontStyle ?? 'normal'};
    box-shadow: 0 2px 10px rgba(0,0,0,0.05);
    position: ${menuConfig.sticky ? 'sticky' : 'relative'};
    top: 0;
    z-index: 999999;
    box-sizing: border-box;
    transition: all 0.3s ease;
  }
  .custom-nav-992 .logo img {
    height: 40px;
    max-width: 180px;
    width: auto;
    object-fit: contain;
    object-position: left center;
    display: block;
  }
  .custom-nav-992 .logo .logo-svg {
    height: 40px;
    width: 180px;
    max-width: 180px;
    display: block;
    transition: background-color 0.25s ease;
  }
  .custom-nav-992 .logo a:hover .logo-svg {
    background-color: ${menuConfig.hoverTextColor} !important;
  }
  .custom-nav-992 .logo .logo-mobile { display: none; }
  .custom-nav-992 .logo .logo-desktop { display: block; }
   .custom-nav-992 .menu-items {
     display: flex;
     flex-wrap: nowrap;
     gap: ${menuConfig.itemSpacing}px;
     align-items: center;
     align-self: stretch;
     justify-content: center;
     flex: 1 1 0;
     min-width: 0;
     white-space: nowrap !important;
     flex-wrap: nowrap !important;
     list-style: none !important;
     margin: 0 !important;
     padding: 0 !important;
   }
  .custom-nav-992 .nav-search {
    display: flex;
    align-items: center;
    background: ${menuConfig.searchBgColor};
    border-radius: ${(menuConfig.searchRadius/100*2.5).toFixed(3)}em;
    padding: 6px 12px;
    gap: 6px;
    flex-shrink: 0;
  }
  .custom-nav-992 .nav-search input {
    border: none;
    outline: none;
    background: transparent;
    color: ${menuConfig.searchIconColor};
    font-size: 14px;
    width: 130px;
  }
  .custom-nav-992 .nav-search svg {
    width: ${menuConfig.searchIconSize}px !important;
    height: ${menuConfig.searchIconSize}px !important;
    min-width: ${menuConfig.searchIconSize}px;
    min-height: ${menuConfig.searchIconSize}px;
    flex-shrink: 0;
    opacity: 0.7;
    fill: ${menuConfig.searchIconColor};
  }
  .custom-nav-992 .search-toggle {
    display: none;
    align-items: center;
    justify-content: center;
    width: ${menuConfig.toggleSize}px;
    height: ${menuConfig.toggleSize}px;
    border: none;
    border-radius: ${(menuConfig.searchRadius/100*2.5).toFixed(3)}em;
    background: ${menuConfig.searchBgColor};
    color: ${menuConfig.searchIconColor};
    cursor: pointer;
    flex-shrink: 0;
    transition: transform 0.2s ease, background 0.2s ease;
  }
  .custom-nav-992 .search-toggle:hover { transform: scale(1.08); filter: brightness(0.92); }
  .custom-nav-992 .search-toggle svg { width: ${menuConfig.searchIconSize + 2}px !important; height: ${menuConfig.searchIconSize + 2}px !important; min-width: ${menuConfig.searchIconSize + 2}px; min-height: ${menuConfig.searchIconSize + 2}px; flex-shrink: 0; fill: ${menuConfig.searchIconColor}; }
  .custom-spotlight-9982 {
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    display: flex;
    align-items: ${menuConfig.spotlightAlign === 'center' ? 'center' : menuConfig.spotlightAlign === 'bottom' ? 'flex-end' : 'flex-start'};
    justify-content: center;
    padding-left: ${menuConfig.spotlightPaddingX}px;
    padding-right: ${menuConfig.spotlightPaddingX}px;
    padding-top: ${menuConfig.spotlightAlign === 'top' ? '18vh' : '0'};
    padding-bottom: ${menuConfig.spotlightAlign === 'bottom' ? '18vh' : '0'};
    background: rgba(0,0,0,0.4);
    -webkit-backdrop-filter: blur(6px);
    backdrop-filter: blur(6px);
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.25s ease, visibility 0.25s ease;
  }
  .custom-spotlight-9982.open { opacity: 1; visibility: visible; }
  .custom-spotlight-9982 .spotlight-box {
    width: min(92vw, 600px);
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 20px;
    background: ${menuConfig.bgColor};
    color: ${menuConfig.textColor};
    border-radius: ${(menuConfig.spotlightRadius/100*2.5).toFixed(3)}em;
    box-shadow: 0 24px 60px rgba(0,0,0,0.3);
    transform: translateY(-20px) scale(0.97);
    transition: transform 0.28s cubic-bezier(.2,.8,.2,1);
  }
  .custom-spotlight-9982.open .spotlight-box { transform: translateY(0) scale(1); }
  .custom-spotlight-9982 svg { width: 22px !important; height: 22px !important; min-width: 22px; min-height: 22px; opacity: 0.5; fill: currentColor; flex-shrink: 0; }
  .custom-spotlight-9982 input { flex: 1; border: none; outline: none; background: transparent; font-size: 18px; color: inherit; }

   .custom-nav-992 .menu-items a {
     color: inherit;
     text-decoration: none !important;
     font-size: ${menuConfig.fontSize}px;
     font-weight: 500;
     padding: 10px ${menuConfig.itemPadding}px;
     border-radius: ${itemRadiusDesktop}em;
      border: ${menuConfig.activeBorderWidth}px solid transparent;
      box-shadow: none !important;
      transition: color ${activeAnimSeconds}s ease, background-color ${activeAnimSeconds}s ease, border-color ${activeAnimSeconds}s ease, opacity ${activeAnimSeconds}s ease;
     opacity: 0.8;
     white-space: nowrap !important;
     word-break: keep-all !important;
     overflow-wrap: normal !important;
     position: relative;
     display: flex;
     align-items: center;
     justify-content: space-between;
     gap: 6px;
     box-sizing: border-box;
     flex-shrink: 1;
     min-width: 0;
     overflow: hidden;
     text-overflow: ellipsis;
     line-height: 1.2 !important;
   }
  .custom-nav-992 .menu-items > a:hover,
  .custom-nav-992 .menu-items > .has-submenu > a:hover {
    color: ${menuConfig.hoverTextColor};
    background-color: ${menuConfig.hoverBgColor};
    opacity: 1;
      border-radius: ${itemRadiusDesktop}em;
  }
    /* A transição de estado anterior -> ativo é feita pela transition do link. */

   .custom-nav-992 .menu-items > a.active,
   .custom-nav-992 .menu-items > .has-submenu > a.active {
     color: ${menuConfig.activeTextColor};
     opacity: 1;
     background-color: ${menuConfig.activeBgColor};
      border-color: ${menuConfig.activeBorderColor};
      box-shadow: none !important;
      border-radius: ${activeRadiusDesktop}em;
   }
   .custom-nav-992 .menu-items > a:not(.active):hover,
   .custom-nav-992 .menu-items > .has-submenu > a:not(.active):hover {
     color: ${menuConfig.hoverTextColor} !important;
     background-color: ${menuConfig.hoverBgColor} !important;
     border-color: ${menuConfig.hoverBorderColor} !important;
     /* border-width mantido igual ao estado base para evitar deslocamento dos itens no hover */
     box-shadow: none !important;
     opacity: 1 !important;
   }

  .custom-nav-992 .menu-items a:focus,
  .custom-nav-992 .menu-items a:focus-visible {
    outline: none;
  }
   .custom-nav-992 .menu-items .has-submenu {
     position: relative !important;
     display: flex;
     align-items: center;
     align-self: stretch;
     flex-shrink: 1;
     min-width: 0;
   }
  .custom-nav-992 .menu-items .has-submenu::before {
    content: "";
    position: absolute;
    left: 0;
    top: 100%;
    width: max(100%, 230px);
    height: ${submenuGapDesktop + 14}px;
    background: transparent;
    z-index: 2147483646;
  }
  .custom-nav-992 .menu-items .has-submenu > a::after {
    content: "";
    width: 0;
    height: 0;
    border-left: 4px solid transparent;
    border-right: 4px solid transparent;
    border-top: 4px solid currentColor;
    opacity: 0.5;
    transition: transform 0.2s ease;
  }
  .custom-nav-992 .submenu {
    position: absolute !important;
    top: calc(100% + ${submenuGapDesktop}px) !important;
    left: 0 !important;
    margin-top: 0 !important;
    background-color: ${menuConfig.bgColor} !important;
    box-shadow: ${menuShadow} !important;
    border-radius: ${submenuPanelRadiusDesktop}em !important;
    padding: 8px !important;
    display: flex !important;
    flex-direction: column !important;
    gap: ${submenuItemSpacingDesktop}px !important;
    min-width: 230px !important;
     max-width: min(92vw, 420px) !important;
    z-index: 2147483647 !important;
    list-style: none !important;
    margin-left: 0 !important;
    margin-right: 0 !important;
    border: 1px solid rgba(0,0,0,0.08) !important;
    overflow: hidden !important;
    transform-origin: top center;
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transform: translateY(-8px);
    clip-path: inset(0 -32px 100% -32px);
    transition: opacity 0.25s ease, transform 0.28s cubic-bezier(.2,.8,.2,1), clip-path 0.3s cubic-bezier(.2,.8,.2,1), visibility 0.25s ease;
  }
  .custom-nav-992 .has-submenu:hover > .submenu,
  .custom-nav-992 .has-submenu:focus-within > .submenu,
  .custom-nav-992 .has-submenu.open > .submenu {
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
    transform: translateY(0);
    clip-path: inset(0 -32px -32px -32px);
  }
  .custom-nav-992 .has-submenu:hover > a::after,
  .custom-nav-992 .has-submenu.open > a::after {
    transform: rotate(180deg);
  }
  .custom-nav-992 .has-submenu:hover > a,
  .custom-nav-992 .has-submenu:focus-within > a,
  .custom-nav-992 .has-submenu.open > a {
    color: ${menuConfig.activeTextColor} !important;
    background-color: ${menuConfig.activeBgColor === 'transparent' ? 'rgba(0,0,0,0.05)' : menuConfig.activeBgColor} !important;
    border-radius: ${activeRadiusDesktop}em !important;
    opacity: 1 !important;
  }
  .custom-nav-992 .submenu a {
    padding: 11px 16px !important;
    opacity: 0.9 !important;
    width: 100% !important;
    border-radius: ${itemRadiusDesktop}em !important;
    display: flex !important;
     align-items: center !important;
    text-align: left !important;
     white-space: nowrap !important;
     word-break: keep-all !important;
     overflow-wrap: normal !important;
     overflow: hidden !important;
     text-overflow: ellipsis !important;
     min-width: 0 !important;
    font-size: 14px !important;
    border-bottom: none !important;
  }
  .custom-nav-992 .submenu a:hover {
    background-color: ${menuConfig.hoverBgColor || 'rgba(0,0,0,0.04)'} !important;
    color: ${menuConfig.hoverTextColor || 'inherit'} !important;
    opacity: 1 !important;
  }
  .custom-nav-992 .mobile-toggle {
    display: none;
    align-items: center;
    justify-content: center;
    width: ${menuConfig.toggleSize}px;
    height: ${menuConfig.toggleSize}px;
    background: ${menuConfig.hamburgerBgColor};
    border: none;
    color: ${menuConfig.hamburgerColor};
    padding: 0;
    cursor: pointer;
    flex-shrink: 0;
    border-radius: ${(menuConfig.hamburgerRadius/100*2.5).toFixed(3)}em;
  }
  .custom-nav-992 .mobile-toggle:hover {
    filter: brightness(0.92);
  }
  .custom-nav-992 .mobile-toggle .bars {
    position: relative;
    width: ${menuConfig.hamburgerSize}px;
    height: ${(menuConfig.hamburgerSize * 0.75).toFixed(0)}px;
    display: block;
  }
  .custom-nav-992 .mobile-toggle .bars span {
    position: absolute;
    left: 0;
    width: 100%;
    height: 2.5px;
    border-radius: 2px;
    background-color: currentColor;
    transition: transform 0.3s ease, opacity 0.25s ease, top 0.3s ease;
  }
  .custom-nav-992 .mobile-toggle .bars span:nth-child(1) { top: 0; }
  .custom-nav-992 .mobile-toggle .bars span:nth-child(2) { top: ${((menuConfig.hamburgerSize*0.75 - 2.5)/2).toFixed(1)}px; }
  .custom-nav-992 .mobile-toggle .bars span:nth-child(3) { top: ${(menuConfig.hamburgerSize*0.75 - 2.5).toFixed(1)}px; }
  .custom-nav-992 .mobile-toggle.open .bars span:nth-child(1) { top: ${((menuConfig.hamburgerSize*0.75 - 2.5)/2).toFixed(1)}px; transform: rotate(45deg); }
  .custom-nav-992 .mobile-toggle.open .bars span:nth-child(2) { opacity: 0; }
  .custom-nav-992 .mobile-toggle.open .bars span:nth-child(3) { top: ${((menuConfig.hamburgerSize*0.75 - 2.5)/2).toFixed(1)}px; transform: rotate(-45deg); }

  
  /* ===== TABLET (1024px - 851px) ===== */
  @media (max-width: 1024px) and (min-width: 851px) {
    .custom-nav-992 {
      padding: 0 18px;
      min-height: 64px;
    }
    .custom-nav-992 .logo img {
      height: 36px;
      max-width: 150px;
    }
    .custom-nav-992 .logo .logo-svg {
      height: 36px;
      width: 150px;
      max-width: 150px;
    }
    ${menuConfig.logoUrlMobile ? `.custom-nav-992 .logo .logo-desktop { display: none; } .custom-nav-992 .logo .logo-mobile { display: block; }` : ''}
    ${tabletHamburger ? mobileRules('.custom-nav-992', tabletStackMetrics) : `
    .custom-nav-992 .menu-items {
      gap: 2px;
    }
    .custom-nav-992 .menu-items a {
      font-size: 13.5px;
      padding: 8px 10px;
      border-radius: ${itemRadiusTablet}em !important;
    }
    .custom-nav-992 .menu-items a.active {
      border-radius: ${activeRadiusTablet}em !important;
    }
    .custom-nav-992 .menu-items .has-submenu::before {
      height: ${submenuGapTablet + 14}px;
    }
    .custom-nav-992 .submenu {
      min-width: 200px !important;
      top: calc(100% + ${submenuGapTablet}px) !important;
      border-radius: ${submenuPanelRadiusTablet}em !important;
      gap: ${submenuItemSpacingTablet}px !important;
    }
    .custom-nav-992 .submenu a {
      border-radius: ${itemRadiusTablet}em !important;
    }
    .custom-nav-992 .has-submenu:hover > a,
    .custom-nav-992 .has-submenu:focus-within > a,
    .custom-nav-992 .has-submenu.open > a {
      border-radius: ${activeRadiusTablet}em !important;
    }
    `}
  }

  /* ===== MOBILE (<= 850px) ===== */
  @media (max-width: 850px) {
    ${mobileRules('.custom-nav-992')}
  }

  /* ===== AUTO-BREAK: quando itens não cabem (padding < 10px) ===== */
  ${mobileRules('.custom-nav-992.force-mobile')}
  ${tabletHamburger ? mobileRules('.custom-nav-992.force-tablet', tabletStackMetrics) : ''}
  @media (min-width: 851px) {
    .custom-nav-992.force-tablet .menu-items a {
      border-radius: ${itemRadiusTablet}em !important;
    }
    .custom-nav-992.force-tablet .menu-items a.active {
      border-radius: ${activeRadiusTablet}em !important;
    }
    .custom-nav-992.force-tablet .submenu {
      top: calc(100% + ${submenuGapTablet}px) !important;
      border-radius: ${submenuPanelRadiusTablet}em !important;
      gap: ${submenuItemSpacingTablet}px !important;
    }
    .custom-nav-992.force-tablet .submenu a {
      border-radius: ${itemRadiusTablet}em !important;
    }
    .custom-nav-992.force-tablet .has-submenu:hover > a,
    .custom-nav-992.force-tablet .has-submenu:focus-within > a,
    .custom-nav-992.force-tablet .has-submenu.open > a {
      border-radius: ${activeRadiusTablet}em !important;
    }
    .custom-nav-992.force-mobile .menu-items a {
      border-radius: ${itemRadiusMobile}em !important;
    }
    .custom-nav-992.force-mobile .menu-items a.active {
      border-radius: ${activeRadiusMobile}em !important;
    }
  }

  /* Garantia visual final: o ativo NUNCA usa sombra/linha inferior.
     Ele é sempre somente fundo + borda uniforme, igual ao código exportado. */
  .custom-nav-992 .menu-items a.active,
  .custom-nav-992 .menu-items a.active:hover,
  .custom-nav-992 .menu-items a.active:focus,
  .custom-nav-992 .menu-items a.active:focus-visible,
  .custom-nav-992 .has-submenu:hover > a.active,
  .custom-nav-992 .has-submenu:focus-within > a.active,
  .custom-nav-992 .has-submenu.open > a.active {
    border: ${menuConfig.activeBorderWidth}px solid ${menuConfig.activeBorderColor} !important;
    border-block: ${menuConfig.activeBorderWidth}px solid ${menuConfig.activeBorderColor} !important;
    border-inline: ${menuConfig.activeBorderWidth}px solid ${menuConfig.activeBorderColor} !important;
    box-shadow: none !important;
    outline: none !important;
    text-decoration: none !important;
    text-shadow: none !important;
    filter: none !important;
    background-image: none !important;
    background-color: ${menuConfig.activeBgColor === 'transparent' ? 'rgba(0,0,0,0.05)' : menuConfig.activeBgColor} !important;
    color: ${menuConfig.activeTextColor} !important;
    opacity: 1 !important;
    background-clip: padding-box !important;
  }

  .custom-nav-992 .menu-items > a.active::before,
  .custom-nav-992 .submenu a.active::before,
  .custom-nav-992 .menu-items > a.active::after,
  .custom-nav-992 .submenu a.active::after {
    content: none !important;
    display: none !important;
  }
</style>`;

    let fetchScript = `
    async function initializeMenuDetection() {
      const menuContainer = document.querySelector('.custom-nav-992 .menu-items');
      if (!menuContainer) return;

      console.log('Iniciando detecção de menu...');

      function renderItems(list) {
        if (!Array.isArray(list)) return '';
        let html = '';
        list.forEach(item => {
          if (!item) return;

          let title = item.title?.rendered || item.title || item.label || item.name || item.post_title || item.text || '';
          if (!title || title.trim() === '') return;
          
          const children = item.child_items || item.children || item.items || item.sub_items || [];
          const link = item.url || item.link || item.guid || item.href || '#';
          const activePaths = item.activePaths || item.active_paths || '';
          const apAttr = activePaths ? \` data-active-paths="\${String(activePaths).replace(/"/g, '&quot;')}"\` : '';

          if (children && children.length > 0) {
            html += \`<div class="has-submenu">
              <a href="\${link}"\${apAttr}>\${title}</a>
              <ul class="submenu">\${renderItems(children)}</ul>
            </div>\`;
          } else {
            html += \`<a href="\${link}"\${apAttr}>\${title}</a>\`;
          }

        });
        return html;
      }

      const wpApiUrl = '${menuConfig.wpApiUrl}';
      const enableAutoDetect = ${menuConfig.enableAutoDetect};
      if (wpApiUrl && wpApiUrl.length > 10) {
        try {
          console.log('Buscando via WP API:', wpApiUrl);
          const response = await fetch(wpApiUrl);
          if (response.ok) {
            let data = await response.json();

            // Se o endpoint for a LISTA de menus (sem itens), busca o detalhe com os child_items.
            try {
              const isMenuList = Array.isArray(data) && data.length > 0 && data[0]
                && (data[0].term_id || data[0].ID || data[0].id)
                && !data[0].url && !data[0].items && !data[0].child_items;
              if (isMenuList && wpApiUrl.indexOf('/wp-json/menus/v1/menus') !== -1) {
                const best = data.slice().sort((a, b) => (b.count || 0) - (a.count || 0))[0];
                const menuId = best.term_id || best.ID || best.id;
                const base = new URL(wpApiUrl).origin;
                const detailRes = await fetch(base + '/wp-json/menus/v1/menus/' + menuId);
                if (detailRes.ok) { data = await detailRes.json(); }
              }
            } catch (e) {}
            
            
            function buildTree(flatItems) {
              const firstPresent = (...values) => values.find(value => value !== undefined && value !== null && value !== '');
              const normalizeLink = (value) => {
                if (!value) return undefined;
                if (typeof value === 'object') return value.rendered || value.url || value.href;
                return value;
              };
              const normalize = (items) => items.map(item => ({
                id: (firstPresent(item.id, item.ID, item.db_id, item.object_id, item.key, item.node?.id) || Math.random().toString(36).substr(2, 9)).toString(),
                parent: (firstPresent(item.parent, item.menu_item_parent, item.parentId, item.meta?.menu_item_parent, item.node?.parentId) || 0).toString(),
                title: (item.title?.rendered || item.title || item.label || item.name || item.post_title || item.text || item.node?.title || 'Sem título').toString(),
                link: normalizeLink(firstPresent(item.url, item.link, item.guid, item.href, item.node?.url)) || '#',
                children: item.child_items || item.children || item.items || item.sub_items || []
              }));

              const normalized = normalize(flatItems);
              const itemMap = new Map();
              const tree = [];

              normalized.forEach(item => {
                itemMap.set(item.id, { ...item, children: [] });
              });

              normalized.forEach(item => {
                const node = itemMap.get(item.id);
                const parentNode = itemMap.get(item.parent);
                if (item.parent !== "0" && parentNode) {
                  parentNode.children.push(node);
                } else {
                  tree.push(node);
                }
              });

              return tree.length > 0 ? tree : normalized;
            }

            function extractItems(source) {
              if (!source) return [];
              console.log('Widget: Analisando fonte de dados:', source);
              const firstPresent = (...values) => values.find(value => value !== undefined && value !== null && value !== '');
              const normalizeLink = (value) => {
                if (!value) return undefined;
                if (typeof value === 'object') return value.rendered || value.url || value.href;
                return value;
              };
              
              function fromHTML(html) {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = html;

                function parseList(root) {
                  const listItems = Array.from(root.children || []).filter(child => child.tagName === 'LI');
                  if (listItems.length === 0) {
                    return Array.from(root.querySelectorAll(':scope > a, :scope > .wp-block-navigation-item__content'))
                      .map(a => ({
                        title: (a.querySelector?.('.wp-block-navigation-item__label')?.textContent || a.textContent || '').trim(),
                        link: a.getAttribute('href') || '#',
                        children: []
                      }))
                      .filter(i => i.title);
                  }

                  return listItems.map(li => {
                    const link = li.querySelector(':scope > a, :scope > .wp-block-navigation-item__content, :scope > div > a');
                    const subList = li.querySelector(':scope > ul, :scope > ol, :scope > .wp-block-navigation__submenu-container, :scope > .sub-menu, :scope > div > ul');
                    return {
                      title: (link?.querySelector?.('.wp-block-navigation-item__label')?.textContent || link?.textContent || '').trim(),
                      link: link?.getAttribute?.('href') || '#',
                      children: subList ? parseList(subList) : []
                    };
                  }).filter(i => i.title);
                }

                  const hasDirectMenuItems = Array.from(tempDiv.children || []).some(child => child.tagName === 'LI');
                  if (hasDirectMenuItems) {
                    const directItems = parseList(tempDiv);
                    if (directItems.length > 0) return directItems;
                  }

                const candidates = Array.from(
                  tempDiv.querySelectorAll('#main-menu, .ha-navbar-nav, .elementor-nav-menu, .wp-block-navigation__container, nav ul, nav, ul[class*="menu"], ul[class*="nav"], ul, ol')
                );
                function countDeep(items) {
                  return items.reduce((acc, it) => acc + 1 + countDeep(it.children || []), 0);
                }
                function countSubmenus(items) {
                  return items.reduce((acc, it) => acc + (it.children?.length || 0) + countSubmenus(it.children || []), 0);
                }
                function hasMenuSignal(element) {
                  const signature = ((element.id || '') + ' ' + (element.className || '') + ' ' + (element.getAttribute?.('role') || '')).toLowerCase();
                  return /main-menu|nav|navbar|navigation|menu/.test(signature);
                }
                  function isNestedSubmenuCandidate(element) {
                    const tokens = Array.from(element.classList || []).map(token => token.toLowerCase());
                    return tokens.some(token => token === 'sub-menu' || token === 'submenu' || token === 'dropdown' || token === 'children' || token.includes('__submenu') || token.includes('submenu-panel') || token.includes('dropdown-menu') || token.includes('wp-block-navigation-submenu'));
                  }
                let best = [], bestScore = -1;
                for (const candidate of candidates) {
                    if (isNestedSubmenuCandidate(candidate)) continue;
                  const parsed = parseList(candidate);
                  const nestedPenalty = candidate.closest('li') ? 300 : 0;
                  const submenuBonus = countSubmenus(parsed) > 0 ? 50 : 0;
                  const score = (hasMenuSignal(candidate) ? 1000 : 0) + (parsed.length * 25) + (countDeep(parsed) * 2) + submenuBonus - nestedPenalty;
                  if (score > bestScore) { bestScore = score; best = parsed; }
                }
                return best.length ? best : parseList(tempDiv);
              }

              let itemsSource = source;
              if (!Array.isArray(source)) {
                itemsSource = source.items || source.children || source.menu_items || source.data || source.nodes || source.edges || [source];
              }

              if (Array.isArray(itemsSource)) {
                const renderedMenus = itemsSource
                  .map(item => item?.content?.rendered)
                  .filter(html => typeof html === 'string' && /<\s*(li|ul|nav|a)\b/i.test(html));
                if (renderedMenus.length > 0) {
                  return renderedMenus.flatMap(html => fromHTML(html));
                }
                
                const hasParentRefs = itemsSource.some(item => 
                  (item.parent !== undefined && item.parent.toString() !== "0") || 
                  (item.menu_item_parent !== undefined && item.menu_item_parent.toString() !== "0") ||
                  (item.parentId !== undefined && item.parentId.toString() !== "0")
                );
                const hasNestedItems = itemsSource.some(item => {
                  const children = item.child_items || item.children || item.items || item.sub_items || item.nodes || item.edges || [];
                  return Array.isArray(children) && children.length > 0;
                });
                
                if (hasParentRefs && !hasNestedItems) return buildTree(itemsSource);
                if (hasParentRefs && hasNestedItems) {
                  const ids = new Set(itemsSource.map(item => (item.id || item.ID || item.db_id || item.object_id || item.key || item.node?.id || '').toString()).filter(Boolean));
                  itemsSource = itemsSource.filter(item => {
                    const parent = (firstPresent(item.parent, item.menu_item_parent, item.parentId, item.meta?.menu_item_parent, item.node?.parentId) || 0).toString();
                    return parent === '0' || parent === '' || !ids.has(parent);
                  });
                }
                
                return itemsSource.map(item => {
                  const title = item.title?.rendered || item.title || item.label || item.name || item.post_title || item.text || item.node?.title || 'Sem título';
                  const link = normalizeLink(firstPresent(item.url, item.link, item.guid, item.href, item.node?.url)) || '#';
                  const children = item.child_items || item.children || item.items || item.sub_items || item.nodes || item.edges || [];
                  return {
                    title,
                    link: link,
                    children: Array.isArray(children) && children.length > 0 ? extractItems(children) : []
                  };
                }).filter(i => i.title);
              }
              return [];
            }

            const items = extractItems(data);
            console.log('Widget: Itens extraídos:', items);

            const htmlContent = renderItems(items);
            if (htmlContent && htmlContent.trim().length > 5) {
              menuContainer.innerHTML = htmlContent;
              if (typeof highlightActiveLink === 'function') highlightActiveLink();
              return;
            }
          }
        } catch (e) { console.warn('WP API fail:', e.message); }
      }

      if (enableAutoDetect) {
        console.log('Tentando auto-detecção...');
        const selectors = [
          'nav', '.main-navigation', '.elementor-nav-menu', '.header-menu', '#site-navigation', 
          'ul[class*="menu"]', '.wp-block-navigation', '.navbar', '.nav-menu', '.navigation',
          '[role="navigation"]', 'header .links', '.header__nav', '#header-menu', '.menu-primary-container'
        ];
        const previewFrame = document.querySelector('iframe[title="Site Preview"]');
        let targetDoc = document;
        try {
          if (previewFrame && previewFrame.contentDocument) targetDoc = previewFrame.contentDocument;
          else if (previewFrame && previewFrame.contentWindow) targetDoc = previewFrame.contentWindow.document;
        } catch (e) { console.warn('CORS restrict'); }

        for (const selector of selectors) {
          const containers = targetDoc.querySelectorAll(selector);
          for (const container of containers) {
            function getDOMItems(el, depth = 0) {
              if (depth > 4) return [];
              const items = [];
              const listItems = Array.from(el.children).filter(child => child.tagName === 'LI');
              
              if (listItems.length === 0 && depth === 0) {
                const nestedUl = el.querySelector('ul');
                if (nestedUl) return getDOMItems(nestedUl, depth + 1);
              }

              if (listItems.length === 0 && depth === 0) {
                return Array.from(el.querySelectorAll('a'))
                  .filter(a => a.innerText.trim().length > 0)
                  .slice(0, 15)
                  .map(a => ({ title: a.innerText.trim(), link: a.href, children: [] }));
              }

              listItems.forEach(li => {
                const link = li.querySelector('a');
                if (link) {
                  const sub = li.querySelector('ul, [class*="sub-menu"], [class*="dropdown"]');
                  items.push({ 
                    title: (link.innerText || link.textContent || '').trim(), 
                    link: link.href, 
                    children: sub ? getDOMItems(sub, depth + 1) : [] 
                  });
                }
              });
              return items;
            }
            const items = getDOMItems(container);
            if (items.length >= 1) {
              const html = renderItems(items);
              if (html && html.trim().length > 5) {
                menuContainer.innerHTML = html;
                if (typeof highlightActiveLink === 'function') highlightActiveLink();
                return;
              }
            }
          }
        }
      }
      
      const manualItems = ${JSON.stringify(menuConfig.items)};
      if (manualItems && manualItems.length > 0) {
         console.log('Usando itens manuais:', manualItems);
         menuContainer.innerHTML = renderItems(manualItems);
         if (typeof highlightActiveLink === 'function') highlightActiveLink();
      }
    }
    setTimeout(initializeMenuDetection, 2500);`;

    const script = `
<script>
  function toggleCustomMenu(btn) {
    const items = document.querySelector('.custom-nav-992 .menu-items');
    const open = items.classList.toggle('active');
    const toggle = btn || document.querySelector('.custom-nav-992 .mobile-toggle');
    if (toggle) toggle.classList.toggle('open', open);
  }

  function openCustomSpotlight() {
    const sp = document.querySelector('.custom-spotlight-9982');
    if (!sp) return;
    sp.classList.add('open');
    const input = sp.querySelector('input');
    setTimeout(() => input && input.focus(), 120);
  }
  function closeCustomSpotlight() {
    const sp = document.querySelector('.custom-spotlight-9982');
    if (sp) sp.classList.remove('open');
  }
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeCustomSpotlight();
  });

  // Lógica para submenus no Mobile (clique)
  document.addEventListener('click', function(e) {
    const hasSubmenu = e.target.closest('.custom-nav-992 .has-submenu');
    const navEl = document.querySelector('.custom-nav-992');
    const isMobileMode = window.innerWidth <= 850 || (navEl && navEl.classList.contains('force-mobile')) || (${tabletHamburger} && ((window.innerWidth <= 1024 && window.innerWidth >= 851) || (navEl && navEl.classList.contains('force-tablet'))));
    if (isMobileMode) {
      const link = e.target.closest('.custom-nav-992 .menu-items a');
      // Se clicou na seta ou no item pai e ele tem submenu, toggle
      if (link && link.parentElement === hasSubmenu) {
        e.preventDefault();
        // Se já está aberto, apenas fecha
        if (hasSubmenu.classList.contains('open')) {
          hasSubmenu.classList.remove('open');
          return;
        }
        // Verifica se há outro submenu aberto para sequenciar a animação
        var openItems = document.querySelectorAll('.custom-nav-992 .has-submenu.open');
        var hadOpen = false;
        openItems.forEach(function(item) {
          if (item !== hasSubmenu) { item.classList.remove('open'); hadOpen = true; }
        });
        if (hadOpen) {
          // Fecha o anterior primeiro, depois abre o novo após a transição
          setTimeout(function() { hasSubmenu.classList.add('open'); }, 320);
        } else {
          hasSubmenu.classList.add('open');
        }
        return;
      }

      // Itens-folha (links reais do submenu) apenas navegam normalmente.
      // Não fechamos o submenu aqui para evitar o "colapso" visual antes da
      // navegação acontecer.
    }

  });

  function highlightActiveLink() {
    const normalizePath = (p) => {
      if (!p) return '/';
      try { p = decodeURIComponent(p); } catch (e) {}
      p = p.replace(/\\/+$/, '');
      return p === '' ? '/' : p;
    };
    const pathMatchesCurrent = (raw, currentPath) => {
      if (!raw || !raw.trim()) return false;
      let targetPath;
      try { targetPath = normalizePath(new URL(raw.trim(), window.location.origin).pathname); }
      catch (e) { return false; }
      return targetPath === currentPath;
    };
    const activateLink = (link) => {
      // Se já está ativo, nada a fazer (evita re-disparar a transição nas
      // chamadas repetidas de highlightActiveLink via setTimeout).
      if (link.classList.contains('active')) return;
      // Adia a adição da classe para DEPOIS do primeiro paint do estado base.
      // Assim o navegador anima a transição CSS (color/background/opacity) do
      // estado anterior para o ativo no código final — e não apenas na demo,
      // onde a classe é adicionada por clique (já após o paint inicial).
      requestAnimationFrame(() => requestAnimationFrame(() => {
        link.classList.add('active');
      }));
    };

    const currentPath = normalizePath(window.location.pathname);
    const links = document.querySelectorAll('.custom-nav-992 .menu-items a');
    const activeLinks = new Set();

    links.forEach(link => {
      const href = link.getAttribute('href');
      let isActive = false;

      // Caminhos extras de ativação (links filhos) definidos pelo usuário.
      const extra = link.getAttribute('data-active-paths');
      if (extra) {
        extra.split(',').forEach(raw => {
          if (isActive || !raw || !raw.trim()) return;
          if (pathMatchesCurrent(raw, currentPath)) isActive = true;
        });
      }

      // Comparação pelo href do próprio item.
      if (!isActive && href && href !== '#' && href.trim() !== '') {
        isActive = pathMatchesCurrent(href, currentPath);
      }

      if (!isActive) return;
      activeLinks.add(link);

      // Se o link ativo está dentro de um submenu, propaga o destaque para o(s)
      // item(ns) pai fixo(s) no cabeçalho (suporta submenus aninhados).
      let parentLi = link.closest('.submenu') ? link.closest('.submenu').closest('.has-submenu') : null;
      while (parentLi) {
        const parentLink = parentLi.querySelector(':scope > a');
        if (parentLink) activeLinks.add(parentLink);
        const outer = parentLi.parentElement ? parentLi.parentElement.closest('.has-submenu') : null;
        parentLi = outer;
      }
    });

    links.forEach(link => {
      if (activeLinks.has(link)) {
        activateLink(link);
        return;
      }
      const oldTimer = link.getAttribute('data-active-transition-timer');
      if (oldTimer) window.clearTimeout(Number(oldTimer));
      link.classList.remove('active', 'active-transitioning');
      link.removeAttribute('data-active-transition-timer');
      link.style.removeProperty('--nav-active-from-opacity');
    });

  }

  function checkMenuFit() {
    const nav = document.querySelector('.custom-nav-992');
    if (!nav) return;
    if (window.innerWidth <= 850) { nav.classList.remove('force-mobile'); return; }
    // Mede no modo desktop: se o conteúdo não couber (itens ficariam apertados), quebra para mobile.
    nav.classList.remove('force-mobile');
    if (nav.scrollWidth > nav.clientWidth + 1) {
      nav.classList.add('force-mobile');
    }
  }

  function initMenu() {
    highlightActiveLink();
    ${fetchScript}
    checkMenuFit();
    window.addEventListener('resize', checkMenuFit);
    // Recalcula após carregar fontes/imagens.
    window.addEventListener('load', checkMenuFit);
    setTimeout(checkMenuFit, 300);
    // Re-aplica o destaque após o carregamento assíncrono dos itens.
    setTimeout(highlightActiveLink, 1200);
    setTimeout(highlightActiveLink, 3000);

    // Clique em um item: marca como ativo imediatamente para o usuário ver a
    // estética do botão ativo (essencial na demo, onde href="#" não navega).
    document.addEventListener('click', (e) => {
      const link = e.target.closest && e.target.closest('.custom-nav-992 .menu-items a');
      if (!link) return;
      const all = document.querySelectorAll('.custom-nav-992 .menu-items a');
      all.forEach(a => a.classList.remove('active'));
      link.classList.add('active');
      // Propaga destaque para itens pai quando o clicado está num submenu.
      let parentLi = link.closest('.submenu') ? link.closest('.submenu').closest('.has-submenu') : null;
      while (parentLi) {
        const parentLink = parentLi.querySelector(':scope > a');
        if (parentLink) parentLink.classList.add('active');
        parentLi = parentLi.parentElement ? parentLi.parentElement.closest('.has-submenu') : null;
      }
    });

    // Fechar menu mobile ao clicar fora
    document.addEventListener('click', (e) => {
      const nav = document.querySelector('.custom-nav-992');
      const items = document.querySelector('.custom-nav-992 .menu-items');
      if (nav && !nav.contains(e.target) && items.classList.contains('active')) {
        items.classList.remove('active');
        nav.querySelectorAll('.has-submenu.open').forEach((item) => item.classList.remove('open'));
        const toggle = nav.querySelector('.mobile-toggle');
        if (toggle) toggle.classList.remove('open');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMenu);
  } else {
    initMenu();
  }
  window.addEventListener('popstate', highlightActiveLink);
</script>`;

    function renderHierarchicalItems(items) {
      if (!items || items.length === 0) return '';
      return items.map(item => {
        const hasChildren = item.children && item.children.length > 0;
        if (hasChildren) {
          const paths = Array.isArray(item.activePaths) ? item.activePaths.join(',') : (item.activePaths || item.active_paths || '');
          const activeAttr = paths ? ` data-active-paths="${String(paths).replace(/"/g, '&quot;')}"` : '';
          return `<div class="has-submenu">
            <a href="${item.link}"${activeAttr}>${item.label}</a>
            <ul class="submenu">
              ${renderHierarchicalItems(item.children)}
            </ul>
          </div>`;
        }
        const paths = Array.isArray(item.activePaths) ? item.activePaths.join(',') : (item.activePaths || item.active_paths || '');
        const activeAttr = paths ? ` data-active-paths="${String(paths).replace(/"/g, '&quot;')}"` : '';
        return `<a href="${item.link}"${activeAttr}>${item.label}</a>`;
      }).join('\n');
    }

    const isSvgUrl = (u: string) => /\.svg(\?|#|$)/i.test(u || '');
    const getLogoBaseColor = () => menuConfig.logoColor || menuConfig.textColor || '#000000';
    const svgLogoTag = (url: string, cls: string) => `<span class="${cls} logo-svg" role="img" aria-label="Logo" data-logo-color="${getLogoBaseColor()}" data-logo-hover="${menuConfig.hoverTextColor}" onmouseenter="this.style.backgroundColor=this.dataset.logoHover" onmouseleave="this.style.backgroundColor=this.dataset.logoColor" style="-webkit-mask:url('${url}') no-repeat left center / contain;mask:url('${url}') no-repeat left center / contain;background-color:${getLogoBaseColor()};"></span>`;
    const logoDesktopTag = isSvgUrl(menuConfig.logoUrl) ? svgLogoTag(menuConfig.logoUrl, 'logo-desktop') : `<img class="logo-desktop" src="${menuConfig.logoUrl}" alt="Logo">`;
    const logoMobileTag = menuConfig.logoUrlMobile ? (isSvgUrl(menuConfig.logoUrlMobile) ? svgLogoTag(menuConfig.logoUrlMobile, 'logo-mobile') : `<img class="logo-mobile" src="${menuConfig.logoUrlMobile}" alt="Logo">`) : '';
    const html = `
<!-- Início: Menu Responsivo Nativo -->
<nav class="custom-nav-992">
  <div class="logo">
    <a href="/">${logoDesktopTag}${logoMobileTag}</a>
  </div>
  <button class="mobile-toggle" onclick="toggleCustomMenu(this)" aria-label="Menu">
    <span class="bars"><span></span><span></span><span></span></span>
  </button>
  <div class="menu-items">
    ${menuConfig.items.length > 0 
      ? renderHierarchicalItems(menuConfig.items) // Force correct function call
      : '<!-- Aguardando carregamento... -->'
    }
  </div>
  ${menuConfig.searchEnabled ? `<form class="nav-search" role="search" method="get" action="${menuConfig.searchUrl}">
    <button type="submit" aria-label="Buscar" style="background:none;border:none;padding:0;cursor:pointer;color:inherit;display:flex;">
      <svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 5 1.49-1.49-5-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z"/></svg>
    </button>
    <input type="search" name="s" placeholder="Buscar..." aria-label="Buscar">
  </form>
  <button class="search-toggle" onclick="openCustomSpotlight()" aria-label="Buscar">
    <svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 5 1.49-1.49-5-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z"/></svg>
  </button>` : ''}
</nav>
${menuConfig.searchEnabled ? `<div class="custom-spotlight-9982" onclick="if(event.target===this)closeCustomSpotlight()">
  <form class="spotlight-box" role="search" method="get" action="${menuConfig.searchUrl}">
    <svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 5 1.49-1.49-5-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z"/></svg>
    <input type="search" name="s" placeholder="Buscar..." aria-label="Buscar">
  </form>
</div>` : ''}
<!-- Fim: Menu Responsivo Nativo -->`;

    return css + "\n" + html + "\n" + script;
  };


  // Sanitiza markup SVG colado pelo usuário antes de embutir no HTML gerado.
  // Remove <script>, handlers on*, e protocolos perigosos (javascript:).
  const sanitizeSvg = (raw?: string): string => {
    if (!raw || typeof raw !== 'string') return '';
    let s = raw.trim();
    const start = s.indexOf('<svg');
    if (start === -1) return '';
    const end = s.lastIndexOf('</svg>');
    if (end !== -1) s = s.slice(start, end + 6);
    else s = s.slice(start);
    s = s.replace(/<script[\s\S]*?<\/script>/gi, '');
    s = s.replace(/\son\w+\s*=\s*"[^"]*"/gi, '');
    s = s.replace(/\son\w+\s*=\s*'[^']*'/gi, '');
    s = s.replace(/(href|xlink:href)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '');
    // Force currentColor so the configured icon color applies (preserve fill/stroke="none")
    s = s.replace(/(fill|stroke)\s*=\s*("|')(?!none)(?!url\()[^"']*\2/gi, '$1="currentColor"');
    s = s.replace(/(fill|stroke)\s*:\s*(?!none)(?!url\()(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|[a-zA-Z]+)/g, '$1:currentColor');
    return s;
  };

  // Função utilitária para obter o código gerado
  const escapeHtmlJson = (value: any) =>
    JSON.stringify(value)
      .replace(/</g, '\\u003c')
      .replace(/>/g, '\\u003e')
      .replace(/&/g, '\\u0026')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029');

  const generateGatewayCode = () => {
    const lay = gatewayConfig.layout || 'top-center';
    // Valores responsivos: tablet/mobile herdam do desktop quando não definidos.
    const gcw = gatewayConfig.cardWidth ?? 176;
    const gch = gatewayConfig.cardHeight ?? 176;
    const gcr = gatewayConfig.cardRadius ?? 24;
    const gph = gatewayConfig.pillHeight ?? 24;
    const gpw = gatewayConfig.pillWidth ?? 0;
    const cardRespCss = (cw: number, chh: number, cr: number) =>
      `.nav-gateway-441 .ng-card { width: ${cw}px; height: ${chh}px; border-radius: ${cr}px; }`;
    const pillRespCss = (ph: number, pw: number) =>
      `.nav-gateway-441 .ng-pill { height: ${ph}px; ${pw ? `width: ${pw}px;` : 'width: auto;'} }`;
    const responsiveCss = `
  @media (max-width: 1024px) and (min-width: 641px) {
    ${cardRespCss(gatewayConfig.cardWidthTablet ?? gcw, gatewayConfig.cardHeightTablet ?? gch, gatewayConfig.cardRadiusTablet ?? gcr)}
    ${pillRespCss(gatewayConfig.pillHeightTablet ?? gph, gatewayConfig.pillWidthTablet ?? gpw)}
  }
  @media (max-width: 640px) {
    ${cardRespCss(gatewayConfig.cardWidthMobile ?? gcw, gatewayConfig.cardHeightMobile ?? gch, gatewayConfig.cardRadiusMobile ?? gcr)}
    ${pillRespCss(gatewayConfig.pillHeightMobile ?? gph, gatewayConfig.pillWidthMobile ?? gpw)}
  }`;
    const layoutCss = `
  .nav-gateway-441[data-layout="top-left"] .ng-inner { text-align: left; }
  .nav-gateway-441[data-layout="top-left"] .ng-grid { justify-content: flex-start; }
  .nav-gateway-441[data-layout="grid2"] .ng-grid { display: grid; grid-template-columns: repeat(2, max-content); justify-content: center; }
  .nav-gateway-441[data-layout="grid3"] .ng-grid { display: grid; grid-template-columns: repeat(3, max-content); justify-content: center; }
  .nav-gateway-441[data-layout="list"] .ng-grid { flex-direction: column; align-items: stretch; }
  .nav-gateway-441[data-layout="list"] .ng-col { width: 100%; }
  .nav-gateway-441[data-layout="list"] .ng-card { flex-direction: row; justify-content: flex-start; gap: 20px; width: 100%; height: auto; min-height: 88px; padding: 16px 24px; }
  .nav-gateway-441[data-layout="split"] { justify-content: flex-start; }
  .nav-gateway-441[data-layout="split"] .ng-inner { display: grid; grid-template-columns: 1fr 1.4fr; align-items: center; gap: 48px; text-align: left; max-width: 1100px; }
  .nav-gateway-441[data-layout="split"] .ng-sub { margin-bottom: 0; }
  .nav-gateway-441[data-layout="split"] .ng-grid { justify-content: flex-start; }
  .nav-gateway-441[data-layout="no-title"] h1, .nav-gateway-441[data-layout="no-title"] .ng-sub { display: none; }
  @media (max-width: 640px) {
    .nav-gateway-441[data-layout="grid2"] .ng-grid, .nav-gateway-441[data-layout="grid3"] .ng-grid { grid-template-columns: 1fr; }
    .nav-gateway-441[data-layout="split"] .ng-inner { grid-template-columns: 1fr; }
  }`;
    const css = `<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@100..900&family=Montserrat:ital,wght@0,100..900;1,100..900&family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&family=Roboto:ital,wght@0,100..900;1,100..900&display=swap');
  ${layoutCss}
  .nav-gateway-441 { position: relative; width: 100%; display: flex; align-items: center; justify-content: center; padding: 0; box-sizing: border-box; background: transparent; font-family: ${gatewayConfig.fontFamily ?? 'system-ui, -apple-system, sans-serif'}; font-weight: ${gatewayConfig.fontWeight ?? '400'}; font-style: ${gatewayConfig.fontStyle ?? 'normal'}; }
  .nav-gateway-441 .ng-inner { position: relative; z-index: 1; max-width: 900px; width: 100%; text-align: center; }
  .nav-gateway-441 h1 { color: ${gatewayConfig.titleColor}; font-size: 40px; font-weight: ${gatewayConfig.titleFontWeight ?? '800'}; margin: 0 0 12px;${fontRules(gatewayConfig.titleFont, gatewayConfig.titleFontWeight, gatewayConfig.titleFontStyle)} }
  .nav-gateway-441 .ng-sub { color: ${gatewayConfig.titleColor}; opacity: 0.8; font-size: 18px; margin: 0 0 48px;${fontRules(gatewayConfig.subtitleFont, gatewayConfig.subtitleFontWeight, gatewayConfig.subtitleFontStyle)} }
  .nav-gateway-441 .ng-grid { display: flex; flex-wrap: wrap; gap: 32px; justify-content: center; align-items: flex-start; }
  .nav-gateway-441 .ng-col { display: flex; flex-direction: column; align-items: center; gap: 12px; }
  .nav-gateway-441 .ng-card { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; width: ${gatewayConfig.cardWidth ?? 176}px; height: ${gatewayConfig.cardHeight ?? 176}px; background: ${gatewayConfig.cardBgColor ?? '#fff'}; border-radius: ${gatewayConfig.cardRadius ?? 24}px; box-shadow: 0 10px 15px -3px rgba(0,0,0,.1); text-decoration: none; transition: all .3s ease; }
  .nav-gateway-441 .ng-card:hover { box-shadow: 0 20px 25px -5px rgba(0,0,0,.25); }
  .nav-gateway-441 .ng-icon { font-size: 52px; line-height: 1; }
  .nav-gateway-441 .ng-svg-icon { position: relative; display: inline-block; width: 56px; height: 56px; }
  .nav-gateway-441 .ng-svg-layer { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; opacity: 0; transform: var(--ng-svg-out-transform, none); filter: var(--ng-svg-out-filter, none); transition: opacity var(--ng-svg-dur, 300ms) var(--ng-svg-ease, ease), transform var(--ng-svg-dur, 300ms) var(--ng-svg-ease, ease), filter var(--ng-svg-dur, 300ms) var(--ng-svg-ease, ease); will-change: opacity, transform, filter; }
   .nav-gateway-441 .ng-svg-layer svg { width: 100%; height: 100%; display: block; fill: currentColor; }
   .nav-gateway-441 .ng-svg-layer svg [fill]:not([fill="none"]) { fill: currentColor; }
   .nav-gateway-441 .ng-svg-layer svg [stroke]:not([stroke="none"]) { stroke: currentColor; }
   .nav-gateway-441 .ng-svg-icon .is-static { opacity: 1; transform: var(--ng-svg-in-transform, none); filter: var(--ng-svg-in-filter, none); }
   .nav-gateway-441 .ng-card:hover .ng-svg-icon.has-hover .is-static { opacity: 0; }
   .nav-gateway-441 .ng-card:hover .ng-svg-icon.has-hover .is-hover { opacity: 1; transform: var(--ng-svg-in-transform, none); filter: var(--ng-svg-in-filter, none); }
   .nav-gateway-441 .ng-svg-icon.has-active.is-clicked .is-static,
   .nav-gateway-441 .ng-svg-icon.has-active.is-clicked .is-hover { opacity: 0 !important; }
   .nav-gateway-441 .ng-svg-icon.has-active.is-clicked .is-active { opacity: 1 !important; transform: var(--ng-svg-in-transform, none) !important; filter: var(--ng-svg-in-filter, none) !important; }
  .nav-gateway-441 .ng-lottie { display: block; width: 56px; height: 56px; }
   .nav-gateway-441 .ng-label { font-size: 18px; font-weight: 700; color: #1e293b; transition: color .25s ease; }
   ${gatewayConfig.labelHoverFromIcon ? `.nav-gateway-441 .ng-card:hover .ng-label { color: var(--ng-lbl, inherit); }` : ''}
   .nav-gateway-441 .ng-pill { background: ${gatewayConfig.pillBgColor ?? 'rgba(255,255,255,.2)'}; color: ${gatewayConfig.pillTextColor ?? '#fff'}; font-size: 12px; font-weight: 500; padding: 0 16px; height: ${gatewayConfig.pillHeight ?? 24}px; ${gatewayConfig.pillWidth ? `width: ${gatewayConfig.pillWidth}px;` : ''} display: inline-flex; align-items: center; justify-content: center; border-radius: 9999px; }
  .nav-gateway-441 .ng-grid-spacer { display: none; }
  ${responsiveCss}
  @media (max-width: 640px) { .nav-gateway-441 .ng-grid { flex-direction: column; align-items: center; } .nav-gateway-441 h1 { font-size: 30px; } }${gatewayConfig.mobileFooterBar ? `
  @media (max-width: 640px) {
    .nav-gateway-441 { position: fixed; left: 0; right: 0; bottom: 0; z-index: 999990; width: 100%; padding: 6px 4px calc(6px + env(safe-area-inset-bottom)); background: #ffffff; box-shadow: 0 -6px 20px -8px rgba(0,0,0,.25); }
    .nav-gateway-441 .ng-inner { max-width: 100%; }
    .nav-gateway-441 h1, .nav-gateway-441 .ng-sub, .nav-gateway-441 .ng-pill { display: none; }
    .nav-gateway-441 .ng-grid { flex-direction: row !important; flex-wrap: nowrap; gap: 4px; justify-content: space-around; align-items: stretch; }
    .nav-gateway-441 .ng-col { flex: 1 1 0; gap: 4px; opacity: 1 !important; animation: none !important; }
    .nav-gateway-441 .ng-card { width: 100% !important; height: auto !important; min-height: 52px; gap: 4px !important; padding: 6px 2px; background: transparent !important; box-shadow: none !important; border-radius: 12px !important; }
    .nav-gateway-441 .ng-icon { font-size: 24px; }
    .nav-gateway-441 .ng-svg-icon, .nav-gateway-441 .ng-lottie { width: 26px; height: 26px; }
    .nav-gateway-441 .ng-label { font-size: 11px; font-weight: 600; }
  }` : ''}${gatewayConfig.entranceAnim && gatewayConfig.entranceAnim !== 'none' ? `
  @keyframes ng-fade { from { opacity: 0; } to { opacity: 1; } }
  @keyframes ng-up { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes ng-zoom { from { opacity: 0; transform: scale(.8); } to { opacity: 1; transform: scale(1); } }
  @keyframes ng-slide { from { opacity: 0; transform: translateX(-32px); } to { opacity: 1; transform: translateX(0); } }
  .nav-gateway-441 .ng-col { opacity: 0; animation: ng-${gatewayConfig.entranceAnim} ${Number(gatewayConfig.entranceDuration) || 600}ms ease forwards; }` : ''}
</style>`;

    const hasLord = (gatewayConfig.options || []).some((o: any) => o.lordIcon);

    const cards = (gatewayConfig.options || []).map((o: any, index: number) => {
      const safeId = String(o.id || `card-${index}`).replace(/[^a-zA-Z0-9_-]/g, '-');
      const cardClass = `ng-card-${safeId}`;
      const isLoop = o.lordTrigger === 'loop';
      const hasPalette = !o.lordKeepColors && Array.isArray(o.lordColors) && o.lordColors.length > 0;
      // Mapa por índice de slot (posição) — cada ocorrência de cor é independente,
      // mesmo que duas slots tenham o mesmo valor original.
      const recolorMap = hasPalette
        ? o.lordColors.reduce((acc: any, c: any, ci: number) => {
            const slot = Number.isFinite(c?.index) ? c.index : ci;
            if (c && c.value && c.original && c.value.toLowerCase() !== c.original.toLowerCase()) acc[slot] = c.value;
            return acc;
          }, {})
        : null;
      // Em modo paleta, recolorimos o JSON embutido no build (fonte da verdade).
      // Não emitimos data-ng-recolor para evitar recoloração global por valor em runtime.
      const recolorAttr = '';

      const fallbackColors = (!o.lordKeepColors && !hasPalette)
        ? ` data-ng-primary="${o.lordPrimary || o.iconColor}" data-ng-secondary="${o.lordSecondary || o.lordPrimary || o.iconColor}"`
        : '';
      const renderKey = JSON.stringify({
        src: o.lordIcon,
        trigger: o.lordTrigger || 'boomerang',
        keep: !!o.lordKeepColors,
        palette: o.lordColors || null,
        primary: o.lordPrimary || o.iconColor,
        secondary: o.lordSecondary || o.lordPrimary || o.iconColor,
        dataVersion: o.lordDataVersion || null,
      }).replace(/'/g, '&#39;');
      const finalLordData = o.lordData && recolorMap && Object.keys(recolorMap).length
        ? recolorLottieDataForGateway(o.lordData, recolorMap)
        : o.lordData;
      const embeddedData = finalLordData
        ? `<script type="application/json" class="ng-lottie-json">${escapeHtmlJson(finalLordData)}</script>`
        : '';
      const svgStatic = sanitizeSvg(o.svgStatic);
      const svgHover = sanitizeSvg(o.svgHover);
      const svgActive = sanitizeSvg(o.svgActive);
      const useSvg = !!svgStatic;
      const svgDur = `${(Number(o.svgTransition ?? 300) || 300)}ms`;
      const legacyEasings = ['ease', 'linear', 'ease-in', 'ease-out', 'ease-in-out', 'cubic-bezier(.34,1.56,.64,1)'];
      const svgEffect = legacyEasings.includes(o.svgEasing) ? 'fade' : (o.svgEasing || 'fade');
      const effectMap: Record<string, { ease: string; outTransform: string; outFilter: string }> = {
        fade: { ease: 'ease', outTransform: 'none', outFilter: 'none' },
        soft: { ease: 'cubic-bezier(.22,.61,.36,1)', outTransform: 'translateY(8px)', outFilter: 'none' },
        slide: { ease: 'cubic-bezier(.2,.8,.2,1)', outTransform: 'translateX(-12px)', outFilter: 'none' },
        blur: { ease: 'ease-out', outTransform: 'none', outFilter: 'blur(6px)' },
        snap: { ease: 'steps(1, end)', outTransform: 'none', outFilter: 'none' },
      };
      const svgMotion = effectMap[svgEffect] || effectMap.fade;
      let iconHtml: string;
      if (useSvg) {
        const wrapClasses = ['ng-svg-icon', svgHover ? 'has-hover' : '', svgActive ? 'has-active' : ''].filter(Boolean).join(' ');
        iconHtml = `<span class="${wrapClasses}" style="--ng-svg-dur:${svgDur};--ng-svg-ease:${svgMotion.ease};--ng-svg-out-transform:${svgMotion.outTransform};--ng-svg-out-filter:${svgMotion.outFilter};--ng-svg-in-transform:none;--ng-svg-in-filter:none;width:${Number(o.svgSize) || 56}px;height:${Number(o.svgSize) || 56}px;color:${o.iconColor};" data-click-hold="${o.svgClickHold ? '1' : '0'}" aria-hidden="true">`
          + `<span class="ng-svg-layer is-static">${svgStatic}</span>`
          + (svgHover ? `<span class="ng-svg-layer is-hover">${svgHover}</span>` : '')
          + (svgActive ? `<span class="ng-svg-layer is-active">${svgActive}</span>` : '')
          + `</span>`;
      } else if (o.lordIcon) {
        iconHtml = `<span class="ng-lottie ${isLoop ? 'ng-lottie-loop' : 'ng-lottie-hold'}" data-src="${o.lordIcon}" data-ng-key='${renderKey}'${fallbackColors}${recolorAttr} aria-hidden="true">${embeddedData}</span>`;
      } else {
        iconHtml = `<span class="ng-icon" style="color:${o.iconColor};">${o.icon || ''}</span>`;
      }
      const animDelay = gatewayConfig.entranceAnim && gatewayConfig.entranceAnim !== 'none' ? ` style="animation-delay:${gatewayConfig.entranceSync ? 0 : index * 120}ms"` : '';
      return `
    <div class="ng-col"${animDelay}>
      <a class="ng-card ${cardClass}" href="${o.link || '#'}" style="--ng-lbl:${o.iconColor}">
        ${iconHtml}
        <span class="ng-label"${fontRules(o.labelFont, o.labelFontWeight, o.labelFontStyle) ? ` style="${fontRules(o.labelFont, o.labelFontWeight, o.labelFontStyle).trim()}"` : ''}>${o.cardLabel || ''}</span>
      </a>
      ${o.pillText ? `<span class="ng-pill"${fontRules(o.pillFont, o.pillFontWeight, o.pillFontStyle) ? ` style="${fontRules(o.pillFont, o.pillFontWeight, o.pillFontStyle).trim()}"` : ''}>${o.pillText}</span>` : ''}
    </div>`;
    }).join('');

    const lordScript = hasLord ? `
<script src="https://cdnjs.cloudflare.com/ajax/libs/bodymovin/5.12.2/lottie.min.js"></script>
<script>
(function(){
  function hexToRgb01(hex){
    var h = String(hex || '').replace('#','');
    if(h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    return [parseInt(h.slice(0,2),16)/255, parseInt(h.slice(2,4),16)/255, parseInt(h.slice(4,6),16)/255];
  }
  function clone(value){ return JSON.parse(JSON.stringify(value)); }
  function rgb01ToHex(arr){
    function c(n){ return ('0'+Math.round(Math.max(0,Math.min(1,n))*255).toString(16)).slice(-2); }
    return ('#'+c(arr[0])+c(arr[1])+c(arr[2])).toLowerCase();
  }
  function normalizeRgbArray(arr){
    if(!Array.isArray(arr) || (arr.length !== 3 && arr.length !== 4)) return null;
    if(typeof arr[0] !== 'number' || typeof arr[1] !== 'number' || typeof arr[2] !== 'number') return null;
    var max = Math.max(Number(arr[0]) || 0, Number(arr[1]) || 0, Number(arr[2]) || 0);
    return max > 1 ? [arr[0]/255, arr[1]/255, arr[2]/255] : [arr[0], arr[1], arr[2]];
  }
  function writeRgbArray(target, rgb){
    var max = Math.max(Number(target[0]) || 0, Number(target[1]) || 0, Number(target[2]) || 0);
    if(max > 1){ target[0]=rgb[0]*255; target[1]=rgb[1]*255; target[2]=rgb[2]*255; }
    else { target[0]=rgb[0]; target[1]=rgb[1]; target[2]=rgb[2]; }
  }
  function normalizeHex(hex){
    var h = String(hex || '').trim().toLowerCase();
    if(!h) return '';
    if(h[0] !== '#') h = '#'+h;
    if(/^#[0-9a-f]{3}$/.test(h)) h = '#'+h[1]+h[1]+h[2]+h[2]+h[3]+h[3];
    if(/^#[0-9a-f]{8}$/.test(h)) h = h.slice(0, 7);
    return /^#[0-9a-f]{6}$/.test(h) ? h : '';
  }
  // Mantém o canal alpha do alvo: retorna { hex:'#rrggbb', rgb:[0-1], a:0-1 }.
  function parseColorWithAlpha(value){
    var raw = String(value || '').trim().toLowerCase();
    if(!raw) return null;
    if(raw === 'transparent' || raw === 'none') return { hex:'#000000', rgb:[0,0,0], a:0, hasAlpha:true };
    if(raw[0] !== '#') raw = '#'+raw;
    if(/^#[0-9a-f]{3}$/.test(raw)) raw = '#'+raw[1]+raw[1]+raw[2]+raw[2]+raw[3]+raw[3];
    var a = 1;
    var hasAlpha = /^#[0-9a-f]{8}$/.test(raw);
    if(hasAlpha){ a = parseInt(raw.slice(7,9),16)/255; raw = raw.slice(0,7); }
    if(!/^#[0-9a-f]{6}$/.test(raw)) return null;
    return { hex: raw, rgb: hexToRgb01(raw), a: a, hasAlpha: hasAlpha };
  }
  function colorStringToHex(value){
    var raw = String(value || '').trim().toLowerCase();
    if(!raw || raw === 'none' || raw === 'transparent') return '';
    var hex = normalizeHex(raw);
    if(hex) return hex;
    var match = raw.match(/rgba?\(([^)]+)\)/);
    if(!match) return '';
    var parts = match[1].split(',').map(function(part){ return parseFloat(part.trim()); });
    if(parts.length < 3 || parts.slice(0,3).some(function(n){ return !isFinite(n); })) return '';
    return rgb01ToHex([parts[0]/255, parts[1]/255, parts[2]/255]);
  }
  function collectValueColors(value, found){
    var normalized = normalizeRgbArray(value);
    if(normalized){ found[rgb01ToHex(normalized)] = true; return; }
    if(Array.isArray(value)){
      value.forEach(function(frame){
        if(frame && typeof frame === 'object'){
          if(Array.isArray(frame.s)) collectValueColors(frame.s, found);
          if(Array.isArray(frame.e)) collectValueColors(frame.e, found);
        }
      });
    }
  }
  function collectGradientColors(value, points, found){
    if(Array.isArray(value) && value.length >= points * 4 && value.slice(0, points * 4).every(function(v){ return typeof v === 'number'; })){
      for(var i=0;i<points;i++){
        var base = i * 4;
        collectValueColors([value[base+1], value[base+2], value[base+3]], found);
      }
      return;
    }
    if(Array.isArray(value)){
      value.forEach(function(frame){
        if(frame && typeof frame === 'object'){
          if(Array.isArray(frame.s)) collectGradientColors(frame.s, points, found);
          if(Array.isArray(frame.e)) collectGradientColors(frame.e, points, found);
        }
      });
    }
  }
  function collectColors(data){
    var found = {};
    function walk(node){
      if(!node || typeof node !== 'object') return;
      if(node.c && node.c.k) collectValueColors(node.c.k, found);
      if(node.g && node.g.k){
        var points = Number(node.g.p || node.p || 0);
        var gradientValue = node.g.k.k || node.g.k;
        if(points > 0) collectGradientColors(gradientValue, points, found);
      }
      if(Array.isArray(node)) node.forEach(walk);
      else Object.keys(node).forEach(function(k){ walk(node[k]); });
    }
    walk(data);
    return Object.keys(found);
  }
  function recolorValue(value, map){
    var normalized = normalizeRgbArray(value);
    if(normalized){
      var current = rgb01ToHex(normalized);
      if(map[current]){
        writeRgbArray(value, map[current].rgb);
        if(value.length >= 4 && map[current].hasAlpha) value[3] = map[current].a;
        return map[current];
      }
      return null;
    }
    var matched = null;
    if(Array.isArray(value)){
      value.forEach(function(frame){
        if(frame && typeof frame === 'object'){
          if(Array.isArray(frame.s)) matched = recolorValue(frame.s, map) || matched;
          if(Array.isArray(frame.e)) matched = recolorValue(frame.e, map) || matched;
        }
      });
    }
    return matched;
  }
  function applyOpacityValue(value, alpha){
    var next = Math.max(0, Math.min(1, Number(alpha))) * 100;
    if(Array.isArray(value)){
      if(value.length && value.every(function(v){ return typeof v === 'number'; })){
        value[0] = next;
        return;
      }
      value.forEach(function(frame){
        if(!frame || typeof frame !== 'object') return;
        if(Array.isArray(frame.s)) frame.s[0] = next;
        else if(typeof frame.s === 'number') frame.s = next;
        if(Array.isArray(frame.e)) frame.e[0] = next;
        else if(typeof frame.e === 'number') frame.e = next;
      });
    }
  }
  function applyNodeOpacity(node, target){
    if(!target || !target.hasAlpha || !node || !node.o || node.o.k == null) return;
    if(typeof node.o.k === 'number') node.o.k = Math.max(0, Math.min(1, target.a)) * 100;
    else applyOpacityValue(node.o.k, target.a);
  }
  function recolorGradientValue(value, points, map){
    if(Array.isArray(value) && value.length >= points * 4 && value.slice(0, points * 4).every(function(v){ return typeof v === 'number'; })){
      var matches = [];
      for(var i=0;i<points;i++){
        var base = i * 4;
        var rgbTriplet = [value[base+1], value[base+2], value[base+3]];
        var current = rgb01ToHex(normalizeRgbArray(rgbTriplet) || rgbTriplet);
        if(map[current]){
          writeRgbArray(rgbTriplet, map[current].rgb);
          value[base+1]=rgbTriplet[0]; value[base+2]=rgbTriplet[1]; value[base+3]=rgbTriplet[2];
          if(map[current].hasAlpha) matches.push({ offset: value[base], target: map[current] });
        }
      }
      if(matches.length){
        var opacityStart = points * 4;
        var scale = 1;
        for(var oi = opacityStart + 1; oi < value.length; oi += 2){ if(Number(value[oi]) > 1) scale = 100; }
        matches.forEach(function(match){
          var wrote = false;
          for(var oi = opacityStart; oi + 1 < value.length; oi += 2){
            if(Math.abs(Number(value[oi]) - Number(match.offset)) < 0.001){ value[oi + 1] = match.target.a * scale; wrote = true; }
          }
          if(!wrote) value.push(match.offset, match.target.a * scale);
        });
      }
      return;
    }
    if(Array.isArray(value)){
      value.forEach(function(frame){
        if(frame && typeof frame === 'object'){
          if(Array.isArray(frame.s)) recolorGradientValue(frame.s, points, map);
          if(Array.isArray(frame.e)) recolorGradientValue(frame.e, points, map);
        }
      });
    }
  }
  function recolor(data, map){
    var copy = clone(data);
    var normalizedMap = {};
    Object.keys(map || {}).forEach(function(key){
      var from = normalizeHex(key);
      var to = parseColorWithAlpha(map[key]);
      if(from && to) normalizedMap[from] = to;
    });
    function walk(node){
      if(!node || typeof node !== 'object') return;
      if(node.c && node.c.k) applyNodeOpacity(node, recolorValue(node.c.k, normalizedMap));
      if(node.g && node.g.k){
        var points = Number(node.g.p || node.p || 0);
        var gradientValue = node.g.k.k || node.g.k;
        if(points > 0) recolorGradientValue(gradientValue, points, normalizedMap);
      }
      if(Array.isArray(node)) node.forEach(walk);
      else Object.keys(node).forEach(function(k){ walk(node[k]); });
    }
    walk(copy);
    return copy;
  }
  function applySvgColorFallback(icon, map){
    var normalizedMap = {};
    Object.keys(map || {}).forEach(function(key){
      var from = normalizeHex(key);
      var to = parseColorWithAlpha(map[key]);
      if(from && to) normalizedMap[from] = to;
    });
    if(!Object.keys(normalizedMap).length) return;
    icon.querySelectorAll('path, circle, ellipse, rect, polygon, polyline, line, g, stop').forEach(function(el){
      var tag = (el.tagName || '').toLowerCase();
      var props = tag === 'stop' ? ['stop-color'] : ['fill','stroke'];
      props.forEach(function(prop){
        var attr = el.getAttribute(prop);
        var attrHex = colorStringToHex(attr);
        var target = null;
        if(attrHex && normalizedMap[attrHex]) target = normalizedMap[attrHex];
        var inline = el.style && el.style[prop];
        var inlineHex = colorStringToHex(inline);
        if(!target && inlineHex && normalizedMap[inlineHex]) target = normalizedMap[inlineHex];
        var computed = colorStringToHex(window.getComputedStyle(el)[prop]);
        if(!target && computed && normalizedMap[computed] && !attrHex && !inlineHex) target = normalizedMap[computed];
        if(target){
          el.setAttribute(prop, target.hex);
          if(el.style && el.style.setProperty) el.style.setProperty(prop, target.hex, 'important');
          if(target.hasAlpha){
            var opacityProp = prop === 'stop-color' ? 'stop-opacity' : prop + '-opacity';
            el.setAttribute(opacityProp, String(target.a));
            if(el.style && el.style.setProperty) el.style.setProperty(opacityProp, String(target.a), 'important');
          }
        }
      });
    });
  }
  function buildColorMap(icon, data){
    var map = {};
    try { map = icon.getAttribute('data-ng-recolor') ? JSON.parse(icon.getAttribute('data-ng-recolor')) : {}; } catch(e){ map = {}; }
    if(Object.keys(map).length) return map;
    var primary = icon.getAttribute('data-ng-primary');
    var secondary = icon.getAttribute('data-ng-secondary') || primary;
    if(!primary) return map;
    var colors = collectColors(data);
    if(colors[0]) map[colors[0]] = primary;
    if(colors[1]) map[colors[1]] = secondary;
    return map;
  }
  function readEmbeddedData(icon){
    var script = icon.querySelector('.ng-lottie-json');
    if(!script) return null;
    try { return JSON.parse(script.textContent || ''); } catch(e){ return null; }
  }
  function initLottieIcons(){
    if(!window.lottie){ setTimeout(initLottieIcons, 80); return; }
    document.querySelectorAll('.nav-gateway-441 .ng-lottie').forEach(function(icon){
      var currentKey = icon.getAttribute('data-ng-key') || '';
      if(icon.dataset.bound === '1' && icon.dataset.renderKey === currentKey) return;
      if(icon.__ngAnim && typeof icon.__ngAnim.destroy === 'function') icon.__ngAnim.destroy();
      var embeddedData = readEmbeddedData(icon);
      icon.innerHTML = '';
      icon.dataset.bound = '1';
      icon.dataset.renderKey = currentKey;
      icon.style.display = 'block';
      icon.style.width = '56px';
      icon.style.height = '56px';

      (embeddedData ? Promise.resolve(embeddedData) : fetch(icon.getAttribute('data-ng-original-src') || icon.getAttribute('data-src'))
        .then(function(r){ if(!r.ok) throw new Error('JSON não carregado'); return r.json(); }))
        .then(function(originalData){
          var map = buildColorMap(icon, originalData);
          var data = Object.keys(map).length ? recolor(originalData, map) : originalData;
          var anim = window.lottie.loadAnimation({
            container: icon,
            renderer: 'svg',
            loop: false,
            autoplay: false,
            animationData: data,
            rendererSettings: { preserveAspectRatio: 'xMidYMid meet' }
          });
          icon.__ngAnim = anim;
          var card = icon.closest('.ng-card');
          if(!card) return;
          var renderStart = function(){
            anim.goToAndStop(1, true);
            if(Object.keys(map).length) applySvgColorFallback(icon, map);
            requestAnimationFrame(function(){
              anim.goToAndStop(0, true);
              if(Object.keys(map).length) applySvgColorFallback(icon, map);
            });
          };
          anim.addEventListener('DOMLoaded', renderStart);
          anim.addEventListener('data_ready', renderStart);
          anim.addEventListener('enterFrame', function(){ if(Object.keys(map).length) applySvgColorFallback(icon, map); });
          setTimeout(renderStart, 120);

          card.addEventListener('mouseenter', function(){
            if(Object.keys(map).length) applySvgColorFallback(icon, map);
            if(icon.classList.contains('ng-lottie-loop')){
              anim.loop = true;
              anim.setDirection(1);
              anim.goToAndPlay(0, true);
            } else {
              anim.loop = false;
              anim.setDirection(1);
              anim.goToAndPlay(0, true);
            }
          });

          card.addEventListener('mouseleave', function(){
            anim.loop = false;
            if(Object.keys(map).length) applySvgColorFallback(icon, map);
            if(icon.classList.contains('ng-lottie-loop')){
              anim.stop();
              anim.goToAndStop(0, true);
            } else {
              anim.setDirection(-1);
              anim.play();
            }
          });

          anim.addEventListener('complete', function(){
            if(icon.matches(':hover') || (card && card.matches(':hover'))){
              if(icon.classList.contains('ng-lottie-hold')) anim.goToAndStop(Math.max(0, anim.totalFrames - 1), true);
            } else {
              anim.goToAndStop(0, true);
            }
          });
        }).catch(function(){ icon.textContent = ''; });
    });
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initLottieIcons);
  else initLottieIcons();
})();
</script>` : '';

    const hasSvg = (gatewayConfig.options || []).some((o: any) => sanitizeSvg(o.svgStatic));
    const svgScript = hasSvg ? `
<script>
(function(){
  function bind(){
    document.querySelectorAll('.nav-gateway-441 .ng-card').forEach(function(card){
      var icon = card.querySelector('.ng-svg-icon.has-active');
      if(!icon || card.__ngSvgBound) return;
      card.__ngSvgBound = true;
      var hold = icon.getAttribute('data-click-hold') === '1';
      card.addEventListener('click', function(){
        if(hold){ icon.classList.toggle('is-clicked'); }
        else { icon.classList.add('is-clicked'); }
      });
      card.addEventListener('mouseleave', function(){ if(!hold) icon.classList.remove('is-clicked'); });
    });
  }
  if(document.readyState !== 'loading') bind();
  else document.addEventListener('DOMContentLoaded', bind);
})();
</script>` : '';

    const html = `
<!-- Início: Gateway de Navegação -->
<div class="nav-gateway-441" data-layout="${lay}">
  <div class="ng-inner">
    <h1>${gatewayConfig.title || ''}</h1>
    ${gatewayConfig.subtitle ? `<p class="ng-sub">${gatewayConfig.subtitle}</p>` : ''}
    <div class="ng-grid">${cards}
    </div>
  </div>
</div>
<!-- Fim: Gateway de Navegação -->${lordScript}${svgScript}`;

    return css + "\n" + html;
  };

  const generateSidetabCode = () => {
    const c = sidetabConfig;
    const side = c.side === 'left' ? 'left' : 'right';
    const rotate = side === 'left' ? '90deg' : '-90deg';
    const css = `<style>
  .side-tab-771 { position: fixed; bottom: ${Number(c.position) || 96}px; ${side}: 0; transform-origin: bottom ${side}; transform: rotate(${rotate}); background: ${c.bgColor}; color: ${c.textColor}; font-size: ${Number(c.fontSize) || 14}px; font-weight: 600; padding: 8px 20px; border-radius: ${Number(c.radius) || 8}px ${Number(c.radius) || 8}px 0 0; text-decoration: none; box-shadow: 0 10px 15px -3px rgba(0,0,0,.2); z-index: 999998; transition: filter .2s ease; }
  .side-tab-771:hover { filter: brightness(.92); }
</style>`;
    const html = `
<!-- Início: Aba Lateral -->
<a class="side-tab-771" href="${c.link || '#'}">${c.label || ''}</a>
<!-- Fim: Aba Lateral -->`;
    return css + "\n" + html;
  };

  const generateBannerSliderCode = () => {
    const c = bannerSliderConfig;
    const slides = (c.slides || []).filter((s: any) => s.active !== false);
    const uid = 'abs-' + Math.random().toString(36).slice(2, 8);
    const interval = Math.max(2000, Math.min(10000, Number(c.intervalMs) || 5000));
    const transition = Math.max(200, Math.min(1500, Number(c.transitionMs) || 600));
    const effect = c.effect === 'fade' ? 'fade' : 'slide';
    const loading = c.lazyLoad ? 'lazy' : 'eager';

    const css = `<style>
  .${uid}{position:relative;width:100%;overflow:hidden;background:#000;}
  .${uid} .abs-track{position:relative;width:100%;}
  .${uid} .abs-slide{position:absolute;inset:0;opacity:0;transition:opacity ${transition}ms ease;}
  .${uid}[data-effect="slide"] .abs-track{display:flex;width:100%;transition:transform ${transition}ms ease;}
  .${uid}[data-effect="slide"] .abs-slide{position:relative;flex:0 0 100%;opacity:1;}
  .${uid}[data-effect="fade"] .abs-slide.is-active{opacity:1;z-index:1;}
  .${uid} picture,.${uid} img{display:block;width:100%;height:100%;object-fit:cover;}
  .${uid} .abs-link{display:block;width:100%;height:100%;}
  .${uid} .abs-arrow{position:absolute;top:50%;transform:translateY(-50%);z-index:5;background:rgba(0,0,0,.45);color:#fff;border:0;width:40px;height:40px;border-radius:999px;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center;transition:background .2s;}
  .${uid} .abs-arrow:hover{background:rgba(0,0,0,.7);}
  .${uid} .abs-arrow.prev{left:12px;} .${uid} .abs-arrow.next{right:12px;}
  .${uid} .abs-dots{position:absolute;bottom:14px;left:0;right:0;display:flex;gap:6px;justify-content:center;z-index:5;}
  .${uid} .abs-dot{width:8px;height:8px;border-radius:999px;background:rgba(255,255,255,.5);border:0;cursor:pointer;padding:0;transition:background .2s,width .2s;}
  .${uid} .abs-dot.is-active{background:#fff;width:22px;}
  .${uid} .abs-ratio{aspect-ratio:1916/821;}
  @media (max-width:1024px) and (min-width:641px){.${uid} .abs-ratio{aspect-ratio:1536/1024;}}
  @media (max-width:640px){.${uid} .abs-ratio{aspect-ratio:1080/1440;}}
  @media (prefers-reduced-motion:reduce){.${uid} .abs-track,.${uid} .abs-slide{transition:none!important;}}
</style>`;

    const slidesHtml = slides.map((s: any, i: number) => {
      const alt = (s.alt || '').replace(/"/g, '&quot;');
      const desktop = s.imageDesktop || s.imageTablet || s.imageMobile || '';
      const tablet = s.imageTablet || desktop;
      const mobile = s.imageMobile || desktop;
      const picture = `<picture>
        <source media="(min-width:1024px)" srcset="${desktop}">
        <source media="(min-width:641px)" srcset="${tablet}">
        <img src="${mobile}" alt="${alt}" loading="${i === 0 ? 'eager' : loading}" decoding="async">
      </picture>`;
      const inner = s.href
        ? `<a class="abs-link" href="${s.href}"${s.newTab ? ' target="_blank" rel="noopener"' : ''} aria-label="${alt || 'Slide ' + (i + 1)}">${picture}</a>`
        : picture;
      return `<div class="abs-slide abs-ratio${i === 0 ? ' is-active' : ''}" role="group" aria-roledescription="slide" aria-label="${i + 1} de ${slides.length}">${inner}</div>`;
    }).join('');

    const html = `
<!-- Início: Banner Slider Nativo -->
<div class="${uid}" data-effect="${effect}" aria-roledescription="carousel" aria-label="Banner">
  <div class="abs-track abs-ratio">${slidesHtml}</div>
  ${c.showArrows && slides.length > 1 ? `<button class="abs-arrow prev" type="button" aria-label="Anterior">‹</button><button class="abs-arrow next" type="button" aria-label="Próximo">›</button>` : ''}
  ${c.showPagination && slides.length > 1 ? `<div class="abs-dots">${slides.map((_: any, i: number) => `<button class="abs-dot${i === 0 ? ' is-active' : ''}" type="button" aria-label="Ir para slide ${i + 1}"></button>`).join('')}</div>` : ''}
</div>
<!-- Fim: Banner Slider Nativo -->`;

    const script = `<script>(function(){
  var root=document.currentScript.previousElementSibling;while(root&&!root.classList.contains('${uid}'))root=root.previousElementSibling;
  if(!root)return;
  var slides=root.querySelectorAll('.abs-slide'),dots=root.querySelectorAll('.abs-dot'),track=root.querySelector('.abs-track');
  var i=0,n=slides.length,timer=null,effect=root.getAttribute('data-effect');
  var loop=${c.loop ? 'true' : 'false'},autoplay=${c.autoplay ? 'true' : 'false'},pauseHover=${c.pauseOnHover ? 'true' : 'false'};
  function render(){
    if(effect==='slide'){track.style.transform='translateX(-'+(i*100)+'%)';}
    slides.forEach(function(s,k){s.classList.toggle('is-active',k===i);});
    dots.forEach(function(d,k){d.classList.toggle('is-active',k===i);});
  }
  function go(k){if(k<0)k=loop?n-1:0;if(k>=n)k=loop?0:n-1;i=k;render();}
  function next(){go(i+1);} function prev(){go(i-1);}
  var pv=root.querySelector('.abs-arrow.prev'),nx=root.querySelector('.abs-arrow.next');
  if(pv)pv.addEventListener('click',function(e){e.preventDefault();prev();reset();});
  if(nx)nx.addEventListener('click',function(e){e.preventDefault();next();reset();});
  dots.forEach(function(d,k){d.addEventListener('click',function(e){e.preventDefault();go(k);reset();});});
  root.addEventListener('keydown',function(e){if(e.key==='ArrowLeft'){prev();reset();}if(e.key==='ArrowRight'){next();reset();}});
  root.setAttribute('tabindex','0');
  function start(){if(!autoplay||n<2)return;stop();timer=setInterval(next,${interval});}
  function stop(){if(timer){clearInterval(timer);timer=null;}}
  function reset(){stop();start();}
  if(pauseHover){root.addEventListener('mouseenter',stop);root.addEventListener('mouseleave',start);root.addEventListener('focusin',stop);root.addEventListener('focusout',start);}
  if(!window.matchMedia||!window.matchMedia('(prefers-reduced-motion: reduce)').matches){start();}
  render();
})();</script>`;

    return css + "\n" + html + "\n" + script;
  };

  const getGeneratedCode = () => {
    if (activeWidgetType === 'whatsapp') return generateWhatsappCode();
    if (activeWidgetType === 'banner') return generateBannerCode();
    if (activeWidgetType === 'banner-slider') return generateBannerSliderCode();
    if (activeWidgetType === 'gateway') return generateGatewayCode();
    if (activeWidgetType === 'sidetab') return generateSidetabCode();
    return generateMenuCode();
  };


  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto">
        
        {/* Header Section */}
        <PageHeader
          title="Construtor de Widgets Externos"
          description="Crie ferramentas para usar em sites de terceiros (WordPress, Elementor, etc)."
          actions={
            <>
              <Button variant="ghost" size="sm" className="h-9 text-[13px]" onClick={() => loadDemo('whatsapp')}>Demo Whats</Button>
              <Button variant="ghost" size="sm" className="h-9 text-[13px]" onClick={() => loadDemo('banner')}>Demo Banner</Button>
              <Button variant="ghost" size="sm" className="h-9 text-[13px]" onClick={() => loadDemo('menu')}>Demo Menu c/ Submenu</Button>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant={currentTemplateId ? 'ghost' : 'outline'} className="gap-2" onClick={() => { setTemplateName(cleanName(templateName)); setCurrentTemplateId(null); }}>
                    <Plus className="h-4 w-4" />
                    Salvar como novo
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Salvar como novo modelo</DialogTitle>
                    <DialogDescription>
                      Cria um novo modelo a partir da configuração atual, sem alterar o original.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4">
                    <Label htmlFor="name">Nome do Modelo</Label>
                    <Input 
                      id="name" 
                      placeholder="Ex: Menu Principal Elementor" 
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                    />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                    <Button onClick={saveTemplate} disabled={isSaving}>
                      {isSaving ? "Salvando..." : "Confirmar Salvar"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              {currentTemplateId ? (
                <Button variant="outline" className="gap-2" disabled={isSaving} onClick={overwriteWithDraft}>
                  <Save className="h-4 w-4" />
                  {isSaving ? 'Salvando...' : 'Salvar alterações'}
                </Button>
              ) : null}
              <Button className="md:w-auto w-full" onClick={() => setViewMode('code')}>
                Gerar Código para Copiar
              </Button>
            </>
          }
        />


        {currentTemplateId && draftSavedAt && (
          <Alert className="rounded-[20px] border-black/5 bg-card dark:border-white/5">
            <Save className="h-4 w-4 text-warning" />
            <AlertTitle>Rascunho salvo automaticamente</AlertTitle>
            <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm">
                Alterações não salvas em <strong>{cleanName(templateName) || 'modelo'}</strong> — salvas localmente às {new Date(draftSavedAt).toLocaleTimeString()}. Use <strong>Salvar alterações</strong> (acima) para gravar.
              </span>
              <Button size="sm" variant="ghost" className="shrink-0" disabled={isSaving} onClick={discardDraft}>
                Descartar rascunho
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <Dialog open={!!historyTemplate} onOpenChange={(o) => !o && setHistoryTemplate(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Histórico de versões</DialogTitle>
              <DialogDescription>
                {historyTemplate ? <>Versões anteriores de <strong>{cleanName(historyTemplate.name)}</strong>. Restaurar substitui a configuração atual (a atual é salva no histórico antes).</> : null}
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[50vh] space-y-2 overflow-y-auto py-2">
              {historyTemplate && getHistory(historyTemplate.id).length === 0 ? (
                <div className="rounded-2xl border border-dashed bg-muted/20 py-8 text-center text-sm text-muted-foreground">
                  Nenhuma versão anterior ainda. O histórico é criado ao sobrepor ou restaurar este modelo.
                </div>
              ) : (
                historyTemplate && getHistory(historyTemplate.id).map((entry: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background p-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{entry.note || 'Versão anterior'}</p>
                      <p className="text-[11px] text-muted-foreground">{new Date(entry.savedAt).toLocaleString('pt-BR')}</p>
                    </div>
                    <Button size="sm" variant="outline" className="shrink-0 gap-1.5" disabled={isSaving} onClick={() => restoreHistory(entry)}>
                      <RotateCcw className="h-3.5 w-3.5" /> Restaurar
                    </Button>
                  </div>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>






        <Alert className="rounded-[20px] border-black/5 bg-card dark:border-white/5">
          <ShieldAlert className="h-4 w-4 text-muted-foreground" />
          <AlertTitle>Foco em Implementação Externa</AlertTitle>
          <AlertDescription>
            Tudo o que você configurar aqui gera um código independente para ser colado em outros sites. Nenhuma alteração afetará este sistema atual.
          </AlertDescription>

        </Alert>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Sidebar Configurações */}
          <div className="lg:col-span-4 lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:pr-1.5">
            <div className="overflow-hidden rounded-[20px] border border-black/5 bg-card dark:border-white/5">
              <div className="border-b border-border/70 px-4 py-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[13px] text-muted-foreground">Painel de edição</p>
                    <h2 className="text-[15px] font-semibold leading-tight">Ferramentas do widget</h2>
                  </div>
                  <span className="rounded-full border border-border px-2.5 py-0.5 text-xs font-semibold capitalize text-foreground">{activeWidgetType}</span>
                </div>
              </div>

              <Tabs defaultValue="widget" className="w-full">
                <div className="border-b px-3 pt-3">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="widget" className="gap-1.5 text-[13px]">Widget</TabsTrigger>
                    <TabsTrigger value="models" className="gap-1.5 text-[13px]">Modelos{(() => { const n = savedTemplates.filter(t => t.type === activeWidgetType).length; return n > 0 ? <span className="text-xs font-normal tabular-nums text-[hsl(var(--fraco))]">{n}</span> : null; })()}</TabsTrigger>
                    <TabsTrigger value="config" className="gap-1.5 text-[13px]">Editor</TabsTrigger>
                  </TabsList>
                </div>


                <TabsContent value="widget" className="m-0 focus-visible:outline-none">
              <section className="p-4">
                <div className="mb-3 text-[15px] font-semibold">
                  Tipo de Widget
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { type: 'whatsapp', icon: MessageCircle, label: 'WhatsApp', hint: 'Botão flutuante' },
                    { type: 'banner', icon: AlertTriangle, label: 'Banner', hint: 'Aviso topo' },
                    { type: 'menu', icon: MenuIcon, label: 'Menu', hint: 'Responsivo' },
                    { type: 'gateway', icon: LayoutGrid, label: 'Gateway', hint: 'Navegação' },
                    { type: 'sidetab', icon: PanelRight, label: 'Aba Lateral', hint: 'Lateral fixa' },
                    { type: 'banner-slider', icon: Images, label: 'Banner Slider', hint: 'Slider responsivo' },
                  ] as const).map(({ type, icon: Icon, label, hint }) => {
                    const active = activeWidgetType === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setActiveWidgetType(type)}
                        className={cn(
                          "group flex min-h-[96px] flex-col items-start gap-2 rounded-2xl border p-3 text-left transition-colors",
                          active
                            ? "border-[#81e2cf] bg-accent ring-1 ring-[#81e2cf]/50"
                            : "border-border bg-card hover:border-[#81e2cf]/60 hover:bg-muted/50"
                        )}
                      >
                        <span className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-md transition-colors",
                          active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover:text-foreground"
                        )}>
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className="space-y-0.5">
                          <span className={cn("block text-sm font-medium leading-none", active ? "text-foreground" : "text-foreground")}>{label}</span>
                          <span className="block text-[11px] text-muted-foreground">{hint}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
               </section>
                </TabsContent>

                <TabsContent value="models" className="m-0 focus-visible:outline-none">
              {(() => {
                const filteredTemplates = savedTemplates.filter((t) => t.type === activeWidgetType);
                return (
              <section className="p-4">
                <div className="mb-3 flex items-center gap-1.5 text-[15px] font-semibold">
                  Modelos de <span className="capitalize">{activeWidgetType}</span>
                  {filteredTemplates.length > 0 && (
                    <span className="ml-auto rounded-full border border-border px-2 py-0.5 text-xs font-semibold tabular-nums">{filteredTemplates.length}</span>
                  )}
                </div>
                <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1.5">

                {filteredTemplates.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/20 py-8 text-center">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-background text-muted-foreground shadow-sm">
                      <FolderOpen className="h-5 w-5" />
                    </span>
                    <p className="text-xs text-muted-foreground">Nenhum modelo de <span className="capitalize">{activeWidgetType}</span> salvo ainda.</p>
                  </div>
                ) : (
                  filteredTemplates.map((template) => {
                    const hasUnsavedDraft = currentTemplateId === template.id && Boolean(draftSavedAt);
                    return (
                      <div key={template.id} className={cn(
                        "group flex items-center gap-3 rounded-2xl border p-3 text-sm transition-colors",
                        currentTemplateId === template.id
                          ? "border-foreground/60 bg-muted ring-1 ring-foreground/20"
                          : "border-border bg-background hover:border-foreground/30 hover:bg-muted/50"
                      )}>
                                                <div className="flex min-w-0 flex-1 cursor-pointer flex-col" onClick={() => loadTemplate(template)}>
                          <span className="truncate font-medium leading-tight">{cleanName(template.name)}</span>
                          <span className="mt-1 flex flex-wrap items-center gap-1.5">
                            <span className="inline-flex w-fit items-center rounded-full border border-border px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">{template.type}</span>
                            {(template.updated_at || template.created_at) && (
                              <span className="text-[11px] tabular-nums text-[hsl(var(--fraco))]">
                                {new Date(template.updated_at || template.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </span>
                            )}
                          </span>
                        </div>

                        {hasUnsavedDraft && (
                          <span className="flex shrink-0 h-7 w-7 items-center justify-center text-warning" title="Há alterações não salvas neste modelo">
                            <Edit className="h-3 w-3" />
                          </span>
                        )}
                        <div className="flex shrink-0 items-center gap-0.5">

                          {hasUnsavedDraft && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Atualizar modelo com o rascunho" aria-label="Atualizar modelo com o rascunho" disabled={isSaving} onClick={() => overwriteWithDraft()}>
                              <RefreshCw className="h-3 w-3" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" title="Histórico de versões" aria-label="Histórico de versões" onClick={() => setHistoryTemplate(template)}>
                            <History className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Excluir modelo salvo" aria-label="Excluir modelo salvo" onClick={() => deleteTemplate(template.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
                </div>
              </section>
                );
              })()}
                </TabsContent>


                <TabsContent value="config" className="m-0 focus-visible:outline-none">
              <section className="p-4">
                <div className="sticky top-0 z-10 -mx-4 -mt-4 mb-4 flex items-center gap-2 border-b bg-card/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-card/80">
                  <div className="leading-tight">
                    <p className="text-[13px] text-muted-foreground">Configurações</p>
                    <p className="text-sm font-semibold capitalize">{activeWidgetType}</p>
                  </div>
                </div>
              <style>{`
                .tb-editor {
                  font-feature-settings: "cv02","cv03","cv04";
                  --tb-radius: 0.85rem;
                }
                /* Cada bloco de campo vira um cartão limpo e moderno */
                .tb-editor > div > .space-y-2,
                .tb-editor .grid > .space-y-2 {
                  border: 1px solid hsl(var(--border) / 0.6);
                  border-radius: var(--tb-radius);
                  background: hsl(var(--card));
                  padding: 0.75rem 0.85rem;
                  box-shadow: 0 1px 2px hsl(var(--foreground) / 0.04);
                  transition: border-color .18s ease, background .18s ease, box-shadow .18s ease, transform .18s ease;
                }
                .tb-editor > div > .space-y-2:hover,
                .tb-editor .grid > .space-y-2:hover {
                  border-color: hsl(var(--primary) / 0.5);
                  box-shadow: 0 4px 16px -8px hsl(var(--primary) / 0.4);
                }
                .tb-editor > div > .space-y-2:focus-within,
                .tb-editor .grid > .space-y-2:focus-within {
                  border-color: hsl(var(--primary) / 0.7);
                  box-shadow: 0 0 0 3px hsl(var(--primary) / 0.12);
                }
                /* Labels mais legíveis e hierárquicos */
                .tb-editor label {
                  font-size: 0.72rem;
                  font-weight: 600;
                  letter-spacing: 0.01em;
                  color: hsl(var(--muted-foreground));
                  text-transform: uppercase;
                }
                /* Inputs/selects com respiro consistente */
                .tb-editor input:not([type="checkbox"]):not([type="radio"]),
                .tb-editor textarea,
                .tb-editor select,
                .tb-editor [role="combobox"] {
                  border-radius: 0.6rem;
                  min-width: 0;
                  max-width: 100%;
                  transition: border-color .15s ease, box-shadow .15s ease;
                }
                .tb-editor input:focus-visible,
                .tb-editor textarea:focus-visible,
                .tb-editor select:focus-visible {
                  outline: none;
                  border-color: hsl(var(--primary));
                  box-shadow: 0 0 0 2px hsl(var(--primary) / 0.18);
                }
                /* Selects nativos: evitar corte de texto */
                .tb-editor select {
                  padding-left: 0.55rem;
                  padding-right: 1.5rem;
                  text-overflow: ellipsis;
                  width: 100%;
                  cursor: pointer;
                }
                /* Campos numéricos: sem setas e centralizados */
                .tb-editor input[type="number"] {
                  -moz-appearance: textfield;
                  padding-left: 0.5rem;
                  padding-right: 0.4rem;
                  text-align: center;
                  font-variant-numeric: tabular-nums;
                }
                .tb-editor input[type="number"]::-webkit-outer-spin-button,
                .tb-editor input[type="number"]::-webkit-inner-spin-button {
                  -webkit-appearance: none;
                  margin: 0;
                }
                /* Botões de preset/seleção: texto não estoura, quebra com elegância */
                .tb-editor button {
                  white-space: normal;
                  word-break: break-word;
                  min-width: 0;
                }
                /* Linhas de switch ganham aparência de toggle-card */
                .tb-editor > div > .flex.items-center.justify-between {
                  border: 1px solid hsl(var(--border) / 0.6);
                  border-radius: var(--tb-radius);
                  background: hsl(var(--card));
                  padding: 0.7rem 0.85rem;
                  gap: 0.5rem;
                  box-shadow: 0 1px 2px hsl(var(--foreground) / 0.04);
                  transition: border-color .18s ease, box-shadow .18s ease;
                }
                .tb-editor > div > .flex.items-center.justify-between:hover {
                  border-color: hsl(var(--primary) / 0.45);
                }
                /* Label dentro de linhas flex pode quebrar */
                .tb-editor .flex.items-center.justify-between > label {
                  flex: 1 1 auto;
                  min-width: 0;
                  text-transform: none;
                }
                /* Sliders com mais respiro */
                .tb-editor [role="slider"] { cursor: grab; }
              `}</style>
              <div className="tb-editor space-y-4">


                {activeWidgetType === 'whatsapp' ? (
                  <>
                    <div className="space-y-2">
                      <Label>Número do WhatsApp</Label>
                      <Input 
                        value={whatsappConfig.phone}
                        onChange={(e) => setWhatsappConfig({...whatsappConfig, phone: e.target.value})}
                        placeholder="Ex: 5511999999999"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Texto do Botão</Label>
                      <Input 
                        value={whatsappConfig.text}
                        onChange={(e) => setWhatsappConfig({...whatsappConfig, text: e.target.value})}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Cor de Fundo</Label>
                        <ColorField
                          value={whatsappConfig.bgColor}
                          onChange={(v) => setWhatsappConfig({...whatsappConfig, bgColor: v})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Cor do Texto</Label>
                        <ColorField
                          value={whatsappConfig.textColor}
                          onChange={(v) => setWhatsappConfig({...whatsappConfig, textColor: v})}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Posição</Label>
                      <Select 
                        value={whatsappConfig.position} 
                        onValueChange={(val) => setWhatsappConfig({...whatsappConfig, position: val})}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a posição" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="right">Canto Inferior Direito</SelectItem>
                          <SelectItem value="left">Canto Inferior Esquerdo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-4 pt-2">
                      <div className="flex justify-between items-center">
                        <Label>Arredondamento</Label>
                        <span className="text-xs text-muted-foreground">{whatsappConfig.borderRadius}px</span>
                      </div>
                      <Slider 
                        value={[parseInt(whatsappConfig.borderRadius)]} 
                        max={50} 
                        step={1} 
                        onValueChange={(vals) => setWhatsappConfig({...whatsappConfig, borderRadius: vals[0].toString()})} 
                      />
                    </div>
                  </>
                ) : activeWidgetType === 'banner' ? (
                  <>
                    <div className="space-y-2">
                      <Label>Mensagem</Label>
                      <Textarea 
                        value={bannerConfig.message}
                        onChange={(e) => setBannerConfig({...bannerConfig, message: e.target.value})}
                        rows={3}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Link de Destino</Label>
                      <Input 
                        value={bannerConfig.link}
                        onChange={(e) => setBannerConfig({...bannerConfig, link: e.target.value})}
                        placeholder="https://..."
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Cor de Fundo</Label>
                        <ColorField
                          value={bannerConfig.bgColor}
                          onChange={(v) => setBannerConfig({...bannerConfig, bgColor: v})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Cor do Texto</Label>
                        <ColorField
                          value={bannerConfig.textColor}
                          onChange={(v) => setBannerConfig({...bannerConfig, textColor: v})}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between space-x-2 pt-2">
                      <Label htmlFor="dismissible" className="cursor-pointer">Permitir fechar (X)</Label>
                      <Switch 
                        id="dismissible" 
                        checked={bannerConfig.isDismissible}
                        onCheckedChange={(val) => setBannerConfig({...bannerConfig, isDismissible: val})}
                      />
                    </div>
                  </>
                ) : null}

                {/* CONFIG: BANNER SLIDER */}
                {activeWidgetType === 'banner-slider' && (
                  <div className="space-y-4">
                    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-semibold flex items-center gap-2"><Images className="h-4 w-4" /> Slides</Label>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 text-xs"
                          onClick={() => {
                            const n = bannerSliderConfig.slides.length + 1;
                            setBannerSliderConfig({
                              ...bannerSliderConfig,
                              slides: [...bannerSliderConfig.slides, {
                                id: makeSlideId(),
                                name: `Slide ${n}`,
                                active: true,
                                imageDesktop: '', imageTablet: '', imageMobile: '',
                                alt: '', href: '', newTab: false,
                              }],
                            });
                          }}
                        >
                          <Plus className="h-3.5 w-3.5" /> Adicionar slide
                        </Button>
                      </div>

                      <div className="space-y-2">
                        {bannerSliderConfig.slides.map((slide: any, idx: number) => {
                          const update = (patch: any) => {
                            const slides = [...bannerSliderConfig.slides];
                            slides[idx] = { ...slides[idx], ...patch };
                            setBannerSliderConfig({ ...bannerSliderConfig, slides });
                          };
                          const move = (dir: -1 | 1) => {
                            const j = idx + dir;
                            if (j < 0 || j >= bannerSliderConfig.slides.length) return;
                            const slides = [...bannerSliderConfig.slides];
                            [slides[idx], slides[j]] = [slides[j], slides[idx]];
                            setBannerSliderConfig({ ...bannerSliderConfig, slides });
                          };
                          const remove = () => {
                            if (bannerSliderConfig.slides.length <= 1) {
                              toast({ title: 'Ao menos 1 slide', description: 'O slider precisa ter pelo menos um slide.', variant: 'destructive' });
                              return;
                            }
                            setBannerSliderConfig({
                              ...bannerSliderConfig,
                              slides: bannerSliderConfig.slides.filter((_: any, i: number) => i !== idx),
                            });
                          };
                          const duplicate = () => {
                            const clone = { ...slide, id: makeSlideId(), name: `${slide.name} (cópia)` };
                            const slides = [...bannerSliderConfig.slides];
                            slides.splice(idx + 1, 0, clone);
                            setBannerSliderConfig({ ...bannerSliderConfig, slides });
                          };
                          const thumb = slide.imageDesktop || slide.imageTablet || slide.imageMobile;
                          return (
                            <details key={slide.id} className="group rounded-md border border-border bg-background overflow-hidden">
                              <summary className="flex items-center gap-2 p-2 cursor-pointer list-none [&::-webkit-details-marker]:hidden hover:bg-muted/40">
                                <div className="h-10 w-16 rounded bg-muted overflow-hidden shrink-0 border border-border">
                                  {thumb ? <img src={thumb} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full flex items-center justify-center text-muted-foreground"><Images className="h-4 w-4" /></div>}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-semibold truncate">{slide.name || `Slide ${idx + 1}`}</div>
                                  <div className="text-[10px] text-muted-foreground">{slide.active ? 'Ativo' : 'Inativo'} · {idx + 1}/{bannerSliderConfig.slides.length}</div>
                                </div>
                                <button type="button" onClick={(e) => { e.preventDefault(); move(-1); }} className="p-1 rounded hover:bg-muted" aria-label="Mover para cima"><ArrowUp className="h-3.5 w-3.5" /></button>
                                <button type="button" onClick={(e) => { e.preventDefault(); move(1); }} className="p-1 rounded hover:bg-muted" aria-label="Mover para baixo"><ArrowDown className="h-3.5 w-3.5" /></button>
                                <Switch checked={!!slide.active} onCheckedChange={(v) => update({ active: v })} onClick={(e) => e.stopPropagation()} />
                                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
                              </summary>
                              <div className="p-3 border-t border-border space-y-3 bg-muted/20">
                                <div className="space-y-1.5">
                                  <Label className="text-xs">Nome interno</Label>
                                  <Input value={slide.name} onChange={(e) => update({ name: e.target.value })} className="h-8 text-xs" />
                                </div>
                                <div className="grid grid-cols-1 gap-3">
                                  <div>
                                    <Label className="text-[11px] text-muted-foreground">Imagem Desktop (1916×821)</Label>
                                    <FileUpload mode="single" label="" url={slide.imageDesktop} onChange={(v: any) => update({ imageDesktop: v })} />
                                  </div>
                                  <div>
                                    <Label className="text-[11px] text-muted-foreground">Imagem Tablet (1536×1024)</Label>
                                    <FileUpload mode="single" label="" url={slide.imageTablet} onChange={(v: any) => update({ imageTablet: v })} />
                                  </div>
                                  <div>
                                    <Label className="text-[11px] text-muted-foreground">Imagem Mobile (1080×1440)</Label>
                                    <FileUpload mode="single" label="" url={slide.imageMobile} onChange={(v: any) => update({ imageMobile: v })} />
                                  </div>
                                </div>
                                <div className="space-y-1.5">
                                  <Label className="text-xs">Texto alternativo (alt)</Label>
                                  <Input value={slide.alt} onChange={(e) => update({ alt: e.target.value })} placeholder="Descreva a imagem" className="h-8 text-xs" />
                                </div>
                                <div className="space-y-1.5">
                                  <Label className="text-xs">Link ao clicar</Label>
                                  <Input value={slide.href} onChange={(e) => update({ href: e.target.value })} placeholder="https://..." className="h-8 text-xs" />
                                </div>
                                <div className="flex items-center justify-between">
                                  <Label className="text-xs cursor-pointer">Abrir em nova aba</Label>
                                  <Switch checked={!!slide.newTab} onCheckedChange={(v) => update({ newTab: v })} />
                                </div>
                                <div className="flex gap-2 pt-1">
                                  <Button type="button" size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={duplicate}><Copy className="h-3 w-3 mr-1" /> Duplicar</Button>
                                  <Button type="button" size="sm" variant="outline" className="h-7 text-xs text-destructive hover:text-destructive flex-1" onClick={remove}><Trash2 className="h-3 w-3 mr-1" /> Excluir</Button>
                                </div>
                              </div>
                            </details>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
                      <Label className="text-sm font-semibold flex items-center gap-2"><Settings className="h-4 w-4" /> Configurações Gerais</Label>

                      <div className="flex items-center justify-between">
                        <Label className="text-xs cursor-pointer">Autoplay</Label>
                        <Switch checked={bannerSliderConfig.autoplay} onCheckedChange={(v) => setBannerSliderConfig({ ...bannerSliderConfig, autoplay: v })} />
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs"><Label>Intervalo entre slides</Label><span className="text-muted-foreground">{bannerSliderConfig.intervalMs}ms</span></div>
                        <Slider value={[bannerSliderConfig.intervalMs]} min={2000} max={10000} step={500} onValueChange={(v) => setBannerSliderConfig({ ...bannerSliderConfig, intervalMs: v[0] })} />
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs"><Label>Velocidade da transição</Label><span className="text-muted-foreground">{bannerSliderConfig.transitionMs}ms</span></div>
                        <Slider value={[bannerSliderConfig.transitionMs]} min={200} max={1500} step={50} onValueChange={(v) => setBannerSliderConfig({ ...bannerSliderConfig, transitionMs: v[0] })} />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">Efeito</Label>
                        <Select value={bannerSliderConfig.effect} onValueChange={(v) => setBannerSliderConfig({ ...bannerSliderConfig, effect: v as any })}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="slide">Deslizar</SelectItem>
                            <SelectItem value="fade">Fade</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center justify-between"><Label className="text-xs cursor-pointer">Loop infinito</Label><Switch checked={bannerSliderConfig.loop} onCheckedChange={(v) => setBannerSliderConfig({ ...bannerSliderConfig, loop: v })} /></div>
                      <div className="flex items-center justify-between"><Label className="text-xs cursor-pointer">Setas de navegação</Label><Switch checked={bannerSliderConfig.showArrows} onCheckedChange={(v) => setBannerSliderConfig({ ...bannerSliderConfig, showArrows: v })} /></div>
                      <div className="flex items-center justify-between"><Label className="text-xs cursor-pointer">Indicadores (dots)</Label><Switch checked={bannerSliderConfig.showPagination} onCheckedChange={(v) => setBannerSliderConfig({ ...bannerSliderConfig, showPagination: v })} /></div>
                      <div className="flex items-center justify-between"><Label className="text-xs cursor-pointer">Lazy load das imagens</Label><Switch checked={bannerSliderConfig.lazyLoad} onCheckedChange={(v) => setBannerSliderConfig({ ...bannerSliderConfig, lazyLoad: v })} /></div>
                      <div className="flex items-center justify-between"><Label className="text-xs cursor-pointer">Pausar ao passar o mouse</Label><Switch checked={bannerSliderConfig.pauseOnHover} onCheckedChange={(v) => setBannerSliderConfig({ ...bannerSliderConfig, pauseOnHover: v })} /></div>
                    </div>
                  </div>
                )}


                {/* CONFIG: GATEWAY */}
                {activeWidgetType === 'gateway' && (
                  <div className="space-y-4">
                    <CollapsibleSection title="Layout & estrutura" defaultOpen>
                    <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
                      <Label>Modelo de layout</Label>
                      <p className="text-xs text-muted-foreground">Escolha uma variação visual pré-definida. Você pode editar tudo depois.</p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem' }}>
                        {GATEWAY_PRESETS.map((preset) => (
                          <Button
                            key={preset.id}
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-auto min-w-0 w-full justify-center text-center"
                            onClick={() => setGatewayConfig({ ...gatewayConfig, ...preset.style })}
                          >
                            {preset.name}
                          </Button>
                        ))}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <Label>Barra fixa no rodapé (mobile)</Label>
                        <p className="text-xs text-muted-foreground">No celular, exibe os cards como um menu fixo no rodapé.</p>
                      </div>
                      <Switch checked={!!gatewayConfig.mobileFooterBar} onCheckedChange={(v) => setGatewayConfig({ ...gatewayConfig, mobileFooterBar: v })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Organização (estrutura)</Label>
                      <select
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={gatewayConfig.layout ?? 'top-center'}
                        onChange={(e) => setGatewayConfig({ ...gatewayConfig, layout: e.target.value })}
                      >
                        <option value="top-center">Título no topo, cards centralizados</option>
                        <option value="top-left">Título no topo, alinhado à esquerda</option>
                        <option value="split">Dividido (título ao lado dos cards)</option>
                        <option value="grid2">Grade de 2 colunas</option>
                        <option value="grid3">Grade de 3 colunas</option>
                        <option value="list">Lista em linhas (ícone à esquerda)</option>
                        <option value="no-title">Somente cards (sem título)</option>
                      </select>
                    </div>
                    </div>
                    </CollapsibleSection>
                    <CollapsibleSection title="Textos & fontes" defaultOpen>
                    <div className="space-y-2">
                      <Label>Título</Label>
                      <Input value={gatewayConfig.title} onChange={(e) => setGatewayConfig({...gatewayConfig, title: e.target.value})} />
                      <FontSelect
                        value={gatewayConfig.titleFont}
                        weight={gatewayConfig.titleFontWeight}
                        style={gatewayConfig.titleFontStyle}
                        onChange={(v) => setGatewayConfig({...gatewayConfig, titleFont: v})}
                        onWeightChange={(v) => setGatewayConfig({...gatewayConfig, titleFontWeight: v})}
                        onStyleChange={(v) => setGatewayConfig({...gatewayConfig, titleFontStyle: v})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Subtítulo</Label>
                      <Input value={gatewayConfig.subtitle} onChange={(e) => setGatewayConfig({...gatewayConfig, subtitle: e.target.value})} />
                      <FontSelect
                        value={gatewayConfig.subtitleFont}
                        weight={gatewayConfig.subtitleFontWeight}
                        style={gatewayConfig.subtitleFontStyle}
                        onChange={(v) => setGatewayConfig({...gatewayConfig, subtitleFont: v})}
                        onWeightChange={(v) => setGatewayConfig({...gatewayConfig, subtitleFontWeight: v})}
                        onStyleChange={(v) => setGatewayConfig({...gatewayConfig, subtitleFontStyle: v})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Cor do Texto</Label>
                      <ColorField value={gatewayConfig.titleColor} onChange={(v) => setGatewayConfig({...gatewayConfig, titleColor: v})} />
                    </div>

                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={!!gatewayConfig.labelHoverFromIcon}
                        onChange={(e) => setGatewayConfig({...gatewayConfig, labelHoverFromIcon: e.target.checked})}
                      />
                      Título do cartão muda para a cor do ícone no hover
                    </label>
                    </CollapsibleSection>



                    <CollapsibleSection title="Cores & fonte global" defaultOpen>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Cor do Cartão</Label>
                        <ColorField value={gatewayConfig.cardBgColor} onChange={(v) => setGatewayConfig({...gatewayConfig, cardBgColor: v})} />
                      </div>
                      <div className="space-y-2">
                        <Label>Cor da Pílula</Label>
                        <ColorField value={gatewayConfig.pillBgColor} onChange={(v) => setGatewayConfig({...gatewayConfig, pillBgColor: v})} />
                      </div>
                      <div className="space-y-2">
                        <Label>Cor do Texto da Pílula</Label>
                        <ColorField value={gatewayConfig.pillTextColor} onChange={(v) => setGatewayConfig({...gatewayConfig, pillTextColor: v})} />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Fonte global do widget</Label>
                      <FontSelect
                        value={gatewayConfig.fontFamily ?? 'system-ui, -apple-system, sans-serif'}
                        weight={gatewayConfig.fontWeight}
                        style={gatewayConfig.fontStyle}
                        onChange={(v) => setGatewayConfig({...gatewayConfig, fontFamily: v || 'system-ui, -apple-system, sans-serif'})}
                        onWeightChange={(v) => setGatewayConfig({...gatewayConfig, fontWeight: v})}
                        onStyleChange={(v) => setGatewayConfig({...gatewayConfig, fontStyle: v})}
                      />
                    </div>
                    </CollapsibleSection>

                    <CollapsibleSection title="Animação de entrada" defaultOpen>
                    <div className="space-y-2">
                      <Label>Animação de Entrada</Label>
                      <select
                        className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                        value={gatewayConfig.entranceAnim ?? 'none'}
                        onChange={(e) => setGatewayConfig({...gatewayConfig, entranceAnim: e.target.value})}
                      >
                        <option value="none">Nenhuma</option>
                        <option value="fade">Fade (aparecer)</option>
                        <option value="up">Subir</option>
                        <option value="zoom">Zoom</option>
                        <option value="slide">Deslizar</option>
                      </select>
                      {gatewayConfig.entranceAnim && gatewayConfig.entranceAnim !== 'none' && (
                        <div className="space-y-2 pt-1">
                          <div className="flex items-center justify-between">
                            <Label>Duração</Label>
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                className="h-7 w-16 text-xs"
                                value={gatewayConfig.entranceDuration ?? 600}
                                onChange={(e) => setGatewayConfig({...gatewayConfig, entranceDuration: Number(e.target.value) || 0})}
                              />
                              <span className="text-xs text-muted-foreground">ms</span>
                            </div>
                          </div>
                          <Slider min={100} max={2000} step={50} value={[gatewayConfig.entranceDuration ?? 600]} onValueChange={([v]) => setGatewayConfig({...gatewayConfig, entranceDuration: v})} />
                          <div className="flex items-center justify-between pt-1">
                            <div>
                              <Label>Animação sincronizada</Label>
                              <p className="text-xs text-muted-foreground">{gatewayConfig.entranceSync ? 'Dupla: todos os cards entram juntos' : 'Individual: entrada escalonada'}</p>
                            </div>
                            <Switch checked={!!gatewayConfig.entranceSync} onCheckedChange={(v) => setGatewayConfig({...gatewayConfig, entranceSync: v})} />
                          </div>
                        </div>
                      )}
                    </div>
                    </CollapsibleSection>

                    <CollapsibleSection title="Dimensões por dispositivo" defaultOpen>
                    <div className="space-y-3 rounded-lg border p-3">
                      <div className="flex items-center justify-between">
                        <Label className="font-semibold">Dimensões por dispositivo</Label>
                      </div>
                      <p className="text-xs text-muted-foreground">Tablet e mobile herdam o desktop até serem ajustados. A cor do ícone é global.</p>
                      <div className="flex gap-1 rounded-md bg-muted/40 p-1">
                        {([
                          { id: 'desktop' as DeviceView, label: 'Desktop', icon: Monitor },
                          { id: 'tablet' as DeviceView, label: 'Tablet', icon: Tablet },
                          { id: 'mobile' as DeviceView, label: 'Mobile', icon: Smartphone },
                        ]).map((d) => (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => { setPanelDevice(d.id); setDeviceView(d.id); }}
                            className={cn(
                              'flex flex-1 items-center justify-center gap-1 rounded px-2 py-1.5 text-xs font-medium transition',
                              panelDevice === d.id ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
                            )}
                          >
                            <d.icon className="h-3.5 w-3.5" /> {d.label}
                          </button>
                        ))}
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Altura da Pílula</Label>
                          <div className="flex items-center gap-1">
                            <Input type="number" className="h-7 w-16 text-xs"
                              value={gwGet('pillHeight', panelDevice)}
                              onChange={(e) => gwSet('pillHeight', panelDevice, Number(e.target.value) || 0)} />
                            <span className="text-xs text-muted-foreground">px</span>
                          </div>
                        </div>
                        <Slider min={16} max={64} step={1} value={[gwGet('pillHeight', panelDevice)]} onValueChange={([v]) => gwSet('pillHeight', panelDevice, v)} />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Largura da Pílula <span className="text-xs text-muted-foreground">(0 = automática)</span></Label>
                          <div className="flex items-center gap-1">
                            <Input type="number" className="h-7 w-16 text-xs"
                              value={gwGet('pillWidth', panelDevice)}
                              onChange={(e) => gwSet('pillWidth', panelDevice, Number(e.target.value) || 0)} />
                            <span className="text-xs text-muted-foreground">px</span>
                          </div>
                        </div>
                        <Slider min={0} max={320} step={1} value={[gwGet('pillWidth', panelDevice)]} onValueChange={([v]) => gwSet('pillWidth', panelDevice, v)} />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Cantos Arredondados</Label>
                          <div className="flex items-center gap-1">
                            <Input type="number" className="h-7 w-16 text-xs"
                              value={gwGet('cardRadius', panelDevice)}
                              onChange={(e) => gwSet('cardRadius', panelDevice, Number(e.target.value) || 0)} />
                            <span className="text-xs text-muted-foreground">px</span>
                          </div>
                        </div>
                        <Slider min={0} max={80} step={1} value={[gwGet('cardRadius', panelDevice)]} onValueChange={([v]) => gwSet('cardRadius', panelDevice, v)} />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Largura do Cartão</Label>
                          <div className="flex items-center gap-1">
                            <Input type="number" className="h-7 w-16 text-xs"
                              value={gwGet('cardWidth', panelDevice)}
                              onChange={(e) => gwSet('cardWidth', panelDevice, Number(e.target.value) || 0)} />
                            <span className="text-xs text-muted-foreground">px</span>
                          </div>
                        </div>
                        <Slider min={120} max={320} step={4} value={[gwGet('cardWidth', panelDevice)]} onValueChange={([v]) => gwSet('cardWidth', panelDevice, v)} />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Altura do Cartão</Label>
                          <div className="flex items-center gap-1">
                            <Input type="number" className="h-7 w-16 text-xs"
                              value={gwGet('cardHeight', panelDevice)}
                              onChange={(e) => gwSet('cardHeight', panelDevice, Number(e.target.value) || 0)} />
                            <span className="text-xs text-muted-foreground">px</span>
                          </div>
                        </div>
                        <Slider min={120} max={320} step={4} value={[gwGet('cardHeight', panelDevice)]} onValueChange={([v]) => gwSet('cardHeight', panelDevice, v)} />
                      </div>
                    </div>
                    </CollapsibleSection>

                    <CollapsibleSection title="Cartões de opção" defaultOpen>
                    <div className="space-y-3 pt-2 border-t">
                      <div className="flex items-center justify-between">
                        <Label className="font-semibold">Cartões de Opção</Label>
                        <Button
                          type="button" variant="outline" size="sm" className="gap-1"
                          onClick={() => setGatewayConfig({...gatewayConfig, options: [...(gatewayConfig.options || []), { id: Math.random().toString(36).slice(2, 8), icon: '⭐', iconColor: '#4f46e5', cardLabel: 'Nova Opção', labelFont: '', labelFontWeight: '700', labelFontStyle: 'normal', pillText: '', pillFont: '', pillFontWeight: '500', pillFontStyle: 'normal', link: '#' }]})}
                        >
                          <Plus className="h-3 w-3" /> Adicionar
                        </Button>
                      </div>
                      {(gatewayConfig.options || []).map((opt: any, idx: number) => {
                        const update = (patch: any) => {
                          const next = [...(gatewayConfig.options || [])];
                          next[idx] = { ...next[idx], ...patch };
                          setGatewayConfig({...gatewayConfig, options: next});
                        };
                        return (
                          <div key={opt.id ?? idx} className="space-y-2 rounded-lg border p-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-muted-foreground">Cartão {idx + 1}</span>
                              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setGatewayConfig({...gatewayConfig, options: gatewayConfig.options.filter((_: any, i: number) => i !== idx)})}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                            <div className="space-y-3">
                              <div className="space-y-1.5">
                                <Label className="text-xs">Título</Label>
                                <Input value={opt.cardLabel} onChange={(e) => update({ cardLabel: e.target.value })} />
                                <FontSelect
                                  value={opt.labelFont}
                                  weight={opt.labelFontWeight}
                                  style={opt.labelFontStyle}
                                  onChange={(v) => update({ labelFont: v })}
                                  onWeightChange={(v) => update({ labelFontWeight: v })}
                                  onStyleChange={(v) => update({ labelFontStyle: v })}
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs">Cor do ícone</Label>
                                <ColorField value={opt.iconColor} onChange={(v) => update({ iconColor: v })} />
                              </div>
                            </div>

                            <div className="space-y-2 rounded-md border border-input p-2">
                              <p className="text-[11px] text-muted-foreground">Cole o código SVG ou anexe um arquivo .svg — o conteúdo é embutido direto no código gerado.</p>
                              {([
                                { key: 'svgStatic', label: 'SVG estático (obrigatório)', ph: '<svg ...>...</svg>' },
                                { key: 'svgHover', label: 'SVG hover (ao passar o mouse)', ph: '<svg ...>...</svg> (opcional)' },
                                { key: 'svgActive', label: 'SVG clique', ph: '<svg ...>...</svg> (opcional)' },
                              ] as const).map((f) => (
                                <div className="space-y-1" key={f.key}>
                                  <div className="flex items-center justify-between gap-2">
                                    <Label className="text-xs">{f.label}</Label>
                                    <label className="cursor-pointer text-[11px] text-primary hover:underline">
                                      Anexar .svg
                                      <input
                                        type="file"
                                        accept=".svg,image/svg+xml"
                                        className="hidden"
                                        onChange={(e) => {
                                          const file = e.target.files?.[0];
                                          if (!file) return;
                                          const reader = new FileReader();
                                          reader.onload = () => update({ [f.key]: String(reader.result || '') });
                                          reader.readAsText(file);
                                          e.target.value = '';
                                        }}
                                      />
                                    </label>
                                  </div>
                                  <textarea
                                    className="w-full min-h-[64px] rounded-md border border-input bg-background px-3 py-2 text-xs font-mono"
                                    value={(opt as any)[f.key] || ''}
                                    onChange={(e) => update({ [f.key]: e.target.value })}
                                    placeholder={f.ph}
                                  />
                                </div>
                              ))}

                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <Label className="text-xs">Tamanho do ícone</Label>
                                  <div className="flex items-center gap-1">
                                    <Input
                                      type="number"
                                      className="h-7 w-16 text-xs"
                                      value={opt.svgSize ?? 56}
                                      onChange={(e) => update({ svgSize: Number(e.target.value) || 0 })}
                                    />
                                    <span className="text-xs text-muted-foreground">px</span>
                                  </div>
                                </div>
                                <Slider
                                  min={16}
                                  max={160}
                                  step={1}
                                  value={[opt.svgSize ?? 56]}
                                  onValueChange={([val]) => update({ svgSize: val })}
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <Label className="text-xs">Transição (ms)</Label>
                                  <Input
                                    type="number"
                                    value={opt.svgTransition ?? 300}
                                    onChange={(e) => update({ svgTransition: Number(e.target.value) })}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Efeito de transição</Label>
                                  <select
                                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                                    value={['ease', 'linear', 'ease-in', 'ease-out', 'ease-in-out', 'cubic-bezier(.34,1.56,.64,1)'].includes(opt.svgEasing) ? 'fade' : (opt.svgEasing || 'fade')}
                                    onChange={(e) => update({ svgEasing: e.target.value })}
                                  >
                                    <option value="fade">Opacidade suave</option>
                                    <option value="soft">Subir suave</option>
                                    <option value="slide">Deslizar lateral</option>
                                    <option value="blur">Desfoque</option>
                                    <option value="snap">Troca imediata</option>
                                  </select>
                                </div>
                              </div>
                              <label className="flex items-center gap-2 text-xs">
                                <input
                                  type="checkbox"
                                  checked={!!opt.svgClickHold}
                                  onChange={(e) => update({ svgClickHold: e.target.checked })}
                                />
                                Manter estado de clique
                              </label>
                            </div>
                            {opt.lordIcon && (
                              <div className="space-y-1">
                                <Label className="text-xs">Animação</Label>
                                <select
                                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                                  value={opt.lordTrigger || 'boomerang'}
                                  onChange={(e) => update({ lordTrigger: e.target.value })}
                                >
                                  <option value="boomerang">Bumerangue (vai no hover, volta ao sair)</option>
                                  <option value="loop">Loop (repete enquanto o mouse está em cima)</option>
                                </select>
                              </div>
                            )}
                            {opt.lordIcon && (
                              <div className="space-y-2 rounded-md border border-input p-2">
                                <div className="flex items-center justify-between gap-2">
                                  <label className="flex items-center gap-2 text-xs">
                                    <input
                                      type="checkbox"
                                      checked={!!opt.lordKeepColors}
                                      onChange={(e) => update({ lordKeepColors: e.target.checked })}
                                    />
                                    Manter cores originais do ícone
                                  </label>
                                  {!opt.lordKeepColors && (
                                    <Button
                                      type="button" variant="outline" size="sm" className="h-7 text-xs"
                                      onClick={async () => {
                                        try {
                                          const res = await fetch(opt.lordIcon);
                                          const data = await res.json();
                                          const palette = extractLordColors(data);
                                          if (!palette.length) {
                                            toast({ title: 'Nenhuma cor encontrada', description: 'Não foi possível ler cores sólidas deste ícone.' });
                                            return;
                                          }
                                          update({
                                            lordData: data,
                                            lordDataVersion: Date.now(),
                                            lordColors: palette.map((slot) => ({ index: slot.index, original: slot.original, value: slot.original })),
                                          });
                                          toast({ title: 'Cores detectadas', description: `${palette.length} cor(es) encontrada(s).` });
                                        } catch {
                                          toast({ title: 'Erro ao ler o ícone', description: 'Verifique a URL do JSON.', variant: 'destructive' });
                                        }
                                      }}
                                    >
                                      Detectar cores
                                    </Button>
                                  )}
                                </div>
                                {!opt.lordKeepColors && Array.isArray(opt.lordColors) && opt.lordColors.length > 0 ? (
                                  <div className="grid grid-cols-2 gap-2">
                                    {opt.lordColors.map((c: any, ci: number) => (
                                      <div key={ci} className="space-y-1">
                                        <Label className="text-xs">Cor {ci + 1}</Label>
                                        <ColorField
                                          value={c.value}
                                          onChange={(v) => {
                                            const next = [...opt.lordColors];
                                            next[ci] = { ...next[ci], value: v };
                                            update({ lordColors: next });
                                          }}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                ) : !opt.lordKeepColors && (
                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                      <Label className="text-xs">Cor primária</Label>
                                      <ColorField value={opt.lordPrimary || opt.iconColor} onChange={(v) => update({ lordPrimary: v })} />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-xs">Cor secundária</Label>
                                      <ColorField value={opt.lordSecondary || opt.lordPrimary || opt.iconColor} onChange={(v) => update({ lordSecondary: v })} />
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                            <div className="space-y-1">
                              <Label className="text-xs">Pílula (texto de apoio)</Label>
                              <Input value={opt.pillText} onChange={(e) => update({ pillText: e.target.value })} />
                              <FontSelect
                                value={opt.pillFont}
                                weight={opt.pillFontWeight}
                                style={opt.pillFontStyle}
                                onChange={(v) => update({ pillFont: v })}
                                onWeightChange={(v) => update({ pillFontWeight: v })}
                                onStyleChange={(v) => update({ pillFontStyle: v })}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Link</Label>
                              <Input value={opt.link} onChange={(e) => update({ link: e.target.value })} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    </CollapsibleSection>
                  </div>
                )}

                {/* CONFIG: ABA LATERAL */}
                {activeWidgetType === 'sidetab' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Texto</Label>
                      <Input value={sidetabConfig.label} onChange={(e) => setSidetabConfig({...sidetabConfig, label: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <Label>Link</Label>
                      <Input value={sidetabConfig.link} onChange={(e) => setSidetabConfig({...sidetabConfig, link: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Cor de Fundo</Label>
                        <ColorField value={sidetabConfig.bgColor} onChange={(v) => setSidetabConfig({...sidetabConfig, bgColor: v})} />
                      </div>
                      <div className="space-y-2">
                        <Label>Cor do Texto</Label>
                        <ColorField value={sidetabConfig.textColor} onChange={(v) => setSidetabConfig({...sidetabConfig, textColor: v})} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Lado</Label>
                      <div className="flex gap-2">
                        <Button type="button" variant={sidetabConfig.side === 'left' ? 'default' : 'outline'} className="flex-1" onClick={() => setSidetabConfig({...sidetabConfig, side: 'left'})}>Esquerda</Button>
                        <Button type="button" variant={sidetabConfig.side === 'right' ? 'default' : 'outline'} className="flex-1" onClick={() => setSidetabConfig({...sidetabConfig, side: 'right'})}>Direita</Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Distância da base (px)</Label>
                        <Input type="number" className="w-20 h-7" value={sidetabConfig.position} onChange={(e) => setSidetabConfig({...sidetabConfig, position: Number(e.target.value) || 0})} />
                      </div>
                      <Slider min={0} max={400} step={4} value={[sidetabConfig.position]} onValueChange={([v]) => setSidetabConfig({...sidetabConfig, position: v})} />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Tamanho da Fonte (px)</Label>
                        <Input type="number" className="w-20 h-7" value={sidetabConfig.fontSize} onChange={(e) => setSidetabConfig({...sidetabConfig, fontSize: Number(e.target.value) || 0})} />
                      </div>
                      <Slider min={10} max={28} step={1} value={[sidetabConfig.fontSize]} onValueChange={([v]) => setSidetabConfig({...sidetabConfig, fontSize: v})} />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Cantos Arredondados (px)</Label>
                        <Input type="number" className="w-20 h-7" value={sidetabConfig.radius} onChange={(e) => setSidetabConfig({...sidetabConfig, radius: Number(e.target.value) || 0})} />
                      </div>
                      <Slider min={0} max={40} step={1} value={[sidetabConfig.radius]} onValueChange={([v]) => setSidetabConfig({...sidetabConfig, radius: v})} />
                    </div>
                  </div>
                )}




                {/* CONFIG: MENU */}
                {activeWidgetType === 'menu' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>URL do Logo (Desktop)</Label>
                      <Input 
                        value={menuConfig.logoUrl}
                        onChange={(e) => setMenuConfig({...menuConfig, logoUrl: e.target.value})}
                        placeholder="https://sua-logo.png"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>URL do Logo (Mobile / Tablet)</Label>
                      <Input 
                        value={menuConfig.logoUrlMobile}
                        onChange={(e) => setMenuConfig({...menuConfig, logoUrlMobile: e.target.value})}
                        placeholder="Opcional — logo alternativa em telas pequenas"
                      />
                      <p className="text-xs text-muted-foreground">Se vazio, usa o logo desktop também no mobile/tablet.</p>
                    </div>
                    {(/\.svg(\?|#|$)/i.test(menuConfig.logoUrl) || /\.svg(\?|#|$)/i.test(menuConfig.logoUrlMobile)) && (
                      <div className="space-y-2">
                        <Label>Cor do Logo (SVG)</Label>
                        <div className="flex items-center gap-2">
                          <ColorField
                            value={menuConfig.logoColor || '#000000'}
                            onChange={(v) => setMenuConfig({...menuConfig, logoColor: v})}
                          />
                          <Input
                            value={menuConfig.logoColor}
                            onChange={(e) => setMenuConfig({...menuConfig, logoColor: e.target.value})}
                            placeholder="Ex: #4f46e5 (vazio = cor original)"
                          />
                          {menuConfig.logoColor && (
                            <Button variant="outline" size="sm" onClick={() => setMenuConfig({...menuConfig, logoColor: ''})}>Limpar</Button>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">Detectado SVG: aplica esta cor ao logo. Deixe vazio para manter as cores originais.</p>
                      </div>
                    )}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-2">
                        <Label className="text-xs">Fundo</Label>
                        <ColorField
                          value={menuConfig.bgColor}
                          onChange={(v) => setMenuConfig({...menuConfig, bgColor: v})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Texto</Label>
                        <ColorField
                          value={menuConfig.textColor}
                          onChange={(v) => setMenuConfig({...menuConfig, textColor: v})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Destaque</Label>
                        <ColorField
                          value={menuConfig.accentColor}
                          onChange={(v) => setMenuConfig({...menuConfig, accentColor: v})}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Fonte</Label>
                      <FontSelect
                        value={menuConfig.fontFamily}
                        weight={menuConfig.fontWeight}
                        style={menuConfig.fontStyle}
                        onChange={(v) => setMenuConfig({...menuConfig, fontFamily: v || 'system-ui, -apple-system, sans-serif'})}
                        onWeightChange={(v) => setMenuConfig({...menuConfig, fontWeight: v})}
                        onStyleChange={(v) => setMenuConfig({...menuConfig, fontStyle: v})}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-2">
                        <Label className="text-xs">Fonte (px)</Label>
                        <Input 
                          type="number" min={10} max={24}
                          value={menuConfig.fontSize}
                          onChange={(e) => setMenuConfig({...menuConfig, fontSize: Number(e.target.value) || 15})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Espaço (px)</Label>
                        <Input 
                          type="number" min={0} max={40}
                          value={menuConfig.itemSpacing}
                          onChange={(e) => setMenuConfig({...menuConfig, itemSpacing: Number(e.target.value) || 0})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Padding (px)</Label>
                        <Input 
                          type="number" min={4} max={40}
                          value={menuConfig.itemPadding}
                          onChange={(e) => setMenuConfig({...menuConfig, itemPadding: Number(e.target.value) || 15})}
                        />
                      </div>
                    </div>

                     <CollapsibleSection title="Mouse sobre o item (hover)">
                       <div className="grid grid-cols-2 gap-3">
                         <div className="space-y-2">
                           <Label className="text-xs">Fundo hover</Label>
                           <ColorField
                             value={menuConfig.hoverBgColor}
                             onChange={(v) => setMenuConfig({...menuConfig, hoverBgColor: v})} />
                         </div>
                         <div className="space-y-2">
                           <Label className="text-xs">Texto hover</Label>
                           <ColorField
                             value={menuConfig.hoverTextColor}
                             onChange={(v) => setMenuConfig({...menuConfig, hoverTextColor: v})} />
                         </div>
                         <div className="space-y-2">
                           <Label className="text-xs">Cor borda hover</Label>
                           <ColorField
                             value={menuConfig.hoverBorderColor}
                             onChange={(v) => setMenuConfig({...menuConfig, hoverBorderColor: v})} />
                         </div>
                         <div className="space-y-2">
                           <Label className="text-xs">Espessura borda hover</Label>
                           <Input type="number" min={0} max={6}
                             value={menuConfig.hoverBorderWidth}
                             onChange={(e) => setMenuConfig({...menuConfig, hoverBorderWidth: Number(e.target.value) || 0})} />
                         </div>
                       </div>
                     </CollapsibleSection>

                     <CollapsibleSection title="Página ativa (borda)">
                       <div className="grid grid-cols-3 gap-3">
                         <div className="space-y-2">
                           <Label className="text-xs">Cor</Label>
                           <ColorField
                             value={menuConfig.activeBorderColor}
                             onChange={(v) => setMenuConfig({...menuConfig, activeBorderColor: v})} />
                         </div>
                         <div className="space-y-2">
                           <Label className="text-xs">Espessura</Label>
                           <Input type="number" min={0} max={6}
                             value={menuConfig.activeBorderWidth}
                             onChange={(e) => setMenuConfig({...menuConfig, activeBorderWidth: Number(e.target.value) || 0})} />
                         </div>
                         <div className="space-y-2">
                           <Label className="text-xs">Transição (s)</Label>
                           <Input type="number" min={0} step={0.1}
                             value={menuConfig.activeAnimDuration ?? 3}
                             onChange={(e) => setMenuConfig({...menuConfig, activeAnimDuration: Number(e.target.value) || 0})} />
                         </div>
                        </div>



                       {(() => {
                         const devs = [
                           { id: 'desktop' as const, label: 'PC', Icon: Monitor, border: 'border-blue-500', solid: 'bg-blue-500 border-blue-500 text-white' },
                           { id: 'tablet' as const, label: 'Tablet', Icon: Tablet, border: 'border-amber-500', solid: 'bg-amber-500 border-amber-500 text-white' },
                           { id: 'mobile' as const, label: 'Mobile', Icon: Smartphone, border: 'border-emerald-500', solid: 'bg-emerald-500 border-emerald-500 text-white' },
                         ];
                         const active = devs.find(d => d.id === panelDevice)!;
                         const ar = panelDevice === 'desktop' ? 'activeRadius' : panelDevice === 'tablet' ? 'activeRadiusTablet' : 'activeRadiusMobile';
                         const ir = panelDevice === 'desktop' ? 'itemRadius' : panelDevice === 'tablet' ? 'itemRadiusTablet' : 'itemRadiusMobile';
                         const sg = panelDevice === 'desktop' ? 'submenuGap' : panelDevice === 'tablet' ? 'submenuGapTablet' : 'submenuGapMobile';
                          const sis = panelDevice === 'desktop' ? 'submenuItemSpacing' : panelDevice === 'tablet' ? 'submenuItemSpacingTablet' : 'submenuItemSpacingMobile';
                         return (
                           <div className={cn('rounded-lg border-2 bg-transparent p-3 space-y-3 transition-colors', active.border)}>
                             <div className="grid grid-cols-3 gap-2">
                               {devs.map(d => (
                                  <button key={d.id} type="button" onClick={() => { setPanelDevice(d.id); setDeviceView(d.id); }}
                                   className={cn('flex items-center justify-center gap-1.5 rounded-md border-2 py-1.5 text-xs font-semibold transition-colors',
                                     panelDevice === d.id ? d.solid : 'border-transparent bg-muted/40 text-muted-foreground hover:bg-muted')}>
                                   <d.Icon className="h-3.5 w-3.5" />{d.label}
                                 </button>
                               ))}
                             </div>
                             <div className="space-y-2">
                               <Label className="text-xs">Raio ativo {active.label} (%): {menuConfig[ar]}%</Label>
                               <Slider min={0} max={100} step={1}
                                 value={[menuConfig[ar]]}
                                 onValueChange={(v) => { setEditingFocus('submenu'); setMenuConfig({...menuConfig, [ar]: v[0]}); }} />
                             </div>
                             <div className="space-y-2">
                               <Label className="text-xs">Arred. Itens {active.label} (%): {menuConfig[ir]}%</Label>
                               <Slider min={0} max={100} step={1}
                                 value={[menuConfig[ir]]}
                                 onValueChange={(v) => { setEditingFocus('submenu'); setMenuConfig({...menuConfig, [ir]: v[0]}); }} />
                             </div>
                             <div className="space-y-2">
                                <Label className="text-xs">Espaçamento janela submenu {active.label} (px): {menuConfig[sg]}px {menuConfig[sg] === 0 ? '(colado)' : ''}</Label>
                               <Slider min={0} max={40} step={1}
                                 value={[menuConfig[sg]]}
                                 onValueChange={(v) => { setEditingFocus('submenu'); setMenuConfig({...menuConfig, [sg]: v[0]}); }} />
                             </div>
                              <div className="space-y-2">
                                <Label className="text-xs">Espaçamento itens internos {active.label} (px): {menuConfig[sis]}px</Label>
                                <Slider min={0} max={32} step={1}
                                  value={[menuConfig[sis]]}
                                  onValueChange={(v) => { setEditingFocus('submenu'); setMenuConfig({...menuConfig, [sis]: v[0]}); }} />
                              </div>
                           </div>
                         );
                       })()}
                       <div className="space-y-2">
                         <Label className="text-xs">Tamanho da sombra (px): {menuConfig.shadowSize}px {menuConfig.shadowSize === 0 ? '(sem sombra)' : ''}</Label>
                         <Slider min={0} max={80} step={1}
                           value={[menuConfig.shadowSize]}
                           onValueChange={(v) => setMenuConfig({...menuConfig, shadowSize: v[0]})} />
                       </div>
                       <div className="space-y-2">
                         <Label className="text-xs">Intensidade da sombra (%): {menuConfig.shadowIntensity}%</Label>
                         <Slider min={0} max={100} step={1}
                           value={[menuConfig.shadowIntensity]}
                           onValueChange={(v) => setMenuConfig({...menuConfig, shadowIntensity: v[0]})} />
                       </div>
                       <div className="space-y-2">
                         <Label className="text-xs">Menu no Tablet</Label>
                         <div className="flex gap-2">
                           <Button type="button" size="sm" variant={(menuConfig.tabletMenuMode ?? 'header') === 'header' ? 'default' : 'outline'}
                             className="flex-1" onClick={() => setMenuConfig({...menuConfig, tabletMenuMode: 'header'})}>
                             Itens no cabeçalho (PC)
                           </Button>
                           <Button type="button" size="sm" variant={menuConfig.tabletMenuMode === 'hamburger' ? 'default' : 'outline'}
                             className="flex-1" onClick={() => setMenuConfig({...menuConfig, tabletMenuMode: 'hamburger'})}>
                             Hambúrguer
                           </Button>
                         </div>
                         <p className="text-xs text-muted-foreground">Escolha se o tablet mostra os itens de texto no cabeçalho (como no PC) ou o menu hambúrguer.</p>
                       </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label className="text-xs">Fundo (ativo)</Label>
                          <ColorField
                            value={menuConfig.activeBgColor === 'transparent' ? '#ffffff' : menuConfig.activeBgColor}
                            onChange={(v) => setMenuConfig({...menuConfig, activeBgColor: v})} />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Texto (ativo)</Label>
                          <ColorField
                            value={menuConfig.activeTextColor}
                            onChange={(v) => setMenuConfig({...menuConfig, activeTextColor: v})} />
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" className="h-7 text-[10px]"
                        onClick={() => setMenuConfig({...menuConfig, activeBgColor: 'transparent'})}>
                        Fundo transparente
                      </Button>
                     </CollapsibleSection>
                    <div className="flex gap-2">
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        className="flex-1 gap-2"
                        onClick={() => {
                          const frame = document.querySelector('iframe[title="Site Preview"]') as HTMLIFrameElement;
                          if (frame) {
                            frame.src = frame.src; // Força recarregamento e nova detecção
                            toast({ title: "Sincronizando...", description: "Refazendo varredura visual do site." });
                          }
                        }}
                      >
                        <RefreshCw className="h-3 w-3" /> Forçar Varredura Visual
                      </Button>
                    </div>

                    <div className="flex items-center justify-between border-t pt-4">
                      <Label htmlFor="sticky">Menu Fixo (Sticky)</Label>
                      <Switch 
                        id="sticky" 
                        checked={menuConfig.sticky}
                        onCheckedChange={(val) => setMenuConfig({...menuConfig, sticky: val})}
                      />
                    </div>

                    <div className="flex items-center justify-between border-t pt-4">
                      <Label htmlFor="searchEnabled">Barra de Busca</Label>
                      <Switch 
                        id="searchEnabled" 
                        checked={menuConfig.searchEnabled}
                        onCheckedChange={(val) => setMenuConfig({...menuConfig, searchEnabled: val})}
                      />
                    </div>
                    {menuConfig.searchEnabled && (
                      <div className="space-y-2">
                        <Label>URL de Busca do Site</Label>
                        <Input 
                          value={menuConfig.searchUrl}
                          onChange={(e) => setMenuConfig({...menuConfig, searchUrl: e.target.value})}
                          placeholder="https://seusite.com/"
                        />
                        <p className="text-xs text-muted-foreground">No WordPress use a URL base do site (ex: https://anabrasil.org/). A busca envia o termo via parâmetro <code>?s=</code>.</p>
                        {/* ===== Seção: Busca ===== */}
                        <div className="rounded-lg border p-3 mt-3 space-y-3 text-center">
                          <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground">Busca</p>
                          <div className="grid grid-cols-2 gap-3 text-left">
                            <div className="space-y-1">
                              <Label className="text-xs">Cor de Fundo</Label>
                              <ColorField value={menuConfig.searchBgColor || "#ffffff"} onChange={(v) => setMenuConfig({...menuConfig, searchBgColor: v})} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Cor do Ícone/Texto</Label>
                              <ColorField value={menuConfig.searchIconColor} onChange={(v) => setMenuConfig({...menuConfig, searchIconColor: v})} />
                            </div>
                          </div>
                          <div className="space-y-2 text-left">
                            <Label>Tamanho do Ícone Buscar: {menuConfig.searchIconSize}px</Label>
                            <Slider min={12} max={32} step={1} value={[menuConfig.searchIconSize]} onValueChange={([val]) => setMenuConfig({...menuConfig, searchIconSize: val})} />
                          </div>
                          <div className="space-y-2 text-left">
                            <Label>Arredondamento: {menuConfig.searchRadius}%</Label>
                            <Slider min={0} max={100} step={1} value={[menuConfig.searchRadius]} onValueChange={([val]) => setMenuConfig({...menuConfig, searchRadius: val})} />
                          </div>
                        </div>

                        {/* ===== Seção: Menu Hambúrguer (mobile/tablet) ===== */}
                        <div className="rounded-lg border p-3 mt-3 space-y-3 text-center">
                          <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground">Menu Hambúrguer</p>
                          <div className="grid grid-cols-2 gap-3 text-left">
                            <div className="space-y-1">
                              <Label className="text-xs">Cor do Ícone</Label>
                              <ColorField value={menuConfig.hamburgerColor} onChange={(v) => setMenuConfig({...menuConfig, hamburgerColor: v})} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Cor de Fundo</Label>
                              <ColorField value={menuConfig.hamburgerBgColor || "#ffffff"} onChange={(v) => setMenuConfig({...menuConfig, hamburgerBgColor: v})} />
                            </div>
                          </div>
                          <div className="space-y-2 text-left">
                            <Label>Tamanho do Ícone: {menuConfig.hamburgerSize}px</Label>
                            <Slider min={16} max={40} step={1} value={[menuConfig.hamburgerSize]} onValueChange={([val]) => setMenuConfig({...menuConfig, hamburgerSize: val})} />
                          </div>
                          <div className="space-y-2 text-left">
                            <Label>Tamanho do Fundo (quadrado): {menuConfig.toggleSize}px</Label>
                            <Slider min={28} max={60} step={1} value={[menuConfig.toggleSize]} onValueChange={([val]) => setMenuConfig({...menuConfig, toggleSize: val})} />
                          </div>
                          <div className="space-y-2 text-left">
                            <Label>Arredondamento: {menuConfig.hamburgerRadius}%</Label>
                            <Slider min={0} max={100} step={1} value={[menuConfig.hamburgerRadius]} onValueChange={([val]) => setMenuConfig({...menuConfig, hamburgerRadius: val})} />
                          </div>
                        </div>

                        {/* ===== Seção: Busca Mobile/Tablet (Spotlight) ===== */}
                        <div className="rounded-lg border p-3 mt-3 space-y-3 text-center">
                          <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground">Busca Mobile/Tablet (Spotlight)</p>
                          <div className="space-y-2 text-left">
                            <Label>Arredondamento: {menuConfig.spotlightRadius}%</Label>
                            <Slider min={0} max={100} step={1} value={[menuConfig.spotlightRadius]} onValueChange={([val]) => setMenuConfig({...menuConfig, spotlightRadius: val})} />
                          </div>
                          <div className="space-y-2 text-left">
                            <Label>Padding Lateral: {menuConfig.spotlightPaddingX}px</Label>
                            <Slider min={0} max={80} step={1} value={[menuConfig.spotlightPaddingX]} onValueChange={([val]) => setMenuConfig({...menuConfig, spotlightPaddingX: val})} />
                          </div>
                          <div className="space-y-1 text-left">
                            <Label>Alinhamento Vertical</Label>
                            <Select value={menuConfig.spotlightAlign} onValueChange={(val) => setMenuConfig({...menuConfig, spotlightAlign: val})}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="top">Superior</SelectItem>
                                <SelectItem value="center">Centro</SelectItem>
                                <SelectItem value="bottom">Inferior</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-4 pt-2 border-t mt-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="text-sm">Sincronizar via API WP</Label>
                          <p className="text-[10px] text-muted-foreground">Busca itens via JSON do WordPress.</p>
                        </div>
                        <Switch 
                          checked={menuConfig.enableWpApi}
                          onCheckedChange={(val) => setMenuConfig({...menuConfig, enableWpApi: val})}
                        />
                      </div>

                      {menuConfig.enableWpApi && (
                        <div className="space-y-2 animate-in slide-in-from-top-1 duration-200">
                          <Label className="text-[10px] uppercase font-bold text-muted-foreground">Endpoint WordPress (JSON)</Label>
                          <Input 
                            placeholder="Ex: https://site.com/wp-json/wp/v2/menu-items"
                            value={menuConfig.wpApiUrl}
                            onChange={(e) => setMenuConfig({...menuConfig, wpApiUrl: e.target.value})}
                          />
                        </div>
                      )}

                      <div className="flex items-center justify-between border-t pt-4">
                        <div className="space-y-0.5">
                          <Label className="text-sm">Auto-detecção via URL</Label>
                          <p className="text-[10px] text-muted-foreground">Varredura visual do site para achar menus.</p>
                        </div>
                        <Switch 
                          checked={menuConfig.enableAutoDetect}
                          onCheckedChange={(val) => setMenuConfig({...menuConfig, enableAutoDetect: val})}
                        />
                    </div>

                    <div className="space-y-2 pt-4 border-t mt-4">
                      <Label className="text-xs uppercase font-bold text-muted-foreground flex items-center gap-2">
                        <Code className="h-3 w-3" /> Importar via JSON
                      </Label>
                      <p className="text-[10px] text-muted-foreground">
                        Cole o JSON da API do WordPress (ex.: /wp-json/wp/v2/navigation) para detectar menu e subitens.
                      </p>
                      <Button size="sm" variant="outline" onClick={() => importMenuFromUrl(menuConfig.testUrl || 'https://anabrasil.org/ana/')}>
                        Importar pela URL padrão ANA
                      </Button>
                      <Textarea
                        placeholder='[{"id":2060,"content":{"rendered":"<li>...</li>"}}]'
                        value={jsonInput}
                        onChange={(e) => setJsonInput(e.target.value)}
                        className="font-mono text-[10px] min-h-[120px]"
                      />
                      <Button size="sm" onClick={importMenuFromJson} disabled={!jsonInput.trim()}>
                        Ler JSON e Importar Menu
                      </Button>
                    </div>

                    </div>

                    <div className="space-y-4 pt-2 border-t mt-4">
                      <Label className="text-xs uppercase font-bold text-muted-foreground flex items-center gap-2">
                        <Globe className="h-3 w-3" /> Ambiente de Teste
                      </Label>
                      <div className="space-y-2">
                        <Label className="text-xs">URL do Site para Preview</Label>
                        <div className="flex gap-2">
                          <Input 
                            placeholder="https://seusite.com"
                            value={menuConfig.testUrl}
                            onChange={(e) => {
                              const url = e.target.value;
                              setMenuConfig({...menuConfig, testUrl: url});
                              setMenuDetectionDetails(url.startsWith('http') ? {
                                status: 'checking',
                                message: 'Verificando endpoints do WordPress e procurando submenus...'
                              } : null);
                              
                              if (url && url.startsWith('http')) {
                                // Limpa timer anterior se existir
                                if (debounceRef.current) clearTimeout(debounceRef.current);
                                
                                debounceRef.current = setTimeout(async () => {
                                  try {
                                    const proxyDetected = await importMenuFromUrl(url);
                                    if (proxyDetected) return;

                                    const origin = new URL(url).origin;
                                    const endpoints = [
                                      '/wp-json/wp/v2/navigation',
                                      '/wp-json/wp/v2/menu-items',
                                      '/wp-json/menus/v1/menus',
                                       '/wp-json/menus/v1/locations/primary'
                                    ];

                                     let detected = false;
                                     let bestDetectedScore = 0;
                                     for (const endpoint of endpoints) {
                                      try {
                                        // Usar fetch normal primeiro, se falhar por CORS ele cai no catch
                                         const testRes = await fetch(`${origin}${endpoint}`, { method: 'GET', mode: 'cors' });
                                         if (testRes.ok) {
                                           let data = await testRes.json();
                                           let usedEndpoint = endpoint;

                                           // O endpoint /wp-json/menus/v1/menus retorna apenas a LISTA de menus
                                           // (term_id, name, count) SEM os itens. Os itens com submenus (child_items)
                                           // só vêm no detalhe: /wp-json/menus/v1/menus/{term_id}.
                                           // Por isso, ao detectar a lista, seguimos automaticamente para o detalhe.
                                           const isMenuList = Array.isArray(data) && data.length > 0
                                             && data[0] && (data[0].term_id || data[0].ID || data[0].id)
                                             && !data[0].url && !data[0].items && !data[0].child_items;

                                           if (isMenuList) {
                                             // Escolhe o menu com mais itens (count) ou o primeiro disponível.
                                             const best = [...data].sort((a, b) => (b.count || 0) - (a.count || 0))[0];
                                             const menuId = best.term_id || best.ID || best.id;
                                             try {
                                               const detailRes = await fetch(`${origin}/wp-json/menus/v1/menus/${menuId}`, { method: 'GET', mode: 'cors' });
                                               if (detailRes.ok) {
                                                 const detailData = await detailRes.json();
                                                 console.log('Detalhe do menu detectado:', detailData);
                                                 data = detailData;
                                                 usedEndpoint = `/wp-json/menus/v1/menus/${menuId}`;
                                               }
                                             } catch (detailErr) { /* mantém data original */ }
                                           }

                                           if (data && (Array.isArray(data) || typeof data === 'object')) {
                                             console.log('Dados detectados via API:', data);
                                              const wpItems = extractWPItems(data);
                                             console.log('Itens extraídos (hierárquicos):', wpItems);
                                              const submenuCount = countSubmenuItems(wpItems);
                                               const detectedScore = wpItems.length + submenuCount;
                                             
                                             setMenuConfig(prev => ({
                                               ...prev, 
                                               wpApiUrl: `${origin}${usedEndpoint}`,
                                               items: wpItems.length > 0 ? wpItems : prev.items
                                             }));
                                              setMenuDetectionDetails({
                                                status: wpItems.length > 0 ? 'success' : 'warning',
                                                message: wpItems.length > 0
                                                  ? submenuCount > 0
                                                    ? 'Menu detectado com hierarquia preservada.'
                                                    : 'Menu detectado, mas nenhum subitem foi encontrado neste endpoint.'
                                                  : 'Endpoint encontrado, mas sem itens de menu legíveis.',
                                                endpoint: `${origin}${usedEndpoint}`,
                                                itemCount: wpItems.length,
                                                submenuCount
                                              });
                                             
                                             toast({
                                               title: "API Detectada!",
                                               description: wpItems.length > 0 
                                                 ? `Importamos ${wpItems.length} itens (com submenus) de ${usedEndpoint}`
                                                 : `Conectado ao endpoint ${usedEndpoint}`,
                                             });
                                              if (wpItems.length > 0) { detected = true; bestDetectedScore = Math.max(bestDetectedScore, detectedScore); break; }
                                           }
                                         }
                                      } catch (e) {
                                        // Se falhar por CORS, tentamos HEAD no-cors apenas para ver se o recurso existe
                                        try {
                                          const headRes = await fetch(`${origin}${endpoint}`, { method: 'HEAD', mode: 'no-cors' });
                                          // No modo no-cors o status é sempre 0, mas se não deu erro de rede é um sinal positivo
                                          if (headRes.type === 'opaque') {
                                             setMenuConfig(prev => ({...prev, wpApiUrl: `${origin}${endpoint}`}));
                                              setMenuDetectionDetails({
                                                status: 'warning',
                                                message: 'Endpoint existe, mas o site bloqueou leitura dos itens por CORS.',
                                                endpoint: `${origin}${endpoint}`
                                              });
                                             toast({
                                              title: "API Possível!",
                                              description: `Detectamos atividade em ${endpoint} (CORS restrito).`,
                                            });
                                            break;
                                          }
                                        } catch (innerE) {}
                                       }
                                     }

                                     // Fallback: muitos menus (Elementor/Happy Addons, etc.) NÃO são
                                     // expostos via REST. Nesses casos, lemos o HTML da própria página
                                     // através de um proxy CORS e extraímos o menu + subitens direto do DOM.
                                      if (url) {
                                       try {
                                          const proxyReaders = [
                                            async () => {
                                              const res = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
                                              return res.ok ? res.text() : '';
                                            },
                                            async () => {
                                              const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
                                              if (!res.ok) return '';
                                              const payload = await res.json();
                                              return payload?.contents || '';
                                            }
                                          ];

                                          for (const readHtml of proxyReaders) {
                                            const html = await readHtml();
                                            if (!html) continue;
                                           const wpItems = extractWPItems([{ content: { rendered: html } }]);
                                           const submenuCount = countSubmenuItems(wpItems);
                                           const htmlScore = wpItems.length + submenuCount;
                                           if (wpItems.length > 0 && htmlScore > bestDetectedScore) {
                                             setMenuConfig(prev => ({ ...prev, items: wpItems }));
                                             setMenuDetectionDetails({
                                               status: 'success',
                                               message: submenuCount > 0
                                                 ? 'Menu detectado a partir do HTML da página (com submenus).'
                                                 : 'Menu detectado a partir do HTML da página.',
                                               endpoint: `${origin} (HTML)`,
                                               itemCount: wpItems.length,
                                               submenuCount
                                             });
                                             toast({
                                               title: "Menu Detectado!",
                                               description: `Importamos ${wpItems.length} itens (com submenus) lendo o HTML da página.`,
                                             });
                                              detected = true;
                                               bestDetectedScore = htmlScore;
                                              break;
                                            } else if (!detected) {
                                             setMenuDetectionDetails({
                                               status: 'warning',
                                               message: 'Página lida, mas não encontramos uma estrutura de menu reconhecível.',
                                               endpoint: `${origin} (HTML)`
                                             });
                                           }
                                         }
                                          if (!detected) {
                                            setMenuDetectionDetails({
                                              status: 'warning',
                                              message: 'Não foi possível ler um HTML completo da página pelos proxies disponíveis.',
                                              endpoint: `${origin} (HTML)`
                                            });
                                          }
                                       } catch (htmlErr) {
                                         setMenuDetectionDetails({
                                           status: 'warning',
                                           message: 'Não foi possível ler o HTML da página (CORS/proxy indisponível).'
                                         });
                                       }
                                     }
                                  } catch (e) {
                                    setMenuDetectionDetails({
                                      status: 'error',
                                      message: 'URL inválida ou inacessível para detecção automática.'
                                    });
                                  }
                                }, 1000);
                              }
                            }}
                          />
                        </div>
                        <p className="text-[10px] text-muted-foreground">O site abrirá no frame abaixo e tentaremos identificar o endpoint e os itens automaticamente.</p>
                        {menuDetectionDetails && (
                          <Alert className="mt-3">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>
                              {menuDetectionDetails.status === 'checking' ? 'Detectando menu...' : 'Detalhe do menu detectado'}
                            </AlertTitle>
                            <AlertDescription className="space-y-1 text-xs">
                              <p>{menuDetectionDetails.message}</p>
                              {menuDetectionDetails.endpoint && (
                                <p className="break-all">Endpoint: {menuDetectionDetails.endpoint}</p>
                              )}
                              {typeof menuDetectionDetails.itemCount === 'number' && (
                                <p>
                                  Itens principais: {menuDetectionDetails.itemCount} · Subitens: {menuDetectionDetails.submenuCount || 0}
                                </p>
                              )}
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Label>Itens do Menu</Label>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10" 
                            title="Limpar tudo"
                            onClick={() => setMenuConfig({...menuConfig, items: []})}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        <span className="text-[10px] text-muted-foreground italic">(Sincronizados via API ou Manual)</span>
                      </div>
                      {menuConfig.items.map((item: any, idx) => (
                        <div key={idx} className="space-y-2 mb-4 p-3 border rounded-lg bg-muted/30">
                          <div className="flex gap-2">
                            <div className="flex-1 flex flex-col gap-2">
                              <Input 
                                placeholder="Label" 
                                value={item.label} 
                                onChange={(e) => {
                                  const newItems = [...menuConfig.items];
                                  newItems[idx].label = e.target.value;
                                  setMenuConfig({...menuConfig, items: newItems});
                                }}
                              />
                              <Input 
                                placeholder="Link" 
                                value={item.link}
                                onChange={(e) => {
                                  const newItems = [...menuConfig.items];
                                  newItems[idx].link = e.target.value;
                                  setMenuConfig({...menuConfig, items: newItems});
                                }}
                              />
                              {(() => {
                                const paths = Array.isArray(item.activePaths)
                                  ? item.activePaths
                                  : (item.activePaths ? String(item.activePaths).split(',').map((s: string) => s.trim()) : []);
                                 const setPaths = (next: string[]) => {
                                   const newItems = menuConfig.items.map((it: any, i: number) =>
                                     i === idx ? { ...it, activePaths: next } : it
                                   );
                                   setMenuConfig({...menuConfig, items: newItems});
                                 };

                                return (
                                  <div className="space-y-1.5">
                                    <span className="text-[10px] text-muted-foreground">Links de ativação</span>
                                    {paths.map((p: string, pi: number) => (
                                      <div key={pi} className="flex gap-1.5">
                                        <Input 
                                          placeholder="/promo" 
                                          value={p}
                                          onChange={(e) => {
                                            const next = [...paths];
                                            next[pi] = e.target.value;
                                            setPaths(next);
                                          }}
                                        />
                                        <Button variant="ghost" size="icon" className="shrink-0 text-destructive"
                                          title="Remover link de ativação"
                                          onClick={() => setPaths(paths.filter((_: string, i: number) => i !== pi))}>
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                      </div>
                                    ))}
                                    <Button variant="outline" size="sm" className="w-full"
                                      onClick={() => setPaths([...paths, ''])}>
                                      + Adicionar link de ativação
                                    </Button>
                                  </div>
                                );
                              })()}
                            </div>
                            <div className="flex flex-col gap-2">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="shrink-0 text-destructive"
                                title="Remover item"
                                onClick={() => {
                                  const newItems = [...menuConfig.items];
                                  newItems.splice(idx, 1);
                                  setMenuConfig({...menuConfig, items: newItems});
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="outline" 
                                size="icon" 
                                className="shrink-0 text-primary"
                                title="Adicionar subitem"
                                onClick={() => {
                                  const newItems = [...menuConfig.items];
                                  if (!newItems[idx].children) newItems[idx].children = [];
                                  newItems[idx].children.push({ label: 'Novo Subitem', link: '#' });
                                  setMenuConfig({...menuConfig, items: newItems});
                                }}
                              >
                                <MenuIcon className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          
                          {/* Render Sub-items if exist */}
                          {item.children && item.children.length > 0 && (
                            <div className="ml-6 space-y-2 border-l-2 pl-3 mt-2">
                              <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                                <MenuIcon className="h-3 w-3" /> Subitems ({item.children.length})
                              </p>
                              {item.children.map((child: any, cIdx: number) => (
                                <div key={cIdx} className="flex gap-2">
                                  <div className="flex-1 flex flex-col gap-1">
                                    <Input 
                                      className="h-8 text-xs"
                                      placeholder="Sub Label" 
                                      value={child.label}
                                      onChange={(e) => {
                                        const newItems = [...menuConfig.items];
                                        newItems[idx].children[cIdx].label = e.target.value;
                                        setMenuConfig({...menuConfig, items: newItems});
                                      }}
                                    />
                                    <Input 
                                      className="h-8 text-xs"
                                      placeholder="Sub Link" 
                                      value={child.link}
                                      onChange={(e) => {
                                        const newItems = [...menuConfig.items];
                                        newItems[idx].children[cIdx].link = e.target.value;
                                        setMenuConfig({...menuConfig, items: newItems});
                                      }}
                                    />
                                    {(() => {
                                      const cPaths = Array.isArray(child.activePaths)
                                        ? child.activePaths
                                        : (child.activePaths ? String(child.activePaths).split(',').map((s: string) => s.trim()) : []);
                                      const setCPaths = (next: string[]) => {
                                        const newItems = menuConfig.items.map((it: any, i: number) =>
                                          i === idx
                                            ? { ...it, children: it.children.map((ch: any, ci: number) => ci === cIdx ? { ...ch, activePaths: next } : ch) }
                                            : it
                                        );
                                        setMenuConfig({...menuConfig, items: newItems});
                                      };
                                      return (
                                        <div className="space-y-1">
                                          <span className="text-[10px] text-muted-foreground">Links de ativação</span>
                                          {cPaths.map((p: string, pi: number) => (
                                            <div key={pi} className="flex gap-1">
                                              <Input
                                                className="h-7 text-xs"
                                                placeholder="/promo"
                                                value={p}
                                                onChange={(e) => {
                                                  const next = [...cPaths];
                                                  next[pi] = e.target.value;
                                                  setCPaths(next);
                                                }}
                                              />
                                              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive"
                                                onClick={() => setCPaths(cPaths.filter((_: string, i: number) => i !== pi))}>
                                                <Trash2 className="h-3 w-3" />
                                              </Button>
                                            </div>
                                          ))}
                                          <Button variant="outline" size="sm" className="w-full h-7 text-xs"
                                            onClick={() => setCPaths([...cPaths, ''])}>
                                            + Adicionar link de ativação
                                          </Button>
                                        </div>
                                      );
                                     })()}
                                  </div>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 text-destructive"
                                    onClick={() => {
                                      const newItems = [...menuConfig.items];
                                      newItems[idx].children.splice(cIdx, 1);
                                      setMenuConfig({...menuConfig, items: newItems});
                                    }}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full"
                        onClick={() => setMenuConfig({
                          ...menuConfig, 
                          items: [...menuConfig.items, { label: 'Novo Item Manual', link: '#', children: [] }]
                        })}
                      >
                        + Adicionar Item Manual
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              </section>
                </TabsContent>
              </Tabs>
            </div>
          </div>

          <div className="lg:col-span-8 flex flex-col gap-6 relative">
            <div className="sticky top-24 space-y-6">
              <Card className="overflow-hidden flex flex-col min-h-[600px]">
              <div className="border-b border-border/70 px-4 py-3 sm:px-6 flex flex-wrap items-center justify-between gap-2 shrink-0">
                <Tabs value={viewMode} onValueChange={setViewMode} className="w-auto">
                  <TabsList>
                    <TabsTrigger value="preview" className="gap-2">
                      Preview
                    </TabsTrigger>
                    <TabsTrigger value="site" className="gap-2">
                      Site
                    </TabsTrigger>
                    <TabsTrigger value="code" className="gap-2">
                      Código
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                {(viewMode === 'preview' || viewMode === 'site') && (
                  <div className="flex items-center gap-1 bg-muted p-1 rounded-[12px]">
                    <Button 
                      variant={deviceView === 'desktop' ? 'secondary' : 'ghost'} 
                      size="icon" 
                      className="h-8 w-8"
                      title="Desktop / UHD (16:9)"
                      onClick={() => { setDeviceView('desktop'); setPanelDevice('desktop'); }}
                    >
                      <Monitor className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant={deviceView === 'tablet' ? 'secondary' : 'ghost'} 
                      size="icon" 
                      className="h-8 w-8"
                      title="Tablet"
                      onClick={() => { setDeviceView('tablet'); setPanelDevice('tablet'); }}
                    >
                      <Tablet className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant={deviceView === 'mobile' ? 'secondary' : 'ghost'} 
                      size="icon" 
                      className="h-8 w-8"
                      title="Mobile"
                      onClick={() => { setDeviceView('mobile'); setPanelDevice('mobile'); }}
                    >
                      <Smartphone className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex-1 bg-muted/10 overflow-auto p-4 md:p-8 flex flex-col justify-start items-center gap-4">
                {viewMode === 'preview' && (
                  <div className="w-full shrink-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[13px] font-semibold text-muted-foreground">Demo Interativo do Widget (clique e teste aqui)</span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                    <div className="w-full flex justify-center py-2">
                      <div
                        ref={demoRef}
                        className={cn(
                          "bg-background shadow-2xl border overflow-hidden relative shrink-0 transition-all duration-500 ease-in-out",
                          deviceView === 'mobile' && "w-[300px] max-w-full aspect-[390/844] rounded-[2.5rem] border-[8px] border-slate-900",
                          deviceView === 'tablet' && "w-[480px] max-w-full aspect-[900/1200] rounded-[1.5rem] border-[10px] border-slate-900",
                          deviceView === 'desktop' && "w-full max-w-3xl aspect-video rounded-lg"
                        )}
                      >
                        {(() => {
                          const native = DEVICE_RESOLUTIONS[deviceView] ?? DEVICE_RESOLUTIONS.desktop;
                          const scale = demoScale;
                          // A demo renderiza o mesmo código final, em resolução nativa do
                          // dispositivo, e é escalada para caber mantendo a proporção real.
                          return (
                            <iframe
                              title="Demo isolado do widget"
                              className="border-none absolute top-0 left-0"
                              style={{
                                width: native.width,
                                height: native.height,
                                transform: `scale(${scale})`,
                                transformOrigin: 'top left',
                              }}
                              sandbox="allow-scripts allow-same-origin"
                              ref={demoIframeRef}
                              srcDoc={demoDoc || (getGeneratedCode() + demoScript)}
                              key={`demo-${deviceView}-${activeWidgetType}-${demoVersion}`}
                            />
                          );
                        })()}
                      </div>
                    </div>

                  </div>
                )}
                {viewMode === 'site' && (
                  <div
                    ref={frameRef}
                    className={cn(
                      "bg-background shadow-2xl border overflow-hidden relative shrink-0 transition-all duration-500 ease-in-out",
                      deviceView === 'mobile' && "w-[375px] max-w-full aspect-[390/844] rounded-[3rem] border-[8px] border-slate-900",
                      deviceView === 'tablet' && "w-[768px] max-w-full aspect-[810/1080] rounded-[1.5rem] border-[10px] border-slate-900",
                      deviceView === 'desktop' && "w-full max-w-5xl aspect-video rounded-lg"
                    )}
                  >
                    {/* Tela escalada: conteúdo renderizado em resolução nativa e reduzido para caber */}
                    <div
                      className="absolute top-0 left-0 flex flex-col bg-background"
                      style={{
                        width: (DEVICE_RESOLUTIONS[deviceView] ?? DEVICE_RESOLUTIONS.desktop).width,
                        height: (DEVICE_RESOLUTIONS[deviceView] ?? DEVICE_RESOLUTIONS.desktop).height,
                        transform: `scale(${previewScale})`,
                        transformOrigin: 'top left',
                      }}
                    >
                    {menuConfig.testUrl ? (
                      <div className="flex-1 w-full h-full relative">
                        <iframe 
                          src={menuConfig.testUrl} 
                          className="w-full h-full border-none"
                          title="Site Preview"
                          onLoad={(e) => {
                            // Tentar ler itens do DOM via injeção se possível (domínios amigáveis)
                            try {
                              const frame = e.currentTarget;
                              const doc = frame.contentDocument || frame.contentWindow?.document;
                              if (doc) {
                                  const selectors = [
                                    'nav', 
                                    '.main-navigation', 
                                    '.elementor-nav-menu', 
                                    '.header-menu', 
                                    '#site-navigation', 
                                    'ul[class*="menu"]', 
                                    '.wp-block-navigation',
                                    '.navbar',
                                    '.nav-menu',
                                    '.navigation',
                                    '[role="navigation"]',
                                    'header .links',
                                    '.header__nav',
                                    '#header-menu',
                                    '.menu-primary-container'
                                  ];
                                for (const sel of selectors) {
                                  const nav = doc.querySelector(sel);
                                  if (nav) {
                                    const cleanLabel = (text: string) => {
                                      return text.replace(/[\u25BC\u25BE\u25B6\u25B8\u2304\u22EE]/g, '').trim();
                                    };

                                    const getDOMItems = (el: Element, depth = 0): any[] => {
                                      if (depth > 5) return []; // Proteção contra recursão infinita
                                      
                                      const items: any[] = [];
                                      // Buscar apenas os LIs diretos deste nível
                                      const listItems = Array.from(el.children).filter(child => child.tagName === 'LI');
                                      
                                      // Se não tem LIs, procura o primeiro UL filho
                                      if (listItems.length === 0) {
                                        const firstUl = el.querySelector('ul');
                                        if (firstUl && firstUl !== el) return getDOMItems(firstUl, depth + 1);
                                      }

                                      // Fallback se ainda não houver LIs (menus baseados em DIVs ou links diretos)
                                      if (listItems.length === 0 && depth === 0) {
                                        return Array.from(el.querySelectorAll('a'))
                                          .filter(a => (a as HTMLElement).innerText.trim().length > 0)
                                          .slice(0, 12)
                                          .map(a => ({
                                            label: cleanLabel((a as HTMLElement).innerText),
                                            link: (a as HTMLAnchorElement).href,
                                            children: []
                                          }));
                                      }

                                      listItems.forEach(li => {
                                        const link = li.querySelector('a');
                                        if (link) {
                                          const label = cleanLabel((link as HTMLElement).innerText || link.textContent || '');
                                          if (label) {
                                            // Recursividade: busca submenus (qualquer UL, lista ou container de dropdown)
                                            const subMenu = li.querySelector('ul, [class*="sub-menu"], [class*="dropdown"], [class*="children"]');
                                            items.push({
                                              label: label,
                                              link: (link as HTMLAnchorElement).href,
                                              children: subMenu ? getDOMItems(subMenu, depth + 1) : []
                                            });
                                          }
                                        }
                                      });
                                      return items;
                                    };

                                    const detectedItems = getDOMItems(nav);
                                    
                                    if (detectedItems.length >= 2) {
                                      console.log('Itens detectados via DOM:', detectedItems);
                                      const isDefault = menuConfig.items.length === 4 && menuConfig.items[0].label === 'Início';
                                      if (isDefault || menuConfig.items.length === 0) {
                                        setMenuConfig(prev => ({...prev, items: detectedItems}));
                                        toast({ title: "Itens Detectados", description: `${detectedItems.length} itens (incluindo submenus) importados.` });
                                      } else {
                                        toast({ 
                                          title: "Menu Encontrado", 
                                          description: "Deseja importar a estrutura detectada?",
                                          action: (
                                            <Button size="sm" onClick={() => setMenuConfig(prev => ({...prev, items: detectedItems}))}>
                                              Importar
                                            </Button>
                                          )
                                        });
                                      }
                                      break;
                                    }
                                  }
                                }
                              }
                            } catch (err) {
                              console.warn("Não foi possível ler o DOM do iframe devido a restrições de CORS.");
                            }
                          }}
                          sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                        />
                        <div className="absolute inset-0 bg-transparent pointer-events-none" />
                      </div>
                    ) : (
                      <>
                        {/* Mock Site Header */}
                        <div className="bg-muted/50 p-4 border-b flex items-center justify-between shrink-0">
                          <div className="w-24 h-6 bg-muted rounded"></div>
                          <div className="flex gap-3">
                            <div className="w-10 h-3 bg-muted rounded"></div>
                            <div className="w-10 h-3 bg-muted rounded"></div>
                          </div>
                        </div>

                        {/* Mock Site Content */}
                        <div className="p-8 flex-1 space-y-6 overflow-hidden">
                          <div className="w-3/4 h-8 bg-muted/40 rounded"></div>
                          <div className="space-y-2">
                            <div className="w-full h-3 bg-muted/30 rounded"></div>
                            <div className="w-full h-3 bg-muted/30 rounded"></div>
                            <div className="w-2/3 h-3 bg-muted/30 rounded"></div>
                          </div>
                          <div className="w-full h-40 bg-muted/20 rounded-xl"></div>
                          <div className="space-y-2">
                            <div className="w-full h-3 bg-muted/30 rounded"></div>
                            <div className="w-full h-3 bg-muted/30 rounded"></div>
                          </div>
                        </div>
                      </>
                    )}

                    {/* Widget Injection: também executa o código final em iframe isolado. */}
                    <div className="absolute inset-0 pointer-events-none z-[1000000]">
                      <iframe
                        title="Widget gerado pelo código final"
                        className="relative w-full h-full border-none bg-transparent pointer-events-auto"
                        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                        srcDoc={getGeneratedCode()}
                        key={`site-widget-${activeWidgetType}-${deviceView}-${JSON.stringify(currentConfig())}`}
                      />
                    </div>
                    </div>
                  </div>
                )}
                {viewMode === 'code' && (
                  <div className="w-full max-w-4xl bg-[#1e1e1e] rounded-xl shadow-2xl overflow-hidden flex flex-col font-mono">
                    <div className="flex justify-between items-center px-4 py-3 bg-[#252526] border-b border-white/5">
                      <div className="flex space-x-2">
                        <div className="w-3 h-3 rounded-full bg-[#ff5f56]"></div>
                        <div className="w-3 h-3 rounded-full bg-[#ffbd2e]"></div>
                        <div className="w-3 h-3 rounded-full bg-[#27c93f]"></div>
                      </div>
                      <span className="text-white/40 text-[10px] uppercase tracking-widest">widget-snippet.html</span>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-8 text-white/70 hover:text-white hover:bg-white/10"
                        onClick={() => handleCopyCode(getGeneratedCode())}
                      >
                        {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                        {copied ? 'Copiado' : 'Copiar'}
                      </Button>
                    </div>
                    <div className="p-6 overflow-auto text-sm text-[#d4d4d4] leading-relaxed max-h-[400px]">
                      <pre className="whitespace-pre-wrap">{getGeneratedCode()}</pre>
                    </div>
                    <div className="bg-[#2d2d2d] p-4 border-t border-white/5 flex items-start gap-3">
                      <Terminal className="text-primary h-5 w-5 shrink-0 mt-0.5" />
                      <p className="text-[13px] text-white/60">
                        <strong>Anti-Adblock:</strong> Este código é 100% nativo e autossuficiente. Cole-o antes da tag <code className="text-primary-foreground bg-primary/20 px-1 rounded">&lt;/body&gt;</code> do site destino.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
