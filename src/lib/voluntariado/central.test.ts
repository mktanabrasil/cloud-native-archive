import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

const {
  agoraEProximo, agoraEmBrasilia, caminho, caminhoDaAba, diaCurto, diaQueAbre, diasDoCronograma, eParaMim, eSoDoMeuGrupo, horaCurta, iniciais,
  eGestor, itensDoDia, momentoDoDia, posicaoDoAgora, protocoloLido, suporteDeAvisos, whatsappMascarado,
} = await import('./central');
const { BOAS_VINDAS, emLotes, notificacaoDoAviso, resultadoDoEnvio, whatsappDoFormulario } = await import('../../../supabase/functions/voluntariado-avisos/regras');

/** A Central do Voluntário (13/11/2026): as regras da tela e da função dos avisos. */

const V = { protocolo: 'VL-7KQ2M', nome: 'Maria Souza Lima', vinculo: 'funcionario', unidade_nome: 'GOE', igreja: null, horario: 'manha', opcao1: 'cozinha', opcao2: null, inscrito_em: '2026-11-05T15:00:00Z' } as const;
const I = (o: Record<string, unknown>) => ({ id: Math.random().toString(36), dia: '2026-12-08', inicio: '07:00', fim: null, titulo: 'X', tipo: 'atividade', local: null, detalhe: null, areas: [], horarios: [], ...o }) as never;

describe('para quem é (a mesma regra da função e do banco)', () => {
  it('vazio é para todos; área e turno filtram; o Dia todo entra em todos os turnos', () => {
    expect(eParaMim(I({}), V)).toBe(true);
    expect(eParaMim(I({ areas: ['cozinha'] }), V)).toBe(true);
    expect(eParaMim(I({ areas: ['inflaveis'] }), V)).toBe(false);
    expect(eParaMim(I({ horarios: ['tarde'] }), V)).toBe(false);
    expect(eParaMim(I({ horarios: ['tarde'] }), { ...V, horario: 'dia_todo' })).toBe(true);
    expect(eParaMim(I({ horarios: ['manha'], areas: ['cozinha'] }), V)).toBe(true);
  });

  it('o selo "Para você" só nos itens de um grupo, não nos gerais', () => {
    expect(eSoDoMeuGrupo(I({}), V)).toBe(false);
    expect(eSoDoMeuGrupo(I({ areas: ['cozinha'] }), V)).toBe(true);
    expect(eSoDoMeuGrupo(I({ areas: ['inflaveis'] }), V)).toBe(false);
  });

  it('o gestor (sem inscrição) vê tudo, e nada ganha o selo (12/11/2026)', () => {
    const G = { ...V, protocolo: null, vinculo: 'gestao', horario: null, opcao1: null, opcao2: null } as const;
    expect(eGestor(G)).toBe(true);
    expect(eGestor(V)).toBe(false);
    expect(eParaMim(I({ areas: ['inflaveis'], horarios: ['tarde'] }), G)).toBe(true);
    expect(eSoDoMeuGrupo(I({ areas: ['cozinha'] }), G)).toBe(false);
  });
});

describe('cronograma', () => {
  const c = [
    I({ dia: '2026-12-08', inicio: '12:00', titulo: 'Troca de turno', horarios: ['tarde'] }),
    I({ dia: '2026-11-28', inicio: '09:00', titulo: 'Treinamento' }),
    I({ dia: '2026-12-08', inicio: '07:00', fim: '12:00', titulo: 'Cozinha', areas: ['cozinha'] }),
    I({ dia: '2026-12-08', inicio: '06:30', fim: '07:00', titulo: 'Chegada' }),
  ];

  it('os dias em ordem, e o que abre: hoje, o próximo, ou o último', () => {
    expect(diasDoCronograma(c)).toEqual(['2026-11-28', '2026-12-08']);
    expect(diaQueAbre(['2026-11-28', '2026-12-08'], '2026-12-08')).toBe('2026-12-08');
    expect(diaQueAbre(['2026-11-28', '2026-12-08'], '2026-11-13')).toBe('2026-11-28');
    expect(diaQueAbre(['2026-11-28', '2026-12-08'], '2026-12-01')).toBe('2026-12-08');
    expect(diaQueAbre(['2026-11-28', '2026-12-08'], '2026-12-20')).toBe('2026-12-08');
    expect(diaQueAbre([], '2026-12-20')).toBeNull();
  });

  it('itens do dia em ordem; "Minha área" tira o que é de outro grupo', () => {
    expect(itensDoDia(c, '2026-12-08', V as never, false).map((i: { titulo: string }) => i.titulo)).toEqual(['Chegada', 'Cozinha', 'Troca de turno']);
    expect(itensDoDia(c, '2026-12-08', V as never, true).map((i: { titulo: string }) => i.titulo)).toEqual(['Chegada', 'Cozinha']);
  });

  it('a linha do "agora" fica antes do primeiro item que não começou; fora do dia, não aparece', () => {
    const dia = itensDoDia(c, '2026-12-08', V as never, false);
    expect(posicaoDoAgora(dia, '2026-12-08', { dia: '2026-12-08', hora: '09:40' })).toBe(2);
    expect(posicaoDoAgora(dia, '2026-12-08', { dia: '2026-12-08', hora: '05:00' })).toBe(0);
    expect(posicaoDoAgora(dia, '2026-12-08', { dia: '2026-12-08', hora: '18:00' })).toBe(3);
    expect(posicaoDoAgora(dia, '2026-12-08', { dia: '2026-11-28', hora: '09:40' })).toBe(-1);
  });

  it('agora e a seguir, só do que é da pessoa', () => {
    const r = agoraEProximo(c, V as never, { dia: '2026-12-08', hora: '09:40' });
    expect(r.acontecendo?.titulo).toBe('Cozinha');
    expect(r.proximo).toBeNull(); // a troca de turno é da tarde
    const t = agoraEProximo(c, { ...V, horario: 'dia_todo' } as never, { dia: '2026-12-08', hora: '06:10' });
    expect(t.acontecendo).toBeNull();
    expect(t.proximo?.titulo).toBe('Chegada');
  });
});

describe('o caminho da pessoa', () => {
  it('antes do treinamento, o treinamento é o próximo; com presença, o evento', () => {
    expect(caminho({ presencas: {} }, '2026-11-13').map((p) => p.estado)).toEqual(['feito', 'agora', 'depois']);
    expect(caminho({ presencas: { treinamento: 'x' } }, '2026-11-28').map((p) => p.estado)).toEqual(['feito', 'feito', 'agora']);
    expect(caminho({ presencas: { treinamento: 'x', evento: 'y' } }, '2026-12-08').map((p) => p.estado)).toEqual(['feito', 'feito', 'feito']);
  });
  it('passou o treinamento sem presença: o passo fica pendente e o evento segue', () => {
    expect(caminho({ presencas: {} }, '2026-12-01').map((p) => p.estado)).toEqual(['feito', 'depois', 'agora']);
  });
});

describe('textos', () => {
  it('dia, hora, WhatsApp e iniciais', () => {
    expect(diaCurto('2026-12-08')).toBe('Ter, 08/12');
    expect(diaCurto('2026-11-28')).toBe('Sáb, 28/11');
    expect(horaCurta('07:00')).toBe('7h');
    expect(horaCurta('06:30')).toBe('6h30');
    expect(whatsappMascarado('19990001111')).toBe('(19) 9••••-1111');
    expect(whatsappMascarado('1933334444')).toBe('(19) ••••-4444');
    expect(iniciais('Maria Souza Lima')).toBe('ML');
    expect(caminhoDaAba('inicio')).toBe('/voluntariado/natalfeliz26/central');
    expect(caminhoDaAba('avisos')).toBe('/voluntariado/natalfeliz26/central/avisos');
  });

  it('agora em Brasília, mesmo com o relógio em outro fuso', () => {
    expect(agoraEmBrasilia(new Date('2026-12-08T09:40:00Z'))).toEqual({ dia: '2026-12-08', hora: '06:40' });
    expect(agoraEmBrasilia(new Date('2026-12-09T02:30:00Z'))).toEqual({ dia: '2026-12-08', hora: '23:30' });
  });
});

describe('presença', () => {
  it('o protocolo digitado: o código, minúsculas, sem hífen e o link antigo (?p=); o resto não', () => {
    expect(protocoloLido('https://app.anabrasil.org/voluntariado/natalfeliz26/presenca?p=VL-7KQ2M')).toBe('VL-7KQ2M');
    expect(protocoloLido('vl-7kq2m')).toBe('VL-7KQ2M');
    expect(protocoloLido(' VL7KQ2M ')).toBe('VL-7KQ2M');
    expect(protocoloLido('Maria')).toBeNull();
    expect(protocoloLido('PZ-7KQ2M')).toBeNull();
    expect(protocoloLido('VL-7KQ2I')).toBeNull(); // sem I e O no sorteio
  });

  it('até o dia do treinamento, a presença é do treinamento; depois, do evento', () => {
    expect(momentoDoDia('2026-11-28')).toBe('treinamento');
    expect(momentoDoDia('2026-11-29')).toBe('evento');
  });
});

describe('avisos no celular', () => {
  const nav = (ua: string, extra: Record<string, unknown> = {}) => ({ userAgent: ua, platform: 'x', serviceWorker: {}, ...extra }) as never;
  const win = (standalone: boolean, push = true) => ({ matchMedia: () => ({ matches: standalone }), ...(push ? { PushManager: {}, Notification: {} } : {}) }) as never;

  it('iPhone fora da Tela de Início pede para instalar; instalado, liga', () => {
    const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)';
    expect(suporteDeAvisos(nav(iphone), win(false))).toBe('iphone_instalar');
    expect(suporteDeAvisos(nav(iphone), win(true))).toBe('ok');
  });
  it('Android liga direto; navegador sem push não mostra nada', () => {
    expect(suporteDeAvisos(nav('Mozilla/5.0 (Linux; Android 14)'), win(false))).toBe('ok');
    expect(suporteDeAvisos(nav('Mozilla/5.0 (Linux; Android 14)'), win(false, false))).toBe('sem_suporte');
  });
});

describe('a função dos avisos (regras.ts)', () => {
  it('o WhatsApp como o formulário grava', () => {
    expect(whatsappDoFormulario('+55 (19) 99000-1111')).toBe('19990001111');
    expect(whatsappDoFormulario('(19) 3333-4444')).toBe('1933334444');
  });
  it('a notificação abre a Central no aviso', () => {
    expect(notificacaoDoAviso({ id: 'a1', titulo: 'É amanhã!', texto: 'Natal Feliz.' })).toEqual({ titulo: 'É amanhã!', texto: 'Natal Feliz.', url: '/voluntariado/natalfeliz26/central?aviso=a1', tag: 'aviso-a1' });
    expect(BOAS_VINDAS.url).toBe('/voluntariado/natalfeliz26/central');
  });
  it('404 e 410 = o celular desligou (apaga); 2xx = ok; o resto = falha', () => {
    expect(resultadoDoEnvio(201)).toBe('ok');
    expect(resultadoDoEnvio(410)).toBe('expirado');
    expect(resultadoDoEnvio(404)).toBe('expirado');
    expect(resultadoDoEnvio(429)).toBe('falhou');
  });
  it('manda em lotes, sem perder ninguém', async () => {
    let aoMesmoTempo = 0; let pico = 0;
    const r = await emLotes([1, 2, 3, 4, 5], 2, async (x) => { aoMesmoTempo++; pico = Math.max(pico, aoMesmoTempo); await Promise.resolve(); aoMesmoTempo--; return x * 2; });
    expect(r).toEqual([2, 4, 6, 8, 10]);
    expect(pico).toBeLessThanOrEqual(2);
  });
});
