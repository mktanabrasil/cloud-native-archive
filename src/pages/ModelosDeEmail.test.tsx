import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

/** Passo 7 do roteiro (21/10/2026): modelos de e-mail do Trabalhe Conosco. */

const banco = vi.hoisted(() => ({
  modelos: [] as Array<Record<string, unknown>>,
  salvos: [] as Array<[string, Record<string, string>]>,
  testes: [] as Array<[string, Record<string, string>]>,
  versoes: [] as Array<Record<string, unknown>>,
}));

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/lib/vagas/emails', async () => {
  const real = await vi.importActual<typeof import('@/lib/vagas/emails')>('@/lib/vagas/emails');
  return {
    ...real,
    listarModelos: async () => banco.modelos,
    salvarModelo: async (chave: string, m: Record<string, string>) => { banco.salvos.push([chave, m]); },
    mandarTeste: async (chave: string, m: Record<string, string>) => { banco.testes.push([chave, m]); return 'carla@anabrasil.org'; },
    versoesDo: async () => banco.versoes,
  };
});

const { ModelosDeEmail } = await import('@/components/vagas/ModelosDeEmail');
const { MODELOS, preencher, problemaDoModelo, paragrafos } = await import('@/lib/vagas/emails');

/** Os textos semeados pela migração (o "texto original"). */
function semeados(): Record<string, { assunto: string; titulo: string; texto: string }> {
  const sql = readFileSync('supabase/migrations/20261021180000_modelos_de_email.sql', 'utf8').replace(/\r\n/g, '\n');
  const out: Record<string, { assunto: string; titulo: string; texto: string }> = {};
  for (const m of sql.matchAll(/\('(\w+)',\n\s+\$t\$([\s\S]*?)\$t\$,\n\s+\$t\$([\s\S]*?)\$t\$,\n\s+\$t\$([\s\S]*?)\$t\$\)/g)) out[m[1]] = { assunto: m[2], titulo: m[3], texto: m[4] };
  return out;
}

const M = (chave: string) => {
  const s = semeados()[chave];
  return { chave, ...s, padrao_assunto: s.assunto, padrao_titulo: s.titulo, padrao_texto: s.texto, atualizado_por: null, atualizado_em: null };
};

beforeEach(() => {
  banco.modelos = MODELOS.map((m) => M(m.chave));
  banco.salvos = []; banco.testes = []; banco.versoes = [];
});

describe('regras', () => {
  it('a migração semeia os 9 modelos, e o texto de reserva da função é o mesmo', () => {
    const sql = semeados();
    expect(Object.keys(sql).sort()).toEqual(MODELOS.map((m) => m.chave).sort());
    const fn = readFileSync('supabase/functions/candidatura-confirmacao/index.ts', 'utf8');
    for (const [chave, t] of Object.entries(sql)) {
      const linha = fn.match(new RegExp(`\\n  ${chave}: \\{ assunto: '([^']*)', titulo: '([^']*)', texto: '([^']*)' \\}`));
      expect(linha, chave).not.toBeNull();
      expect({ assunto: linha![1], titulo: linha![2], texto: linha![3].replace(/\\n/g, '\n') }, chave).toEqual(t);
    }
  });

  it('preenche os campos e separa os parágrafos', () => {
    expect(preencher('Oi, {nome}! {vaga} · {desconhecido}', { nome: 'Leo', vaga: 'Educador' })).toBe('Oi, Leo! Educador · {desconhecido}');
    expect(paragrafos('um\n\ndois\nquatro')).toEqual(['um', 'dois', 'quatro']);
  });

  it('não deixa salvar campo estranho, nem mensagem sem {mensagem}', () => {
    const analise = MODELOS.find((m) => m.chave === 'analise')!;
    const recado = MODELOS.find((m) => m.chave === 'recado')!;
    expect(problemaDoModelo(analise, { assunto: 'a {vaga}', titulo: 'b', texto: 'c' })).toBeNull();
    expect(problemaDoModelo(analise, { assunto: 'a', titulo: 'b {mensagem}', texto: 'c' })).toMatch(/\{mensagem\} não existe neste e-mail/);
    expect(problemaDoModelo(recado, { assunto: 'a', titulo: 'b', texto: 'sem o campo' })).toMatch(/precisa ter \{mensagem\}/);
    expect(problemaDoModelo(analise, { assunto: '', titulo: 'b', texto: 'c' })).toMatch(/assunto/);
  });
});

describe('tela', () => {
  it('a prévia acompanha o que se escreve, com os dados de exemplo', async () => {
    render(<ModelosDeEmail />);
    expect(await screen.findByTestId('previa')).toHaveTextContent('Recebemos sua candidatura, Leonardo.');
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Oba, {nome}! Chegou.' } });
    expect(screen.getByTestId('previa')).toHaveTextContent('Oba, Leonardo! Chegou.');
    expect(screen.getByTestId('previa')).toHaveTextContent('2026-000418');
  });

  it('inserir campo, salvar, mandar teste e voltar ao original', async () => {
    render(<ModelosDeEmail />);
    fireEvent.click(await screen.findByRole('button', { name: /^Em análise/ }));
    const texto = screen.getByLabelText(/^Texto/) as HTMLTextAreaElement;
    fireEvent.change(texto, { target: { value: 'Começamos. ' } });
    fireEvent.focus(texto);
    texto.setSelectionRange(texto.value.length, texto.value.length);
    fireEvent.click(screen.getByRole('button', { name: '{protocolo}' }));
    expect(texto.value).toBe('Começamos. {protocolo}');
    fireEvent.click(screen.getByRole('button', { name: /Mandar teste para mim/ }));
    await waitFor(() => expect(banco.testes[0][0]).toBe('analise'));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(banco.salvos).toEqual([['analise', expect.objectContaining({ texto: 'Começamos. {protocolo}' })]]));
    fireEvent.click(screen.getByRole('button', { name: /Voltar ao texto original/ }));
    expect(texto.value).toContain('O RH começou a analisar a sua candidatura para {vaga}');
  });

  it('modelo de mensagem sem {mensagem} não salva', async () => {
    render(<ModelosDeEmail />);
    fireEvent.click(await screen.findByRole('button', { name: /^Mensagem livre/ }));
    fireEvent.change(screen.getByLabelText(/^Texto/), { target: { value: 'Oi.' } });
    expect(screen.getByRole('alert')).toHaveTextContent('precisa ter {mensagem}');
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();
  });

  it('o e-mail da equipe também tem modelo, com código e prazo', async () => {
    render(<ModelosDeEmail />);
    fireEvent.click(await screen.findByRole('button', { name: /^Responsável nomeado/ }));
    expect(screen.getByRole('button', { name: '{codigo}' })).toBeInTheDocument();
    expect(screen.getByTestId('previa')).toHaveTextContent('Prazo do processo: 30/11/2026.');
    expect(screen.getByTestId('previa')).toHaveTextContent('Abrir o processo');
  });

  it('versões: "Usar esta" traz o texto antigo para o editor', async () => {
    banco.versoes = [{ id: 1, chave: 'confirmacao', assunto: 'Antigo · {vaga}', titulo: 'Velho, {nome}', texto: 'Texto de antes', por: 'Carla', em: '2026-10-21T12:00:00Z' }];
    render(<ModelosDeEmail />);
    fireEvent.click(await screen.findByRole('button', { name: /Versões/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Usar esta' }));
    expect(screen.getByLabelText('Assunto')).toHaveValue('Antigo · {vaga}');
  });
});
