import { useState } from 'react';
import {
  Camera,
  MapPin,
  CheckCircle2,
  Check,
  Navigation,
  Maximize2,
  AlertOctagon,
  Volume2,
  MessageSquare,
  History,
  RotateCcw,
  Clock,
  Sparkles,
  Inbox,
  Shield,
  Settings,
  VolumeX,
  Bell,
  Smartphone,
} from 'lucide-react';
import {
  IncidentCategory,
  IncidentReport,
  IncidentSeverity,
  IncidentStatus,
  ResponderUnit,
  UserProfile,
} from '../../types';
import { saveReport, addNotification } from '../../services/storageService';
import { recordAdminSmsToCitizen } from '../../services/smsService';
import {
  playAlarmingStationSiren,
  stopContinuousStationAlarm,
  stopAllAlarmSounds,
  playRadioDispatchChime,
} from '../../services/audioService';
import {
  getNotificationPermissionStatus,
  requestBackgroundAlarmPermission,
  scheduleTestLockScreenAlarm,
} from '../../services/backgroundAlarmService';
import LeafletEmergencyMap from '../Map/LeafletEmergencyMap';
import BfpMadridLogo from '../Common/BfpMadridLogo';
import AppDetailsEditor from './AppDetailsEditor';

interface AdminDashboardProps {
  currentUser: UserProfile | null;
  reports: IncidentReport[];
  onUpdateReport: (report: IncidentReport) => void;
  responderUnits: ResponderUnit[];
  userCoords: { lat: number; lng: number } | null;
  isOnline: boolean;
  onSelectIncidentOnMap?: (report: IncidentReport) => void;
  isAlarmActive?: boolean;
  onStopAlarmByResponder?: (responderTitle: string) => void;
}

const IDENT_OPTIONS: Record<
  'fire' | 'vehicular' | 'medical' | 'rescue',
  { label: string; icon: string; defaultUnitId: string; subcategories: string[] }
> = {
  fire: {
    label: 'Fire Incident',
    icon: '🔥',
    defaultUnitId: 'unit-bfp-01',
    subcategories: [
      'Residential Structure Fire',
      'Commercial / Market Fire',
      'Grass / Brush Fire',
      'Electrical Post Spark',
    ],
  },
  vehicular: {
    label: 'Vehicular Accident',
    icon: '🚗',
    defaultUnitId: 'unit-bfp-amb-01',
    subcategories: [
      'Motorcycle Collision',
      'Multi-Vehicle Crash',
      'Tricycle / PUV Collision',
      'Pedestrian Struck',
    ],
  },
  medical: {
    label: 'Medical Emergency',
    icon: '🚑',
    defaultUnitId: 'unit-bfp-amb-01', // BFP Ambulance default
    subcategories: [
      'Severe Trauma / Heavy Bleeding',
      'Cardiac Emergency',
      'Childbirth Emergency',
      'Difficulty Breathing',
    ],
  },
  rescue: {
    label: 'Rescue / Disaster',
    icon: '🛡️',
    defaultUnitId: 'unit-rescue-01',
    subcategories: [
      'Flash Flood Rescue',
      'Fallen Tree Obstruction',
      'Landslide / Soil Erosion',
    ],
  },
};

export default function AdminDashboard({
  currentUser,
  reports,
  onUpdateReport,
  responderUnits,
  userCoords,
  isOnline,
  onSelectIncidentOnMap,
  isAlarmActive,
  onStopAlarmByResponder,
}: AdminDashboardProps) {
  // 4 TABS: 'photos' (current active reported photos only), 'map' (realtime map), 'history' (all resolved cases), 'app_details' (edit app details by Admin1 & Admin2)
  const [activeTab, setActiveTab] = useState<'photos' | 'map' | 'history' | 'app_details'>('photos');

  // ONLY CURRENT REPORTED PHOTOS (Active and NOT resolved)
  const activePhotoReports = reports.filter(
    (r) => r.photos && r.photos.length > 0 && r.status !== 'resolved'
  );

  // ALL RESOLVED CASES (Moved to History)
  const resolvedReports = reports.filter((r) => r.status === 'resolved');

  const [selectedReportId, setSelectedReportId] = useState<string | null>(
    activePhotoReports.length > 0 ? activePhotoReports[0].id : null
  );

  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(
    resolvedReports.length > 0 ? resolvedReports[0].id : null
  );

  const [smsReplyText, setSmsReplyText] = useState('');
  const [smsSuccessNotice, setSmsSuccessNotice] = useState<string | null>(null);
  const [resolvedNotice, setResolvedNotice] = useState<string | null>(null);

  // Admin Identification state
  const [identCategory, setIdentCategory] = useState<'fire' | 'vehicular' | 'medical' | 'rescue'>('medical');
  const [identSubcategory, setIdentSubcategory] = useState<string>('Severe Trauma / Heavy Bleeding');
  const [identSeverity, setIdentSeverity] = useState<IncidentSeverity>('high');
  const [identUnitId, setIdentUnitId] = useState<string>('unit-bfp-amb-01');
  const [isEditingIdent, setIsEditingIdent] = useState(false);
  const [enlargedPhoto, setEnlargedPhoto] = useState<string | null>(null);

  // Background Lock-Screen Notification states
  const [notificationPerm, setNotificationPerm] = useState(getNotificationPermissionStatus());
  const [drillCountdown, setDrillCountdown] = useState<number | null>(null);

  const handleEnableNotifications = async () => {
    const granted = await requestBackgroundAlarmPermission();
    setNotificationPerm(granted ? 'granted' : 'denied');
  };

  const handleRunDrill = async () => {
    let currentPerm = notificationPerm;
    if (currentPerm !== 'granted') {
      const granted = await requestBackgroundAlarmPermission();
      currentPerm = granted ? 'granted' : 'denied';
      setNotificationPerm(currentPerm);
    }
    setDrillCountdown(5);
    scheduleTestLockScreenAlarm(5);
    const timer = setInterval(() => {
      setDrillCountdown((prev) => {
        if (!prev || prev <= 1) {
          clearInterval(timer);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Current active report
  const currentReport =
    activePhotoReports.find((r) => r.id === selectedReportId) ||
    (activePhotoReports.length > 0 ? activePhotoReports[0] : null);

  // Selected history report
  const currentHistoryReport =
    resolvedReports.find((r) => r.id === selectedHistoryId) ||
    (resolvedReports.length > 0 ? resolvedReports[0] : null);

  const handleCategorySelect = (cat: 'fire' | 'vehicular' | 'medical' | 'rescue') => {
    setIdentCategory(cat);
    setIdentSubcategory(IDENT_OPTIONS[cat].subcategories[0]);
    if (cat === 'medical') {
      const bfpAmb = responderUnits.find((u) => u.id === 'unit-bfp-amb-01');
      setIdentUnitId(bfpAmb ? bfpAmb.id : 'unit-rescue-01');
    } else {
      setIdentUnitId(IDENT_OPTIONS[cat].defaultUnitId);
    }
  };

  const handleConfirmIdentification = () => {
    if (!currentReport) return;

    playRadioDispatchChime();

    const assignedUnit =
      responderUnits.find((u) => u.id === identUnitId) ||
      responderUnits.find((u) => u.type === 'ambulance') ||
      responderUnits[0];

    const categoryInfo = IDENT_OPTIONS[identCategory];
    const newTitle = `${categoryInfo.label}: ${identSubcategory}`;

    const adminName =
      currentUser?.fullName ||
      (currentUser?.username ? `${currentUser.username} (Dispatcher)` : 'Station Dispatcher');

    const updatedHistory = [
      ...currentReport.statusHistory,
      {
        status: 'dispatched' as IncidentStatus,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        note: `Identified as ${categoryInfo.label.toUpperCase()} (${identSubcategory}). Deployed: ${assignedUnit.name}.`,
        updatedBy: adminName,
      },
    ];

    const updated: IncidentReport = {
      ...currentReport,
      isIdentified: true,
      identifiedBy: adminName,
      identifiedAt: new Date().toISOString(),
      category: identCategory as IncidentCategory,
      subcategory: identSubcategory,
      title: newTitle,
      severity: identSeverity,
      assignedUnitId: assignedUnit.id,
      assignedUnitName: assignedUnit.name,
      status: 'dispatched',
      statusHistory: updatedHistory,
      updatedAt: new Date().toISOString(),
    };

    saveReport(updated);
    onUpdateReport(updated);
    setIsEditingIdent(false);

    addNotification({
      incidentId: updated.id,
      title: `DISPATCHED: ${updated.incidentNumber}`,
      body: `${assignedUnit.name} dispatched to Brgy. ${updated.location.barangay}!`,
      type: 'dispatch',
    });

    const smsMessage = `[MADRID EMERGENCY] Ref: ${updated.incidentNumber}. Station admin identified your report as ${identCategory.toUpperCase()} (${identSubcategory}). Unit ${assignedUnit.name} has been dispatched to ${updated.location.streetAddress || updated.location.barangay}.`;
    recordAdminSmsToCitizen(updated.reporterPhone, updated.reporterName, smsMessage);

    // AUTOMATIC ALARM TURN OFF ON ADMIN ACTION:
    // User requirement: "and when there is an action taken by the admin automatic the alarm will turn off."
    if (onStopAlarmByResponder) {
      onStopAlarmByResponder('Automatic Turn Off: Admin classified hazard & dispatched unit');
    } else {
      stopContinuousStationAlarm();
      stopAllAlarmSounds();
    }
  };

  const handleStatusChange = (newStatus: IncidentStatus, defaultNote?: string) => {
    if (!currentReport) return;

    playRadioDispatchChime();

    // AUTOMATIC ALARM TURN OFF ON ADMIN ACTION:
    // User requirement: "and when there is an action taken by the admin automatic the alarm will turn off."
    if (onStopAlarmByResponder) {
      onStopAlarmByResponder(`Automatic Turn Off: Admin updated status to ${newStatus}`);
    } else {
      stopContinuousStationAlarm();
      stopAllAlarmSounds();
    }

    const note = defaultNote || `Status updated to ${newStatus.replace('_', ' ')}`;
    const updatedHistory = [
      ...currentReport.statusHistory,
      {
        status: newStatus,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        note,
        updatedBy: currentUser?.fullName || 'Station Dispatcher',
      },
    ];

    const updated: IncidentReport = {
      ...currentReport,
      status: newStatus,
      statusHistory: updatedHistory,
      updatedAt: new Date().toISOString(),
    };

    saveReport(updated);
    onUpdateReport(updated);

    if (newStatus === 'resolved') {
      // It is resolved! Show confirmation that it moved to History tab
      setResolvedNotice(`Case ${updated.incidentNumber} is resolved and moved to the History tab.`);
      setTimeout(() => setResolvedNotice(null), 5000);

      // Select next remaining active report if available
      const remaining = activePhotoReports.filter((r) => r.id !== updated.id);
      setSelectedReportId(remaining.length > 0 ? remaining[0].id : null);
      setSelectedHistoryId(updated.id);
    }

    addNotification({
      incidentId: updated.id,
      title: newStatus === 'resolved' ? `RESOLVED: ${updated.incidentNumber}` : `UPDATE: ${updated.incidentNumber}`,
      body: `${note}`,
      type: newStatus === 'resolved' ? 'resolved' : 'status_change',
    });

    const smsMessage = `[MADRID EMERGENCY] Ref: ${updated.incidentNumber}. Status: ${newStatus.toUpperCase()}. ${note}.`;
    recordAdminSmsToCitizen(updated.reporterPhone, updated.reporterName, smsMessage);
  };

  // Reopen a resolved case from History (moves back to active Photos Reported)
  const handleReopenReport = (report: IncidentReport) => {
    playRadioDispatchChime();
    const updatedHistory = [
      ...report.statusHistory,
      {
        status: 'en_route' as IncidentStatus,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        note: 'Case reopened by station dispatcher.',
        updatedBy: currentUser?.fullName || 'Station Dispatcher',
      },
    ];

    const updated: IncidentReport = {
      ...report,
      status: 'en_route',
      statusHistory: updatedHistory,
      updatedAt: new Date().toISOString(),
    };

    saveReport(updated);
    onUpdateReport(updated);
    setSelectedReportId(updated.id);
    setActiveTab('photos');

    // AUTOMATIC ALARM TURN OFF ON ADMIN ACTION
    if (onStopAlarmByResponder) {
      onStopAlarmByResponder('Automatic Turn Off: Admin reopened report');
    } else {
      stopContinuousStationAlarm();
      stopAllAlarmSounds();
    }
  };

  const handleSendCustomSms = (e: React.FormEvent) => {
    e.preventDefault();
    if (!smsReplyText.trim() || !currentReport) return;

    recordAdminSmsToCitizen(currentReport.reporterPhone, currentReport.reporterName, smsReplyText.trim());
    setSmsReplyText('');
    setSmsSuccessNotice(`SMS sent to ${currentReport.reporterPhone}`);
    setTimeout(() => setSmsSuccessNotice(null), 3000);

    // AUTOMATIC ALARM TURN OFF ON ADMIN ACTION
    if (onStopAlarmByResponder) {
      onStopAlarmByResponder('Automatic Turn Off: Admin sent SMS to citizen');
    } else {
      stopContinuousStationAlarm();
      stopAllAlarmSounds();
    }
  };

  const isPhotoIdentPending = currentReport && (!currentReport.isIdentified || currentReport.category === 'unidentified');

  return (
    <div className="relative z-10 flex-1 flex flex-col h-full overflow-hidden bg-slate-950/75 backdrop-blur-[2px] text-slate-100">
      {/* ACTIVE CONTINUOUS STATION SIREN ALARM BAR - ONLY BFP OR MDRRMO CAN STOP */}
      {isAlarmActive && (
        <div className="bg-rose-700 border-b-2 border-amber-300 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 shadow-2xl animate-pulse z-20">
          <div className="flex items-center gap-2.5">
            <span className="text-xl animate-bounce">🚨</span>
            <div>
              <div className="text-xs sm:text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                <span>STATION SIREN ACTIVE (CONTINUOUS LOOP)</span>
                <span className="px-2 py-0.2 rounded-full text-[10px] bg-amber-400 text-slate-950 font-black">
                  MUST BE STOPPED BY BFP / MDRRMO
                </span>
              </div>
              <div className="text-[11px] text-rose-100">
                Loud emergency siren sounding at station. Click below to silence and log dispatch acknowledgement.
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Primary prominent button: TURN OFF Siren */}
            <button
              type="button"
              onClick={() => {
                if (onStopAlarmByResponder) {
                  onStopAlarmByResponder('TURN OFF Siren Button');
                } else {
                  stopContinuousStationAlarm();
                  stopAllAlarmSounds();
                }
              }}
              className="py-1.5 px-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg active:scale-95 transition ring-2 ring-amber-200"
              title="TURN OFF Siren and stop station alarm immediately"
            >
              <VolumeX className="w-4 h-4" />
              <span>TURN OFF Siren</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (onStopAlarmByResponder) {
                  onStopAlarmByResponder('BFP Madrid Station Commander');
                } else {
                  stopContinuousStationAlarm();
                  stopAllAlarmSounds();
                }
              }}
              className="py-1.5 px-3 rounded-xl bg-white text-rose-700 hover:bg-rose-100 font-bold text-xs flex items-center gap-1 shadow-lg active:scale-95 transition"
            >
              <span>🚒 Stop as BFP</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (onStopAlarmByResponder) {
                  onStopAlarmByResponder('MDRRMO Operations Chief');
                } else {
                  stopContinuousStationAlarm();
                  stopAllAlarmSounds();
                }
              }}
              className="py-1.5 px-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs flex items-center gap-1 shadow-lg active:scale-95 transition"
            >
              <span>🚑 Stop as MDRRMO</span>
            </button>
          </div>
        </div>
      )}

      {/* TEST CLOSED-APP DRILL COUNTDOWN BANNER */}
      {drillCountdown !== null && (
        <div className="bg-gradient-to-r from-amber-600 via-rose-600 to-amber-600 text-white px-4 py-2.5 text-xs sm:text-sm font-bold flex items-center justify-between shadow-2xl z-30 animate-pulse border-b border-amber-400">
          <div className="flex items-center gap-2.5">
            <Smartphone className="w-5 h-5 text-amber-200 animate-bounce shrink-0" />
            <div>
              <div className="flex items-center gap-2">
                <span>LOCK PHONE OR CLOSE/MINIMIZE THIS TAB NOW!</span>
                <span className="font-mono text-base font-black px-2 py-0.5 rounded bg-slate-950 text-amber-300">
                  {drillCountdown}s
                </span>
              </div>
              <div className="text-[11px] text-amber-100 font-normal">
                Verifying background notification, lock-screen vibration, and emergency alarm dispatch.
              </div>
            </div>
          </div>
          <span className="text-[10px] font-mono uppercase bg-slate-950/80 text-amber-300 px-2.5 py-1 rounded-full font-bold">
            Closed-App Alarm Drill
          </span>
        </div>
      )}

      {/* 3 TABS NAVIGATION: Photos Reported, Realtime Map, History */}
      <div className="bg-slate-900 border-b border-slate-800 px-3 sm:px-4 py-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* TAB 1: Current Active Photos */}
          <button
            onClick={() => setActiveTab('photos')}
            className={`px-3 sm:px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition ${
              activeTab === 'photos'
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-950/60'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>Photos Reported</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                activePhotoReports.length > 0 ? 'bg-white text-rose-600' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {activePhotoReports.length}
            </span>
            {activePhotoReports.some((r) => !r.isIdentified) && (
              <span className="w-2 h-2 rounded-full bg-fuchsia-400 animate-ping"></span>
            )}
          </button>

          {/* TAB 2: Realtime Map */}
          <button
            onClick={() => setActiveTab('map')}
            className={`px-3 sm:px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition ${
              activeTab === 'map'
                ? 'bg-sky-600 text-white shadow-lg shadow-sky-950/60'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Realtime Map</span>
          </button>

          {/* TAB 3: History (Resolved Cases) */}
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 sm:px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition ${
              activeTab === 'history'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/60'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <History className="w-4 h-4" />
            <span>History</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-slate-800 text-slate-300">
              {resolvedReports.length}
            </span>
          </button>

          {/* TAB 4: Edit App Details (Admin1 & Admin2) */}
          <button
            onClick={() => setActiveTab('app_details')}
            className={`px-3 sm:px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition ${
              activeTab === 'app_details'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-950/60'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>App Details</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Lock-Screen Alert Status & Test Drill */}
          {notificationPerm === 'granted' ? (
            <button
              type="button"
              onClick={handleRunDrill}
              className="py-1.5 px-2.5 rounded-xl bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-300 text-xs font-bold flex items-center gap-1.5 transition shadow"
              title="Lock-Screen Alarm is ACTIVE. Tap to test 5s closed-app drill."
            >
              <Bell className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden lg:inline">Closed-App Alarm:</span>
              <span className="text-[10px] bg-emerald-500 text-slate-950 px-1.5 py-0.2 rounded font-black">
                ACTIVE
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleEnableNotifications}
              className="py-1.5 px-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-1.5 transition shadow animate-pulse"
              title="Click to enable lock-screen alerts so alarms sound even when the app is closed!"
            >
              <Smartphone className="w-3.5 h-3.5 text-slate-950" />
              <span>Enable Closed-App Alerts</span>
            </button>
          )}

          {/* Always accessible TURN OFF Siren button in Admin header toolbar */}
          <button
            type="button"
            onClick={() => {
              if (onStopAlarmByResponder) {
                onStopAlarmByResponder('TURN OFF Siren Button');
              } else {
                stopContinuousStationAlarm();
                stopAllAlarmSounds();
              }
            }}
            className={`py-1.5 px-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition shadow active:scale-95 ${
              isAlarmActive
                ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 ring-2 ring-amber-300 animate-pulse'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
            title="TURN OFF Siren (Stops active emergency alarm)"
          >
            <VolumeX className="w-3.5 h-3.5" />
            <span>TURN OFF Siren</span>
          </button>

          <button
            type="button"
            onClick={() => playAlarmingStationSiren(6)}
            className="py-1.5 px-2.5 rounded-xl bg-rose-600/30 hover:bg-rose-600 text-rose-200 hover:text-white border border-rose-500/50 text-xs font-bold flex items-center gap-1.5 transition shadow"
            title="Sound BFP & MDRRMO Emergency Station Siren (Test)"
          >
            <Volume2 className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden md:inline">Test Siren</span>
          </button>

          <div className="flex items-center gap-2 text-xs text-slate-400 hidden sm:flex">
            <BfpMadridLogo size="xs" />
            <span>
              Dispatcher: <strong className="text-amber-400">{currentUser?.username || 'Admin'}</strong>
            </span>
            <span className="text-slate-600">&bull;</span>
            <span className="text-[11px] text-amber-300/80 font-medium">
              Build by <strong className="text-slate-200">FO1 Evangelio</strong> (Sep 23, 2026)
            </span>
          </div>
        </div>
      </div>

      {/* Resolved Success Alert Toast */}
      {resolvedNotice && (
        <div className="bg-emerald-900 border-b border-emerald-700 px-4 py-2 text-xs text-emerald-200 flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-300" />
            <span>{resolvedNotice}</span>
          </div>
          <button
            onClick={() => setActiveTab('history')}
            className="text-xs font-bold underline hover:text-white ml-3"
          >
            View in History &rarr;
          </button>
        </div>
      )}

      {/* TAB 1: CURRENT ACTIVE PHOTOS REPORTED ONLY */}
      {activeTab === 'photos' && (
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {activePhotoReports.length === 0 ? (
            /* Empty State: When all reported photos are resolved */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto space-y-4">
              <div className="w-20 h-20 rounded-3xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shadow-xl">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">All Reported Photos Resolved!</h3>
                <p className="text-xs text-slate-400 mt-1.5">
                  No active emergency photos are currently pending review. As new citizen photos are submitted, they will appear here automatically.
                </p>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => setActiveTab('history')}
                  className="py-2.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition shadow"
                >
                  <History className="w-4 h-4" />
                  <span>View Resolved Cases ({resolvedReports.length})</span>
                </button>
                <button
                  onClick={() => setActiveTab('map')}
                  className="py-2.5 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 border border-slate-700 transition"
                >
                  <MapPin className="w-4 h-4" />
                  <span>Realtime Map</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Left: Current Active Photos Queue */}
              <div className="w-full md:w-80 lg:w-96 border-r border-slate-800 overflow-y-auto p-3 space-y-2.5 bg-slate-950 shrink-0">
                <div className="text-[11px] font-bold uppercase text-slate-400 flex items-center justify-between px-1">
                  <span>Current Active Photos</span>
                  <span className="text-rose-400 font-semibold">
                    {activePhotoReports.filter((r) => !r.isIdentified).length} Pending Review
                  </span>
                </div>

                {activePhotoReports.map((report) => {
                  const isSelected = report.id === currentReport?.id;
                  const needsID = !report.isIdentified || report.category === 'unidentified';
                  const photoUrl = report.photos && report.photos.length > 0 ? report.photos[0].dataUrl : null;

                  return (
                    <div
                      key={report.id}
                      onClick={() => {
                        setSelectedReportId(report.id);
                        setIsEditingIdent(false);
                      }}
                      className={`p-3 rounded-2xl border transition cursor-pointer text-left ${
                        isSelected
                          ? 'border-rose-500 bg-rose-950/40 shadow-lg'
                          : 'border-slate-800 bg-slate-900/70 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-bold text-white flex items-center gap-1.5">
                          <Camera className="w-3.5 h-3.5 text-rose-400" />
                          <span>{report.incidentNumber}</span>
                        </span>

                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                            needsID
                              ? 'bg-fuchsia-950 text-fuchsia-300 border border-fuchsia-700 animate-pulse'
                              : 'bg-amber-950 text-amber-300'
                          }`}
                        >
                          {needsID ? 'NEEDS ID' : report.status.replace('_', ' ')}
                        </span>
                      </div>

                      {photoUrl && (
                        <img
                          src={photoUrl}
                          alt="Incident Thumbnail"
                          className="w-full h-24 object-cover rounded-xl border border-slate-800 mb-1.5"
                        />
                      )}

                      <div className="text-xs font-bold text-white line-clamp-1">
                        {report.location.streetAddress || `Brgy. ${report.location.barangay}`}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {report.reporterName} &bull; {report.reporterPhone}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Right: Selected Active Photo Details & Dispatch Stepper */}
              {currentReport ? (
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 max-w-4xl mx-auto w-full">
                  {/* Photo Card */}
                  <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base text-white">
                          {currentReport.incidentNumber}
                        </span>
                        {isPhotoIdentPending ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-fuchsia-950 text-fuchsia-300 border border-fuchsia-700 animate-pulse">
                            Awaiting Identification
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-700">
                            Identified: {currentReport.category.toUpperCase()}
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => setActiveTab('map')}
                        className="py-1.5 px-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1 transition"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        <span>View on Map</span>
                      </button>
                    </div>

                    {/* Large Photo Display */}
                    {currentReport.photos && currentReport.photos.length > 0 && (
                      <div className="relative rounded-2xl overflow-hidden border border-slate-700 bg-slate-950">
                        <img
                          src={currentReport.photos[0].dataUrl}
                          alt="Incident Photo"
                          className="w-full h-72 sm:h-80 object-contain bg-slate-950"
                        />
                        <button
                          type="button"
                          onClick={() => setEnlargedPhoto(currentReport.photos[0].dataUrl)}
                          className="absolute top-2 right-2 p-2 rounded-xl bg-slate-950/80 hover:bg-slate-900 text-slate-200 border border-slate-700 text-xs flex items-center gap-1"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                          <span>Enlarge</span>
                        </button>
                      </div>
                    )}

                    {/* Auto Identified Address */}
                    <div className="p-3.5 rounded-2xl bg-slate-950 border border-emerald-500/40 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase text-emerald-400">
                          Reporter's Automatically Identified Address
                        </div>
                        <div className="text-sm font-bold text-white mt-0.5">
                          {currentReport.location.streetAddress || `Brgy. ${currentReport.location.barangay}, Madrid, Surigao del Sur`}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          Reporter: {currentReport.reporterName} ({currentReport.reporterPhone})
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* IDENTIFY & DISPATCH UNIT */}
                  {(isPhotoIdentPending || isEditingIdent) ? (
                    <div className="bg-slate-900 border-2 border-fuchsia-600/70 p-5 rounded-3xl space-y-4 shadow-xl">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AlertOctagon className="w-5 h-5 text-fuchsia-400" />
                          <h4 className="font-bold text-white text-sm sm:text-base">
                            Identify Incident &amp; Dispatch Unit
                          </h4>
                        </div>
                        {currentReport.isIdentified && (
                          <button
                            onClick={() => setIsEditingIdent(false)}
                            className="text-xs text-slate-400 hover:text-white"
                          >
                            Cancel
                          </button>
                        )}
                      </div>

                      {/* 1. Category Selection */}
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1.5">
                          1. Emergency Category
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {(['fire', 'vehicular', 'medical', 'rescue'] as const).map((cat) => {
                            const opt = IDENT_OPTIONS[cat];
                            const isSelected = identCategory === cat;
                            return (
                              <button
                                key={cat}
                                type="button"
                                onClick={() => handleCategorySelect(cat)}
                                className={`p-3 rounded-2xl border text-center transition ${
                                  isSelected
                                    ? 'bg-rose-600 border-white text-white font-bold shadow-lg'
                                    : 'bg-slate-950 border-slate-700 text-slate-300 hover:bg-slate-800'
                                }`}
                              >
                                <div className="text-2xl mb-1">{opt.icon}</div>
                                <div className="text-xs font-semibold">{opt.label}</div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* 2. Subcategory chips */}
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1.5">
                          2. Subclassification
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {IDENT_OPTIONS[identCategory].subcategories.map((sub) => (
                            <button
                              key={sub}
                              type="button"
                              onClick={() => setIdentSubcategory(sub)}
                              className={`px-3 py-1.5 rounded-xl text-xs transition ${
                                identSubcategory === sub
                                  ? 'bg-amber-500 text-slate-950 font-bold'
                                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                              }`}
                            >
                              {sub}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 3. Responder Unit Selection - Both BFP & MDRRMO Ambulances */}
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1.5">
                          3. Select Unit to Deploy (Ambulances available from both BFP &amp; MDRRMO)
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {responderUnits.map((u) => {
                            const isSelected = identUnitId === u.id;
                            const isBfp = u.stationName.toLowerCase().includes('bfp');
                            const isAmbulance = u.type === 'ambulance';

                            return (
                              <button
                                key={u.id}
                                type="button"
                                onClick={() => setIdentUnitId(u.id)}
                                className={`p-3 rounded-2xl border text-left transition flex items-start gap-2.5 ${
                                  isSelected
                                    ? 'bg-emerald-950/80 border-emerald-500 text-white shadow-lg'
                                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                                }`}
                              >
                                <span className="text-lg mt-0.5">
                                  {isAmbulance ? '🚑' : u.type === 'fire_engine' ? '🚒' : '🚓'}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <div className="font-bold text-xs truncate text-white">{u.name}</div>
                                  <div className="text-[11px] text-slate-400 mt-0.5">
                                    <span className={isBfp ? 'text-rose-400 font-bold' : 'text-sky-400 font-bold'}>
                                      {isBfp ? 'BFP Station' : 'MDRRMO Post'}
                                    </span>
                                    {' '}&bull; {u.callSign}
                                  </div>
                                </div>
                                {isSelected && <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-1" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Confirm & Dispatch Button */}
                      <button
                        type="button"
                        onClick={handleConfirmIdentification}
                        className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm uppercase tracking-wider transition shadow-xl flex items-center justify-center gap-2 active:scale-95"
                      >
                        <CheckCircle2 className="w-5 h-5" />
                        <span>
                          Dispatch {responderUnits.find((u) => u.id === identUnitId)?.name || 'Responder Unit'}
                        </span>
                      </button>
                    </div>
                  ) : (
                    /* Already Identified Banner */
                    <div className="bg-slate-900 border border-emerald-500 p-4 rounded-3xl flex items-center justify-between">
                      <div>
                        <div className="text-xs text-slate-400">Identified Incident:</div>
                        <div className="text-sm font-bold text-white">
                          {currentReport.category.toUpperCase()} &bull; {currentReport.subcategory}
                        </div>
                        <div className="text-xs text-emerald-400 font-semibold mt-0.5">
                          Assigned: {currentReport.assignedUnitName || 'BFP Madrid EMS Ambulance Alpha'}
                        </div>
                      </div>
                      <button
                        onClick={() => setIsEditingIdent(true)}
                        className="py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200"
                      >
                        Change
                      </button>
                    </div>
                  )}

                  {/* Status Stepper - Marking Resolved deletes from this tab and moves to History! */}
                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold uppercase text-slate-400">
                        Update Response Status
                      </div>
                      <span className="text-[11px] text-emerald-400">
                        Clicking 'Resolve' archives to History
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <button
                        onClick={() => handleStatusChange('dispatched', 'Responders rolling out')}
                        className={`py-2.5 px-3 rounded-xl text-white font-bold text-xs transition ${
                          currentReport.status === 'dispatched' ? 'bg-rose-500 ring-2 ring-white' : 'bg-rose-600 hover:bg-rose-500'
                        }`}
                      >
                        Dispatched
                      </button>
                      <button
                        onClick={() => handleStatusChange('en_route', 'Unit is traveling to location')}
                        className={`py-2.5 px-3 rounded-xl text-white font-bold text-xs transition ${
                          currentReport.status === 'en_route' ? 'bg-amber-500 ring-2 ring-white' : 'bg-amber-600 hover:bg-amber-500'
                        }`}
                      >
                        En Route
                      </button>
                      <button
                        onClick={() => handleStatusChange('on_scene', 'Responders arrived on scene')}
                        className={`py-2.5 px-3 rounded-xl text-white font-bold text-xs transition ${
                          currentReport.status === 'on_scene' ? 'bg-indigo-500 ring-2 ring-white' : 'bg-indigo-600 hover:bg-indigo-500'
                        }`}
                      >
                        On Scene
                      </button>
                      <button
                        onClick={() => handleStatusChange('resolved', 'Incident operations completed & safe')}
                        className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition flex items-center justify-center gap-1 shadow-lg active:scale-95"
                        title="Mark case resolved and move to History"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>✓ Resolve Case</span>
                      </button>
                    </div>
                  </div>

                  {/* Quick SMS Text to Citizen */}
                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl space-y-2">
                    <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <MessageSquare className="w-4 h-4 text-sky-400" />
                      <span>Send SMS to Citizen ({currentReport.reporterPhone})</span>
                    </div>
                    {smsSuccessNotice && (
                      <div className="p-2 rounded-xl bg-emerald-950 border border-emerald-800 text-xs text-emerald-300">
                        {smsSuccessNotice}
                      </div>
                    )}
                    <form onSubmit={handleSendCustomSms} className="flex gap-2">
                      <input
                        type="text"
                        placeholder="e.g. BFP Ambulance is turning into your street now."
                        value={smsReplyText}
                        onChange={(e) => setSmsReplyText(e.target.value)}
                        className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                      />
                      <button
                        type="submit"
                        className="py-2 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition"
                      >
                        Send SMS
                      </button>
                    </form>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      )}

      {/* TAB 2: REALTIME MAP */}
      {activeTab === 'map' && (
        <div className="flex-1 relative w-full h-full overflow-hidden">
          <LeafletEmergencyMap
            reports={reports}
            userCoords={userCoords}
            selectedReportId={currentReport?.id || (reports.length > 0 ? reports[0].id : null)}
            onSelectReport={(report) => {
              setSelectedReportId(report.id);
              if (onSelectIncidentOnMap) onSelectIncidentOnMap(report);
            }}
            responderUnits={responderUnits}
            isNightMode={true}
          />
        </div>
      )}

      {/* TAB 3: HISTORY (RESOLVED CASES) */}
      {activeTab === 'history' && (
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {resolvedReports.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center">
                <Inbox className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-white">No Resolved Cases in History Yet</h3>
              <p className="text-xs text-slate-400">
                When you click "Resolve Case" on any active reported photo, it will automatically be moved into this History tab.
              </p>
            </div>
          ) : (
            <>
              {/* Left: Resolved Incidents List */}
              <div className="w-full md:w-80 lg:w-96 border-r border-slate-800 overflow-y-auto p-3 space-y-2 bg-slate-950 shrink-0">
                <div className="text-[11px] font-bold uppercase text-slate-400 flex items-center justify-between px-1">
                  <span>Resolved Archive ({resolvedReports.length})</span>
                  <span className="text-emerald-400 font-semibold">Completed</span>
                </div>

                {resolvedReports.map((report) => {
                  const isSelected = report.id === currentHistoryReport?.id;
                  const photoUrl = report.photos && report.photos.length > 0 ? report.photos[0].dataUrl : null;

                  return (
                    <div
                      key={report.id}
                      onClick={() => setSelectedHistoryId(report.id)}
                      className={`p-3 rounded-2xl border transition cursor-pointer text-left ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-950/40 shadow-lg'
                          : 'border-slate-800 bg-slate-900/70 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-bold text-white flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{report.incidentNumber}</span>
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-emerald-950 text-emerald-300 border border-emerald-800">
                          RESOLVED
                        </span>
                      </div>

                      {photoUrl && (
                        <img
                          src={photoUrl}
                          alt="Resolved incident thumbnail"
                          className="w-full h-20 object-cover rounded-xl border border-slate-800 mb-1.5 opacity-80"
                        />
                      )}

                      <div className="text-xs font-bold text-white line-clamp-1">
                        {report.title}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {report.location.streetAddress || `Brgy. ${report.location.barangay}`}
                      </div>
                      {report.assignedUnitName && (
                        <div className="text-[11px] text-emerald-400 font-medium mt-1">
                          ✓ Responded by {report.assignedUnitName}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Right: Resolved Case Details */}
              {currentHistoryReport && (
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 max-w-4xl mx-auto w-full">
                  <div className="bg-slate-900 border border-emerald-500/50 rounded-3xl p-5 shadow-xl space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                        <div>
                          <h3 className="text-base font-bold text-white">
                            {currentHistoryReport.incidentNumber} &bull; Case Resolved
                          </h3>
                          <div className="text-xs text-slate-400">
                            {currentHistoryReport.title}
                          </div>
                        </div>
                      </div>

                      {/* Reopen Button */}
                      <button
                        type="button"
                        onClick={() => handleReopenReport(currentHistoryReport)}
                        className="py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition"
                        title="Move back to active photos"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                        <span>Reopen Case</span>
                      </button>
                    </div>

                    {/* Photo */}
                    {currentHistoryReport.photos && currentHistoryReport.photos.length > 0 && (
                      <div className="relative rounded-2xl overflow-hidden border border-slate-700 bg-slate-950">
                        <img
                          src={currentHistoryReport.photos[0].dataUrl}
                          alt="Resolved Incident Photo"
                          className="w-full h-64 sm:h-72 object-contain bg-slate-950"
                        />
                        <button
                          type="button"
                          onClick={() => setEnlargedPhoto(currentHistoryReport.photos[0].dataUrl)}
                          className="absolute top-2 right-2 p-2 rounded-xl bg-slate-950/80 hover:bg-slate-900 text-slate-200 border border-slate-700 text-xs flex items-center gap-1"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                          <span>Enlarge</span>
                        </button>
                      </div>
                    )}

                    {/* Metadata Card */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                        <div className="text-slate-400 text-[11px]">Location:</div>
                        <div className="font-bold text-white mt-0.5">
                          {currentHistoryReport.location.streetAddress || `Brgy. ${currentHistoryReport.location.barangay}`}
                        </div>
                        <div className="text-slate-400 mt-1">
                          Reporter: {currentHistoryReport.reporterName} ({currentHistoryReport.reporterPhone})
                        </div>
                      </div>

                      <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                        <div className="text-slate-400 text-[11px]">Response Unit:</div>
                        <div className="font-bold text-emerald-400 mt-0.5">
                          {currentHistoryReport.assignedUnitName || 'BFP Madrid EMS Ambulance Alpha'}
                        </div>
                        <div className="text-slate-400 mt-1">
                          Identified as: {currentHistoryReport.category.toUpperCase()} ({currentHistoryReport.subcategory})
                        </div>
                      </div>
                    </div>

                    {/* Timeline Log */}
                    <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                      <div className="text-[11px] font-bold uppercase text-slate-400">
                        Resolution Timeline Log
                      </div>
                      <div className="space-y-1.5 text-xs">
                        {currentHistoryReport.statusHistory.map((h, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-slate-300">
                            <span className="font-mono text-slate-500 shrink-0">{h.timestamp}</span>
                            <span className="text-emerald-400 font-bold uppercase text-[10px] shrink-0">
                              [{h.status}]
                            </span>
                            <span>{h.note}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* TAB 4 BODY: APP DETAILS EDITOR */}
      {activeTab === 'app_details' && (
        <AppDetailsEditor currentUser={currentUser} />
      )}

      {/* Full Photo Modal */}
      {enlargedPhoto && (
        <div
          onClick={() => setEnlargedPhoto(null)}
          className="fixed inset-0 z-[700] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden p-2 shadow-2xl">
            <img
              src={enlargedPhoto}
              alt="Enlarged incident"
              className="max-h-[85vh] w-auto object-contain rounded-2xl mx-auto"
            />
          </div>
        </div>
      )}
    </div>
  );
}
