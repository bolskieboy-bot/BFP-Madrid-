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
  getStoredUserProfile,
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
import { SEEDED_ACCOUNTS, logoutCurrentUser } from './services/accountService';
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
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [responderUnits, setResponderUnits] = useState<ResponderUnit[]>([]);
  const [notifications, setNotifications] = useState<PushNotificationItem[]>([]);
  const [activeToast, setActiveToast] = useState<PushNotificationItem | null>(null);
  const [activeAlarmReport, setActiveAlarmReport] = useState<IncidentReport | null>(null);
  const [appConfig, setAppConfig] = useState<AppDetailsConfig>(() => getAppDetailsConfig());

  // Active Dashboard View: 'user' or 'admin'
  const [dashboardMode, setDashboardMode] = useState<'user' | 'admin'>('user');

  // Network Connectivity
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
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
      setCurrentUser(null);
    } else {
      setCurrentUser(stored);
      if (stored?.role === 'admin_dispatcher') {
        setDashboardMode('admin');
      }
    }

    // If app was opened via background alarm notification while closed, ensure admin access
    if (hasAdminAlarmParam && (!stored || stored.role !== 'admin_dispatcher')) {
      const defaultAdmin = SEEDED_ACCOUNTS[0].profile;
      setCurrentUser(defaultAdmin);
      setDashboardMode('admin');
      stored = defaultAdmin;
    }

    // CHECK FOR PENDING DISTURBING ALARM (Even if the app was closed when citizen reported!)
    const pendingAlarm = getPendingDisturbingAlarm();
    if (pendingAlarm && !pendingAlarm.acknowledged) {
      if (stored?.role === 'admin_dispatcher' || hasAdminAlarmParam) {
        setDashboardMode('admin');
        startContinuousStationAlarm({
          incidentNumber: pendingAlarm.incidentNumber,
          location: pendingAlarm.location,
        });
        const matching = loadedReports.find((r) => r.incidentNumber === pendingAlarm.incidentNumber || r.id === pendingAlarm.id);
        if (matching) {
          setActiveAlarmReport(matching);
        }
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

  // Cross-tab, background alarm, and window focus synchronization
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const channel = new BroadcastChannel('bfp_madrid_emergency_channel');
    channel.onmessage = (event) => {
      if (event.data?.type === 'ADMIN_EMERGENCY_ALARM_TRIGGERED') {
        const refreshed = getStoredReports();
        setReports(refreshed);

        // ONLY ADMIN ACCOUNTS ALARM!
        if (currentUser?.role === 'admin_dispatcher') {
          startContinuousStationAlarm(event.data.details);
          const match = refreshed.find((r) => r.incidentNumber === event.data.details?.incidentNumber) || refreshed[0];
          if (match) setActiveAlarmReport(match);
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
      if (document.visibilityState === 'visible' && currentUser?.role === 'admin_dispatcher') {
        const pending = getPendingDisturbingAlarm();
        if (pending && !pending.acknowledged) {
          startContinuousStationAlarm(pending);
          const currentReports = getStoredReports();
          const match = currentReports.find((r) => r.incidentNumber === pending.incidentNumber || r.id === pending.id);
          if (match) setActiveAlarmReport(match);
        }
      }
    };

    // Cross-window/cross-tab storage event: alarms all admin accounts immediately upon citizen upload
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === 'madrid_pending_disturbing_alarm' && currentUser?.role === 'admin_dispatcher') {
        const pending = getPendingDisturbingAlarm();
        if (pending && !pending.acknowledged) {
          startContinuousStationAlarm(pending);
          const refreshed = getStoredReports();
          setReports(refreshed);
          const match = refreshed.find((r) => r.incidentNumber === pending.incidentNumber || r.id === pending.id);
          if (match) setActiveAlarmReport(match);
        }
      }
    };

    // Immediately trigger disturbing alarm if an admin account logs in or mounts while an alarm is pending
    if (currentUser?.role === 'admin_dispatcher') {
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
          if (currentUser?.role === 'admin_dispatcher') {
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
  }, [currentUser]);

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

    // PERSIST DISTURBING ALARM:
    // Guarantees all admin accounts alarm even if the app was closed when citizen reported!
    setPendingDisturbingAlarm({
      id: newReport.id,
      incidentNumber: newReport.incidentNumber,
      location: newReport.location.streetAddress || newReport.location.barangay,
    });

    // CRITICAL USER REQUIREMENT:
    // "when reporting an incident or sending a picture of incident, there should have no alarm in the citizen cellphone. only the admin accounts should alarm."
    if (currentUser?.role === 'admin_dispatcher') {
      startContinuousStationAlarm({
        incidentNumber: newReport.incidentNumber,
        location: newReport.location.streetAddress || newReport.location.barangay,
      });
      setActiveAlarmReport(newReport);
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
    logoutCurrentUser();
    clearUserProfile();
    setCurrentUser(null);
    setDashboardMode('user');
    setIsLoginOpen(false);
  };

  // Switch persona account between the 2 official admins
  const handleSwitchToAdmin = (adminUser: 'Admin1' | 'Admin2') => {
    const found = SEEDED_ACCOUNTS.find((a) => a.username === adminUser);
    if (found) {
      setCurrentUser(found.profile);
      setDashboardMode('admin');
    }
  };

  // If user is not authenticated, show the mandatory AuthGate (Login & Registration)
  if (!currentUser) {
    return (
      <div className={`relative min-h-screen ${isNightMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-900 text-slate-100'}`}>
        <AuthGate
          onLoginSuccess={(user) => {
            setCurrentUser(user);
            if (user.role === 'admin_dispatcher') {
              setDashboardMode('admin');
              const pending = getPendingDisturbingAlarm();
              if (pending && !pending.acknowledged) {
                startContinuousStationAlarm(pending);
                const currentReports = getStoredReports();
                const match = currentReports.find((r) => r.incidentNumber === pending.incidentNumber || r.id === pending.id);
                if (match) setActiveAlarmReport(match);
              }
            } else {
              setDashboardMode('user');
            }
          }}
          onOpenHotlines={() => setIsHotlineOpen(true)}
        />
        <HotlineModal isOpen={isHotlineOpen} onClose={() => setIsHotlineOpen(false)} />
      </div>
    );
  }

  return (
    <div
      className={`relative w-full h-screen overflow-hidden flex flex-col font-sans transition-colors duration-300 ${
        isNightMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-900 text-slate-100'
      }`}
    >
      {/* Background Graphic from User Uploaded Poster */}
      <AppBackground dimAmount="medium" opacity={dashboardMode === 'admin' ? 0.35 : 0.45} />
      {/* Alarming Incoming Emergency Siren Alert Banner - ONLY FOR ADMINS */}
      {currentUser?.role === 'admin_dispatcher' && activeAlarmReport && (
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
            </div>
          </div>
        </div>

        {/* Persona Mode Switcher & Top Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* If citizen, show ONLY citizen profile pill - NO ADMIN CONTROLS IN CITIZEN APP */}
          {currentUser?.role !== 'admin_dispatcher' ? (
            <div className="flex items-center gap-1.5 bg-slate-950/80 px-2.5 py-1.5 rounded-xl border border-slate-800 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span className="font-bold text-white max-w-[120px] truncate">{currentUser?.fullName}</span>
            </div>
          ) : (
            /* STRICT ADMIN CONSOLE HEADER - NO CITIZEN ACCOUNT OR CITIZEN VIEW INSIDE ADMIN */
            <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-950/90 p-1 px-2.5 rounded-2xl border border-amber-500/30 text-xs shadow-inner">
              <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                <Shield className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline text-amber-300">Admin Console:</span>
                <span className="font-black text-white">{currentUser.username}</span>
              </div>

              {/* Reserved Slots for 2 Admins (Admin1 & Admin2) */}
              <div className="flex items-center gap-1 ml-1 pl-1.5 border-l border-slate-800 text-[11px]">
                <button
                  onClick={() => handleSwitchToAdmin('Admin1')}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition ${
                    currentUser?.username === 'Admin1'
                      ? 'bg-amber-500 text-slate-950 font-black shadow'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                  title="Switch to Admin1 (BFP Fire Station Commander)"
                >
                  Admin1 (BFP)
                </button>
                <button
                  onClick={() => handleSwitchToAdmin('Admin2')}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition ${
                    currentUser?.username === 'Admin2'
                      ? 'bg-amber-500 text-slate-950 font-black shadow'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                  title="Switch to Admin2 (MDRRMO Rescue Officer)"
                >
                  Admin2 (MDRRMO)
                </button>
              </div>
            </div>
          )}

          {/* Quick TURN OFF Siren button in Admin Header whenever alarm is active */}
          {currentUser?.role === 'admin_dispatcher' && activeAlarmReport && (
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
            onClick={() => setIsLoginOpen(true)}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
              currentUser?.role === 'admin_dispatcher'
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 hover:bg-amber-500/30'
                : 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
            title="Profile & Account Details"
          >
            {currentUser?.role === 'admin_dispatcher' ? (
              <Shield className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <User className="w-3.5 h-3.5 text-sky-400" />
            )}
            <span className="max-w-[70px] sm:max-w-[100px] truncate">
              {currentUser ? currentUser.username || currentUser.fullName.split(' ')[0] : 'Profile'}
            </span>
          </button>

          {/* Sign Out Button */}
          <button
            onClick={handleLogout}
            className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-800/90 hover:bg-rose-950/80 hover:border-rose-700 text-slate-300 hover:text-rose-300 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition"
            title="Sign Out of Notifier"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden md:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Viewport: Either Citizen Dashboard or Admin Dashboard */}
      <main className="relative flex-1 w-full h-full overflow-hidden flex flex-col">
        {currentUser?.role !== 'admin_dispatcher' ? (
          /* USER DASHBOARD: ONLY Upload / Report Photo and Map tabs */
          <UserDashboard
            currentUser={currentUser}
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
        ) : (
          /* ADMIN DASHBOARD: ONLY Photos Reported and Realtime Map tabs */
          <AdminDashboard
            currentUser={currentUser}
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
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          if (user.role === 'admin_dispatcher') {
            setDashboardMode('admin');
          } else {
            setDashboardMode('user');
          }
          setIsLoginOpen(false);
        }}
        currentUser={currentUser}
        onLogout={handleLogout}
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
