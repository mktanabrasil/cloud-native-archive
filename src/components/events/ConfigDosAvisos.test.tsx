import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

/**
 * O card "Avisos por e-mail" do Painel (PR 3, 16/09/2026): interruptor do
 * pré-lançamento com confirmação ao desligar, lista de quem recebe, "não
 * incluir" e e-mail avulso.
 */
const espiao = vi.hoisted(() => ({
  config: { pre_lancamento: true, extras: [] as string[], excluidos: [] as string[] },
  salvos: [] as unknown[],
  equipe: undefined as undefined | null | { rh: string[]; voluntariado: string[]; financeiro?: string[] },
  salvosEquipe: [] as unknown[],
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: (_n: string, opts: { body: Record<string, unknown> }) => {
        if (opts.body.salvar_config_equipe) { espiao.salvosEquipe.push(opts.body.salvar_config_equipe); espiao.equipe = { ...espiao.equipe, ...(opts.body.salvar_config_equipe as { rh: string[]; voluntariado: string[] }) }; }
        if (opts.body.salvar_config) { espiao.salvos.push(opts.body.salvar_config); espiao.config = { ...(opts.body.salvar_config as typeof espiao.config) }; }
        return Promise.resolve({ data: { config: { ...espiao.config, atualizado_por: 'mkt@anabrasil.org', atualizado_em: '2026-09-16T12:00:00Z' }, origem: 'painel', perfis: [
          { email: 'dic@anabrasil.org', name: 'Juliana', unit: 'DIC', is_active: true, permission_level: 'gestor_unidade' },
          { email: 'alyson-viana@hotmail.com', name: 'Alyson', unit: 'Administração', is_active: true, permission_level: 'criador' },
          { email: 'rosa@anabrasil.org', name: 'Rosa', unit: 'Administração', is_active: true, permission_level: 'usuario_padrao', bond_type: 'rh' },
          { email: 'fin@anabrasil.org', name: 'Fátima', unit: 'Administração', is_active: true, permission_level: 'usuario_padrao', bond_type: 'financeiro' },
        ], ...(espiao.equipe !== undefined ? { equipe: espiao.equipe } : {}) }, error: null });
      },
    },
  },
}));

const { ConfigDosAvisos } = await import('./ConfigDosAvisos');

beforeEach(() => { espiao.config = { pre_lancamento: true, extras: [], excluidos: [] }; espiao.salvos = []; espiao.equipe = undefined; espiao.salvosEquipe = []; });

describe('ConfigDosAvisos', () => {
  it('lista fixas recebendo e gestão/criadores esperando o lançamento', async () => {
    render(<ConfigDosAvisos />);
    await waitFor(() => expect(screen.getAllByTestId('linha-destinatario')).toHaveLength(8));
    const linhas = screen.getAllByTestId('linha-destinatario');
    expect(linhas[0]).toHaveTextContent('mkt@anabrasil.org');
    expect(linhas[0]).toHaveTextContent('caixa fixa');
    expect(linhas[6]).toHaveTextContent('dic@anabrasil.org · Juliana');
    expect(linhas[6]).toHaveTextContent('gestão DIC');
    expect(linhas[6]).toHaveTextContent('entra no lançamento');
    expect(screen.getByText(/6 hoje, 8 no lançamento/)).toBeInTheDocument();
  });

  it('desligar o pré-lançamento pede confirmação e diz quem entra; confirmar salva', async () => {
    render(<ConfigDosAvisos />);
    await waitFor(() => expect(screen.getAllByTestId('linha-destinatario')).toHaveLength(8));
    const interruptor = screen.getByRole('switch', { name: /Modo pré-lançamento/ });
    expect(interruptor).toHaveAttribute('aria-checked', 'true'); // ligado, como o texto diz
    fireEvent.click(interruptor);
    const dialogo = await screen.findByRole('dialog');
    expect(dialogo).toHaveTextContent('2 pessoas passam');
    expect(dialogo).toHaveTextContent('dic@anabrasil.org, alyson-viana@hotmail.com');
    fireEvent.click(screen.getByRole('button', { name: 'Lançar agora' }));
    await waitFor(() => expect(espiao.salvos).toEqual([{ pre_lancamento: false, extras: [], excluidos: [] }]));
    expect(await screen.findByText('Lançado para a equipe')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /Modo pré-lançamento/ })).toHaveAttribute('aria-checked', 'false');
  });

  it('"Não incluir" grava o excluído; adicionar um avulso grava em extras', async () => {
    render(<ConfigDosAvisos />);
    await waitFor(() => expect(screen.getAllByTestId('linha-destinatario')).toHaveLength(8));
    fireEvent.click(screen.getAllByRole('button', { name: 'Não incluir' })[1]); // Alyson
    await waitFor(() => expect(espiao.salvos[0]).toMatchObject({ excluidos: ['alyson-viana@hotmail.com'] }));

    fireEvent.change(screen.getByPlaceholderText(/Adicionar um e-mail/), { target: { value: 'Diretoria@anabrasil.org' } });
    fireEvent.click(screen.getByRole('button', { name: /Adicionar/ }));
    await waitFor(() => expect(espiao.salvos[1]).toMatchObject({ extras: ['diretoria@anabrasil.org'] }));
    expect(await screen.findByText('diretoria@anabrasil.org')).toBeInTheDocument();
  });
});

describe('ConfigDosAvisos: RH e Voluntariado (18/11/2026)', () => {
  it('função antiga, sem as listas: avisa para republicar em vez de salvar no vazio', async () => {
    render(<ConfigDosAvisos />);
    expect(await screen.findByText(/ainda não conhece estas listas/)).toBeInTheDocument();
    expect(screen.queryByTestId('lista-equipe-rh')).toBeNull();
  });

  it('não deu para ler as listas: avisa e não deixa salvar por cima', async () => {
    espiao.equipe = null;
    render(<ConfigDosAvisos />);
    expect(await screen.findByText(/Não consegui ler as listas do RH, do Voluntariado e do Financeiro/)).toBeInTheDocument();
    expect(screen.queryByTestId('lista-equipe-rh')).toBeNull();
  });

  it('as duas listas; a sugestão pelo vínculo adiciona; o x tira', async () => {
    espiao.equipe = { rh: [], voluntariado: ['vol@anabrasil.org'] };
    render(<ConfigDosAvisos />);
    const rh = await screen.findByTestId('lista-equipe-rh');
    expect(rh).toHaveTextContent('Ninguém ainda');
    fireEvent.click(screen.getByRole('button', { name: '+ Rosa · rosa@anabrasil.org' }));
    await waitFor(() => expect(espiao.salvosEquipe).toEqual([{ rh: ['rosa@anabrasil.org'], voluntariado: ['vol@anabrasil.org'] }]));
    fireEvent.click(await screen.findByRole('button', { name: 'Tirar vol@anabrasil.org da lista do Voluntariado' }));
    await waitFor(() => expect(espiao.salvosEquipe.at(-1)).toEqual({ rh: ['rosa@anabrasil.org'], voluntariado: [] }));
  });

  it('digitar um e-mail adiciona; e-mail inválido não salva', async () => {
    espiao.equipe = { rh: [], voluntariado: [] };
    render(<ConfigDosAvisos />);
    const campo = await screen.findByLabelText('E-mail para a lista do Voluntariado');
    fireEvent.change(campo, { target: { value: 'nao-e-email' } });
    fireEvent.submit(campo.closest('form')!);
    expect(espiao.salvosEquipe).toEqual([]);
    fireEvent.change(campo, { target: { value: ' Voluntariado@AnaBrasil.org ' } });
    fireEvent.submit(campo.closest('form')!);
    await waitFor(() => expect(espiao.salvosEquipe).toEqual([{ rh: [], voluntariado: ['voluntariado@anabrasil.org'] }]));
  });
});

describe('ConfigDosAvisos: Financeiro (19/11/2026)', () => {
  it('função sem a lista do Financeiro: RH e Voluntariado funcionam, o Financeiro pede para republicar e não vai no salvar', async () => {
    espiao.equipe = { rh: [], voluntariado: [] };
    render(<ConfigDosAvisos />);
    expect(await screen.findByTestId('lista-equipe-financeiro-sem-funcao')).toHaveTextContent('Republique a função');
    expect(screen.queryByTestId('lista-equipe-financeiro')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '+ Rosa · rosa@anabrasil.org' }));
    await waitFor(() => expect(espiao.salvosEquipe).toEqual([{ rh: ['rosa@anabrasil.org'], voluntariado: [] }]));
  });

  it('a lista do Financeiro: sugestão pelo vínculo, e as três listas vão juntas', async () => {
    espiao.equipe = { rh: ['rh@anabrasil.org'], voluntariado: [], financeiro: [] };
    render(<ConfigDosAvisos />);
    const fin = await screen.findByTestId('lista-equipe-financeiro');
    expect(fin).toHaveTextContent('compras dos eventos');
    fireEvent.click(screen.getByRole('button', { name: '+ Fátima · fin@anabrasil.org' }));
    await waitFor(() => expect(espiao.salvosEquipe).toEqual([{ rh: ['rh@anabrasil.org'], voluntariado: [], financeiro: ['fin@anabrasil.org'] }]));
    fireEvent.click(await screen.findByRole('button', { name: 'Tirar fin@anabrasil.org da lista do Financeiro' }));
    await waitFor(() => expect(espiao.salvosEquipe.at(-1)).toEqual({ rh: ['rh@anabrasil.org'], voluntariado: [], financeiro: [] }));
  });
});
