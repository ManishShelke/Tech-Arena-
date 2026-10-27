export interface UserProfile {
  id: number;
  uid: string;
  email: string;
  role: 'participant' | 'admin';
  name: string;
  college: string;
  teamName: string;
  teamMembers: string[];
  code: string;
  zone: string;
  isBlocked: boolean;
  blockReason?: string | null;
  score?: number;
  totalScore?: number;
  difficulty?: 'Easy' | 'Intermediate' | 'Hard';
  r1Score?: number;
  r2Score?: number;
  r3Score?: number;
  r1Completed?: boolean;
  r2Completed?: boolean;
  r3Completed?: boolean;
  isQualifiedR1?: boolean;
  isQualifiedR2?: boolean;
  isQualifiedR3?: boolean;
  canAccessR1?: boolean;
  canAccessR2?: boolean;
  canAccessR3?: boolean;
  r1MinScore?: number;
  r2MinScore?: number;
  r3MinScore?: number;
  roundOverrides?: Record<string, boolean>;
  retakesAllowed?: Record<string, boolean>;
  violations?: number;
  isRemoved?: boolean;
  removalReason?: string | null;
  competitionStatus?: string;
  currentAttemptId?: number | null;
}

export interface RoundInfo {
  id: number;
  roundNumber: number;
  title: string;
  description: string;
  durationMinutes: number;
  qualifyingPercentage: number;
  maxScore: number;
  maxViolations: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  isOpen: boolean;
  isPublished: boolean;
  orderIndex: number;
}

export interface QuestionData {
  id: number;
  code?: string;
  prompt: string;
  type: 'mcq' | 'qa' | 'code';
  options?: string[];
  correctOption?: number;
  explanation?: string;
  codeStarter?: string;
  points: number;
  orderIndex: number;
  category: string;
  isActive?: boolean;
}

export interface TabSwitchIncident {
  id: number;
  attemptId: number;
  userId: number;
  roundId: number;
  violationType: string;
  details: string;
  serverTimestamp: string;
}

export interface AttemptSession {
  attemptId: number;
  status:
    | 'not_started'
    | 'in_progress'
    | 'tab_switch_detected'
    | 'suspended_awaiting_approval'
    | 'resumed'
    | 'completed'
    | 'submitted'
    | 'timed_out'
    | 'disqualified'
    | 'terminated'
    | 'removed';
  serverDeadline: string;
  remainingSeconds: number;
  durationMinutes: number;
  roundId?: number;
  roundNumber?: number;
  violationsCount: number;
  maxViolations: number;
  questions: QuestionData[];
  savedAnswers: Record<number, { selectedOption?: number; submittedCode?: string }>;
  isSuspended?: boolean;
  pausedAt?: string | null;
  totalPausedSeconds?: number;
  resumedAt?: string | null;
  suspensionReason?: string | null;
  adminDecision?: string | null;
  adminDecisionNotes?: string | null;
  incidents?: TabSwitchIncident[];
}

export interface LeaderboardEntry {
  id: number;
  rank: number;
  code: string;
  name: string;
  college: string;
  teamName: string;
  teamMembers: string[];
  zone: string;
  isBlocked: boolean;
  r1Score: number;
  r2Score: number;
  r3Score: number;
  totalScore: number;
  totalTimeSeconds: number;
}

export interface CollegeStanding {
  rank: number;
  institution: string;
  zone: string;
  avgPts: number;
  activeCount: number;
}

export interface AdminMetrics {
  totalParticipants: number;
  activeAttempts: number;
  completedAttempts: number;
  totalAttempts: number;
  blockedCount: number;
  pendingAppeals: number;
  avgScore: number;
  violationsByRound: Record<number, number>;
}
