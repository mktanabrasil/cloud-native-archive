/*
 * Central do Voluntário: os avisos no celular (13/11/2026).
 *
 * Só recebe e mostra as notificações (Web Push) e, no toque, abre a Central.
 * Não guarda nada em cache: o app continua sendo carregado do servidor.
 * Registrado com escopo /voluntariado/natalfeliz26/ (fora dele não faz nada).
 */

const CENTRAL = '/voluntariado/natalfeliz26/central';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { texto: e.data ? e.data.text() : '' }; }
  const titulo = d.titulo || 'Natal Feliz · ANA Brasil';
  e.waitUntil((async () => {
    await self.registration.showNotification(titulo, {
      body: d.texto || '',
      icon: '/icon-192.png',
      badge: '/badge-central.png',
      tag: d.tag || undefined,
      lang: 'pt-BR',
      data: { url: d.url || CENTRAL },
    });
    // A Central aberta atualiza a lista de avisos na hora.
    const abertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    abertas.forEach((c) => c.postMessage({ tipo: 'aviso', titulo, texto: d.texto || '', tag: d.tag || '' }));
  })());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || CENTRAL, self.location.origin).href;
  e.waitUntil((async () => {
    const abertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const central = abertas.find((c) => c.url.startsWith(self.location.origin + CENTRAL));
    if (central) {
      await central.focus();
      try { await central.navigate(url); } catch (_) { /* fica onde está */ }
      return;
    }
    await self.clients.openWindow(url);
  })());
});
