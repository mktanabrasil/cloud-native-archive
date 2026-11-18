import { describe, expect, it } from 'vitest';
import {
  digitosDoWhatsapp, equipeDiferente, equipeParaGravar, erroDaEquipe, formatarWhatsapp, limparFuncionarios, limparVoluntarios, nomesJaUsados, whatsappValido,
} from './equipe';
import { montarChecklist } from './checklist';
import type { AppEvent } from '@/types';

describe('o WhatsApp do voluntário', () => {
  it('só os números, sem o 55 do país; 10 ou 11 com DDD', () => {
    expect(digitosDoWhatsapp('(19) 99812-4410')).toBe('19998124410');
    expect(digitosDoWhatsapp('+55 19 99812-4410')).toBe('19998124410');
    expect(whatsappValido('(19) 3232-1000')).toBe(true);
    expect(whatsappValido('99812-4410')).toBe(false);
    expect(formatarWhatsapp('19998124410')).toBe('(19) 99812-4410');
    expect(formatarWhatsapp('1932321000')).toBe('(19) 3232-1000');
    expect(formatarWhatsapp('123')).toBe('123');
  });
});

describe('as listas', () => {
  it('funcionários: apara, tira vazio e repetido (sem olhar acento nem maiúscula)', () => {
    expect(limparFuncionarios([' Marina  Costa ', '', 'marina costa', 'Rafael Souza', 'Rafaél souza'])).toEqual(['Marina Costa', 'Rafael Souza']);
  });
  it('voluntários: linha toda vazia sai; o WhatsApp fica só com números', () => {
    expect(limparVoluntarios([{ nome: ' Carla ', whatsapp: '(19) 99812-4410' }, { nome: '', whatsapp: '' }])).toEqual([{ nome: 'Carla', whatsapp: '19998124410' }]);
  });
  it('nomes já usados em outros eventos, em ordem e sem repetir', () => {
    expect(nomesJaUsados([{ equipe_funcionarios: ['Rafael Souza', 'Ana'] }, { equipe_funcionarios: ['ana'] }, {}] as AppEvent[])).toEqual(['Ana', 'Rafael Souza']);
  });
});

describe('o que falta para enviar', () => {
  it('só cobra o que está marcado', () => {
    expect(erroDaEquipe('Outra equipe da igreja', [], [])).toBeNull();
    expect(erroDaEquipe('Funcionários', [], [])).toMatch(/nome de quem da equipe/);
    expect(erroDaEquipe('Funcionários', ['Marina'], [])).toBeNull();
    expect(erroDaEquipe('Voluntários', [], [])).toMatch(/nome e o WhatsApp/);
    expect(erroDaEquipe('Voluntários', [], [{ nome: '', whatsapp: '19998124410' }])).toMatch(/Falta o nome/);
    expect(erroDaEquipe('Voluntários', [], [{ nome: 'Carla', whatsapp: '9981' }])).toMatch(/Confira o WhatsApp/);
    expect(erroDaEquipe('Funcionários, Voluntários', ['Marina'], [{ nome: 'Carla', whatsapp: '19998124410' }])).toBeNull();
  });
  it('grava só o que está marcado', () => {
    expect(equipeParaGravar('Voluntários', ['Marina'], [{ nome: 'Carla', whatsapp: '(19) 99812-4410' }]))
      .toEqual({ equipe_funcionarios: [], equipe_voluntarios: [{ nome: 'Carla', whatsapp: '19998124410' }] });
  });
});

describe('a equipe mudou?', () => {
  it('compara o que vai ser gravado', () => {
    const salvo = { support_team: 'Funcionários', equipe_funcionarios: ['Marina'], equipe_voluntarios: [] };
    expect(equipeDiferente(salvo, { ...salvo, equipe_funcionarios: [' Marina '] })).toBe(false);
    expect(equipeDiferente(salvo, { ...salvo, equipe_funcionarios: ['Marina', 'Rafael'] })).toBe(true);
    expect(equipeDiferente(salvo, { ...salvo, support_team: 'Funcionários, Voluntários' })).toBe(true);
    expect(equipeDiferente({ support_team: 'Funcionários' }, { support_team: 'Funcionários' })).toBe(false);
  });
});

describe('o checklist (18/11/2026)', () => {
  const base = { title: 'X', unit: 'DIC', start_datetime: '2026-11-22T12:00:00Z', end_datetime: '2026-11-22T15:00:00Z' } as AppEvent;
  it('com os nomes, diz quem; sem eles, o texto de antes', () => {
    const com = montarChecklist({ ...base, support_team: 'Funcionários, Voluntários', equipe_funcionarios: ['Marina Costa'], equipe_voluntarios: [{ nome: 'Carla', whatsapp: '19998124410' }] });
    expect(com.antes).toContain('Confirmar a equipe do dia: Marina Costa');
    expect(com.antes).toContain('Confirmar os voluntários: Carla ((19) 99812-4410)');
    expect(com.antes.some(i => i.startsWith('Confirmar quem ajuda'))).toBe(false);
    const comOutra = montarChecklist({ ...base, support_team: 'Funcionários, Equipe da igreja', equipe_funcionarios: ['Marina Costa'] });
    expect(comOutra.antes).toContain('Confirmar quem ajuda no dia: equipe da igreja');
    const sem = montarChecklist({ ...base, support_team: 'Funcionários' });
    expect(sem.antes).toContain('Confirmar quem ajuda no dia: funcionários');
  });
});
