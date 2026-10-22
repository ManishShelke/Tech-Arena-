import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  Activity,
  FileText,
  CheckCircle,
  Trophy,
  Sliders,
  Download,
  Settings,
  LogOut,
  Search,
  Filter,
  Shield,
  ShieldAlert,
  AlertTriangle,
  RefreshCw,
  Clock,
  Radio,
  Eye,
  Check,
  X,
  Lock,
  Unlock,
  ChevronRight,
  TrendingUp,
  Award,
  Zap,
  Cpu,
  ArrowUpRight,
  UserCheck,
  Building2,
  FileSpreadsheet,
} from 'lucide-react';

interface AdminPanelProps {
  token: string;
  onLogout: () => void;
  onNavigateHome: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ token, onLogout, onNavigateHome }) => {
  const [activeSection, setActiveSection] = useState<string>('overview');
  const [overview, setOverview] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [monitoring, setMonitoring] = useState<any[]>([]);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [competitionSettings, setCompetitionSettings] = useState<any>(null);
  const [rounds, setRounds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & State
  const [participantSearch, setParticipantSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [activitySearch, setActivitySearch] = useState('');
  const [activityTypeFilter, setActivityTypeFilter] = useState('all');
  const [submissionStatusFilter, setSubmissionStatusFilter] = useState('all');

  // Modals & Drawers
  const [selectedParticipantId, setSelectedParticipantId] = useState<number | null>(null);
  const [participantProfile, setParticipantProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [scoreCorrectionTarget, setScoreCorrectionTarget] = useState<any>(null);
  const [correctionPoints, setCorrectionPoints] = useState<number>(0);
  const [correctionIsCorrect, setCorrectionIsCorrect] = useState<boolean>(true);
  const [correctionReason, setCorrectionReason] = useState<string>('');
  const [submittingCorrection, setSubmittingCorrection] = useState(false);

  // Fetch Admin Overview
  const fetchOverview = async () => {
    try {
      const res = await fetch('/api/admin/overview', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setOverview(await res.json());
      }
    } catch (err) {
      console.error('Error fetching admin overview:', err);
    }
  };

  // Fetch Participants
  const fetchParticipants = async () => {
    try {
      const query = new URLSearchParams();
      if (participantSearch) query.set('search', participantSearch);
      if (statusFilter !== 'all') query.set('status', statusFilter);
      if (difficultyFilter !== 'all') query.set('difficulty', difficultyFilter);

      const res = await fetch(`/api/admin/participants?${query.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setParticipants(await res.json());
      }
    } catch (err) {
      console.error('Error fetching participants:', err);
    }
  };

  // Fetch Live Monitoring
  const fetchMonitoring = async () => {
    try {
      const res = await fetch('/api/admin/live-monitoring', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setMonitoring(await res.json());
      }
    } catch (err) {
      console.error('Error fetching live monitoring:', err);
    }
  };

  // Fetch Activity Logs
  const fetchActivityLogs = async () => {
    try {
      const query = new URLSearchParams();
      if (activitySearch) query.set('search', activitySearch);
      if (activityTypeFilter !== 'all') query.set('eventType', activityTypeFilter);

      const res = await fetch(`/api/admin/activity-logs?${query.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setActivityLogs(await res.json());
      }
    } catch (err) {
      console.error('Error fetching activity logs:', err);
    }
  };

  // Fetch Submissions
  const fetchSubmissions = async () => {
    try {
      const query = new URLSearchParams();
      if (submissionStatusFilter !== 'all') query.set('status', submissionStatusFilter);

      const res = await fetch(`/api/admin/submissions?${query.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setSubmissions(await res.json());
      }
    } catch (err) {
      console.error('Error fetching submissions:', err);
    }
  };

  // Fetch Settings & Rounds
  const fetchSettingsAndRounds = async () => {
    try {
      const [resSettings, resRounds] = await Promise.all([
        fetch('/api/admin/competition-settings', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/rounds'),
      ]);
      if (resSettings.ok) setCompetitionSettings(await resSettings.json());
      if (resRounds.ok) setRounds(await resRounds.json());
    } catch (err) {
      console.error('Error fetching settings/rounds:', err);
    }
  };

  // Initial load
  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchOverview(),
      fetchParticipants(),
      fetchMonitoring(),
      fetchActivityLogs(),
      fetchSubmissions(),
      fetchSettingsAndRounds(),
    ]);
    setLoading(false);
  };

  useEffect(() => {
    loadAllData();
    const interval = setInterval(() => {
      // Periodic background refresh every 10s for live data
      fetchMonitoring();
      fetchOverview();
    }, 10000);
    return () => clearInterval(interval);
  }, [token]);

  // Handle participant profile view
  const handleOpenProfile = async (id: number) => {
    setSelectedParticipantId(id);
    setLoadingProfile(true);
    try {
      const res = await fetch(`/api/admin/participants/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setParticipantProfile(await res.json());
      }
    } catch (err) {
      console.error('Failed to load participant profile:', err);
    } finally {
      setLoadingProfile(false);
    }
  };

  // Remote terminate participant attempt
  const handleTerminateAttempt = async (id: number) => {
    const reason = window.prompt('Specify termination reason (e.g. Proctored rule violation):');
    if (!reason) return;

    try {
      const res = await fetch(`/api/admin/participants/${id}/terminate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason }),
      });
      if (res.ok) {
        alert('Participant attempt terminated and questions locked.');
        loadAllData();
      }
    } catch (err) {
      console.error('Failed to terminate attempt:', err);
    }
  };

  // Disqualify / Pardon participant
  const handleToggleBlock = async (id: number, currentBlocked: boolean) => {
    try {
      if (currentBlocked) {
        const res = await fetch(`/api/admin/participants/${id}/pardon`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          alert('Participant pardoned. Question access restored.');
          loadAllData();
        }
      } else {
        const reason = window.prompt('Specify disqualification reason:') || 'Disqualified by Chief Proctor.';
        const res = await fetch(`/api/admin/participants/${id}/disqualify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ reason }),
        });
        if (res.ok) {
          alert('Participant disqualified.');
          loadAllData();
        }
      }
    } catch (err) {
      console.error('Action failed:', err);
    }
  };

  // Submit manual score correction
  const handleSaveScoreCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scoreCorrectionTarget) return;

    setSubmittingCorrection(true);
    try {
      const res = await fetch(`/api/admin/submissions/${scoreCorrectionTarget.id}/score-correction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          newPoints: Number(correctionPoints),
          isCorrect: correctionIsCorrect,
          reason: correctionReason,
        }),
      });

      if (res.ok) {
        alert('Score corrected and auditable log recorded.');
        setScoreCorrectionTarget(null);
        fetchSubmissions();
        fetchOverview();
        fetchParticipants();
      }
    } catch (err) {
      console.error('Failed to correct score:', err);
    } finally {
      setSubmittingCorrection(false);
    }
  };

  // Update competition settings toggle
  const handleUpdateSettings = async (updates: any) => {
    try {
      const res = await fetch('/api/admin/competition-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        setCompetitionSettings((prev: any) => ({ ...prev, ...updates }));
      }
    } catch (err) {
      console.error('Failed to update competition settings:', err);
    }
  };

  // Freeze/Publish Leaderboard
  const handleToggleFreezeLeaderboard = async (frozen: boolean) => {
    try {
      const res = await fetch('/api/admin/leaderboard/freeze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ freeze: frozen }),
      });
      if (res.ok) {
        setCompetitionSettings((prev: any) => ({ ...prev, leaderboardFrozen: frozen }));
      }
    } catch (err) {
      console.error('Failed to toggle freeze:', err);
    }
  };

  // CSV Export trigger
  const handleExportCSV = (type: string) => {
    window.location.href = `/api/admin/export/${type}?token=${token}`;
  };

  return (
    <div className="min-h-screen admin-grid-bg text-[#111808] flex font-sans selection:bg-[#FFF0BA] selection:text-[#111808]">
      {/* LEFT SIDEBAR: GREEN WATERLOO (#111808) */}
      <aside className="w-64 lg:w-72 bg-[#111808] text-[#FFF0BA] shrink-0 min-h-screen p-5 flex flex-col justify-between border-r border-[#1f2b12]">
        <div className="space-y-6">
          {/* Brand & Badge */}
          <div className="flex items-center gap-3 px-2 py-1">
            <div className="w-10 h-10 rounded-2xl bg-[#FFF0BA] text-[#111808] flex items-center justify-center font-bold shadow">
              <Cpu className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="text-base font-bold font-heading tracking-wider text-[#FFF0BA]">TECH ARENA</div>
              <div className="text-[10px] font-mono text-[#FFF0BA]/70 uppercase tracking-widest">
                DIRECTORATE CONTROL
              </div>
            </div>
          </div>

          {/* Navigation Section Links */}
          <nav className="space-y-1 text-xs font-semibold">
            <button
              onClick={() => setActiveSection('overview')}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl transition-all cursor-pointer ${
                activeSection === 'overview'
                  ? 'bg-[#FFF0BA] text-[#111808] shadow-md font-bold'
                  : 'text-[#FFF0BA]/75 hover:bg-[#1f2b12] hover:text-[#FFF0BA]'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>1. Overview</span>
            </button>

            <button
              onClick={() => setActiveSection('participants')}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl transition-all cursor-pointer ${
                activeSection === 'participants'
                  ? 'bg-[#FFF0BA] text-[#111808] shadow-md font-bold'
                  : 'text-[#FFF0BA]/75 hover:bg-[#1f2b12] hover:text-[#FFF0BA]'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>2. Participants</span>
            </button>

            <button
              onClick={() => setActiveSection('monitoring')}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl transition-all cursor-pointer ${
                activeSection === 'monitoring'
                  ? 'bg-[#FFF0BA] text-[#111808] shadow-md font-bold'
                  : 'text-[#FFF0BA]/75 hover:bg-[#1f2b12] hover:text-[#FFF0BA]'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>3. Live Monitoring</span>
            </button>

            <button
              onClick={() => setActiveSection('activity')}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl transition-all cursor-pointer ${
                activeSection === 'activity'
                  ? 'bg-[#FFF0BA] text-[#111808] shadow-md font-bold'
                  : 'text-[#FFF0BA]/75 hover:bg-[#1f2b12] hover:text-[#FFF0BA]'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>4. Activity Logs</span>
            </button>

            <button
              onClick={() => setActiveSection('submissions')}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl transition-all cursor-pointer ${
                activeSection === 'submissions'
                  ? 'bg-[#FFF0BA] text-[#111808] shadow-md font-bold'
                  : 'text-[#FFF0BA]/75 hover:bg-[#1f2b12] hover:text-[#FFF0BA]'
              }`}
            >
              <CheckCircle className="w-4 h-4" />
              <span>5. Submissions</span>
            </button>

            <button
              onClick={() => setActiveSection('leaderboard')}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl transition-all cursor-pointer ${
                activeSection === 'leaderboard'
                  ? 'bg-[#FFF0BA] text-[#111808] shadow-md font-bold'
                  : 'text-[#FFF0BA]/75 hover:bg-[#1f2b12] hover:text-[#FFF0BA]'
              }`}
            >
              <Trophy className="w-4 h-4" />
              <span>6. Leaderboard & Winners</span>
            </button>

            <button
              onClick={() => setActiveSection('controls')}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl transition-all cursor-pointer ${
                activeSection === 'controls'
                  ? 'bg-[#FFF0BA] text-[#111808] shadow-md font-bold'
                  : 'text-[#FFF0BA]/75 hover:bg-[#1f2b12] hover:text-[#FFF0BA]'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>7. Competition Controls</span>
            </button>

            <button
              onClick={() => setActiveSection('reports')}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl transition-all cursor-pointer ${
                activeSection === 'reports'
                  ? 'bg-[#FFF0BA] text-[#111808] shadow-md font-bold'
                  : 'text-[#FFF0BA]/75 hover:bg-[#1f2b12] hover:text-[#FFF0BA]'
              }`}
            >
              <Download className="w-4 h-4" />
              <span>8. Reports & Export</span>
            </button>

            <button
              onClick={() => setActiveSection('settings')}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl transition-all cursor-pointer ${
                activeSection === 'settings'
                  ? 'bg-[#FFF0BA] text-[#111808] shadow-md font-bold'
                  : 'text-[#FFF0BA]/75 hover:bg-[#1f2b12] hover:text-[#FFF0BA]'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>9. Settings</span>
            </button>
          </nav>
        </div>

        {/* Bottom Actions */}
        <div className="pt-6 border-t border-[#1f2b12] space-y-2">
          <button
            onClick={onNavigateHome}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-[#1f2b12] text-[#FFF0BA] text-xs font-semibold hover:bg-[#2c3c1a] transition-all cursor-pointer"
          >
            <span>Competition Arena</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl text-rose-300 hover:bg-rose-950/40 text-xs font-semibold transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>10. Logout Admin</span>
          </button>
        </div>
      </aside>

      {/* RIGHT MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Top Header */}
        <header className="bg-white/80 backdrop-blur-md border-b border-[#E5E0D8] px-6 lg:px-8 py-4 flex items-center justify-between sticky top-0 z-30">
          <div>
            <h1 className="text-xl font-bold font-heading text-[#111808] uppercase tracking-wide">
              {activeSection.replace('-', ' ')}
            </h1>
            <p className="text-xs text-[#656858]">
              Tournament Administration & Real-Time Anti-Cheat Surveillance Suite
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 text-xs font-mono font-bold px-3 py-1 rounded-full bg-[#111808] text-[#FFF0BA]">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>STRICT PROCTOR: ACTIVE</span>
            </div>

            <button
              onClick={loadAllData}
              disabled={loading}
              className="p-2 rounded-xl bg-white border border-[#E5E0D8] text-[#111808] hover:bg-[#FAFAF7] transition-all shadow-sm cursor-pointer"
              title="Refresh Telemetry"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </header>

        {/* Content View Container */}
        <div className="p-6 lg:p-8 space-y-8 flex-1 overflow-y-auto">
          {/* ======================================================== */}
          {/* SECTION 1: OVERVIEW DASHBOARD */}
          {/* ======================================================== */}
          {activeSection === 'overview' && (
            <div className="space-y-8">
              {/* Highlight Hero Banner in Colonial White */}
              <div className="bg-[#FFF0BA] border border-[#E5E0D8] rounded-[32px] p-6 sm:p-8 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-[#656858] block mb-1">
                      TECH ARENA 2026 DIRECTORATE
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-bold font-heading text-[#111808]">
                      COMPETITION OPERATIONS CENTER
                    </h2>
                    <p className="text-xs sm:text-sm text-[#656858] mt-2 max-w-2xl leading-relaxed">
                      All statistics reflect genuine stored records and active participant heartbeat telemetry.
                      Zero dummy data or artificial placeholder counters.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setActiveSection('controls')}
                      className="px-5 py-3 rounded-2xl bg-[#111808] text-[#FFF0BA] font-bold text-xs shadow-md hover:bg-[#1f2b12] transition-all cursor-pointer"
                    >
                      Configure Rules & Timers
                    </button>
                  </div>
                </div>
              </div>

              {/* 12 Metric Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                <div
                  onClick={() => setActiveSection('participants')}
                  className="bg-white border border-[#E5E0D8] p-4 rounded-3xl shadow-sm hover:border-[#111808] transition-all cursor-pointer"
                >
                  <span className="text-[11px] font-mono text-[#656858] block">Registered Teams</span>
                  <span className="text-2xl font-bold font-mono text-[#111808] mt-1 block">
                    {overview?.totalParticipants ?? 0}
                  </span>
                  <span className="text-[10px] text-[#656858] mt-1 block">Total nodes registered</span>
                </div>

                <div
                  onClick={() => setActiveSection('monitoring')}
                  className="bg-white border border-[#E5E0D8] p-4 rounded-3xl shadow-sm hover:border-[#111808] transition-all cursor-pointer"
                >
                  <span className="text-[11px] font-mono text-emerald-700 block">Currently Online</span>
                  <span className="text-2xl font-bold font-mono text-emerald-800 mt-1 block">
                    {overview?.onlineParticipants ?? 0}
                  </span>
                  <span className="text-[10px] text-[#656858] mt-1 block">Heartbeat &lt; 30s</span>
                </div>

                <div
                  onClick={() => setActiveSection('participants')}
                  className="bg-white border border-[#E5E0D8] p-4 rounded-3xl shadow-sm hover:border-[#111808] transition-all cursor-pointer"
                >
                  <span className="text-[11px] font-mono text-[#111808] block">Actively Competing</span>
                  <span className="text-2xl font-bold font-mono text-[#111808] mt-1 block">
                    {overview?.activelyCompeting ?? 0}
                  </span>
                  <span className="text-[10px] text-[#656858] mt-1 block">Attempt in progress</span>
                </div>

                <div
                  onClick={() => setActiveSection('participants')}
                  className="bg-white border border-[#E5E0D8] p-4 rounded-3xl shadow-sm hover:border-[#111808] transition-all cursor-pointer"
                >
                  <span className="text-[11px] font-mono text-amber-700 block">Logged Out</span>
                  <span className="text-2xl font-bold font-mono text-amber-800 mt-1 block">
                    {overview?.explicitlyLoggedOut ?? 0}
                  </span>
                  <span className="text-[10px] text-[#656858] mt-1 block">Explicit session exit</span>
                </div>

                <div
                  onClick={() => setActiveSection('participants')}
                  className="bg-white border border-[#E5E0D8] p-4 rounded-3xl shadow-sm hover:border-[#111808] transition-all cursor-pointer"
                >
                  <span className="text-[11px] font-mono text-rose-700 block">Disconnected</span>
                  <span className="text-2xl font-bold font-mono text-rose-800 mt-1 block">
                    {overview?.disconnectedParticipants ?? 0}
                  </span>
                  <span className="text-[10px] text-[#656858] mt-1 block">Heartbeat stale</span>
                </div>

                <div
                  onClick={() => setActiveSection('submissions')}
                  className="bg-white border border-[#E5E0D8] p-4 rounded-3xl shadow-sm hover:border-[#111808] transition-all cursor-pointer"
                >
                  <span className="text-[11px] font-mono text-[#111808] block">Accepted Submissions</span>
                  <span className="text-2xl font-bold font-mono text-[#111808] mt-1 block">
                    {overview?.totalAcceptedSubmissions ?? 0}
                  </span>
                  <span className="text-[10px] text-[#656858] mt-1 block">Correct solutions</span>
                </div>
              </div>

              {/* Secondary Metric Row */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="bg-[#111808] text-[#FFF0BA] p-4 rounded-3xl shadow-sm">
                  <span className="text-[11px] font-mono text-[#FFF0BA]/70 block">Total Points Awarded</span>
                  <span className="text-2xl font-bold font-mono text-[#FFF0BA] mt-1 block">
                    {overview?.totalPointsAwarded ?? 0}
                  </span>
                  <span className="text-[10px] text-[#FFF0BA]/60 mt-1 block">Scored server-side</span>
                </div>

                <div className="bg-[#111808] text-[#FFF0BA] p-4 rounded-3xl shadow-sm">
                  <span className="text-[11px] font-mono text-[#FFF0BA]/70 block">Average Attempt Score</span>
                  <span className="text-2xl font-bold font-mono text-[#FFF0BA] mt-1 block">
                    {overview?.avgScore ?? 0} pts
                  </span>
                  <span className="text-[10px] text-[#FFF0BA]/60 mt-1 block">Across all rounds</span>
                </div>

                <div className="bg-white border border-[#E5E0D8] p-4 rounded-3xl shadow-sm">
                  <span className="text-[11px] font-mono text-emerald-700 block">Completed Attempts</span>
                  <span className="text-2xl font-bold font-mono text-[#111808] mt-1 block">
                    {overview?.completedAttempts ?? 0}
                  </span>
                  <span className="text-[10px] text-[#656858] mt-1 block">Submitted / Finalized</span>
                </div>

                <div className="bg-white border border-[#E5E0D8] p-4 rounded-3xl shadow-sm">
                  <span className="text-[11px] font-mono text-rose-700 block">Terminated Attempts</span>
                  <span className="text-2xl font-bold font-mono text-rose-800 mt-1 block">
                    {overview?.automaticallyTerminated ?? 0}
                  </span>
                  <span className="text-[10px] text-[#656858] mt-1 block">Anti-cheat locked</span>
                </div>

                <div className="bg-white border border-[#E5E0D8] p-4 rounded-3xl shadow-sm">
                  <span className="text-[11px] font-mono text-rose-700 block">Disqualified Nodes</span>
                  <span className="text-2xl font-bold font-mono text-rose-800 mt-1 block">
                    {overview?.disqualifiedParticipants ?? 0}
                  </span>
                  <span className="text-[10px] text-[#656858] mt-1 block">Terminal blocked</span>
                </div>

                <div className="bg-white border border-[#E5E0D8] p-4 rounded-3xl shadow-sm">
                  <span className="text-[11px] font-mono text-amber-700 block">Tribunal Appeals</span>
                  <span className="text-2xl font-bold font-mono text-amber-800 mt-1 block">
                    {overview?.pendingAppeals ?? 0}
                  </span>
                  <span className="text-[10px] text-[#656858] mt-1 block">Pending review</span>
                </div>
              </div>

              {/* Real Distribution Breakdown Panels */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 1. Difficulty Level Breakdown */}
                <div className="bg-white border border-[#E5E0D8] rounded-[28px] p-6 shadow-sm">
                  <h3 className="text-sm font-bold font-heading text-[#111808] mb-1 flex items-center justify-between">
                    <span>DIFFICULTY PARTICIPATION</span>
                    <Award className="w-4 h-4 text-[#656858]" />
                  </h3>
                  <p className="text-xs text-[#656858] mb-4">Total attempts per difficulty tier</p>

                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-xs font-semibold mb-1">
                        <span>Easy (Rapid Qualifier)</span>
                        <span className="font-mono">{overview?.difficultyParticipation?.easy ?? 0}</span>
                      </div>
                      <div className="w-full bg-[#FAFAF7] h-2 rounded-full overflow-hidden border border-[#E5E0D8]">
                        <div
                          className="bg-emerald-600 h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, ((overview?.difficultyParticipation?.easy ?? 0) / Math.max(1, overview?.completedAttempts || 1)) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-semibold mb-1">
                        <span>Intermediate (Bug Hunt)</span>
                        <span className="font-mono">{overview?.difficultyParticipation?.intermediate ?? 0}</span>
                      </div>
                      <div className="w-full bg-[#FAFAF7] h-2 rounded-full overflow-hidden border border-[#E5E0D8]">
                        <div
                          className="bg-blue-600 h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, ((overview?.difficultyParticipation?.intermediate ?? 0) / Math.max(1, overview?.completedAttempts || 1)) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-semibold mb-1">
                        <span>Hard (Live Arena Clash)</span>
                        <span className="font-mono">{overview?.difficultyParticipation?.hard ?? 0}</span>
                      </div>
                      <div className="w-full bg-[#FAFAF7] h-2 rounded-full overflow-hidden border border-[#E5E0D8]">
                        <div
                          className="bg-amber-600 h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, ((overview?.difficultyParticipation?.hard ?? 0) / Math.max(1, overview?.completedAttempts || 1)) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Score Distribution */}
                <div className="bg-white border border-[#E5E0D8] rounded-[28px] p-6 shadow-sm">
                  <h3 className="text-sm font-bold font-heading text-[#111808] mb-1 flex items-center justify-between">
                    <span>SCORE BRACKETS</span>
                    <TrendingUp className="w-4 h-4 text-[#656858]" />
                  </h3>
                  <p className="text-xs text-[#656858] mb-4">Total score distribution frequency</p>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-[#FAFAF7] p-2.5 rounded-2xl border border-[#E5E0D8]">
                      <span className="text-[10px] text-[#656858] block">0-20 pts</span>
                      <span className="text-base font-bold font-mono text-[#111808]">
                        {overview?.scoreDistribution?.['0-20'] ?? 0}
                      </span>
                    </div>
                    <div className="bg-[#FAFAF7] p-2.5 rounded-2xl border border-[#E5E0D8]">
                      <span className="text-[10px] text-[#656858] block">21-40 pts</span>
                      <span className="text-base font-bold font-mono text-[#111808]">
                        {overview?.scoreDistribution?.['21-40'] ?? 0}
                      </span>
                    </div>
                    <div className="bg-[#FAFAF7] p-2.5 rounded-2xl border border-[#E5E0D8]">
                      <span className="text-[10px] text-[#656858] block">41-60 pts</span>
                      <span className="text-base font-bold font-mono text-[#111808]">
                        {overview?.scoreDistribution?.['41-60'] ?? 0}
                      </span>
                    </div>
                    <div className="bg-[#FAFAF7] p-2.5 rounded-2xl border border-[#E5E0D8]">
                      <span className="text-[10px] text-[#656858] block">61-80 pts</span>
                      <span className="text-base font-bold font-mono text-[#111808]">
                        {overview?.scoreDistribution?.['61-80'] ?? 0}
                      </span>
                    </div>
                    <div className="bg-[#FAFAF7] p-2.5 rounded-2xl border border-[#E5E0D8]">
                      <span className="text-[10px] text-[#656858] block">81-100 pts</span>
                      <span className="text-base font-bold font-mono text-[#111808]">
                        {overview?.scoreDistribution?.['81-100'] ?? 0}
                      </span>
                    </div>
                    <div className="bg-[#FFF0BA] p-2.5 rounded-2xl border border-[#E5E0D8]">
                      <span className="text-[10px] text-[#111808] font-bold block">100+ pts</span>
                      <span className="text-base font-bold font-mono text-[#111808]">
                        {overview?.scoreDistribution?.['100+'] ?? 0}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. Anti-Cheat Violations by Type */}
                <div className="bg-white border border-[#E5E0D8] rounded-[28px] p-6 shadow-sm">
                  <h3 className="text-sm font-bold font-heading text-[#111808] mb-1 flex items-center justify-between">
                    <span>RECORDED VIOLATIONS</span>
                    <ShieldAlert className="w-4 h-4 text-rose-600" />
                  </h3>
                  <p className="text-xs text-[#656858] mb-4">Proctor detections during active attempts</p>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#FAFAF7] border border-[#E5E0D8]">
                      <span className="text-[#656858]">Tab Hidden (Departure)</span>
                      <span className="font-mono font-bold text-[#111808]">
                        {overview?.violationsByType?.tab_hidden ?? 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#FAFAF7] border border-[#E5E0D8]">
                      <span className="text-[#656858]">Window Focus Lost (Blur)</span>
                      <span className="font-mono font-bold text-[#111808]">
                        {overview?.violationsByType?.window_blur ?? 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#FAFAF7] border border-[#E5E0D8]">
                      <span className="text-[#656858]">Fullscreen Exit</span>
                      <span className="font-mono font-bold text-[#111808]">
                        {overview?.violationsByType?.fullscreen_exit ?? 0}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* SECTION 2: PARTICIPANTS MANAGEMENT */}
          {/* ======================================================== */}
          {activeSection === 'participants' && (
            <div className="space-y-6">
              {/* Filter & Search Bar */}
              <div className="bg-white border border-[#E5E0D8] rounded-[28px] p-5 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="relative w-full md:w-80">
                  <Search className="absolute left-3.5 top-3 w-4 h-4 text-[#656858]" />
                  <input
                    type="text"
                    placeholder="Search by name, team, code, college..."
                    value={participantSearch}
                    onChange={(e) => setParticipantSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && fetchParticipants()}
                    className="w-full bg-[#FAFAF7] border border-[#E5E0D8] focus:border-[#111808] rounded-2xl pl-10 pr-4 py-2.5 text-xs text-[#111808] placeholder-[#656858] outline-none"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setTimeout(fetchParticipants, 100);
                    }}
                    className="bg-[#FAFAF7] border border-[#E5E0D8] text-xs text-[#111808] rounded-xl px-3 py-2 outline-none cursor-pointer"
                  >
                    <option value="all">All Statuses</option>
                    <option value="ONLINE">ONLINE</option>
                    <option value="OFFLINE">OFFLINE</option>
                    <option value="LOGGED OUT">LOGGED OUT</option>
                    <option value="CONNECTION LOST">CONNECTION LOST</option>
                    <option value="IN PROGRESS">IN PROGRESS</option>
                    <option value="SUBMITTED">SUBMITTED</option>
                    <option value="COMPLETED">COMPLETED</option>
                    <option value="TERMINATED">TERMINATED</option>
                    <option value="DISQUALIFIED">DISQUALIFIED</option>
                  </select>

                  <select
                    value={difficultyFilter}
                    onChange={(e) => {
                      setDifficultyFilter(e.target.value);
                      setTimeout(fetchParticipants, 100);
                    }}
                    className="bg-[#FAFAF7] border border-[#E5E0D8] text-xs text-[#111808] rounded-xl px-3 py-2 outline-none cursor-pointer"
                  >
                    <option value="all">All Difficulties</option>
                    <option value="easy">Easy</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="hard">Hard</option>
                  </select>

                  <button
                    onClick={fetchParticipants}
                    className="px-4 py-2 rounded-xl bg-[#111808] text-[#FFF0BA] text-xs font-semibold cursor-pointer shadow-sm hover:bg-[#1f2b12]"
                  >
                    Filter
                  </button>
                </div>
              </div>

              {/* Main Participant Data Table */}
              <div className="bg-white border border-[#E5E0D8] rounded-[32px] overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#111808] text-[#FFF0BA] font-mono text-[11px] uppercase tracking-wider">
                      <tr>
                        <th className="py-4 px-4">Code / ID</th>
                        <th className="py-4 px-4">Participant & College</th>
                        <th className="py-4 px-4 text-center">Connection</th>
                        <th className="py-4 px-4 text-center">Competition Status</th>
                        <th className="py-4 px-4 text-center">Difficulty</th>
                        <th className="py-4 px-4 text-center">Time Rem.</th>
                        <th className="py-4 px-4 text-center font-bold text-[#FFF0BA]">Total Pts</th>
                        <th className="py-4 px-4 text-center">Easy / Med / Hard</th>
                        <th className="py-4 px-4 text-center">Strikes</th>
                        <th className="py-4 px-4 text-center">Admin Controls</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E0D8] font-medium text-[#111808]">
                      {participants.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="py-16 text-center text-[#656858]">
                            No genuine participant records found matching criteria.
                          </td>
                        </tr>
                      ) : (
                        participants.map((p) => (
                          <tr key={p.id} className="hover:bg-[#FAFAF7] transition-colors">
                            <td className="py-4 px-4 font-mono font-bold">
                              <span className="text-[#111808] block">{p.code}</span>
                              <span className="text-[10px] text-[#656858] font-normal">#{p.id}</span>
                            </td>
                            <td className="py-4 px-4">
                              <div className="font-bold text-[#111808] text-sm">{p.teamName}</div>
                              <div className="text-[11px] text-[#656858]">
                                {p.name} • {p.college}
                              </div>
                              <div className="text-[10px] text-[#656858] font-mono">{p.email}</div>
                            </td>
                            <td className="py-4 px-4 text-center">
                              <span
                                className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border ${
                                  p.connectionStatus === 'ONLINE'
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                    : p.connectionStatus === 'LOGGED OUT'
                                    ? 'bg-gray-100 text-gray-700 border-gray-300'
                                    : 'bg-rose-100 text-rose-800 border-rose-300'
                                }`}
                              >
                                {p.connectionStatus}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-center">
                              <span
                                className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border ${
                                  p.competitionStatus === 'IN PROGRESS'
                                    ? 'bg-blue-100 text-blue-800 border-blue-300'
                                    : p.competitionStatus === 'TERMINATED' || p.competitionStatus === 'DISQUALIFIED'
                                    ? 'bg-rose-100 text-rose-800 border-rose-300'
                                    : p.competitionStatus === 'SUBMITTED' || p.competitionStatus === 'COMPLETED'
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                    : 'bg-gray-100 text-gray-700 border-gray-300'
                                }`}
                              >
                                {p.competitionStatus}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-center uppercase font-mono text-[11px] text-[#656858]">
                              {p.currentDifficulty}
                            </td>
                            <td className="py-4 px-4 text-center font-mono text-xs">
                              {p.timeRemainingSeconds > 0 ? (
                                <span className="font-bold text-[#111808]">
                                  {Math.floor(p.timeRemainingSeconds / 60)}m {p.timeRemainingSeconds % 60}s
                                </span>
                              ) : (
                                <span className="text-[#656858]">—</span>
                              )}
                            </td>
                            <td className="py-4 px-4 text-center font-mono font-bold text-sm text-[#111808]">
                              {p.totalScore}
                            </td>
                            <td className="py-4 px-4 text-center font-mono text-xs text-[#656858]">
                              {p.easyScore} / {p.intermediateScore} / {p.hardScore}
                            </td>
                            <td className="py-4 px-4 text-center font-mono">
                              <span
                                className={`px-2 py-0.5 rounded ${
                                  p.violationsCount > 0 ? 'bg-rose-100 text-rose-800 font-bold' : 'text-[#656858]'
                                }`}
                              >
                                {p.violationsCount}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => handleOpenProfile(p.id)}
                                  className="px-2.5 py-1 rounded-lg bg-[#FAFAF7] hover:bg-[#E5E0D8] text-[#111808] border border-[#E5E0D8] text-[11px] font-semibold cursor-pointer"
                                  title="Detailed Profile & Timeline"
                                >
                                  Profile
                                </button>

                                {p.competitionStatus === 'IN PROGRESS' && (
                                  <button
                                    onClick={() => handleTerminateAttempt(p.id)}
                                    className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-semibold cursor-pointer shadow-sm"
                                    title="Remotely Terminate Attempt"
                                  >
                                    Terminate
                                  </button>
                                )}

                                <button
                                  onClick={() => handleToggleBlock(p.id, p.isBlocked)}
                                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold cursor-pointer border ${
                                    p.isBlocked
                                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200'
                                      : 'bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-200'
                                  }`}
                                >
                                  {p.isBlocked ? 'Pardon' : 'Disqualify'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* SECTION 3: LIVE MONITORING */}
          {/* ======================================================== */}
          {activeSection === 'monitoring' && (
            <div className="space-y-6">
              <div className="bg-[#111808] text-[#FFF0BA] rounded-[32px] p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold font-heading">LIVE PARTICIPANT SESSION FEED</h3>
                  <p className="text-xs text-[#FFF0BA]/70 mt-1">
                    Heartbeat is dispatched every 10s. Connections without heartbeat for &gt; 30s are flagged as stale.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-mono font-bold">STREAMING ACTIVE</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {monitoring.length === 0 ? (
                  <div className="col-span-full py-16 text-center text-[#656858] bg-white rounded-3xl border border-[#E5E0D8]">
                    No active sessions recorded yet. Waiting for participant connections.
                  </div>
                ) : (
                  monitoring.map((s) => (
                    <div
                      key={s.id}
                      className="bg-white border border-[#E5E0D8] rounded-[28px] p-5 shadow-sm space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold text-[#111808]">{s.code}</span>
                        <span
                          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                            s.status === 'ONLINE'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : s.status === 'LOGGED OUT'
                              ? 'bg-gray-100 text-gray-700 border-gray-300'
                              : 'bg-rose-100 text-rose-800 border-rose-300'
                          }`}
                        >
                          {s.status}
                        </span>
                      </div>

                      <div>
                        <div className="font-bold text-[#111808] text-sm">{s.teamName}</div>
                        <div className="text-xs text-[#656858]">{s.college}</div>
                      </div>

                      <div className="pt-3 border-t border-[#E5E0D8] grid grid-cols-2 gap-2 text-xs font-mono text-[#656858]">
                        <div>
                          <span className="block text-[10px]">Difficulty</span>
                          <span className="font-bold text-[#111808] uppercase">{s.currentDifficulty}</span>
                        </div>
                        <div>
                          <span className="block text-[10px]">Heartbeat Age</span>
                          <span className="font-bold text-[#111808]">{s.heartbeatAgeSeconds}s ago</span>
                        </div>
                      </div>

                      <div className="pt-2 flex items-center justify-between">
                        <button
                          onClick={() => handleOpenProfile(s.userId)}
                          className="text-xs font-semibold text-[#111808] hover:underline cursor-pointer"
                        >
                          View Full History
                        </button>

                        <button
                          onClick={() => handleTerminateAttempt(s.userId)}
                          className="px-3 py-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold cursor-pointer"
                        >
                          Terminate
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* SECTION 4: ACTIVITY LOGS */}
          {/* ======================================================== */}
          {activeSection === 'activity' && (
            <div className="space-y-6">
              <div className="bg-white border border-[#E5E0D8] rounded-[28px] p-5 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="relative w-full md:w-80">
                  <Search className="absolute left-3.5 top-3 w-4 h-4 text-[#656858]" />
                  <input
                    type="text"
                    placeholder="Search activity events..."
                    value={activitySearch}
                    onChange={(e) => setActivitySearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && fetchActivityLogs()}
                    className="w-full bg-[#FAFAF7] border border-[#E5E0D8] focus:border-[#111808] rounded-2xl pl-10 pr-4 py-2 text-xs text-[#111808] outline-none"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <select
                    value={activityTypeFilter}
                    onChange={(e) => {
                      setActivityTypeFilter(e.target.value);
                      setTimeout(fetchActivityLogs, 100);
                    }}
                    className="bg-[#FAFAF7] border border-[#E5E0D8] text-xs text-[#111808] rounded-xl px-3 py-2 outline-none cursor-pointer"
                  >
                    <option value="all">All Event Types</option>
                    <option value="LOGIN">LOGIN</option>
                    <option value="LOGOUT">LOGOUT</option>
                    <option value="ATTEMPT_STARTED">ATTEMPT_STARTED</option>
                    <option value="SUBMISSION_ACCEPTED">SUBMISSION_ACCEPTED</option>
                    <option value="SUBMISSION_REJECTED">SUBMISSION_REJECTED</option>
                    <option value="WINDOW_FOCUS_LOST">WINDOW_FOCUS_LOST</option>
                    <option value="TAB_HIDDEN">TAB_HIDDEN</option>
                    <option value="FULLSCREEN_EXIT">FULLSCREEN_EXIT</option>
                    <option value="ATTEMPT_TERMINATED">ATTEMPT_TERMINATED</option>
                  </select>

                  <button
                    onClick={fetchActivityLogs}
                    className="px-4 py-2 rounded-xl bg-[#111808] text-[#FFF0BA] text-xs font-semibold cursor-pointer"
                  >
                    Refresh Logs
                  </button>
                </div>
              </div>

              <div className="bg-white border border-[#E5E0D8] rounded-[32px] p-6 shadow-sm space-y-3">
                {activityLogs.length === 0 ? (
                  <p className="text-center py-12 text-[#656858] text-xs">
                    No activity logs recorded yet.
                  </p>
                ) : (
                  activityLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3.5 rounded-2xl bg-[#FAFAF7] border border-[#E5E0D8] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`px-2.5 py-1 rounded-xl font-mono text-[10px] font-bold shrink-0 ${
                            log.severity === 'critical'
                              ? 'bg-rose-600 text-white'
                              : log.severity === 'warning'
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : 'bg-[#111808] text-[#FFF0BA]'
                          }`}
                        >
                          {log.eventType}
                        </span>
                        <div>
                          <span className="font-bold text-[#111808]">{log.teamName}</span>{' '}
                          <span className="font-mono text-[#656858]">({log.code})</span>
                          <p className="text-[#656858] text-[11px] mt-0.5">{log.details}</p>
                        </div>
                      </div>

                      <div className="text-[11px] font-mono text-[#656858] shrink-0 self-end sm:self-center">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* SECTION 5: SUBMISSIONS MANAGEMENT */}
          {/* ======================================================== */}
          {activeSection === 'submissions' && (
            <div className="space-y-6">
              <div className="bg-white border border-[#E5E0D8] rounded-[28px] p-5 shadow-sm flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold font-heading text-[#111808]">CHALLENGE SUBMISSIONS</h3>
                  <p className="text-xs text-[#656858]">Inspect validated submissions and perform auditable score corrections</p>
                </div>

                <div className="flex items-center gap-3">
                  <select
                    value={submissionStatusFilter}
                    onChange={(e) => {
                      setSubmissionStatusFilter(e.target.value);
                      setTimeout(fetchSubmissions, 100);
                    }}
                    className="bg-[#FAFAF7] border border-[#E5E0D8] text-xs text-[#111808] rounded-xl px-3 py-2 outline-none cursor-pointer"
                  >
                    <option value="all">All Submissions</option>
                    <option value="accepted">Accepted Only</option>
                    <option value="rejected">Rejected Only</option>
                    <option value="adjusted">Manually Adjusted Only</option>
                  </select>

                  <button
                    onClick={() => handleExportCSV('submissions')}
                    className="px-3.5 py-2 rounded-xl bg-[#111808] text-[#FFF0BA] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export CSV</span>
                  </button>
                </div>
              </div>

              <div className="bg-white border border-[#E5E0D8] rounded-[32px] overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#111808] text-[#FFF0BA] font-mono text-[11px] uppercase tracking-wider">
                      <tr>
                        <th className="py-4 px-4">Sub ID</th>
                        <th className="py-4 px-4">Participant Team</th>
                        <th className="py-4 px-4">Challenge Description</th>
                        <th className="py-4 px-4 text-center">Difficulty</th>
                        <th className="py-4 px-4 text-center">Status</th>
                        <th className="py-4 px-4 text-center font-bold text-[#FFF0BA]">Points Awarded</th>
                        <th className="py-4 px-4 text-center">Submitted At</th>
                        <th className="py-4 px-4 text-center">Correction</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E0D8] font-medium text-[#111808]">
                      {submissions.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-16 text-center text-[#656858]">
                            No submissions recorded yet.
                          </td>
                        </tr>
                      ) : (
                        submissions.map((s) => (
                          <tr key={s.id} className="hover:bg-[#FAFAF7] transition-colors">
                            <td className="py-4 px-4 font-mono font-bold">#{s.id}</td>
                            <td className="py-4 px-4">
                              <span className="font-bold text-[#111808] block">{s.teamName}</span>
                              <span className="text-[10px] text-[#656858]">{s.college} ({s.code})</span>
                            </td>
                            <td className="py-4 px-4 text-[#656858] max-w-xs truncate">
                              {s.challengeTitle}
                            </td>
                            <td className="py-4 px-4 text-center uppercase font-mono text-[10px]">
                              {s.difficulty}
                            </td>
                            <td className="py-4 px-4 text-center">
                              <span
                                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                                  s.isCorrect
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                    : 'bg-rose-100 text-rose-800 border-rose-300'
                                }`}
                              >
                                {s.isCorrect ? 'ACCEPTED' : 'REJECTED'}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-center font-mono font-bold text-sm">
                              {s.pointsEarned} / {s.maxPoints}
                            </td>
                            <td className="py-4 px-4 text-center font-mono text-[11px] text-[#656858]">
                              {new Date(s.submittedAt).toLocaleTimeString()}
                            </td>
                            <td className="py-4 px-4 text-center">
                              <button
                                onClick={() => {
                                  setScoreCorrectionTarget(s);
                                  setCorrectionPoints(s.pointsEarned);
                                  setCorrectionIsCorrect(s.isCorrect);
                                  setCorrectionReason('');
                                }}
                                className="px-2.5 py-1 rounded-lg bg-[#FAFAF7] hover:bg-[#E5E0D8] border border-[#E5E0D8] text-[11px] font-semibold cursor-pointer"
                              >
                                {s.manuallyAdjusted ? 'Adjusted' : 'Edit Score'}
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* SECTION 6: LEADERBOARD & WINNERS */}
          {/* ======================================================== */}
          {activeSection === 'leaderboard' && (
            <div className="space-y-8">
              {/* Top 3 Podium Cards */}
              <div>
                <h3 className="text-base font-bold font-heading text-[#111808] mb-4 flex items-center justify-between">
                  <span>OFFICIAL TOURNAMENT PODIUM</span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleToggleFreezeLeaderboard(!competitionSettings?.leaderboardFrozen)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer transition-all ${
                        competitionSettings?.leaderboardFrozen
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : 'bg-white text-[#111808] border-[#E5E0D8]'
                      }`}
                    >
                      {competitionSettings?.leaderboardFrozen ? 'Leaderboard Frozen' : 'Freeze Leaderboard'}
                    </button>

                    <button
                      onClick={() => handleExportCSV('leaderboard')}
                      className="px-3.5 py-1.5 rounded-xl bg-[#111808] text-[#FFF0BA] text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export Leaderboard</span>
                    </button>
                  </div>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {/* Rank 2 (Silver) */}
                  <div className="bg-white border border-[#E5E0D8] rounded-[32px] p-6 shadow-sm order-2 md:order-1 flex flex-col justify-between">
                    <div>
                      <div className="w-10 h-10 rounded-2xl bg-gray-200 text-gray-800 font-bold font-mono flex items-center justify-center text-lg mb-4">
                        2
                      </div>
                      <span className="text-[10px] font-mono uppercase text-[#656858] tracking-widest block">
                        RUNNER UP
                      </span>
                      <h4 className="text-xl font-bold font-heading text-[#111808] mt-1">
                        {participants[1]?.teamName || '—'}
                      </h4>
                      <p className="text-xs text-[#656858] mt-0.5">{participants[1]?.college || 'Awaiting completion'}</p>
                    </div>

                    <div className="pt-6 border-t border-[#E5E0D8] mt-6 flex justify-between items-end font-mono">
                      <span className="text-xs text-[#656858]">Total Score</span>
                      <span className="text-2xl font-bold text-[#111808]">{participants[1]?.totalScore || 0} pts</span>
                    </div>
                  </div>

                  {/* Rank 1 (Gold Winner - Colonial White Highlight Card) */}
                  <div className="bg-[#FFF0BA] border-2 border-[#111808] rounded-[32px] p-6 sm:p-8 shadow-md order-1 md:order-2 flex flex-col justify-between relative overflow-hidden">
                    <div>
                      <div className="w-12 h-12 rounded-2xl bg-[#111808] text-[#FFF0BA] font-bold font-mono flex items-center justify-center text-2xl mb-4 shadow">
                        1
                      </div>
                      <span className="text-[11px] font-mono uppercase text-[#111808] font-bold tracking-widest block">
                        CHAMPION FIRST PLACE
                      </span>
                      <h4 className="text-2xl font-bold font-heading text-[#111808] mt-1">
                        {participants[0]?.teamName || '—'}
                      </h4>
                      <p className="text-xs text-[#656858] font-medium mt-0.5">
                        {participants[0]?.college || 'Awaiting competition completion'}
                      </p>
                    </div>

                    <div className="pt-6 border-t border-[#111808]/20 mt-6 flex justify-between items-end font-mono">
                      <span className="text-xs text-[#111808] font-bold">Champion Score</span>
                      <span className="text-3xl font-bold text-[#111808]">{participants[0]?.totalScore || 0} pts</span>
                    </div>
                  </div>

                  {/* Rank 3 (Bronze) */}
                  <div className="bg-white border border-[#E5E0D8] rounded-[32px] p-6 shadow-sm order-3 flex flex-col justify-between">
                    <div>
                      <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-900 font-bold font-mono flex items-center justify-center text-lg mb-4">
                        3
                      </div>
                      <span className="text-[10px] font-mono uppercase text-[#656858] tracking-widest block">
                        THIRD PLACE
                      </span>
                      <h4 className="text-xl font-bold font-heading text-[#111808] mt-1">
                        {participants[2]?.teamName || '—'}
                      </h4>
                      <p className="text-xs text-[#656858] mt-0.5">{participants[2]?.college || 'Awaiting completion'}</p>
                    </div>

                    <div className="pt-6 border-t border-[#E5E0D8] mt-6 flex justify-between items-end font-mono">
                      <span className="text-xs text-[#656858]">Total Score</span>
                      <span className="text-2xl font-bold text-[#111808]">{participants[2]?.totalScore || 0} pts</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Full Standings Table */}
              <div className="bg-white border border-[#E5E0D8] rounded-[32px] overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#111808] text-[#FFF0BA] font-mono text-[11px] uppercase tracking-wider">
                      <tr>
                        <th className="py-4 px-4 text-center w-16">Rank</th>
                        <th className="py-4 px-4">Team Code</th>
                        <th className="py-4 px-4">Participant Team</th>
                        <th className="py-4 px-4">College</th>
                        <th className="py-4 px-4 text-center">Easy Pts</th>
                        <th className="py-4 px-4 text-center">Med Pts</th>
                        <th className="py-4 px-4 text-center">Hard Pts</th>
                        <th className="py-4 px-4 text-center font-bold text-[#FFF0BA]">Total Score</th>
                        <th className="py-4 px-4 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E0D8] font-medium text-[#111808]">
                      {participants.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-16 text-center text-[#656858]">
                            No validated scores recorded yet on clean leaderboard.
                          </td>
                        </tr>
                      ) : (
                        participants.map((p, idx) => (
                          <tr key={p.id} className="hover:bg-[#FAFAF7] transition-colors">
                            <td className="py-4 px-4 text-center font-mono font-bold">
                              #{idx + 1}
                            </td>
                            <td className="py-4 px-4 font-mono">{p.code}</td>
                            <td className="py-4 px-4 font-bold">{p.teamName}</td>
                            <td className="py-4 px-4 text-[#656858]">{p.college}</td>
                            <td className="py-4 px-4 text-center font-mono">{p.easyScore}</td>
                            <td className="py-4 px-4 text-center font-mono">{p.intermediateScore}</td>
                            <td className="py-4 px-4 text-center font-mono">{p.hardScore}</td>
                            <td className="py-4 px-4 text-center font-mono font-bold text-sm text-[#111808]">
                              {p.totalScore}
                            </td>
                            <td className="py-4 px-4 text-center font-mono text-[10px]">
                              {p.isBlocked ? (
                                <span className="text-rose-700 font-bold">DISQUALIFIED</span>
                              ) : (
                                <span className="text-emerald-700 font-bold">ACTIVE</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* SECTION 7: COMPETITION CONTROLS */}
          {/* ======================================================== */}
          {activeSection === 'controls' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Competition Lifecycle Settings */}
                <div className="bg-white border border-[#E5E0D8] rounded-[32px] p-6 shadow-sm space-y-4">
                  <h3 className="text-base font-bold font-heading text-[#111808]">
                    COMPETITION LIFECYCLE & REGISTRATION
                  </h3>
                  <p className="text-xs text-[#656858]">
                    Control tournament status and open or close public team terminal registration.
                  </p>

                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#FAFAF7] border border-[#E5E0D8]">
                      <div>
                        <span className="font-bold text-xs block text-[#111808]">Team Registration</span>
                        <span className="text-[11px] text-[#656858]">
                          {competitionSettings?.registrationOpen
                            ? 'Public registration currently OPEN'
                            : 'Registration CLOSED by Proctor'}
                        </span>
                      </div>
                      <button
                        onClick={() =>
                          handleUpdateSettings({
                            registrationOpen: !competitionSettings?.registrationOpen,
                          })
                        }
                        className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                          competitionSettings?.registrationOpen
                            ? 'bg-rose-600 text-white hover:bg-rose-700'
                            : 'bg-emerald-600 text-white hover:bg-emerald-700'
                        }`}
                      >
                        {competitionSettings?.registrationOpen ? 'Close Registration' : 'Open Registration'}
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#FAFAF7] border border-[#E5E0D8]">
                      <div>
                        <span className="font-bold text-xs block text-[#111808]">Competition Status</span>
                        <span className="text-[11px] text-[#656858] uppercase font-mono">
                          Current: {competitionSettings?.competitionStatus || 'active'}
                        </span>
                      </div>
                      <select
                        value={competitionSettings?.competitionStatus || 'active'}
                        onChange={(e) => handleUpdateSettings({ competitionStatus: e.target.value })}
                        className="bg-white border border-[#E5E0D8] text-xs font-bold text-[#111808] rounded-xl px-3 py-2 outline-none cursor-pointer"
                      >
                        <option value="active">ACTIVE</option>
                        <option value="paused">PAUSED</option>
                        <option value="ended">ENDED</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Strict Anti-Cheat & Proctor Configuration */}
                <div className="bg-white border border-[#E5E0D8] rounded-[32px] p-6 shadow-sm space-y-4">
                  <h3 className="text-base font-bold font-heading text-[#111808]">
                    PROCTOR & ANTI-CHEAT ENFORCEMENT
                  </h3>
                  <p className="text-xs text-[#656858]">
                    Configure automatic attempt termination on focus loss, tab departure, or fullscreen exit.
                  </p>

                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#FAFAF7] border border-[#E5E0D8]">
                      <div>
                        <span className="font-bold text-xs block text-[#111808]">Strict Focus-Loss Enforcement</span>
                        <span className="text-[11px] text-[#656858]">
                          {competitionSettings?.strictFocusEnforcement ? 'Active (Terminates on 2 strikes)' : 'Disabled'}
                        </span>
                      </div>
                      <button
                        onClick={() =>
                          handleUpdateSettings({
                            strictFocusEnforcement: !competitionSettings?.strictFocusEnforcement,
                          })
                        }
                        className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                          competitionSettings?.strictFocusEnforcement
                            ? 'bg-[#111808] text-[#FFF0BA]'
                            : 'bg-gray-200 text-gray-800'
                        }`}
                      >
                        {competitionSettings?.strictFocusEnforcement ? 'Enabled' : 'Disabled'}
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#FAFAF7] border border-[#E5E0D8]">
                      <div>
                        <span className="font-bold text-xs block text-[#111808]">Fullscreen Requirement</span>
                        <span className="text-[11px] text-[#656858]">
                          {competitionSettings?.fullscreenEnforcement ? 'Required' : 'Optional'}
                        </span>
                      </div>
                      <button
                        onClick={() =>
                          handleUpdateSettings({
                            fullscreenEnforcement: !competitionSettings?.fullscreenEnforcement,
                          })
                        }
                        className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                          competitionSettings?.fullscreenEnforcement
                            ? 'bg-[#111808] text-[#FFF0BA]'
                            : 'bg-gray-200 text-gray-800'
                        }`}
                      >
                        {competitionSettings?.fullscreenEnforcement ? 'Enabled' : 'Disabled'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Rounds Status Table */}
              <div className="bg-white border border-[#E5E0D8] rounded-[32px] p-6 shadow-sm space-y-4">
                <h3 className="text-base font-bold font-heading text-[#111808]">
                  EASY, INTERMEDIATE & HARD DIFFICULTY TIERS
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {rounds.map((r) => (
                    <div
                      key={r.id}
                      className="bg-[#FAFAF7] border border-[#E5E0D8] rounded-3xl p-5 flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-mono font-bold text-xs uppercase text-[#111808]">
                            Tier {r.roundNumber} ({r.difficulty || (r.roundNumber === 1 ? 'easy' : r.roundNumber === 2 ? 'intermediate' : 'hard')})
                          </span>
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                              r.isOpen ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {r.isOpen ? 'OPEN' : 'LOCKED'}
                          </span>
                        </div>
                        <h4 className="font-bold text-sm text-[#111808]">{r.title}</h4>
                        <p className="text-xs text-[#656858] leading-relaxed">{r.description}</p>
                        <div className="text-xs font-mono text-[#656858] pt-2">
                          Duration: {r.durationMinutes} mins • Max Strikes: {r.maxViolations}
                        </div>
                      </div>

                      <div className="pt-4 mt-4 border-t border-[#E5E0D8]">
                        <button
                          onClick={async () => {
                            await fetch(`/api/admin/rounds/${r.id}/toggle`, {
                              method: 'POST',
                              headers: { Authorization: `Bearer ${token}` },
                            });
                            fetchSettingsAndRounds();
                          }}
                          className="w-full py-2 rounded-xl bg-[#111808] text-[#FFF0BA] text-xs font-bold cursor-pointer hover:bg-[#1f2b12]"
                        >
                          {r.isOpen ? 'Lock Tier' : 'Open Tier'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* SECTION 8: REPORTS & EXPORT */}
          {/* ======================================================== */}
          {activeSection === 'reports' && (
            <div className="space-y-8">
              <div className="bg-[#FFF0BA] border border-[#E5E0D8] rounded-[32px] p-8 shadow-sm">
                <h3 className="text-2xl font-bold font-heading text-[#111808]">
                  TOURNAMENT REPORTS & CSV EXPORT SUITE
                </h3>
                <p className="text-xs sm:text-sm text-[#656858] mt-2 max-w-xl">
                  Download validated production records in standard CSV format for post-competition analysis,
                  certificate distribution, and audit verification.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white border border-[#E5E0D8] rounded-[28px] p-6 shadow-sm flex flex-col justify-between">
                  <div className="space-y-2">
                    <FileSpreadsheet className="w-8 h-8 text-[#111808]" />
                    <h4 className="font-bold text-sm text-[#111808]">Participants Roster</h4>
                    <p className="text-xs text-[#656858]">
                      Complete registration list with college details, members, scores by difficulty tier, and statuses.
                    </p>
                  </div>
                  <button
                    onClick={() => handleExportCSV('participants')}
                    className="w-full mt-6 py-2.5 rounded-xl bg-[#111808] text-[#FFF0BA] text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:bg-[#1f2b12]"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download CSV</span>
                  </button>
                </div>

                <div className="bg-white border border-[#E5E0D8] rounded-[28px] p-6 shadow-sm flex flex-col justify-between">
                  <div className="space-y-2">
                    <FileSpreadsheet className="w-8 h-8 text-[#111808]" />
                    <h4 className="font-bold text-sm text-[#111808]">Submissions Log</h4>
                    <p className="text-xs text-[#656858]">
                      Every participant answer submitted, points awarded, timestamps, and validation correctness.
                    </p>
                  </div>
                  <button
                    onClick={() => handleExportCSV('submissions')}
                    className="w-full mt-6 py-2.5 rounded-xl bg-[#111808] text-[#FFF0BA] text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:bg-[#1f2b12]"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download CSV</span>
                  </button>
                </div>

                <div className="bg-white border border-[#E5E0D8] rounded-[28px] p-6 shadow-sm flex flex-col justify-between">
                  <div className="space-y-2">
                    <FileSpreadsheet className="w-8 h-8 text-[#111808]" />
                    <h4 className="font-bold text-sm text-[#111808]">Surveillance Audit</h4>
                    <p className="text-xs text-[#656858]">
                      Complete chronological timeline of tab blurs, fullscreen departures, and attempt terminations.
                    </p>
                  </div>
                  <button
                    onClick={() => handleExportCSV('activity')}
                    className="w-full mt-6 py-2.5 rounded-xl bg-[#111808] text-[#FFF0BA] text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:bg-[#1f2b12]"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download CSV</span>
                  </button>
                </div>

                <div className="bg-white border border-[#E5E0D8] rounded-[28px] p-6 shadow-sm flex flex-col justify-between">
                  <div className="space-y-2">
                    <FileSpreadsheet className="w-8 h-8 text-[#111808]" />
                    <h4 className="font-bold text-sm text-[#111808]">Final Leaderboard</h4>
                    <p className="text-xs text-[#656858]">
                      Ranked winners and official tournament standings with tie-breaker timings.
                    </p>
                  </div>
                  <button
                    onClick={() => handleExportCSV('leaderboard')}
                    className="w-full mt-6 py-2.5 rounded-xl bg-[#111808] text-[#FFF0BA] text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:bg-[#1f2b12]"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download CSV</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* SECTION 9: SETTINGS */}
          {/* ======================================================== */}
          {activeSection === 'settings' && (
            <div className="space-y-6 max-w-3xl">
              <div className="bg-white border border-[#E5E0D8] rounded-[32px] p-6 sm:p-8 shadow-sm space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#111808] text-[#FFF0BA] flex items-center justify-center font-bold">
                    <Settings className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold font-heading text-[#111808]">
                      ADMINISTRATOR SECURITY CONFIGURATION
                    </h3>
                    <p className="text-xs text-[#656858]">
                      Server authentication credentials and security parameters
                    </p>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-[#E5E0D8]">
                  <div className="p-4 rounded-2xl bg-[#FAFAF7] border border-[#E5E0D8]">
                    <span className="text-xs font-bold text-[#111808] block mb-1">
                      Initial Administrator Passkey
                    </span>
                    <p className="text-xs text-[#656858] mb-2">
                      The primary administrator password configured for Tech Arena is:
                    </p>
                    <code className="text-xs font-mono font-bold px-3 py-1.5 rounded-xl bg-[#111808] text-[#FFF0BA] inline-block">
                      Matrix2026
                    </code>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#FAFAF7] border border-[#E5E0D8]">
                    <span className="text-xs font-bold text-[#111808] block mb-1">
                      Session Lifecycle & Security
                    </span>
                    <ul className="text-xs text-[#656858] space-y-1 list-disc pl-4">
                      <li>Server sessions expire in 24 hours or immediately upon explicit logout.</li>
                      <li>Rate limiting throttles IP addresses after 5 consecutive failed login attempts.</li>
                      <li>Protected administrative endpoints reject unauthorized requests directly.</li>
                    </ul>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#FAFAF7] border border-[#E5E0D8]">
                    <span className="text-xs font-bold text-[#111808] block mb-1">
                      Environment Secret Variables
                    </span>
                    <p className="text-xs text-[#656858]">
                      Can be updated in <code className="font-mono text-[#111808]">.env</code> via{' '}
                      <code className="font-mono text-[#111808]">ADMIN_ACCESS_PASSWORD</code>.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* DRAWER MODAL: PARTICIPANT PROFILE & FULL TIMELINE */}
      {selectedParticipantId && participantProfile && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-white h-full p-6 sm:p-8 shadow-2xl flex flex-col justify-between overflow-y-auto">
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-[#E5E0D8]">
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase text-[#656858]">
                    PARTICIPANT PROFILE #{participantProfile.user?.id}
                  </span>
                  <h3 className="text-xl font-bold font-heading text-[#111808]">
                    {participantProfile.user?.teamName}
                  </h3>
                  <p className="text-xs text-[#656858]">{participantProfile.user?.college}</p>
                </div>
                <button
                  onClick={() => setSelectedParticipantId(null)}
                  className="p-2 rounded-xl text-[#656858] hover:text-[#111808] hover:bg-[#FAFAF7] transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Status details */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-2xl bg-[#FAFAF7] border border-[#E5E0D8]">
                  <span className="text-[10px] text-[#656858] block">Assigned Code</span>
                  <span className="font-mono font-bold text-[#111808]">{participantProfile.user?.code}</span>
                </div>
                <div className="p-3 rounded-2xl bg-[#FAFAF7] border border-[#E5E0D8]">
                  <span className="text-[10px] text-[#656858] block">Zonal Division</span>
                  <span className="font-bold text-[#111808]">{participantProfile.user?.zone}</span>
                </div>
              </div>

              {/* Chronological Event Timeline */}
              <div>
                <h4 className="text-xs font-bold font-heading uppercase text-[#111808] mb-3">
                  CHRONOLOGICAL ACTIVITY & SURVEILLANCE TIMELINE
                </h4>

                <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                  {participantProfile.activities?.length === 0 ? (
                    <p className="text-xs text-[#656858]">No activity events logged yet for this node.</p>
                  ) : (
                    participantProfile.activities.map((act: any) => (
                      <div
                        key={act.id}
                        className="p-3 rounded-xl bg-[#FAFAF7] border border-[#E5E0D8] text-xs flex justify-between gap-3"
                      >
                        <div>
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold mb-1 ${
                              act.severity === 'critical'
                                ? 'bg-rose-600 text-white'
                                : act.severity === 'warning'
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : 'bg-[#111808] text-[#FFF0BA]'
                            }`}
                          >
                            {act.eventType}
                          </span>
                          <p className="text-[#111808]">{act.details}</p>
                        </div>
                        <span className="text-[10px] font-mono text-[#656858] shrink-0">
                          {new Date(act.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-[#E5E0D8]">
              <button
                onClick={() => setSelectedParticipantId(null)}
                className="w-full py-3 rounded-2xl bg-[#111808] text-[#FFF0BA] font-bold text-xs cursor-pointer hover:bg-[#1f2b12]"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: MANUAL SCORE CORRECTION */}
      {scoreCorrectionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white border border-[#E5E0D8] rounded-[32px] p-6 sm:p-8 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-[#E5E0D8]">
              <div>
                <h3 className="text-base font-bold font-heading text-[#111808]">
                  MANUAL SCORE CORRECTION
                </h3>
                <p className="text-xs text-[#656858]">Submission #{scoreCorrectionTarget.id}</p>
              </div>
              <button
                onClick={() => setScoreCorrectionTarget(null)}
                className="p-1 rounded-lg text-[#656858] hover:text-[#111808]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveScoreCorrection} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-[#111808] mb-1">Points Awarded</label>
                <input
                  type="number"
                  required
                  min={0}
                  max={scoreCorrectionTarget.maxPoints || 50}
                  value={correctionPoints}
                  onChange={(e) => setCorrectionPoints(Number(e.target.value))}
                  className="w-full bg-[#FAFAF7] border border-[#E5E0D8] rounded-xl px-3 py-2 text-sm font-mono text-[#111808] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#111808] mb-1">Status</label>
                <select
                  value={correctionIsCorrect ? 'accepted' : 'rejected'}
                  onChange={(e) => setCorrectionIsCorrect(e.target.value === 'accepted')}
                  className="w-full bg-[#FAFAF7] border border-[#E5E0D8] rounded-xl px-3 py-2 text-xs font-semibold text-[#111808] outline-none cursor-pointer"
                >
                  <option value="accepted">Accepted (Correct)</option>
                  <option value="rejected">Rejected (Incorrect)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#111808] mb-1">
                  Audit Reason for Score Adjustment
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Explain why this score was manually modified (recorded in permanent audit log)..."
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  className="w-full bg-[#FAFAF7] border border-[#E5E0D8] rounded-xl p-3 text-xs text-[#111808] outline-none resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setScoreCorrectionTarget(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#656858] hover:text-[#111808]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCorrection}
                  className="px-5 py-2.5 rounded-xl bg-[#111808] text-[#FFF0BA] text-xs font-bold shadow cursor-pointer hover:bg-[#1f2b12]"
                >
                  {submittingCorrection ? 'Recording...' : 'Save Correction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
