export type IncidentCategory = 'unidentified' | 'fire' | 'vehicular' | 'medical' | 'rescue' | 'other';

export type IncidentSeverity = 'low' | 'moderate' | 'high' | 'critical';

export type IncidentStatus = 
  | 'reported'        // Pending dispatcher review
  | 'acknowledged'    // BFP / MDRRMO seen report
  | 'dispatched'      // Emergency vehicle rolled out
  | 'en_route'        // Vehicle traveling on road
  | 'on_scene'        // Responders actively managing incident
  | 'under_control'   // Fire controlled / patients stabilized
  | 'resolved';       // Scene cleared and closed

export interface IncidentLocation {
  latitude: number;
  longitude: number;
  barangay: string;
  landmark: string;
  streetAddress?: string;
  accuracyMeters?: number;
}

export interface IncidentPhoto {
  id: string;
  dataUrl: string;
  timestamp: string;
  caption?: string;
  aiSceneAssessment?: string;
}

export interface IncidentReport {
  id: string;
  incidentNumber: string; // e.g. "MDR-2026-0814"
  category: IncidentCategory;
  subcategory: string;
  severity: IncidentSeverity;
  title: string;
  description: string;
  location: IncidentLocation;
  reporterName: string;
  reporterPhone: string;
  photos: IncidentPhoto[];
  status: IncidentStatus;
  statusHistory: {
    status: IncidentStatus;
    timestamp: string;
    note: string;
    updatedBy: string;
  }[];
  assignedUnitId?: string;
  assignedUnitName?: string;
  responderDistanceKm?: number;
  responderEtaMinutes?: number;
  isIdentified?: boolean;
  identifiedBy?: string;
  identifiedAt?: string;
  e2eeHash: string;
  isEncrypted: boolean;
  isOfflineQueued?: boolean;
  smsSent: boolean;
  smsRecipient?: string;
  createdAt: string;
  updatedAt: string;
  aiTriage?: {
    alarmLevel: string;
    equipmentSuggested: string[];
    civilianSafetyAdvice: string;
    dispatchPriority: string;
  };
}

export interface UserProfile {
  id: string;
  username?: string;
  phoneNumber: string; // PH format: 09XXXXXXXXX or +639XXXXXXXXX
  fullName: string;
  barangay: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  medicalNotes?: string;
  role: 'citizen' | 'admin_dispatcher';
  registeredAt: string;
}

export interface StoredAccount {
  username: string;
  password: string;
  profile: UserProfile;
}

export interface ResponderUnit {
  id: string;
  name: string;
  callSign: string;
  type: 'fire_engine' | 'ambulance' | 'patrol';
  stationName: string;
  currentLat: number;
  currentLng: number;
  status: 'available' | 'dispatched' | 'on_scene' | 'maintenance';
  driverName: string;
  contactNumber: string;
}

export interface PushNotificationItem {
  id: string;
  incidentId: string;
  title: string;
  body: string;
  type: 'status_change' | 'dispatch' | 'arrival' | 'resolved' | 'system';
  timestamp: string;
  read: boolean;
}

export interface AppDetailsConfig {
  appName: string;
  stationName: string;
  stationCommander: string;
  operationsChief: string;
  stationAddress: string;
  bfpHotline: string;
  mdrmoHotline: string;
  pnpHotline: string;
  rhuAmbulanceHotline: string;
  publicAdvisory: string;
  emergencySirenEnabled: boolean;
  disturbingAlarmEnabled: boolean;
  builtBy: string;
  buildDate: string;
  appVersion: string;
  lastUpdatedBy: string;
  lastUpdatedAt: string;
}
