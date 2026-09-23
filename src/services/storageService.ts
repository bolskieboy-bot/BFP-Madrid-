import { IncidentReport, UserProfile, PushNotificationItem, ResponderUnit, AppDetailsConfig } from '../types';
import { INITIAL_RESPONDER_UNITS } from '../constants/madridLocations';
import { getTotalRegisteredCount } from './accountService';

const STORAGE_KEYS = {
  USER_PROFILE: 'madrid_user_profile',
  REPORTS: 'madrid_incident_reports',
  OFFLINE_QUEUE: 'madrid_offline_reports_queue',
  NOTIFICATIONS: 'madrid_push_notifications',
  RESPONDER_UNITS: 'madrid_responder_units',
  BETA_USER_COUNT: 'madrid_beta_user_count',
  THEME_MODE: 'madrid_theme_mode',
  APP_DETAILS: 'madrid_app_details_config',
  PENDING_DISTURBING_ALARM: 'bfp_madrid_pending_disturbing_alarm',
};

// Initial realistic Madrid, Surigao del Sur incident sample
const SEED_REPORTS: IncidentReport[] = [
  {
    id: 'mdr-rep-001',
    incidentNumber: 'MDR-2026-0814',
    category: 'fire',
    subcategory: 'Residential Structure Fire',
    severity: 'high',
    title: 'Kitchen Fire spreading to roof',
    description: 'LPG gas tank leakage ignited ceiling near public market area. Neighboring houses are closely built wood.',
    location: {
      latitude: 9.2632,
      longitude: 125.9612,
      barangay: 'Linungao (Poblacion)',
      landmark: 'Behind Madrid Public Market, Purok 3',
      accuracyMeters: 8,
    },
    reporterName: 'Danilo Alcantara',
    reporterPhone: '0917-542-8891',
    photos: [
      {
        id: 'p1',
        dataUrl: 'https://images.unsplash.com/photo-1542385151-efd9000785a0?auto=format&fit=crop&w=600&q=80',
        timestamp: '19:15:20',
        caption: 'Smoke coming from residential roof',
        aiSceneAssessment: 'Dense grey smoke visible from roof eaves. Flammable light materials suspected.',
      },
    ],
    status: 'en_route',
    statusHistory: [
      {
        status: 'reported',
        timestamp: '19:14:02',
        note: 'Emergency distress received via Madrid Notifier App',
        updatedBy: 'System / Dispatch Gate',
      },
      {
        status: 'acknowledged',
        timestamp: '19:14:40',
        note: 'Verified with BFP Madrid Duty Desk Officer FO1 C. Morales',
        updatedBy: 'BFP Madrid Dispatch',
      },
      {
        status: 'dispatched',
        timestamp: '19:15:30',
        note: 'Engine 01 Rosenbauer rolling out from station',
        updatedBy: 'BFP Station Commander',
      },
      {
        status: 'en_route',
        timestamp: '19:16:10',
        note: 'Vehicle is 0.8 km away on National Highway, sirens active',
        updatedBy: 'FO2 Rommel Plaza (Driver)',
      },
    ],
    assignedUnitId: 'unit-bfp-01',
    assignedUnitName: 'BFP Engine 01 (Rosenbauer Pumper)',
    responderDistanceKm: 0.8,
    responderEtaMinutes: 2,
    e2eeHash: '4F89BC1A90E2',
    isEncrypted: true,
    smsSent: true,
    smsRecipient: '09178192371',
    createdAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    aiTriage: {
      alarmLevel: '1st Alarm Fire (BFP Madrid)',
      equipmentSuggested: ['Rosenbauer Pumper Engine 01', '1.5" Attack Hose', 'SCBA Breathing Team'],
      civilianSafetyAdvice: 'Keep neighborhood crowd back. Do not attempt to use household garden hose on electrical lines.',
      dispatchPriority: 'Critical - Immediate',
    },
  },
  {
    id: 'mdr-rep-002',
    incidentNumber: 'MDR-2026-0815',
    category: 'vehicular',
    subcategory: 'Motorcycle Highway Collision',
    severity: 'high',
    title: 'Two motorcycles collided at curved road',
    description: 'Two motorbikes collided at the blind curve going north to Cantilan. Two drivers thrown to road shoulder, conscious but bleeding from knee and arm.',
    location: {
      latitude: 9.2745,
      longitude: 125.9542,
      barangay: 'Songkit',
      landmark: 'Near Songkit Elementary School waiting shed',
      accuracyMeters: 12,
    },
    reporterName: 'Marites Cabarrubias',
    reporterPhone: '0929-331-4820',
    photos: [],
    status: 'dispatched',
    statusHistory: [
      {
        status: 'reported',
        timestamp: '19:22:15',
        note: 'Distress call registered by citizen',
        updatedBy: 'App User',
      },
      {
        status: 'dispatched',
        timestamp: '19:24:00',
        note: 'MDRRMO Alpha Rescue Ambulance deployed with 2 EMTs',
        updatedBy: 'MDRRMO Dispatcher',
      },
    ],
    assignedUnitId: 'unit-rescue-01',
    assignedUnitName: 'MDRRMO Alpha Rescue Ambulance',
    responderDistanceKm: 1.6,
    responderEtaMinutes: 3,
    e2eeHash: '9D4A18E6627C',
    isEncrypted: true,
    smsSent: true,
    smsRecipient: '09985521911',
    createdAt: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 9 * 60 * 1000).toISOString(),
    aiTriage: {
      alarmLevel: 'Code Red - Vehicular Collision',
      equipmentSuggested: ['Spine Board', 'C-Collar', 'Trauma Bleed Dressing', 'Ambulance Unit'],
      civilianSafetyAdvice: 'Direct oncoming traffic around victims. Keep victims warm and resting flat on ground.',
      dispatchPriority: 'Urgent',
    },
  },
];

// Helper to strip or compress photos for older reports when localStorage quota is tight
function cleanReportPhotosForStorage(report: IncidentReport, retainPhoto = true): IncidentReport {
  if (!report.photos || report.photos.length === 0) return report;
  if (retainPhoto) {
    return report;
  }
  // For older historical reports, replace heavy base64 data URLs with a lightweight placeholder
  const compactPhotos = report.photos.map((p) => {
    if (p.dataUrl && p.dataUrl.startsWith('data:image') && p.dataUrl.length > 30000) {
      return {
        ...p,
        dataUrl: 'https://images.unsplash.com/photo-1542385151-efd9000785a0?auto=format&fit=crop&w=400&q=70',
      };
    }
    return p;
  });
  return {
    ...report,
    photos: compactPhotos,
  };
}

// Resilient save reports to localStorage that prevents QuotaExceededError
export function saveReportsToStorage(reports: IncidentReport[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.REPORTS, JSON.stringify(reports));
  } catch (quotaError) {
    console.warn('[Storage] Quota exceeded on madrid_incident_reports. Compacting storage...', quotaError);

    // Tier 1: Keep photos only for the 5 most recent reports
    try {
      const compactedTier1 = reports.map((rep, idx) => cleanReportPhotosForStorage(rep, idx < 5));
      localStorage.setItem(STORAGE_KEYS.REPORTS, JSON.stringify(compactedTier1));
      return;
    } catch {
      // Continue to Tier 2
    }

    // Tier 2: Limit to the most recent 25 reports and keep only top 2 photos
    try {
      const compactedTier2 = reports.slice(0, 25).map((rep, idx) => cleanReportPhotosForStorage(rep, idx < 2));
      localStorage.setItem(STORAGE_KEYS.REPORTS, JSON.stringify(compactedTier2));
      return;
    } catch {
      // Continue to Tier 3
    }

    // Tier 3: Emergency fallback - keep latest 15 reports with all heavy photos replaced
    try {
      const compactedTier3 = reports.slice(0, 15).map((rep) => cleanReportPhotosForStorage(rep, false));
      localStorage.setItem(STORAGE_KEYS.REPORTS, JSON.stringify(compactedTier3));
    } catch (finalError) {
      console.error('[Storage] Critical: Unable to save reports to localStorage after compaction', finalError);
    }
  }
}

export function getStoredReports(): IncidentReport[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.REPORTS);
    if (!raw) {
      saveReportsToStorage(SEED_REPORTS);
      return SEED_REPORTS;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return SEED_REPORTS;

    // Check if storage has bloated base64 strings (> 150KB) and compact proactively
    let hasOverlargePhotos = false;
    for (const r of parsed) {
      if (r.photos?.some((p: any) => p?.dataUrl && p.dataUrl.length > 120000)) {
        hasOverlargePhotos = true;
        break;
      }
    }
    if (hasOverlargePhotos) {
      saveReportsToStorage(parsed);
    }

    return parsed;
  } catch {
    return SEED_REPORTS;
  }
}

export function saveReport(report: IncidentReport): void {
  const reports = getStoredReports();
  const index = reports.findIndex(r => r.id === report.id);
  if (index >= 0) {
    reports[index] = report;
  } else {
    reports.unshift(report);
  }
  saveReportsToStorage(reports);
}

export function getOfflineQueue(): IncidentReport[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function queueOfflineReport(report: IncidentReport): void {
  const queue = getOfflineQueue();
  queue.push({ ...report, isOfflineQueued: true });
  try {
    localStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(queue));
  } catch {
    try {
      const compactedQueue = queue.slice(-5).map((r) => cleanReportPhotosForStorage(r, false));
      localStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(compactedQueue));
    } catch {
      // Ignore queue error if quota is totally exhausted
    }
  }
}

export function clearOfflineQueue(): IncidentReport[] {
  const queue = getOfflineQueue();
  try {
    localStorage.removeItem(STORAGE_KEYS.OFFLINE_QUEUE);
  } catch {
    // Ignore
  }
  return queue;
}

export function getStoredUserProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveUserProfile(user: UserProfile): void {
  localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(user));
}

export function clearUserProfile(): void {
  localStorage.removeItem(STORAGE_KEYS.USER_PROFILE);
}

// 300 user capacity limit for beta launch
export function getBetaUserCount(): number {
  return getTotalRegisteredCount();
}

export function incrementBetaUserCount(): number {
  return getTotalRegisteredCount();
}

export function getStoredResponderUnits(): ResponderUnit[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.RESPONDER_UNITS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.RESPONDER_UNITS, JSON.stringify(INITIAL_RESPONDER_UNITS));
      return INITIAL_RESPONDER_UNITS;
    }
    const parsed: ResponderUnit[] = JSON.parse(raw);
    // Ensure newly added initial units (like BFP EMS Ambulance) are present and BFP number is updated
    const existingIds = new Set(parsed.map((u) => u.id));
    const merged = parsed.map((u) => {
      if (u.id === 'unit-bfp-01' || u.id === 'unit-bfp-amb-01') {
        return { ...u, contactNumber: '0931-7218-765' };
      }
      return u;
    });
    for (const initUnit of INITIAL_RESPONDER_UNITS) {
      if (!existingIds.has(initUnit.id)) {
        merged.push(initUnit);
      }
    }
    return merged;
  } catch {
    return INITIAL_RESPONDER_UNITS;
  }
}

export function saveResponderUnits(units: ResponderUnit[]): void {
  localStorage.setItem(STORAGE_KEYS.RESPONDER_UNITS, JSON.stringify(units));
}

export function getStoredNotifications(): PushNotificationItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
    return raw ? JSON.parse(raw) : [
      {
        id: 'notif-1',
        incidentId: 'mdr-rep-001',
        title: 'BFP Engine 01 En Route',
        body: 'Fire response unit dispatched to Purok 3, Brgy. Linungao. ETA 2 minutes.',
        type: 'dispatch',
        timestamp: '19:16',
        read: false,
      },
      {
        id: 'notif-2',
        incidentId: 'mdr-rep-002',
        title: 'MDRRMO Ambulance Dispatched',
        body: 'Rescue Alpha unit responding to vehicular incident in Brgy. Songkit.',
        type: 'dispatch',
        timestamp: '19:24',
        read: false,
      },
    ];
  } catch {
    return [];
  }
}

export function saveNotifications(notifications: PushNotificationItem[]): void {
  localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifications));
}

export function addNotification(item: Omit<PushNotificationItem, 'id' | 'read' | 'timestamp'>): PushNotificationItem {
  const list = getStoredNotifications();
  const newItem: PushNotificationItem = {
    ...item,
    id: 'notif-' + Date.now(),
    read: false,
    timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
  };
  list.unshift(newItem);
  saveNotifications(list.slice(0, 30));
  return newItem;
}

export const DEFAULT_APP_DETAILS: AppDetailsConfig = {
  appName: 'BFP MADRID EMERGENCY NOTIFIER',
  stationName: 'Madrid Municipal Fire Station',
  stationCommander: 'SFO4 Roberto S. Alcantara (Station Commander)',
  operationsChief: 'FO3 Maria Elena V. Morales (Operations Chief)',
  stationAddress: 'National Highway, Brgy. Linungao (Poblacion), Madrid, Surigao del Sur',
  bfpHotline: '0931-7218-765',
  mdrmoHotline: '0998-552-1911',
  pnpHotline: '0998-598-7341',
  rhuAmbulanceHotline: '0917-819-2371',
  publicAdvisory: 'BFP Madrid High Alert: Prompt reporting saves lives and property. Ensure clearance near electrical posts and hydrant points.',
  emergencySirenEnabled: true,
  disturbingAlarmEnabled: true,
  builtBy: 'FO1 Evangelio',
  buildDate: 'September 23, 2026',
  appVersion: 'v2.4.0 (Madrid Municipal BFP Dispatch Standard)',
  lastUpdatedBy: 'Admin1',
  lastUpdatedAt: new Date().toISOString(),
};

export function getAppDetailsConfig(): AppDetailsConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.APP_DETAILS);
    if (!raw) return DEFAULT_APP_DETAILS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_APP_DETAILS,
      ...parsed,
      builtBy: parsed.builtBy || DEFAULT_APP_DETAILS.builtBy,
      buildDate: parsed.buildDate || DEFAULT_APP_DETAILS.buildDate,
      appVersion: parsed.appVersion || DEFAULT_APP_DETAILS.appVersion,
    };
  } catch {
    return DEFAULT_APP_DETAILS;
  }
}

export function saveAppDetailsConfig(updates: Partial<AppDetailsConfig>, adminUser: string): AppDetailsConfig {
  const current = getAppDetailsConfig();
  const updated: AppDetailsConfig = {
    ...current,
    ...updates,
    lastUpdatedBy: adminUser,
    lastUpdatedAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEYS.APP_DETAILS, JSON.stringify(updated));

  try {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const channel = new BroadcastChannel('bfp_madrid_emergency_channel');
      channel.postMessage({ type: 'APP_DETAILS_UPDATED', config: updated });
    }
  } catch {
    // Ignore
  }

  return updated;
}

export interface PendingDisturbingAlarm {
  id: string;
  incidentNumber: string;
  location: string;
  timestamp: number;
  acknowledged: boolean;
}

export function setPendingDisturbingAlarm(details: { id: string; incidentNumber: string; location: string }): void {
  try {
    const data: PendingDisturbingAlarm = {
      ...details,
      timestamp: Date.now(),
      acknowledged: false,
    };
    localStorage.setItem(STORAGE_KEYS.PENDING_DISTURBING_ALARM, JSON.stringify(data));
  } catch {
    // Ignore
  }
}

export function getPendingDisturbingAlarm(): PendingDisturbingAlarm | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PENDING_DISTURBING_ALARM);
    if (!raw) return null;
    const parsed: PendingDisturbingAlarm = JSON.parse(raw);
    // Ignore if older than 4 hours
    if (Date.now() - parsed.timestamp > 4 * 60 * 60 * 1000) {
      clearPendingDisturbingAlarm();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingDisturbingAlarm(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.PENDING_DISTURBING_ALARM);
  } catch {
    // Ignore
  }
}

