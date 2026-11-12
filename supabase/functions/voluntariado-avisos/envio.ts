import webpush from 'npm:web-push@3.6.7';
import { resultadoDoEnvio, type Notificacao } from './regras.ts';

/**
 * O envio de uma notificação a um celular (Web Push). O web-push só cifra e
 * assina (generateRequestDetails); quem manda é o fetch do Deno: o
 * sendNotification do pacote usa o https do Node, que o teste local não
 * alcança. Testado contra um servidor local que decifra a mensagem e confere
 * a assinatura VAPID, e contra o serviço de push do Chrome (13/11/2026).
 */

/** Quem manda os avisos, para o serviço de notificação do celular (pede um contato). */
export const ASSUNTO = 'https://app.anabrasil.org';
/** Quanto tempo o serviço guarda a notificação se o celular estiver desligado. */
export const VALIDADE_S = 4 * 3600;

export interface Chaves { publica: string; privada: string }
export interface Celular { id: string; endpoint: string; p256dh: string; auth: string }

export const novasChaves = (): Chaves => {
  const k = webpush.generateVAPIDKeys();
  return { publica: k.publicKey, privada: k.privateKey };
};

export async function enviar(c: Celular, n: Notificacao, k: Chaves): Promise<'ok' | 'expirado' | 'falhou'> {
  try {
    const d = webpush.generateRequestDetails(
      { endpoint: c.endpoint, keys: { p256dh: c.p256dh, auth: c.auth } },
      JSON.stringify(n),
      { TTL: VALIDADE_S, urgency: 'high', vapidDetails: { subject: ASSUNTO, publicKey: k.publica, privateKey: k.privada } },
    );
    const r = await fetch(d.endpoint, { method: d.method, headers: d.headers, body: d.body });
    await r.body?.cancel();
    if (!r.ok) console.error('envio recusado', c.id, r.status);
    return resultadoDoEnvio(r.status);
  } catch (e) {
    console.error('envio falhou', c.id, String(e));
    return 'falhou';
  }
}
