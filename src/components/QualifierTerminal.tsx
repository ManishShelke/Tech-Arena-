import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, RoundInfo, AttemptSession } from '../types.ts';
import {
  Terminal,
  Shield,
  ShieldAlert,
  Clock,
  Play,
  CheckCircle2,
  AlertTriangle,
  Send,
  Code,
  Maximize2,
  ChevronRight,
  ChevronLeft,
  X,
  FileText,
  Lock,
  Cpu,
} from 'lucide-react';

interface QualifierTerminalProps {
  user: UserProfile | null;
  token: string | null;
  onOpenAuth: () => void;
  onOpenFileAppeal: () => void;
  onProfileUpdated: () => void;
}

export const QualifierTerminal: React.FC<QualifierTerminalProps> = ({
  user,
  token,
  onOpenAuth,
  onOpenFileAppeal,
  onProfileUpdated,
}) => {
  const [rounds, setRounds] = useState<RoundInfo[]>([]);
  const [selectedRound, setSelectedRound] = useState<RoundInfo | null>(null);
  const [attempt, setAttempt] = useState<AttemptSession | null>(null);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, { selectedOption?: number; submittedCode?: string }>>({});
  const [activeCode, setActiveCode] = useState<string>('');
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);
  const [strikes, setStrikes] = useState<number>(0);
  const [securityWarning, setSecurityWarning] = useState<string | null>(null);
  const [loadingRound, setLoadingRound] = useState(false);
  const [submittingAttempt, setSubmittingAttempt] = useState(false);
  const [savingAnswer, setSavingAnswer] = useState(false);
  const [resultSummary, setResultSummary] = useState<{ score: number; roundNumber: number } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [uiError, setUiError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch available competition rounds
  const fetchRounds = async () => {
    try {
      const res = await fetch('/api/rounds');
      if (res.ok) {
        const data = await res.json();
        setRounds(data);
        if (data.length > 0 && !selectedRound) {
          setSelectedRound(data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load competition rounds:', err);
    }
  };

  useEffect(() => {
    fetchRounds();
  }, []);

  // Timer countdown and server sync
  useEffect(() => {
    if (!attempt || attempt.status !== 'in_progress') return;

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          handleAutoTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Periodic server sync every 12 seconds
    const syncInterval = setInterval(async () => {
      if (!token) return;
      try {
        const res = await fetch(`/api/attempts/${attempt.attemptId}/sync`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const syncData = await res.json();
          setSecondsRemaining(syncData.remainingSeconds);
          setStrikes(syncData.violationsCount);
          if (syncData.isDisqualified || syncData.status === 'disqualified') {
            setAttempt((prev) => (prev ? { ...prev, status: 'disqualified' } : null));
            onProfileUpdated();
          } else if (syncData.status === 'terminated') {
            setAttempt((prev) => (prev ? { ...prev, status: 'terminated' } : null));
            setSecurityWarning('Attempt session was terminated by Chief Proctor.');
            onProfileUpdated();
          } else if (syncData.status === 'timed_out') {
            setAttempt((prev) => (prev ? { ...prev, status: 'timed_out' } : null));
            onProfileUpdated();
          }
        }
      } catch (err) {
        console.warn('Sync attempt ping failed:', err);
      }
    }, 12000);

    return () => {
      clearInterval(timer);
      clearInterval(syncInterval);
    };
  }, [attempt?.attemptId, attempt?.status, token]);

  // Anti-cheat detection (Window blur, Tab switch, Fullscreen exit)
  useEffect(() => {
    if (!attempt || attempt.status !== 'in_progress' || !token) return;

    const reportSecurityEvent = async (type: string, details: string) => {
      try {
        const res = await fetch(`/api/attempts/${attempt.attemptId}/security-event`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ violationType: type, details }),
        });

        if (res.ok) {
          const data = await res.json();
          setStrikes(data.strikes);
          if (data.terminated) {
            setSecurityWarning(data.message || 'Attempt terminated due to security violation policy.');
            setAttempt((prev) => (prev ? { ...prev, status: 'terminated' } : null));
            onProfileUpdated();
          } else if (data.disqualified) {
            setSecurityWarning(data.message || 'Disqualified due to security violations.');
            setAttempt((prev) => (prev ? { ...prev, status: 'disqualified' } : null));
            onProfileUpdated();
          } else {
            setSecurityWarning(data.warning || `Warning: security strike logged (${data.strikes}/2).`);
            setTimeout(() => setSecurityWarning(null), 7000);
          }
        }
      } catch (err) {
        console.error('Failed to report security violation:', err);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        reportSecurityEvent('tab_hidden', 'Terminal departed — browser tab switched or minimized.');
      }
    };

    const handleWindowBlur = () => {
      reportSecurityEvent('window_blur', 'Window focus lost — external application or inspector detected.');
    };

    const handleFullscreenChange = () => {
      const active = Boolean(document.fullscreenElement);
      setIsFullscreen(active);
      if (!active) {
        reportSecurityEvent('fullscreen_exit', 'Participant exited enforced fullscreen proctor environment.');
      }
    };

    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [attempt?.attemptId, attempt?.status, token]);

  const enterFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    }
  };

  const handleStartAttempt = async (roundNum: number) => {
    if (!token) {
      onOpenAuth();
      return;
    }

    if (user?.isBlocked) {
      return;
    }

    setLoadingRound(true);
    setResultSummary(null);
    setSecurityWarning(null);
    setUiError(null);

    try {
      const res = await fetch('/api/attempts/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ roundNumber: roundNum }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to start round assessment.');
      }

      setAttempt(data);
      setAnswers(data.savedAnswers || {});
      setSecondsRemaining(data.remainingSeconds);
      setStrikes(data.violationsCount || 0);
      setCurrentQIndex(0);

      // Initialize code editor starter if question 0 is code
      const firstQ = data.questions?.[0];
      if (firstQ?.type === 'code') {
        const saved = data.savedAnswers?.[firstQ.id]?.submittedCode;
        setActiveCode(saved || firstQ.codeStarter || '');
      }

      // Enter fullscreen
      enterFullscreen();
    } catch (err: any) {
      setUiError(err.message || 'Error initializing round attempt.');
    } finally {
      setLoadingRound(false);
    }
  };

  const handleAutoTimeout = async () => {
    if (!attempt || !token) return;
    try {
      await fetch(`/api/attempts/${attempt.attemptId}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      setAttempt((prev) => (prev ? { ...prev, status: 'timed_out' } : null));
      onProfileUpdated();
    } catch (err) {
      console.error('Auto timeout error:', err);
    }
  };

  const handleSelectOption = async (optionIndex: number) => {
    if (!attempt || !token) return;
    const currentQ = attempt.questions[currentQIndex];
    if (!currentQ) return;

    // Optimistically update
    setAnswers((prev) => ({
      ...prev,
      [currentQ.id]: { ...prev[currentQ.id], selectedOption: optionIndex },
    }));

    setSavingAnswer(true);
    try {
      await fetch(`/api/attempts/${attempt.attemptId}/answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          questionId: currentQ.id,
          selectedOption: optionIndex,
        }),
      });
    } catch (err) {
      console.error('Failed to autosave answer:', err);
    } finally {
      setSavingAnswer(false);
    }
  };

  const handleSaveCode = async () => {
    if (!attempt || !token) return;
    const currentQ = attempt.questions[currentQIndex];
    if (!currentQ) return;

    setSavingAnswer(true);
    try {
      const res = await fetch(`/api/attempts/${attempt.attemptId}/answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          questionId: currentQ.id,
          submittedCode: activeCode,
        }),
      });

      if (res.ok) {
        setAnswers((prev) => ({
          ...prev,
          [currentQ.id]: { ...prev[currentQ.id], submittedCode: activeCode },
        }));
      }
    } catch (err) {
      console.error('Failed to save code answer:', err);
    } finally {
      setSavingAnswer(false);
    }
  };

  const handleNavigateQuestion = (newIndex: number) => {
    if (!attempt || newIndex < 0 || newIndex >= attempt.questions.length) return;
    setCurrentQIndex(newIndex);
    const targetQ = attempt.questions[newIndex];
    if (targetQ?.type === 'code') {
      const saved = answers[targetQ.id]?.submittedCode;
      setActiveCode(saved || targetQ.codeStarter || '');
    }
  };

  const confirmSubmitAttempt = async () => {
    if (!attempt || !token) return;
    setSubmittingAttempt(true);
    setShowConfirmSubmit(false);
    try {
      const res = await fetch(`/api/attempts/${attempt.attemptId}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit attempt.');
      }

      setResultSummary({
        score: data.score,
        roundNumber: data.roundNumber,
      });

      setAttempt(null);
      onProfileUpdated();
    } catch (err: any) {
      setUiError(err.message || 'Error finalizing assessment.');
    } finally {
      setSubmittingAttempt(false);
    }
  };

  // Format seconds mm:ss
  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const currentQ = attempt?.questions?.[currentQIndex];

  return (
    <div ref={containerRef} className="space-y-6">
      {/* UI Error Banner */}
      {uiError && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-medium">{uiError}</span>
          </div>
          <button
            onClick={() => setUiError(null)}
            className="p-1 rounded-lg hover:bg-rose-100 text-rose-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Blocked / Disqualified Terminal Notice */}
      {user?.isBlocked && (
        <div className="bg-[#111808] border-2 border-rose-500 rounded-3xl p-6 sm:p-8 text-[#FFF0BA] shadow-xl relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 shrink-0">
                <ShieldAlert className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold font-heading text-rose-300">
                  TERMINAL ACCESS RESTRICTED & QUESTIONS LOCKED
                </h3>
                <p className="text-xs text-rose-200 mt-1">
                  Reason: {user.blockReason || 'Disqualified due to security integrity violation.'}
                </p>
                <p className="text-[11px] text-[#A6A998] mt-1">
                  Your node has been detached from assessment submission. You may submit a formal appeal to the Chief Proctor.
                </p>
              </div>
            </div>

            <button
              onClick={onOpenFileAppeal}
              className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs tracking-wider shadow-md transition-all cursor-pointer shrink-0 self-start sm:self-center"
            >
              File Disqualification Appeal
            </button>
          </div>
        </div>
      )}

      {/* Security Warning Floating Banner */}
      {securityWarning && (
        <div className="p-3.5 rounded-2xl bg-[#111808] border border-amber-500/80 text-[#FFF0BA] text-xs flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="font-medium">{securityWarning}</span>
          </div>
          <span className="font-mono text-[11px] bg-[#1F2B14] text-[#FFF0BA] px-2.5 py-1 rounded-md border border-[#2E3D1E]">
            Strikes: {strikes} / 2
          </span>
        </div>
      )}

      {/* Result Summary Modal or Card */}
      {resultSummary && (
        <div className="bg-[#111808] border border-[#2E3D1E] rounded-3xl p-8 sm:p-10 text-center space-y-4 shadow-2xl text-[#FFF0BA]">
          <div className="inline-flex p-3.5 rounded-2xl bg-[#FFF0BA] text-[#111808] mb-1">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-2xl font-bold font-heading text-white">
            Round {resultSummary.roundNumber} Assessment Submitted
          </h3>
          <p className="text-xs sm:text-sm text-[#A6A998]">
            Your telemetry and answers were evaluated server-side.
          </p>
          <div className="inline-block px-8 py-4 rounded-2xl bg-[#17220B] border border-[#2E3D1E]">
            <span className="text-xs text-[#A6A998] block uppercase font-mono tracking-wider">Score Earned</span>
            <span className="text-4xl font-bold font-mono text-[#FFF0BA] tabular-nums mt-0.5 block">
              {resultSummary.score} Points
            </span>
          </div>
          <div className="pt-3">
            <button
              onClick={() => setResultSummary(null)}
              className="px-6 py-2.5 rounded-xl bg-[#FFF0BA] hover:bg-[#FFF4CC] text-[#111808] text-xs font-bold font-mono tracking-wider transition-colors cursor-pointer"
            >
              Return to Tournament Hub
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ACTIVE ATTEMPT RUNNER (DARK TERMINAL THEME WITH COLONIAL WHITE ACCENTS)  */}
      {/* ========================================================================= */}
      {attempt && attempt.status === 'in_progress' ? (
        <div className="bg-[#0B1006] border border-[#1F2B14] rounded-3xl p-5 sm:p-7 shadow-2xl space-y-6 text-[#E0E5D5]">
          {/* Top Control Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#1F2B14]">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#17220B] text-[#FFF0BA] border border-[#2E3D1E]">
                <Terminal className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold font-heading text-white">
                    {selectedRound?.title || `Round ${selectedRound?.roundNumber}`}
                  </h2>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#17220B] text-[#FFF0BA] border border-[#2E3D1E]">
                    LIVE PROCTORING
                  </span>
                </div>
                <p className="text-xs text-[#8A957C] mt-0.5">
                  Question {currentQIndex + 1} of {attempt.questions.length} · {currentQ?.category}
                </p>
              </div>
            </div>

            {/* Timer & Proctor Status */}
            <div className="flex items-center gap-3 self-end sm:self-center">
              {!isFullscreen && (
                <button
                  onClick={enterFullscreen}
                  className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#17220B] hover:bg-[#202E0E] text-[#FFF0BA] border border-[#2E3D1E] text-xs font-medium cursor-pointer transition-colors"
                  title="Expand to Fullscreen"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Enforce Fullscreen</span>
                </button>
              )}

              {/* Anti-cheat strikes indicator */}
              <div
                className={`flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-xl border ${
                  strikes > 0
                    ? 'bg-rose-950/60 text-rose-400 border-rose-600/60'
                    : 'bg-[#17220B] text-[#E0E5D5] border-[#2E3D1E]'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Strikes: {strikes}/2</span>
              </div>

              {/* Countdown Timer */}
              <div
                className={`flex items-center gap-2 text-sm sm:text-base font-bold font-mono px-4 py-1.5 rounded-xl border tabular-nums ${
                  secondsRemaining < 120
                    ? 'bg-rose-950/70 text-rose-400 border-rose-500 animate-pulse'
                    : 'bg-[#17220B] text-[#FFF0BA] border-[#2E3D1E]'
                }`}
              >
                <Clock className="w-4 h-4 text-[#FFF0BA]" />
                <span>{formatTime(secondsRemaining)}</span>
              </div>
            </div>
          </div>

          {/* Question Body & Navigator Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Main Question Panel (3 cols) */}
            <div className="lg:col-span-3 space-y-6">
              {currentQ && (
                <div className="space-y-4">
                  {/* Prompt Box */}
                  <div className="bg-[#0E1508] border border-[#1E2B12] rounded-2xl p-6">
                    <div className="flex items-center justify-between text-xs text-[#8A957C] mb-3 font-mono">
                      <span>QUESTION {currentQIndex + 1} OF {attempt.questions.length}</span>
                      <span className="text-[#FFF0BA] font-bold">{currentQ.points} POINTS</span>
                    </div>

                    <h3 className="text-base sm:text-lg font-medium text-white leading-relaxed whitespace-pre-wrap">
                      {currentQ.prompt}
                    </h3>
                  </div>

                  {/* MCQ Options */}
                  {currentQ.type === 'mcq' && currentQ.options && (
                    <div className="space-y-3">
                      <div className="text-xs font-mono text-[#8A957C] uppercase tracking-wider">
                        Select single optimal solution:
                      </div>

                      <div className="grid grid-cols-1 gap-2.5">
                        {currentQ.options.map((opt, optIdx) => {
                          const isSelected = answers[currentQ.id]?.selectedOption === optIdx;
                          return (
                            <button
                              key={optIdx}
                              type="button"
                              onClick={() => handleSelectOption(optIdx)}
                              className={`w-full p-4 rounded-xl text-left text-xs sm:text-sm transition-all flex items-start gap-3 cursor-pointer border ${
                                isSelected
                                  ? 'bg-[#FFF0BA] border-[#FFF0BA] text-[#111808] font-semibold ring-2 ring-[#FFF0BA]/30 shadow-md'
                                  : 'bg-[#0E1508] border-[#1E2B12] text-[#E0E5D5] hover:border-[#2E3D1E] hover:bg-[#131D0B]'
                              }`}
                            >
                              <span
                                className={`w-6 h-6 rounded-md font-mono text-xs flex items-center justify-center shrink-0 border ${
                                  isSelected
                                    ? 'bg-[#111808] text-[#FFF0BA] border-[#111808]'
                                    : 'bg-[#17220B] text-[#8A957C] border-[#2E3D1E]'
                                }`}
                              >
                                {String.fromCharCode(65 + optIdx)}
                              </span>
                              <span className="pt-0.5 leading-relaxed">{opt}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Code Editor */}
                  {currentQ.type === 'code' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs font-mono text-[#8A957C]">
                        <span className="flex items-center gap-1.5">
                          <Code className="w-3.5 h-3.5 text-[#FFF0BA]" />
                          Algorithmic Execution Buffer (JavaScript / TypeScript / Python)
                        </span>
                        <span>{savingAnswer ? 'Autosaving...' : 'Saved to Server'}</span>
                      </div>

                      <div className="relative">
                        <textarea
                          rows={12}
                          value={activeCode}
                          onChange={(e) => setActiveCode(e.target.value)}
                          placeholder="// Write or implement your solution here..."
                          className="w-full bg-[#070A04] border border-[#1E2B12] focus:border-[#FFF0BA] rounded-2xl p-4 font-mono text-xs sm:text-sm text-[#FFF0BA] placeholder-[#4B5E38] outline-none leading-relaxed resize-y selection:bg-[#FFF0BA] selection:text-[#111808]"
                        />
                      </div>

                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={handleSaveCode}
                          disabled={savingAnswer}
                          className="px-4 py-2 rounded-xl bg-[#17220B] hover:bg-[#202E0E] text-[#FFF0BA] border border-[#2E3D1E] text-xs font-mono font-semibold transition-colors cursor-pointer"
                        >
                          {savingAnswer ? 'Saving Solution...' : 'Save Code Solution'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Navigation and Submission Buttons */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-6 border-t border-[#1F2B14]">
                    <button
                      type="button"
                      disabled={currentQIndex === 0}
                      onClick={() => handleNavigateQuestion(currentQIndex - 1)}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#0E1508] hover:bg-[#131D0B] disabled:opacity-30 disabled:cursor-not-allowed border border-[#1E2B12] text-xs font-medium text-[#E0E5D5] flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Previous Question</span>
                    </button>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      {currentQIndex < attempt.questions.length - 1 ? (
                        <button
                          type="button"
                          onClick={() => handleNavigateQuestion(currentQIndex + 1)}
                          className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#FFF0BA] hover:bg-[#FFF4CC] text-[#111808] text-xs font-bold font-mono tracking-wide flex items-center justify-center gap-2 transition-colors cursor-pointer"
                        >
                          <span>Save & Next</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowConfirmSubmit(true)}
                          className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold font-mono tracking-wide shadow-lg transition-all cursor-pointer"
                        >
                          Submit Assessment
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Question Navigator (1 col) */}
            <div className="bg-[#0E1508] border border-[#1E2B12] rounded-2xl p-5 space-y-4 self-start">
              <h4 className="text-xs font-bold font-mono uppercase text-[#8A957C] tracking-wider">
                Question Matrix
              </h4>

              <div className="grid grid-cols-5 sm:grid-cols-6 lg:grid-cols-4 gap-2">
                {attempt.questions.map((q, idx) => {
                  const hasAnswer =
                    answers[q.id]?.selectedOption !== undefined ||
                    (answers[q.id]?.submittedCode && answers[q.id].submittedCode!.length > 10);
                  const isCurrent = idx === currentQIndex;

                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => handleNavigateQuestion(idx)}
                      className={`h-9 rounded-lg font-mono text-xs font-semibold transition-all flex items-center justify-center cursor-pointer border ${
                        isCurrent
                          ? 'border-[#FFF0BA] bg-[#FFF0BA] text-[#111808] font-bold shadow-md'
                          : hasAnswer
                          ? 'bg-[#1C2C10] border-[#2F4A1B] text-[#86EFAC]'
                          : 'bg-[#131D0B] border-[#1E2B12] text-[#6B7E58] hover:text-[#FFF0BA]'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>

              <div className="pt-3 border-t border-[#1E2B12] space-y-2 text-[11px] text-[#8A957C]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#86EFAC] inline-block" />
                  <span>Answered / Saved</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FFF0BA] inline-block" />
                  <span>Current Question</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#131D0B] border border-[#1E2B12] inline-block" />
                  <span>Unanswered</span>
                </div>
              </div>

              <div className="pt-3 border-t border-[#1E2B12]">
                <button
                  type="button"
                  onClick={() => setShowConfirmSubmit(true)}
                  className="w-full py-2.5 rounded-xl bg-[#17220B] hover:bg-rose-950/60 text-[#FFF0BA] hover:text-rose-300 border border-[#2E3D1E] hover:border-rose-700/60 text-xs font-mono font-semibold transition-colors cursor-pointer"
                >
                  Finalize & Submit
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* ROUND SELECTION & TOURNAMENT TERMINAL OVERVIEW (EDITORIAL RETRO-GRID)     */
        /* ========================================================================= */
        <div className="space-y-6">
          {/* Welcome Hero Card */}
          <div className="bg-[#111808] border border-[#111808] rounded-3xl p-6 sm:p-10 shadow-xl relative overflow-hidden text-[#FFF0BA]">
            <div className="max-w-2xl relative z-10">
              <div className="text-xs font-mono text-[#A6A998] mb-2 tracking-wider">
                QUALIFIER ARENA PROTOCOL · 2026 INTER-COLLEGE EDITION
              </div>
              <h1 className="text-2xl sm:text-4xl font-bold font-heading text-white tracking-tight">
                COMPETITION ARENA TERMINAL
              </h1>
              <p className="text-xs sm:text-sm text-[#A6A998] mt-3 leading-relaxed">
                Inter-College Technical Fest Championship. Each team terminal is strictly proctored with
                dual-strike anti-cheat monitoring (tab switches, focus departures, and inspector triggers).
              </p>

              {user ? (
                <div className="flex flex-wrap items-center gap-2.5 mt-5 text-xs">
                  <span className="px-3 py-1.5 rounded-lg bg-[#FFF0BA] text-[#111808] font-mono font-bold">
                    Terminal: {user.code}
                  </span>
                  <span className="px-3 py-1.5 rounded-lg bg-[#1F2B14] text-[#E0E5D5] border border-[#2E3D1E]">
                    Team: {user.teamName} ({user.college})
                  </span>
                  <span className="px-3 py-1.5 rounded-lg bg-[#1F2B14] text-[#E0E5D5] border border-[#2E3D1E]">
                    Strikes: {user.violations || 0} / 2
                  </span>
                </div>
              ) : (
                <div className="mt-6">
                  <button
                    onClick={onOpenAuth}
                    className="px-6 py-3 rounded-2xl bg-[#FFF0BA] hover:bg-[#FFF4CC] text-[#111808] font-bold text-xs font-mono tracking-wider shadow-sm transition-all cursor-pointer"
                  >
                    Connect or Register Team Terminal
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Rounds Progression Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {rounds.map((round) => {
              const isR1Done = user?.r1Completed && round.roundNumber === 1;
              const isR2Done = user?.r2Completed && round.roundNumber === 2;
              const isR3Done = user?.r3Completed && round.roundNumber === 3;
              const isCompleted = isR1Done || isR2Done || isR3Done;

              let earnedScore = 0;
              if (round.roundNumber === 1) earnedScore = user?.r1Score || 0;
              if (round.roundNumber === 2) earnedScore = user?.r2Score || 0;
              if (round.roundNumber === 3) earnedScore = user?.r3Score || 0;

              return (
                <div
                  key={round.id}
                  className={`bg-white border rounded-3xl p-6 flex flex-col justify-between transition-all shadow-sm ${
                    round.isOpen
                      ? 'border-[#E5E0D8] hover:border-[#111808]'
                      : 'border-[#E5E0D8]/60 opacity-60'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-[#111808] uppercase tracking-wider">
                        ROUND 0{round.roundNumber}
                      </span>
                      {isCompleted ? (
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-[#FFF0BA] text-[#111808] border border-[#111808]/20 flex items-center gap-1 font-semibold">
                          <CheckCircle2 className="w-3 h-3" /> Completed
                        </span>
                      ) : round.isOpen ? (
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-[#F0EEE6] text-[#111808] border border-[#E5E0D8] font-medium">
                          Active
                        </span>
                      ) : (
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-[#F0EEE6] text-[#656858] border border-[#E5E0D8]">
                          Locked
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-bold font-heading text-[#111808]">{round.title}</h3>
                    <p className="text-xs text-[#656858] leading-relaxed">{round.description}</p>

                    <div className="flex items-center gap-3 text-xs text-[#656858] font-mono pt-2">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-[#111808]" />
                        {round.durationMinutes} Mins
                      </span>
                      <span className="flex items-center gap-1">
                        <Shield className="w-3.5 h-3.5 text-rose-600" />
                        Max {round.maxViolations} Strikes
                      </span>
                    </div>

                    {isCompleted && (
                      <div className="p-3 rounded-2xl bg-[#FAFAF7] border border-[#E5E0D8] text-xs">
                        <span className="text-[#656858] block text-[11px]">Recorded Score:</span>
                        <span className="text-base font-bold font-mono text-[#111808] tabular-nums">
                          {earnedScore} Points
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="pt-6 mt-4 border-t border-[#E5E0D8]">
                    <button
                      type="button"
                      disabled={loadingRound || user?.isBlocked || !round.isOpen}
                      onClick={() => handleStartAttempt(round.roundNumber)}
                      className={`w-full py-3 rounded-xl font-bold text-xs tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        round.isOpen && !user?.isBlocked
                          ? 'bg-[#111808] hover:bg-[#1f2b0f] text-[#FFF0BA] shadow-sm'
                          : 'bg-[#F0EEE6] text-[#8C9080] cursor-not-allowed'
                      }`}
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>
                        {loadingRound
                          ? 'Booting...'
                          : isCompleted
                          ? 'Review / Re-Enter Terminal'
                          : 'Enter Assessment Node'}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Proctor Integrity Rules Banner */}
          <div className="bg-white border border-[#E5E0D8] rounded-3xl p-6 sm:p-7 space-y-4 shadow-sm">
            <h4 className="text-xs font-bold font-mono uppercase text-[#111808] tracking-wider flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#111808]" />
              Tournament Anti-Cheat & Proctor Guidelines
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-[#656858]">
              <div className="p-4 rounded-2xl bg-[#FAFAF7] border border-[#E5E0D8]">
                <span className="font-semibold text-[#111808] block mb-1">1. Enforced Focus</span>
                Departing the browser window, tab switching, or opening devtools registers a security strike.
              </div>
              <div className="p-4 rounded-2xl bg-[#FAFAF7] border border-[#E5E0D8]">
                <span className="font-semibold text-[#111808] block mb-1">2. Two-Strike Disqualification</span>
                Upon recording 2 strikes, terminal inputs are locked immediately and the attempt is frozen.
              </div>
              <div className="p-4 rounded-2xl bg-[#FAFAF7] border border-[#E5E0D8]">
                <span className="font-semibold text-[#111808] block mb-1">3. Server Synchronization</span>
                All timers are strictly validated server-side to prevent client clock manipulation.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Submitting Attempt */}
      {showConfirmSubmit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-white border border-[#E5E0D8] rounded-3xl p-6 shadow-2xl space-y-4 text-[#111808]">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold font-heading">Finalize & Submit Assessment?</h3>
              <button
                onClick={() => setShowConfirmSubmit(false)}
                className="p-1 rounded-lg hover:bg-[#F0EEE6] text-[#656858]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[#656858] leading-relaxed">
              Are you sure you want to finalize this round? All saved answers will be scored server-side and recorded to your team's total standings.
            </p>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E5E0D8]">
              <button
                type="button"
                onClick={() => setShowConfirmSubmit(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#656858] hover:text-[#111808] bg-[#F0EEE6] cursor-pointer"
              >
                Return to Questions
              </button>
              <button
                type="button"
                disabled={submittingAttempt}
                onClick={confirmSubmitAttempt}
                className="px-5 py-2 rounded-xl text-xs font-bold font-mono tracking-wider bg-[#111808] hover:bg-[#1f2b0f] text-[#FFF0BA] cursor-pointer"
              >
                {submittingAttempt ? 'Scoring Answers...' : 'Confirm Submission'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
