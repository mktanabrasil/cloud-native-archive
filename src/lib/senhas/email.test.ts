import { describe, expect, it } from 'vitest';
import { assuntoDaSenha, corpoDaSenhaHtml, corpoDaSenhaTexto, linkDaSenha } from '../../../supabase/functions/senha-pedir/email';
import { codigoDoLink } from './email';

/** O e-mail "Gerar minha senha" (19/11/2026, PR 3 das senhas). */
const TOKEN = 'a'.repeat(43);

describe('o e-mail', () => {
  it('o link leva à página do app, com o código', () => {
    expect(linkDaSenha('https://app.anabrasil.org', TOKEN)).toBe(`https://app.anabrasil.org/senha-nova?t=${TOKEN}`);
  });
  it('assunto e texto mudam entre "esqueci" e "aprovado"', () => {
    expect(assuntoDaSenha('esqueci')).toBe('Sua senha nova no app ANA Brasil');
    expect(assuntoDaSenha('aprovado')).toBe('Seu acesso ao app ANA Brasil foi aprovado');
    expect(corpoDaSenhaTexto('https://app', TOKEN, 'aprovado', 'Juliana Rocha')).toMatch(/^Olá, Juliana!\n\nSeu pedido de acesso/);
    expect(corpoDaSenhaTexto('https://app', TOKEN, 'esqueci', null)).toMatch(/Não foi você\? Ignore/);
  });
  it('o botão, o aviso de 1 hora e a senha nunca escrita; nome escapado', () => {
    const html = corpoDaSenhaHtml('https://app', TOKEN, 'esqueci', '<Ana>');
    expect(html).toContain('>Gerar minha senha</a>');
    expect(html).toContain(`href="https://app/senha-nova?t=${TOKEN}"`);
    expect(html).toContain('vale por 1 hora e funciona uma vez');
    expect(html).toContain('A senha nunca vai escrita por e-mail');
    expect(html).toContain('Olá, &lt;Ana&gt;!');
  });
});

describe('o código do link', () => {
  it('só aceita o formato do código', () => {
    expect(codigoDoLink(`?t=${TOKEN}`)).toBe(TOKEN);
    expect(codigoDoLink('?t=curto')).toBeNull();
    expect(codigoDoLink('?t=<script>' + 'a'.repeat(40))).toBeNull();
    expect(codigoDoLink('')).toBeNull();
  });
});
