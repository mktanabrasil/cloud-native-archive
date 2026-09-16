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
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: (_n: string, opts: { body: Record<string, unknown> }) => {
        if (opts.body.salvar_config) { espiao.salvos.push(opts.body.salvar_config); espiao.config = { ...(opts.body.salvar_config as typeof espiao.config) }; }
        return Promise.resolve({ data: { config: { ...espiao.config, atualizado_por: 'mkt@anabrasil.org', atualizado_em: '2026-09-16T12:00:00Z' }, origem: 'painel', perfis: [
          { email: 'dic@anabrasil.org', name: 'Juliana', unit: 'DIC', is_active: true, permission_level: 'gestor_unidade' },
          { email: 'alyson-viana@hotmail.com', name: 'Alyson', unit: 'Administração', is_active: true, permission_level: 'criador' },
        ] }, error: null });
      },
    },
  },
}));

const { ConfigDosAvisos } = await import('./ConfigDosAvisos');

beforeEach(() => { espiao.config = { pre_lancamento: true, extras: [], excluidos: [] }; espiao.salvos = []; });

describe('ConfigDosAvisos', () => {
  it('lista fixas recebendo e gestão/criadores esperando o lançamento', async () => {
    render(<ConfigDosAvisos />);
    await waitFor(() => expect(screen.getAllByTestId('linha-destinatario')).toHaveLength(6));
    const linhas = screen.getAllByTestId('linha-destinatario');
    expect(linhas[0]).toHaveTextContent('mkt@anabrasil.org');
    expect(linhas[0]).toHaveTextContent('caixa fixa');
    expect(linhas[4]).toHaveTextContent('dic@anabrasil.org · Juliana');
    expect(linhas[4]).toHaveTextContent('gestão DIC');
    expect(linhas[4]).toHaveTextContent('entra no lançamento');
    expect(screen.getByText(/4 hoje, 6 no lançamento/)).toBeInTheDocument();
  });

  it('desligar o pré-lançamento pede confirmação e diz quem entra; confirmar salva', async () => {
    render(<ConfigDosAvisos />);
    await waitFor(() => expect(screen.getAllByTestId('linha-destinatario')).toHaveLength(6));
    fireEvent.click(screen.getByRole('switch', { name: /Lançado para a equipe toda/ }));
    const dialogo = await screen.findByRole('dialog');
    expect(dialogo).toHaveTextContent('2 pessoas passam');
    expect(dialogo).toHaveTextContent('dic@anabrasil.org, alyson-viana@hotmail.com');
    fireEvent.click(screen.getByRole('button', { name: 'Lançar agora' }));
    await waitFor(() => expect(espiao.salvos).toEqual([{ pre_lancamento: false, extras: [], excluidos: [] }]));
    expect(await screen.findByText('Lançado para a equipe')).toBeInTheDocument();
  });

  it('"Não incluir" grava o excluído; adicionar um avulso grava em extras', async () => {
    render(<ConfigDosAvisos />);
    await waitFor(() => expect(screen.getAllByTestId('linha-destinatario')).toHaveLength(6));
    fireEvent.click(screen.getAllByRole('button', { name: 'Não incluir' })[1]); // Alyson
    await waitFor(() => expect(espiao.salvos[0]).toMatchObject({ excluidos: ['alyson-viana@hotmail.com'] }));

    fireEvent.change(screen.getByPlaceholderText(/Adicionar um e-mail/), { target: { value: 'Diretoria@anabrasil.org' } });
    fireEvent.click(screen.getByRole('button', { name: /Adicionar/ }));
    await waitFor(() => expect(espiao.salvos[1]).toMatchObject({ extras: ['diretoria@anabrasil.org'] }));
    expect(await screen.findByText('diretoria@anabrasil.org')).toBeInTheDocument();
  });
});
