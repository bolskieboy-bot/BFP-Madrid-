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
  if (
    event.data &&
    (event.data.type === 'ADMIN_EMERGENCY_ALARM_TRIGGERED' ||
      event.data.type === 'INCIDENT_PHOTO_ALERT')
  ) {
    const details = event.data.details || {};
    const hasPhoto = details.hasPhoto || !!details.photoUrl;
    const title = hasPhoto
      ? `🚨 [PHOTO ALERT] EMERGENCY: ${details.incidentNumber || 'NEW INCIDENT'}`
      : `🚨 [CRITICAL DISPATCH] BFP MADRID EMERGENCY!`;

    const options = {
      body: hasPhoto
        ? `📸 Photo evidence sent from ${details.location || 'Madrid, Surigao del Sur'} (${details.title || 'Emergency Incident'}). Duty Admin: Tap to view photo and sound station siren!`
        : (details.incidentNumber
            ? `EMERGENCY ALERT: ${details.incidentNumber} reported at ${details.location || 'Madrid, Surigao del Sur'}. Open app immediately to dispatch response unit!`
            : 'Emergency incident distress received! Duty dispatchers respond immediately!'),
      icon: '/ChatGPT Image Sep 23, 2026, 12_48_31 PM.png',
      badge: '/ChatGPT Image Sep 23, 2026, 12_48_31 PM.png',
      tag: 'bfp-madrid-critical-photo-alarm',
      requireInteraction: true, // Will not auto-dismiss; forces duty admin attention on lock screen
      renotify: true,
      vibrate: [1500, 200, 1500, 200, 2000, 250, 3000],
      data: {
        url: `/?adminAlarm=true&incidentId=${details.id || ''}&hasPhoto=${hasPhoto ? '1' : '0'}`,
        timestamp: Date.now(),
        incidentId: details.id,
        hasPhoto: hasPhoto,
      },
      actions: [
        { action: 'respond', title: '🚨 OPEN DISPATCH & SIREN' },
        { action: 'view_photo', title: '📸 VIEW INCIDENT PHOTO' },
      ],
    };

    // If photoUrl is available, add preview image for rich Android & desktop notifications
    if (details.photoUrl && !details.photoUrl.startsWith('data:')) {
      options.image = details.photoUrl;
    }

    self.registration.showNotification(title, options).catch((err) => {
      console.warn('Failed to display SW notification:', err);
    });
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

  const hasPhoto = data.hasPhoto || !!data.photoUrl;
  const title = data.title || (hasPhoto ? '🚨 [PHOTO ALERT] BFP MADRID EMERGENCY' : '🚨 CRITICAL BFP MADRID EMERGENCY');
  const options = {
    body: data.body || (hasPhoto ? '📸 Emergency photo sent in Madrid. Immediate duty admin response required!' : 'New high-priority emergency reported in Madrid, Surigao del Sur. Immediate dispatch required!'),
    icon: '/ChatGPT Image Sep 23, 2026, 12_48_31 PM.png',
    badge: '/ChatGPT Image Sep 23, 2026, 12_48_31 PM.png',
    tag: 'bfp-madrid-critical-photo-alarm',
    requireInteraction: true,
    renotify: true,
    vibrate: [1500, 200, 1500, 200, 2000, 250, 3000],
    data: {
      url: `/?adminAlarm=true&incidentId=${data.incidentId || ''}&hasPhoto=${hasPhoto ? '1' : '0'}`,
      incidentId: data.incidentId,
      hasPhoto: hasPhoto
    },
    actions: [
      { action: 'respond', title: '🚨 OPEN DISPATCH & SIREN' },
      { action: 'view_photo', title: '📸 VIEW INCIDENT PHOTO' },
    ]
  };

  if (data.photoUrl && !data.photoUrl.startsWith('data:')) {
    options.image = data.photoUrl;
  }

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
  const incidentId = event.notification.data?.incidentId;
  const hasPhoto = event.notification.data?.hasPhoto;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.postMessage({
            type: 'FOCUS_ADMIN_DISPATCH',
            incidentId,
            action: event.action,
            hasPhoto
          });
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
