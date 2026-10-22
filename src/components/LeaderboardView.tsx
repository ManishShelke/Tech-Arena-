import React, { useState, useEffect } from 'react';
import { LeaderboardEntry, CollegeStanding } from '../types.ts';
import { Trophy, Medal, Building2, Search, RefreshCw, Flame, Award, Filter, ShieldAlert } from 'lucide-react';

export const LeaderboardView: React.FC = () => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [collegeStandings, setCollegeStandings] = useState<CollegeStanding[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'teams' | 'colleges'>('teams');
  const [search, setSearch] = useState('');
  const [zoneFilter, setZoneFilter] = useState('All');

  const fetchStandings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/leaderboard');
      const data = await res.json();
      if (res.ok) {
        setLeaderboard(data.leaderboard || []);
        setCollegeStandings(data.collegeStandings || []);
      }
    } catch (err) {
      console.error('Failed to load leaderboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStandings();
    const interval = setInterval(fetchStandings, 15000);
    return () => clearInterval(interval);
  }, []);

  const filteredTeams = leaderboard.filter((item) => {
    const matchesSearch =
      item.teamName.toLowerCase().includes(search.toLowerCase()) ||
      item.college.toLowerCase().includes(search.toLowerCase()) ||
      item.code.toLowerCase().includes(search.toLowerCase());
    const matchesZone = zoneFilter === 'All' || item.zone === zoneFilter;
    return matchesSearch && matchesZone;
  });

  const filteredColleges = collegeStandings.filter((c) => {
    const matchesSearch = c.institution.toLowerCase().includes(search.toLowerCase());
    const matchesZone = zoneFilter === 'All' || c.zone === zoneFilter;
    return matchesSearch && matchesZone;
  });

  const topThree = leaderboard.slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Top Banner / Stats Header */}
      <div className="bg-[#111808] border border-[#111808] rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden text-[#FFF0BA]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="text-xs font-mono text-[#A6A998] mb-2 tracking-wider">
              TOURNAMENT LIVE STANDINGS · TRIPLE ROUND MATRIX
            </div>
            <h1 className="text-xl sm:text-3xl font-bold font-heading text-white tracking-tight">
              COLLEGE RIVALRY & TOURNAMENT STANDINGS
            </h1>
            <p className="text-xs sm:text-sm text-[#A6A998] mt-2 max-w-2xl leading-relaxed">
              Real-time synchronized scores aggregated across Round 1 (Rapid Qualifier), Round 2 (Bug Hunt), and Round 3 (Live Clash).
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-center">
            <button
              onClick={fetchStandings}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1F2B14] hover:bg-[#2A3B1B] border border-[#2E3D1E] text-xs font-mono text-[#FFF0BA] transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#FFF0BA]' : ''}`} />
              <span>Refresh Standings</span>
            </button>
          </div>
        </div>

        {/* View Switcher & Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-6 pt-6 border-t border-[#1F2B14]">
          <div className="flex items-center bg-[#17220B] p-1 rounded-xl border border-[#2E3D1E] self-start">
            <button
              onClick={() => setViewMode('teams')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'teams'
                  ? 'bg-[#FFF0BA] text-[#111808] shadow-sm'
                  : 'text-[#A6A998] hover:text-white'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>Team Rankings ({leaderboard.length})</span>
            </button>

            <button
              onClick={() => setViewMode('colleges')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'colleges'
                  ? 'bg-[#FFF0BA] text-[#111808] shadow-sm'
                  : 'text-[#A6A998] hover:text-white'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>College Standings ({collegeStandings.length})</span>
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-[#8A957C]" />
              <input
                type="text"
                placeholder="Search team or college..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#17220B] border border-[#2E3D1E] focus:border-[#FFF0BA] rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-[#8A957C] outline-none"
              />
            </div>

            <div className="relative">
              <select
                value={zoneFilter}
                onChange={(e) => setZoneFilter(e.target.value)}
                className="bg-[#17220B] border border-[#2E3D1E] focus:border-[#FFF0BA] rounded-xl px-3 py-1.5 text-xs text-[#FFF0BA] outline-none cursor-pointer"
              >
                <option value="All">All Zones</option>
                <option value="South Zone">South Zone</option>
                <option value="West Zone">West Zone</option>
                <option value="North Zone">North Zone</option>
                <option value="East Zone">East Zone</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Podium Cards for Top 3 (shown when viewing teams and we have teams) */}
      {viewMode === 'teams' && topThree.length > 0 && !search && zoneFilter === 'All' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {topThree.map((item, index) => {
            const isFirst = index === 0;
            return (
              <div
                key={item.id}
                className={`rounded-3xl p-5 border transition-all flex flex-col justify-between ${
                  isFirst
                    ? 'bg-[#111808] text-[#FFF0BA] border-[#111808] shadow-lg md:-translate-y-1'
                    : 'bg-white text-[#111808] border-[#E5E0D8] shadow-sm'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span
                      className={`font-mono text-xs font-bold px-2.5 py-0.5 rounded-md border ${
                        isFirst
                          ? 'bg-[#FFF0BA] text-[#111808] border-[#FFF0BA]'
                          : 'bg-[#FAFAF7] text-[#111808] border-[#E5E0D8]'
                      }`}
                    >
                      RANK #{index + 1}
                    </span>
                    <span className="font-mono text-xs opacity-75">{item.code}</span>
                  </div>

                  <h3 className="font-heading font-bold text-base truncate">{item.teamName}</h3>
                  <p className={`text-xs truncate ${isFirst ? 'text-[#A6A998]' : 'text-[#656858]'}`}>
                    {item.college}
                  </p>
                  <p className={`text-[11px] truncate ${isFirst ? 'text-[#8A957C]' : 'text-[#8C9080]'}`}>
                    {item.teamMembers.join(' · ')}
                  </p>
                </div>

                <div className={`mt-4 pt-3 border-t flex items-center justify-between ${
                  isFirst ? 'border-[#1F2B14]' : 'border-[#E5E0D8]'
                }`}>
                  <span className={`text-[11px] font-mono ${isFirst ? 'text-[#A6A998]' : 'text-[#656858]'}`}>
                    Zone: {item.zone}
                  </span>
                  <span className="font-mono text-lg font-bold tabular-nums">
                    {item.totalScore} pts
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Main Table View */}
      {viewMode === 'teams' ? (
        <div className="bg-white border border-[#E5E0D8] rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAFAF7] border-b border-[#E5E0D8] text-[#656858] font-mono uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3.5 px-4 text-center w-14">Rank</th>
                  <th className="py-3.5 px-4">Terminal Team</th>
                  <th className="py-3.5 px-4">Institution / College</th>
                  <th className="py-3.5 px-4 text-center">Zone</th>
                  <th className="py-3.5 px-4 text-center">R1</th>
                  <th className="py-3.5 px-4 text-center">R2</th>
                  <th className="py-3.5 px-4 text-center">R3</th>
                  <th className="py-3.5 px-4 text-center font-bold text-[#111808]">Total Score</th>
                  <th className="py-3.5 px-4 text-center">Time (s)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E0D8] font-medium text-[#111808]">
                {filteredTeams.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-[#656858]">
                      No participating teams registered or matched filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredTeams.map((team) => (
                    <tr
                      key={team.id}
                      className={`hover:bg-[#FAFAF7] transition-colors ${
                        team.rank === 1 ? 'bg-[#FFF0BA]/20' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4 text-center">
                        {team.rank === 1 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-[#FFF0BA] text-[#111808] font-bold border border-[#111808]/20 font-mono">
                            1
                          </span>
                        ) : team.rank === 2 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-[#F0EEE6] text-[#111808] font-bold border border-[#E5E0D8] font-mono">
                            2
                          </span>
                        ) : team.rank === 3 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-[#F0EEE6] text-[#656858] font-bold border border-[#E5E0D8] font-mono">
                            3
                          </span>
                        ) : (
                          <span className="text-[#656858] font-mono tabular-nums">#{team.rank}</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#111808]">{team.teamName}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#F0EEE6] text-[#111808] border border-[#E5E0D8]">
                            {team.code}
                          </span>
                          {team.isBlocked && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 border border-rose-200 font-mono">
                              LOCKED
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#656858] mt-0.5">
                          {team.teamMembers.join(' · ')}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-[#474A3D]">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-[#8C9080] shrink-0" />
                          <span>{team.college}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center text-[#656858]">
                        {team.zone}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono tabular-nums text-[#656858]">{team.r1Score}</td>
                      <td className="py-3.5 px-4 text-center font-mono tabular-nums text-[#656858]">{team.r2Score}</td>
                      <td className="py-3.5 px-4 text-center font-mono tabular-nums text-[#656858]">{team.r3Score}</td>
                      <td className="py-3.5 px-4 text-center font-mono tabular-nums text-sm font-bold text-[#111808]">
                        {team.totalScore}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono tabular-nums text-xs text-[#656858]">
                        {team.totalTimeSeconds ? `${team.totalTimeSeconds}s` : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-[#E5E0D8] rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAFAF7] border-b border-[#E5E0D8] text-[#656858] font-mono uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3.5 px-4 text-center w-14">Rank</th>
                  <th className="py-3.5 px-4">Institution / University</th>
                  <th className="py-3.5 px-4 text-center">Zone</th>
                  <th className="py-3.5 px-4 text-center">Active Teams</th>
                  <th className="py-3.5 px-4 text-center font-bold text-[#111808]">Average Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E0D8] font-medium text-[#111808]">
                {filteredColleges.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-[#656858]">
                      No college standings available yet.
                    </td>
                  </tr>
                ) : (
                  filteredColleges.map((c) => (
                    <tr key={c.institution} className="hover:bg-[#FAFAF7] transition-colors">
                      <td className="py-3.5 px-4 text-center">
                        <span className="font-mono text-[#656858] tabular-nums">#{c.rank}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-[#111808] text-sm">{c.institution}</div>
                      </td>
                      <td className="py-3.5 px-4 text-center text-[#656858]">
                        {c.zone}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono tabular-nums text-[#656858]">{c.activeCount} teams</td>
                      <td className="py-3.5 px-4 text-center font-mono tabular-nums text-sm font-bold text-[#111808]">
                        {c.avgPts} pts
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
