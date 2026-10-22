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
  violations?: number;
  maxViolations?: number;
}

export interface RoundInfo {
  id: number;
  roundNumber: number;
  title: string;
  description: string;
  durationMinutes: number;
  maxViolations: number;
  isOpen: boolean;
  isPublished: boolean;
  orderIndex: number;
}

export interface QuestionData {
  id: number;
  prompt: string;
  type: 'mcq' | 'code';
  options?: string[];
  codeStarter?: string;
  points: number;
  orderIndex: number;
  category: string;
}

export interface AttemptSession {
  attemptId: number;
  status: 'in_progress' | 'submitted' | 'timed_out' | 'disqualified' | 'terminated';
  serverDeadline: string;
  remainingSeconds: number;
  durationMinutes: number;
  violationsCount: number;
  maxViolations: number;
  questions: QuestionData[];
  savedAnswers: Record<number, { selectedOption?: number; submittedCode?: string }>;
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
