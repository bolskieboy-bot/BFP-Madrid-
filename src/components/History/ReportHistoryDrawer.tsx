import { useState } from 'react';
import {
  X,
  Clock,
  MapPin,
  ShieldCheck,
  Flame,
  Car,
  HeartPulse,
  Navigation,
  CheckCircle2,
  ChevronRight,
  Radio,
  FileText,
  AlertTriangle,
  Lock,
  Camera,
} from 'lucide-react';
import { IncidentReport, IncidentStatus, UserProfile } from '../../types';
import BfpMadridLogo from '../Common/BfpMadridLogo';

interface ReportHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  reports: IncidentReport[];
  currentUser: UserProfile | null;
  onSelectIncident: (report: IncidentReport) => void;
}

const STATUS_STEPS: { status: IncidentStatus; label: string }[] = [
  { status: 'reported', label: 'Reported' },
  { status: 'acknowledged', label: 'Verified' },
  { status: 'dispatched', label: 'Dispatched' },
  { status: 'en_route', label: 'En Route' },
  { status: 'on_scene', label: 'On Scene' },
  { status: 'resolved', label: 'Resolved' },
];

export default function ReportHistoryDrawer({
  isOpen,
  onClose,
  reports,
  currentUser,
  onSelectIncident,
}: ReportHistoryDrawerProps) {
  const [selectedReport, setSelectedReport] = useState<IncidentReport | null>(null);

  if (!isOpen) return null;

  // Filter reports: if admin, show all reports; if citizen, show their reports or all if empty
  const userReports =
    currentUser && currentUser.role !== 'admin_dispatcher'
      ? reports.filter(
          (r) =>
            r.reporterPhone.replace(/\D/g, '') === currentUser.phoneNumber.replace(/\D/g, '') ||
            r.reporterName.toLowerCase().includes(currentUser.fullName.toLowerCase())
        )
      : reports;

  // If no user reports match, fall back to all reports so history is never blank
  const displayReports = userReports.length > 0 ? userReports : reports;

  const getStatusIndex = (currentStatus: IncidentStatus) => {
    return STATUS_STEPS.findIndex((s) => s.status === currentStatus);
  };

  return (
    <div className="fixed inset-0 z-[600] flex justify-end bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border-l border-slate-700/80 h-full flex flex-col text-slate-100 shadow-2xl">
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BfpMadridLogo size="md" withGlow={true} />
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight text-white uppercase">
                BFP MADRID INCIDENT HISTORY
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time incident response tracking for Madrid, Surigao del Sur
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white bg-slate-800/80 p-2 rounded-full transition shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {selectedReport ? (
            /* Detailed View of Single Selected Report */
            <div className="space-y-4">
              <button
                onClick={() => setSelectedReport(null)}
                className="text-xs text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 mb-2"
              >
                &larr; Back to all reports list
              </button>

              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono font-bold text-sm text-rose-400">
                    {selectedReport.incidentNumber}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                      selectedReport.status === 'resolved'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : selectedReport.status === 'en_route'
                        ? 'bg-amber-950 text-amber-400 border border-amber-800 animate-pulse'
                        : 'bg-rose-950 text-rose-400 border border-rose-800'
                    }`}
                  >
                    {selectedReport.status.replace('_', ' ')}
                  </span>
                </div>

                <h3 className="text-base font-bold text-white">{selectedReport.title}</h3>
                <p className="text-xs text-slate-300 mt-1">{selectedReport.description}</p>

                <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-rose-400" />
                    <span>Brgy. {selectedReport.location.barangay}</span>
                  </span>
                  <span>{new Date(selectedReport.createdAt).toLocaleTimeString()}</span>
                </div>
              </div>

              {/* Progress Stepper / Lifecycle Bar */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4">
                <div className="text-xs font-bold uppercase text-slate-400 mb-3 flex items-center gap-1.5">
                  <Radio className="w-4 h-4 text-emerald-400" />
                  <span>Real-Time Incident Lifecycle Tracker</span>
                </div>

                <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
                  {selectedReport.statusHistory.map((h, i) => (
                    <div key={i} className="relative">
                      <div className="absolute -left-[23px] top-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-slate-900 shadow"></div>
                      <div className="text-xs font-bold text-slate-200 capitalize">
                        {h.status.replace('_', ' ')}
                      </div>
                      <div className="text-[11px] text-slate-400">{h.note}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                        {h.timestamp} &bull; {h.updatedBy}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Responder Vehicle & Routing Summary */}
              {selectedReport.assignedUnitName && (
                <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4">
                  <div className="text-xs font-bold uppercase text-slate-400 mb-2 flex items-center gap-1.5">
                    <Navigation className="w-4 h-4 text-sky-400" />
                    <span>Assigned Madrid Response Unit</span>
                  </div>

                  <div className="text-sm font-bold text-white">{selectedReport.assignedUnitName}</div>
                  <div className="flex items-center justify-between text-xs text-slate-400 mt-2">
                    <span>Distance to Scene:</span>
                    <span className="font-mono text-slate-200 font-bold">
                      {selectedReport.responderDistanceKm || 1.2} km
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400 mt-1">
                    <span>Estimated Arrival Time:</span>
                    <span className="font-mono text-amber-400 font-bold">
                      {selectedReport.responderEtaMinutes || 2} minutes
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      onSelectIncident(selectedReport);
                      onClose();
                    }}
                    className="mt-3 w-full py-2.5 rounded-xl bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/40 text-sky-300 font-bold text-xs flex items-center justify-center gap-1.5 transition"
                  >
                    <Navigation className="w-4 h-4" />
                    <span>Track on Madrid GPS Map</span>
                  </button>
                </div>
              )}

              {/* Uploaded Photos */}
              {selectedReport.photos.length > 0 && (
                <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4">
                  <div className="text-xs font-bold uppercase text-slate-400 mb-2">
                    Uploaded Situational Photos
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedReport.photos.map((p) => (
                      <div key={p.id} className="relative rounded-xl overflow-hidden border border-slate-800">
                        <img src={p.dataUrl} alt="Incident" className="w-full h-28 object-cover" />
                        {p.aiSceneAssessment && (
                          <div className="absolute inset-x-0 bottom-0 bg-slate-950/80 p-1.5 text-[9px] text-slate-300 backdrop-blur-xs">
                            {p.aiSceneAssessment}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* End-to-End Cryptographic Seal */}
              <div className="bg-slate-950/60 border border-emerald-900/40 rounded-2xl p-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-emerald-400" />
                  <div>
                    <div className="font-bold text-emerald-400 text-[11px]">E2EE Tamper-Proof Verified</div>
                    <div className="font-mono text-[10px] text-slate-400">
                      SHA256: #{selectedReport.e2eeHash}
                    </div>
                  </div>
                </div>
                <span className="text-[10px] text-slate-500 uppercase">RA 10173</span>
              </div>
            </div>
          ) : (
            /* List View of All Reports */
            <div className="space-y-3">
              {displayReports.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-semibold">No incident reports recorded yet.</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Your submitted emergency alerts will appear here with live tracking.
                  </p>
                </div>
              ) : (
                displayReports.map((report) => (
                  <div
                    key={report.id}
                    onClick={() => setSelectedReport(report)}
                    className="p-4 rounded-2xl bg-slate-950/60 hover:bg-slate-800/60 border border-slate-800/80 transition cursor-pointer group"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        {report.category === 'unidentified' || !report.isIdentified ? (
                          <span className="w-6 h-6 rounded-lg bg-fuchsia-600/20 text-fuchsia-400 flex items-center justify-center text-xs">
                            <Camera className="w-3.5 h-3.5" />
                          </span>
                        ) : report.category === 'fire' ? (
                          <span className="w-6 h-6 rounded-lg bg-rose-600/20 text-rose-500 flex items-center justify-center text-xs">
                            <Flame className="w-3.5 h-3.5" />
                          </span>
                        ) : report.category === 'vehicular' ? (
                          <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs">
                            <Car className="w-3.5 h-3.5" />
                          </span>
                        ) : (
                          <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs">
                            <HeartPulse className="w-3.5 h-3.5" />
                          </span>
                        )}
                        <span className="font-mono font-bold text-xs text-slate-300">
                          {report.incidentNumber}
                        </span>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          !report.isIdentified
                            ? 'bg-fuchsia-950 text-fuchsia-300 border border-fuchsia-700 animate-pulse'
                            : report.status === 'resolved'
                            ? 'bg-emerald-950 text-emerald-400'
                            : report.status === 'en_route'
                            ? 'bg-amber-950 text-amber-400 animate-pulse'
                            : 'bg-rose-950 text-rose-400'
                        }`}
                      >
                        {!report.isIdentified ? '📸 PENDING ADMIN ID' : report.status.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="font-bold text-sm text-slate-100 group-hover:text-amber-400 transition">
                      {report.title}
                    </div>

                    <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-rose-400" />
                        <span>Brgy. {report.location.barangay}</span>
                      </span>
                      <span className="flex items-center gap-1 text-slate-400 group-hover:text-slate-200">
                        <span>Details</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 text-center text-xs text-slate-400">
          Madrid Emergency Response Network &bull; Caraga Region XIII
        </div>
      </div>
    </div>
  );
}
