import React, { useState } from 'react';
import {
  Settings,
  Save,
  RotateCcw,
  Volume2,
  BellRing,
  Phone,
  Building2,
  Shield,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  Radio,
  Code2,
  Calendar,
} from 'lucide-react';
import { UserProfile, AppDetailsConfig } from '../../types';
import {
  getAppDetailsConfig,
  saveAppDetailsConfig,
  DEFAULT_APP_DETAILS,
} from '../../services/storageService';
import { playAlarmingStationSiren, stopAllAlarmSounds } from '../../services/audioService';
import BfpMadridLogo from '../Common/BfpMadridLogo';

interface AppDetailsEditorProps {
  currentUser: UserProfile | null;
  onConfigSaved?: (config: AppDetailsConfig) => void;
}

export default function AppDetailsEditor({ currentUser, onConfigSaved }: AppDetailsEditorProps) {
  const [config, setConfig] = useState<AppDetailsConfig>(() => getAppDetailsConfig());
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isTestingAlarm, setIsTestingAlarm] = useState(false);

  const adminName = currentUser?.username || 'Admin1';

  const handleChange = (field: keyof AppDetailsConfig, value: any) => {
    setConfig((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = saveAppDetailsConfig(config, adminName);
    setConfig(updated);
    setSaveSuccess(true);
    if (onConfigSaved) onConfigSaved(updated);
    setTimeout(() => setSaveSuccess(false), 3500);
  };

  const handleResetDefaults = () => {
    if (window.confirm('Reset all station and app details back to Madrid Station official defaults?')) {
      const resetConfig = saveAppDetailsConfig(DEFAULT_APP_DETAILS, adminName);
      setConfig(resetConfig);
      if (onConfigSaved) onConfigSaved(resetConfig);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  const handleTestDisturbingAlarm = () => {
    setIsTestingAlarm(true);
    playAlarmingStationSiren(4);
    setTimeout(() => setIsTestingAlarm(false), 4200);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-rose-950/60 via-slate-900 to-amber-950/40 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <BfpMadridLogo size="lg" withGlow={true} />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black uppercase text-white tracking-tight">
                  APP &amp; STATION DETAILS EDITOR
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {adminName} Authorized
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                All 2 reserved administrators (Admin1 &amp; Admin2) can modify app branding, emergency station coordinates, hotlines, and disturbing alarm settings.
              </p>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-amber-300/90 font-semibold">
                <Code2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Build by <strong className="text-white">{config.builtBy || 'FO1 Evangelio'}</strong> &bull; {config.buildDate || 'September 23, 2026'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTestDisturbingAlarm}
              className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition ${
                isTestingAlarm
                  ? 'bg-rose-600 text-white border-rose-400 animate-pulse'
                  : 'bg-rose-950/50 hover:bg-rose-900/60 border-rose-700/60 text-rose-300'
              }`}
            >
              <Volume2 className="w-4 h-4" />
              <span>{isTestingAlarm ? 'Testing Siren...' : 'Test Disturbing Alarm'}</span>
            </button>
            {isTestingAlarm && (
              <button
                type="button"
                onClick={() => {
                  stopAllAlarmSounds();
                  setIsTestingAlarm(false);
                }}
                className="py-2 px-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700"
              >
                Mute
              </button>
            )}
          </div>
        </div>

        {saveSuccess && (
          <div className="p-4 rounded-2xl bg-emerald-950/80 border border-emerald-700/80 text-emerald-200 text-xs font-bold flex items-center gap-2.5 shadow-lg animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              App details successfully updated by <strong className="text-white">{config.lastUpdatedBy}</strong>!
              Changes have been synchronized across all citizen and admin devices.
            </div>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          {/* Section 1: Branding & Station Identity */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4 shadow-md">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-800 text-sm font-bold text-white uppercase tracking-wider">
              <Building2 className="w-4 h-4 text-rose-400" />
              <span>App Branding &amp; Station Identification</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  App Name (Title)
                </label>
                <input
                  type="text"
                  value={config.appName}
                  onChange={(e) => handleChange('appName', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-semibold focus:outline-none focus:border-rose-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Station Name
                </label>
                <input
                  type="text"
                  value={config.stationName}
                  onChange={(e) => handleChange('stationName', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-semibold focus:outline-none focus:border-rose-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Station Commander (Admin 1 Title)
                </label>
                <input
                  type="text"
                  value={config.stationCommander}
                  onChange={(e) => handleChange('stationCommander', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-semibold focus:outline-none focus:border-rose-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Operations Chief (Admin 2 Title)
                </label>
                <input
                  type="text"
                  value={config.operationsChief}
                  onChange={(e) => handleChange('operationsChief', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-semibold focus:outline-none focus:border-rose-500"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Station Physical Address
                </label>
                <input
                  type="text"
                  value={config.stationAddress}
                  onChange={(e) => handleChange('stationAddress', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-semibold focus:outline-none focus:border-rose-500"
                  required
                />
              </div>
            </div>
          </div>

          {/* Section 2: Official Hotlines */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4 shadow-md">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-800 text-sm font-bold text-white uppercase tracking-wider">
              <Phone className="w-4 h-4 text-emerald-400" />
              <span>Emergency Hotlines Displayed to Citizens</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-rose-300 uppercase tracking-wider mb-1.5">
                  BFP Madrid Fire Station Hotline
                </label>
                <input
                  type="text"
                  value={config.bfpHotline}
                  onChange={(e) => handleChange('bfpHotline', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-mono font-bold focus:outline-none focus:border-rose-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-amber-300 uppercase tracking-wider mb-1.5">
                  MDRRMO Madrid Rescue Hotline
                </label>
                <input
                  type="text"
                  value={config.mdrmoHotline}
                  onChange={(e) => handleChange('mdrmoHotline', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-mono font-bold focus:outline-none focus:border-rose-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-sky-300 uppercase tracking-wider mb-1.5">
                  PNP Madrid Police Station Hotline
                </label>
                <input
                  type="text"
                  value={config.pnpHotline}
                  onChange={(e) => handleChange('pnpHotline', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-mono font-bold focus:outline-none focus:border-rose-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-emerald-300 uppercase tracking-wider mb-1.5">
                  RHU Madrid Municipal Ambulance Hotline
                </label>
                <input
                  type="text"
                  value={config.rhuAmbulanceHotline}
                  onChange={(e) => handleChange('rhuAmbulanceHotline', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-mono font-bold focus:outline-none focus:border-rose-500"
                  required
                />
              </div>
            </div>
          </div>

          {/* Section 3: Public Emergency Advisory & Alarm Policies */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4 shadow-md">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-800 text-sm font-bold text-white uppercase tracking-wider">
              <Radio className="w-4 h-4 text-amber-400" />
              <span>Public Advisory Bulletin &amp; Disturbing Alarm Policy</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Current Public Emergency Advisory (Broadcast to Citizens)
              </label>
              <textarea
                rows={3}
                value={config.publicAdvisory}
                onChange={(e) => handleChange('publicAdvisory', e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-medium focus:outline-none focus:border-rose-500"
                required
              />
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <BellRing className="w-4 h-4 text-rose-500" />
                    <span>Disturbing Alarm Siren for Admins</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    When active, Admin1 and Admin2 mobile phones will alarm with high-dB piercing sound and heavy vibration even when app is closed.
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.disturbingAlarmEnabled}
                    onChange={(e) => handleChange('disturbingAlarmEnabled', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
                </label>
              </div>

              <div className="pt-2 border-t border-slate-800/80 text-[11px] text-emerald-400 font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Citizen Rule Enforced: Citizens receive zero alarm sounds when reporting or sending photos. Only admins alarm.</span>
              </div>
            </div>

            <div className="text-[11px] text-slate-500 flex items-center justify-between">
              <span>Last updated by: <strong className="text-slate-300">{config.lastUpdatedBy}</strong></span>
              <span>Timestamp: {new Date(config.lastUpdatedAt).toLocaleString()}</span>
            </div>
          </div>

          {/* Section 4: App Development & System Build Details */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4 shadow-md">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-800 text-sm font-bold text-amber-400 uppercase tracking-wider">
              <Code2 className="w-4 h-4 text-amber-400" />
              <span>App Development &amp; System Build Details</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-amber-300 uppercase tracking-wider mb-1.5">
                  Built By (Developer)
                </label>
                <input
                  type="text"
                  value={config.builtBy || 'FO1 Evangelio'}
                  onChange={(e) => handleChange('builtBy', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-bold focus:outline-none focus:border-amber-500"
                  required
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Designated Officer / System Builder
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-amber-300 uppercase tracking-wider mb-1.5">
                  Build Date
                </label>
                <input
                  type="text"
                  value={config.buildDate || 'September 23, 2026'}
                  onChange={(e) => handleChange('buildDate', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-bold focus:outline-none focus:border-amber-500"
                  required
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Official Release Deployment Date
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-amber-300 uppercase tracking-wider mb-1.5">
                  System Version
                </label>
                <input
                  type="text"
                  value={config.appVersion || 'v2.4.0 (Madrid Municipal BFP Dispatch Standard)'}
                  onChange={(e) => handleChange('appVersion', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:border-amber-500"
                  required
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Regional BFP Dispatch Release Standard
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-800/40 text-xs text-amber-200 flex items-center gap-2.5">
              <UserCheck className="w-4 h-4 text-amber-400 shrink-0" />
              <div>
                System officially credited: <strong className="text-white">Build by FO1 Evangelio on September 23, 2026</strong> for Madrid Municipal Fire Station.
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="py-3 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-bold text-xs flex items-center gap-2 transition"
            >
              <RotateCcw className="w-4 h-4 text-slate-400" />
              <span>Reset to Defaults</span>
            </button>

            <button
              type="submit"
              className="py-3.5 px-6 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase tracking-wider transition shadow-lg shadow-rose-950/70 flex items-center gap-2 active:scale-98"
            >
              <Save className="w-4 h-4" />
              <span>Save &amp; Broadcast App Details</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
