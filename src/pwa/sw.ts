/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { BackgroundSyncPlugin } from 'workbox-background-sync';

// Declarar as variáveis injetadas pelo VitePWA (para o TypeScript não reclamar)
declare let self: ServiceWorkerGlobalScope;

// Limpeza automática de caches antigos gerados pelo Workbox
cleanupOutdatedCaches();

// Precache dos assets críticos injetados no tempo de build (JS, CSS, HTML)
precacheAndRoute(self.__WB_MANIFEST || []);

// 1. Assets estáticos genéricos (Fontes, Imagens) -> Estratégia: CacheFirst
registerRoute(
  ({ request }) => request.destination === 'font' || request.destination === 'image',
  new CacheFirst({
    cacheName: 'assets-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 30 * 24 * 60 * 60, // Expirar após 30 dias
      }),
    ],
  })
);

// 2. Avatares e VCards (Podem mudar com o tempo) -> Estratégia: StaleWhileRevalidate
registerRoute(
  ({ url }) => url.pathname.includes('/avatars/') || url.pathname.includes('/vcards/'),
  new StaleWhileRevalidate({
    cacheName: 'avatars-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 300,
        maxAgeSeconds: 7 * 24 * 60 * 60, // 7 dias
      }),
    ],
  })
);

// 3. API REST e fallback BOSH -> Estratégia: NetworkFirst
registerRoute(
  ({ url }) => url.pathname.includes('/http-bind') || url.pathname.includes('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 5,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 24 * 60 * 60, // 1 dia
      }),
    ],
  })
);

// 4. Background Sync para enfileirar mensagens enviadas enquanto o usuário estava Offline
const bgSyncPlugin = new BackgroundSyncPlugin('outbox-queue', {
  maxRetentionTime: 24 * 60, // Tentar sincronizar por até 24 horas (em minutos)
});

registerRoute(
  ({ url }) => url.pathname.includes('/api/messages/send'), // Fallback REST, se existir
  new NetworkFirst({
    plugins: [bgSyncPlugin],
  }),
  'POST'
);

// ==========================================
// Web Push Notifications API (Requer iOS 16.4+)
// ==========================================

self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json() ?? {};
  
  const options: NotificationOptions = {
    body: data.body || 'Nova mensagem recebida.',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    data: {
      url: data.url || '/',
      conversationId: data.conversationId
    },
    // Vibração: curtas pulsações (se suportado pelo dispositivo)
    vibrate: [200, 100, 200]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Nova Mensagem - XMPP', options)
  );
});

// Ação ao clicar na notificação
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = new URL(event.notification.data.url, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      let matchingClient = null;
      // Procura se já tem uma aba/janela aberta no URL alvo
      for (let i = 0; i < windowClients.length; i++) {
        const windowClient = windowClients[i];
        if (windowClient.url === urlToOpen) {
          matchingClient = windowClient;
          break;
        }
      }
      // Foca se existir, senão abre nova janela/aba
      if (matchingClient) {
        return matchingClient.focus();
      } else {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});

// Mensagem vinda do main thread para forçar o Service Worker a assumir o controle imediatamente (Skip Waiting)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
