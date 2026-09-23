// Service Worker for BFP Madrid Emergency Notifier
const CACHE_NAME = 'bfp-madrid-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/ChatGPT Image Sep 23, 2026, 12_48_31 PM.png',
  '/manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {});
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

// Listen for broadcasted emergency dispatch messages from any tab
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'ADMIN_EMERGENCY_ALARM_TRIGGERED') {
    const details = event.data.details || {};
    const title = '🚨 [CRITICAL DISPATCH] BFP MADRID EMERGENCY!';
    const options = {
      body: details.incidentNumber
        ? `EMERGENCY ALERT: ${details.incidentNumber} reported at ${details.location || 'Madrid, Surigao del Sur'}. Open app immediately to dispatch response unit!`
        : 'Emergency incident distress received! Duty dispatchers Admin1 & Admin2 respond immediately!',
      icon: '/ChatGPT Image Sep 23, 2026, 12_48_31 PM.png',
      badge: '/ChatGPT Image Sep 23, 2026, 12_48_31 PM.png',
      tag: 'bfp-madrid-critical-alarm',
      requireInteraction: true, // Will not auto-dismiss; forces duty admin attention
      renotify: true,
      vibrate: [1200, 200, 1200, 200, 1600, 250, 2400],
      data: {
        url: '/?adminAlarm=true',
        timestamp: Date.now()
      },
      actions: [
        { action: 'respond', title: '🚨 OPEN DISPATCH' },
        { action: 'silence', title: '🔕 MUTE ALARM' }
      ]
    };

    self.registration.showNotification(title, options).catch(() => {});
  }
});

// Handle incoming background push notifications (even when browser tab is closed)
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { text: event.data.text() };
    }
  }

  const title = data.title || '🚨 CRITICAL BFP MADRID EMERGENCY';
  const options = {
    body: data.body || 'New high-priority emergency reported in Madrid, Surigao del Sur. Immediate dispatch required!',
    icon: '/ChatGPT Image Sep 23, 2026, 12_48_31 PM.png',
    badge: '/ChatGPT Image Sep 23, 2026, 12_48_31 PM.png',
    tag: 'bfp-madrid-critical-alarm',
    requireInteraction: true,
    renotify: true,
    vibrate: [1200, 200, 1200, 200, 1600, 250, 2400],
    data: { url: '/?adminAlarm=true' }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click handler: focus or open app to admin alarm view
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'silence') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
          client.postMessage({ type: 'ADMIN_ALARM_STOPPED' });
        }
      })
    );
    return;
  }

  const targetUrl = event.notification.data?.url || '/?adminAlarm=true';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.postMessage({ type: 'FOCUS_ADMIN_DISPATCH' });
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
