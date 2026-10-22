import React, { useState } from 'react';
import { Lock, Eye, EyeOff, ShieldCheck, AlertCircle, ArrowRight, ShieldAlert, Cpu } from 'lucide-react';

interface AdminLoginProps {
  onSuccess: (token: string, user: any) => void;
  onNavigateHome: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onSuccess, onNavigateHome }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockedWait, setLockedWait] = useState<number | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!password.trim()) {
      setError('Administrator password is required.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 429) {
          setLockedWait(data.waitSeconds || 120);
          throw new Error(data.error || 'Too many failed login attempts. Temporarily locked.');
        }
        throw new Error(data.error || 'Authentication failed. Incorrect administrator password.');
      }

      setIsSuccess(true);
      setTimeout(() => {
        onSuccess(data.token, data.user);
      }, 700);
    } catch (err: any) {
      setError(err.message || 'Server connection failure.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen admin-grid-bg text-[#111808] flex flex-col justify-between p-4 sm:p-8 font-sans">
      {/* Top Bar with Tech Arena Branding */}
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-[#111808] flex items-center justify-center text-[#FFF0BA] shadow-md">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <span className="font-heading font-bold text-lg text-[#111808] tracking-wider">TECH ARENA</span>
            <span className="ml-2 text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#111808]/10 text-[#111808] font-bold">
              ADMIN CONTROL
            </span>
          </div>
        </div>

        <button
          onClick={onNavigateHome}
          className="text-xs font-semibold text-[#656858] hover:text-[#111808] transition-colors flex items-center gap-1 cursor-pointer"
        >
          <span>Participant Arena</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </header>

      {/* Main Login Card */}
      <main className="max-w-md w-full mx-auto my-12">
        <div className="bg-white border border-[#E5E0D8] rounded-[32px] p-8 sm:p-10 shadow-xl shadow-[#111808]/5 relative overflow-hidden">
          {/* Top Badge */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-3xl bg-[#111808] flex items-center justify-center text-[#FFF0BA] shadow-lg shadow-[#111808]/20">
              <Lock className="w-7 h-7 stroke-[2.2]" />
            </div>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold font-heading text-[#111808] tracking-tight">
              ADMINISTRATOR UNLOCK
            </h1>
            <p className="text-xs text-[#656858] mt-2 leading-relaxed">
              Protected tournament operations & surveillance control room. Authorized officials only.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3.5 mb-6 rounded-2xl bg-[#FFF0BA] border border-[#E5E0D8] text-[#111808] text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-[#111808] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Access Denied</span>
                <span>{error}</span>
                {lockedWait && (
                  <span className="block mt-1 font-mono text-[11px] text-[#656858]">
                    Wait time: {lockedWait}s remaining
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Success Message */}
          {isSuccess && (
            <div className="p-3.5 mb-6 rounded-2xl bg-[#111808] text-[#FFF0BA] text-xs flex items-center gap-2.5 animate-pulse">
              <ShieldCheck className="w-4 h-4 text-[#FFF0BA]" />
              <span className="font-bold">Access Granted. Initializing Control Center...</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-[#111808] uppercase tracking-wider mb-2">
                Administrator Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoFocus
                  placeholder="Enter administrator passkey"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#FAFAF7] border border-[#E5E0D8] focus:border-[#111808] rounded-2xl pl-4 pr-12 py-3.5 text-sm text-[#111808] placeholder-[#656858]/60 outline-none transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3.5 p-1 rounded-lg text-[#656858] hover:text-[#111808] transition-colors cursor-pointer"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-[#656858] mt-1.5 flex items-center justify-between">
                <span>Initial Secret Configured</span>
                <span className="font-mono font-bold text-[#111808]">Matrix2026</span>
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || isSuccess}
              className="w-full py-3.5 rounded-2xl bg-[#111808] hover:bg-[#1f2b12] text-[#FFF0BA] font-bold text-sm tracking-wide shadow-lg shadow-[#111808]/20 disabled:opacity-60 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Lock className="w-4 h-4" />
              <span>{loading ? 'Verifying Authorization...' : 'Unlock Admin Control'}</span>
            </button>
          </form>

          {/* Security Notice */}
          <div className="mt-8 pt-6 border-t border-[#E5E0D8] text-center">
            <p className="text-[11px] text-[#656858]">
              All login events are timestamped and auditable. Rate limiting is actively enforced.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl w-full mx-auto text-center text-xs text-[#656858]">
        <span>TECH ARENA 2026 — Secure Tournament Administration Platform</span>
      </footer>
    </div>
  );
};
