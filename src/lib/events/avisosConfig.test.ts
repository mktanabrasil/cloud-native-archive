import { describe, expect, it } from 'vitest';
import { CONFIG_PADRAO, emailValido, listaDeDestinatarios, quemEntraNoLancamento, resumoDaLista } from './avisosConfig';

const perfis = [
  { email: 'dic@anabrasil.org', name: 'Juliana', unit: 'DIC', is_active: true, permission_level: 'gestor_unidade' },
  { email: 'MKT@anabrasil.org', name: 'Mkt ANA', unit: 'Administração', is_active: true, permission_level: 'admin_geral' },
  { email: 'alyson-viana@hotmail.com', name: 'Alyson', unit: 'Administração', is_active: true, permission_level: 'criador' },
  { email: 'leitora@ana.org', name: 'Leitora', unit: 'DIC', is_active: true, permission_level: 'usuario_padrao' },
  { email: 'antiga@ana.org', name: 'Antiga', unit: 'Santana', is_active: false, permission_level: 'gestor_unidade' },
];

describe('listaDeDestinatarios', () => {
  it('fixas primeiro e sempre recebendo; gestão e criadores entram no lançamento; leitores e desativados fora', () => {
    const l = listaDeDestinatarios(perfis, CONFIG_PADRAO);
    expect(l.slice(0, 4).map(x => x.email)).toEqual(['mkt@anabrasil.org', 'contato@anabrasil.org', 'parceiros@anabrasil.org', 'eventos@anabrasil.org']);
    expect(l.find(x => x.email === 'dic@anabrasil.org')).toMatchObject({ motivo: 'gestao', unidade: 'DIC', estado: 'entra_no_lancamento', fixo: false });
    expect(l.find(x => x.email === 'alyson-viana@hotmail.com')).toMatchObject({ motivo: 'cria_eventos', estado: 'entra_no_lancamento' });
    expect(l.some(x => x.email === 'leitora@ana.org')).toBe(false);
    expect(l.some(x => x.email === 'antiga@ana.org')).toBe(false);
    expect(l.filter(x => x.email === 'mkt@anabrasil.org')).toHaveLength(1); // o perfil MKT@ não duplica a caixa fixa
  });

  it('excluídos ficam "não incluir"; avulsos entram como adicionados; lançado = todos recebem', () => {
    const config = { pre_lancamento: false, extras: ['Diretoria@anabrasil.org'], excluidos: ['alyson-viana@hotmail.com'] };
    const l = listaDeDestinatarios(perfis, config);
    expect(l.find(x => x.email === 'alyson-viana@hotmail.com')?.estado).toBe('nao_incluir');
    expect(l.find(x => x.email === 'diretoria@anabrasil.org')).toMatchObject({ motivo: 'avulso', estado: 'recebe' });
    expect(l.find(x => x.email === 'dic@anabrasil.org')?.estado).toBe('recebe');
  });

  it('quem entra no lançamento e o resumo', () => {
    const l = listaDeDestinatarios(perfis, { ...CONFIG_PADRAO, excluidos: ['alyson-viana@hotmail.com'] });
    expect(quemEntraNoLancamento(l)).toEqual(['dic@anabrasil.org']);
    expect(resumoDaLista(l)).toBe('4 hoje, 5 no lançamento');
    expect(resumoDaLista(listaDeDestinatarios([], { pre_lancamento: false, extras: [], excluidos: [] }))).toBe('4 pessoas');
  });
});

describe('emailValido', () => {
  it('aceita e-mail comum e recusa lixo', () => {
    expect(emailValido(' diretoria@anabrasil.org ')).toBe(true);
    expect(emailValido('diretoria')).toBe(false);
    expect(emailValido('a b@c.d')).toBe(false);
  });
});
