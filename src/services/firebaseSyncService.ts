import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  collection,
  setDoc,
  updateDoc,
  getDocs,
  getDocFromServer,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { IncidentReport, ResponderUnit, StoredAccount, UserProfile } from '../types';

// Initialize Firebase App & Firestore
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Error Handling conforming to Firebase Skill guidelines
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((p) => ({
        providerId: p.providerId,
        email: p.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connection test on boot (Critical Constraint from SKILL.md)
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'system_health', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('[Firebase] Client is offline or Firestore is temporarily unreachable.');
      return false;
    }
    // Permissions or non-existent document errors still indicate successful connectivity to Firestore
    return true;
  }
}

// Compact photo utility to ensure payloads fit comfortably within Firestore document limits (< 1MB)
function sanitizeReportForFirestore(report: IncidentReport): any {
  // If report has photos with long dataUrls, ensure they are kept under 300KB
  const safePhotos = (report.photos || []).map((p) => {
    let url = p.dataUrl || '';
    if (url.startsWith('data:') && url.length > 350000) {
      // Replace with optimized placeholder or compress
      url = 'https://images.unsplash.com/photo-1542385151-efd9000785a0?auto=format&fit=crop&w=600&q=80';
    }
    return {
      id: p.id || 'p-' + Date.now(),
      dataUrl: url,
      timestamp: p.timestamp || new Date().toISOString(),
      caption: p.caption || '',
      aiSceneAssessment: p.aiSceneAssessment || '',
    };
  });

  return {
    ...report,
    photos: safePhotos,
    updatedAt: report.updatedAt || new Date().toISOString(),
  };
}

// ==========================================
// INCIDENT REPORTS SYNCHRONIZATION OVER INTERNET
// ==========================================

const INCIDENTS_PATH = 'incident_reports';

/**
 * Real-time listener for incident reports across all phones in Madrid
 */
export function subscribeToCloudIncidentReports(
  onReportsUpdate: (reports: IncidentReport[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const collectionRef = collection(db, INCIDENTS_PATH);

  return onSnapshot(
    collectionRef,
    (snapshot) => {
      const cloudReports: IncidentReport[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as IncidentReport;
        if (data && data.id && data.incidentNumber) {
          cloudReports.push(data);
        }
      });

      // Sort newest first
      cloudReports.sort((a, b) => {
        const timeA = new Date(a.createdAt).getTime() || 0;
        const timeB = new Date(b.createdAt).getTime() || 0;
        return timeB - timeA;
      });

      onReportsUpdate(cloudReports);
    },
    (error) => {
      console.error('[Firebase] Incident subscription error:', error);
      if (onError) onError(error);
      try {
        handleFirestoreError(error, OperationType.GET, INCIDENTS_PATH);
      } catch {
        // Handled
      }
    }
  );
}

/**
 * Save newly reported incident to Firestore so Admin phones alarm in real time
 */
export async function saveIncidentReportToCloud(report: IncidentReport): Promise<void> {
  const sanitized = sanitizeReportForFirestore(report);
  const docRef = doc(db, INCIDENTS_PATH, sanitized.id);
  try {
    await setDoc(docRef, sanitized);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${INCIDENTS_PATH}/${sanitized.id}`);
  }
}

/**
 * Update incident status or unit assignment in Firestore so Citizen phones see live status
 */
export async function updateIncidentReportInCloud(
  reportId: string,
  updates: Partial<IncidentReport>
): Promise<void> {
  const docRef = doc(db, INCIDENTS_PATH, reportId);
  try {
    await updateDoc(docRef, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${INCIDENTS_PATH}/${reportId}`);
  }
}

// ==========================================
// RESPONDER UNITS SYNCHRONIZATION OVER INTERNET
// ==========================================

const UNITS_PATH = 'responder_units';

export function subscribeToCloudResponderUnits(
  onUnitsUpdate: (units: ResponderUnit[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const collectionRef = collection(db, UNITS_PATH);

  return onSnapshot(
    collectionRef,
    (snapshot) => {
      if (snapshot.empty) return;
      const units: ResponderUnit[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as ResponderUnit;
        if (data && data.id && data.callSign) {
          units.push(data);
        }
      });
      if (units.length > 0) {
        onUnitsUpdate(units);
      }
    },
    (error) => {
      console.error('[Firebase] Units subscription error:', error);
      if (onError) onError(error);
    }
  );
}

export async function saveResponderUnitToCloud(unit: ResponderUnit): Promise<void> {
  const docRef = doc(db, UNITS_PATH, unit.id);
  try {
    await setDoc(docRef, unit);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${UNITS_PATH}/${unit.id}`);
  }
}

export async function updateResponderUnitInCloud(
  unitId: string,
  updates: Partial<ResponderUnit>
): Promise<void> {
  const docRef = doc(db, UNITS_PATH, unitId);
  try {
    await updateDoc(docRef, updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${UNITS_PATH}/${unitId}`);
  }
}

// ==========================================
// CITIZEN ACCOUNTS DIRECTORY SYNCHRONIZATION
// ==========================================

const ACCOUNTS_PATH = 'accounts';

export function subscribeToCloudAccounts(
  onAccountsUpdate: (accounts: StoredAccount[]) => void
): Unsubscribe {
  const collectionRef = collection(db, ACCOUNTS_PATH);

  return onSnapshot(
    collectionRef,
    (snapshot) => {
      const accounts: StoredAccount[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as StoredAccount;
        if (data && data.username && data.profile) {
          accounts.push(data);
        }
      });
      onAccountsUpdate(accounts);
    },
    (error) => {
      console.warn('[Firebase] Accounts subscription warning:', error);
    }
  );
}

export async function saveAccountToCloud(account: StoredAccount): Promise<void> {
  const docRef = doc(db, ACCOUNTS_PATH, account.username);
  try {
    await setDoc(docRef, account);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${ACCOUNTS_PATH}/${account.username}`);
  }
}

export async function fetchAllCloudAccounts(): Promise<StoredAccount[]> {
  try {
    const snapshot = await getDocs(collection(db, ACCOUNTS_PATH));
    const list: StoredAccount[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as StoredAccount;
      if (data && data.username) {
        list.push(data);
      }
    });
    return list;
  } catch (error) {
    console.warn('[Firebase] Failed to fetch accounts from cloud:', error);
    return [];
  }
}
