import { describe, expect, it } from 'vitest';
import { ROTAS } from '@/config/navigation';
import {
  TIPOS_DO_EMAIL, aparelhoDoFeedback, emailDoFeedbackNovo, linkDaCaixa, ondeFoi as ondeFoiNoEmail, quando, resumo, type FeedbackDoEmail,
} from '../../../supabase/functions/feedback-aviso/email';
import { TIPOS_DE_FEEDBACK, aparelhoDe, extensaoDoPrint, navegadorDe, ondeEstou, ondeFoi, problemaDoPrint } from './regras';

/** O feedback do app (23/11/2026): de onde veio, o aparelho, o print e o e-mail ao marketing. */
describe('de onde a pessoa manda', () => {
  it.each([
    [ROTAS.eventos, 'Social', 'Eventos'],
    [ROTAS.calendario, 'Social', 'Calendário Anual'],
    ['/educacao/semanario/0b6c1f8e-2a51-4c7e-9f0a-1d2e3f4a5b6c', 'Educação', 'Semanário'],
    [ROTAS.voluntariado, 'Administração', 'Voluntariado'],
    ['/marketing/enquetes', 'Marketing', 'Enquetes'],
    [ROTAS.painel, 'Painel', null],
  ])('%s: %s › %s', (caminho, setor, pagina) => {
    expect(ondeEstou(caminho)).toEqual({ setor, pagina });
  });

  it('fora dos setores, só o endereço', () => {
    expect(ondeEstou('/inicio')).toEqual({ setor: null, pagina: null });
    expect(ondeFoi(ondeEstou('/inicio'))).toBe('Fora dos setores');
  });

  it('o rótulo junta setor e página', () => {
    expect(ondeFoi({ setor: 'Social', pagina: 'Calendário Anual' })).toBe('Social › Calendário Anual');
    expect(ondeFoi({ setor: 'Painel', pagina: null })).toBe('Painel');
  });
});

describe('o aparelho e o navegador', () => {
  const ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
  const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
  const WINDOWS_EDGE = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0';
  const SAMSUNG = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0 Mobile Safari/537.36';

  it('celular pelo navegador ou pela tela pequena', () => {
    expect(aparelhoDe(ANDROID, false)).toBe('celular');
    expect(aparelhoDe(IPHONE, false)).toBe('celular');
    expect(aparelhoDe(WINDOWS_EDGE, false)).toBe('computador');
    expect(aparelhoDe(WINDOWS_EDGE, true)).toBe('celular');
  });

  it('o nome curto do navegador', () => {
    expect(navegadorDe(ANDROID)).toBe('Chrome');
    expect(navegadorDe(IPHONE)).toBe('Safari');
    expect(navegadorDe(WINDOWS_EDGE)).toBe('Edge');
    expect(navegadorDe(SAMSUNG)).toBe('Samsung Internet');
    expect(navegadorDe('curl/8')).toBe('Outro');
  });
});

describe('o print', () => {
  it('PNG, JPG ou WebP, até 8 MB', () => {
    expect(problemaDoPrint({ type: 'image/png', size: 300_000 })).toBeNull();
    expect(problemaDoPrint({ type: 'image/jpeg', size: 8 * 1024 * 1024 })).toBeNull();
    expect(problemaDoPrint({ type: 'image/heic', size: 1000 })).toMatch(/PNG, JPG ou WebP/);
    expect(problemaDoPrint({ type: 'application/pdf', size: 1000 })).toMatch(/PNG, JPG ou WebP/);
    expect(problemaDoPrint({ type: 'image/png', size: 8 * 1024 * 1024 + 1 })).toMatch(/8 MB/);
  });

  it('a extensão segue o tipo', () => {
    expect(extensaoDoPrint('image/jpeg')).toBe('jpg');
    expect(extensaoDoPrint('image/webp')).toBe('webp');
    expect(extensaoDoPrint('image/png')).toBe('png');
  });
});

describe('o e-mail ao marketing', () => {
  const SITE = 'https://app.anabrasil.org';
  const f: FeedbackDoEmail = {
    id: '0b6c1f8e-2a51-4c7e-9f0a-1d2e3f4a5b6c', autor_nome: 'Gestão Santana', autor_email: 'gestao.santana@anabrasil.org',
    tipo: 'falta', texto: 'Queria ver no calendário só as atividades da minha unidade.\nFica muita coisa junto.',
    setor: 'Social', pagina: 'Calendário Anual', aparelho: 'celular', navegador: 'Chrome', criado_em: '2026-11-23T13:42:00Z',
  };

  it('os nomes dos tipos batem com os do app', () => {
    for (const t of TIPOS_DE_FEEDBACK) expect(TIPOS_DO_EMAIL[t.id].nome).toBe(t.nome);
    expect(Object.keys(TIPOS_DO_EMAIL).sort()).toEqual(TIPOS_DE_FEEDBACK.map(t => t.id).sort());
  });

  it('o "onde" do e-mail bate com o do app', () => {
    expect(ondeFoiNoEmail(f)).toBe(ondeFoi(f));
    expect(ondeFoiNoEmail({ setor: null, pagina: null })).toBe(ondeFoi({ setor: null, pagina: null }));
  });

  it('assunto com o tipo, o lugar e o começo do texto', () => {
    const m = emailDoFeedbackNovo(f, SITE);
    expect(m.assunto).toBe('Feedback · Sinto falta de algo · Social › Calendário Anual: Queria ver no calendário só as atividades da minha unidade.');
    expect(resumo('a'.repeat(80))).toHaveLength(60);
    expect(resumo('a'.repeat(80)).endsWith('…')).toBe(true);
  });

  it('o corpo traz o texto, quem, quando, o aparelho e o link da caixa', () => {
    const m = emailDoFeedbackNovo(f, SITE);
    expect(quando(f.criado_em)).toBe('segunda, 23/11 às 10:42');
    expect(aparelhoDoFeedback(f)).toBe('Celular · Chrome');
    for (const parte of ['Gestão Santana', 'gestao.santana@anabrasil.org', 'segunda, 23/11 às 10:42', 'Celular · Chrome', linkDaCaixa(SITE)]) {
      expect(m.html).toContain(parte);
      expect(m.texto).toContain(parte);
    }
    expect(m.html).toContain('Fica muita coisa junto.');
    expect(m.html).toContain('<br>Fica');
    expect(m.texto).not.toContain('Print:');
    expect(emailDoFeedbackNovo(f, SITE, true).texto).toContain('Print: anexado a este e-mail');
  });

  it('escapa o texto da pessoa', () => {
    const m = emailDoFeedbackNovo({ ...f, texto: '<script>alert(1)</script> & "aspas"' }, SITE);
    expect(m.html).not.toContain('<script>');
    expect(m.html).toContain('&lt;script&gt;');
  });

  it('sem e-mail na conta, só o nome; tipo desconhecido vira ideia', () => {
    const m = emailDoFeedbackNovo({ ...f, autor_email: null, tipo: 'x' }, SITE);
    expect(m.html).not.toContain('mailto:');
    expect(m.assunto.startsWith('Feedback · Ideia ou melhoria')).toBe(true);
  });
});
