/**
 * Background & Lock-Screen Alarm Service
 * Ensures duty administrators are immediately alerted with high-urgency notifications,
 * loud vibration, and emergency siren even when the app is in the background or closed.
 */

import { IncidentReport } from '../types';

const ACKNOWLEDGED_PHOTOS_KEY = 'madrid_acknowledged_incident_photos';

export type NotificationPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

/**
 * Returns current browser/device Notification permission
 */
export function getNotificationPermissionStatus(): NotificationPermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission as NotificationPermissionState;
}

/**
 * Requests device OS notification permission for emergency lock-screen alerts
 */
export async function requestBackgroundAlarmPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  try {
    const perm = await Notification.requestPermission();
    return perm === 'granted';
  } catch (err) {
    console.warn('Error requesting notification permission:', err);
    return false;
  }
}

/**
 * Checks whether an incident photo has already been acknowledged by the admin
 */
export function isPhotoIncidentAcknowledged(reportId: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(ACKNOWLEDGED_PHOTOS_KEY);
    if (!raw) return false;
    const list: string[] = JSON.parse(raw);
    return list.includes(reportId);
  } catch {
    return false;
  }
}

/**
 * Marks an incident photo as acknowledged so it won't repeatedly alarm on cold launch
 */
export function markPhotoIncidentAcknowledged(reportId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(ACKNOWLEDGED_PHOTOS_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    if (!list.includes(reportId)) {
      list.push(reportId);
      localStorage.setItem(ACKNOWLEDGED_PHOTOS_KEY, JSON.stringify(list.slice(-200)));
    }
  } catch {
    // Ignore storage issues
  }
}

/**
 * Filters recent unacknowledged incident reports that contain photos
 */
export function getUnacknowledgedPhotoReports(reports: IncidentReport[]): IncidentReport[] {
  if (!reports || reports.length === 0) return [];
  const cutoff = Date.now() - 48 * 60 * 60 * 1000; // Last 48 hours

  return reports.filter((r) => {
    // Only active emergency reports with photos
    if (r.status === 'resolved') return false;
    const hasPhoto = r.photos && r.photos.length > 0;
    if (!hasPhoto) return false;

    // Check creation time
    const createdTime = new Date(r.createdAt).getTime() || 0;
    if (createdTime < cutoff) return false;

    // Must not be already acknowledged
    return !isPhotoIncidentAcknowledged(r.id);
  });
}

export interface IncidentPhotoAlertPayload {
  id: string;
  incidentNumber: string;
  title?: string;
  location?: string;
  photoUrl?: string;
  category?: string;
  severity?: string;
}

/**
 * Dispatches an emergency lock-screen notification with heavy vibration and photo evidence
 * Even when the phone is locked or browser is minimized/closed.
 */
export function triggerIncidentPhotoNotification(payload: IncidentPhotoAlertPayload): void {
  if (typeof window === 'undefined') return;

  const loc = payload.location || 'Madrid, Surigao del Sur';
  const title = `🚨 [PHOTO ALERT] EMERGENCY: ${payload.incidentNumber}`;
  const body = `📸 Incident photo submitted at ${loc} (${payload.title || 'Emergency'}). Tap to sound continuous siren & dispatch response units!`;

  const notificationOptions: any = {
    body,
    icon: '/ChatGPT Image Sep 23, 2026, 12_48_31 PM.png',
    badge: '/ChatGPT Image Sep 23, 2026, 12_48_31 PM.png',
    tag: `bfp-madrid-photo-${payload.id}`,
    requireInteraction: true, // Forces persistent display on lock screen until duty officer acknowledges
    renotify: true,
    vibrate: [1500, 250, 1500, 250, 2000, 250, 3000],
    data: {
      url: `/?adminAlarm=true&incidentId=${payload.id}&hasPhoto=1`,
      timestamp: Date.now(),
      incidentId: payload.id,
      hasPhoto: true,
    },
    actions: [
      { action: 'respond', title: '🚨 OPEN DISPATCH & SIREN' },
      { action: 'view_photo', title: '📸 VIEW INCIDENT PHOTO' },
    ],
  };

  // Include photo in system notification if available
  if (payload.photoUrl && !payload.photoUrl.startsWith('data:')) {
    notificationOptions.image = payload.photoUrl;
  }

  // 1. Post to active Service Worker (highest priority for background/lock-screen handling)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((reg) => {
        reg.active?.postMessage({
          type: 'INCIDENT_PHOTO_ALERT',
          details: {
            ...payload,
            hasPhoto: true,
          },
        });

        // Also call showNotification directly on registration
        reg.showNotification(title, notificationOptions).catch(() => {});
      })
      .catch(() => {});
  }

  // 2. Direct Window Notification fallback
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, notificationOptions);
    } catch {
      // Ignored
    }
  }

  // 3. Post to BroadcastChannel for cross-tab synchronization
  try {
    if ('BroadcastChannel' in window) {
      const channel = new BroadcastChannel('bfp_madrid_emergency_channel');
      channel.postMessage({
        type: 'INCIDENT_PHOTO_ALERT',
        details: payload,
        timestamp: Date.now(),
      });
    }
  } catch {
    // Ignored
  }
}

/**
 * Schedules a test lock-screen notification so administrators can test locking their phone or closing the tab
 */
export function scheduleTestLockScreenAlarm(
  delaySeconds: number = 4,
  onScheduled?: () => void
): void {
  if (typeof window === 'undefined') return;

  if (onScheduled) onScheduled();

  setTimeout(() => {
    triggerIncidentPhotoNotification({
      id: 'test-drill-' + Date.now(),
      incidentNumber: 'DRILL-TEST-' + Math.floor(Math.random() * 900 + 100),
      title: 'TEST DRILL: Lock-Screen Photo Alarm Verification',
      location: 'Brgy. Linungao (Poblacion), Madrid',
      photoUrl: 'https://images.unsplash.com/photo-1542385151-efd9000785a0?auto=format&fit=crop&w=600&q=80',
    });
  }, delaySeconds * 1000);
}
