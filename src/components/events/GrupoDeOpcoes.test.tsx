import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { GrupoDeOpcoes } from './GrupoDeOpcoes';

/**
 * Os quatro defeitos que este componente existe para não deixar voltar.
 *
 * Todos vieram de o mesmo código estar copiado quatro vezes no formulário —
 * e três dessas cópias tinham um interruptor que não acendia de jeito nenhum.
 */

/** Casca com estado, porque o componente é controlado pelo formulário. */
function Palco({
  opcoes,
  temNenhum = false,
  inicial = '',
}: {
  opcoes: string[];
  temNenhum?: boolean;
  inicial?: string;
}) {
  const [valor, setValor] = useState(inicial);
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <GrupoDeOpcoes
        id="teste"
        titulo="Grupo *"
        opcoes={opcoes}
        valor={valor}
        onChange={setValor}
        rotuloOutro="Outra coisa"
        pistaOutro="Especifique..."
        temNenhum={temNenhum}
        outroAberto={aberto}
        onOutroAberto={setAberto}
      />
      <output data-testid="valor">{valor}</output>
    </>
  );
}

const COMIDA = ['Almoço', 'Coffee Break', 'Lanche', 'Jantar', 'Nenhum'];
const valor = () => screen.getByTestId('valor').textContent;
const chave = (nome: string | RegExp) => screen.getByRole('switch', { name: nome });

describe('escrever com espaço no “Outro”', () => {
  it('o espaço sobrevive tecla a tecla — "Pais e mães" dá para escrever', () => {
    // O defeito: `montar` aparava o texto a cada tecla. "Pais " virava "Pais"
    // antes do "e" chegar; não havia como separar duas palavras.
    render(<Palco opcoes={COMIDA} temNenhum />);
    fireEvent.click(chave(/outra coisa/i));
    const caixa = screen.getByPlaceholderText('Especifique...');

    for (const parcial of ['P', 'Pa', 'Pai', 'Pais', 'Pais ', 'Pais e', 'Pais e ', 'Pais e m', 'Pais e mães']) {
      fireEvent.change(caixa, { target: { value: parcial } });
    }

    expect((caixa as HTMLInputElement).value).toBe('Pais e mães');
    expect(valor()).toBe('Pais e mães');
  });

  it('junto com opções fixas, o texto continua inteiro', () => {
    render(<Palco opcoes={COMIDA} temNenhum />);
    fireEvent.click(chave('Lanche'));
    fireEvent.click(chave(/outra coisa/i));
    fireEvent.change(screen.getByPlaceholderText('Especifique...'), { target: { value: 'bolo de fubá ' } });

    expect(valor()).toBe('Lanche, bolo de fubá ');
    expect((screen.getByPlaceholderText('Especifique...') as HTMLInputElement).value).toBe('bolo de fubá ');
  });
});

describe('o interruptor “Outro”', () => {
  it('acende ao ser ligado e abre a caixa de texto', () => {
    // O defeito: o handler só reagia a desligar (`if (!checked)`), então ligar
    // não fazia nada — e a caixa só aparecia se já houvesse texto, que só a
    // caixa poderia produzir.
    render(<Palco opcoes={['Funcionários', 'Voluntários']} />);

    expect(screen.queryByPlaceholderText('Especifique...')).not.toBeInTheDocument();

    fireEvent.click(chave('Outra coisa'));

    expect(chave('Outra coisa')).toBeChecked();
    expect(screen.getByPlaceholderText('Especifique...')).toBeInTheDocument();
  });

  it('cobra o texto enquanto a caixa está vazia', () => {
    render(<Palco opcoes={['Funcionários']} />);
    fireEvent.click(chave('Outra coisa'));

    expect(screen.getByText(/escreva qual/i)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Especifique...'), {
      target: { value: 'Estagiários' },
    });

    expect(screen.queryByText(/escreva qual/i)).not.toBeInTheDocument();
    expect(valor()).toBe('Estagiários');
  });

  it('apaga o texto ao ser desligado', () => {
    render(<Palco opcoes={['Funcionários']} />);
    fireEvent.click(chave('Outra coisa'));
    fireEvent.change(screen.getByPlaceholderText('Especifique...'), {
      target: { value: 'Estagiários' },
    });
    fireEvent.click(chave('Outra coisa'));

    expect(valor()).toBe('');
    expect(screen.queryByPlaceholderText('Especifique...')).not.toBeInTheDocument();
  });

  it('já vem aceso quando o valor guardado tem algo fora da lista', () => {
    render(<Palco opcoes={['Funcionários']} inicial="Funcionários, Estagiários" />);

    expect(chave('Outra coisa')).toBeChecked();
    expect(screen.getByPlaceholderText('Especifique...')).toHaveValue('Estagiários');
  });
});

describe('“Nenhum”', () => {
  it('desliga as outras opções', () => {
    render(<Palco opcoes={COMIDA} temNenhum inicial="Lanche, Jantar" />);

    fireEvent.click(chave('Nenhum'));

    expect(valor()).toBe('Nenhum');
  });

  it('é desligado por qualquer outra opção', () => {
    render(<Palco opcoes={COMIDA} temNenhum inicial="Nenhum" />);

    fireEvent.click(chave('Lanche'));

    expect(valor()).toBe('Lanche');
  });

  it('não convive com o texto livre', () => {
    render(<Palco opcoes={COMIDA} temNenhum inicial="Nenhum" />);

    fireEvent.click(chave('Outra coisa'));

    expect(valor()).toBe('');
    expect(chave('Nenhum')).not.toBeChecked();
  });
});

describe('marcar mais de um', () => {
  it('acumula em vez de trocar', () => {
    // No público-alvo isto era escolha única disfarçada: acender um apagava o
    // anterior, sem avisar.
    render(<Palco opcoes={['Os funcionários', 'Os atendidos']} />);

    fireEvent.click(chave('Os funcionários'));
    fireEvent.click(chave('Os atendidos'));

    expect(valor()).toBe('Os funcionários, Os atendidos');
  });

  it('compara por igualdade, não por pedaço de texto', () => {
    // Com `includes`, digitar "Notebook e Som" acendia o interruptor do "Som".
    render(<Palco opcoes={['Som', 'Notebook']} inicial="Notebook e Som" />);

    expect(chave('Som')).not.toBeChecked();
    expect(chave('Notebook')).not.toBeChecked();
    expect(chave('Outra coisa')).toBeChecked();
  });
});
