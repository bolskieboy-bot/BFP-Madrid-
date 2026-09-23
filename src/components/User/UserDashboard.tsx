import { useState, useEffect, useRef } from 'react';
import {
  Camera,
  Upload,
  MapPin,
  CheckCircle2,
  RefreshCw,
  Send,
  Loader2,
  AlertCircle,
  Navigation,
  Sparkles,
  Phone,
  MessageSquare,
  Shield,
  Flame,
  Check,
  Info,
} from 'lucide-react';
import { IncidentReport, UserProfile, ResponderUnit } from '../../types';
import { MADRID_CENTER, calculateDistanceKm, estimateEmergencyEta } from '../../constants/madridLocations';
import { identifyAddressFromCoords, IdentifiedAddress } from '../../services/geocodingService';
import { generateSha256Hash } from '../../services/cryptoService';
import {
  recordDualSmsDispatch,
  formatIncidentSms,
  createDirectSmsUri,
  createDualStationSmsUri,
  OFFICIAL_MADRID_HOTLINES,
} from '../../services/smsService';
import { autoIdentifyEmergencyFromPhoto, AutoIdentifiedHelp } from '../../services/aiTriageService';
import { saveReport, queueOfflineReport, addNotification, getAppDetailsConfig } from '../../services/storageService';
import { playCitizenGentleConfirmation } from '../../services/audioService';
import { compressImageFile, compressDataUrl } from '../../utils/imageCompressor';
import LeafletEmergencyMap from '../Map/LeafletEmergencyMap';
import BfpMadridLogo from '../Common/BfpMadridLogo';
import AppInfoModal from '../Common/AppInfoModal';

interface UserDashboardProps {
  currentUser: UserProfile | null;
  userCoords: { lat: number; lng: number } | null;
  onRefreshLocation?: () => void;
  reports: IncidentReport[];
  onReportCreated: (report: IncidentReport) => void;
  isOnline: boolean;
  responderUnits: ResponderUnit[];
  onSelectIncidentOnMap?: (report: IncidentReport) => void;
}

// Madrid Incident Guidance Categories (Client can choose: House Fire, Grass Fire, Vehicle Crash, Medical Attention)
// Blank with no stock photos yet - citizens attach live photo or report category
export type MadridGuidanceType = 'house_fire' | 'grass_fire' | 'vehicle_crash' | 'medical_attention';

export interface MadridGuidanceItem {
  id: MadridGuidanceType;
  title: string;
  subtitle: string;
  icon: string;
  category: 'fire' | 'vehicular' | 'medical';
  subcategory: string;
  kindOfHelp: string;
  recommendedUnitId: string;
  recommendedUnitName: string;
  desc: string;
  safetyAdvice: string;
}

export const MADRID_GUIDANCE_OPTIONS: MadridGuidanceItem[] = [
  {
    id: 'house_fire',
    title: 'House Fire',
    subtitle: 'Residential structure, kitchen or roof blaze',
    icon: '🔥',
    category: 'fire',
    subcategory: 'Residential House Fire',
    kindOfHelp: 'Structural Fire Suppression & BFP Attack Engine Needed',
    recommendedUnitId: 'unit-bfp-01',
    recommendedUnitName: 'BFP Madrid Fire Engine (Rosenbauer Pumper)',
    desc: 'House fire emergency reported in Madrid, Surigao del Sur.',
    safetyAdvice: 'Evacuate all household members immediately. Do not attempt to re-enter smoke-filled rooms.',
  },
  {
    id: 'grass_fire',
    title: 'Grass Fire',
    subtitle: 'Agricultural, brush & dry field blaze',
    icon: '🌾',
    category: 'fire',
    subcategory: 'Grassland / Brush Wildfire',
    kindOfHelp: 'Grass Fire Suppression & Wildfire Crew Needed',
    recommendedUnitId: 'unit-bfp-01',
    recommendedUnitName: 'BFP Madrid Fire Engine & Grassland Crew',
    desc: 'Grass fire / agricultural brush fire spreading in Madrid, Surigao del Sur.',
    safetyAdvice: 'Stay upwind of smoke plume. Clear dry leaves and grass around nearby houses.',
  },
  {
    id: 'vehicle_crash',
    title: 'Vehicle Crash',
    subtitle: 'Road collision, highway crash or rollover',
    icon: '🚗',
    category: 'vehicular',
    subcategory: 'Vehicular Road Crash',
    kindOfHelp: 'Vehicular Extrication & Emergency Ambulance Response Needed',
    recommendedUnitId: 'unit-mdr-01',
    recommendedUnitName: 'MDRRMO Rescue Vehicle & Ambulance (Unit-MDR-01)',
    desc: 'Vehicular crash / highway collision incident in Madrid, Surigao del Sur.',
    safetyAdvice: 'Do not move injured persons unless in immediate fire danger. Safely divert oncoming traffic.',
  },
  {
    id: 'medical_attention',
    title: 'Medical Attention',
    subtitle: 'Acute trauma, cardiac or emergency patient',
    icon: '🚑',
    category: 'medical',
    subcategory: 'Severe Trauma / Acute Medical Emergency',
    kindOfHelp: 'Emergency Paramedic & Rapid Ambulance Transport Needed',
    recommendedUnitId: 'unit-bfp-amb-01',
    recommendedUnitName: 'BFP Madrid EMS Ambulance Alpha',
    desc: 'Urgent medical attention / emergency trauma care requested in Madrid, Surigao del Sur.',
    safetyAdvice: 'Keep patient calm and still. If bleeding, apply direct clean pressure. Allow ample ventilation.',
  },
];

// Generates an official blank placeholder graphic when no camera photo has been taken yet
function generateBlankIncidentGraphic(title: string, iconText: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
    <rect width="600" height="400" fill="#0f172a"/>
    <rect x="24" y="24" width="552" height="352" rx="18" fill="#1e293b" stroke="#f43f5e" stroke-width="2.5" stroke-dasharray="10 10"/>
    <text x="300" y="150" font-family="sans-serif" font-size="64" text-anchor="middle">${iconText}</text>
    <text x="300" y="215" font-family="sans-serif" font-size="28" font-weight="bold" fill="#f8fafc" text-anchor="middle">${title.toUpperCase()}</text>
    <text x="300" y="255" font-family="sans-serif" font-size="16" fill="#94a3b8" text-anchor="middle">Madrid Incident Guidance • Blank (No Photo Attached Yet)</text>
    <text x="300" y="310" font-family="sans-serif" font-size="14" font-weight="bold" fill="#fbbf24" text-anchor="middle">BFP Madrid &amp; MDRRMO Emergency Response System</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export default function UserDashboard({
  currentUser,
  userCoords,
  onRefreshLocation,
  reports,
  onReportCreated,
  isOnline,
  responderUnits,
  onSelectIncidentOnMap,
}: UserDashboardProps) {
  // STRICTLY 2 TABS: 'upload' and 'map'
  const [activeTab, setActiveTab] = useState<'upload' | 'map'>('upload');

  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoCaption, setPhotoCaption] = useState<string>('');
  const [selectedGuidance, setSelectedGuidance] = useState<MadridGuidanceType | null>(null);
  const [hasUserUploadedPhoto, setHasUserUploadedPhoto] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastSubmittedReport, setLastSubmittedReport] = useState<IncidentReport | null>(null);
  const [isAppInfoOpen, setIsAppInfoOpen] = useState(false);
  const appConfig = getAppDetailsConfig();

  // Auto-identified address
  const [identifiedAddress, setIdentifiedAddress] = useState<IdentifiedAddress | null>(null);
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);

  // Auto-identified help from the photo
  const [isAnalyzingPhoto, setIsAnalyzingPhoto] = useState(false);
  const [autoIdentifiedHelp, setAutoIdentifiedHelp] = useState<AutoIdentifiedHelp | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const lat = userCoords?.lat || MADRID_CENTER.latitude;
  const lng = userCoords?.lng || MADRID_CENTER.longitude;

  // Auto-identify address on GPS change
  useEffect(() => {
    let isMounted = true;
    setIsResolvingAddress(true);

    identifyAddressFromCoords(lat, lng, 8)
      .then((addr) => {
        if (isMounted) {
          setIdentifiedAddress(addr);
          setIsResolvingAddress(false);
        }
      })
      .catch(() => {
        if (isMounted) setIsResolvingAddress(false);
      });

    return () => {
      isMounted = false;
    };
  }, [lat, lng]);

  // When photo changes, automatically identify what kind of help is needed!
  useEffect(() => {
    if (!photoDataUrl) {
      if (!selectedGuidance) {
        setAutoIdentifiedHelp(null);
      }
      return;
    }

    // If this is our blank incident graphic, skip AI vision analysis as the chosen category is already set
    if (photoDataUrl.startsWith('data:image/svg+xml')) {
      return;
    }

    let isMounted = true;
    setIsAnalyzingPhoto(true);

    autoIdentifyEmergencyFromPhoto({
      photoBase64: photoDataUrl,
      photoCaption,
      barangay: identifiedAddress?.barangay || 'Linungao (Poblacion)',
    })
      .then((help) => {
        if (isMounted) {
          setAutoIdentifiedHelp(help);
          setIsAnalyzingPhoto(false);
        }
      })
      .catch(() => {
        if (isMounted) setIsAnalyzingPhoto(false);
      });

    return () => {
      isMounted = false;
    };
  }, [photoDataUrl, photoCaption, identifiedAddress?.barangay, selectedGuidance]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    try {
      // Compress phone camera/gallery photo to prevent localStorage QuotaExceededError
      const compressed = await compressImageFile(file, 900, 0.65);
      if (compressed) {
        setPhotoDataUrl(compressed);
        setHasUserUploadedPhoto(true);
        setPhotoCaption(file.name);
      } else {
        setErrorMsg('Could not process that photo. Please try another.');
      }
    } catch {
      setErrorMsg('Could not load that photo. Please try another.');
    }
  };

  const handleSelectGuidanceCategory = (item: MadridGuidanceItem) => {
    setSelectedGuidance(item.id);
    setErrorMsg(null);
    setPhotoCaption(item.desc);

    // Explicitly populate autoIdentifiedHelp with the selected incident option
    setAutoIdentifiedHelp({
      category: item.category,
      subcategory: item.subcategory,
      kindOfHelp: item.kindOfHelp,
      severity: item.category === 'fire' || item.category === 'medical' ? 'critical' : 'high',
      recommendedUnitId: item.recommendedUnitId,
      recommendedUnitName: item.recommendedUnitName,
      confidence: 100,
      explanation: item.desc,
      civilianAdvice: item.safetyAdvice,
    });

    // If citizen has not uploaded a camera photo yet, set official blank placeholder graphic
    if (!hasUserUploadedPhoto) {
      const blankGraphic = generateBlankIncidentGraphic(item.title, item.icon);
      setPhotoDataUrl(blankGraphic);
    }
  };

  const handleSubmitPhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoDataUrl && !selectedGuidance) {
      setErrorMsg('Please select an incident category (House Fire, Grass Fire, Vehicle Crash, Medical Attention) or take a photo.');
      return;
    }

    let activeDataUrl = photoDataUrl;
    if (!activeDataUrl && selectedGuidance) {
      const item = MADRID_GUIDANCE_OPTIONS.find((c) => c.id === selectedGuidance)!;
      activeDataUrl = generateBlankIncidentGraphic(item.title, item.icon);
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      // Citizen cellphone: NO ALARM SOUNDS! Reassuring gentle confirmation chime only.
      playCitizenGentleConfirmation();

      // Ensure photo dataUrl is compressed
      const finalPhotoUrl = await compressDataUrl(activeDataUrl!, 900, 0.65);

      const stationLat = 9.2628;
      const stationLng = 125.9602;
      const distanceKm = calculateDistanceKm(stationLat, stationLng, lat, lng);
      const eta = estimateEmergencyEta(distanceKm);

      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const incidentNumber = `MDR-${new Date().getFullYear()}-${randomSuffix}`;
      const hash = await generateSha256Hash(`${incidentNumber}-${Date.now()}-photo`);

      const resolvedBarangay = identifiedAddress?.barangay || currentUser?.barangay || 'Linungao (Poblacion)';
      const resolvedStreet =
        identifiedAddress?.fullAddress ||
        `${identifiedAddress?.streetAddress || 'National Highway'}, Brgy. ${resolvedBarangay}, Madrid, Surigao del Sur`;

      // Use automatically identified category & subcategory from the photo
      const category = autoIdentifiedHelp?.category || 'fire';
      const subcategory = autoIdentifiedHelp?.subcategory || 'Emergency Incident';
      const assignedUnit =
        responderUnits.find((u) => u.id === autoIdentifiedHelp?.recommendedUnitId) ||
        (category === 'medical'
          ? responderUnits.find((u) => u.id === 'unit-bfp-amb-01') || responderUnits[1]
          : responderUnits[0]);

      const newReport: IncidentReport = {
        id: 'rep-' + Date.now(),
        incidentNumber,
        category,
        subcategory,
        severity: autoIdentifiedHelp?.severity || 'high',
        title: `${autoIdentifiedHelp?.kindOfHelp || 'Emergency Incident'} at ${resolvedBarangay}`,
        description:
          autoIdentifiedHelp?.explanation ||
          `Citizen photo emergency reported from ${resolvedStreet}. Automatic dispatch alerted BFP Madrid & MDRRMO.`,
        location: {
          latitude: lat,
          longitude: lng,
          barangay: resolvedBarangay,
          landmark: identifiedAddress?.nearestLandmark || 'GPS Pinpoint',
          streetAddress: resolvedStreet,
          accuracyMeters: identifiedAddress?.accuracyMeters || 8,
        },
        reporterName: currentUser?.fullName || 'Resident Citizen',
        reporterPhone: currentUser?.phoneNumber || '0917-555-0101',
        photos: [
          {
            id: 'photo-' + Date.now(),
            dataUrl: finalPhotoUrl,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            caption: hasUserUploadedPhoto
              ? photoCaption || autoIdentifiedHelp?.subcategory || 'Emergency Photo'
              : `${autoIdentifiedHelp?.subcategory || 'Emergency Report'} (Blank - No Photo Attached Yet)`,
            aiSceneAssessment: autoIdentifiedHelp?.explanation,
          },
        ],
        status: 'reported',
        statusHistory: [
          {
            status: 'reported',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            note: `Auto-identified as ${subcategory}. Text reported to BFP Madrid (${OFFICIAL_MADRID_HOTLINES.bfp.displayNumber}) & MDRRMO (${OFFICIAL_MADRID_HOTLINES.mdrrmo.displayNumber}).`,
            updatedBy: currentUser?.fullName || 'Citizen',
          },
        ],
        assignedUnitId: assignedUnit?.id,
        assignedUnitName: assignedUnit?.name,
        responderDistanceKm: distanceKm,
        responderEtaMinutes: eta,
        isIdentified: true,
        identifiedBy: 'Auto-Vision AI (Madrid Notifier)',
        identifiedAt: new Date().toISOString(),
        e2eeHash: hash.substring(0, 10).toUpperCase(),
        isEncrypted: true,
        smsSent: true,
        smsRecipient: `${OFFICIAL_MADRID_HOTLINES.bfp.displayNumber}, ${OFFICIAL_MADRID_HOTLINES.mdrrmo.displayNumber}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (!isOnline) {
        queueOfflineReport(newReport);
      } else {
        saveReport(newReport);
      }

      // Automatically report incident via text to BOTH BFP Madrid (0931-721-8765) and MDRRMO Madrid (0998-552-1911)
      recordDualSmsDispatch(newReport);

      addNotification({
        incidentId: newReport.id,
        title: `Text Sent to BFP & MDRRMO: ${incidentNumber}`,
        body: `Auto-identified as ${subcategory}. Reported to BFP (${OFFICIAL_MADRID_HOTLINES.bfp.displayNumber}) & MDRRMO (${OFFICIAL_MADRID_HOTLINES.mdrrmo.displayNumber}).`,
        type: 'dispatch',
      });

      onReportCreated(newReport);
      setLastSubmittedReport(newReport);
      setPhotoDataUrl(null);
      setHasUserUploadedPhoto(false);
      setSelectedGuidance(null);
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to send photo. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const userReports = reports.filter(
    (r) =>
      r.reporterPhone === currentUser?.phoneNumber ||
      r.reporterName === currentUser?.fullName ||
      r.id === lastSubmittedReport?.id
  );

  return (
    <div className="relative z-10 flex-1 flex flex-col h-full overflow-hidden bg-slate-950/70 backdrop-blur-[2px] text-slate-100">
      {/* 2 SIMPLE TABS ONLY: Report Photo & Map */}
      <div className="bg-slate-900 border-b border-slate-800 px-3 sm:px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-4 sm:px-5 py-2 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2 transition ${
              activeTab === 'upload'
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-950/60'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>Report Photo</span>
          </button>

          <button
            onClick={() => setActiveTab('map')}
            className={`px-4 sm:px-5 py-2 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2 transition ${
              activeTab === 'map'
                ? 'bg-sky-600 text-white shadow-lg shadow-sky-950/60'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Live Map</span>
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <BfpMadridLogo size="sm" />
          <span className="hidden sm:inline">
            <strong className="text-white font-semibold">BFP Madrid</strong> Hotline: {OFFICIAL_MADRID_HOTLINES.bfp.displayNumber}
          </span>
        </div>
      </div>

      {/* TAB 1: REPORT PHOTO */}
      {activeTab === 'upload' && (
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-2xl mx-auto w-full space-y-4">
          {/* Automatic Address Card */}
          <div className="p-4 rounded-3xl bg-slate-900 border border-emerald-500/40 shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                    Your Location (Automatically Detected)
                  </div>
                  {isResolvingAddress ? (
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                      <span>Detecting your address in Madrid...</span>
                    </div>
                  ) : (
                    <div className="mt-1">
                      <div className="text-sm sm:text-base font-bold text-white">
                        {identifiedAddress?.fullAddress || 'Brgy. Linungao (Poblacion), Madrid, Surigao del Sur'}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        Automatically identified &bull; Dispatches to BFP ({OFFICIAL_MADRID_HOTLINES.bfp.displayNumber}) &amp; MDRRMO ({OFFICIAL_MADRID_HOTLINES.mdrrmo.displayNumber})
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {onRefreshLocation && (
                <button
                  type="button"
                  onClick={onRefreshLocation}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition shrink-0"
                  title="Refresh GPS"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-2xl bg-rose-950 border border-rose-800 text-xs text-rose-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form: Photo Upload Only */}
          <form onSubmit={handleSubmitPhoto} className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
            />

            {!photoDataUrl ? (
              <div className="rounded-3xl border-2 border-dashed border-slate-700 p-6 sm:p-8 bg-slate-900/50 text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-rose-600/20 text-rose-500 mx-auto flex items-center justify-center shadow-lg">
                  <Camera className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Upload or Take Emergency Photo</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    The app will automatically identify what kind of help is needed and text BFP Madrid &amp; MDRRMO.
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="py-3 px-6 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg transition active:scale-95"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Take Photo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="py-3 px-6 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase tracking-wider flex items-center gap-2 border border-slate-700 transition active:scale-95"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Choose from Files</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Photo Preview */}
                <div className="rounded-3xl overflow-hidden border-2 border-rose-500 bg-slate-900 relative shadow-2xl">
                  <img
                    src={photoDataUrl}
                    alt="Emergency Preview"
                    className="w-full h-64 sm:h-72 object-cover"
                  />
                  <div className="p-3 bg-slate-900/90 backdrop-blur-md flex items-center justify-between gap-2 flex-wrap">
                    <div className="text-xs font-semibold text-white flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>
                        {hasUserUploadedPhoto
                          ? 'Photo attached from device'
                          : selectedGuidance
                          ? `Guidance selected: ${MADRID_GUIDANCE_OPTIONS.find((c) => c.id === selectedGuidance)?.title} (Blank • No photo attached)`
                          : 'Incident guidance loaded'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {!hasUserUploadedPhoto && (
                        <button
                          type="button"
                          onClick={() => cameraInputRef.current?.click()}
                          className="py-1 px-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1 transition shadow"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>Attach Photo</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setPhotoDataUrl(null);
                          setHasUserUploadedPhoto(false);
                          setSelectedGuidance(null);
                          setAutoIdentifiedHelp(null);
                        }}
                        className="py-1 px-3 rounded-xl bg-slate-800 text-slate-300 text-xs hover:bg-slate-700 transition"
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                </div>

                {/* AUTOMATICALLY IDENTIFIED HELP CARD */}
                <div className="p-4 rounded-3xl bg-slate-900 border-2 border-amber-500/60 shadow-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
                      <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                        Automatically Identified Help Needed
                      </span>
                    </div>
                    {isAnalyzingPhoto ? (
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                        Analyzing...
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
                        CONFIDENCE: {autoIdentifiedHelp?.confidence || 96}%
                      </span>
                    )}
                  </div>

                  {isAnalyzingPhoto ? (
                    <div className="py-2 text-xs text-slate-400 flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                      <span>Analyzing scene and identifying emergency requirements...</span>
                    </div>
                  ) : autoIdentifiedHelp ? (
                    <div className="space-y-1.5 pt-1">
                      <div className="text-base font-bold text-white flex items-center gap-2">
                        <span>
                          {autoIdentifiedHelp.category === 'fire'
                            ? '🔥'
                            : autoIdentifiedHelp.category === 'vehicular'
                            ? '🚗'
                            : autoIdentifiedHelp.category === 'medical'
                            ? '🚑'
                            : '🛡️'}
                        </span>
                        <span>{autoIdentifiedHelp.kindOfHelp}</span>
                      </div>

                      <div className="text-xs text-slate-300">
                        <strong>Classification:</strong> {autoIdentifiedHelp.subcategory}
                      </div>

                      <div className="text-xs text-emerald-400 font-medium">
                        <strong>Assigned Response:</strong> {autoIdentifiedHelp.recommendedUnitName}
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 mt-1">
                        <div className="text-slate-300 font-semibold mb-0.5">Automated Scene Assessment:</div>
                        {autoIdentifiedHelp.explanation}
                      </div>

                      <div className="text-[11px] text-amber-300/90 font-medium mt-1">
                        💡 <strong>Safety advice:</strong> {autoIdentifiedHelp.civilianAdvice}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            {/* Madrid Incident Hazard Guidance Photos - Blank No Photos Yet */}
            <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <div>
                  <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <span>Madrid Incident Guidance Photos</span>
                    <span className="px-2 py-0.5 rounded-full text-[9px] bg-slate-800 text-slate-400 border border-slate-700 font-bold">
                      Blank &bull; No Photos Yet
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Client can only choose from the 4 emergency incident categories below:
                  </div>
                </div>
                {selectedGuidance && (
                  <span className="text-[10px] font-black text-rose-400 bg-rose-950/70 border border-rose-800 px-2 py-0.5 rounded-lg flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse"></span>
                    <span>{MADRID_GUIDANCE_OPTIONS.find((c) => c.id === selectedGuidance)?.title} Selected</span>
                  </span>
                )}
              </div>

              {/* Strict 4 Choices: House Fire, Grass Fire, Vehicle Crash, Medical Attention */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {MADRID_GUIDANCE_OPTIONS.map((item) => {
                  const isSelected = selectedGuidance === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectGuidanceCategory(item)}
                      className={`relative p-2.5 rounded-2xl border text-left transition flex flex-col justify-between group ${
                        isSelected
                          ? 'border-rose-500 bg-rose-950/40 ring-2 ring-rose-500/60 shadow-lg shadow-rose-950/50'
                          : 'border-slate-800 bg-slate-950/80 hover:border-slate-700 hover:bg-slate-900/90'
                      }`}
                    >
                      {/* Blank Photo Placeholder Frame (No photos yet) */}
                      <div className="w-full h-16 rounded-xl border border-dashed border-slate-700 bg-slate-900/90 flex flex-col items-center justify-center gap-1 overflow-hidden relative group-hover:border-slate-600 transition">
                        <span className="text-xl">{item.icon}</span>
                        <span className="text-[9px] font-semibold text-slate-500 tracking-tight">
                          No photo yet
                        </span>
                        {isSelected && (
                          <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px] font-black shadow">
                            ✓
                          </div>
                        )}
                      </div>

                      <div className="mt-2">
                        <div className={`text-xs font-black tracking-tight ${isSelected ? 'text-rose-300' : 'text-slate-200'}`}>
                          {item.title}
                        </div>
                        <div className="text-[10px] text-slate-400 leading-tight mt-0.5 line-clamp-2">
                          {item.subtitle}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Big Send Emergency Photo / Report Button */}
            <button
              type="submit"
              disabled={isSubmitting || (!photoDataUrl && !selectedGuidance)}
              className="w-full py-4 rounded-2xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-black text-sm uppercase tracking-wider transition shadow-xl shadow-rose-950/70 flex items-center justify-center gap-2 active:scale-95"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Transmitting to BFP &amp; MDRRMO Responders...</span>
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  <span>
                    {hasUserUploadedPhoto
                      ? 'TRANSMIT PHOTO & TEXT BFP & MDRRMO'
                      : selectedGuidance
                      ? `TRANSMIT ${MADRID_GUIDANCE_OPTIONS.find((c) => c.id === selectedGuidance)?.title.toUpperCase()} REPORT`
                      : 'TRANSMIT EMERGENCY REPORT'}
                  </span>
                </>
              )}
            </button>
          </form>

          {/* Friendly Success Card & Dual SMS Dispatch Confirmation */}
          {lastSubmittedReport && (
            <div className="p-4 rounded-3xl bg-slate-900 border-2 border-emerald-500/70 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span className="font-bold text-white text-sm">
                    Reported &amp; Dispatched: {lastSubmittedReport.incidentNumber}
                  </span>
                </div>
                <button
                  onClick={() => setActiveTab('map')}
                  className="py-1 px-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1 transition"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>View on Map</span>
                </button>
              </div>

              {/* Text Message Delivery Confirmation */}
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-emerald-400" />
                  <span>Incident Reported via Text to Madrid Hotlines:</span>
                </div>
                <div className="text-xs text-slate-300 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">🔥 BFP Madrid Fire Station:</span>
                    <strong className="text-rose-400 font-mono">{OFFICIAL_MADRID_HOTLINES.bfp.displayNumber}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">🚑 MDRRMO Madrid Rescue:</span>
                    <strong className="text-sky-400 font-mono">{OFFICIAL_MADRID_HOTLINES.mdrrmo.displayNumber}</strong>
                  </div>
                </div>

                {/* Direct Android Phone SMS app buttons */}
                <div className="pt-2 flex flex-wrap gap-2">
                  <a
                    href={createDualStationSmsUri(formatIncidentSms(lastSubmittedReport))}
                    className="flex-1 py-2 px-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow transition"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Open Phone SMS App</span>
                  </a>
                  <a
                    href={`tel:${OFFICIAL_MADRID_HOTLINES.bfp.smsNumber}`}
                    className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 shadow transition"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Call BFP</span>
                  </a>
                </div>
              </div>

              <div className="text-xs text-slate-300">
                <strong>Auto-Identified:</strong> {lastSubmittedReport.title} &bull; Responding:{' '}
                <span className="text-emerald-400 font-semibold">{lastSubmittedReport.assignedUnitName}</span>
              </div>
            </div>
          )}

          {/* User's Recent Emergencies */}
          {userReports.length > 0 && (
            <div className="pt-2">
              <div className="text-xs font-bold uppercase text-slate-400 mb-2">
                Your Reported Emergencies ({userReports.length})
              </div>
              <div className="space-y-2">
                {userReports.map((r) => (
                  <div
                    key={r.id}
                    className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-3">
                      {r.photos && r.photos[0] && (
                        <img
                          src={r.photos[0].dataUrl}
                          alt="Report thumbnail"
                          className="w-12 h-12 rounded-xl object-cover"
                        />
                      )}
                      <div>
                        <div className="font-bold text-white">{r.incidentNumber}</div>
                        <div className="text-[11px] text-slate-400">
                          {r.location.streetAddress || `Brgy. ${r.location.barangay}`}
                        </div>
                        {r.assignedUnitName && (
                          <div className="text-[11px] text-emerald-400 font-semibold">
                            Responding: {r.assignedUnitName}
                          </div>
                        )}
                      </div>
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                        r.status === 'resolved'
                          ? 'bg-emerald-950 text-emerald-400'
                          : 'bg-amber-950 text-amber-400'
                      }`}
                    >
                      {r.status.replace('_', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* App Details & Developer Credit Footer Card */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <BfpMadridLogo size="sm" />
              <div>
                <div className="font-bold text-white uppercase text-[11px]">
                  {appConfig.appName || 'BFP MADRID EMERGENCY NOTIFIER'}
                </div>
                <div className="text-[10px] text-amber-400 font-semibold flex items-center gap-1.5 mt-0.5">
                  <span>Build by <strong className="text-white">{appConfig.builtBy || 'FO1 Evangelio'}</strong></span>
                  <span>&bull;</span>
                  <span>{appConfig.buildDate || 'September 23, 2026'}</span>
                </div>
                <div className="text-[10px] text-slate-400">
                  {appConfig.stationName} &bull; Surigao del Sur
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsAppInfoOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[11px] font-bold transition flex items-center gap-1.5"
            >
              <Info className="w-3.5 h-3.5 text-amber-400" />
              <span>App Details</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: MAP */}
      {activeTab === 'map' && (
        <div className="flex-1 relative w-full h-full overflow-hidden">
          <LeafletEmergencyMap
            reports={reports}
            userCoords={userCoords}
            selectedReportId={lastSubmittedReport?.id || (reports.length > 0 ? reports[0].id : null)}
            onSelectReport={(report) => {
              if (onSelectIncidentOnMap) onSelectIncidentOnMap(report);
            }}
            responderUnits={responderUnits}
            isNightMode={true}
          />
        </div>
      )}

      {/* App Details & Developer Build Credits Modal */}
      <AppInfoModal isOpen={isAppInfoOpen} onClose={() => setIsAppInfoOpen(false)} />
    </div>
  );
}
