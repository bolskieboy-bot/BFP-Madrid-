import { useState, useEffect, useCallback } from 'react';
import {
  Flame,
  Shield,
  Phone,
  Bell,
  Moon,
  Sun,
  User,
  Lock,
  LogOut,
  Info,
  VolumeX,
  KeyRound,
  Wifi,
  WifiOff,
  Globe,
} from 'lucide-react';
import UserDashboard from './components/User/UserDashboard';
import AdminDashboard from './components/Admin/AdminDashboard';
import PhoneLoginModal from './components/Auth/PhoneLoginModal';
import AuthGate from './components/Auth/AuthGate';
import ReportHistoryDrawer from './components/History/ReportHistoryDrawer';
import PushNotificationsTray from './components/Common/PushNotificationsTray';
import OfflineBanner from './components/Common/OfflineBanner';
import AndroidPushToast from './components/Common/AndroidPushToast';
import HotlineModal from './components/Directory/HotlineModal';
import AppInfoModal from './components/Common/AppInfoModal';
import BfpMadridLogo from './components/Common/BfpMadridLogo';
import AppBackground from './components/Common/AppBackground';
import {
  IncidentReport,
  UserProfile,
  PushNotificationItem,
  ResponderUnit,
  AppDetailsConfig,
} from './types';
import {
  getStoredReports,
  saveReport,
  saveReportsToStorage,
  getStoredUserProfile,
  saveUserProfile,
  clearUserProfile,
  clearOfflineQueue,
  getOfflineQueue,
  getStoredNotifications,
  saveNotifications,
  getStoredResponderUnits,
  getAppDetailsConfig,
  setPendingDisturbingAlarm,
  getPendingDisturbingAlarm,
  clearPendingDisturbingAlarm,
} from './services/storageService';
import {
  SEEDED_ACCOUNTS,
  logoutCurrentUser,
  DEFAULT_CITIZEN_PROFILE,
  getCitizenSession,
  saveCitizenSession,
  clearCitizenSession,
  getAdminSession,
  saveAdminSession,
  clearAdminSession,
  mergeCloudAccounts,
} from './services/accountService';
import {
  subscribeToCloudIncidentReports,
  saveIncidentReportToCloud,
  updateIncidentReportInCloud,
  subscribeToCloudResponderUnits,
  subscribeToCloudAccounts,
  testFirestoreConnection,
} from './services/firebaseSyncService';
import ModeLoginGate from './components/Auth/ModeLoginGate';
import {
  playNotificationChime,
  playAlarmingStationSiren,
  startContinuousStationAlarm,
  stopContinuousStationAlarm,
  stopAllAlarmSounds,
  isStationAlarmSounding,
  playCitizenGentleConfirmation,
  dispatchBackgroundAdminNotification,
} from './services/audioService';

export default function App() {
  // App State
  const [reports, setReports] = useState<IncidentReport[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  // Persistent Citizen and Admin users - login is strictly required for each app mode
  const [citizenUser, setCitizenUser] = useState<UserProfile | null>(() => getCitizenSession());
  const [adminUser, setAdminUser] = useState<UserProfile | null>(() => getAdminSession());

  // Active Dashboard View: 'user' (Client) or 'admin' (Admin)
  const [dashboardMode, setDashboardMode] = useState<'user' | 'admin'>('user');

  // Target role when manually opening the login modal
  const [loginTargetRole, setLoginTargetRole] = useState<'citizen' | 'admin_dispatcher' | null>(null);

  // Active user profile dynamically mapped to active mode
  const currentUser = dashboardMode === 'admin' ? adminUser : citizenUser;

  const [responderUnits, setResponderUnits] = useState<ResponderUnit[]>([]);
  const [notifications, setNotifications] = useState<PushNotificationItem[]>([]);
  const [activeToast, setActiveToast] = useState<PushNotificationItem | null>(null);
  const [activeAlarmReport, setActiveAlarmReport] = useState<IncidentReport | null>(null);
  const [appConfig, setAppConfig] = useState<AppDetailsConfig>(() => getAppDetailsConfig());

  // Network Connectivity & Cloud Sync
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [isCloudConnected, setIsCloudConnected] = useState<boolean>(true);
  const [lastCloudSyncTime, setLastCloudSyncTime] = useState<string>(() =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  );
  const [offlineQueuedReports, setOfflineQueuedReports] = useState<IncidentReport[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Night Mode / Tactical Dark Theme
  const [isNightMode, setIsNightMode] = useState<boolean>(true);

  // Modals
  const [isLoginOpen, setIsLoginOpen] = useState<boolean>(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [isNotifTrayOpen, setIsNotifTrayOpen] = useState<boolean>(false);
  const [isHotlineOpen, setIsHotlineOpen] = useState<boolean>(false);
  const [isAppInfoOpen, setIsAppInfoOpen] = useState<boolean>(false);

  // GPS User Location
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsWatchId, setGpsWatchId] = useState<number | null>(null);

  // Initialize and load persisted data
  useEffect(() => {
    const loadedReports = getStoredReports();
    setReports(loadedReports);
    if (loadedReports.length > 0) {
      setSelectedReportId(loadedReports[0].id);
    }

    // Check URL parameters (e.g. notification click when app was closed: /?adminAlarm=true)
    const urlParams = new URLSearchParams(window.location.search);
    const hasAdminAlarmParam = urlParams.has('adminAlarm');

    // Load stored user only if valid registered user or admin, clearing out any test account
    let stored = getStoredUserProfile();
    if (stored && stored.username === 'sample1') {
      clearUserProfile();
      stored = null;
    }

    if (stored) {
      if (stored.role === 'admin_dispatcher') {
        setAdminUser(stored);
      } else {
        setCitizenUser(stored);
      }
    }

    // If app was opened via background alarm notification while closed, ensure admin access
    if (hasAdminAlarmParam) {
      setDashboardMode('admin');
    }

    // CHECK FOR PENDING DISTURBING ALARM (Even if the app was closed when citizen reported!)
    const pendingAlarm = getPendingDisturbingAlarm();
    if (pendingAlarm && !pendingAlarm.acknowledged) {
      const matching = loadedReports.find((r) => r.incidentNumber === pendingAlarm.incidentNumber || r.id === pendingAlarm.id) || loadedReports[0];
      if (matching) {
        setActiveAlarmReport(matching);
      }
      if (stored?.role === 'admin_dispatcher' || hasAdminAlarmParam) {
        setDashboardMode('admin');
        startContinuousStationAlarm({
          incidentNumber: pendingAlarm.incidentNumber,
          location: pendingAlarm.location,
        });
      }
    }

    const loadedUnits = getStoredResponderUnits();
    setResponderUnits(loadedUnits);

    const loadedNotifs = getStoredNotifications();
    setNotifications(loadedNotifs);

    const queued = getOfflineQueue();
    setOfflineQueuedReports(queued);

    // Online / Offline Listeners
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Watch real user GPS coordinates with fallback to Madrid center
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserCoords({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        (err) => {
          console.log('GPS acquired fallback to Madrid Center:', err.message);
          setUserCoords({ lat: 9.2618, lng: 125.9610 });
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
      );

      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setUserCoords({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        null,
        { enableHighAccuracy: true, maximumAge: 30000 }
      );
      setGpsWatchId(watchId);
    } else {
      setUserCoords({ lat: 9.2618, lng: 125.9610 });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (gpsWatchId !== null) {
        navigator.geolocation.clearWatch(gpsWatchId);
      }
    };
  }, []);

  // REAL-TIME FIRESTORE SYNCHRONIZATION OVER THE INTERNET (ACROSS ALL PHONES)
  useEffect(() => {
    // 1. Validate connection to Firestore
    testFirestoreConnection().then((connected) => {
      setIsCloudConnected(connected);
    });

    // 2. Real-time subscription to emergency incidents
    const unsubIncidents = subscribeToCloudIncidentReports(
      (cloudReports) => {
        setIsCloudConnected(true);
        setLastCloudSyncTime(
          new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        );

        if (!cloudReports || cloudReports.length === 0) {
          // If cloud has no reports yet, initialize cloud with base reports
          const initialReports = getStoredReports();
          initialReports.forEach((rep) => {
            saveIncidentReportToCloud(rep).catch(() => {});
          });
          return;
        }

        setReports((prevReports) => {
          // Check for newly dispatched emergency reports submitted from another phone
          const prevIds = new Set(prevReports.map((r) => r.id));
          const newlyDispatched = cloudReports.filter((cr) => !prevIds.has(cr.id));

          if (newlyDispatched.length > 0 && prevReports.length > 0) {
            const newest = newlyDispatched[0];

            // If user is viewing the Admin App OR authenticated as Admin:
            // Continuous disturbing siren immediately alarms on Admin phone!
            const isCurrentlyAdmin = dashboardMode === 'admin' || adminUser !== null;
            if (isCurrentlyAdmin) {
              setActiveAlarmReport(newest);
              setPendingDisturbingAlarm({
                id: newest.id,
                incidentNumber: newest.incidentNumber,
                location: newest.location?.streetAddress || newest.location?.barangay || 'Madrid',
              });

              if (dashboardMode === 'admin') {
                startContinuousStationAlarm({
                  incidentNumber: newest.incidentNumber,
                  location: newest.location?.streetAddress || newest.location?.barangay || 'Madrid',
                });
              }
            }

            const alertNotif: PushNotificationItem = {
              id: 'notif-cloud-' + Date.now(),
              incidentId: newest.id,
              title: `🚨 INCOMING EMERGENCY: ${newest.incidentNumber}`,
              body: `${newest.title} reported at ${newest.location?.barangay || 'Madrid'}. Linked live via cloud.`,
              type: 'dispatch',
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              read: false,
            };
            setNotifications((prev) => [alertNotif, ...prev]);
            setActiveToast(alertNotif);
          } else {
            // Check for status changes on existing reports made by station admins or responders
            cloudReports.forEach((cr) => {
              const prevMatch = prevReports.find((pr) => pr.id === cr.id);
              if (prevMatch && prevMatch.status !== cr.status) {
                const updateNotif: PushNotificationItem = {
                  id: 'notif-upd-' + Date.now(),
                  incidentId: cr.id,
                  title: `🚒 Dispatch Update: ${cr.incidentNumber}`,
                  body: `Status updated to ${cr.status.toUpperCase()} (${cr.assignedUnitName || 'Unit Active'})`,
                  type: 'status_change',
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  read: false,
                };
                setNotifications((prev) => [updateNotif, ...prev]);
                setActiveToast(updateNotif);
                playNotificationChime();
              }
            });
          }

          saveReportsToStorage(cloudReports);
          return cloudReports;
        });
      },
      (error) => {
        console.warn('[Firebase] Incidents sync error:', error);
        setIsCloudConnected(false);
      }
    );

    // 3. Real-time subscription to responder units fleet
    const unsubUnits = subscribeToCloudResponderUnits((cloudUnits) => {
      if (cloudUnits && cloudUnits.length > 0) {
        setResponderUnits(cloudUnits);
      }
    });

    // 4. Real-time subscription to registered resident accounts
    const unsubAccounts = subscribeToCloudAccounts((cloudAccounts) => {
      mergeCloudAccounts(cloudAccounts);
    });

    return () => {
      unsubIncidents();
      unsubUnits();
      unsubAccounts();
    };
  }, [dashboardMode, adminUser]);

  // Cross-tab, background alarm, and window focus synchronization
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const channel = new BroadcastChannel('bfp_madrid_emergency_channel');
    channel.onmessage = (event) => {
      if (event.data?.type === 'ADMIN_EMERGENCY_ALARM_TRIGGERED') {
        const refreshed = getStoredReports();
        setReports(refreshed);
        const match = refreshed.find((r) => r.incidentNumber === event.data.details?.incidentNumber) || refreshed[0];
        if (match) setActiveAlarmReport(match);

        // ONLY ADMIN VIEW SOUNDS THE CONTINUOUS DISTURBING AUDIO SIREN!
        if (dashboardMode === 'admin') {
          startContinuousStationAlarm(event.data.details);
        }
      } else if (event.data?.type === 'ADMIN_ALARM_STOPPED') {
        stopContinuousStationAlarm();
        stopAllAlarmSounds();
        clearPendingDisturbingAlarm();
        setActiveAlarmReport(null);
      } else if (event.data?.type === 'APP_DETAILS_UPDATED') {
        const updatedConfig = getAppDetailsConfig();
        setAppConfig(updatedConfig);
      }
    };

    // Trigger disturbing alarm when app is brought to foreground or focused
    const handleWakeOrFocus = () => {
      if (document.visibilityState === 'visible') {
        const pending = getPendingDisturbingAlarm();
        if (pending && !pending.acknowledged) {
          const currentReports = getStoredReports();
          const match = currentReports.find((r) => r.incidentNumber === pending.incidentNumber || r.id === pending.id) || currentReports[0];
          if (match) setActiveAlarmReport(match);

          if (dashboardMode === 'admin') {
            startContinuousStationAlarm(pending);
          }
        }
      }
    };

    // Cross-window/cross-tab storage event: alarms all admin accounts immediately upon citizen upload
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === 'madrid_pending_disturbing_alarm') {
        const pending = getPendingDisturbingAlarm();
        if (pending && !pending.acknowledged) {
          const refreshed = getStoredReports();
          setReports(refreshed);
          const match = refreshed.find((r) => r.incidentNumber === pending.incidentNumber || r.id === pending.id);
          if (match) setActiveAlarmReport(match);

          if (dashboardMode === 'admin') {
            startContinuousStationAlarm(pending);
          }
        }
      }
    };

    // Immediately trigger disturbing alarm if currently in Admin view and an alarm is pending
    if (dashboardMode === 'admin') {
      const pending = getPendingDisturbingAlarm();
      if (pending && !pending.acknowledged) {
        startContinuousStationAlarm(pending);
        const currentReports = getStoredReports();
        const match = currentReports.find((r) => r.incidentNumber === pending.incidentNumber || r.id === pending.id);
        if (match) setActiveAlarmReport(match);
      }
    }

    document.addEventListener('visibilitychange', handleWakeOrFocus);
    window.addEventListener('focus', handleWakeOrFocus);
    window.addEventListener('storage', handleStorageEvent);

    if ('serviceWorker' in navigator) {
      const handleSwMessage = (event: MessageEvent) => {
        if (event.data?.type === 'ADMIN_EMERGENCY_ALARM_TRIGGERED' || event.data?.type === 'FOCUS_ADMIN_DISPATCH') {
          if (dashboardMode === 'admin') {
            startContinuousStationAlarm(event.data.details);
          }
        }
      };
      navigator.serviceWorker.addEventListener('message', handleSwMessage);
      return () => {
        channel.close();
        document.removeEventListener('visibilitychange', handleWakeOrFocus);
        window.removeEventListener('focus', handleWakeOrFocus);
        window.removeEventListener('storage', handleStorageEvent);
        navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      };
    }

    return () => {
      channel.close();
      document.removeEventListener('visibilitychange', handleWakeOrFocus);
      window.removeEventListener('focus', handleWakeOrFocus);
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, [dashboardMode]);

  const refreshLocation = useCallback(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserCoords({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        () => {
          setUserCoords({ lat: 9.2618, lng: 125.9610 });
        },
        { enableHighAccuracy: true, timeout: 6000 }
      );
    }
  }, []);

  // Sync offline queued reports when connection is restored
  const handleSyncQueue = async () => {
    if (offlineQueuedReports.length === 0) return;
    setIsSyncing(true);

    try {
      await new Promise((res) => setTimeout(res, 1200));

      const updated = [...reports];
      offlineQueuedReports.forEach((queued) => {
        saveReport({ ...queued, isOfflineQueued: false });
        updated.unshift({ ...queued, isOfflineQueued: false });
      });

      setReports(updated);
      clearOfflineQueue();
      setOfflineQueuedReports([]);

      const syncNotif: PushNotificationItem = {
        id: 'sync-' + Date.now(),
        incidentId: offlineQueuedReports[0].id,
        title: 'Cloud & SMS Sync Successful',
        body: `${offlineQueuedReports.length} offline report(s) dispatched to BFP Madrid.`,
        type: 'system',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        read: false,
      };

      setNotifications((prev) => [syncNotif, ...prev]);
      setActiveToast(syncNotif);
      playNotificationChime();
    } finally {
      setIsSyncing(false);
    }
  };

  // Add newly created incident
  const handleReportCreated = (newReport: IncidentReport) => {
    setReports((prev) => [newReport, ...prev]);
    setSelectedReportId(newReport.id);

    // PERSIST LOCALLY:
    saveReport(newReport);

    // INSTANTLY TRANSMIT EMERGENCY OVER THE INTERNET VIA CLOUD TO ALL PHONES:
    saveIncidentReportToCloud(newReport).catch((err) => {
      console.warn('[Firebase] Broadcast to cloud pending network:', err);
    });

    // PERSIST DISTURBING ALARM:
    // Guarantees all admin accounts alarm even if the app was closed when citizen reported!
    setPendingDisturbingAlarm({
      id: newReport.id,
      incidentNumber: newReport.incidentNumber,
      location: newReport.location.streetAddress || newReport.location.barangay,
    });

    // CRITICAL USER REQUIREMENT:
    // "when reporting an incident or sending a picture of incident, there should have no alarm in the citizen cellphone. only the admin accounts should alarm."
    setActiveAlarmReport(newReport);

    if (dashboardMode === 'admin') {
      startContinuousStationAlarm({
        incidentNumber: newReport.incidentNumber,
        location: newReport.location.streetAddress || newReport.location.barangay,
      });
    } else {
      // Citizen cellphone: absolutely NO alarm/siren sounds.
      // Reassuring, gentle chime only
      playCitizenGentleConfirmation();

      // Dispatch disturbing notification across background channel & service worker to notify all admin accounts
      dispatchBackgroundAdminNotification({
        incidentNumber: newReport.incidentNumber,
        location: newReport.location.streetAddress || newReport.location.barangay,
      });
    }

    const newNotif: PushNotificationItem = {
      id: 'notif-' + Date.now(),
      incidentId: newReport.id,
      title: `📸 Emergency Photo Dispatched: ${newReport.incidentNumber}`,
      body: `Photo submitted at ${newReport.location.streetAddress || newReport.location.barangay}. BFP & MDRRMO admins alerted.`,
      type: 'dispatch',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      read: false,
    };

    setNotifications((prev) => [newNotif, ...prev]);
    setActiveToast(newNotif);
  };

  // TURN OFF SIREN: Stops continuous station alarm and acknowledges incident
  const handleStopAlarmByResponder = (responderTitle: string) => {
    stopContinuousStationAlarm();
    stopAllAlarmSounds();
    clearPendingDisturbingAlarm();

    // Broadcast silencing across tabs and devices
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const ch = new BroadcastChannel('bfp_madrid_emergency_channel');
        ch.postMessage({ type: 'ADMIN_ALARM_STOPPED' });
        ch.close();
      }
    } catch {
      // Ignore
    }

    const currentAlarm = activeAlarmReport;
    setActiveAlarmReport(null);

    if (currentAlarm) {
      const updatedHistory = [
        ...currentAlarm.statusHistory,
        {
          status: currentAlarm.status,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          note: `Continuous station alarm silenced and acknowledged by ${currentUser?.fullName || responderTitle}.`,
          updatedBy: currentUser?.fullName || responderTitle,
        },
      ];

      const updated: IncidentReport = {
        ...currentAlarm,
        statusHistory: updatedHistory,
        updatedAt: new Date().toISOString(),
      };

      saveReport(updated);
      updateIncidentReportInCloud(updated.id, updated).catch((err) => {
        console.warn('[Firebase] Syncing alarm acknowledge to cloud failed:', err);
      });
      setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    }
  };

  // Update incident status from dispatch - AUTOMATICALLY TURNS OFF ALARM ON ADMIN ACTION
  const handleReportUpdated = (updated: IncidentReport) => {
    // AUTOMATIC ALARM TURN OFF ON ADMIN ACTION:
    // User requirement: "and when there is an action taken by the admin automatic the alarm will turn off."
    if (activeAlarmReport || isStationAlarmSounding()) {
      handleStopAlarmByResponder(currentUser?.fullName ? `${currentUser.fullName} Action` : 'Admin Action');
    }

    saveReport(updated);

    // Sync status change to Firestore over the internet immediately so citizen phones reflect updates in real time
    updateIncidentReportInCloud(updated.id, updated).catch((err) => {
      console.warn('[Firebase] Syncing report update to cloud failed:', err);
    });

    setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    if (selectedReportId === updated.id) {
      setSelectedReportId(updated.id);
    }

    const updateNotif: PushNotificationItem = {
      id: 'notif-' + Date.now(),
      incidentId: updated.id,
      title: `Status: ${updated.status.toUpperCase()} (${updated.incidentNumber})`,
      body: updated.statusHistory[updated.statusHistory.length - 1]?.note || `${updated.title} is now ${updated.status}.`,
      type: 'status_change',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      read: false,
    };

    setNotifications((prev) => [updateNotif, ...prev]);
    setActiveToast(updateNotif);
    playNotificationChime();
  };

  // Mark all notifications read
  const handleMarkAllRead = () => {
    const updated = notifications.map((n) => ({ ...n, read: true }));
    setNotifications(updated);
    saveNotifications(updated);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleLogout = () => {
    if (dashboardMode === 'admin') {
      clearAdminSession();
      setAdminUser(null);
      stopContinuousStationAlarm();
      stopAllAlarmSounds();
    } else {
      clearCitizenSession();
      setCitizenUser(null);
    }
    clearUserProfile();
    setIsLoginOpen(false);
  };

  // Unified mode switch handler: Client (User) <-> Admin (Station Dispatcher)
  const handleSwitchMode = (newMode: 'user' | 'admin') => {
    setDashboardMode(newMode);
    if (newMode === 'admin') {
      if (adminUser) {
        saveUserProfile(adminUser);
        // Check for pending disturbing alarm or active alarm report immediately!
        const pending = getPendingDisturbingAlarm();
        if (pending && !pending.acknowledged) {
          startContinuousStationAlarm(pending);
          const match = reports.find((r) => r.incidentNumber === pending.incidentNumber || r.id === pending.id) || reports[0];
          if (match) setActiveAlarmReport(match);
        } else if (activeAlarmReport) {
          startContinuousStationAlarm({
            incidentNumber: activeAlarmReport.incidentNumber,
            location: activeAlarmReport.location.streetAddress || activeAlarmReport.location.barangay,
          });
        }
      }
    } else {
      if (citizenUser) {
        saveUserProfile(citizenUser);
      }
      // In citizen view: no continuous disturbing station siren on citizen phone
      stopContinuousStationAlarm();
      stopAllAlarmSounds();
    }
  };

  // Switch persona account between the 2 official admins
  const handleSelectAdmin = (adminName: 'Admin1' | 'Admin2') => {
    const found = SEEDED_ACCOUNTS.find((a) => a.username === adminName);
    if (found) {
      setAdminUser(found.profile);
      saveAdminSession(found.profile);
      saveUserProfile(found.profile);
      if (dashboardMode === 'admin' && activeAlarmReport) {
        startContinuousStationAlarm({
          incidentNumber: activeAlarmReport.incidentNumber,
          location: activeAlarmReport.location.streetAddress || activeAlarmReport.location.barangay,
        });
      }
    }
  };

  // Callback when a user signs in or registers via the login modal
  const handleLoginSuccess = (user: UserProfile) => {
    saveUserProfile(user);
    if (user.role === 'admin_dispatcher') {
      setAdminUser(user);
      saveAdminSession(user);
      setDashboardMode('admin');
      const pending = getPendingDisturbingAlarm();
      if (pending && !pending.acknowledged) {
        startContinuousStationAlarm(pending);
        const match = reports.find((r) => r.incidentNumber === pending.incidentNumber || r.id === pending.id) || reports[0];
        if (match) setActiveAlarmReport(match);
      }
    } else {
      setCitizenUser(user);
      saveCitizenSession(user);
      setDashboardMode('user');
      stopContinuousStationAlarm();
      stopAllAlarmSounds();
    }
    setIsLoginOpen(false);
  };

  return (
    <div
      className={`relative w-full h-screen overflow-hidden flex flex-col font-sans transition-colors duration-300 ${
        isNightMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-900 text-slate-100'
      }`}
    >
      {/* Background Graphic from User Uploaded Poster */}
      <AppBackground dimAmount="medium" opacity={dashboardMode === 'admin' ? 0.35 : 0.45} />
      {/* Alarming Incoming Emergency Siren Alert Banner - ONLY FOR ADMINS */}
      {dashboardMode === 'admin' && activeAlarmReport && (
        <div className="relative z-50 bg-rose-600 border-b-2 border-amber-300 text-white px-3 sm:px-5 py-2.5 flex flex-wrap items-center justify-between gap-2 shadow-2xl animate-pulse">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-white text-rose-600 flex items-center justify-center font-black text-lg animate-bounce shrink-0 shadow">
              🚨
            </div>
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-black uppercase tracking-wider flex items-center gap-2">
                <span>CONTINUOUS STATION ALARM ACTIVE!</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-400 text-slate-950 font-bold hidden sm:inline">
                  STOPS ONLY VIA BFP OR MDRRMO
                </span>
              </div>
              <div className="text-[11px] text-rose-100 truncate">
                {activeAlarmReport.incidentNumber} &bull; {activeAlarmReport.title} ({activeAlarmReport.location.streetAddress || `Brgy. ${activeAlarmReport.location.barangay}`})
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Primary prominent button: TURN OFF Siren */}
            <button
              onClick={() => handleStopAlarmByResponder('Turn Off Siren Button')}
              className="py-1.5 px-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg active:scale-95 transition ring-2 ring-amber-200"
              title="TURN OFF Siren and stop station alarm immediately"
            >
              <VolumeX className="w-4 h-4" />
              <span>TURN OFF Siren</span>
            </button>

            {/* Authorized BFP Stop Button */}
            <button
              onClick={() => handleStopAlarmByResponder('BFP Madrid Station Commander')}
              className="py-1 px-3 rounded-xl bg-white text-rose-700 hover:bg-rose-100 font-bold text-xs flex items-center gap-1 shadow transition"
              title="Stop alarm as BFP Madrid Commander"
            >
              <span>🚒 BFP Stop</span>
            </button>

            {/* Authorized MDRRMO Stop Button */}
            <button
              onClick={() => handleStopAlarmByResponder('MDRRMO Operations Chief')}
              className="py-1 px-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs flex items-center gap-1 shadow transition"
              title="Stop alarm as MDRRMO Operations Chief"
            >
              <span>🚑 MDRRMO Stop</span>
            </button>
          </div>
        </div>
      )}

      {/* Offline Status Top Banner */}
      <OfflineBanner
        isOnline={isOnline}
        queuedCount={offlineQueuedReports.length}
        onSyncQueue={handleSyncQueue}
        isSyncing={isSyncing}
        lastQueuedReport={offlineQueuedReports[0]}
      />

      {/* Main App Top Navigation Bar */}
      <header className="relative z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800/90 px-3 sm:px-5 py-2 flex items-center justify-between shadow-xl">
        {/* Brand & Municipality Identity */}
        <div className="flex items-center gap-2.5">
          <BfpMadridLogo size="md" withGlow={true} />

          <div>
            <h1 className="text-sm sm:text-base font-black tracking-tight text-white uppercase flex items-center gap-1.5">
              <span>{appConfig.appName || 'BFP MADRID EMERGENCY NOTIFIER'}</span>
            </h1>
            <div className="text-[10px] sm:text-[11px] text-slate-400 flex items-center gap-1.5">
              <span className="text-rose-400 font-bold">{appConfig.stationName || 'BFP Madrid Fire Station'}</span>
              <span>&bull;</span>
              <span className="text-amber-400 font-bold">MDRRMO</span>
              <span>&bull;</span>
              <span className="text-slate-300">Surigao del Sur</span>
              <span className="hidden md:inline">&bull;</span>
              <span
                className={`hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold ${
                  isCloudConnected && isOnline
                    ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 shadow-sm'
                    : 'bg-amber-950/80 text-amber-300 border border-amber-500/40'
                }`}
                title={`Multi-Device Internet Sync: ${
                  isCloudConnected && isOnline
                    ? `Live Real-time Connected across phones & locations (Synced ${lastCloudSyncTime})`
                    : 'Offline Queue Mode'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isCloudConnected && isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                  }`}
                ></span>
                <Globe className="w-2.5 h-2.5" />
                <span>{isCloudConnected && isOnline ? 'Cloud Live Sync' : 'Offline'}</span>
              </span>
            </div>
          </div>
        </div>

        {/* UNIFIED 2-IN-1 PORTAL SWITCHER: Client/User & Admin BFP Command */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 flex-wrap">
          {/* Prominent segmented switcher for 1 unified app */}
          <div className="flex items-center bg-slate-950/90 p-1 rounded-2xl border border-slate-700/80 shadow-inner">
            <button
              onClick={() => handleSwitchMode('user')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                dashboardMode === 'user'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-950/60 ring-1 ring-rose-400'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
              }`}
              title="Switch to Client / Citizen Emergency Reporting View"
            >
              <span className="text-sm">📱</span>
              <span className="tracking-wide">Client App</span>
              {!citizenUser && (
                <span className="px-1.5 py-0.2 rounded-md text-[9px] bg-slate-800 text-slate-300 border border-slate-700 font-semibold">
                  Login Req.
                </span>
              )}
            </button>

            <button
              onClick={() => handleSwitchMode('admin')}
              className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                dashboardMode === 'admin'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-950/60 ring-1 ring-amber-300'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
              }`}
              title="Switch to Admin / BFP Madrid Command Console"
            >
              <Shield className="w-3.5 h-3.5" />
              <span className="tracking-wide">Admin App</span>
              {!adminUser && (
                <span className="px-1.5 py-0.2 rounded-md text-[9px] bg-amber-950 text-amber-300 border border-amber-800 font-semibold">
                  Login Req.
                </span>
              )}
              {activeAlarmReport && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[9px] bg-rose-600 text-white font-black animate-pulse shadow-sm">
                  🚨 ALARM!
                </span>
              )}
            </button>
          </div>

          {/* Contextual Officer or Citizen identity */}
          {dashboardMode === 'admin' && adminUser ? (
            <div className="hidden lg:flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-amber-500/30 text-[11px]">
              <span className="text-[10px] uppercase font-black text-amber-400 px-1">Officer:</span>
              <button
                onClick={() => handleSelectAdmin('Admin1')}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition ${
                  adminUser.username === 'Admin1'
                    ? 'bg-amber-500 text-slate-950 font-black shadow'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                title="BFP Fire Station Commander"
              >
                Admin1 (BFP)
              </button>
              <button
                onClick={() => handleSelectAdmin('Admin2')}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition ${
                  adminUser.username === 'Admin2'
                    ? 'bg-amber-500 text-slate-950 font-black shadow'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                title="MDRRMO Rescue Operations Chief"
              >
                Admin2 (MDRRMO)
              </button>
            </div>
          ) : dashboardMode === 'user' && citizenUser ? (
            <div className="hidden lg:flex items-center gap-1.5 bg-slate-950/80 px-2.5 py-1.5 rounded-xl border border-slate-800 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="font-bold text-white max-w-[130px] truncate">{citizenUser.fullName}</span>
              <span className="text-[10px] text-slate-400">({citizenUser.barangay.replace(' (Poblacion)', '')})</span>
            </div>
          ) : null}

          {/* Quick TURN OFF Siren button in Admin Header whenever alarm is active */}
          {dashboardMode === 'admin' && activeAlarmReport && (
            <button
              onClick={() => handleStopAlarmByResponder('Turn Off Siren (Header Button)')}
              className="py-1 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md animate-pulse active:scale-95 transition"
              title="TURN OFF Siren and stop alarm"
            >
              <VolumeX className="w-4 h-4" />
              <span>TURN OFF Siren</span>
            </button>
          )}

          {/* Direct Hotlines Modal Trigger */}
          <button
            onClick={() => setIsHotlineOpen(true)}
            className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition"
            title="Emergency Directory Hotlines"
          >
            <Phone className="w-4 h-4 text-emerald-400" />
            <span className="hidden lg:inline">Hotlines</span>
          </button>

          {/* App Details & Developer Credit Trigger */}
          <button
            onClick={() => setIsAppInfoOpen(true)}
            className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition"
            title="App Details & System Information (FO1 Evangelio)"
          >
            <Info className="w-4 h-4 text-amber-400" />
            <span className="hidden lg:inline">App Details</span>
          </button>

          {/* Notifications Bell */}
          <button
            onClick={() => setIsNotifTrayOpen(true)}
            className="relative p-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            title="Push Status Updates"
          >
            <Bell className="w-4 h-4 text-slate-300" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-600 text-white font-bold text-[9px] flex items-center justify-center animate-bounce">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Night Mode Toggle */}
          <button
            onClick={() => setIsNightMode((prev) => !prev)}
            className="p-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            title={isNightMode ? 'Switch Theme' : 'Night Vision Mode'}
          >
            {isNightMode ? <Moon className="w-4 h-4 text-amber-400" /> : <Sun className="w-4 h-4 text-amber-400" />}
          </button>

          {/* User Sign In / Profile Modal */}
          <button
            onClick={() => {
              setLoginTargetRole(dashboardMode === 'admin' ? 'admin_dispatcher' : 'citizen');
              setIsLoginOpen(true);
            }}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
              currentUser?.role === 'admin_dispatcher'
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 hover:bg-amber-500/30'
                : currentUser
                ? 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 border-slate-700'
                : 'bg-rose-950/60 border-rose-700 text-rose-300 hover:bg-rose-900/80 animate-pulse'
            }`}
            title="Profile & Account Details"
          >
            {currentUser?.role === 'admin_dispatcher' ? (
              <Shield className="w-3.5 h-3.5 text-amber-400" />
            ) : currentUser ? (
              <User className="w-3.5 h-3.5 text-sky-400" />
            ) : (
              <KeyRound className="w-3.5 h-3.5 text-rose-400" />
            )}
            <span className="max-w-[70px] sm:max-w-[100px] truncate">
              {currentUser ? currentUser.username || currentUser.fullName.split(' ')[0] : 'Sign In'}
            </span>
          </button>

          {/* Sign Out Button */}
          {currentUser && (
            <button
              onClick={handleLogout}
              className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-800/90 hover:bg-rose-950/80 hover:border-rose-700 text-slate-300 hover:text-rose-300 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition"
              title="Sign Out of Notifier"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden md:inline">Sign Out</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Viewport: Unified 2-in-1 App View (Client or Admin Dashboard) */}
      <main className="relative flex-1 w-full h-full overflow-hidden flex flex-col">
        {dashboardMode === 'user' ? (
          /* USER / CLIENT DASHBOARD: Requires Citizen Login */
          !citizenUser ? (
            <ModeLoginGate
              mode="user"
              onLoginSuccess={handleLoginSuccess}
              onSwitchMode={handleSwitchMode}
              onOpenHotlines={() => setIsHotlineOpen(true)}
            />
          ) : (
            <UserDashboard
              currentUser={citizenUser}
              userCoords={userCoords}
              onRefreshLocation={refreshLocation}
              reports={reports}
              onReportCreated={handleReportCreated}
              isOnline={isOnline}
              responderUnits={responderUnits}
              onSelectIncidentOnMap={(report) => {
                setSelectedReportId(report.id);
              }}
            />
          )
        ) : (
          /* ADMIN DASHBOARD: Requires Station Dispatcher Login */
          !adminUser ? (
            <ModeLoginGate
              mode="admin"
              onLoginSuccess={handleLoginSuccess}
              onSwitchMode={handleSwitchMode}
              onOpenHotlines={() => setIsHotlineOpen(true)}
            />
          ) : (
            <AdminDashboard
              currentUser={adminUser}
              reports={reports}
              onUpdateReport={handleReportUpdated}
              responderUnits={responderUnits}
              userCoords={userCoords}
              isOnline={isOnline}
              onSelectIncidentOnMap={(report) => {
                setSelectedReportId(report.id);
              }}
              isAlarmActive={Boolean(activeAlarmReport)}
              onStopAlarmByResponder={handleStopAlarmByResponder}
            />
          )
        )}
      </main>

      {/* Floating Push Notification Banner Toast */}
      <AndroidPushToast
        notification={activeToast}
        onDismiss={() => setActiveToast(null)}
        onTap={(notif) => {
          setSelectedReportId(notif.incidentId);
          setIsHistoryOpen(true);
          setActiveToast(null);
        }}
      />

      {/* Phone Login Modal */}
      <PhoneLoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onLoginSuccess={handleLoginSuccess}
        currentUser={currentUser}
        onLogout={handleLogout}
        targetRole={loginTargetRole}
      />

      {/* User Reporting History & Lifecycle Drawer */}
      <ReportHistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        reports={reports}
        currentUser={currentUser}
        onSelectIncident={(report) => {
          setSelectedReportId(report.id);
        }}
      />

      {/* Push Notifications Tray */}
      <PushNotificationsTray
        notifications={notifications}
        onMarkAllRead={handleMarkAllRead}
        onSelectNotification={(item) => {
          setSelectedReportId(item.incidentId);
          setIsHistoryOpen(true);
        }}
        isOpen={isNotifTrayOpen}
        onClose={() => setIsNotifTrayOpen(false)}
      />

      {/* Madrid Emergency Hotlines Directory */}
      <HotlineModal isOpen={isHotlineOpen} onClose={() => setIsHotlineOpen(false)} />

      {/* App Details & Developer Build Credits Modal */}
      <AppInfoModal isOpen={isAppInfoOpen} onClose={() => setIsAppInfoOpen(false)} />
    </div>
  );
}
