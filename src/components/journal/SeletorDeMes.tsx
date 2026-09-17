import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MESES, anosDisponiveis, formatarMes, interpretarMes, mesAtual } from '@/lib/journal/mesDaEdicao';

interface Props {
  /** O texto gravado ("Setembro 2026", ou um antigo digitado à mão). */
  value: string;
  onChange: (texto: string) => void;
  /** Ids para os rótulos de fora apontarem. */
  idMes?: string;
  idAno?: string;
  className?: string;
}

/**
 * Mês e ano da edição em dois seletores (varredura de 16/09/2026). Escolher
 * qualquer um dos dois grava o texto no formato único; um texto antigo que
 * não dá para ler deixa os seletores vazios até a pessoa escolher.
 */
export function SeletorDeMes({ value, onChange, idMes = 'mes-da-edicao', idAno = 'ano-da-edicao', className }: Props) {
  const atual = interpretarMes(value);
  const hoje = mesAtual();
  const escolher = (mes: number, ano: number) => onChange(formatarMes({ mes, ano }));
  return (
    <div className={className ?? 'flex gap-2'}>
      <Select value={atual ? String(atual.mes) : ''} onValueChange={(v) => escolher(Number(v), atual?.ano ?? hoje.ano)}>
        <SelectTrigger id={idMes} aria-label="Mês" className="flex-1">
          <SelectValue placeholder="Mês" />
        </SelectTrigger>
        <SelectContent>
          {MESES.map((nome, i) => (
            <SelectItem key={nome} value={String(i + 1)}>{nome}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={atual ? String(atual.ano) : ''} onValueChange={(v) => escolher(atual?.mes ?? hoje.mes, Number(v))}>
        <SelectTrigger id={idAno} aria-label="Ano" className="w-28">
          <SelectValue placeholder="Ano" />
        </SelectTrigger>
        <SelectContent>
          {anosDisponiveis(atual).map((ano) => (
            <SelectItem key={ano} value={String(ano)}>{ano}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
