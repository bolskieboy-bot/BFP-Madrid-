import React, { useState } from 'react';
import {
  Shield,
  Lock,
  User,
  Phone,
  KeyRound,
  UserPlus,
  ArrowRight,
  Eye,
  EyeOff,
  Flame,
  Radio,
  PhoneCall,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { UserProfile } from '../../types';
import { MADRID_BARANGAYS } from '../../constants/madridLocations';
import {
  authenticateAccount,
  registerNewCitizenAccount,
  getTotalRegisteredCount,
  getAccountCapacity,
  MAX_CITIZEN_ACCOUNTS,
} from '../../services/accountService';
import BfpMadridLogo from '../Common/BfpMadridLogo';

interface ModeLoginGateProps {
  mode: 'user' | 'admin';
  onLoginSuccess: (user: UserProfile) => void;
  onSwitchMode: (mode: 'user' | 'admin') => void;
  onOpenHotlines: () => void;
}

export default function ModeLoginGate({
  mode,
  onLoginSuccess,
  onSwitchMode,
  onOpenHotlines,
}: ModeLoginGateProps) {
  const [subMode, setSubMode] = useState<'login' | 'register'>('login');

  // Login inputs
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Register inputs (for citizens)
  const [regFullName, setRegFullName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regBarangay, setRegBarangay] = useState('Linungao (Poblacion)');
  const [regPassword, setRegPassword] = useState('');
  const [regEmergencyContact, setRegEmergencyContact] = useState('');
  const [regEmergencyPhone, setRegEmergencyPhone] = useState('0917-819-2371');

  const capacity = getAccountCapacity();

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!identifier.trim()) {
      setErrorMsg('Please enter your account username or mobile number.');
      return;
    }
    if (!password) {
      setErrorMsg('Please enter your password.');
      return;
    }

    setIsSubmitting(true);
    const res = authenticateAccount(identifier.trim(), password);
    setIsSubmitting(false);

    if (!res.success || !res.user) {
      setErrorMsg(res.error || 'Authentication failed. Please verify credentials.');
      return;
    }

    // Role enforcement
    if (mode === 'admin' && res.user.role !== 'admin_dispatcher') {
      setErrorMsg('This account does not have Admin Dispatcher privileges. Please log in with an Admin account (Admin1 or Admin2).');
      return;
    }

    onLoginSuccess(res.user);
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanPhone = regPhone.replace(/[^\d+]/g, '');
    const cleanPhDigits = cleanPhone.replace(/\D/g, '');
    const isValidPh =
      (cleanPhDigits.startsWith('09') && cleanPhDigits.length === 11) ||
      (cleanPhDigits.startsWith('639') && cleanPhDigits.length === 12);

    if (!isValidPh) {
      setErrorMsg('Please enter a valid Philippine mobile number (e.g. 0917 123 4567).');
      return;
    }

    setIsSubmitting(true);
    const res = registerNewCitizenAccount({
      username: regUsername.trim(),
      password: regPassword,
      fullName: regFullName.trim(),
      phoneNumber: regPhone.trim(),
      barangay: regBarangay,
      emergencyContactName: regEmergencyContact.trim() || 'Family / Relative',
      emergencyContactPhone: regEmergencyPhone.trim() || '0917-819-2371',
    });
    setIsSubmitting(false);

    if (!res.success || !res.user) {
      setErrorMsg(res.error || 'Registration failed. Please check inputs.');
      return;
    }

    onLoginSuccess(res.user);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl shadow-2xl backdrop-blur-md overflow-hidden relative">
        {/* Subtle decorative glow */}
        <div
          className={`absolute -top-24 -left-24 w-56 h-56 rounded-full blur-3xl pointer-events-none ${
            mode === 'admin' ? 'bg-amber-600/20' : 'bg-rose-600/20'
          }`}
        />
        <div
          className={`absolute -bottom-24 -right-24 w-56 h-56 rounded-full blur-3xl pointer-events-none ${
            mode === 'admin' ? 'bg-rose-600/20' : 'bg-emerald-600/20'
          }`}
        />

        {/* Header Branding */}
        <div className="p-6 pb-4 border-b border-slate-800/80 text-center relative z-10">
          <div className="flex justify-center mb-3">
            <BfpMadridLogo size="xl" withGlow={true} />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider mb-2 border shadow-sm">
            {mode === 'admin' ? (
              <span className="text-amber-400 bg-amber-950/80 border-amber-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Shield className="w-3 h-3 text-amber-400" />
                <span>ADMIN APP &bull; DISPATCHER LOGIN REQUIRED</span>
              </span>
            ) : (
              <span className="text-rose-400 bg-rose-950/80 border-rose-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Flame className="w-3 h-3 text-rose-400" />
                <span>CLIENT APP &bull; CITIZEN LOGIN REQUIRED</span>
              </span>
            )}
          </div>

          <h2 className="text-lg font-black text-white">
            {mode === 'admin'
              ? 'BFP Madrid & MDRRMO Command Console'
              : 'Madrid Emergency Notifier'}
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
            {mode === 'admin'
              ? 'Official station admin credentials required to access incident radar, unit dispatch, and siren controls.'
              : 'Please log in with your resident account or register to transmit verified emergency reports.'}
          </p>
        </div>

        {/* Content Body */}
        <div className="p-6 relative z-10 space-y-4">
          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 rounded-2xl bg-rose-950/80 border border-rose-800 text-xs text-rose-200 flex items-start gap-2 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* ADMIN LOGIN VIEW */}
          {mode === 'admin' ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              {/* Constant Admin Notice Card */}
              <div className="p-3 rounded-2xl bg-slate-950/80 border border-amber-500/40 text-[11px] space-y-1.5">
                <div className="font-bold text-amber-400 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-amber-400" />
                  <span>Constant Official Admin Accounts:</span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                    <div className="font-mono font-bold text-amber-300">Admin1</div>
                    <div className="text-[10px] text-slate-400">Password: <span className="font-mono text-white font-bold">1234567</span></div>
                    <div className="text-[9px] text-slate-500 mt-0.5">BFP Fire Commander</div>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                    <div className="font-mono font-bold text-sky-300">Admin2</div>
                    <div className="text-[10px] text-slate-400">Password: <span className="font-mono text-white font-bold">1234567</span></div>
                    <div className="text-[9px] text-slate-500 mt-0.5">MDRRMO Chief</div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                  Admin Account Username
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Enter Admin1 or Admin2"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                    autoFocus
                  />
                  <Shield className="w-4 h-4 text-slate-500 absolute right-3 top-2.5" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter admin password (1234567)"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Quick Fill Buttons */}
              <div className="pt-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">
                  1-Tap Fill Admin Credentials:
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIdentifier('Admin1');
                      setPassword('1234567');
                      setErrorMsg(null);
                    }}
                    className="py-1.5 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-left transition"
                  >
                    <div className="text-[11px] font-bold text-amber-400">🚒 Admin 1 (BFP)</div>
                    <div className="text-[9px] text-slate-400">Pass: 1234567</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIdentifier('Admin2');
                      setPassword('1234567');
                      setErrorMsg(null);
                    }}
                    className="py-1.5 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-left transition"
                  >
                    <div className="text-[11px] font-bold text-sky-400">🚑 Admin 2 (MDRRMO)</div>
                    <div className="text-[9px] text-slate-400">Pass: 1234567</div>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white font-black text-xs uppercase tracking-wider transition shadow-xl shadow-amber-950/50 flex items-center justify-center gap-2 active:scale-95"
              >
                <Shield className="w-4 h-4" />
                <span>Verify &amp; Enter Admin Console</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            /* CLIENT LOGIN / REGISTER VIEW */
            <div>
              {/* Tab Switcher */}
              <div className="flex border-b border-slate-800 mb-4">
                <button
                  type="button"
                  onClick={() => {
                    setSubMode('login');
                    setErrorMsg(null);
                  }}
                  className={`flex-1 pb-2.5 text-xs font-bold border-b-2 transition flex items-center justify-center gap-1.5 ${
                    subMode === 'login'
                      ? 'border-rose-500 text-rose-400 font-black'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Citizen Sign In</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSubMode('register');
                    setErrorMsg(null);
                  }}
                  className={`flex-1 pb-2.5 text-xs font-bold border-b-2 transition flex items-center justify-center gap-1.5 ${
                    subMode === 'register'
                      ? 'border-emerald-500 text-emerald-400 font-black'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Register ({capacity.available} open)</span>
                </button>
              </div>

              {subMode === 'login' ? (
                <form onSubmit={handleLoginSubmit} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                      Citizen Username or Mobile
                    </label>
                    <input
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="e.g. citizen_sample or 0917-555-0101"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500 font-mono"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter password..."
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500 font-mono pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Quick test citizen */}
                  <div className="pt-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                      Quick Sign-In Preset:
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIdentifier('citizen_sample');
                        setPassword('citizen123');
                        setErrorMsg(null);
                      }}
                      className="w-full py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-left transition flex items-center justify-between"
                    >
                      <div>
                        <span className="text-xs font-bold text-emerald-400">👤 Maria Santos (Citizen)</span>
                        <div className="text-[10px] text-slate-400">citizen_sample &bull; citizen123</div>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">Tap to load</span>
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3.5 px-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase tracking-wider transition shadow-xl shadow-rose-950/60 flex items-center justify-center gap-2 active:scale-95"
                  >
                    <Flame className="w-4 h-4" />
                    <span>Log In to Client App</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              ) : (
                /* CITIZEN REGISTER FORM */
                <form onSubmit={handleRegisterSubmit} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-0.5">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      value={regFullName}
                      onChange={(e) => setRegFullName(e.target.value)}
                      placeholder="e.g. Juan Dela Cruz"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-0.5">
                        Username *
                      </label>
                      <input
                        type="text"
                        value={regUsername}
                        onChange={(e) => setRegUsername(e.target.value)}
                        placeholder="juan2026"
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-0.5">
                        Password *
                      </label>
                      <input
                        type="password"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="Min 4 chars"
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-0.5">
                        Mobile Number *
                      </label>
                      <input
                        type="text"
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        placeholder="0917-123-4567"
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-0.5">
                        Barangay
                      </label>
                      <select
                        value={regBarangay}
                        onChange={(e) => setRegBarangay(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                      >
                        {MADRID_BARANGAYS.map((b) => (
                          <option key={b.name} value={b.name}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider transition shadow-xl shadow-emerald-950/50 flex items-center justify-center gap-2 active:scale-95"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Register Madrid Citizen Account</span>
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Quick Switch to the other mode */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => onSwitchMode(mode === 'admin' ? 'user' : 'admin')}
              className="text-slate-400 hover:text-white transition flex items-center gap-1 font-semibold"
            >
              <span>Switch to {mode === 'admin' ? '📱 Client App' : '🚒 Admin App'}</span>
            </button>

            <button
              type="button"
              onClick={onOpenHotlines}
              className="text-rose-400 hover:text-rose-300 transition flex items-center gap-1 font-bold"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Direct Hotlines</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
