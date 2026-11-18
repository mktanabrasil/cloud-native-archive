import { useId, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { VoluntarioDoEvento } from '@/types';
import { LIMITE_DE_PESSOAS, LIMITE_DO_NOME, formatarWhatsapp, limparFuncionarios, whatsappValido } from '@/lib/events/equipe';

/** O selo que diz para onde a lista vai. */
function ParaOnde({ setor, cor }: { setor: string; cor: string }) {
  return (
    <span className="inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: `${cor}22`, color: cor }}>
      Vai para o {setor}
    </span>
  );
}

/**
 * Os nomes de quem da equipe trabalha no evento (18/11/2026). Escreve e toca
 * em Adicionar (ou Enter); o × tira. Os nomes que a equipe já usou em outros
 * eventos aparecem como sugestão, para a mesma pessoa ter a mesma grafia no
 * controle de horas do RH.
 */
export function NomesDosFuncionarios({ id, nomes, onNomes, sugestoes = [], desativado = false }: {
  id: string;
  nomes: string[];
  onNomes: (nomes: string[]) => void;
  sugestoes?: string[];
  desativado?: boolean;
}) {
  const [novo, setNovo] = useState('');
  const lista = useId();
  const adicionar = () => {
    const juntos = limparFuncionarios([...nomes, novo]);
    if (juntos.length !== nomes.length) onNomes(juntos);
    setNovo('');
  };
  const cheio = nomes.length >= LIMITE_DE_PESSOAS;
  return (
    <div className="mt-2 grid gap-2 animate-in fade-in slide-in-from-top-1 duration-150">
      <ParaOnde setor="RH" cor="#6b5bd6" />
      <p className="text-xs text-muted-foreground">Quem da equipe vai trabalhar no evento. O RH recebe a lista e controla as horas depois.</p>
      {nomes.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Funcionários escalados">
          {nomes.map(n => (
            <li key={n} className="inline-flex items-center gap-1 rounded-full border border-border bg-background py-1 pl-3 pr-1 text-[13px]">
              {n}
              {!desativado && (
                <button type="button" aria-label={`Tirar ${n}`} onClick={() => onNomes(nomes.filter(x => x !== n))} className="rounded-full p-0.5 text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!desativado && !cheio && (
        <div className="flex gap-2">
          <Input
            id={`${id}-novo`}
            aria-label="Nome do funcionário"
            placeholder="Nome do funcionário"
            value={novo}
            maxLength={LIMITE_DO_NOME}
            list={sugestoes.length ? lista : undefined}
            onChange={e => setNovo(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); adicionar(); } }}
            // Escreveu e foi direto para outro lugar (ou para Enviar): o nome entra assim mesmo.
            onBlur={() => { if (novo.trim()) adicionar(); }}
            className="h-9 bg-background"
          />
          {sugestoes.length > 0 && <datalist id={lista}>{sugestoes.filter(s => !nomes.includes(s)).map(s => <option key={s} value={s} />)}</datalist>}
          <Button type="button" variant="outline" size="sm" className="h-9 shrink-0" onClick={adicionar} disabled={!novo.trim()}>Adicionar</Button>
        </div>
      )}
    </div>
  );
}

/**
 * Os voluntários do evento, com nome e WhatsApp (18/11/2026), como a
 * tabelinha da comida. O WhatsApp aparece formatado ao sair do campo.
 */
export function ListaDeVoluntarios({ id, voluntarios, onVoluntarios, desativado = false }: {
  id: string;
  voluntarios: VoluntarioDoEvento[];
  onVoluntarios: (lista: VoluntarioDoEvento[]) => void;
  desativado?: boolean;
}) {
  // Liga com uma linha pronta para escrever.
  const linhas = voluntarios.length ? voluntarios : [{ nome: '', whatsapp: '' }];
  const mudar = (i: number, campo: keyof VoluntarioDoEvento, valor: string) =>
    onVoluntarios(linhas.map((v, j) => (j === i ? { ...v, [campo]: valor } : v)));
  const tirar = (i: number) => onVoluntarios(linhas.filter((_, j) => j !== i));
  return (
    <div className="mt-2 grid gap-2 animate-in fade-in slide-in-from-top-1 duration-150">
      <ParaOnde setor="Voluntariado" cor="#c2611b" />
      <p className="text-xs text-muted-foreground">Nome e WhatsApp de cada voluntário. O Voluntariado confere quem já está no cadastro e cadastra quem é novo.</p>
      <div className="grid gap-1.5" role="group" aria-label="Voluntários do evento">
        {linhas.map((v, i) => {
          const zapRuim = v.whatsapp.trim() !== '' && !whatsappValido(v.whatsapp);
          return (
            <div key={i} className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] items-start gap-1.5">
              <Input id={`${id}-nome-${i}`} aria-label={`Nome do voluntário ${i + 1}`} placeholder="Nome" value={v.nome} maxLength={LIMITE_DO_NOME}
                disabled={desativado} onChange={e => mudar(i, 'nome', e.target.value)} className="h-9 bg-background" />
              <div>
                <Input id={`${id}-zap-${i}`} aria-label={`WhatsApp do voluntário ${i + 1}`} placeholder="(19) 9____-____" inputMode="tel"
                  // O banco guarda só os números; na tela, formatado.
                  value={/^\d{10,11}$/.test(v.whatsapp) ? formatarWhatsapp(v.whatsapp) : v.whatsapp}
                  disabled={desativado} aria-invalid={zapRuim || undefined}
                  onChange={e => mudar(i, 'whatsapp', e.target.value)}
                  onBlur={e => whatsappValido(e.target.value) && mudar(i, 'whatsapp', formatarWhatsapp(e.target.value))}
                  className={`h-9 bg-background ${zapRuim ? 'border-destructive' : ''}`} />
                {zapRuim && <p className="mt-0.5 text-[11px] text-destructive">Com DDD: 10 ou 11 números.</p>}
              </div>
              {!desativado && (
                <button type="button" aria-label={`Tirar o voluntário ${i + 1}`} onClick={() => tirar(i)} className="mt-1.5 rounded-full p-1 text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>
      {!desativado && linhas.length < LIMITE_DE_PESSOAS && (
        <div>
          <Button type="button" variant="outline" size="sm" className="h-8 gap-1" onClick={() => onVoluntarios([...linhas, { nome: '', whatsapp: '' }])}>
            <Plus className="h-3.5 w-3.5" /> Adicionar voluntário
          </Button>
        </div>
      )}
    </div>
  );
}
