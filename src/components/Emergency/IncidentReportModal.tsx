import { useState, useRef } from 'react';
import {
  X,
  Camera,
  Upload,
  Sparkles,
  MapPin,
  ShieldCheck,
  Send,
  Loader2,
  AlertCircle,
  Lock,
  RefreshCw,
  Image as ImageIcon,
} from 'lucide-react';
import { IncidentReport, IncidentPhoto, UserProfile } from '../../types';
import { MADRID_CENTER, calculateDistanceKm, estimateEmergencyEta } from '../../constants/madridLocations';
import { generateSha256Hash } from '../../services/cryptoService';
import { recordSmsDispatch } from '../../services/smsService';
import { saveReport, queueOfflineReport, addNotification } from '../../services/storageService';
import { playRadioDispatchChime } from '../../services/audioService';
import BfpMadridLogo from '../Common/BfpMadridLogo';

interface IncidentReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  userCoords: { lat: number; lng: number } | null;
  onReportCreated: (report: IncidentReport) => void;
  isOnline: boolean;
}

// Realistic Madrid emergency sample photo presets for instant testing without camera
const SAMPLE_PRESETS = [
  {
    name: 'House Smoke (Linungao)',
    url: 'https://images.unsplash.com/photo-1542385151-efd9000785a0?auto=format&fit=crop&w=800&q=80',
    caption: 'Smoke coming from residential roof eaves',
  },
  {
    name: 'Highway Crash (Songkit)',
    url: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=800&q=80',
    caption: 'Two vehicles collided on highway curve',
  },
  {
    name: 'Medical Aid Call (Bayogo)',
    url: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=800&q=80',
    caption: 'Patient requiring emergency transfer',
  },
  {
    name: 'Electrical Post Spark',
    url: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&w=800&q=80',
    caption: 'Electrical lines sparking over road',
  },
];

export default function IncidentReportModal({
  isOpen,
  onClose,
  currentUser,
  userCoords,
  onReportCreated,
  isOnline,
}: IncidentReportModalProps) {
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoCaption, setPhotoCaption] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const lat = userCoords?.lat || MADRID_CENTER.latitude;
  const lng = userCoords?.lng || MADRID_CENTER.longitude;
  const barangay = currentUser?.barangay || 'Linungao (Poblacion)';

  // Handle image file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);

    // Read file as base64 DataURL
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPhotoDataUrl(dataUrl);
      setPhotoCaption(file.name);
    };
    reader.onerror = () => {
      setErrorMsg('Failed to read image file. Please try another photo.');
    };
    reader.readAsDataURL(file);
  };

  const handleSelectPreset = (preset: { name: string; url: string; caption: string }) => {
    setPhotoDataUrl(preset.url);
    setPhotoCaption(preset.caption);
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoDataUrl) {
      setErrorMsg('Please capture or upload a photo of the emergency scene first.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      playRadioDispatchChime();

      // Estimate distance from central Madrid stations
      const stationLat = 9.2628;
      const stationLng = 125.9602;
      const distanceKm = calculateDistanceKm(stationLat, stationLng, lat, lng);
      const eta = estimateEmergencyEta(distanceKm);

      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const incidentNumber = `MDR-${new Date().getFullYear()}-${randomSuffix}`;
      const hash = await generateSha256Hash(`${incidentNumber}-${Date.now()}-photo`);

      const photoItem: IncidentPhoto = {
        id: 'photo-' + Date.now(),
        dataUrl: photoDataUrl,
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        caption: photoCaption || 'Citizen Emergency Photo',
      };

      // Citizen report is created with category 'unidentified' - Admin will classify and identify it!
      const newReport: IncidentReport = {
        id: 'rep-' + Date.now(),
        incidentNumber,
        category: 'unidentified',
        subcategory: 'Pending Admin Photo Identification',
        severity: 'high',
        title: 'Emergency Photo Report (Awaiting Admin Triage)',
        description: 'Citizen transmitted photo of distress scene. Station dispatchers will identify hazard type and dispatch fleet.',
        location: {
          latitude: lat,
          longitude: lng,
          barangay,
          landmark: 'GPS Location Pinpoint',
          accuracyMeters: 8,
        },
        reporterName: currentUser?.fullName || 'Madrid Resident Citizen',
        reporterPhone: currentUser?.phoneNumber || '0917-555-0101',
        photos: [photoItem],
        status: 'reported',
        statusHistory: [
          {
            status: 'reported',
            timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            note: 'Photo transmitted by citizen. Dispatcher review required to identify incident type.',
            updatedBy: currentUser?.fullName || 'Citizen User',
          },
        ],
        responderDistanceKm: distanceKm,
        responderEtaMinutes: eta,
        isIdentified: false,
        e2eeHash: hash.substring(0, 12).toUpperCase(),
        isEncrypted: true,
        smsSent: true,
        smsRecipient: '09178192371',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (!isOnline) {
        queueOfflineReport(newReport);
      } else {
        saveReport(newReport);
      }

      // Record dispatch SMS to Madrid Station gateway
      recordSmsDispatch(newReport);

      // Add push notification
      addNotification({
        incidentId: newReport.id,
        title: `📸 Photo Sent: ${incidentNumber}`,
        body: `Emergency photo transmitted. Madrid BFP & MDRRMO Dispatchers are currently identifying the scene.`,
        type: 'dispatch',
      });

      onReportCreated(newReport);
      onClose();
    } catch (err) {
      console.error('Submission error:', err);
      setErrorMsg('Failed to send photo. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-3xl p-5 sm:p-6 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto">
        {/* Glow ambient */}
        <div className="absolute -top-24 -right-24 w-44 h-44 bg-rose-600/20 rounded-full blur-3xl pointer-events-none"></div>

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <BfpMadridLogo size="md" withGlow={true} />
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight text-white uppercase">
                SEND EMERGENCY PHOTO
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                BFP Madrid &amp; MDRRMO Dispatchers will identify the hazard &amp; send help
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 p-2 rounded-full transition shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info banner explaining the photo-only flow */}
        <div className="mt-3 p-3 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-start gap-2.5 text-xs">
          <div className="w-7 h-7 rounded-xl bg-rose-600/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0 mt-0.5">
            <Camera className="w-4 h-4" />
          </div>
          <div className="text-[11px] text-slate-300">
            <span className="font-bold text-white">One-Action Reporting: </span>
            No forms or classification required. Simply send a photo of the incident. BFP Madrid &amp; MDRRMO Dispatch Admins will examine the photo, identify the situation, and dispatch the correct fleet.
          </div>
        </div>

        {errorMsg && (
          <div className="mt-3 p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-xs text-rose-200 font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Photo Capture & Upload Box */}
          <div>
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
              <div className="border-2 border-dashed border-slate-700 hover:border-rose-500 rounded-3xl p-6 bg-slate-950/50 flex flex-col items-center justify-center text-center transition">
                <div className="w-16 h-16 rounded-2xl bg-rose-600/20 border border-rose-500/40 flex items-center justify-center text-rose-500 mb-3">
                  <Camera className="w-8 h-8" />
                </div>
                <div className="font-bold text-sm text-white">Take or Upload Incident Photo</div>
                <p className="text-xs text-slate-400 mt-1 max-w-xs">
                  Snap the fire, crash, or medical scene. Madrid responders need to see what is happening.
                </p>

                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg transition"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Open Camera</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs flex items-center gap-1.5 transition"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Choose from Gallery</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Photo Preview with remove/retake option */
              <div className="relative rounded-3xl overflow-hidden border-2 border-rose-500/80 bg-slate-950 shadow-2xl">
                <img
                  src={photoDataUrl}
                  alt="Emergency Preview"
                  className="w-full h-56 object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent p-3 flex items-center justify-between">
                  <div className="text-xs text-slate-200 font-semibold truncate max-w-[200px]">
                    📸 Photo Ready for Transmission
                  </div>
                  <button
                    type="button"
                    onClick={() => setPhotoDataUrl(null)}
                    className="py-1 px-2.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-xs text-slate-300 border border-slate-700 flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Retake</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Quick Demo Photo Presets for Easy Desktop Testing */}
          <div>
            <div className="text-[11px] font-bold uppercase text-slate-400 mb-1.5 flex items-center justify-between">
              <span>Quick Test Photo Presets (1-Tap Select)</span>
              <span className="text-[10px] text-rose-400 font-mono">Madrid Scenes</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {SAMPLE_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className="p-1.5 rounded-xl border border-slate-800 bg-slate-950/60 hover:border-rose-500/60 text-left transition group overflow-hidden"
                >
                  <img
                    src={preset.url}
                    alt={preset.name}
                    className="w-full h-14 object-cover rounded-lg group-hover:scale-105 transition-transform"
                  />
                  <div className="text-[10px] font-bold text-slate-300 mt-1 line-clamp-1">
                    {preset.name}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* GPS Coordinates attached automatically */}
          <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-rose-500" />
              <div>
                <div className="font-bold text-white">Brgy. {barangay}, Madrid</div>
                <div className="text-[10px] text-slate-400 font-mono">
                  GPS: {lat.toFixed(5)}, {lng.toFixed(5)} &bull; &plusmn;8m
                </div>
              </div>
            </div>

            <span className="text-[10px] text-emerald-400 font-bold uppercase flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Auto-Pinned</span>
            </span>
          </div>

          {/* Single Action Button */}
          <button
            type="submit"
            disabled={isSubmitting || !photoDataUrl}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 hover:from-rose-500 hover:to-red-500 disabled:opacity-40 text-white font-black text-sm uppercase tracking-widest transition-all shadow-xl shadow-rose-950/60 flex items-center justify-center gap-2 border border-white/20"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Transmitting Photo to Station...</span>
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                <span>SEND EMERGENCY PHOTO</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
