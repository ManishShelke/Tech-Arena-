import React, { useState, useEffect } from 'react';
import { UserProfile, AdminMetrics, RoundInfo } from '../types.ts';
import {
  Shield,
  Users,
  AlertTriangle,
  Download,
  CheckCircle,
  XCircle,
  RefreshCw,
  Search,
  Lock,
  Unlock,
  Radio,
  Clock,
  FileSpreadsheet,
  Check,
  X,
  FileText,
} from 'lucide-react';

interface AdminDashboardProps {
  user: UserProfile | null;
  token: string | null;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, token }) => {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [violations, setViolations] = useState<any[]>([]);
  const [appeals, setAppeals] = useState<any[]>([]);
  const [rounds, setRounds] = useState<RoundInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'roster' | 'violations' | 'appeals' | 'rounds'>('roster');
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const fetchAdminData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };

      const [resMetrics, resParticipants, resViolations, resAppeals, resRounds] = await Promise.all([
        fetch('/api/admin/overview', { headers }),
        fetch('/api/admin/participants', { headers }),
        fetch('/api/admin/violations', { headers }),
        fetch('/api/admin/appeals', { headers }),
        fetch('/api/rounds'),
      ]);

      if (resMetrics.ok) setMetrics(await resMetrics.json());
      if (resParticipants.ok) setParticipants(await resParticipants.json());
      if (resViolations.ok) setViolations(await resViolations.json());
      if (resAppeals.ok) setAppeals(await resAppeals.json());
      if (resRounds.ok) setRounds(await resRounds.json());
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, [token]);

  const handleBlock = async (id: number) => {
    if (!token) return;
    const reason = window.prompt('Specify disqualification/block reason:');
    if (!reason) return;

    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/participants/${id}/block`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason }),
      });
      if (res.ok) {
        fetchAdminData();
      }
    } catch (err) {
      console.error('Failed to block participant:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handlePardon = async (id: number) => {
    if (!token) return;
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/participants/${id}/pardon`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        fetchAdminData();
      }
    } catch (err) {
      console.error('Failed to pardon participant:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReviewAppeal = async (appealId: number, status: 'approved' | 'rejected') => {
    if (!token) return;
    const notes = window.prompt(`Reviewer notes for ${status}:`) || '';

    try {
      const res = await fetch(`/api/admin/appeals/${appealId}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status, notes }),
      });
      if (res.ok) {
        fetchAdminData();
      }
    } catch (err) {
      console.error('Failed to review appeal:', err);
    }
  };

  const handleToggleRound = async (roundId: number) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/admin/rounds/${roundId}/toggle`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        fetchAdminData();
      }
    } catch (err) {
      console.error('Failed to toggle round:', err);
    }
  };

  const handleExportCSV = () => {
    if (!token) return;
    window.location.href = `/api/admin/export-csv?token=${token}`;
  };

  const filteredParticipants = participants.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.teamName.toLowerCase().includes(q) ||
      p.college.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Admin Header */}
      <div className="bg-gradient-to-r from-[#181829] via-[#1f1938] to-[#181829] border border-amber-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-5 h-5 text-amber-400" />
              <h1 className="text-xl sm:text-2xl font-bold font-heading text-white tracking-wide">
                CHIEF PROCTOR TOURNAMENT CONTROL ROOM
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-gray-400">
              Live tournament operations, anti-cheat surveillance, participant rosters, and tribunal review.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV Roster</span>
            </button>

            <button
              onClick={fetchAdminData}
              disabled={loading}
              className="p-2 rounded-xl bg-[#252538] hover:bg-[#303048] border border-gray-700 text-gray-300 transition-colors cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Telemetry Metrics Bar */}
        {metrics && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-6 border-t border-gray-800">
            <div className="bg-[#111222] border border-gray-800 p-3 rounded-xl">
              <span className="text-[11px] text-gray-400 font-mono block">Registered Teams</span>
              <span className="text-xl font-bold font-mono text-white">{metrics.totalParticipants}</span>
            </div>
            <div className="bg-[#111222] border border-gray-800 p-3 rounded-xl">
              <span className="text-[11px] text-cyan-400 font-mono block">Active Assessments</span>
              <span className="text-xl font-bold font-mono text-cyan-300">{metrics.activeAttempts}</span>
            </div>
            <div className="bg-[#111222] border border-gray-800 p-3 rounded-xl">
              <span className="text-[11px] text-emerald-400 font-mono block">Submitted Rounds</span>
              <span className="text-xl font-bold font-mono text-emerald-300">{metrics.completedAttempts}</span>
            </div>
            <div className="bg-[#111222] border border-gray-800 p-3 rounded-xl">
              <span className="text-[11px] text-rose-400 font-mono block">Restricted / Blocked</span>
              <span className="text-xl font-bold font-mono text-rose-400">{metrics.blockedCount}</span>
            </div>
            <div className="bg-[#111222] border border-gray-800 p-3 rounded-xl">
              <span className="text-[11px] text-amber-400 font-mono block">Pending Appeals</span>
              <span className="text-xl font-bold font-mono text-amber-300">{metrics.pendingAppeals}</span>
            </div>
            <div className="bg-[#111222] border border-gray-800 p-3 rounded-xl">
              <span className="text-[11px] text-gray-400 font-mono block">Average Score</span>
              <span className="text-xl font-bold font-mono text-white">{metrics.avgScore} pts</span>
            </div>
          </div>
        )}
      </div>

      {/* Tabs navigation */}
      <div className="flex items-center gap-2 border-b border-gray-800 pb-3">
        <button
          onClick={() => setActiveTab('roster')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'roster'
              ? 'bg-amber-500 text-black shadow'
              : 'text-gray-400 hover:text-white bg-[#131728]'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Competitor Roster ({participants.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('violations')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'violations'
              ? 'bg-amber-500 text-black shadow'
              : 'text-gray-400 hover:text-white bg-[#131728]'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Surveillance Timeline ({violations.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('appeals')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'appeals'
              ? 'bg-amber-500 text-black shadow'
              : 'text-gray-400 hover:text-white bg-[#131728]'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Tribunal Appeals ({appeals.filter((a) => a.status === 'pending').length} pending)</span>
        </button>

        <button
          onClick={() => setActiveTab('rounds')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'rounds'
              ? 'bg-amber-500 text-black shadow'
              : 'text-gray-400 hover:text-white bg-[#131728]'
          }`}
        >
          <Radio className="w-3.5 h-3.5" />
          <span>Round Status Controls</span>
        </button>
      </div>

      {/* 1. PARTICIPANT ROSTER */}
      {activeTab === 'roster' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative w-72">
              <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search team, college or code..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#131728] border border-gray-800 focus:border-amber-500/50 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-gray-500 outline-none"
              />
            </div>
          </div>

          <div className="bg-[#0e1322] border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#151b2e] border-b border-gray-800 text-gray-400 font-mono uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Code</th>
                    <th className="py-3 px-4">Team & Members</th>
                    <th className="py-3 px-4">Institution</th>
                    <th className="py-3 px-4 text-center">Zone</th>
                    <th className="py-3 px-4 text-center">R1</th>
                    <th className="py-3 px-4 text-center">R2</th>
                    <th className="py-3 px-4 text-center">R3</th>
                    <th className="py-3 px-4 text-center font-bold text-amber-400">Total</th>
                    <th className="py-3 px-4 text-center">Strikes</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Proctor Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60 font-medium">
                  {filteredParticipants.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-gray-500">
                        No competitor records found.
                      </td>
                    </tr>
                  ) : (
                    filteredParticipants.map((p) => (
                      <tr key={p.id} className="hover:bg-[#151c30]/60 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-cyan-400">{p.code}</td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-white">{p.teamName}</div>
                          <div className="text-[11px] text-gray-400">{p.teamMembers?.join(', ')}</div>
                        </td>
                        <td className="py-3 px-4 text-gray-300">{p.college}</td>
                        <td className="py-3 px-4 text-center text-gray-400">{p.zone}</td>
                        <td className="py-3 px-4 text-center font-mono text-gray-300">{p.r1Score}</td>
                        <td className="py-3 px-4 text-center font-mono text-gray-300">{p.r2Score}</td>
                        <td className="py-3 px-4 text-center font-mono text-gray-300">{p.r3Score}</td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-amber-400">
                          {p.totalScore}
                        </td>
                        <td className="py-3 px-4 text-center font-mono">
                          <span
                            className={`px-2 py-0.5 rounded ${
                              p.strikes > 0 ? 'bg-rose-500/20 text-rose-400' : 'text-gray-400'
                            }`}
                          >
                            {p.strikes}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {p.isBlocked ? (
                            <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 font-semibold text-[10px]">
                              BLOCKED
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold text-[10px]">
                              ACTIVE
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {p.isBlocked ? (
                            <button
                              onClick={() => handlePardon(p.id)}
                              disabled={actionLoading === p.id}
                              className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 text-xs font-medium transition-colors cursor-pointer"
                            >
                              Pardon & Restore
                            </button>
                          ) : (
                            <button
                              onClick={() => handleBlock(p.id)}
                              disabled={actionLoading === p.id}
                              className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 text-xs font-medium transition-colors cursor-pointer"
                            >
                              Eject / Disqualify
                            </button>
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

      {/* 2. SURVEILLANCE TIMELINE */}
      {activeTab === 'violations' && (
        <div className="bg-[#0e1322] border border-gray-800 rounded-2xl p-5 shadow-xl">
          <h3 className="text-sm font-bold font-heading text-white mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            Live Security Integrity Timeline (Last 50 Events)
          </h3>

          <div className="space-y-2.5">
            {violations.length === 0 ? (
              <p className="text-xs text-gray-500 py-6 text-center">
                No security violations recorded. All terminals are adhering to fullscreen proctor protocol.
              </p>
            ) : (
              violations.map((v) => (
                <div
                  key={v.id}
                  className="p-3 rounded-xl bg-[#141b2e] border border-rose-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-start gap-3">
                    <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 font-mono text-[10px] font-bold shrink-0">
                      {v.violationType}
                    </span>
                    <div>
                      <div className="font-semibold text-white">
                        {v.teamName} <span className="font-mono text-cyan-400 font-normal">({v.code})</span> —{' '}
                        <span className="text-gray-400 font-normal">{v.college}</span>
                      </div>
                      <p className="text-gray-300 text-[11px] mt-0.5">{v.details}</p>
                    </div>
                  </div>

                  <div className="text-[11px] text-gray-500 font-mono whitespace-nowrap self-end sm:self-center">
                    {new Date(v.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 3. TRIBUNAL APPEALS */}
      {activeTab === 'appeals' && (
        <div className="bg-[#0e1322] border border-gray-800 rounded-2xl p-5 shadow-xl">
          <h3 className="text-sm font-bold font-heading text-white mb-4 flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-400" />
            Disqualification Appeals Tribunal
          </h3>

          <div className="space-y-3">
            {appeals.length === 0 ? (
              <p className="text-xs text-gray-500 py-6 text-center">
                No appeals filed by disqualified competitors.
              </p>
            ) : (
              appeals.map((a) => (
                <div
                  key={a.id}
                  className="p-4 rounded-xl bg-[#141b2e] border border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">{a.teamName}</span>
                      <span className="font-mono text-cyan-400">{a.code}</span>
                      <span className="text-gray-400">• {a.college}</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                          a.status === 'pending'
                            ? 'bg-amber-500/20 text-amber-400'
                            : a.status === 'approved'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-rose-500/20 text-rose-400'
                        }`}
                      >
                        {a.status}
                      </span>
                    </div>

                    <p className="text-gray-300 italic bg-[#0e1322] p-2.5 rounded-lg border border-gray-800">
                      "{a.appealReason}"
                    </p>

                    {a.reviewerNotes && (
                      <p className="text-[11px] text-gray-400 mt-1">
                        Chief Proctor Notes: {a.reviewerNotes}
                      </p>
                    )}
                  </div>

                  {a.status === 'pending' && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleReviewAppeal(a.id, 'approved')}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 font-semibold cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve & Pardon</span>
                      </button>

                      <button
                        onClick={() => handleReviewAppeal(a.id, 'rejected')}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 font-semibold cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 4. ROUND STATUS CONTROLS */}
      {activeTab === 'rounds' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {rounds.map((round) => (
            <div
              key={round.id}
              className="bg-[#0e1322] border border-gray-800 rounded-2xl p-5 space-y-4 shadow-xl"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-cyan-400">ROUND {round.roundNumber}</span>
                <span
                  className={`text-[11px] px-2 py-0.5 rounded font-mono font-bold ${
                    round.isOpen
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {round.isOpen ? 'LIVE OPEN' : 'LOCKED'}
                </span>
              </div>

              <div>
                <h4 className="text-sm font-bold font-heading text-white">{round.title}</h4>
                <p className="text-xs text-gray-400 mt-1">{round.description}</p>
              </div>

              <div className="pt-2 border-t border-gray-800">
                <button
                  onClick={() => handleToggleRound(round.id)}
                  className={`w-full py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    round.isOpen
                      ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30'
                      : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {round.isOpen ? 'Lock Round (Close Submissions)' : 'Open Round (Enable Submissions)'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
