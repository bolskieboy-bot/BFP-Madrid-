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

// The 4 allowed client emergency categories:
// Structural Fire, Grass Fire, Vehicular Accident, Medical Assistance
export type ModalEmergencyCategory = 'structural_fire' | 'grass_fire' | 'vehicular_accident' | 'medical_assistance';

interface ModalEmergencyCategoryItem {
  id: ModalEmergencyCategory;
  title: 'Structural Fire' | 'Grass Fire' | 'Vehicular Accident' | 'Medical Assistance';
  subtitle: string;
  icon: string;
  category: 'fire' | 'vehicular' | 'medical';
  subcategory: string;
  kindOfHelp: string;
  activeRing: string;
  activeBg: string;
}

const MODAL_CATEGORY_OPTIONS: ModalEmergencyCategoryItem[] = [
  {
    id: 'structural_fire',
    title: 'Structural Fire',
    subtitle: 'Residential house, commercial building or roof fire',
    icon: '🔥',
    category: 'fire',
    subcategory: 'Structural Fire',
    kindOfHelp: 'Structural Fire Suppression & BFP Engine Needed',
    activeRing: 'ring-rose-500 border-rose-500',
    activeBg: 'bg-rose-950/70',
  },
  {
    id: 'grass_fire',
    title: 'Grass Fire',
    subtitle: 'Agricultural field, grassland or brush blaze',
    icon: '🌾',
    category: 'fire',
    subcategory: 'Grass Fire',
    kindOfHelp: 'Grass Fire Suppression & Wildfire Crew Needed',
    activeRing: 'ring-amber-500 border-amber-500',
    activeBg: 'bg-amber-950/70',
  },
  {
    id: 'vehicular_accident',
    title: 'Vehicular Accident',
    subtitle: 'Highway crash, collision or vehicle rollover',
    icon: '🚗',
    category: 'vehicular',
    subcategory: 'Vehicular Accident',
    kindOfHelp: 'Vehicular Extrication & Emergency Ambulance Response Needed',
    activeRing: 'ring-sky-500 border-sky-500',
    activeBg: 'bg-sky-950/70',
  },
  {
    id: 'medical_assistance',
    title: 'Medical Assistance',
    subtitle: 'Acute medical emergency, cardiac or severe trauma',
    icon: '🚑',
    category: 'medical',
    subcategory: 'Medical Assistance',
    kindOfHelp: 'Emergency Medical Assistance & Rapid Transport Needed',
    activeRing: 'ring-emerald-500 border-emerald-500',
    activeBg: 'bg-emerald-950/70',
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
  const [selectedCategory, setSelectedCategory] = useState<ModalEmergencyCategory | null>(null);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoDataUrl) {
      setErrorMsg('Please capture or upload a photo of the emergency scene first.');
      return;
    }

    if (!selectedCategory) {
      setErrorMsg('Please select 1 of the 4 buttons: Structural Fire, Grass Fire, Vehicular Accident, or Medical Assistance.');
      return;
    }

    const chosenOption = MODAL_CATEGORY_OPTIONS.find((c) => c.id === selectedCategory)!;

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
        caption: `${chosenOption.title} Emergency Photo`,
        aiSceneAssessment: chosenOption.kindOfHelp,
      };

      const newReport: IncidentReport = {
        id: 'rep-' + Date.now(),
        incidentNumber,
        category: chosenOption.category,
        subcategory: chosenOption.subcategory,
        severity: chosenOption.category === 'fire' || chosenOption.category === 'medical' ? 'critical' : 'high',
        title: `${chosenOption.title} at Brgy. ${barangay}`,
        description: `Citizen live emergency photo transmitted. Hazard classified as ${chosenOption.title}. Dispatched to BFP Madrid & MDRRMO Madrid.`,
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
            note: `Photo transmitted by citizen. Category selected: ${chosenOption.title}.`,
            updatedBy: currentUser?.fullName || 'Citizen User',
          },
        ],
        responderDistanceKm: distanceKm,
        responderEtaMinutes: eta,
        isIdentified: true,
        identifiedBy: `Citizen Selection: ${chosenOption.title}`,
        e2eeHash: hash.substring(0, 12).toUpperCase(),
        isEncrypted: true,
        smsSent: true,
        smsRecipient: '09317218765, 09985521911',
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
        body: `Reported as ${chosenOption.title}. Transmitted to BFP & MDRRMO.`,
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

          {/* CHOOSE 1 OF 4 EMERGENCY BUTTONS */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-400">
                CHOOSE 1 OF 4 EMERGENCY BUTTONS:
              </span>
              {selectedCategory ? (
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/70 border border-emerald-800 px-2 py-0.5 rounded-lg">
                  {MODAL_CATEGORY_OPTIONS.find((c) => c.id === selectedCategory)?.title} Selected
                </span>
              ) : (
                <span className="text-[10px] text-slate-400">
                  Select after taking photo
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {MODAL_CATEGORY_OPTIONS.map((item) => {
                const isSelected = selectedCategory === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedCategory(item.id);
                      setErrorMsg(null);
                    }}
                    className={`p-3 rounded-2xl border-2 text-left transition-all flex flex-col justify-between ${
                      isSelected
                        ? `${item.activeRing} ${item.activeBg} ring-2 shadow-lg`
                        : 'border-slate-800 bg-slate-950/80 hover:border-slate-700 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-2xl">{item.icon}</span>
                      {isSelected && (
                        <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black bg-white text-slate-950 uppercase">
                          ✓
                        </span>
                      )}
                    </div>
                    <div className="mt-2">
                      <div className={`text-xs font-black ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                        {item.title}
                      </div>
                      <div className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                        {item.subtitle}
                      </div>
                    </div>
                  </button>
                );
              })}
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

          {/* Action Button */}
          <button
            type="submit"
            disabled={isSubmitting || !photoDataUrl || !selectedCategory}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 hover:from-rose-500 hover:to-red-500 disabled:opacity-40 text-white font-black text-sm uppercase tracking-widest transition-all shadow-xl shadow-rose-950/60 flex items-center justify-center gap-2 border border-white/20"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Transmitting Photo to Station...</span>
              </>
            ) : !photoDataUrl ? (
              <>
                <Camera className="w-5 h-5" />
                <span>TAKE OR UPLOAD PHOTO FIRST</span>
              </>
            ) : !selectedCategory ? (
              <>
                <AlertCircle className="w-5 h-5" />
                <span>CHOOSE 1 OF 4 BUTTONS TO TRANSMIT</span>
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                <span>
                  TRANSMIT {MODAL_CATEGORY_OPTIONS.find((c) => c.id === selectedCategory)?.title.toUpperCase()} REPORT
                </span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
