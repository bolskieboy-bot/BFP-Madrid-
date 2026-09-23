import React from 'react';
import {
  X,
  Shield,
  Calendar,
  UserCheck,
  Building2,
  MapPin,
  Phone,
  Flame,
  CheckCircle2,
  Radio,
  Code2,
  Cpu,
  Layers,
} from 'lucide-react';
import { getAppDetailsConfig } from '../../services/storageService';
import BfpMadridLogo from './BfpMadridLogo';

interface AppInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AppInfoModal({ isOpen, onClose }: AppInfoModalProps) {
  if (!isOpen) return null;

  const config = getAppDetailsConfig();

  return (
    <div className="fixed inset-0 z-[700] flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-3xl p-5 sm:p-6 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto">
        {/* Modal Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Hero */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 pb-5 border-b border-slate-800">
          <BfpMadridLogo size="xl" withGlow={true} />
          <div className="text-center sm:text-left">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30 mb-1.5">
              <Flame className="w-3 h-3 text-rose-400" />
              <span>Official Emergency Response Platform</span>
            </div>
            <h2 className="text-lg sm:text-xl font-black uppercase text-white tracking-tight">
              {config.appName}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {config.stationName} &bull; Surigao del Sur, Caraga Region XIII
            </p>
          </div>
        </div>

        {/* Developer & Build Spotlight Banner */}
        <div className="mt-5 p-4 rounded-2xl bg-gradient-to-r from-amber-950/70 via-slate-900 to-rose-950/60 border border-amber-600/50 shadow-lg">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-400 mb-2">
            <Code2 className="w-4 h-4 text-amber-400" />
            <span>Developer &amp; Build Information</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">
                Built By
              </span>
              <div className="text-sm font-black text-white flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-amber-400" />
                <span>{config.builtBy || 'FO1 Evangelio'}</span>
              </div>
              <span className="text-[10px] text-slate-400">
                Bureau of Fire Protection - Madrid Station
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">
                Build Date
              </span>
              <div className="text-sm font-black text-amber-300 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-amber-400" />
                <span>{config.buildDate || 'September 23, 2026'}</span>
              </div>
              <span className="text-[10px] text-slate-400">
                Official Release {config.appVersion}
              </span>
            </div>
          </div>
        </div>

        {/* Station Command Details */}
        <div className="mt-4 p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
          <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-rose-400" />
            <span>Station Command &amp; Location</span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-white block">{config.stationName}</span>
                <span className="text-slate-400 text-[11px]">{config.stationAddress}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-[11px]">
              <div>
                <span className="text-slate-400 font-bold block">Station Commander (Admin1):</span>
                <span className="text-slate-200 font-semibold">{config.stationCommander}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold block">Operations Chief (Admin2):</span>
                <span className="text-slate-200 font-semibold">{config.operationsChief}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Operational Directives & Policies */}
        <div className="mt-4 p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2.5">
          <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span>App Operational Directives</span>
          </div>

          <ul className="space-y-2 text-[11px] text-slate-300">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong className="text-white">Citizen Handset Safety:</strong> Zero alarming sirens sound on citizen cellphones when reporting emergencies or sending photos.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong className="text-white">Admin Continuous Alarm:</strong> High-dB piercing sirens and repetitive vibration loops wake Admin1 and Admin2 duty phones even when backgrounded.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong className="text-white">GPS Geo-Tagging &amp; Madrid Coverage:</strong> Covers all 14 Madrid Barangays (Linungao, Bagsac, Bayogo, Manga, Magsaysay, Panayagon, Patong-patong, Quirino, San Antonio, San Roque, San Vicente, Songkit, Union).
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong className="text-white">Direct SMS &amp; Offline Queue:</strong> Pre-formatted SMS distress can be sent even without cellular data connection.
              </span>
            </li>
          </ul>
        </div>

        {/* Emergency Hotlines Summary */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
          <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
            <span className="text-[10px] text-rose-400 font-bold block">BFP Madrid</span>
            <span className="text-[11px] font-mono text-white font-bold">{config.bfpHotline}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
            <span className="text-[10px] text-amber-400 font-bold block">MDRRMO</span>
            <span className="text-[11px] font-mono text-white font-bold">{config.mdrmoHotline}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
            <span className="text-[10px] text-sky-400 font-bold block">PNP Madrid</span>
            <span className="text-[11px] font-mono text-white font-bold">{config.pnpHotline}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
            <span className="text-[10px] text-emerald-400 font-bold block">RHU Madrid</span>
            <span className="text-[11px] font-mono text-white font-bold">{config.rhuAmbulanceHotline}</span>
          </div>
        </div>

        {/* Footer Credit & Close Button */}
        <div className="mt-6 pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-[11px] text-slate-400 text-center sm:text-left">
            Built by <strong className="text-amber-400">{config.builtBy || 'FO1 Evangelio'}</strong> &bull; {config.buildDate || 'September 23, 2026'}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto py-2.5 px-6 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase tracking-wider transition"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
}
