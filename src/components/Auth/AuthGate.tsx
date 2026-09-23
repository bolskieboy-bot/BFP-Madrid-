import React, { useState } from 'react';
import {
  Shield,
  Lock,
  User,
  Phone,
  MapPin,
  HeartPulse,
  UserPlus,
  LogIn,
  AlertTriangle,
  CheckCircle2,
  PhoneCall,
  Eye,
  EyeOff,
  Flame,
  Radio,
} from 'lucide-react';
import { UserProfile } from '../../types';
import { MADRID_BARANGAYS, MADRID_EMERGENCY_STATIONS } from '../../constants/madridLocations';
import {
  authenticateAccount,
  registerNewCitizenAccount,
  getTotalRegisteredCount,
} from '../../services/accountService';
import BfpMadridLogo from '../Common/BfpMadridLogo';
import AppBackground from '../Common/AppBackground';

interface AuthGateProps {
  onLoginSuccess: (user: UserProfile) => void;
  onOpenHotlines: () => void;
}

export default function AuthGate({ onLoginSuccess, onOpenHotlines }: AuthGateProps) {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Register form state
  const [regFullName, setRegFullName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regBarangay, setRegBarangay] = useState(MADRID_BARANGAYS[0].name);
  const [regEmergencyName, setRegEmergencyName] = useState('');
  const [regEmergencyPhone, setRegEmergencyPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    if (!loginIdentifier.trim()) {
      setLoginError('Please enter your username or registered mobile number.');
      return;
    }

    if (!loginPassword) {
      setLoginError('Please enter your password.');
      return;
    }

    setIsSubmitting(true);
    const result = authenticateAccount(loginIdentifier.trim(), loginPassword);
    setIsSubmitting(false);

    if (result.success && result.user) {
      onLoginSuccess(result.user);
    } else {
      setLoginError(result.error || 'Authentication failed. Please verify your credentials.');
    }
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);

    if (!regFullName.trim()) {
      setRegError('Full Name is required.');
      return;
    }

    if (!regUsername.trim() || regUsername.trim().length < 3) {
      setRegError('Username must be at least 3 characters long.');
      return;
    }

    const cleanPhone = regPhone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setRegError('Please enter a valid 11-digit mobile number (e.g. 0917-123-4567).');
      return;
    }

    if (!regPassword || regPassword.length < 3) {
      setRegError('Password must be at least 3 characters long.');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setRegError('Passwords do not match. Please re-enter.');
      return;
    }

    setIsSubmitting(true);
    const result = registerNewCitizenAccount({
      username: regUsername.trim(),
      password: regPassword,
      fullName: regFullName.trim(),
      phoneNumber: regPhone.trim(),
      barangay: regBarangay,
      emergencyContactName: regEmergencyName.trim() || 'Family / Relative',
      emergencyContactPhone: regEmergencyPhone.trim() || '0931-7218-765',
    });
    setIsSubmitting(false);

    if (result.success && result.user) {
      onLoginSuccess(result.user);
    } else {
      setRegError(result.error || 'Registration failed. Please check your information.');
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col justify-between relative overflow-x-hidden selection:bg-rose-500 selection:text-white">
      {/* Background Graphic from User Uploaded Poster */}
      <AppBackground dimAmount="medium" opacity={0.65} />

      {/* Main Container */}
      <div className="relative z-10 max-w-xl mx-auto w-full px-4 py-6 sm:py-10 flex-1 flex flex-col justify-center">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <BfpMadridLogo size="2xl" withGlow={true} />
          </div>

          <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white flex items-center justify-center gap-2">
            <span>BFP MADRID EMERGENCY NOTIFIER</span>
          </h1>

          <div className="mt-1 text-xs sm:text-sm font-semibold text-slate-300 flex items-center justify-center gap-2">
            <span className="text-rose-400">Bureau of Fire Protection</span>
            <span>&bull;</span>
            <span className="text-amber-400">MDRRMO</span>
            <span>&bull;</span>
            <span>Madrid, Surigao del Sur</span>
          </div>

          {/* Official Gate Notice */}
          <div className="mt-3 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-slate-700/80 text-[11px] text-slate-300 shadow-md">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>Official Emergency Portal &bull; Up to 500 Accounts &bull; Registration Required</span>
          </div>
        </div>

        {/* Auth Card */}
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl">
          {/* Mode Switch Tabs */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950/80 rounded-2xl mb-5 border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setAuthMode('login');
                setLoginError(null);
              }}
              className={`py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition ${
                authMode === 'login'
                  ? 'bg-rose-600 text-white shadow-lg shadow-rose-950/70'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setAuthMode('register');
                setRegError(null);
              }}
              className={`py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition ${
                authMode === 'register'
                  ? 'bg-rose-600 text-white shadow-lg shadow-rose-950/70'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              <span>Register (New Citizen)</span>
            </button>
          </div>

          {/* TAB 1: LOGIN */}
          {authMode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              {loginError && (
                <div className="p-3 rounded-2xl bg-rose-950/80 border border-rose-800/90 text-rose-200 text-xs flex items-start gap-2 animate-in fade-in">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>{loginError}</div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Username or Mobile Number
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder="Enter username or registered mobile (09XXXXXXXXX)"
                    className="w-full pl-10 pr-4 py-3 rounded-2xl bg-slate-950 border border-slate-700/80 text-white text-sm focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition"
                    autoComplete="username"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter your account password"
                    className="w-full pl-10 pr-10 py-3 rounded-2xl bg-slate-950 border border-slate-700/80 text-white text-sm focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3.5 top-3.5 text-slate-400 hover:text-white transition"
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-sm uppercase tracking-wider transition shadow-lg shadow-rose-950/70 flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In to Notifier</span>
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('register');
                    setRegError(null);
                  }}
                  className="text-xs text-rose-400 hover:text-rose-300 font-semibold transition"
                >
                  New to Madrid Notifier? Register your citizen account &rarr;
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: REGISTER CITIZEN ACCOUNT */}
          {authMode === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              {regError && (
                <div className="p-3 rounded-2xl bg-rose-950/80 border border-rose-800/90 text-rose-200 text-xs flex items-start gap-2 animate-in fade-in">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>{regError}</div>
                </div>
              )}

              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-300">
                <p className="font-semibold text-white mb-0.5">Registration Required</p>
                No one can join without registering first. Your profile ensures accurate GPS rescue dispatch and SMS confirmation from BFP Madrid.
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Full Legal Name *
                </label>
                <input
                  type="text"
                  value={regFullName}
                  onChange={(e) => setRegFullName(e.target.value)}
                  placeholder="e.g. Juan C. Dela Cruz"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-white text-sm focus:outline-none focus:border-rose-500"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Username *
                  </label>
                  <input
                    type="text"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                    placeholder="e.g. juandelacruz"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-white text-sm focus:outline-none focus:border-rose-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Mobile Phone *
                  </label>
                  <input
                    type="tel"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="0917-123-4567"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-white text-sm focus:outline-none focus:border-rose-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Madrid Barangay of Residence *
                </label>
                <select
                  value={regBarangay}
                  onChange={(e) => setRegBarangay(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-white text-sm focus:outline-none focus:border-rose-500"
                >
                  {MADRID_BARANGAYS.map((b) => (
                    <option key={b.name} value={b.name}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Emergency Contact Name
                  </label>
                  <input
                    type="text"
                    value={regEmergencyName}
                    onChange={(e) => setRegEmergencyName(e.target.value)}
                    placeholder="e.g. Maria Dela Cruz (Spouse)"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-white text-sm focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Emergency Contact Phone
                  </label>
                  <input
                    type="tel"
                    value={regEmergencyPhone}
                    onChange={(e) => setRegEmergencyPhone(e.target.value)}
                    placeholder="0917-819-2371"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-white text-sm focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Minimum 3 characters"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-white text-sm focus:outline-none focus:border-rose-500 pr-9"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
                    >
                      {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Confirm Password *
                  </label>
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-white text-sm focus:outline-none focus:border-rose-500"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm uppercase tracking-wider transition shadow-lg shadow-emerald-950/70 flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Complete Registration &amp; Enter App</span>
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setLoginError(null);
                  }}
                  className="text-xs text-slate-400 hover:text-white transition"
                >
                  Already registered? <span className="text-rose-400 font-semibold">Sign in here &rarr;</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Immediate Hotline Bypass for Active Emergencies */}
        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={onOpenHotlines}
            className="inline-flex items-center gap-2 py-2 px-4 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-rose-500/40 text-rose-300 text-xs font-bold transition shadow-lg"
          >
            <PhoneCall className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
            <span>Emergency right now? Direct Station Hotline Directory</span>
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 py-3 text-center text-[11px] text-slate-400 border-t border-slate-900 bg-slate-950/90">
        <p>
          BFP Madrid Fire Station &bull; MDRRMO Madrid &bull; Republic of the Philippines
        </p>
      </footer>
    </div>
  );
}
