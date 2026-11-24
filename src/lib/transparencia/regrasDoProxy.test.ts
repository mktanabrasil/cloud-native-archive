import { describe, expect, it } from 'vitest';
import {
  ehAcaoConhecida, ehAcaoDeGestor, ehEmailGestor, ehIdDoDrive, ehVoltaPermitida, pastasLiberadasPor,
} from '../../../supabase/functions/google-drive-proxy/regras';

/** Acesso à função do Portal Transparência (24/11/2026). */
describe('as regras da função do Drive', () => {
  it('só listar é público; conectar, trocar, desconectar e conferir são de gestor', () => {
    expect(ehAcaoDeGestor('list_files')).toBe(false);
    for (const a of ['get_auth_url', 'exchange_code', 'disconnect', 'check_auth', 'get_folder_name'] as const) expect(ehAcaoDeGestor(a)).toBe(true);
    expect(ehAcaoConhecida('apagar_tudo')).toBe(false);
  });

  it('gestor: os três e-mails, sem diferenciar maiúsculas', () => {
    expect(ehEmailGestor('Transparencia@anabrasil.org ')).toBe(true);
    expect(ehEmailGestor('coord@anabrasil.org')).toBe(false);
    expect(ehEmailGestor(null)).toBe(false);
  });

  it('código do Drive: recusa o que poderia mexer na consulta', () => {
    expect(ehIdDoDrive('1BzicdGu9vGZUDgC8L2IlPD2rRwWPEkg7')).toBe(true);
    expect(ehIdDoDrive("x' or name contains 'a")).toBe(false);
    expect(ehIdDoDrive('curto')).toBe(false);
    expect(ehIdDoDrive(42)).toBe(false);
  });

  it('volta do Google: só o painel do app ou o localhost', () => {
    expect(ehVoltaPermitida('https://app.anabrasil.org/portal-transparencia?type=google_connect')).toBe(true);
    expect(ehVoltaPermitida('http://localhost:8080/portal-transparencia?type=google_connect')).toBe(true);
    expect(ehVoltaPermitida('https://app.anabrasil.org.golpe.com/portal-transparencia')).toBe(false);
    expect(ehVoltaPermitida('http://app.anabrasil.org/portal-transparencia')).toBe(false);
    expect(ehVoltaPermitida('https://app.anabrasil.org/outra')).toBe(false);
  });

  it('uma listagem libera as subpastas e os destinos dos atalhos de pasta, não os arquivos', () => {
    const P = 'application/vnd.google-apps.folder';
    expect(pastasLiberadasPor([
      { id: 'SUBPASTAaaaaaaaaaaaa', mimeType: P },
      { id: 'ATALHObbbbbbbbbbbbbb', mimeType: 'application/vnd.google-apps.shortcut', shortcutDetails: { targetId: 'DESTINOcccccccccccc', targetMimeType: P } },
      { id: 'ATALHOARQdddddddddd', mimeType: 'application/vnd.google-apps.shortcut', shortcutDetails: { targetId: 'ARQeeeeeeeeeeeeeeee', targetMimeType: 'application/pdf' } },
      { id: 'DOCffffffffffffffff', mimeType: 'application/pdf' },
    ])).toEqual(['SUBPASTAaaaaaaaaaaaa', 'DESTINOcccccccccccc']);
  });
});
