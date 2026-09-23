/**
 * Audio, Haptic, and Notification Synthesis Service for BFP Madrid Emergency App
 *
 * CRITICAL POLICY:
 * - Citizens: STRICTLY NO ALARM when reporting or sending photos. Only a reassuring, quiet confirmation chime.
 * - Admins (Admin1 & Admin2): High-priority, piercing, disturbing emergency station siren
 *   with intense vibration and lock-screen/background notifications even when app is closed/in background.
 */

let audioCtx: AudioContext | null = null;
let activeAlarmNodes: { osc1: OscillatorNode; osc2: OscillatorNode; osc3?: OscillatorNode; gain: GainNode } | null = null;
let continuousAlarmTimer: number | null = null;
let isContinuousAlarmActive = false;
let wakeLockSentinel: any = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Stop any currently sounding emergency alarm siren immediately
 */
export function stopAllAlarmSounds(): void {
  try {
    if (activeAlarmNodes) {
      activeAlarmNodes.gain.gain.setValueAtTime(0.0001, audioCtx?.currentTime || 0);
      try {
        activeAlarmNodes.osc1.stop();
        activeAlarmNodes.osc2.stop();
        activeAlarmNodes.osc3?.stop();
      } catch {
        // Ignore if already stopped
      }
      activeAlarmNodes = null;
    }
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(0);
    }
    if (wakeLockSentinel) {
      try {
        wakeLockSentinel.release();
      } catch {
        // Ignore
      }
      wakeLockSentinel = null;
    }
  } catch {
    // Ignore
  }
}

/**
 * Plays one piercing, jarring siren burst designed to awaken and immediately alert duty dispatchers
 */
function playDisturbingAlarmBurst(duration: number = 2.4): void {
  try {
    stopAllAlarmSounds();

    const ctx = getAudioContext();
    if (!ctx) return;

    // Severe disturbing emergency haptic vibration cadence
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([1200, 200, 1200, 200, 1600, 250, 2400]);
    }

    // Try to acquire wake lock so screen doesn't turn off during active emergency alarm
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator && !wakeLockSentinel) {
      try {
        (navigator as any).wakeLock.request('screen').then((sentinel: any) => {
          wakeLockSentinel = sentinel;
        }).catch(() => {});
      } catch {
        // WakeLock optional
      }
    }

    const now = ctx.currentTime;
    const endTime = now + duration;

    // High piercing sawtooth siren
    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';

    // Sub-harmonic jarring square klaxon
    const osc2 = ctx.createOscillator();
    osc2.type = 'square';

    // Discordant warning tone (tri-tone dissonance for maximum disturbance)
    const osc3 = ctx.createOscillator();
    osc3.type = 'sawtooth';

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.55, now);

    // Rapid oscillating sweep: 880Hz to 1650Hz
    const cycleDuration = 0.28;
    let t = now;
    let isHigh = false;

    while (t < endTime) {
      const nextTime = Math.min(t + cycleDuration, endTime);
      const freq1 = isHigh ? 1650 : 880;
      const freq2 = isHigh ? 825 : 440;
      const freq3 = isHigh ? 1165 : 622; // Tritone / augmented 4th

      osc1.frequency.exponentialRampToValueAtTime(freq1, nextTime);
      osc2.frequency.exponentialRampToValueAtTime(freq2, nextTime);
      osc3.frequency.exponentialRampToValueAtTime(freq3, nextTime);

      t = nextTime;
      isHigh = !isHigh;
    }

    osc1.connect(masterGain);
    osc2.connect(masterGain);
    osc3.connect(masterGain);
    masterGain.connect(ctx.destination);

    activeAlarmNodes = { osc1, osc2, osc3, gain: masterGain };

    osc1.start(now);
    osc2.start(now);
    osc3.start(now);

    osc1.stop(endTime);
    osc2.stop(endTime);
    osc3.stop(endTime);

    setTimeout(() => {
      if (activeAlarmNodes?.osc1 === osc1) {
        activeAlarmNodes = null;
      }
    }, duration * 1000 + 50);
  } catch (e) {
    console.warn('Disturbing alarm burst error:', e);
  }
}

/**
 * Check if the continuous station alarm is currently sounding
 */
export function isStationAlarmSounding(): boolean {
  return isContinuousAlarmActive;
}

/**
 * ADMIN ONLY:
 * Starts continuous, disturbing station alarm siren for Admin1 & Admin2.
 * Sounds indefinitely until an admin officer stops it or acknowledges dispatch.
 */
export function startContinuousStationAlarm(reportDetails?: { incidentNumber?: string; location?: string }): void {
  if (isContinuousAlarmActive) return;
  isContinuousAlarmActive = true;

  // Play immediately
  playDisturbingAlarmBurst(2.4);

  // Trigger high-priority push notification and vibration even when app is closed / backgrounded
  dispatchBackgroundAdminNotification(reportDetails);

  // Repeat continuous disturbing alarm cycle every 2.45 seconds
  if (typeof window !== 'undefined') {
    if (continuousAlarmTimer !== null) {
      clearInterval(continuousAlarmTimer);
    }
    continuousAlarmTimer = window.setInterval(() => {
      if (isContinuousAlarmActive) {
        playDisturbingAlarmBurst(2.4);
      } else {
        if (continuousAlarmTimer !== null) {
          clearInterval(continuousAlarmTimer);
          continuousAlarmTimer = null;
        }
      }
    }, 2450);
  }
}

export interface BackgroundNotificationDetails {
  id?: string;
  incidentNumber?: string;
  location?: string;
  photoUrl?: string;
  hasPhoto?: boolean;
  title?: string;
}

/**
 * Dispatches a persistent, wake-up Web Notification with severe vibration pattern.
 * Uses Service Worker showNotification if active so it can sound even if tab is in background or closed.
 */
export function dispatchBackgroundAdminNotification(details?: BackgroundNotificationDetails): void {
  if (typeof window === 'undefined') return;

  const hasPhoto = details?.hasPhoto || !!details?.photoUrl;
  const title = hasPhoto
    ? `🚨 [PHOTO ALERT] EMERGENCY: ${details?.incidentNumber || 'NEW INCIDENT'}`
    : `🚨 [CRITICAL DISPATCH] BFP MADRID EMERGENCY!`;

  const body = hasPhoto
    ? `📸 Incident photo submitted at ${details?.location || 'Madrid, Surigao del Sur'} (${details?.title || 'Emergency'}). Duty Admin: Tap to view photo & sound station siren!`
    : details?.incidentNumber
    ? `Incoming incident ${details.incidentNumber} reported at ${details.location || 'Madrid, Surigao del Sur'}! Station siren sounding!`
    : `Emergency incident distress received! Duty dispatchers respond immediately!`;

  const notificationOptions: any = {
    body,
    icon: '/ChatGPT Image Sep 23, 2026, 12_48_31 PM.png',
    badge: '/ChatGPT Image Sep 23, 2026, 12_48_31 PM.png',
    tag: `bfp-madrid-critical-photo-alarm-${details?.id || 'live'}`,
    requireInteraction: true, // Remains on mobile screen until duty officer acknowledges!
    renotify: true,
    vibrate: [1500, 250, 1500, 250, 2000, 250, 3000],
    data: {
      url: `/?adminAlarm=true&incidentId=${details?.id || ''}&hasPhoto=${hasPhoto ? '1' : '0'}`,
      timestamp: Date.now(),
      incidentId: details?.id,
      hasPhoto,
    },
    actions: [
      { action: 'respond', title: '🚨 OPEN DISPATCH & SIREN' },
      { action: 'view_photo', title: '📸 VIEW INCIDENT PHOTO' },
    ],
  };

  if (details?.photoUrl && !details.photoUrl.startsWith('data:')) {
    notificationOptions.image = details.photoUrl;
  }

  // Try service worker showNotification first (can alert even when app is minimized/closed)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then((reg) => {
      reg.active?.postMessage({
        type: hasPhoto ? 'INCIDENT_PHOTO_ALERT' : 'ADMIN_EMERGENCY_ALARM_TRIGGERED',
        details: { ...details, hasPhoto },
      });
      reg.showNotification(title, notificationOptions).catch(() => {});
    }).catch(() => {});
  } else if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, notificationOptions);
    } catch {
      // Ignore
    }
  }

  // Cross-tab broadcast channel
  try {
    if ('BroadcastChannel' in window) {
      const channel = new BroadcastChannel('bfp_madrid_emergency_channel');
      channel.postMessage({
        type: hasPhoto ? 'INCIDENT_PHOTO_ALERT' : 'ADMIN_EMERGENCY_ALARM_TRIGGERED',
        details,
        timestamp: Date.now(),
      });
    }
  } catch {
    // Ignore
  }
}

/**
 * ADMIN ONLY:
 * Stops the continuous alarm siren immediately.
 */
export function stopContinuousStationAlarm(): void {
  isContinuousAlarmActive = false;
  if (continuousAlarmTimer !== null) {
    clearInterval(continuousAlarmTimer);
    continuousAlarmTimer = null;
  }
  stopAllAlarmSounds();
}

/**
 * Single-shot test alarm siren for admin drills
 */
export function playAlarmingStationSiren(durationSeconds: number = 4): void {
  playDisturbingAlarmBurst(durationSeconds);
}

/**
 * FOR CITIZENS ONLY:
 * Quiet, reassuring, gentle confirmation chime when reporting or uploading photo.
 * STRICTLY NO ALARM SIREN OR SCARY SOUNDS on citizen phones!
 */
export function playCitizenGentleConfirmation(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    // Gentle short tactile confirmation tap (50ms)
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(50);
    }

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // Friendly, smooth two-tone major chord: C5 (523Hz) to G5 (784Hz)
    osc.frequency.setValueAtTime(523.25, now);
    osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.15);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.45);
  } catch (e) {
    console.warn('Citizen confirmation chime error:', e);
  }
}

// Push notification chime
export function playNotificationChime(): void {
  playCitizenGentleConfirmation();
}

// Radio dispatch burst for BFP responder transmission
export function playRadioDispatchChime(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(100);
    }

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.setValueAtTime(1600, now + 0.08);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.22);
  } catch {
    // Ignore
  }
}

/**
 * Backward compatibility alias for emergency siren
 */
export const playEmergencySiren = playAlarmingStationSiren;
