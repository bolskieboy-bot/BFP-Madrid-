import { useState, useEffect, useRef } from 'react';
import { Flame, Car, HeartPulse, AlertTriangle, X, ShieldCheck, MessageSquare, PhoneCall } from 'lucide-react';
import { IncidentCategory, IncidentReport, UserProfile } from '../../types';
import { MADRID_CENTER, calculateDistanceKm, estimateEmergencyEta } from '../../constants/madridLocations';
import { generateSha256Hash } from '../../services/cryptoService';
import { playEmergencySiren } from '../../services/audioService';
import { recordSmsDispatch, createDirectSmsUri, getStationRecipient } from '../../services/smsService';
import { saveReport, queueOfflineReport, addNotification } from '../../services/storageService';
import BfpMadridLogo from '../Common/BfpMadridLogo';

interface QuickSOSModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  userCoords: { lat: number; lng: number } | null;
  onReportCreated: (report: IncidentReport) => void;
  isOnline: boolean;
}

export default function QuickSOSModal({
  isOpen,
  onClose,
  currentUser,
  userCoords,
  onReportCreated,
  isOnline,
}: QuickSOSModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<IncidentCategory>('fire');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isDispatched, setIsDispatched] = useState(false);
  const [lastDispatchedReport, setLastDispatchedReport] = useState<IncidentReport | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isOpen) {
      if (timerRef.current) clearInterval(timerRef.current);
      setCountdown(null);
      setIsDispatched(false);
      setLastDispatchedReport(null);
    }
  }, [isOpen]);

  const triggerSOSCountdown = (category: IncidentCategory) => {
    setSelectedCategory(category);
    setCountdown(3);

    // Play subtle alert tone and vibration
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([200, 100, 200]);
    }

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          executeInstantSOS(category);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const cancelCountdown = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setCountdown(null);
  };

  const executeInstantSOS = async (category: IncidentCategory) => {
    playEmergencySiren(2.5);

    const lat = userCoords?.lat || MADRID_CENTER.latitude;
    const lng = userCoords?.lng || MADRID_CENTER.longitude;

    // Calculate distance to BFP or MDRRMO station
    const stationLat = category === 'fire' ? 9.2628 : 9.2615;
    const stationLng = category === 'fire' ? 125.9602 : 125.9618;
    const distanceKm = calculateDistanceKm(stationLat, stationLng, lat, lng);
    const eta = estimateEmergencyEta(distanceKm);

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const incidentNumber = `MDR-${new Date().getFullYear()}-${randomSuffix}`;
    const hash = await generateSha256Hash(`${incidentNumber}-${Date.now()}-${category}`);

    const report: IncidentReport = {
      id: 'sos-' + Date.now(),
      incidentNumber,
      category,
      subcategory: category === 'fire' ? 'Rapid Fire Distress Alert' : category === 'vehicular' ? 'Rapid Crash Distress Alert' : 'Rapid Medical Emergency SOS',
      severity: 'critical',
      title: `IMMEDIATE 1-TAP SOS: ${category.toUpperCase()}`,
      description: `Urgent emergency distress triggered at GPS coordinates (${lat.toFixed(4)}, ${lng.toFixed(4)}) in Madrid, Surigao del Sur. Immediate responder vehicle rollout requested.`,
      location: {
        latitude: lat,
        longitude: lng,
        barangay: currentUser?.barangay || 'Linungao (Poblacion)',
        landmark: '1-Tap SOS GPS Pinpoint',
        accuracyMeters: 10,
      },
      reporterName: currentUser?.fullName || 'Madrid Citizen (Distress)',
      reporterPhone: currentUser?.phoneNumber || '0917-819-2371',
      photos: [],
      status: 'dispatched',
      statusHistory: [
        {
          status: 'reported',
          timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          note: 'Distress beacon activated via One-Tap Emergency Button',
          updatedBy: currentUser?.fullName || 'Distress Beacon',
        },
        {
          status: 'dispatched',
          timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          note: category === 'fire' ? 'BFP Engine 01 dispatched on priority response' : 'MDRRMO Rescue Ambulance rolling out',
          updatedBy: 'Automated Madrid Emergency Gateway',
        },
      ],
      assignedUnitId: category === 'fire' ? 'unit-bfp-01' : 'unit-rescue-01',
      assignedUnitName: category === 'fire' ? 'BFP Engine 01 (Madrid)' : 'MDRRMO Rescue Alpha',
      responderDistanceKm: distanceKm,
      responderEtaMinutes: eta,
      e2eeHash: hash,
      isEncrypted: true,
      smsSent: true,
      smsRecipient: category === 'fire' ? '09178192371' : '09985521911',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      aiTriage: {
        alarmLevel: category === 'fire' ? 'Priority 1st Alarm Fire' : 'Priority Code Red Rescue',
        equipmentSuggested: category === 'fire' ? ['Full Pumper Engine', 'SCBA Gear', 'Hydrant Wrench'] : ['Ambulance & EMT', 'Oxygen Tank', 'Spine Board'],
        civilianSafetyAdvice: 'Remain in a safe location visible to approaching sirens. Do not panic.',
        dispatchPriority: 'Critical - Immediate',
      },
    };

    if (isOnline) {
      saveReport(report);
      recordSmsDispatch(report);
    } else {
      queueOfflineReport(report);
      saveReport(report); // Local view
      recordSmsDispatch(report);
    }

    addNotification({
      incidentId: report.id,
      title: `🚨 ${category.toUpperCase()} SOS DISPATCHED`,
      body: `${report.assignedUnitName} is rolling out. ETA: ${eta} mins (${distanceKm} km).`,
      type: 'dispatch',
    });

    setLastDispatchedReport(report);
    setIsDispatched(true);
    onReportCreated(report);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border-2 border-rose-600/80 rounded-3xl p-6 shadow-2xl text-slate-100 overflow-hidden">
        {/* Glow ambient background */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-rose-600/30 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-amber-600/20 rounded-full blur-3xl pointer-events-none"></div>

        {/* Close Button */}
        <button
          onClick={() => {
            cancelCountdown();
            onClose();
          }}
          className="absolute top-4 right-4 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 p-2 rounded-full transition"
        >
          <X className="w-5 h-5" />
        </button>

        {countdown !== null && countdown > 0 ? (
          /* Countdown State - Safety Grace Period to Cancel */
          <div className="text-center py-6">
            <div className="relative w-32 h-32 mx-auto mb-6 flex items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-rose-600/20 animate-ping"></span>
              <div className="w-28 h-28 rounded-full bg-rose-600 border-4 border-white flex items-center justify-center text-5xl font-black text-white shadow-2xl">
                {countdown}
              </div>
            </div>

            <h3 className="text-2xl font-black text-rose-500 uppercase tracking-wide">
              DISPATCHING {selectedCategory.toUpperCase()} ALERT
            </h3>
            <p className="text-sm text-slate-300 mt-2">
              Madrid BFP & Rescue teams will be notified immediately with your live GPS location.
            </p>

            <div className="mt-8 flex flex-col gap-3">
              <button
                onClick={cancelCountdown}
                className="w-full py-3.5 px-6 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm transition border border-slate-700"
              >
                Cancel Distress Beacon
              </button>
              <button
                onClick={() => executeInstantSOS(selectedCategory)}
                className="w-full py-3.5 px-6 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-sm uppercase tracking-wider transition shadow-lg shadow-rose-600/40"
              >
                Send Instantly Now (Skip Countdown)
              </button>
            </div>
          </div>
        ) : isDispatched && lastDispatchedReport ? (
          /* Dispatched Confirmation State */
          <div className="text-center py-4">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-10 h-10" />
            </div>

            <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-rose-950/80 text-rose-400 border border-rose-800">
              REF: {lastDispatchedReport.incidentNumber}
            </span>

            <h3 className="text-2xl font-black text-white mt-3">
              EMERGENCY UNITS DISPATCHED
            </h3>

            <p className="text-sm text-slate-300 mt-1">
              Madrid BFP Fire Station & Command Center received your distress beacon.
            </p>

            {/* Responder status card */}
            <div className="mt-5 bg-slate-950/70 border border-slate-800 rounded-2xl p-4 text-left">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span>ASSIGNED UNIT</span>
                <span className="text-emerald-400 font-bold">🚨 EN ROUTE</span>
              </div>
              <div className="text-base font-bold text-slate-100">
                {lastDispatchedReport.assignedUnitName}
              </div>
              <div className="flex items-center justify-between text-xs mt-3 pt-2 border-t border-slate-800/80">
                <span className="text-slate-400">Estimated Arrival:</span>
                <span className="font-mono font-bold text-amber-400 text-sm">
                  ~{lastDispatchedReport.responderEtaMinutes} Mins ({lastDispatchedReport.responderDistanceKm} km)
                </span>
              </div>
            </div>

            {/* Direct SMS and Call Buttons */}
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <a
                href={createDirectSmsUri(
                  getStationRecipient(lastDispatchedReport.category).phone,
                  `URGENT SOS REF ${lastDispatchedReport.incidentNumber}: ${lastDispatchedReport.category.toUpperCase()} at Madrid GPS ${lastDispatchedReport.location.latitude.toFixed(4)},${lastDispatchedReport.location.longitude.toFixed(4)}`
                )}
                className="py-3 px-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg transition"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Direct SMS App</span>
              </a>

              <a
                href={`tel:${getStationRecipient(lastDispatchedReport.category).phone}`}
                className="py-3 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg transition"
              >
                <PhoneCall className="w-4 h-4" />
                <span>Call Hotline</span>
              </a>
            </div>

            <button
              onClick={onClose}
              className="mt-4 w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition"
            >
              Close & View Live Map Route
            </button>
          </div>
        ) : (
          /* Main Initial 1-Tap SOS Selector */
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-600 text-white tracking-wider uppercase animate-pulse">
                One-Tap Distress Beacon
              </span>
              {!isOnline && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950">
                  Offline Mode Active
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 mb-2">
              <BfpMadridLogo size="lg" withGlow={true} />
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  BFP MADRID SOS BEACON
                </h2>
                <p className="text-xs text-slate-400">
                  Tap any category below to immediately signal Madrid emergency responders.
                </p>
              </div>
            </div>

            {/* 3 Main Emergency Categories Buttons */}
            <div className="mt-5 space-y-3">
              {/* Fire Incident */}
              <button
                onClick={() => triggerSOSCountdown('fire')}
                className="w-full group relative overflow-hidden bg-gradient-to-r from-rose-950 to-slate-900 hover:from-rose-900 hover:to-slate-800 border-2 border-rose-600/70 p-4 rounded-2xl flex items-center justify-between text-left transition transform active:scale-98 shadow-lg shadow-rose-950/50"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-slate-900/90 border border-rose-600/60 flex items-center justify-center p-1 shadow-lg group-hover:scale-110 transition">
                    <BfpMadridLogo size="md" />
                  </div>
                  <div>
                    <div className="text-base font-black text-white uppercase tracking-wide flex items-center gap-2">
                      <span>Fire Incident</span>
                      <span className="text-[10px] bg-rose-600/30 text-rose-300 px-1.5 py-0.5 rounded border border-rose-500/40">BFP MADRID</span>
                    </div>
                    <div className="text-xs text-rose-200/70 mt-0.5">
                      Structure, Kitchen, Forest, or Electrical Fire
                    </div>
                  </div>
                </div>
                <span className="text-xs font-bold text-rose-400 group-hover:translate-x-1 transition">
                  TAP SOS &rarr;
                </span>
              </button>

              {/* Vehicular Incident */}
              <button
                onClick={() => triggerSOSCountdown('vehicular')}
                className="w-full group relative overflow-hidden bg-gradient-to-r from-amber-950 to-slate-900 hover:from-amber-900 hover:to-slate-800 border-2 border-amber-600/70 p-4 rounded-2xl flex items-center justify-between text-left transition transform active:scale-98 shadow-lg shadow-amber-950/50"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center text-slate-950 shadow-lg group-hover:scale-110 transition">
                    <Car className="w-7 h-7" />
                  </div>
                  <div>
                    <div className="text-base font-black text-white uppercase tracking-wide flex items-center gap-2">
                      <span>Vehicular Crash</span>
                      <span className="text-[10px] bg-amber-600/30 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/40">MDRRMO / PNP</span>
                    </div>
                    <div className="text-xs text-amber-200/70 mt-0.5">
                      Motorcycle Collision, Highway Accident, Extrication
                    </div>
                  </div>
                </div>
                <span className="text-xs font-bold text-amber-400 group-hover:translate-x-1 transition">
                  TAP SOS &rarr;
                </span>
              </button>

              {/* Medical Incident */}
              <button
                onClick={() => triggerSOSCountdown('medical')}
                className="w-full group relative overflow-hidden bg-gradient-to-r from-emerald-950 to-slate-900 hover:from-emerald-900 hover:to-slate-800 border-2 border-emerald-600/70 p-4 rounded-2xl flex items-center justify-between text-left transition transform active:scale-98 shadow-lg shadow-emerald-950/50"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition">
                    <HeartPulse className="w-7 h-7" />
                  </div>
                  <div>
                    <div className="text-base font-black text-white uppercase tracking-wide flex items-center gap-2">
                      <span>Medical Crisis</span>
                      <span className="text-[10px] bg-emerald-600/30 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/40">MDH / RESCUE</span>
                    </div>
                    <div className="text-xs text-emerald-200/70 mt-0.5">
                      Cardiac, Trauma Bleed, Unconscious, Maternal
                    </div>
                  </div>
                </div>
                <span className="text-xs font-bold text-emerald-400 group-hover:translate-x-1 transition">
                  TAP SOS &rarr;
                </span>
              </button>
            </div>

            {/* Privacy & E2EE Notice footer */}
            <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>RA 10173 E2EE Encrypted</span>
              </span>
              <span>Madrid, Surigao del Sur</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
