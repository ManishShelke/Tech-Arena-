import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types.ts';
import { Terminal, Trophy, UserCheck, Lock, LogOut, Activity, Cpu, Shield } from 'lucide-react';

interface NavbarProps {
  user: UserProfile | null;
  activeTab: 'arena' | 'leaderboard' | 'admin';
  setActiveTab: (tab: 'arena' | 'leaderboard' | 'admin') => void;
  onOpenAuth: () => void;
  onOpenAdminAuth: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  activeTab,
  setActiveTab,
  onOpenAuth,
  onOpenAdminAuth,
  onLogout,
}) => {
  const [serverPing, setServerPing] = useState<number>(24);

  useEffect(() => {
    const interval = setInterval(() => {
      setServerPing(Math.floor(20 + Math.random() * 12));
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-[#FAFAF7]/95 backdrop-blur-md border-b border-[#E5E0D8] px-4 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-6">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center border border-[#E5E0D8] p-1 shadow-sm overflow-hidden">
            <img
              src="/assets/aistudio/acd7f777-797e-4ce6-ae26-4077fe5fb474_aeab48d4.png"
              alt="TECH ARENA Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold font-heading text-[#111808] tracking-tight whitespace-nowrap">
                TECH ARENA
              </span>
              <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-[#FFF0BA] text-[#111808] border border-[#111808]/20">
                2026 EDITION
              </span>
            </div>
            <p className="text-[11px] text-[#656858] hidden sm:block whitespace-nowrap">
              Inter-College Championship · Live Proctor Arena
            </p>
          </div>
        </div>

        {/* Zone 2: Navigation Segmented Tabs */}
        <nav className="flex items-center bg-[#F0EEE6] p-1 rounded-xl border border-[#E5E0D8]">
          <button
            onClick={() => setActiveTab('arena')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'arena'
                ? 'bg-[#111808] text-[#FFF0BA] shadow-sm font-semibold'
                : 'text-[#656858] hover:text-[#111808]'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Terminal</span>
          </button>

          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'leaderboard'
                ? 'bg-[#111808] text-[#FFF0BA] shadow-sm font-semibold'
                : 'text-[#656858] hover:text-[#111808]'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Standings</span>
          </button>

          {user?.role === 'admin' ? (
            <button
              onClick={() => setActiveTab('admin')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'admin'
                  ? 'bg-[#111808] text-[#FFF0BA] shadow-sm font-semibold'
                  : 'text-[#656858] hover:text-[#111808]'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Control Room</span>
            </button>
          ) : (
            <button
              onClick={onOpenAdminAuth}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[#656858] hover:text-[#111808] transition-colors cursor-pointer whitespace-nowrap shrink-0"
              title="Chief Proctor / Admin Control Room"
            >
              <Lock className="w-3 h-3 text-[#656858]" />
              <span className="hidden md:inline">Admin</span>
            </button>
          )}
        </nav>

        {/* Zone 3: Actions & Profile */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Server Sync indicator */}
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-[#111808] font-mono bg-[#F0EEE6] px-2.5 py-1 rounded-lg border border-[#E5E0D8]">
            <Activity className="w-3.5 h-3.5 text-emerald-600" />
            <span className="tabular-nums">SYNC {serverPing}ms</span>
          </div>

          {user ? (
            <div className="flex items-center gap-2.5">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-semibold text-[#111808] flex items-center justify-end gap-1.5">
                  {user.role === 'admin' ? (
                    <span className="text-[#111808] font-mono font-bold">ADMIN: {user.name}</span>
                  ) : (
                    <>
                      <span className="font-mono font-bold text-[#111808] bg-[#FFF0BA] px-1.5 py-0.5 rounded border border-[#111808]/20 text-[11px]">
                        {user.code}
                      </span>
                      <span className="truncate max-w-[120px]">{user.teamName}</span>
                    </>
                  )}
                </div>
                <div className="text-[11px] text-[#656858] truncate max-w-[140px]">{user.college}</div>
              </div>

              <button
                onClick={onLogout}
                className="p-2 rounded-xl bg-[#F0EEE6] hover:bg-rose-50 text-[#656858] hover:text-rose-600 border border-[#E5E0D8] hover:border-rose-300 transition-colors cursor-pointer"
                title="Disconnect Terminal Session"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#111808] hover:bg-[#1f2b0f] text-[#FFF0BA] font-semibold text-xs sm:text-sm shadow-sm transition-all cursor-pointer whitespace-nowrap"
            >
              <UserCheck className="w-4 h-4" />
              <span>Connect Team</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
