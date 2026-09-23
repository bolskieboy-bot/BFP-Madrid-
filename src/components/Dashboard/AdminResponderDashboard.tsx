import { useState } from 'react';
import {
  X,
  Radio,
  Flame,
  Car,
  HeartPulse,
  Navigation,
  CheckCircle2,
  AlertTriangle,
  MessageSquare,
  Send,
  Truck,
  PhoneCall,
  Volume2,
  Clock,
  Shield,
  Layers,
  Camera,
  Check,
  Eye,
  AlertOctagon,
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
import { recordAdminSmsToCitizen, getStoredSmsLogs, SmsLogEntry } from '../../services/smsService';
import { playEmergencySiren, playRadioDispatchChime } from '../../services/audioService';
import { SEEDED_ACCOUNTS } from '../../services/accountService';

interface AdminResponderDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  reports: IncidentReport[];
  onUpdateReport: (report: IncidentReport) => void;
  responderUnits: ResponderUnit[];
  onSelectIncidentOnMap: (report: IncidentReport) => void;
  currentUser: UserProfile | null;
  onSwitchAccount?: (user: UserProfile) => void;
}

const IDENT_OPTIONS: Record<
  'fire' | 'vehicular' | 'medical' | 'rescue',
  { label: string; icon: string; subcategories: string[]; defaultUnitId: string }
> = {
  fire: {
    label: 'Fire Incident',
    icon: '🔥',
    subcategories: [
      'Residential Structure Fire',
      'Commercial / Public Market Fire',
      'Grass / Forest Brush Fire',
      'Electrical Post / Transformer Spark',
      'LPG / Gas Tank Explosion',
    ],
    defaultUnitId: 'unit-bfp-engine-1',
  },
  vehicular: {
    label: 'Vehicular Accident',
    icon: '🚗',
    subcategories: [
      'Highway Motorcycle Crash',
      'Multi-Vehicle Collision',
      'Tricycle / PUV Collision',
      'Pedestrian Struck on Road',
      'Vehicle Rollover / Cliff Fall',
    ],
    defaultUnitId: 'unit-mdrrmo-rescue-1',
  },
  medical: {
    label: 'Medical Emergency',
    icon: '🚑',
    subcategories: [
      'Severe Trauma / Heavy Bleeding',
      'Cardiac Arrest / Chest Pain',
      'Maternal Emergency / Childbirth',
      'Stroke / Loss of Consciousness',
      'Acute Respiratory Distress',
    ],
    defaultUnitId: 'unit-mdrrmo-amb-1',
  },
  rescue: {
    label: 'Rescue / Disaster',
    icon: '🛡️',
    subcategories: [
      'Flash Flood / Rising River Water',
      'Fallen Tree / Road Obstruction',
      'Landslide / Soil Erosion',
      'Structural Collapse',
    ],
    defaultUnitId: 'unit-mdrrmo-rescue-1',
  },
};

export default function AdminResponderDashboard({
  isOpen,
  onClose,
  reports,
  onUpdateReport,
  responderUnits,
  onSelectIncidentOnMap,
  currentUser,
  onSwitchAccount,
}: AdminResponderDashboardProps) {
  const [selectedReportId, setSelectedReportId] = useState<string | null>(
    reports.length > 0 ? reports[0].id : null
  );
  const [smsReplyText, setSmsReplyText] = useState('');
  const [activeTab, setActiveTab] = useState<'queue' | 'sms_logs'>('queue');
  const [smsLogs, setSmsLogs] = useState<SmsLogEntry[]>(getStoredSmsLogs());

  // Admin Photo Identification States
  const [identCategory, setIdentCategory] = useState<'fire' | 'vehicular' | 'medical' | 'rescue'>('fire');
  const [identSubcategory, setIdentSubcategory] = useState<string>('Residential Structure Fire');
  const [identSeverity, setIdentSeverity] = useState<IncidentSeverity>('high');
  const [identUnitId, setIdentUnitId] = useState<string>('unit-bfp-engine-1');
  const [isEditingIdent, setIsEditingIdent] = useState(false);

  if (!isOpen) return null;

  const currentReport = reports.find((r) => r.id === selectedReportId) || reports[0];

  const handleCategorySelect = (cat: 'fire' | 'vehicular' | 'medical' | 'rescue') => {
    setIdentCategory(cat);
    setIdentSubcategory(IDENT_OPTIONS[cat].subcategories[0]);
    setIdentUnitId(IDENT_OPTIONS[cat].defaultUnitId);
  };

  // Admin identifies the citizen photo report
  const handleConfirmIdentification = () => {
    if (!currentReport) return;

    playRadioDispatchChime();

    const assignedUnit = responderUnits.find((u) => u.id === identUnitId) || responderUnits[0];
    const categoryInfo = IDENT_OPTIONS[identCategory];
    const newTitle = `${categoryInfo.label}: ${identSubcategory}`;

    const adminName = currentUser?.fullName || 'BFP Station Commander (Admin1)';
    const updatedHistory = [
      ...currentReport.statusHistory,
      {
        status: 'dispatched' as IncidentStatus,
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        note: `Photo identified as ${categoryInfo.label.toUpperCase()} (${identSubcategory}) by Dispatcher ${adminName}. Fleet ${assignedUnit.name} dispatched.`,
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

    // Push notification to user
    addNotification({
      incidentId: updated.id,
      title: `🚨 IDENTIFIED & DISPATCHED: ${updated.incidentNumber}`,
      body: `BFP/MDRRMO identified your photo as ${categoryInfo.label}. ${assignedUnit.name} is on the way!`,
      type: 'dispatch',
    });

    // SMS dispatch to reporter
    const smsMessage = `[MADRID EMERGENCY DISPATCH] Ref: ${updated.incidentNumber}. Station admin identified your incident photo as ${identCategory.toUpperCase()} (${identSubcategory}). Unit ${assignedUnit.name} has been dispatched to Brgy. ${updated.location.barangay}.`;
    recordAdminSmsToCitizen(updated.reporterPhone, updated.reporterName, smsMessage);
    setSmsLogs(getStoredSmsLogs());
  };

  const handleStatusChange = (newStatus: IncidentStatus, defaultNote?: string) => {
    if (!currentReport) return;

    playRadioDispatchChime();

    const note = defaultNote || `Status updated to ${newStatus.replace('_', ' ')} by Station Dispatch`;
    const updatedHistory = [
      ...currentReport.statusHistory,
      {
        status: newStatus,
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        note,
        updatedBy: currentUser?.fullName || 'BFP Station Commander',
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

    // Send push notification to user
    addNotification({
      incidentId: updated.id,
      title: `UPDATE: ${updated.incidentNumber}`,
      body: `${updated.title}: ${note}`,
      type: newStatus === 'resolved' ? 'resolved' : 'status_change',
    });

    // Auto-dispatch SMS text to the reporter's phone
    const smsMessage = `[MADRID EMERGENCY DISPATCH] Ref: ${updated.incidentNumber}. Status: ${newStatus.toUpperCase()}. ${note}. Madrid BFP/MDRRMO Response Team.`;
    recordAdminSmsToCitizen(updated.reporterPhone, updated.reporterName, smsMessage);
    setSmsLogs(getStoredSmsLogs());
  };

  const handleSendCustomSms = (e: React.FormEvent) => {
    e.preventDefault();
    if (!smsReplyText.trim() || !currentReport) return;

    recordAdminSmsToCitizen(currentReport.reporterPhone, currentReport.reporterName, smsReplyText.trim());
    setSmsLogs(getStoredSmsLogs());
    setSmsReplyText('');
    alert(`SMS text dispatched to reporter (${currentReport.reporterPhone})!`);
  };

  const isPhotoIdentPending = currentReport && (!currentReport.isIdentified || currentReport.category === 'unidentified');

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md">
      <div className="relative w-full max-w-5xl h-[92vh] bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl flex flex-col text-slate-100 overflow-hidden">
        {/* Header */}
        <div className="bg-slate-950/90 border-b border-slate-800 px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-600/20 border border-amber-500/40 flex items-center justify-center text-amber-500">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white uppercase">
                  BFP Madrid &amp; MDRRMO Dispatch Console
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-600 text-white animate-pulse">
                  LIVE DISPATCH
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Madrid, Surigao del Sur &bull; Emergency Response Station Operations
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => playEmergencySiren(3)}
              className="py-1.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg transition"
            >
              <Volume2 className="w-4 h-4" />
              <span className="hidden sm:inline">Station Siren</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white bg-slate-800 p-2 rounded-full transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab switch: Queue vs SMS Dispatch Logs & Active Admin Selector */}
        <div className="bg-slate-900/60 px-5 py-2 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('queue')}
              className={`pb-1 border-b-2 transition ${
                activeTab === 'queue'
                  ? 'border-rose-500 text-rose-400 font-black'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              🚨 Live Incident Queue ({reports.filter((r) => r.status !== 'resolved').length} Active)
            </button>
            <button
              onClick={() => setActiveTab('sms_logs')}
              className={`pb-1 border-b-2 transition ${
                activeTab === 'sms_logs'
                  ? 'border-amber-500 text-amber-400 font-black'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              📱 SMS Gateway Log ({smsLogs.length} Texts Sent)
            </button>
          </div>

          {/* Active Admin Indicator & Switcher */}
          <div className="flex items-center gap-1.5 text-[11px] bg-slate-950/80 px-2.5 py-1 rounded-xl border border-slate-800">
            <span className="text-slate-400">Dispatcher on Duty:</span>
            <span className="font-bold text-amber-400 font-mono">
              {currentUser?.username || (currentUser?.role === 'admin_dispatcher' ? 'Admin Officer' : 'Civilian')}
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-[10px] text-slate-400">Switch:</span>
            <button
              onClick={() => {
                const admin1 = SEEDED_ACCOUNTS.find((a) => a.username === 'Admin1')?.profile;
                if (admin1 && onSwitchAccount) onSwitchAccount(admin1);
              }}
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                currentUser?.username === 'Admin1'
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-800 text-amber-300 hover:bg-slate-700'
              }`}
              title="Admin1 - BFP Fire Commander"
            >
              Admin1
            </button>
            <button
              onClick={() => {
                const admin2 = SEEDED_ACCOUNTS.find((a) => a.username === 'Admin2')?.profile;
                if (admin2 && onSwitchAccount) onSwitchAccount(admin2);
              }}
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                currentUser?.username === 'Admin2'
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-800 text-amber-300 hover:bg-slate-700'
              }`}
              title="Admin2 - MDRRMO Chief"
            >
              Admin2
            </button>
          </div>
        </div>

        {/* Main Console Content */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {activeTab === 'queue' ? (
            <>
              {/* Left Column: Reports List */}
              <div className="w-full md:w-80 border-r border-slate-800 overflow-y-auto p-3 sm:p-4 space-y-2.5 bg-slate-950/40 shrink-0">
                <div className="text-[11px] font-bold uppercase text-slate-400 mb-2 flex items-center justify-between">
                  <span>Incident Queue</span>
                  <span className="text-[10px] text-slate-500 font-mono">{reports.length} Total</span>
                </div>

                {reports.map((report) => {
                  const isSelected = report.id === currentReport?.id;
                  const needsIdent = !report.isIdentified || report.category === 'unidentified';
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
                          : 'border-slate-800/80 bg-slate-900/50 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-mono font-bold text-slate-300 flex items-center gap-1">
                          {needsIdent ? '📸' : report.category === 'fire' ? '🔥' : report.category === 'vehicular' ? '🚗' : '🚑'}
                          {report.incidentNumber}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                            needsIdent
                              ? 'bg-fuchsia-950 text-fuchsia-400 border border-fuchsia-800 animate-pulse'
                              : report.status === 'resolved'
                              ? 'bg-emerald-950 text-emerald-400'
                              : report.status === 'en_route'
                              ? 'bg-amber-950 text-amber-400'
                              : 'bg-rose-950 text-rose-400'
                          }`}
                        >
                          {needsIdent ? 'NEEDS ID' : report.status.replace('_', ' ')}
                        </span>
                      </div>

                      <div className="text-xs font-bold text-white line-clamp-1">{report.title}</div>
                      <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                        <span>Brgy. {report.location.barangay}</span>
                        <span className="font-mono text-[10px]">
                          {new Date(report.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Right Column: Active Incident Dispatch Details & Operations */}
              {currentReport ? (
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
                  {/* Top Bar with Map Routing button */}
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-rose-400 text-sm">
                          {currentReport.incidentNumber}
                        </span>
                        <span className="text-xs text-slate-400 font-semibold">
                          &bull; Brgy. {currentReport.location.barangay}, Madrid
                        </span>
                        {isPhotoIdentPending ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-fuchsia-950 text-fuchsia-300 border border-fuchsia-700 animate-pulse">
                            📸 Awaiting Admin Identification
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-950 text-emerald-300 border border-emerald-700 flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            <span>Identified: {currentReport.category.toUpperCase()}</span>
                          </span>
                        )}
                      </div>
                      <h3 className="text-base sm:text-lg font-black text-white mt-1">
                        {currentReport.title}
                      </h3>
                    </div>

                    <button
                      onClick={() => {
                        onSelectIncidentOnMap(currentReport);
                        onClose();
                      }}
                      className="py-2 px-3.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg transition"
                    >
                      <Navigation className="w-4 h-4" />
                      <span>View on GPS Map</span>
                    </button>
                  </div>

                  {/* CITIZEN EMERGENCY PHOTO SECTION */}
                  {currentReport.photos && currentReport.photos.length > 0 && (
                    <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Camera className="w-4 h-4 text-rose-400" />
                          <span className="text-xs font-bold uppercase text-white tracking-wide">
                            Citizen Incident Photo
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono">
                          Captured at {currentReport.photos[0].timestamp}
                        </span>
                      </div>

                      <div className="relative rounded-xl overflow-hidden border border-slate-700/80 max-h-72 bg-slate-950 flex items-center justify-center">
                        <img
                          src={currentReport.photos[0].dataUrl}
                          alt="Citizen incident"
                          className="w-full h-auto max-h-72 object-contain"
                        />
                        <div className="absolute top-2 left-2 px-2 py-1 rounded bg-slate-950/80 text-[10px] font-mono text-slate-300 border border-slate-800">
                          Reporter: {currentReport.reporterName} ({currentReport.reporterPhone})
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ADMIN PHOTO IDENTIFICATION WORKFLOW */}
                  {(isPhotoIdentPending || isEditingIdent) ? (
                    <div className="bg-gradient-to-br from-fuchsia-950/40 via-slate-900 to-rose-950/30 p-5 rounded-2xl border-2 border-fuchsia-600/80 shadow-2xl space-y-4 animate-in fade-in">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <AlertOctagon className="w-5 h-5 text-fuchsia-400 animate-pulse" />
                            <h4 className="text-sm sm:text-base font-black uppercase text-white tracking-tight">
                              Admin Action: Identify Citizen Emergency Photo
                            </h4>
                          </div>
                          <p className="text-xs text-slate-300 mt-1">
                            The citizen sent this photo. As Dispatcher (
                            <span className="text-amber-400 font-bold">{currentUser?.username || 'Admin1'}</span>
                            ), classify the hazard and roll out the required response fleet:
                          </p>
                        </div>

                        {currentReport.isIdentified && (
                          <button
                            onClick={() => setIsEditingIdent(false)}
                            className="text-xs text-slate-400 hover:text-white"
                          >
                            Cancel Edit
                          </button>
                        )}
                      </div>

                      {/* Step 1: Emergency Hazard Category */}
                      <div>
                        <label className="block text-[11px] font-bold uppercase text-slate-300 mb-1.5">
                          1. Select Hazard Category
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {(['fire', 'vehicular', 'medical', 'rescue'] as const).map((cat) => {
                            const info = IDENT_OPTIONS[cat];
                            const isSelected = identCategory === cat;
                            return (
                              <button
                                key={cat}
                                type="button"
                                onClick={() => handleCategorySelect(cat)}
                                className={`p-3 rounded-xl border text-left transition flex flex-col items-center justify-center text-center ${
                                  isSelected
                                    ? 'bg-rose-600 border-white text-white shadow-lg font-black'
                                    : 'bg-slate-950/70 border-slate-700 text-slate-300 hover:bg-slate-800'
                                }`}
                              >
                                <span className="text-xl mb-1">{info.icon}</span>
                                <span className="text-xs font-bold leading-tight">{info.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Step 2: Subcategory Classification */}
                      <div>
                        <label className="block text-[11px] font-bold uppercase text-slate-300 mb-1.5">
                          2. Specific Incident Classification
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {IDENT_OPTIONS[identCategory].subcategories.map((sub) => (
                            <button
                              key={sub}
                              type="button"
                              onClick={() => setIdentSubcategory(sub)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                                identSubcategory === sub
                                  ? 'bg-amber-500 text-slate-950 font-bold shadow'
                                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                              }`}
                            >
                              {sub}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Step 3: Severity & Responder Unit Assignment */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800">
                        <div>
                          <label className="block text-[11px] font-bold uppercase text-slate-300 mb-1">
                            3. Severity Level
                          </label>
                          <select
                            value={identSeverity}
                            onChange={(e) => setIdentSeverity(e.target.value as IncidentSeverity)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                          >
                            <option value="critical">🚨 Critical (Threat to Life)</option>
                            <option value="high">⚠️ High (Active Hazard / Structure at Risk)</option>
                            <option value="moderate">⚡ Moderate (Contained / Non-Life-Threatening)</option>
                            <option value="low">ℹ️ Low (Minor Incident / Inspection)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold uppercase text-slate-300 mb-1">
                            4. Roll Out Responder Fleet
                          </label>
                          <select
                            value={identUnitId}
                            onChange={(e) => setIdentUnitId(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500 font-mono"
                          >
                            {responderUnits.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.name} &bull; {u.callSign} ({u.type.toUpperCase()})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Confirm Identification Button */}
                      <button
                        type="button"
                        onClick={handleConfirmIdentification}
                        className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs uppercase tracking-wider transition shadow-xl flex items-center justify-center gap-2 border border-white/20"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Confirm Identification &amp; Dispatch {responderUnits.find(u => u.id === identUnitId)?.name || 'Fleet'}</span>
                      </button>
                    </div>
                  ) : (
                    /* Already Identified Banner with Edit Option */
                    <div className="bg-emerald-950/40 p-4 rounded-2xl border border-emerald-800 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-emerald-600/30 border border-emerald-500 flex items-center justify-center text-emerald-400">
                          <Check className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-bold text-white flex items-center gap-1.5">
                            <span>Identified as:</span>
                            <span className="text-emerald-400 font-black uppercase">
                              {currentReport.category} &bull; {currentReport.subcategory}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Verified by {currentReport.identifiedBy || 'Station Admin'} &bull; Severity: {currentReport.severity.toUpperCase()}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => setIsEditingIdent(true)}
                        className="py-1 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] font-bold"
                      >
                        Re-Classify Photo
                      </button>
                    </div>
                  )}

                  {/* Dispatch Workflow Actions Buttons */}
                  <div>
                    <div className="text-xs font-bold uppercase text-slate-400 mb-2">
                      Dispatcher Command Actions &amp; Status Progression
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <button
                        onClick={() => handleStatusChange('acknowledged', 'BFP Madrid officer acknowledged distress call')}
                        className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition"
                      >
                        1. Acknowledge
                      </button>

                      <button
                        onClick={() =>
                          handleStatusChange(
                            'dispatched',
                            `Assigned ${currentReport.assignedUnitName || 'BFP Engine 01'}. Unit rolling out.`
                          )
                        }
                        className="py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition"
                      >
                        2. Dispatch Unit
                      </button>

                      <button
                        onClick={() =>
                          handleStatusChange(
                            'en_route',
                            `Unit traveling on highway. ETA ~${currentReport.responderEtaMinutes || 2} mins`
                          )
                        }
                        className="py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-md transition"
                      >
                        3. En Route
                      </button>

                      <button
                        onClick={() => handleStatusChange('on_scene', 'Response unit has arrived on scene')}
                        className="py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition"
                      >
                        4. On Scene
                      </button>

                      <button
                        onClick={() => handleStatusChange('under_control', 'Incident declared under control / fire declared out')}
                        className="py-2.5 px-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md transition"
                      >
                        5. Under Control
                      </button>

                      <button
                        onClick={() => handleStatusChange('resolved', 'Incident operations completed and case closed')}
                        className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition col-span-2 sm:col-span-3"
                      >
                        ✓ Mark Case Resolved
                      </button>
                    </div>
                  </div>

                  {/* Reporter & Fleet Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800 text-xs space-y-1.5">
                      <div className="font-bold uppercase text-slate-400">Reporter Information</div>
                      <div className="text-white font-semibold text-sm">{currentReport.reporterName}</div>
                      <div className="font-mono text-amber-400 flex items-center gap-1.5">
                        <PhoneCall className="w-3.5 h-3.5" />
                        <span>{currentReport.reporterPhone}</span>
                      </div>
                      <div className="text-slate-400 pt-1 border-t border-slate-800 text-[11px]">
                        GPS: {currentReport.location.latitude.toFixed(5)}, {currentReport.location.longitude.toFixed(5)} &bull; &plusmn;{currentReport.location.accuracyMeters || 8}m
                      </div>
                    </div>

                    <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800 text-xs space-y-1.5">
                      <div className="font-bold uppercase text-slate-400">Assigned Response Fleet</div>
                      <div className="text-white font-semibold text-sm">{currentReport.assignedUnitName || 'None Assigned'}</div>
                      <div className="text-slate-300">
                        Distance: {currentReport.responderDistanceKm || 1.2} km &bull; ETA: {currentReport.responderEtaMinutes || 2} min
                      </div>
                      <div className="text-emerald-400 font-mono text-[11px] pt-1 border-t border-slate-800">
                        E2EE Hash: #{currentReport.e2eeHash}
                      </div>
                    </div>
                  </div>

                  {/* Send Direct SMS to Citizen */}
                  <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800">
                    <div className="text-xs font-bold uppercase text-slate-300 mb-2 flex items-center gap-1.5">
                      <MessageSquare className="w-4 h-4 text-sky-400" />
                      <span>Send Direct SMS Update to Citizen ({currentReport.reporterPhone})</span>
                    </div>

                    <form onSubmit={handleSendCustomSms} className="flex gap-2">
                      <input
                        type="text"
                        placeholder="e.g. BFP Engine 1 is turning into Purok 2. Please wave to guide responders."
                        value={smsReplyText}
                        onChange={(e) => setSmsReplyText(e.target.value)}
                        className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                      />
                      <button
                        type="submit"
                        className="py-2 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center gap-1.5 transition"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Send SMS</span>
                      </button>
                    </form>
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            /* SMS Logs Tab */
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              <div className="text-xs font-bold uppercase text-slate-400 mb-2">
                Simulated Cellular Gateway SMS Transmissions
              </div>

              {smsLogs.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">No SMS logs recorded yet.</div>
              ) : (
                smsLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sky-400">To: {log.recipientName} ({log.recipientPhone})</span>
                      <span className="text-[10px] font-mono text-slate-500">{log.timestamp} &bull; {log.carrier}</span>
                    </div>
                    <div className="font-mono text-slate-200 bg-slate-900 p-2.5 rounded-xl border border-slate-800 whitespace-pre-wrap text-[11px]">
                      {log.messageText}
                    </div>
                    <div className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Status: Cellular SMS Delivered</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
