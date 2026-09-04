import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

/**
 * Um grupo de opções do formulário de evento: público-alvo, equipe de apoio,
 * alimentação, equipamentos.
 *
 * Existe porque os quatro eram quatro cópias do mesmo código — e os defeitos
 * vieram junto, também em quatro cópias:
 *
 *  - o interruptor "Outro" só reagia a *desligar* (`if (!checked)`), então
 *    ligar não fazia nada. E a caixa de texto só aparecia quando o valor já
 *    tinha algo fora da lista, que só a caixa poderia produzir. Um travava o
 *    outro: em "Outra equipe", "Outra logística" e "Outro equipamento" não
 *    havia caminho nenhum.
 *  - "Nenhum" convivia com as demais opções, gravando "Lanche, Nenhum".
 *  - o público-alvo era escolha única disfarçada de interruptor: acender um
 *    apagava o anterior, sem dizer nada.
 *  - a comparação era por `includes`, isto é, por pedaço de texto: digitar
 *    "Notebook e Som" acendia o interruptor do "Som" sozinho.
 *
 * Aqui é um lugar só, com igualdade exata e o "Outro" simétrico.
 */

export interface GrupoDeOpcoesProps {
  /** Prefixo dos `id` dos controles; precisa ser único na tela. */
  id: string;
  titulo: string;
  /** As opções fixas. Qualquer valor fora desta lista é o texto do "Outro". */
  opcoes: string[];
  /** O valor guardado, no formato `"Almoço, Lanche"`. */
  valor: string;
  onChange: (valor: string) => void;
  rotuloOutro: string;
  pistaOutro: string;
  /** `Nenhum` desliga as outras opções, e qualquer outra desliga `Nenhum`. */
  temNenhum?: boolean;
  /**
   * O interruptor "Outro" está ligado.
   *
   * Mora no formulário, e não aqui, porque a validação precisa saber que ele
   * ficou aberto sem texto — coisa que o valor sozinho não conta.
   */
  outroAberto: boolean;
  onOutroAberto: (aberto: boolean) => void;
  erro?: string;
}

const separar = (valor: string): string[] =>
  valor.split(', ').map((v) => v.trim()).filter(Boolean);

/**
 * O valor pronto para gravar: cada parte aparada, vazios fora.
 *
 * Enquanto a pessoa digita, o texto do "Outro" fica como está — inclusive o
 * espaço no fim, que é o que ela acabou de teclar para escrever a próxima
 * palavra. Aparar a cada tecla (como era) engolia esse espaço antes da letra
 * seguinte chegar: "Pais e mães" não tinha como ser escrito. Apara-se aqui,
 * uma vez, na hora de salvar.
 */
export const normalizarOpcoes = (valor: string | null | undefined): string =>
  separar(valor ?? '').join(', ');

export function GrupoDeOpcoes({
  id,
  titulo,
  opcoes,
  valor,
  onChange,
  rotuloOutro,
  pistaOutro,
  temNenhum = false,
  outroAberto,
  onOutroAberto,
  erro,
}: GrupoDeOpcoesProps) {
  // Sem aparar: `separar` apara, e isso comeria o espaço final enquanto
  // se digita. As opções fixas são comparadas aparadas, como antes.
  const partes = valor.split(', ').filter((v) => v.trim());
  const marcados = partes.map((v) => v.trim());
  const escolhidos = marcados.filter((m) => opcoes.includes(m));
  const texto = partes.find((p) => !opcoes.includes(p.trim())) ?? '';
  const mostraOutro = outroAberto || texto !== '';

  // `custom` vai como veio: o espaço que a pessoa acabou de digitar precisa
  // sobreviver até a próxima letra. Ver `normalizarOpcoes`.
  const montar = (lista: string[], custom: string) =>
    [...lista, ...(custom.trim() ? [custom] : [])].join(', ');

  const alternar = (opcao: string) => {
    if (escolhidos.includes(opcao)) {
      onChange(montar(escolhidos.filter((e) => e !== opcao), texto));
      return;
    }
    if (temNenhum && opcao === 'Nenhum') {
      // "Nenhum" é resposta completa: não convive com as outras nem com o texto.
      onOutroAberto(false);
      onChange('Nenhum');
      return;
    }
    const semNenhum = temNenhum ? escolhidos.filter((e) => e !== 'Nenhum') : escolhidos;
    onChange(montar([...semNenhum, opcao], texto));
  };

  const alternarOutro = () => {
    if (mostraOutro) {
      onOutroAberto(false);
      onChange(montar(escolhidos, ''));
      return;
    }
    onOutroAberto(true);
    if (temNenhum) onChange(montar(escolhidos.filter((e) => e !== 'Nenhum'), ''));
  };

  return (
    <div id={`campo-${id}`}>
      <Label className="text-sm font-semibold mb-2 block">
        {titulo}
        {opcoes.length > 1 && (
          <span className="ml-1.5 font-normal text-muted-foreground">— pode marcar mais de um</span>
        )}
      </Label>

      <div className="space-y-2">
        {opcoes.map((opcao) => (
          <div
            key={opcao}
            className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card shadow-sm"
          >
            <Switch
              id={`${id}-${opcao}`}
              checked={escolhidos.includes(opcao)}
              onCheckedChange={() => alternar(opcao)}
            />
            <Label htmlFor={`${id}-${opcao}`} className="text-sm cursor-pointer flex-1 font-medium">
              {opcao}
            </Label>
          </div>
        ))}

        <div className="space-y-2 p-3 rounded-lg border border-border bg-card shadow-sm">
          <div className="flex items-center gap-3">
            <Switch id={`${id}-outro`} checked={mostraOutro} onCheckedChange={alternarOutro} />
            <Label htmlFor={`${id}-outro`} className="text-sm cursor-pointer flex-1 font-medium">
              {rotuloOutro}
            </Label>
          </div>
          {mostraOutro && (
            <>
              <Input
                className="h-9 mt-2"
                value={texto}
                onChange={(e) => onChange(montar(escolhidos, e.target.value))}
                placeholder={pistaOutro}
              />
              {texto.trim() === '' && (
                <p className="text-xs text-destructive">Escreva qual, ou desligue esta opção.</p>
              )}
            </>
          )}
        </div>
      </div>

      {erro && <p className="mt-1 text-xs text-destructive">{erro}</p>}
    </div>
  );
}

export default GrupoDeOpcoes;
