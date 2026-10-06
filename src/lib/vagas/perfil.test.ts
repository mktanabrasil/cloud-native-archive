import { describe, expect, it } from 'vitest';
import { PERFIL_VAZIO, completude, conferirCurriculo, mascararWhatsapp, paraPerfil, passosQueFaltam, periodo, tamanhoLegivel, whatsappValido } from './perfil';

describe('perfil do candidato', () => {
  it('completude de 20 em 20 e os passos que faltam', () => {
    expect(completude(PERFIL_VAZIO, 0)).toBe(0);
    const p = { ...PERFIL_VAZIO, nome: 'Leonardo Alves', nascimento: '1999-03-14', whatsapp: '(19) 99123-4567', cidade: 'Campinas/SP', escolaridade: 'medio' as const };
    expect(completude(p, 0)).toBe(60);
    expect(passosQueFaltam(p, 0).map((f) => f.nome)).toEqual(['Experiência', 'Disponibilidade']);
    expect(completude({ ...p, sem_experiencia: true, disponibilidade: ['manha'] }, 0)).toBe(100);
    expect(completude({ ...p, disponibilidade: ['tarde'] }, 2)).toBe(100);
  });

  it('WhatsApp com máscara e DDD', () => {
    expect(mascararWhatsapp('19991234567')).toBe('(19) 99123-4567');
    expect(mascararWhatsapp('1932345678')).toBe('(19) 3234-5678');
    expect(mascararWhatsapp('19')).toBe('(19');
    expect(whatsappValido('(19) 99123-4567')).toBe(true);
    expect(whatsappValido('99123-4567')).toBe(false);
  });

  it('lê a linha do banco ignorando valor desconhecido', () => {
    const p = paraPerfil({ nome: 'Leo', escolaridade: 'doutorado', disponibilidade: ['manha', 'madrugada'], curriculo_tamanho: 245760 });
    expect(p.escolaridade).toBe('');
    expect(p.disponibilidade).toEqual(['manha']);
    expect(tamanhoLegivel(p.curriculo_tamanho)).toBe('240 KB');
    expect(tamanhoLegivel(3 * 1024 * 1024)).toBe('3,0 MB');
  });

  it('período da experiência', () => {
    expect(periodo({ inicio: '2023-03', fim: null, atual: true })).toBe('mar/2023 – atual');
    expect(periodo({ inicio: '2021-02', fim: '2022-12', atual: false })).toBe('fev/2021 – dez/2022');
  });

  it('currículo: tipo e tamanho', () => {
    const f = (nome: string, tipo: string, bytes: number) => new File([new Uint8Array(bytes)], nome, { type: tipo });
    expect(conferirCurriculo(f('cv.pdf', 'application/pdf', 1000))).toBeNull();
    expect(conferirCurriculo(f('foto.jpg', 'image/jpeg', 1000))).toBeNull();
    expect(conferirCurriculo(f('cv.docx', 'application/msword', 1000))).toMatch(/PDF, JPG ou PNG/);
    expect(conferirCurriculo(f('grande.pdf', 'application/pdf', 11 * 1024 * 1024))).toMatch(/11,0 MB e o limite é 10 MB/);
    expect(conferirCurriculo(f('vazio.pdf', 'application/pdf', 0))).toMatch(/vazio/);
  });
});
