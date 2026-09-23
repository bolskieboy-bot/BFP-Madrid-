import { useState } from 'react';
import {
  X,
  ShieldCheck,
  CheckCircle2,
  Users,
  ArrowRight,
  KeyRound,
  Shield,
  User,
  UserPlus,
  Lock,
  Eye,
  EyeOff,
  LogOut,
  Sparkles,
  Phone,
} from 'lucide-react';
import { UserProfile } from '../../types';
import { MADRID_BARANGAYS } from '../../constants/madridLocations';
import {
  authenticateAccount,
  registerNewCitizenAccount,
  getTotalRegisteredCount,
  getAccountCapacity,
  MAX_CITIZEN_ACCOUNTS,
  SEEDED_ACCOUNTS,
} from '../../services/accountService';
import { clearUserProfile } from '../../services/storageService';
import BfpMadridLogo from '../Common/BfpMadridLogo';

interface PhoneLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: UserProfile) => void;
  currentUser: UserProfile | null;
  onLogout?: () => void;
  targetRole?: 'citizen' | 'admin_dispatcher' | null;
}

export default function PhoneLoginModal({
  isOpen,
  onClose,
  onLoginSuccess,
  currentUser,
  onLogout,
  targetRole,
}: PhoneLoginModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');

  // Login Form States
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Register Form States (Taking 1 of the 297 open accounts)
  const [regFullName, setRegFullName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regBarangay, setRegBarangay] = useState('Linungao (Poblacion)');
  const [regEmergencyContact, setRegEmergencyContact] = useState('');
  const [regEmergencyPhone, setRegEmergencyPhone] = useState('0917-819-2371');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const totalRegistered = getTotalRegisteredCount();

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!loginIdentifier.trim()) {
      setErrorMsg('Please enter your account username or mobile number.');
      return;
    }
    if (!loginPassword) {
      setErrorMsg('Please enter your account password.');
      return;
    }

    const res = authenticateAccount(loginIdentifier.trim(), loginPassword);
    if (!res.success || !res.user) {
      setErrorMsg(res.error || 'Authentication failed. Please check your credentials.');
      return;
    }

    onLoginSuccess(res.user);
    onClose();
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanPhone = regPhone.replace(/[^\d+]/g, '');
    const cleanPhDigits = cleanPhone.replace(/\D/g, '');
    const isValidPh =
      (cleanPhDigits.startsWith('09') && cleanPhDigits.length === 11) ||
      (cleanPhDigits.startsWith('639') && cleanPhDigits.length === 12);

    if (!isValidPh) {
      setErrorMsg('Please enter a valid Philippine mobile number (e.g. 0917 123 4567).');
      return;
    }

    const res = registerNewCitizenAccount({
      fullName: regFullName,
      username: regUsername,
      password: regPassword,
      phoneNumber: regPhone,
      barangay: regBarangay,
      emergencyContactName: regEmergencyContact,
      emergencyContactPhone: regEmergencyPhone,
    });

    if (!res.success || !res.user) {
      setErrorMsg(res.error || 'Registration failed. Please try again.');
      return;
    }

    onLoginSuccess(res.user);
    onClose();
  };

  const handleSignOut = () => {
    clearUserProfile();
    if (onLogout) onLogout();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-3xl p-5 sm:p-6 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto">
        {/* Ambient Glow */}
        <div className="absolute -top-24 -right-24 w-44 h-44 bg-rose-600/20 rounded-full blur-3xl pointer-events-none"></div>

        {/* Header with Close */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <BfpMadridLogo size="md" withGlow={true} />
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight text-white uppercase">
                BFP MADRID EMERGENCY NOTIFIER
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Bureau of Fire Protection &bull; Madrid Station Secure Access
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

        {/* Official Registered Network Counter */}
        <div className="mt-3 p-3 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 font-bold">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-white flex items-center gap-1.5">
                <span>Network Registry:</span>
                <span className="font-mono text-emerald-400 font-black">
                  {totalRegistered} / {MAX_CITIZEN_ACCOUNTS} Accounts
                </span>
              </div>
              <p className="text-[10px] text-slate-400">
                Up to 500 accounts can register in the Madrid Municipal Emergency Network
              </p>
            </div>
          </div>

          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-950/80 border border-emerald-800 text-emerald-300">
            500 Max Capacity
          </span>
        </div>

        {/* If user is already logged in, show their active card */}
        {currentUser && (
          <div className="mt-3 p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/80 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-white ${
                    currentUser.role === 'admin_dispatcher' ? 'bg-amber-600' : 'bg-sky-600'
                  }`}
                >
                  {currentUser.role === 'admin_dispatcher' ? (
                    <Shield className="w-4 h-4" />
                  ) : (
                    <User className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <div className="font-bold text-white">
                    {currentUser.fullName}{' '}
                    {currentUser.username && (
                      <span className="text-amber-400 font-mono">(@{currentUser.username})</span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Role:{' '}
                    <span className="uppercase font-bold text-emerald-400">
                      {currentUser.role.replace('_', ' ')}
                    </span>{' '}
                    &bull; Brgy. {currentUser.barangay}
                  </div>
                </div>
              </div>

              <button
                onClick={handleSignOut}
                className="py-1 px-2.5 rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-700 text-rose-300 text-[11px] font-bold flex items-center gap-1 transition"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Switch / Sign Out</span>
              </button>
            </div>
          </div>
        )}

        {/* Feedback Messages */}
        {errorMsg && (
          <div className="mt-3 p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-xs text-rose-200 font-medium animate-in fade-in">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="mt-3 p-3 rounded-xl bg-emerald-950/80 border border-emerald-800 text-xs text-emerald-200 font-medium animate-in fade-in">
            {successMsg}
          </div>
        )}

        {/* Mode Switch Tabs */}
        <div className="mt-4 flex border-b border-slate-800">
          <button
            onClick={() => {
              setMode('login');
              setErrorMsg(null);
            }}
            className={`flex-1 pb-2.5 text-xs font-bold border-b-2 transition flex items-center justify-center gap-1.5 ${
              mode === 'login'
                ? 'border-rose-500 text-rose-400 font-black'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </button>
          <button
            onClick={() => {
              setMode('register');
              setErrorMsg(null);
            }}
            className={`flex-1 pb-2.5 text-xs font-bold border-b-2 transition flex items-center justify-center gap-1.5 ${
              mode === 'register'
                ? 'border-emerald-500 text-emerald-400 font-black'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Register New Citizen</span>
          </button>
        </div>

        {/* Form Body */}
        {mode === 'login' ? (
          /* Sign In Form */
          <form onSubmit={handleLoginSubmit} className="mt-4 space-y-3.5">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                Account / Username or Mobile Number
              </label>
              <input
                type="text"
                placeholder="Enter username or registered mobile (09XXXXXXXXX)"
                value={loginIdentifier}
                onChange={(e) => setLoginIdentifier(e.target.value)}
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
                  placeholder="Enter your account password..."
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
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

            <button
              type="submit"
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-black text-xs uppercase tracking-wider transition shadow-lg flex items-center justify-center gap-2"
            >
              <span>Log In to Madrid System</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {/* Demo Citizen Sign-In Preset */}
            <div className="pt-2 border-t border-slate-800">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Quick Resident Demo Login:
              </span>
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setLoginIdentifier('citizen_sample');
                    setLoginPassword('citizen123');
                  }}
                  className="w-full p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-left text-[11px] transition flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">👤</span>
                    <div>
                      <div className="font-bold text-emerald-400">Resident Demo Account</div>
                      <div className="text-slate-400 text-[10px]">Maria Santos &bull; Brgy. Linungao</div>
                    </div>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-bold px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/60">
                    Tap to Fill Demo
                  </span>
                </button>
              </div>
            </div>
          </form>
        ) : (
          /* Registration Form (Up to 500 accounts) */
          <form onSubmit={handleRegisterSubmit} className="mt-4 space-y-3">
            <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800/80 text-[11px] text-emerald-300 flex items-center justify-between gap-2">
              <span>Registration is required for all residents of Madrid, Surigao del Sur to report incidents.</span>
              <span className="shrink-0 px-2 py-0.5 rounded-md bg-emerald-800/80 text-white font-bold text-[10px]">
                Slot {totalRegistered + 1} / {MAX_CITIZEN_ACCOUNTS}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Maria Corazon Ramos"
                  value={regFullName}
                  onChange={(e) => setRegFullName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                  Account Username
                </label>
                <input
                  type="text"
                  placeholder="e.g. mariaramos"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                  Create Password
                </label>
                <input
                  type="password"
                  placeholder="Min 3 characters"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                  Philippine Mobile No.
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    placeholder="0917-xxx-xxxx"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                    required
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                Barangay of Residence (Madrid, Surigao del Sur)
              </label>
              <select
                value={regBarangay}
                onChange={(e) => setRegBarangay(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                {MADRID_BARANGAYS.map((b) => (
                  <option key={b.name} value={b.name}>
                    Brgy. {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                  Emergency Contact Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Jose Ramos (Spouse)"
                  value={regEmergencyContact}
                  onChange={(e) => setRegEmergencyContact(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                  Emergency Contact Phone
                </label>
                <input
                  type="tel"
                  placeholder="0918-xxx-xxxx"
                  value={regEmergencyPhone}
                  onChange={(e) => setRegEmergencyPhone(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider transition shadow-lg flex items-center justify-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              <span>Complete Registration</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
