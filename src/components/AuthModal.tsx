import React, { useState } from 'react';
import { UserProfile } from '../types.ts';
import { X, ShieldAlert, Cpu, Terminal, KeyRound, Building2, Users } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (token: string, user: UserProfile) => void;
  initialMode?: 'register' | 'code' | 'admin';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialMode = 'register',
}) => {
  const [mode, setMode] = useState<'register' | 'code' | 'admin'>(initialMode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [teamName, setTeamName] = useState('');
  const [college, setCollege] = useState('');
  const [leadMember, setLeadMember] = useState('');
  const [secondMember, setSecondMember] = useState('');
  const [zone, setZone] = useState('South Zone');
  const [teamCode, setTeamCode] = useState('');
  const [adminPasskey, setAdminPasskey] = useState('');

  if (!isOpen) return null;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!teamName.trim() || !college.trim() || !leadMember.trim()) {
      setError('Please provide Team Name, College, and at least one team member.');
      return;
    }

    setLoading(true);
    try {
      const members = [leadMember.trim()];
      if (secondMember.trim()) members.push(secondMember.trim());

      const res = await fetch('/api/auth/register-team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamName: teamName.trim(),
          college: college.trim(),
          teamMembers: members,
          zone,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to register team terminal.');
      }

      onSuccess(data.token, data.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Connection failure to tournament server.');
    } finally {
      setLoading(false);
    }
  };

  const handleCodeLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanCode = teamCode.trim().toUpperCase();
    if (!cleanCode) {
      setError('Please enter your 4-digit Team Terminal Code (e.g. #TA-4091).');
      return;
    }

    setLoading(true);
    try {
      const formattedCode = cleanCode.startsWith('#') ? cleanCode : `#${cleanCode}`;
      const token = `ta_team_${formattedCode}`;

      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Team Terminal Code not recognized.');
      }

      onSuccess(token, data.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please check your team code.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!adminPasskey.trim()) {
      setError('Master Passkey is required.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passkey: adminPasskey.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Invalid Admin Master Passkey.');
      }

      onSuccess(data.token, data.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Admin authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-white border border-[#E5E0D8] rounded-3xl p-6 sm:p-8 shadow-2xl text-[#111808]">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-[#656858] hover:text-[#111808] hover:bg-[#F0EEE6] transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3.5 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-white border border-[#E5E0D8] p-1 flex items-center justify-center shadow-sm overflow-hidden shrink-0">
            <img
              src="/assets/aistudio/acd7f777-797e-4ce6-ae26-4077fe5fb474_aeab48d4.png"
              alt="TECH ARENA Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <h2 className="text-xl font-bold font-heading text-[#111808] tracking-tight">
              TERMINAL AUTHENTICATION
            </h2>
            <p className="text-xs text-[#656858]">TECH ARENA Inter-College Competition Protocol</p>
          </div>
        </div>

        {/* Navigation Mode Tabs */}
        <div className="grid grid-cols-3 gap-1 bg-[#F0EEE6] p-1 rounded-xl mb-6 border border-[#E5E0D8] text-xs font-medium">
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
            }}
            className={`py-2 rounded-lg transition-all cursor-pointer ${
              mode === 'register'
                ? 'bg-[#111808] text-[#FFF0BA] font-semibold shadow-sm'
                : 'text-[#656858] hover:text-[#111808]'
            }`}
          >
            Register Team
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('code');
              setError(null);
            }}
            className={`py-2 rounded-lg transition-all cursor-pointer ${
              mode === 'code'
                ? 'bg-[#111808] text-[#FFF0BA] font-semibold shadow-sm'
                : 'text-[#656858] hover:text-[#111808]'
            }`}
          >
            Team Code
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('admin');
              setError(null);
            }}
            className={`py-2 rounded-lg transition-all cursor-pointer ${
              mode === 'admin'
                ? 'bg-[#111808] text-[#FFF0BA] font-semibold shadow-sm'
                : 'text-[#656858] hover:text-[#111808]'
            }`}
          >
            Proctor Passkey
          </button>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="flex items-center gap-2 p-3.5 mb-5 rounded-2xl bg-rose-50 border border-rose-300 text-rose-800 text-xs">
            <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Form 1: Register Team */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#111808] uppercase tracking-wider mb-1.5 font-mono">
                Team Name
              </label>
              <div className="relative">
                <Terminal className="absolute left-3.5 top-3 w-4 h-4 text-[#8C9080]" />
                <input
                  type="text"
                  required
                  placeholder="e.g. CyberKnights"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="w-full bg-[#FAFAF7] border border-[#E5E0D8] focus:border-[#111808] rounded-xl pl-10 pr-3 py-2.5 text-sm text-[#111808] placeholder-[#8C9080] outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#111808] uppercase tracking-wider mb-1.5 font-mono">
                College / Institution
              </label>
              <div className="relative">
                <Building2 className="absolute left-3.5 top-3 w-4 h-4 text-[#8C9080]" />
                <input
                  type="text"
                  required
                  placeholder="e.g. KLE Technological University"
                  value={college}
                  onChange={(e) => setCollege(e.target.value)}
                  className="w-full bg-[#FAFAF7] border border-[#E5E0D8] focus:border-[#111808] rounded-xl pl-10 pr-3 py-2.5 text-sm text-[#111808] placeholder-[#8C9080] outline-none transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#111808] uppercase tracking-wider mb-1.5 font-mono">
                  Lead Competitor
                </label>
                <div className="relative">
                  <Users className="absolute left-3.5 top-3 w-4 h-4 text-[#8C9080]" />
                  <input
                    type="text"
                    required
                    placeholder="Member 1 Name"
                    value={leadMember}
                    onChange={(e) => setLeadMember(e.target.value)}
                    className="w-full bg-[#FAFAF7] border border-[#E5E0D8] focus:border-[#111808] rounded-xl pl-10 pr-3 py-2.5 text-sm text-[#111808] placeholder-[#8C9080] outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#111808] uppercase tracking-wider mb-1.5 font-mono">
                  Second Competitor <span className="text-[#8C9080] font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Member 2 Name"
                  value={secondMember}
                  onChange={(e) => setSecondMember(e.target.value)}
                  className="w-full bg-[#FAFAF7] border border-[#E5E0D8] focus:border-[#111808] rounded-xl px-3.5 py-2.5 text-sm text-[#111808] placeholder-[#8C9080] outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#111808] uppercase tracking-wider mb-1.5 font-mono">
                Zonal Division
              </label>
              <select
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                className="w-full bg-[#FAFAF7] border border-[#E5E0D8] focus:border-[#111808] rounded-xl px-3.5 py-2.5 text-sm text-[#111808] outline-none cursor-pointer"
              >
                <option value="South Zone">South Zone (Karnataka, Kerala, Tamil Nadu, AP, Telangana)</option>
                <option value="West Zone">West Zone (Maharashtra, Gujarat, Goa)</option>
                <option value="North Zone">North Zone (Delhi NCR, Punjab, UP, Rajasthan)</option>
                <option value="East Zone">East Zone (West Bengal, Odisha, North East)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 rounded-xl bg-[#111808] hover:bg-[#1f2b0f] text-[#FFF0BA] font-bold text-xs font-mono tracking-wider shadow-sm disabled:opacity-60 transition-all cursor-pointer"
            >
              {loading ? 'Initializing Terminal Node...' : 'Register & Launch Terminal'}
            </button>
          </form>
        )}

        {/* Form 2: Team Code Login */}
        {mode === 'code' && (
          <form onSubmit={handleCodeLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#111808] uppercase tracking-wider mb-1.5 font-mono">
                Enter Team Code
              </label>
              <div className="relative">
                <Terminal className="absolute left-3.5 top-3.5 w-4 h-4 text-[#8C9080]" />
                <input
                  type="text"
                  placeholder="#TA-4091"
                  value={teamCode}
                  onChange={(e) => setTeamCode(e.target.value)}
                  className="w-full bg-[#FAFAF7] border border-[#E5E0D8] focus:border-[#111808] rounded-xl pl-10 pr-3 py-3 text-base font-mono text-[#111808] placeholder-[#8C9080] outline-none tracking-widest uppercase transition-colors"
                />
              </div>
              <p className="text-[11px] text-[#656858] mt-1.5">
                Enter the assigned 4-digit code provided during registration to resume your assessment session.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-[#111808] hover:bg-[#1f2b0f] text-[#FFF0BA] font-bold text-xs font-mono tracking-wider shadow-sm disabled:opacity-60 transition-all cursor-pointer"
            >
              {loading ? 'Verifying Terminal...' : 'Authenticate Terminal'}
            </button>
          </form>
        )}

        {/* Form 3: Chief Proctor Admin Passkey */}
        {mode === 'admin' && (
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#111808] uppercase tracking-wider mb-1.5 font-mono">
                Chief Proctor Master Passkey
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-3.5 w-4 h-4 text-[#8C9080]" />
                <input
                  type="password"
                  placeholder="Enter tournament master passkey"
                  value={adminPasskey}
                  onChange={(e) => setAdminPasskey(e.target.value)}
                  className="w-full bg-[#FAFAF7] border border-[#E5E0D8] focus:border-[#111808] rounded-xl pl-10 pr-3 py-3 text-sm text-[#111808] placeholder-[#8C9080] outline-none transition-colors"
                />
              </div>
              <p className="text-[11px] text-[#656858] mt-1.5">
                Authorized tournament officials only. Rate limiting and IP auditing are enforced.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-[#111808] hover:bg-[#1f2b0f] text-[#FFF0BA] font-bold text-xs font-mono tracking-wider shadow-sm disabled:opacity-60 transition-all cursor-pointer"
            >
              {loading ? 'Authenticating Official...' : 'Access Tournament Control Room'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
