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
  Unlock,
  RefreshCw,
  Bookmark,
  Award,
  HelpCircle,
  ArrowRight,
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
  const [markedForReview, setMarkedForReview] = useState<Record<number, boolean>>({});
  const [activeCode, setActiveCode] = useState<string>('');
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);
  const [strikes, setStrikes] = useState<number>(0);
  const [securityWarning, setSecurityWarning] = useState<string | null>(null);
  const [loadingRound, setLoadingRound] = useState(false);
  const [submittingAttempt, setSubmittingAttempt] = useState(false);
  const [savingAnswer, setSavingAnswer] = useState(false);
  const [resultSummary, setResultSummary] = useState<{
    score: number;
    roundNumber: number;
    maxScore?: number;
    qualifyingScore?: number;
    qualifyingPercentage?: number;
    isQualified?: boolean;
    message?: string;
  } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [uiError, setUiError] = useState<string | null>(null);
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | 'easy' | 'moderate' | 'hard'>('all');
  const [cardDifficultyChoice, setCardDifficultyChoice] = useState<Record<number, 'all' | 'easy' | 'moderate' | 'hard'>>({
    1: 'all',
    2: 'all',
    3: 'all',
  });

  const containerRef = useRef<HTMLDivElement>(null);

  const getQuestionDifficulty = (q: any): 'easy' | 'moderate' | 'hard' => {
    const cat = String(q?.category || '').toLowerCase();
    const code = String(q?.code || '').toUpperCase();
    if (
      cat.includes('moderate') ||
      cat.includes('set b') ||
      code.startsWith('R1_M') ||
      code.startsWith('R2_B') ||
      code.startsWith('R3_M')
    ) {
      return 'moderate';
    }
    if (
      cat.includes('hard') ||
      cat.includes('difficult') ||
      cat.includes('set c') ||
      code.startsWith('R1_H') ||
      code.startsWith('R2_C') ||
      code.startsWith('R3_H') ||
      code.startsWith('H')
    ) {
      return 'hard';
    }
    return 'easy';
  };

  const isQuestionAnswered = (q: any): boolean => {
    const ans = answers[q.id];
    if (!ans) return false;
    if (q.type === 'code') {
      const sub = String(ans.submittedCode || '').trim();
      const starter = String(q.codeStarter || '').trim();
      return sub.length >= 15 && sub !== starter;
    }
    if (q.type === 'qa' || attempt?.roundNumber === 2) {
      return String(ans.submittedCode || '').trim().length > 0;
    }
    return ans.selectedOption !== undefined;
  };

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

  // Timer countdown: only active while task is running and NOT suspended
  useEffect(() => {
    if (!attempt || (attempt.status !== 'in_progress' && attempt.status !== 'resumed')) return;

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          handleAutoTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [attempt?.attemptId, attempt?.status]);

  // Periodic server sync: authoritative countdown and live proctor status polling
  useEffect(() => {
    if (!attempt || !token) return;

    const isOngoing =
      attempt.status === 'in_progress' ||
      attempt.status === 'resumed' ||
      attempt.status === 'suspended_awaiting_approval';
    if (!isOngoing) return;

    // Fast polling (3 seconds) while suspended to unlock immediately upon admin decision
    const pollIntervalMs = attempt.status === 'suspended_awaiting_approval' ? 3000 : 10000;

    const syncPing = async () => {
      try {
        const res = await fetch(`/api/attempts/${attempt.attemptId}/sync`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const syncData = await res.json();
          setSecondsRemaining(syncData.remainingSeconds);
          setStrikes(syncData.violationsCount || 0);

          if (syncData.status === 'resumed') {
            if (attempt.status === 'suspended_awaiting_approval') {
              setSecurityWarning('Chief Proctor approved task resumption! Remaining time and progress preserved.');
              setTimeout(() => setSecurityWarning(null), 6000);
            }
            setAttempt((prev) => (prev ? { ...prev, status: 'resumed' } : null));
            onProfileUpdated();
          } else if (syncData.status === 'suspended_awaiting_approval') {
            setAttempt((prev) => (prev ? { ...prev, status: 'suspended_awaiting_approval' } : null));
          } else if (syncData.status === 'terminated') {
            setAttempt((prev) => (prev ? { ...prev, status: 'terminated' } : null));
            setSecurityWarning(syncData.terminationReason || 'Attempt session was permanently terminated by Chief Proctor.');
            onProfileUpdated();
          } else if (syncData.status === 'timed_out') {
            setAttempt((prev) => (prev ? { ...prev, status: 'timed_out' } : null));
            onProfileUpdated();
          }
        }
      } catch (err) {
        console.warn('Sync attempt ping failed:', err);
      }
    };

    const syncInterval = setInterval(syncPing, pollIntervalMs);
    return () => clearInterval(syncInterval);
  }, [attempt?.attemptId, attempt?.status, token]);

  // Anti-cheat detection: immediate suspension on tab/window departure
  useEffect(() => {
    if (!attempt || (attempt.status !== 'in_progress' && attempt.status !== 'resumed') || !token) return;

    let isDispatching = false;

    const reportSecurityEvent = async (type: string, details: string) => {
      if (isDispatching) return;
      isDispatching = true;

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
          setStrikes(data.strikes || data.incidentCount || 1);
          if (data.suspended || data.status === 'suspended_awaiting_approval') {
            setAttempt((prev) => (prev ? { ...prev, status: 'suspended_awaiting_approval' } : null));
            setSecurityWarning(
              data.message || 'Task suspended: Window or tab departure detected. Proctor authorization required.'
            );
            onProfileUpdated();
          } else if (data.terminated) {
            setSecurityWarning(data.message || 'Attempt terminated due to security violation policy.');
            setAttempt((prev) => (prev ? { ...prev, status: 'terminated' } : null));
            onProfileUpdated();
          }
        }
      } catch (err) {
        console.error('Failed to report security violation:', err);
      } finally {
        setTimeout(() => {
          isDispatching = false;
        }, 1200);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        reportSecurityEvent('tab_hidden', 'Browser tab switched or minimized.');
      }
    };

    const handleWindowBlur = () => {
      reportSecurityEvent('window_blur', 'Window focus lost — participant switched application or tab.');
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

  const handleStartAttempt = async (roundNum: number, preferredDifficulty?: 'all' | 'easy' | 'moderate' | 'hard') => {
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

      const chosenTier = preferredDifficulty || cardDifficultyChoice[roundNum] || 'all';
      let initialIndex = 0;
      if (chosenTier !== 'all' && Array.isArray(data.questions)) {
        const matchIdx = data.questions.findIndex((q: any) => getQuestionDifficulty(q) === chosenTier);
        if (matchIdx >= 0) initialIndex = matchIdx;
      }

      setAttempt(data);
      setAnswers(data.savedAnswers || {});
      setSecondsRemaining(data.remainingSeconds);
      setStrikes(data.violationsCount || 0);
      setCurrentQIndex(initialIndex);
      setDifficultyFilter(chosenTier);

      // Initialize code editor starter or Q&A answer box if initial question is code or qa
      const firstQ = data.questions?.[initialIndex];
      if (firstQ?.type === 'code' || firstQ?.type === 'qa' || data.roundNumber === 2) {
        const saved = data.savedAnswers?.[firstQ.id]?.submittedCode;
        setActiveCode(saved !== undefined ? saved : firstQ?.type === 'code' ? firstQ.codeStarter || '' : '');
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
    if (!attempt || !token || attempt.status === 'suspended_awaiting_approval') return;
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
    if (!attempt || !token || attempt.status === 'suspended_awaiting_approval') return;
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

  const handleNavigateQuestion = async (newIndex: number) => {
    if (!attempt || newIndex < 0 || newIndex >= attempt.questions.length) return;
    // Auto-save current code or Q&A answer if modified before switching questions
    const currQ = attempt.questions[currentQIndex];
    if (currQ?.type === 'code' && activeCode.trim() !== (currQ.codeStarter || '').trim()) {
      await handleSaveCode();
    } else if (
      (currQ?.type === 'qa' || attempt.roundNumber === 2) &&
      activeCode.trim() !== String(answers[currQ.id]?.submittedCode || '').trim()
    ) {
      await handleSaveCode();
    }
    setCurrentQIndex(newIndex);
    const targetQ = attempt.questions[newIndex];
    if (targetQ?.type === 'code') {
      const saved = answers[targetQ.id]?.submittedCode;
      setActiveCode(saved || targetQ.codeStarter || '');
    } else if (targetQ?.type === 'qa' || attempt.roundNumber === 2) {
      const saved = answers[targetQ.id]?.submittedCode;
      setActiveCode(saved || '');
    }
  };

  const toggleMarkForReview = (qId: number) => {
    setMarkedForReview((prev) => ({
      ...prev,
      [qId]: !prev[qId],
    }));
  };

  const confirmSubmitAttempt = async () => {
    if (!attempt || !token || attempt.status === 'suspended_awaiting_approval') return;
    setSubmittingAttempt(true);
    setShowConfirmSubmit(false);
    try {
      const currQ = attempt.questions[currentQIndex];
      if (currQ?.type === 'code' && activeCode.trim() !== (currQ.codeStarter || '').trim()) {
        await handleSaveCode();
      } else if (
        (currQ?.type === 'qa' || attempt.roundNumber === 2) &&
        activeCode.trim() !== String(answers[currQ.id]?.submittedCode || '').trim()
      ) {
        await handleSaveCode();
      }
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
        maxScore: data.maxScore,
        qualifyingScore: data.qualifyingScore,
        qualifyingPercentage: data.qualifyingPercentage,
        isQualified: data.isQualified,
        message: data.message,
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

  const filteredQuestionIndices = React.useMemo(() => {
    if (!attempt?.questions) return [];
    return attempt.questions
      .map((q, idx) => ({ q, idx, diff: getQuestionDifficulty(q) }))
      .filter((item) => difficultyFilter === 'all' || item.diff === difficultyFilter)
      .map((item) => item.idx);
  }, [attempt?.questions, difficultyFilter]);

  const handleSelectDifficultyFilter = (tier: 'all' | 'easy' | 'moderate' | 'hard') => {
    setDifficultyFilter(tier);
    if (!attempt?.questions) return;
    if (tier === 'all') return;
    const currentDiff = currentQ ? getQuestionDifficulty(currentQ) : 'easy';
    if (currentDiff !== tier) {
      const matchingIndices = attempt.questions
        .map((q, idx) => ({ q, idx }))
        .filter(({ q }) => getQuestionDifficulty(q) === tier);
      const firstUnanswered = matchingIndices.find(({ q }) => !isQuestionAnswered(q));
      const target = firstUnanswered || matchingIndices[0];
      if (target) {
        handleNavigateQuestion(target.idx);
      }
    }
  };

  const posInFiltered = filteredQuestionIndices.indexOf(currentQIndex);
  const prevFilteredIndex = posInFiltered > 0 ? filteredQuestionIndices[posInFiltered - 1] : null;
  const nextFilteredIndex =
    posInFiltered >= 0 && posInFiltered < filteredQuestionIndices.length - 1
      ? filteredQuestionIndices[posInFiltered + 1]
      : null;

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
        <div className="bg-[#111808] border border-[#2E3D1E] rounded-3xl p-8 sm:p-10 text-center space-y-5 shadow-2xl text-[#FFF0BA]">
          <div className="inline-flex p-3.5 rounded-2xl bg-[#FFF0BA] text-[#111808] mb-1">
            {resultSummary.isQualified ? <Award className="w-8 h-8" /> : <CheckCircle2 className="w-8 h-8" />}
          </div>
          <div>
            <h3 className="text-2xl font-bold font-heading text-white">
              Round {resultSummary.roundNumber} Assessment Submitted
            </h3>
            <p className="text-xs sm:text-sm text-[#A6A998] mt-1">
              Your answers have been evaluated and recorded server-side.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <div className="px-6 py-4 rounded-2xl bg-[#17220B] border border-[#2E3D1E] min-w-[150px]">
              <span className="text-xs text-[#A6A998] block uppercase font-mono tracking-wider">Score Earned</span>
              <span className="text-3xl font-bold font-mono text-[#FFF0BA] tabular-nums mt-0.5 block">
                {resultSummary.score} / {resultSummary.maxScore || (resultSummary.roundNumber === 1 ? 30 : resultSummary.roundNumber === 2 ? 300 : 30)}
              </span>
            </div>

            <div className="px-6 py-4 rounded-2xl bg-[#17220B] border border-[#2E3D1E] min-w-[150px]">
              <span className="text-xs text-[#A6A998] block uppercase font-mono tracking-wider">Qualification Status</span>
              <span className={`text-base font-bold font-mono mt-1 block uppercase ${resultSummary.isQualified ? 'text-[#86EFAC]' : 'text-amber-400'}`}>
                {resultSummary.isQualified ? '✓ QUALIFIED' : 'DID NOT QUALIFY'}
              </span>
            </div>

            <div className="px-6 py-4 rounded-2xl bg-[#17220B] border border-[#2E3D1E] min-w-[150px]">
              <span className="text-xs text-[#A6A998] block uppercase font-mono tracking-wider">Pass Threshold</span>
              <span className="text-xl font-bold font-mono text-[#E0E5D5] tabular-nums mt-0.5 block">
                {resultSummary.qualifyingPercentage || 60}% ({resultSummary.qualifyingScore || (resultSummary.roundNumber === 1 ? 18 : resultSummary.roundNumber === 2 ? 180 : 18)} pts)
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#0E1508] border border-[#1E2B12] text-xs text-[#A6A998] max-w-xl mx-auto">
            {resultSummary.message || (resultSummary.isQualified ? 'You have met the qualification requirements.' : 'You did not meet the minimum qualification threshold.')}
            <span className="block mt-1 text-[11px] text-[#6B7E58]">
              In accordance with tournament policy, question answers are kept strictly confidential and are not displayed.
            </span>
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            {resultSummary.isQualified && resultSummary.roundNumber < 3 && (
              <button
                onClick={() => {
                  const nextR = resultSummary.roundNumber + 1;
                  setResultSummary(null);
                  handleStartAttempt(nextR);
                }}
                className="px-6 py-2.5 rounded-xl bg-[#FFF0BA] hover:bg-[#FFF4CC] text-[#111808] text-xs font-bold font-mono tracking-wider transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span>Advance to Round {resultSummary.roundNumber + 1}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setResultSummary(null)}
              className="px-6 py-2.5 rounded-xl bg-[#17220B] hover:bg-[#202E0E] text-[#FFF0BA] border border-[#2E3D1E] text-xs font-bold font-mono tracking-wider transition-colors cursor-pointer"
            >
              Return to Tournament Hub
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ACTIVE ATTEMPT RUNNER (DARK TERMINAL THEME WITH COLONIAL WHITE ACCENTS)  */}
      {/* ========================================================================= */}
      {attempt && (attempt.status === 'in_progress' || attempt.status === 'resumed' || attempt.status === 'suspended_awaiting_approval') ? (
        <div className="bg-[#0B1006] border border-[#1F2B14] rounded-3xl p-5 sm:p-7 shadow-2xl space-y-6 text-[#E0E5D5]">
          {/* Top Control Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#1F2B14]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white p-1 flex items-center justify-center border border-[#2E3D1E] shadow-sm overflow-hidden shrink-0">
                <img
                  src="/assets/aistudio/acd7f777-797e-4ce6-ae26-4077fe5fb474_aeab48d4.png"
                  alt="TECH ARENA"
                  className="w-full h-full object-contain"
                />
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

              {/* Anti-cheat strikes & suspension indicator */}
              {attempt.status === 'suspended_awaiting_approval' ? (
                <div className="flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-xl border bg-amber-950/80 text-amber-300 border-amber-600/80 animate-pulse">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                  <span>SUSPENDED — AWAITING REVIEW</span>
                </div>
              ) : (
                <div
                  className={`flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-xl border ${
                    strikes > 0
                      ? 'bg-rose-950/60 text-rose-400 border-rose-600/60'
                      : 'bg-[#17220B] text-[#E0E5D5] border-[#2E3D1E]'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Tab Incidents: {strikes}</span>
                </div>
              )}

              {/* Countdown Timer */}
              <div
                className={`flex items-center gap-2 text-sm sm:text-base font-bold font-mono px-4 py-1.5 rounded-xl border tabular-nums ${
                  attempt.status === 'suspended_awaiting_approval'
                    ? 'bg-amber-950/70 text-amber-300 border-amber-500'
                    : secondsRemaining < 120
                    ? 'bg-rose-950/70 text-rose-400 border-rose-500 animate-pulse'
                    : 'bg-[#17220B] text-[#FFF0BA] border-[#2E3D1E]'
                }`}
              >
                <Clock className="w-4 h-4 text-[#FFF0BA]" />
                <span>{formatTime(secondsRemaining)}</span>
                {attempt.status === 'suspended_awaiting_approval' && (
                  <span className="text-[10px] uppercase tracking-wider text-amber-400 font-normal">Frozen</span>
                )}
              </div>
            </div>
          </div>

          {/* Top-Level Easy / Moderate / Hard Option Buttons Bar for Round 1 & Round 2 */}
          {(attempt.roundNumber === 1 || attempt.roundNumber === 2 || attempt.questions.length > 0) && (
            <div className="bg-[#0E1508] border border-[#2E3D1E] rounded-2xl p-3.5 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-md">
              <div className="flex items-center gap-2.5">
                <span className="px-2.5 py-1 rounded-lg bg-[#FFF0BA] text-[#111808] font-mono text-xs font-bold uppercase tracking-wider">
                  Round 0{attempt.roundNumber} Difficulty Options
                </span>
                <span className="text-xs font-mono text-[#A6A998]">
                  Select <strong className="text-emerald-300">Easy</strong>, <strong className="text-amber-300">Moderate</strong>, or <strong className="text-rose-300">Hard</strong> questions according to your choice:
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {(['easy', 'moderate', 'hard', 'all'] as const).map((tier) => {
                  const count =
                    tier === 'all'
                      ? attempt.questions.length
                      : attempt.questions.filter((q) => getQuestionDifficulty(q) === tier).length;
                  const answeredInTier =
                    tier === 'all'
                      ? attempt.questions.filter((q) => isQuestionAnswered(q)).length
                      : attempt.questions.filter(
                          (q) => getQuestionDifficulty(q) === tier && isQuestionAnswered(q)
                        ).length;
                  const isActive = difficultyFilter === tier;
                  const label =
                    tier === 'easy'
                      ? 'Easy'
                      : tier === 'moderate'
                      ? 'Moderate'
                      : tier === 'hard'
                      ? 'Hard'
                      : 'All Jumbled';
                  const activeStyle =
                    tier === 'easy'
                      ? 'bg-emerald-400 text-[#0B1006] border-emerald-300 shadow-md font-bold'
                      : tier === 'moderate'
                      ? 'bg-amber-400 text-[#0B1006] border-amber-300 shadow-md font-bold'
                      : tier === 'hard'
                      ? 'bg-rose-400 text-[#0B1006] border-rose-300 shadow-md font-bold'
                      : 'bg-[#FFF0BA] text-[#111808] border-[#FFF0BA] shadow-md font-bold';
                  const inactiveStyle =
                    tier === 'easy'
                      ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60 hover:bg-emerald-900/70'
                      : tier === 'moderate'
                      ? 'bg-amber-950/60 text-amber-300 border-amber-700/60 hover:bg-amber-900/70'
                      : tier === 'hard'
                      ? 'bg-rose-950/60 text-rose-300 border-rose-700/60 hover:bg-rose-900/70'
                      : 'bg-[#17220B] text-[#E0E5D5] border-[#2E3D1E] hover:border-[#FFF0BA]/60';

                  return (
                    <button
                      key={tier}
                      type="button"
                      disabled={attempt.status === 'suspended_awaiting_approval'}
                      onClick={() => handleSelectDifficultyFilter(tier)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-mono transition-all cursor-pointer border flex items-center gap-2 disabled:opacity-40 ${
                        isActive ? activeStyle : inactiveStyle
                      }`}
                    >
                      <span>{label}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold ${
                          isActive ? 'bg-black/20 text-current' : 'bg-black/30 text-current'
                        }`}
                      >
                        {answeredInTier}/{count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Question Body & Navigator Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Main Question Panel (3 cols) */}
            <div className="lg:col-span-3 space-y-6">
              {/* Task Suspended Proctor Overlay */}
              {attempt.status === 'suspended_awaiting_approval' && (
                <div className="bg-[#111808] border-2 border-amber-500 rounded-2xl p-6 text-white shadow-2xl relative overflow-hidden">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
                      <ShieldAlert className="w-6 h-6 text-amber-400" />
                    </div>
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h4 className="text-base sm:text-lg font-bold text-[#FFF0BA] tracking-wide">
                          TASK SUSPENDED — TAB OR WINDOW SWITCH DETECTED
                        </h4>
                        <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          Single-Strike Security Lock
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-[#E0E5D5] leading-relaxed">
                        Leaving the active assessment window or switching tabs violates competition rules. In accordance with regulations, your task is temporarily locked, inputs are disabled, and remaining time has been frozen pending Chief Proctor administrative review.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs font-mono">
                        <div className="p-3 rounded-xl bg-[#0E1508] border border-[#1E2B12]">
                          <span className="text-[#8A957C] block text-[10px] uppercase">Preserved Time</span>
                          <span className="text-[#FFF0BA] font-bold text-sm">
                            {formatTime(secondsRemaining)} (Frozen)
                          </span>
                        </div>
                        <div className="p-3 rounded-xl bg-[#0E1508] border border-[#1E2B12]">
                          <span className="text-[#8A957C] block text-[10px] uppercase">Incident Recorded</span>
                          <span className="text-amber-300 font-bold text-sm">
                            Incident #{strikes} Logged
                          </span>
                        </div>
                        <div className="p-3 rounded-xl bg-[#0E1508] border border-[#1E2B12]">
                          <span className="text-[#8A957C] block text-[10px] uppercase">Proctor Status</span>
                          <span className="text-emerald-400 font-bold text-sm flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                            Awaiting Authorization
                          </span>
                        </div>
                      </div>
                      <p className="text-[11px] text-[#8A957C] pt-1">
                        Please notify tournament invigilators. The terminal is synchronizing every 3 seconds and will unlock immediately upon administrative approval.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {currentQ && (
                <div className={`space-y-4 ${attempt.status === 'suspended_awaiting_approval' ? 'opacity-50 pointer-events-none select-none' : ''}`}>

                  {/* Prompt Box */}
                  <div className="bg-[#0E1508] border border-[#1E2B12] rounded-2xl p-6">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#8A957C] mb-3 font-mono">
                      <div className="flex items-center gap-2">
                        <span className="text-[#FFF0BA] font-bold">
                          QUESTION {currentQIndex + 1} OF {attempt.questions.length}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            getQuestionDifficulty(currentQ) === 'easy'
                              ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60'
                              : getQuestionDifficulty(currentQ) === 'moderate'
                              ? 'bg-amber-950/80 text-amber-300 border border-amber-700/60'
                              : 'bg-rose-950/80 text-rose-300 border border-rose-700/60'
                          }`}
                        >
                          {getQuestionDifficulty(currentQ)}
                        </span>
                        <span>·</span>
                        <span className="text-[#A6A998]">{currentQ.category}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[#FFF0BA] font-bold">
                          {currentQ.points} MARK{currentQ.points > 1 ? 'S' : ''}
                        </span>
                        <button
                          type="button"
                          disabled={attempt.status === 'suspended_awaiting_approval'}
                          onClick={() => toggleMarkForReview(currentQ.id)}
                          className={`px-2.5 py-1 rounded-lg border text-[11px] font-mono transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                            markedForReview[currentQ.id]
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 font-semibold'
                              : 'bg-[#17220B] text-[#8A957C] border-[#2E3D1E] hover:text-[#FFF0BA]'
                          }`}
                        >
                          <Bookmark className={`w-3 h-3 ${markedForReview[currentQ.id] ? 'fill-current' : ''}`} />
                          <span>{markedForReview[currentQ.id] ? 'Marked for Review' : 'Mark for Review'}</span>
                        </button>
                      </div>
                    </div>

                    <h3 className="text-base sm:text-lg font-medium text-white leading-relaxed whitespace-pre-wrap">
                      {currentQ.prompt}
                    </h3>
                  </div>

                  {/* MCQ Options (Round 1 only — never shown in Round 2 Q&A) */}
                  {currentQ.type === 'mcq' && attempt.roundNumber !== 2 && currentQ.options && (
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
                              disabled={attempt.status === 'suspended_awaiting_approval'}
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

                  {/* Question & Answer (Q&A) Box for Round 2 (No MCQs) */}
                  {(currentQ.type === 'qa' || (attempt.roundNumber === 2 && currentQ.type !== 'code')) && (
                    <div className="bg-[#0E1508] border border-[#2E3D1E] rounded-2xl p-5 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                        <span className="flex items-center gap-2 text-[#FFF0BA] font-bold uppercase tracking-wider">
                          <FileText className="w-4 h-4 text-[#FFF0BA]" />
                          Your Answer Box (Direct Question & Answer)
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-md text-[11px] border ${
                            savingAnswer
                              ? 'bg-amber-950/60 text-amber-300 border-amber-700/60'
                              : String(answers[currentQ.id]?.submittedCode || '').trim().length > 0 &&
                                activeCode.trim() === String(answers[currentQ.id]?.submittedCode || '').trim()
                              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60'
                              : 'bg-[#17220B] text-[#8A957C] border-[#2E3D1E]'
                          }`}
                        >
                          {savingAnswer
                            ? 'Saving Answer...'
                            : String(answers[currentQ.id]?.submittedCode || '').trim().length > 0 &&
                              activeCode.trim() === String(answers[currentQ.id]?.submittedCode || '').trim()
                            ? '✓ Answer Saved'
                            : 'Type your answer below'}
                        </span>
                      </div>

                      <div className="relative">
                        <textarea
                          rows={4}
                          value={activeCode}
                          disabled={attempt.status === 'suspended_awaiting_approval'}
                          onChange={(e) => setActiveCode(e.target.value)}
                          onBlur={() => {
                            if (
                              activeCode.trim() !==
                              String(answers[currentQ.id]?.submittedCode || '').trim()
                            ) {
                              handleSaveCode();
                            }
                          }}
                          placeholder="Type your exact answer or output here..."
                          className="w-full bg-[#070A04] border border-[#2E3D1E] focus:border-[#FFF0BA] rounded-xl p-4 font-mono text-sm text-[#FFF0BA] placeholder-[#4B5E38] outline-none leading-relaxed resize-y selection:bg-[#FFF0BA] selection:text-[#111808] disabled:opacity-50"
                        />
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                        <span className="text-[11px] text-[#8A957C]">
                          Your typed response is automatically saved when you click <strong>Save Answer</strong> or <strong>Save &amp; Next</strong>.
                        </span>
                        <button
                          type="button"
                          onClick={handleSaveCode}
                          disabled={savingAnswer || attempt.status === 'suspended_awaiting_approval'}
                          className="px-4 py-2 rounded-xl bg-[#FFF0BA] hover:bg-[#FFF4CC] disabled:opacity-50 disabled:cursor-not-allowed text-[#111808] text-xs font-mono font-bold transition-colors cursor-pointer self-end sm:self-auto"
                        >
                          {savingAnswer ? 'Saving Answer...' : 'Save Answer'}
                        </button>
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
                          disabled={attempt.status === 'suspended_awaiting_approval'}
                          onChange={(e) => setActiveCode(e.target.value)}
                          placeholder="// Write or implement your solution here..."
                          className="w-full bg-[#070A04] border border-[#1E2B12] focus:border-[#FFF0BA] rounded-2xl p-4 font-mono text-xs sm:text-sm text-[#FFF0BA] placeholder-[#4B5E38] outline-none leading-relaxed resize-y selection:bg-[#FFF0BA] selection:text-[#111808] disabled:opacity-50"
                        />
                      </div>

                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={handleSaveCode}
                          disabled={savingAnswer || attempt.status === 'suspended_awaiting_approval'}
                          className="px-4 py-2 rounded-xl bg-[#17220B] hover:bg-[#202E0E] disabled:opacity-50 disabled:cursor-not-allowed text-[#FFF0BA] border border-[#2E3D1E] text-xs font-mono font-semibold transition-colors cursor-pointer"
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
                      disabled={prevFilteredIndex === null || attempt.status === 'suspended_awaiting_approval'}
                      onClick={() => prevFilteredIndex !== null && handleNavigateQuestion(prevFilteredIndex)}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#0E1508] hover:bg-[#131D0B] disabled:opacity-30 disabled:cursor-not-allowed border border-[#1E2B12] text-xs font-medium text-[#E0E5D5] flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Previous Question</span>
                    </button>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      {nextFilteredIndex !== null ? (
                        <button
                          type="button"
                          disabled={attempt.status === 'suspended_awaiting_approval'}
                          onClick={() => handleNavigateQuestion(nextFilteredIndex)}
                          className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#FFF0BA] hover:bg-[#FFF4CC] disabled:opacity-30 disabled:cursor-not-allowed text-[#111808] text-xs font-bold font-mono tracking-wide flex items-center justify-center gap-2 transition-colors cursor-pointer"
                        >
                          <span>Save & Next</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={attempt.status === 'suspended_awaiting_approval'}
                          onClick={() => setShowConfirmSubmit(true)}
                          className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs font-bold font-mono tracking-wide shadow-lg transition-all cursor-pointer"
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
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold font-mono uppercase text-[#8A957C] tracking-wider">
                  {difficultyFilter === 'all' ? 'Jumbled Palette' : `${difficultyFilter} Questions`}
                </h4>
                <span className="text-[11px] font-mono text-[#FFF0BA]">
                  {attempt.questions.filter((q) => isQuestionAnswered(q)).length}/{attempt.questions.length} Answered
                </span>
              </div>

              <div className="grid grid-cols-5 sm:grid-cols-6 lg:grid-cols-4 gap-2">
                {attempt.questions.map((q, idx) => {
                  const qDiff = getQuestionDifficulty(q);
                  if (difficultyFilter !== 'all' && qDiff !== difficultyFilter) return null;
                  const hasAnswer = isQuestionAnswered(q);
                  const isCurrent = idx === currentQIndex;
                  const isMarked = Boolean(markedForReview[q.id]);
                  const diffShort = qDiff === 'easy' ? 'E' : qDiff === 'moderate' ? 'M' : 'H';

                  return (
                    <button
                      key={q.id}
                      type="button"
                      disabled={attempt.status === 'suspended_awaiting_approval'}
                      onClick={() => handleNavigateQuestion(idx)}
                      title={`Question ${idx + 1} (${qDiff.toUpperCase()})`}
                      className={`h-10 rounded-lg font-mono text-xs font-semibold transition-all relative flex flex-col items-center justify-center cursor-pointer border disabled:opacity-40 disabled:cursor-not-allowed ${
                        isCurrent
                          ? 'border-[#FFF0BA] bg-[#FFF0BA] text-[#111808] font-bold shadow-md'
                          : isMarked
                          ? 'bg-amber-950/60 border-amber-500/80 text-amber-300 font-bold'
                          : hasAnswer
                          ? 'bg-[#1C2C10] border-[#2F4A1B] text-[#86EFAC]'
                          : 'bg-[#131D0B] border-[#1E2B12] text-[#6B7E58] hover:text-[#FFF0BA]'
                      }`}
                    >
                      <span className="leading-none">{idx + 1}</span>
                      <span
                        className={`text-[9px] leading-none mt-0.5 ${
                          isCurrent
                            ? 'text-[#111808]/80'
                            : qDiff === 'easy'
                            ? 'text-emerald-400'
                            : qDiff === 'moderate'
                            ? 'text-amber-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {diffShort}
                      </span>
                      {isMarked && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400" />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="pt-3 border-t border-[#1E2B12] space-y-2 text-[11px] text-[#8A957C]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#86EFAC] inline-block" />
                    <span>Answered</span>
                  </div>
                  <span className="font-mono text-[#86EFAC] font-bold">
                    {attempt.questions.filter((q) => isQuestionAnswered(q)).length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                    <span>Marked for Review</span>
                  </div>
                  <span className="font-mono text-amber-400 font-bold">
                    {Object.values(markedForReview).filter(Boolean).length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#FFF0BA] inline-block" />
                    <span>Current Question</span>
                  </div>
                  <span className="font-mono text-[#FFF0BA] font-bold">#{currentQIndex + 1}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#131D0B] border border-[#1E2B12] inline-block" />
                    <span>Unanswered</span>
                  </div>
                  <span className="font-mono text-[#8A957C] font-bold">
                    {Math.max(0, attempt.questions.length - attempt.questions.filter((q) => isQuestionAnswered(q)).length)}
                  </span>
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
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
              <div className="max-w-2xl">
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

              {/* Official Tech Arena Emblem */}
              <div className="hidden sm:flex shrink-0 self-center">
                <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl bg-white p-2.5 shadow-2xl flex items-center justify-center border-2 border-[#FFF0BA]/20 overflow-hidden">
                  <img
                    src="/assets/aistudio/acd7f777-797e-4ce6-ae26-4077fe5fb474_aeab48d4.png"
                    alt="TECH ARENA Logo"
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Rounds Progression Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {rounds.map((round) => {
              const rNum = round.roundNumber;
              const isR1Done = user?.r1Completed && rNum === 1;
              const isR2Done = user?.r2Completed && rNum === 2;
              const isR3Done = user?.r3Completed && rNum === 3;
              const isCompleted = isR1Done || isR2Done || isR3Done;

              let earnedScore = 0;
              let isQualified = false;
              let minRequired = 0;
              let canAccess = false;

              const maxRoundMarks = round.maxScore || (rNum === 1 ? 30 : rNum === 2 ? 300 : 30);
              const defaultMinReq = Math.ceil(maxRoundMarks * ((round.qualifyingPercentage || 60) / 100));

              if (rNum === 1) {
                earnedScore = user?.r1Score || 0;
                isQualified = user?.isQualifiedR1 || false;
                minRequired = user?.r1MinScore || defaultMinReq;
                canAccess = user ? (user.canAccessR1 ?? true) : round.isOpen;
              } else if (rNum === 2) {
                earnedScore = user?.r2Score || 0;
                isQualified = user?.isQualifiedR2 || false;
                minRequired = user?.r2MinScore || defaultMinReq;
                canAccess = user ? (user.canAccessR2 ?? false) : false;
              } else if (rNum === 3) {
                earnedScore = user?.r3Score || 0;
                isQualified = user?.isQualifiedR3 || false;
                minRequired = user?.r3MinScore || defaultMinReq;
                canAccess = user ? (user.canAccessR3 ?? false) : false;
              }

              const hasRetake = user?.retakesAllowed?.[`r${rNum}`] || false;
              const hasOverride = user?.roundOverrides?.[`r${rNum}`] || false;
              const isLocked = !canAccess && !isCompleted;

              const roundTierLabel =
                rNum === 1 ? 'EASY · MODERATE · HARD' : rNum === 2 ? 'SET A · B · C' : 'EASY · MODERATE · HARD';
              const marksPerQ = rNum === 1 ? '1 Mark / Q' : rNum === 2 ? '5 / 10 / 15 Marks' : '5 / 10 / 15 Marks';

              return (
                <div
                  key={round.id}
                  className={`bg-white border rounded-3xl p-6 flex flex-col justify-between transition-all shadow-sm ${
                    !isLocked && round.isOpen
                      ? 'border-[#E5E0D8] hover:border-[#111808]'
                      : 'border-[#E5E0D8]/60 bg-[#FAFAF7]/70'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Top-of-Card Easy, Moderate, Hard Option Buttons for Round 1, Round 2, and Round 3 */}
                    {(rNum === 1 || rNum === 2 || rNum === 3) && (
                      <div className="p-2.5 rounded-2xl bg-[#FAFAF7] border border-[#E5E0D8] space-y-2">
                        <div className="flex items-center justify-between text-[10px] font-mono text-[#656858]">
                          <span className="font-bold uppercase text-[#111808]">Choose Question Difficulty:</span>
                          <span>Jumbled Order</span>
                        </div>
                        <div className="grid grid-cols-4 gap-1.5">
                          {(['easy', 'moderate', 'hard', 'all'] as const).map((tier) => {
                            const selectedTier = cardDifficultyChoice[rNum] || 'all';
                            const isSelected = selectedTier === tier;
                            const label =
                              tier === 'easy'
                                ? 'Easy'
                                : tier === 'moderate'
                                ? 'Moderate'
                                : tier === 'hard'
                                ? 'Hard'
                                : 'All';
                            return (
                              <button
                                key={tier}
                                type="button"
                                onClick={() =>
                                  setCardDifficultyChoice((prev) => ({
                                    ...prev,
                                    [rNum]: tier,
                                  }))
                                }
                                className={`py-1.5 px-2 rounded-xl text-[11px] font-mono font-bold transition-all cursor-pointer border ${
                                  isSelected
                                    ? tier === 'easy'
                                      ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                                      : tier === 'moderate'
                                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                                      : tier === 'hard'
                                      ? 'bg-rose-700 text-white border-rose-700 shadow-xs'
                                      : 'bg-[#111808] text-[#FFF0BA] border-[#111808] shadow-xs'
                                    : 'bg-white text-[#111808] border-[#E5E0D8] hover:bg-[#F0EEE6]'
                                }`}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono font-bold text-[#111808] uppercase tracking-wider">
                          ROUND 0{rNum}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FAFAF7] border border-[#E5E0D8] font-bold text-[#656858]">
                          {roundTierLabel}
                        </span>
                      </div>

                      {isCompleted ? (
                        isQualified ? (
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-300 flex items-center gap-1 font-semibold">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Qualified
                          </span>
                        ) : (
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-rose-50 text-rose-800 border border-rose-300 flex items-center gap-1 font-semibold">
                            <X className="w-3 h-3 text-rose-600" /> Did Not Qualify
                          </span>
                        )
                      ) : isLocked ? (
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-[#F0EEE6] text-[#656858] border border-[#E5E0D8] flex items-center gap-1">
                          <Lock className="w-3 h-3" /> Locked
                        </span>
                      ) : (
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-[#FFF0BA] text-[#111808] border border-[#111808]/20 flex items-center gap-1 font-bold">
                          <Unlock className="w-3 h-3" /> Unlocked
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-bold font-heading text-[#111808]">{round.title}</h3>
                    <p className="text-xs text-[#656858] leading-relaxed">{round.description}</p>

                    <div className="flex flex-wrap items-center gap-2.5 text-xs text-[#656858] font-mono pt-1">
                      <span className="flex items-center gap-1 bg-[#F0EEE6] px-2 py-1 rounded-md text-[#111808]">
                        <Clock className="w-3.5 h-3.5" />
                        {round.durationMinutes} Mins
                      </span>
                      <span className="bg-[#F0EEE6] px-2 py-1 rounded-md text-[#111808] font-semibold">
                        {maxRoundMarks} Marks Total ({marksPerQ})
                      </span>
                      <span className="bg-[#F0EEE6] px-2 py-1 rounded-md text-[#656858]">
                        Pass: {round.qualifyingPercentage || 60}% (≥{minRequired} pts)
                      </span>
                    </div>

                    {/* Sequential Lock Guidance */}
                    {isLocked && (
                      <div className="p-3 rounded-2xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 space-y-1">
                        <div className="font-semibold flex items-center gap-1.5 text-[11px]">
                          <Lock className="w-3.5 h-3.5 text-amber-700" />
                          Prerequisite Not Yet Met
                        </div>
                        <p className="text-[11px] text-amber-800 leading-normal">
                          {rNum === 2
                            ? `Qualify Round 1 with ≥${rounds.find((r) => r.roundNumber === 1)?.qualifyingPercentage || 60}% (at least ${user?.r1MinScore || 18} of ${rounds.find((r) => r.roundNumber === 1)?.maxScore || 30} marks) to unlock.`
                            : `Qualify Round 2 with ≥${rounds.find((r) => r.roundNumber === 2)?.qualifyingPercentage || 60}% (at least ${user?.r2MinScore || 180} of ${rounds.find((r) => r.roundNumber === 2)?.maxScore || 300} marks) to unlock.`}
                        </p>
                      </div>
                    )}

                    {hasOverride && !isCompleted && (
                      <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-200 text-[11px] font-mono text-purple-900 flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-purple-700" />
                        Admin Override: Round manually unlocked
                      </div>
                    )}

                    {hasRetake && isCompleted && (
                      <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-[11px] font-mono text-blue-900 flex items-center gap-1.5">
                        <RefreshCw className="w-3.5 h-3.5 text-blue-700 animate-spin" />
                        Admin Retake Authorized: Ready for new attempt
                      </div>
                    )}

                    {isCompleted && (
                      <div className="p-3.5 rounded-2xl bg-[#FAFAF7] border border-[#E5E0D8] text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[#656858] text-[11px]">Recorded Score:</span>
                          <span className="text-base font-bold font-mono text-[#111808] tabular-nums">
                            {earnedScore} / {maxRoundMarks} Marks
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] font-mono pt-1 border-t border-[#E5E0D8]/60">
                          <span className="text-[#656858]">Status:</span>
                          <span className={`font-bold ${isQualified ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {isQualified ? 'QUALIFIED FOR NEXT STAGE' : 'DID NOT MEET QUALIFICATION THRESHOLD'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="pt-5 mt-4 border-t border-[#E5E0D8]">
                    <button
                      type="button"
                      disabled={loadingRound || user?.isBlocked || (!canAccess && !hasRetake)}
                      onClick={() => handleStartAttempt(rNum, cardDifficultyChoice[rNum] || 'all')}
                      className={`w-full py-3 rounded-xl font-bold text-xs tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        (canAccess || hasRetake) && !user?.isBlocked && round.isOpen
                          ? 'bg-[#111808] hover:bg-[#1f2b0f] text-[#FFF0BA] shadow-sm'
                          : 'bg-[#F0EEE6] text-[#8C9080] cursor-not-allowed'
                      }`}
                    >
                      {loadingRound ? (
                        <span>Booting Round...</span>
                      ) : isCompleted && hasRetake ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Start Authorized Retake</span>
                        </>
                      ) : isCompleted ? (
                        <>
                          <Award className="w-3.5 h-3.5" />
                          <span>Completed ({earnedScore}/{maxRoundMarks})</span>
                        </>
                      ) : isLocked ? (
                        <>
                          <Lock className="w-3.5 h-3.5" />
                          <span>Round Locked</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>
                            Start Round 0{rNum}
                            {cardDifficultyChoice[rNum] && cardDifficultyChoice[rNum] !== 'all'
                              ? ` (${cardDifficultyChoice[rNum].toUpperCase()})`
                              : ''}
                          </span>
                        </>
                      )}
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
      {showConfirmSubmit && attempt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-white border border-[#E5E0D8] rounded-3xl p-6 sm:p-7 shadow-2xl space-y-4 text-[#111808]">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E0D8]">
              <div>
                <span className="text-[10px] font-mono uppercase text-[#656858] tracking-wider font-bold">
                  ROUND 0{attempt.roundNumber} FINALIZATION
                </span>
                <h3 className="text-lg font-bold font-heading text-[#111808]">Submit Round Assessment?</h3>
              </div>
              <button
                onClick={() => setShowConfirmSubmit(false)}
                className="p-1 rounded-lg hover:bg-[#F0EEE6] text-[#656858] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Assessment summary metrics */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-2xl bg-[#FAFAF7] border border-[#E5E0D8] text-center">
                <span className="text-[10px] text-[#656858] block font-mono uppercase">Total Questions</span>
                <span className="text-lg font-bold font-mono text-[#111808]">{attempt.questions.length}</span>
              </div>
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
                <span className="text-[10px] text-emerald-800 block font-mono uppercase">Answered</span>
                <span className="text-lg font-bold font-mono text-emerald-900">
                  {attempt.questions.filter((q) => isQuestionAnswered(q)).length}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-center">
                <span className="text-[10px] text-amber-800 block font-mono uppercase">Unanswered</span>
                <span className="text-lg font-bold font-mono text-amber-900">
                  {Math.max(0, attempt.questions.length - attempt.questions.filter((q) => isQuestionAnswered(q)).length)}
                </span>
              </div>
            </div>

            {/* Warnings */}
            {Object.values(markedForReview).filter(Boolean).length > 0 && (
              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                <Bookmark className="w-4 h-4 text-amber-700 shrink-0 mt-0.5 fill-current" />
                <span>
                  You have <strong className="font-mono">{Object.values(markedForReview).filter(Boolean).length}</strong> question{Object.values(markedForReview).filter(Boolean).length > 1 ? 's' : ''} still marked for review.
                </span>
              </div>
            )}

            {attempt.questions.length - attempt.questions.filter((q) => isQuestionAnswered(q)).length > 0 && (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
                <span>
                  Warning: <strong className="font-mono">{attempt.questions.length - attempt.questions.filter((q) => isQuestionAnswered(q)).length}</strong> question{attempt.questions.length - attempt.questions.filter((q) => isQuestionAnswered(q)).length > 1 ? 's' : ''} remain unanswered. Unanswered questions receive 0 marks.
                </span>
              </div>
            )}

            <p className="text-xs text-[#656858] leading-relaxed">
              Once submitted, your answers will be permanently evaluated server-side. Your score will be displayed immediately, and qualification for the subsequent round will be decided automatically based on the 60% threshold.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E5E0D8]">
              <button
                type="button"
                onClick={() => setShowConfirmSubmit(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-[#656858] hover:text-[#111808] bg-[#F0EEE6] cursor-pointer"
              >
                Return to Assessment
              </button>
              <button
                type="button"
                disabled={submittingAttempt}
                onClick={confirmSubmitAttempt}
                className="px-6 py-2.5 rounded-xl text-xs font-bold font-mono tracking-wider bg-[#111808] hover:bg-[#1f2b0f] text-[#FFF0BA] shadow-md cursor-pointer disabled:opacity-50"
              >
                {submittingAttempt ? 'Evaluating Score...' : 'Confirm Final Submission'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
