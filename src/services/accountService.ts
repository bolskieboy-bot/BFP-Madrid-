import { UserProfile, StoredAccount } from '../types';
import { saveAccountToCloud } from './firebaseSyncService';

// Constant Immutable Admin Accounts: Admin1 and Admin2 with password '1234567'
export const SEEDED_ACCOUNTS: StoredAccount[] = [
  {
    username: 'Admin1',
    password: '1234567',
    profile: {
      id: 'usr-admin-1',
      username: 'Admin1',
      fullName: 'BFP Madrid Station Commander (Admin 1)',
      phoneNumber: '0931-7218-765',
      barangay: 'Linungao (Poblacion)',
      emergencyContactName: 'BFP Madrid Municipal Fire Station',
      emergencyContactPhone: '0931-7218-765',
      medicalNotes: 'First Responder / EMT Certified',
      role: 'admin_dispatcher',
      registeredAt: '2026-09-01T08:00:00.000Z',
    },
  },
  {
    username: 'Admin2',
    password: '1234567',
    profile: {
      id: 'usr-admin-2',
      username: 'Admin2',
      fullName: 'BFP Madrid Operations Chief (Admin 2)',
      phoneNumber: '0998-552-1911',
      barangay: 'Linungao (Poblacion)',
      emergencyContactName: 'MDRRMO Madrid Operations Center',
      emergencyContactPhone: '0998-552-1911',
      medicalNotes: 'Disaster Response Coordinator',
      role: 'admin_dispatcher',
      registeredAt: '2026-09-01T08:30:00.000Z',
    },
  },
  {
    username: 'citizen_sample',
    password: 'citizen123',
    profile: {
      id: 'usr-citizen-sample',
      username: 'citizen_sample',
      fullName: 'Maria Santos (Madrid Resident)',
      phoneNumber: '0917-555-0101',
      barangay: 'Linungao (Poblacion)',
      emergencyContactName: 'Juan Santos',
      emergencyContactPhone: '0918-222-3344',
      medicalNotes: 'Standard First Aid Registered',
      role: 'citizen',
      registeredAt: '2026-09-01T08:00:00.000Z',
    },
  },
];

export const DEFAULT_CITIZEN_PROFILE: UserProfile = {
  id: 'usr-citizen-default',
  username: 'citizen_sample',
  fullName: 'Resident Citizen (Madrid)',
  phoneNumber: '0917-555-0101',
  barangay: 'Linungao (Poblacion)',
  emergencyContactName: 'Madrid Emergency Family Contact',
  emergencyContactPhone: '0918-222-3344',
  medicalNotes: 'Standard First Aid',
  role: 'citizen',
  registeredAt: '2026-09-01T08:00:00.000Z',
};

const STORAGE_KEYS = {
  REGISTERED_ACCOUNTS: 'madrid_custom_registered_accounts',
  CURRENT_USER: 'madrid_user_profile',
  CITIZEN_SESSION: 'madrid_citizen_session',
  ADMIN_SESSION: 'madrid_admin_session',
};

// Retrieve currently active citizen session
export function getCitizenSession(): UserProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CITIZEN_SESSION);
    if (!raw) return null;
    const user = JSON.parse(raw) as UserProfile;
    return user && user.role !== 'admin_dispatcher' ? user : null;
  } catch {
    return null;
  }
}

export function saveCitizenSession(user: UserProfile): void {
  localStorage.setItem(STORAGE_KEYS.CITIZEN_SESSION, JSON.stringify(user));
  localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
}

export function clearCitizenSession(): void {
  localStorage.removeItem(STORAGE_KEYS.CITIZEN_SESSION);
}

// Retrieve currently active admin dispatcher session
export function getAdminSession(): UserProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ADMIN_SESSION);
    if (!raw) return null;
    const user = JSON.parse(raw) as UserProfile;
    return user && user.role === 'admin_dispatcher' ? user : null;
  } catch {
    return null;
  }
}

export function saveAdminSession(user: UserProfile): void {
  localStorage.setItem(STORAGE_KEYS.ADMIN_SESSION, JSON.stringify(user));
}

export function clearAdminSession(): void {
  localStorage.removeItem(STORAGE_KEYS.ADMIN_SESSION);
}

// Returns custom accounts registered by citizens
export function getRegisteredCustomAccounts(): StoredAccount[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.REGISTERED_ACCOUNTS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Returns all registered accounts (constant admins + registered citizen accounts)
export function getAllAccounts(): StoredAccount[] {
  const custom = getRegisteredCustomAccounts();
  return [...SEEDED_ACCOUNTS, ...custom];
}

// Get total count of registered accounts
export function getTotalRegisteredCount(): number {
  return getAllAccounts().length;
}

export const MAX_CITIZEN_ACCOUNTS = 500;

export function getAccountCapacity(): { current: number; max: number; available: number } {
  const current = getRegisteredCustomAccounts().length;
  return {
    current,
    max: MAX_CITIZEN_ACCOUNTS,
    available: Math.max(0, MAX_CITIZEN_ACCOUNTS - current),
  };
}

// Authenticate account by username (case-insensitive) or mobile number
export function authenticateAccount(
  identifier: string,
  pass: string
): { success: boolean; user?: UserProfile; error?: string } {
  const cleanId = identifier.trim().toLowerCase();
  const cleanPhone = identifier.replace(/\D/g, '');
  const all = getAllAccounts();

  const match = all.find((acc) => {
    const userMatch = acc.username.toLowerCase() === cleanId;
    const phoneClean = acc.profile.phoneNumber.replace(/\D/g, '');
    const phoneMatch = cleanPhone.length >= 7 && (phoneClean.includes(cleanPhone) || cleanPhone.includes(phoneClean));
    return userMatch || phoneMatch;
  });

  if (!match) {
    return {
      success: false,
      error: 'Account not found. Please register first if you are a new citizen, or check your username/mobile number.',
    };
  }

  // Constant admin accounts check: Admin1 / Admin2 with password '1234567' (or fallback 'admin1pass' / 'admin2pass')
  const isMatch =
    match.password === pass ||
    (match.username === 'Admin1' && (pass === '1234567' || pass === 'admin1pass')) ||
    (match.username === 'Admin2' && (pass === '1234567' || pass === 'admin2pass'));

  if (!isMatch) {
    return {
      success: false,
      error: 'Incorrect password. Please verify your credentials and try again.',
    };
  }

  // Persist session depending on role
  if (match.profile.role === 'admin_dispatcher') {
    saveAdminSession(match.profile);
  } else {
    saveCitizenSession(match.profile);
  }

  return { success: true, user: match.profile };
}

// Register a new citizen account (No one can join without registering first)
export function registerNewCitizenAccount(data: {
  username: string;
  password: string;
  fullName: string;
  phoneNumber: string;
  barangay: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  medicalNotes?: string;
}): { success: boolean; user?: UserProfile; error?: string } {
  const cleanUsername = data.username.trim();
  if (!cleanUsername || cleanUsername.length < 3) {
    return {
      success: false,
      error: 'Username must be at least 3 characters long.',
    };
  }

  // Strictly reserve admin usernames so nobody can hijack admin slots
  const reservedUsernames = ['admin', 'admin1', 'admin2', 'administrator', 'bfpadmin', 'dispatcher', 'commander'];
  if (reservedUsernames.includes(cleanUsername.toLowerCase())) {
    return {
      success: false,
      error: 'This username is reserved for municipal administration.',
    };
  }

  if (!data.password || data.password.length < 3) {
    return {
      success: false,
      error: 'Password must be at least 3 characters long.',
    };
  }

  if (!data.fullName.trim()) {
    return {
      success: false,
      error: 'Full name is required.',
    };
  }

  if (!data.phoneNumber.trim() || data.phoneNumber.replace(/\D/g, '').length < 10) {
    return {
      success: false,
      error: 'Please enter a valid 11-digit Philippine mobile phone number.',
    };
  }

  // Check 500 account registration capacity
  const currentCustom = getRegisteredCustomAccounts();
  if (currentCustom.length >= MAX_CITIZEN_ACCOUNTS) {
    return {
      success: false,
      error: `Registration capacity reached (${MAX_CITIZEN_ACCOUNTS} accounts maximum). Please contact Madrid Municipal Fire Station.`,
    };
  }

  // Check uniqueness of username or phone number
  const all = getAllAccounts();
  const duplicate = all.find(
    (acc) =>
      acc.username.toLowerCase() === cleanUsername.toLowerCase() ||
      acc.profile.phoneNumber.replace(/\D/g, '') === data.phoneNumber.replace(/\D/g, '')
  );

  if (duplicate) {
    return {
      success: false,
      error: 'Username or phone number is already registered. Please log in with your password.',
    };
  }

  const newUserProfile: UserProfile = {
    id: 'usr-' + Date.now(),
    username: cleanUsername,
    fullName: data.fullName.trim(),
    phoneNumber: data.phoneNumber.trim(),
    barangay: data.barangay || 'Linungao (Poblacion)',
    emergencyContactName: data.emergencyContactName?.trim() || 'Family / Relative',
    emergencyContactPhone: data.emergencyContactPhone?.trim() || '0917-819-2371',
    medicalNotes: data.medicalNotes?.trim() || '',
    role: 'citizen',
    registeredAt: new Date().toISOString(),
  };

  const newAccount: StoredAccount = {
    username: cleanUsername,
    password: data.password,
    profile: newUserProfile,
  };

  currentCustom.push(newAccount);
  localStorage.setItem(STORAGE_KEYS.REGISTERED_ACCOUNTS, JSON.stringify(currentCustom));

  // Sync registered citizen account to Firestore so it is available across all phones
  try {
    saveAccountToCloud(newAccount).catch((err) =>
      console.warn('[Accounts] Cloud sync deferred:', err)
    );
  } catch (err) {
    console.warn('[Accounts] Cloud sync error:', err);
  }

  // Auto sign-in to new registered account
  localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(newUserProfile));
  saveCitizenSession(newUserProfile);

  return {
    success: true,
    user: newUserProfile,
  };
}

// Merge accounts retrieved from Firestore into local cache
export function mergeCloudAccounts(cloudAccounts: StoredAccount[]): void {
  if (!cloudAccounts || cloudAccounts.length === 0) return;
  const current = getRegisteredCustomAccounts();
  let changed = false;

  cloudAccounts.forEach((cAcc) => {
    // Skip seeded constant admin accounts
    if (cAcc.username === 'Admin1' || cAcc.username === 'Admin2') return;

    const exists = current.find(
      (a) => a.username.toLowerCase() === cAcc.username.toLowerCase()
    );
    if (!exists) {
      current.push(cAcc);
      changed = true;
    }
  });

  if (changed) {
    localStorage.setItem(STORAGE_KEYS.REGISTERED_ACCOUNTS, JSON.stringify(current));
  }
}

export function logoutCurrentUser(): void {
  localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  clearCitizenSession();
  clearAdminSession();
}

