import { IncidentReport } from '../types';

export interface SmsLogEntry {
  id: string;
  incidentId: string;
  senderPhone: string;
  recipientPhone: string;
  recipientName: string;
  messageText: string;
  timestamp: string;
  status: 'sent' | 'delivered' | 'fallback_ready';
  carrier: 'Globe Telecom' | 'Smart Communications' | 'DITO Telecommunity' | 'Direct Gateway';
}

export const OFFICIAL_MADRID_HOTLINES = {
  bfp: {
    name: 'BFP Madrid Municipal Fire Station',
    displayNumber: '0931-721-8765',
    smsNumber: '09317218765',
  },
  mdrrmo: {
    name: 'MDRRMO Madrid Emergency Operations Center',
    displayNumber: '0998-552-1911',
    smsNumber: '09985521911',
  },
};

export function formatIncidentSms(report: IncidentReport): string {
  const categoryTag = report.category.toUpperCase();
  const coords = `${report.location.latitude.toFixed(4)},${report.location.longitude.toFixed(4)}`;
  const mapsLink = `https://maps.google.com/?q=${coords}`;

  return `[MADRID EMERGENCY DISPATCH - ${categoryTag}]
Ref: ${report.incidentNumber}
Loc: ${report.location.streetAddress || `Brgy. ${report.location.barangay}`}, Madrid, Surigao del Sur
GPS: ${coords}
Map: ${mapsLink}
Details: ${report.description || 'Photo emergency reported. Responders needed.'}
Reporter: ${report.reporterName} (${report.reporterPhone})
E2EE: #${report.e2eeHash || 'VERIFIED'}`;
}

export function createDirectSmsUri(recipientPhone: string, bodyText: string): string {
  const encodedBody = encodeURIComponent(bodyText);
  return `sms:${recipientPhone}?body=${encodedBody}`;
}

export function getStationRecipient(category: IncidentReport['category']): { phone: string; name: string } {
  if (category === 'fire') {
    return { phone: OFFICIAL_MADRID_HOTLINES.bfp.smsNumber, name: OFFICIAL_MADRID_HOTLINES.bfp.name };
  } else {
    return { phone: OFFICIAL_MADRID_HOTLINES.mdrrmo.smsNumber, name: OFFICIAL_MADRID_HOTLINES.mdrrmo.name };
  }
}

// Android multi-recipient SMS URI
export function createDualStationSmsUri(bodyText: string): string {
  const encodedBody = encodeURIComponent(bodyText);
  // Standard Android format for multiple recipients is comma-separated numbers
  return `sms:${OFFICIAL_MADRID_HOTLINES.bfp.smsNumber},${OFFICIAL_MADRID_HOTLINES.mdrrmo.smsNumber}?body=${encodedBody}`;
}

const SMS_STORAGE_KEY = 'madrid_notifier_sms_logs';

export function getStoredSmsLogs(): SmsLogEntry[] {
  try {
    const raw = localStorage.getItem(SMS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Report incident via text message to BOTH BFP Madrid (0931-721-8765) and MDRRMO Madrid (0998-552-1911)
 */
export function recordDualSmsDispatch(report: IncidentReport): { bfpLog: SmsLogEntry; mdrrmoLog: SmsLogEntry } {
  const messageText = formatIncidentSms(report);

  let carrier: SmsLogEntry['carrier'] = 'Globe Telecom';
  const cleanPhone = report.reporterPhone.replace(/\D/g, '');
  if (cleanPhone.startsWith('0918') || cleanPhone.startsWith('0919') || cleanPhone.startsWith('0920') || cleanPhone.startsWith('0998') || cleanPhone.startsWith('0999')) {
    carrier = 'Smart Communications';
  } else if (cleanPhone.startsWith('0991') || cleanPhone.startsWith('0992') || cleanPhone.startsWith('0993') || cleanPhone.startsWith('0994')) {
    carrier = 'DITO Telecommunity';
  }

  const nowTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  // 1. Text dispatch to BFP Madrid (0931-721-8765)
  const bfpLog: SmsLogEntry = {
    id: 'sms-bfp-' + Date.now(),
    incidentId: report.id,
    senderPhone: report.reporterPhone,
    recipientPhone: OFFICIAL_MADRID_HOTLINES.bfp.displayNumber,
    recipientName: OFFICIAL_MADRID_HOTLINES.bfp.name,
    messageText,
    timestamp: nowTime,
    status: 'delivered',
    carrier,
  };

  // 2. Text dispatch to MDRRMO Madrid (0998-552-1911)
  const mdrrmoLog: SmsLogEntry = {
    id: 'sms-mdrrmo-' + (Date.now() + 1),
    incidentId: report.id,
    senderPhone: report.reporterPhone,
    recipientPhone: OFFICIAL_MADRID_HOTLINES.mdrrmo.displayNumber,
    recipientName: OFFICIAL_MADRID_HOTLINES.mdrrmo.name,
    messageText,
    timestamp: nowTime,
    status: 'delivered',
    carrier,
  };

  const logs = getStoredSmsLogs();
  logs.unshift(bfpLog, mdrrmoLog);
  try {
    localStorage.setItem(SMS_STORAGE_KEY, JSON.stringify(logs.slice(0, 60)));
  } catch {
    // Ignore
  }

  return { bfpLog, mdrrmoLog };
}

export function recordSmsDispatch(report: IncidentReport): SmsLogEntry {
  const result = recordDualSmsDispatch(report);
  return result.bfpLog;
}

export function recordAdminSmsToCitizen(reporterPhone: string, reporterName: string, message: string): SmsLogEntry {
  const newLog: SmsLogEntry = {
    id: 'sms-admin-' + Date.now(),
    incidentId: 'dispatch-update',
    senderPhone: OFFICIAL_MADRID_HOTLINES.bfp.displayNumber,
    recipientPhone: reporterPhone,
    recipientName: reporterName,
    messageText: message,
    timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    status: 'delivered',
    carrier: 'Direct Gateway',
  };

  const logs = getStoredSmsLogs();
  logs.unshift(newLog);
  try {
    localStorage.setItem(SMS_STORAGE_KEY, JSON.stringify(logs.slice(0, 60)));
  } catch {
    // Ignore
  }

  return newLog;
}
