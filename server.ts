// server.ts
import express, { Request, Response } from 'express';
import * as dotenv from 'dotenv';
dotenv.config();

import { db } from './src/db/index.ts';
import {
  users,
  events,
  rounds,
  questions,
  quizAttempts,
  participantAnswers,
  securityViolations,
  disqualificationReviews,
  auditLogs,
  adminSessions,
  participantSessions,
  activityEvents,
  competitionSettings,
} from './src/db/schema.ts';
import { eq, and } from 'drizzle-orm';
import { requireAuth, requireAdmin, AuthRequest } from './src/middleware/auth.ts';
import { seedTournamentDatabase, syncRound2Questions } from './src/db/seed.ts';
import { adminRouter } from './src/routes/admin.ts';
import { signParticipantToken } from './src/utils/cryptoAuth.ts';

export const app = express();
// The AI Studio dev server and Cloud Run reverse proxy requires the backend to listen on port 3000
const PORT = 3000;

app.use(express.json());

// Normalize request URLs if a serverless rewrite stripped the /api prefix
app.use((req: Request, _res: Response, next) => {
  if (
    !req.url.startsWith('/api') &&
    (req.url.startsWith('/auth/') ||
      req.url.startsWith('/admin/') ||
      req.url.startsWith('/rounds') ||
      req.url.startsWith('/attempts') ||
      req.url.startsWith('/leaderboard') ||
      req.url.startsWith('/participants/') ||
      req.url.startsWith('/events/') ||
      req.url.startsWith('/appeals') ||
      req.url.startsWith('/competition/') ||
      req.url.startsWith('/health'))
  ) {
    req.url = `/api${req.url}`;
  }
  next();
});

let seedPromise: Promise<void> | null = null;
export function ensureDatabaseSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = seedTournamentDatabase()
      .then(() => syncRound2Questions())
      .catch((err) => {
        console.error('Error during initial database seed check:', err);
      });
  }
  return seedPromise;
}

// Ensure database is seeded before handling API requests (supports Vercel serverless cold starts)
app.use('/api', async (_req: Request, _res: Response, next) => {
  await ensureDatabaseSeeded();
  next();
});

// Mount Admin Management & Telemetry API Router
app.use('/api', adminRouter);

// Trigger initial seed check on startup
ensureDatabaseSeeded();

// ==========================================
// 1. PUBLIC API ROUTES
// ==========================================

// Server Health & Time Sync
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'online',
    serverTime: new Date().toISOString(),
    epoch: Date.now(),
  });
});

// Participant Registration & Login (Team Node Creation)
app.post('/api/auth/register-team', async (req: Request, res: Response) => {
  try {
    const { teamName, college, teamMembers, zone } = req.body;

    if (!teamName || !college || !Array.isArray(teamMembers) || teamMembers.length === 0) {
      return res.status(400).json({
        error: 'Missing required registration parameters: teamName, college, and teamMembers.',
      });
    }

    const cleanTeam = String(teamName).trim();
    const cleanCollege = String(college).trim();
    const cleanMembers = teamMembers.map((m: any) => String(m).trim()).filter(Boolean);
    const cleanZone = zone || 'South Zone';

    // Check if team name already exists
    let user = await db.query.users.findFirst({
      where: eq(users.teamName, cleanTeam),
    });

    if (!user) {
      const code = `#TA-${Math.floor(1000 + Math.random() * 9000)}`;
      const uid = `team_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const [newUser] = await db
        .insert(users)
        .values({
          uid,
          email: `${cleanTeam.toLowerCase().replace(/\s+/g, '_')}@techarena.edu`,
          role: 'participant',
          name: cleanMembers[0] || cleanTeam,
          college: cleanCollege,
          teamName: cleanTeam,
          teamMembers: cleanMembers,
          code,
          zone: cleanZone,
        })
        .returning();

      user = newUser;

      // Log audit
      await db.insert(auditLogs).values({
        userId: user.id,
        action: 'REGISTER_TEAM',
        targetType: 'users',
        targetId: String(user.id),
        metadata: { teamName: cleanTeam, college: cleanCollege, code },
      });
    }

    if (user.isRemoved) {
      return res.status(403).json({
        error: 'Terminal access revoked: This team has been removed from the tournament roster by an administrator.',
      });
    }

    // Ensure active participant session
    const existingSession = await db.query.participantSessions.findFirst({
      where: eq(participantSessions.userId, user.id),
    });

    const now = new Date();
    if (existingSession) {
      await db
        .update(participantSessions)
        .set({
          status: 'online',
          lastHeartbeat: now,
          lastActivity: now,
          ipAddress: req.ip,
        })
        .where(eq(participantSessions.id, existingSession.id));
    } else {
      await db.insert(participantSessions).values({
        userId: user.id,
        status: 'online',
        currentDifficulty: 'easy',
        lastHeartbeat: now,
        lastActivity: now,
        ipAddress: req.ip,
      });
    }

    // Record login activity event
    await db.insert(activityEvents).values({
      userId: user.id,
      eventType: 'LOGIN',
      details: `Team node registered / connected: ${user.teamName} (${user.code})`,
      severity: 'info',
    });

    const token = signParticipantToken(user.id, user.code);

    res.json({
      token,
      user: {
        id: user.id,
        uid: user.uid,
        email: user.email,
        role: user.role,
        name: user.name,
        college: user.college,
        teamName: user.teamName,
        teamMembers: user.teamMembers,
        code: user.code,
        zone: user.zone,
        isBlocked: user.isBlocked,
        blockReason: user.blockReason,
      },
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to register team terminal.' });
  }
});

// Participant Periodic Heartbeat (Every 10 seconds)
app.post('/api/participants/heartbeat', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { currentDifficulty, difficulty, currentChallengeId } = req.body || {};
    const resolvedDifficulty = currentDifficulty || difficulty;
    const now = new Date();

    const session = await db.query.participantSessions.findFirst({
      where: eq(participantSessions.userId, user.id),
    });

    if (session) {
      await db
        .update(participantSessions)
        .set({
          status: 'online',
          lastHeartbeat: now,
          lastActivity: now,
          currentDifficulty: resolvedDifficulty || session.currentDifficulty,
          currentChallengeId: currentChallengeId || session.currentChallengeId,
          ipAddress: req.ip,
        })
        .where(eq(participantSessions.id, session.id));
    } else {
      await db.insert(participantSessions).values({
        userId: user.id,
        status: 'online',
        currentDifficulty: resolvedDifficulty || 'easy',
        currentChallengeId,
        lastHeartbeat: now,
        lastActivity: now,
        ipAddress: req.ip,
      });
    }

    res.json({ success: true, timestamp: now.toISOString() });
  } catch (error: any) {
    console.error('Heartbeat error:', error);
    res.status(500).json({ error: 'Failed to record session heartbeat.' });
  }
});

// Participant Explicit Logout
app.post('/api/auth/logout', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const session = await db.query.participantSessions.findFirst({
      where: eq(participantSessions.userId, user.id),
    });

    if (session) {
      await db
        .update(participantSessions)
        .set({
          status: 'logged_out',
          lastActivity: new Date(),
        })
        .where(eq(participantSessions.id, session.id));
    }

    await db.insert(activityEvents).values({
      userId: user.id,
      eventType: 'LOGOUT',
      details: 'Participant explicitly logged out from terminal.',
      severity: 'info',
    });

    res.json({ success: true, message: 'Terminal logged out.' });
  } catch (error: any) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Failed to log out.' });
  }
});

// Participant General Activity Event Logger
app.post('/api/events/record', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { eventType, details, difficultyLevel, challengeId, severity } = req.body;

    await db.insert(activityEvents).values({
      userId: user.id,
      eventType: String(eventType || 'ACTION'),
      details: String(details || 'General event'),
      difficultyLevel,
      challengeId,
      severity: severity || 'info',
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Record event error:', error);
    res.status(500).json({ error: 'Failed to record event.' });
  }
});

// Participant Re-Login by Team Code
app.post('/api/auth/login-code', async (req: Request, res: Response) => {
  try {
    const { code } = req.body || {};
    const rawCode = String(code || '').trim().toUpperCase();
    if (!rawCode) {
      return res.status(400).json({ error: 'Team code is required.' });
    }

    const normalizedCode = rawCode.startsWith('#') ? rawCode : `#${rawCode}`;
    const user =
      (await db.query.users.findFirst({ where: eq(users.code, normalizedCode) })) ||
      (await db.query.users.findFirst({ where: eq(users.code, rawCode) }));

    if (!user || user.role !== 'participant') {
      return res.status(404).json({ error: 'Team node not found for the provided access code.' });
    }

    if (user.isRemoved) {
      return res.status(403).json({
        error: 'Terminal access revoked: This team has been removed from the tournament roster.',
      });
    }

    const token = signParticipantToken(user.id, user.code);
    res.json({ token, user });
  } catch (error: any) {
    console.error('Login by code error:', error);
    res.status(500).json({ error: 'Failed to authenticate team code.' });
  }
});

// ==========================================
// 2. AUTHENTICATED PARTICIPANT ROUTES
// ==========================================

// Get Current User Profile & Round Progression Status
// Helper to shuffle array elements (Fisher-Yates)
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Get Current User Profile & Round Progression Status with Sequential Qualification
app.get('/api/auth/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, user.id),
    });

    if (!dbUser) {
      return res.status(404).json({ error: 'User record not found.' });
    }

    // Fetch user's attempts across rounds
    const attempts = await db.query.quizAttempts.findMany({
      where: eq(quizAttempts.userId, dbUser.id),
      with: {
        round: true,
      },
      orderBy: (quizAttempts, { desc }) => [desc(quizAttempts.id)],
    });

    const allRounds = await db.query.rounds.findMany({
      orderBy: (rounds, { asc }) => [asc(rounds.roundNumber)],
    });

    const roundMap: Record<number, any> = {};
    allRounds.forEach((r) => {
      roundMap[r.roundNumber] = r;
    });

    let r1Score = 0;
    let r2Score = 0;
    let r3Score = 0;
    let r1Completed = false;
    let r2Completed = false;
    let r3Completed = false;
    let isQualifiedR1 = false;
    let isQualifiedR2 = false;
    let isQualifiedR3 = false;
    let violations = 0;

    const r1Min = roundMap[1] ? Math.ceil((roundMap[1].maxScore || 30) * ((roundMap[1].qualifyingPercentage || 60) / 100)) : 18;
    const r2Min = roundMap[2] ? Math.ceil((roundMap[2].maxScore || 300) * ((roundMap[2].qualifyingPercentage || 60) / 100)) : 180;
    const r3Min = roundMap[3] ? Math.ceil((roundMap[3].maxScore || 30) * ((roundMap[3].qualifyingPercentage || 60) / 100)) : 18;

    for (const att of attempts) {
      violations += att.violationsCount || 0;
      if (att.round?.roundNumber === 1 && !r1Completed) {
        r1Score = att.score;
        r1Completed = att.status === 'submitted' || att.status === 'timed_out';
        isQualifiedR1 = att.isQualified || att.score >= r1Min;
      } else if (att.round?.roundNumber === 2 && !r2Completed) {
        r2Score = att.score;
        r2Completed = att.status === 'submitted' || att.status === 'timed_out';
        isQualifiedR2 = att.isQualified || att.score >= r2Min;
      } else if (att.round?.roundNumber === 3 && !r3Completed) {
        r3Score = att.score;
        r3Completed = att.status === 'submitted' || att.status === 'timed_out';
        isQualifiedR3 = att.isQualified || att.score >= r3Min;
      }
    }

    const roundOverrides = (dbUser.roundOverrides || {}) as Record<string, boolean>;
    const retakesAllowed = (dbUser.retakesAllowed || {}) as Record<string, boolean>;

    const canAccessR1 = !dbUser.isBlocked && !dbUser.isRemoved;
    const canAccessR2 = canAccessR1 && Boolean(roundOverrides['2'] || (r1Completed && isQualifiedR1));
    const canAccessR3 = canAccessR1 && Boolean(roundOverrides['3'] || (r2Completed && isQualifiedR2));

    res.json({
      user: {
        ...dbUser,
        r1Score,
        r2Score,
        r3Score,
        r1Completed,
        r2Completed,
        r3Completed,
        isQualifiedR1,
        isQualifiedR2,
        isQualifiedR3,
        canAccessR1,
        canAccessR2,
        canAccessR3,
        r1MinScore: r1Min,
        r2MinScore: r2Min,
        r3MinScore: r3Min,
        roundOverrides,
        retakesAllowed,
        violations,
        maxViolations: 2,
      },
    });
  } catch (error: any) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to retrieve participant profile.' });
  }
});

// Get Competition Rounds with Durations and Qualifying Percentages
app.get('/api/rounds', async (_req: Request, res: Response) => {
  try {
    const allRounds = await db.query.rounds.findMany({
      where: eq(rounds.isPublished, true),
      orderBy: (rounds, { asc }) => [asc(rounds.roundNumber)],
    });
    res.json(allRounds);
  } catch (error: any) {
    console.error('Fetch rounds error:', error);
    res.status(500).json({ error: 'Failed to retrieve competition rounds.' });
  }
});

// Start a Quiz Attempt (Enforces Sequential Qualification, Random Shuffling & Authoritative Timer)
app.post('/api/attempts/start', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { roundNumber } = req.body;
    const rNum = parseInt(roundNumber, 10);

    if (isNaN(rNum) || rNum < 1 || rNum > 3) {
      return res.status(400).json({ error: 'Invalid round number.' });
    }

    // Check if participant is blocked or removed
    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, user.id),
    });

    if (dbUser?.isRemoved) {
      return res.status(403).json({
        error: 'Terminal access revoked: Participant has been removed from the tournament roster by an administrator.',
        isRemoved: true,
      });
    }

    if (dbUser?.isBlocked) {
      return res.status(403).json({
        error: 'Questions blocked: Your terminal is restricted due to a rule violation.',
        isBlocked: true,
      });
    }

    // Get target round
    const round = await db.query.rounds.findFirst({
      where: eq(rounds.roundNumber, rNum),
    });

    if (!round || !round.isOpen) {
      return res.status(400).json({ error: 'Round is currently closed.' });
    }

    // ==========================================
    // SEQUENTIAL QUALIFICATION ENFORCEMENT
    // ==========================================
    const roundOverrides = (dbUser?.roundOverrides || {}) as Record<string, boolean>;

    if (rNum === 2 && !roundOverrides['2']) {
      const r1 = await db.query.rounds.findFirst({ where: eq(rounds.roundNumber, 1) });
      const r1MinScore = r1 ? Math.ceil((r1.maxScore || 30) * ((r1.qualifyingPercentage || 60) / 100)) : 18;
      const r1Attempt = await db.query.quizAttempts.findFirst({
        where: and(eq(quizAttempts.userId, user.id), eq(quizAttempts.roundId, r1?.id || 1)),
        orderBy: (quizAttempts, { desc }) => [desc(quizAttempts.id)],
      });

      const isR1Done = r1Attempt && (r1Attempt.status === 'submitted' || r1Attempt.status === 'timed_out');
      const isR1Qualified = isR1Done && (r1Attempt.isQualified || r1Attempt.score >= r1MinScore);

      if (!isR1Qualified) {
        return res.status(403).json({
          error: `Round 2 is locked. Qualification required: You must achieve at least ${r1?.qualifyingPercentage || 60}% (${r1MinScore} marks) in Round 1 to unlock Round 2.`,
          locked: true,
          requiredRound: 1,
          qualifyingScore: r1MinScore,
        });
      }
    } else if (rNum === 3 && !roundOverrides['3']) {
      const r2 = await db.query.rounds.findFirst({ where: eq(rounds.roundNumber, 2) });
      const r2MinScore = r2 ? Math.ceil((r2.maxScore || 300) * ((r2.qualifyingPercentage || 60) / 100)) : 180;
      const r2Attempt = await db.query.quizAttempts.findFirst({
        where: and(eq(quizAttempts.userId, user.id), eq(quizAttempts.roundId, r2?.id || 2)),
        orderBy: (quizAttempts, { desc }) => [desc(quizAttempts.id)],
      });

      const isR2Done = r2Attempt && (r2Attempt.status === 'submitted' || r2Attempt.status === 'timed_out');
      const isR2Qualified = isR2Done && (r2Attempt.isQualified || r2Attempt.score >= r2MinScore);

      if (!isR2Qualified) {
        return res.status(403).json({
          error: `Round 3 is locked. Qualification required: You must achieve at least ${r2?.qualifyingPercentage || 60}% (${r2MinScore} marks) in Round 2 to unlock Round 3.`,
          locked: true,
          requiredRound: 2,
          qualifyingScore: r2MinScore,
        });
      }
    }

    // Check for existing attempt (fetch latest attempt for this round)
    let attempt = await db.query.quizAttempts.findFirst({
      where: and(eq(quizAttempts.userId, user.id), eq(quizAttempts.roundId, round.id)),
      orderBy: (quizAttempts, { desc }) => [desc(quizAttempts.id)],
    });

    const now = new Date();

    // Check if attempt already submitted
    if (attempt && (attempt.status === 'submitted' || attempt.status === 'timed_out' || attempt.status === 'completed')) {
      const retakesAllowed = (dbUser?.retakesAllowed || {}) as Record<string, boolean>;
      if (!retakesAllowed[String(rNum)]) {
        return res.status(400).json({
          error: `Round ${rNum} has already been completed and submitted. Multiple attempts require explicit administrator authorization.`,
          alreadySubmitted: true,
          score: attempt.score,
        });
      }
      // Consume the retake authorization
      delete retakesAllowed[String(rNum)];
      await db.update(users).set({ retakesAllowed }).where(eq(users.id, user.id));
      attempt = null; // Create fresh attempt below
    }

    // If attempt does not exist or was finalized as 'removed', create a fresh attempt with full timer & randomized question/option order
    if (!attempt || attempt.status === 'removed') {
      const serverDeadline = new Date(now.getTime() + round.durationMinutes * 60 * 1000);

      // Fetch all active questions for this round
      const rawQs = await db.query.questions.findMany({
        where: and(eq(questions.roundId, round.id), eq(questions.isActive, true)),
        orderBy: (questions, { asc }) => [asc(questions.orderIndex), asc(questions.id)],
      });

      // Shuffle question presentation order
      const shuffledQuestionsList = shuffleArray(rawQs);

      // Map shuffled option ordering per question
      const shuffledMapping = shuffledQuestionsList.map((q: any) => {
        const originalOpts = (q.options || []) as string[];
        const optionIndices = shuffleArray([0, 1, 2, 3].slice(0, originalOpts.length));
        return {
          questionId: q.id,
          optionIndices,
        };
      });

      const [newAttempt] = await db
        .insert(quizAttempts)
        .values({
          userId: user.id,
          roundId: round.id,
          status: 'in_progress',
          startTime: now,
          serverDeadline,
          score: 0,
          totalQuestions: rawQs.length,
          answersCount: 0,
          violationsCount: 0,
          totalPausedSeconds: 0,
          shuffledQuestions: shuffledMapping,
        })
        .returning();

      attempt = newAttempt;

      await db.insert(auditLogs).values({
        userId: user.id,
        action: 'START_ATTEMPT',
        targetType: 'quiz_attempts',
        targetId: String(attempt.id),
        metadata: { roundNumber: rNum, serverDeadline },
      });
    }

    // Calculate authoritative remaining time
    let remainingMs = 0;
    if (attempt.status === 'suspended_awaiting_approval') {
      const pauseTime = attempt.pausedAt ? new Date(attempt.pausedAt).getTime() : now.getTime();
      remainingMs = new Date(attempt.serverDeadline).getTime() - pauseTime;
    } else if (attempt.status === 'in_progress' || attempt.status === 'resumed') {
      remainingMs = new Date(attempt.serverDeadline).getTime() - now.getTime();
      if (remainingMs <= 0) {
        await db
          .update(quizAttempts)
          .set({ status: 'timed_out', endTime: now })
          .where(eq(quizAttempts.id, attempt.id));
        attempt.status = 'timed_out';
      }
    }

    // Reconstruct shuffled questions according to the attempt's persisted mapping
    const rawQuestions = await db.query.questions.findMany({
      where: and(eq(questions.roundId, round.id), eq(questions.isActive, true)),
    });
    const questionMap = new Map<number, any>();
    rawQuestions.forEach((q) => questionMap.set(q.id, q));

    let mappingList = (attempt.shuffledQuestions || []) as Array<{ questionId: number; optionIndices: number[] }>;
    // Remove any deactivated questions from the persisted mapping
    const originalMappingLength = mappingList.length;
    mappingList = mappingList.filter((m) => questionMap.has(m.questionId));
    let orderedQuestions: any[] = [];

    // Ensure any newly seeded active questions for this round are also jumbled and included
    const mappedIds = new Set(mappingList.map((m) => m.questionId));
    const missingQs = rawQuestions.filter((q) => !mappedIds.has(q.id));
    if (missingQs.length > 0 || mappingList.length !== originalMappingLength) {
      const extraMapped = shuffleArray(missingQs).map((q: any) => {
        const originalOpts = (q.options || []) as string[];
        const optionIndices = shuffleArray([0, 1, 2, 3].slice(0, originalOpts.length));
        return {
          questionId: q.id,
          optionIndices,
        };
      });
      mappingList = shuffleArray([...mappingList, ...extraMapped]);
      await db
        .update(quizAttempts)
        .set({
          shuffledQuestions: mappingList,
          totalQuestions: mappingList.length,
        })
        .where(eq(quizAttempts.id, attempt.id));
    }

    if (mappingList && mappingList.length > 0) {
      mappingList.forEach((m) => {
        const q = questionMap.get(m.questionId);
        if (q) {
          const isQa = q.type === 'qa' || (round.roundNumber === 2 && q.type !== 'code');
          const originalOpts = (q.options || []) as string[];
          const shuffledOpts = isQa ? [] : m.optionIndices.map((idx) => originalOpts[idx]);
          orderedQuestions.push({
            id: q.id,
            code: q.code,
            prompt: q.prompt,
            type: isQa ? 'qa' : q.type,
            options: shuffledOpts,
            codeStarter: q.codeStarter,
            points: q.points,
            orderIndex: q.orderIndex,
            category: q.category,
          });
        }
      });
    } else {
      orderedQuestions = shuffleArray(rawQuestions).map((q: any) => {
        const isQa = q.type === 'qa' || (round.roundNumber === 2 && q.type !== 'code');
        return {
          id: q.id,
          code: q.code,
          prompt: q.prompt,
          type: isQa ? 'qa' : q.type,
          options: isQa ? [] : q.options,
          codeStarter: q.codeStarter,
          points: q.points,
          orderIndex: q.orderIndex,
          category: q.category,
        };
      });
    }

    // Fetch previously saved answers for this attempt
    const savedAnswers = await db.query.participantAnswers.findMany({
      where: eq(participantAnswers.attemptId, attempt.id),
    });

    const answersMap: Record<number, { selectedOption?: number; submittedCode?: string }> = {};
    savedAnswers.forEach((ans) => {
      answersMap[ans.questionId] = {
        selectedOption: ans.selectedOption ?? undefined,
        submittedCode: ans.submittedCode ?? undefined,
      };
    });

    res.json({
      attemptId: attempt.id,
      roundId: round.id,
      roundNumber: round.roundNumber,
      status: attempt.status,
      serverDeadline: attempt.serverDeadline,
      remainingSeconds: Math.max(0, Math.floor(remainingMs / 1000)),
      durationMinutes: round.durationMinutes,
      qualifyingPercentage: round.qualifyingPercentage,
      maxScore: round.maxScore,
      violationsCount: attempt.violationsCount,
      maxViolations: round.maxViolations,
      isSuspended: attempt.status === 'suspended_awaiting_approval',
      pausedAt: attempt.pausedAt,
      resumedAt: attempt.resumedAt,
      questions: orderedQuestions,
      savedAnswers: answersMap,
    });
  } catch (error: any) {
    console.error('Start attempt error:', error);
    res.status(500).json({ error: 'Failed to initialize quiz attempt.' });
  }
});

// Sync Timer & Telemetry (Periodic server sync to prevent client-side timer manipulation)
app.get('/api/attempts/:id/sync', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const attemptId = parseInt(req.params.id as string, 10);
    const user = req.user!;

    const attempt = await db.query.quizAttempts.findFirst({
      where: and(eq(quizAttempts.id, attemptId), eq(quizAttempts.userId, user.id)),
    });

    if (!attempt) {
      return res.status(404).json({ error: 'Attempt not found.' });
    }

    const now = new Date();
    let remainingMs = 0;

    if (attempt.status === 'suspended_awaiting_approval') {
      // Freeze timer during suspension at pausedAt timestamp
      const pauseTime = attempt.pausedAt ? new Date(attempt.pausedAt).getTime() : now.getTime();
      remainingMs = new Date(attempt.serverDeadline).getTime() - pauseTime;
    } else if (attempt.status === 'in_progress' || attempt.status === 'resumed') {
      remainingMs = new Date(attempt.serverDeadline).getTime() - now.getTime();
      // Auto-timeout if server deadline has expired
      if (remainingMs <= 0) {
        await db
          .update(quizAttempts)
          .set({ status: 'timed_out', endTime: now })
          .where(eq(quizAttempts.id, attempt.id));
        attempt.status = 'timed_out';
      }
    }

    res.json({
      attemptId: attempt.id,
      status: attempt.status,
      remainingSeconds: Math.max(0, Math.floor(remainingMs / 1000)),
      isSuspended: attempt.status === 'suspended_awaiting_approval',
      serverTime: now.toISOString(),
      violationsCount: attempt.violationsCount,
      isDisqualified: attempt.isDisqualified,
      terminationReason: attempt.terminationReason,
      disqualificationReason: attempt.disqualificationReason,
    });
  } catch (error: any) {
    console.error('Sync attempt error:', error);
    res.status(500).json({ error: 'Failed to synchronize attempt timer.' });
  }
});

// Helper to evaluate Round 2 Q&A direct text answers
function evaluateQaTextAnswer(question: any, rawAnswer: string): boolean {
  const userRaw = String(rawAnswer || '').trim();
  if (!userRaw) return false;

  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[.,;!?'"`()[\]{}]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const compact = (s: string) => s.toLowerCase().replace(/\s+/g, '');

  const userNorm = norm(userRaw);
  const userCompact = compact(userRaw);

  const qOpts = Array.isArray(question.options) ? question.options : [];
  const expectedPrimary = String(qOpts[question.correctOption ?? 0] || '').trim();

  if (expectedPrimary) {
    if (userNorm === norm(expectedPrimary) || userCompact === compact(expectedPrimary)) {
      return true;
    }
  }

  // Question-specific flexible matching for official Round 2 Q&A questions (Q1..Q30)
  const code = String(question.code || '').toUpperCase();
  const acceptedByCode: Record<string, string[]> = {
    Q1: ['15'],
    Q2: ['even'],
    Q3: ['22'],
    Q4: ['5', '5 times', 'five', 'five times'],
    Q5: ['3 and 1', '3 1', '3, 1', '3,1'],
    Q6: ['primary key', 'primary'],
    Q7: ['ram', 'random access memory'],
    Q8: ['<a>', 'a', '<a></a>', 'anchor', 'anchor tag', 'a tag', '<a href>'],
    Q9: ['42'],
    Q10: ['10'],
    Q11: ['8'],
    Q12: ['15'],
    Q13: ['10 10', '10, 10', '10,10', '10 and 10'],
    Q14: ['60'],
    Q15: ['3', 'three'],
    Q16: ['search efficiently in a sorted array', 'searching in a sorted array', 'search a sorted array', 'fast search in sorted array'],
    Q17: ['13'],
    Q18: ['missing semicolon', 'semicolon missing', 'a semicolon is missing', ';', 'semicolon', 'missing ;'],
    Q19: ['router'],
    Q20: ['11'],
    Q21: ['5'],
    Q22: ['6'],
    Q23: ['40000', '40,000', '40k'],
    Q24: ['24'],
    Q25: ['(2,7) and (3,6)', '2,7 and 3,6', '(2, 7) and (3, 6)', '2 7 and 3 6', '(2,7), (3,6)'],
    Q26: ['a'],
    Q27: ['2nf', 'second normal form', '2nd normal form'],
    Q28: ['8 ms', '8ms', '8', '8 milliseconds'],
    Q29: ['720'],
    Q30: ['-3'],
  };

  const extras = acceptedByCode[code] || [];
  for (const cand of extras) {
    if (userNorm === norm(cand) || userCompact === compact(cand)) {
      return true;
    }
  }

  // Additional semantic checks for descriptive Round 2 answers
  if (code === 'Q16' && userNorm.includes('search') && userNorm.includes('sort')) {
    return true;
  }
  if (code === 'Q18' && (userNorm.includes('semicolon') || userRaw.includes(';'))) {
    return true;
  }
  if (code === 'Q25' && userRaw.includes('2') && userRaw.includes('7') && userRaw.includes('3') && userRaw.includes('6')) {
    return true;
  }

  return false;
}

// Submit/Save an Answer to a Question (Idempotent server-side evaluation)
app.post('/api/attempts/:id/answer', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const attemptId = parseInt(req.params.id as string, 10);
    const user = req.user!;
    const { questionId, selectedOption, submittedCode, submittedAnswer } = req.body;
    const textSubmission = submittedAnswer !== undefined ? submittedAnswer : submittedCode;

    const attempt = await db.query.quizAttempts.findFirst({
      where: and(eq(quizAttempts.id, attemptId), eq(quizAttempts.userId, user.id)),
    });

    if (!attempt) {
      return res.status(404).json({ error: 'Attempt not found.' });
    }

    if (attempt.status === 'suspended_awaiting_approval') {
      return res.status(403).json({
        error: 'Submission rejected: Task is suspended awaiting Chief Proctor review and authorization.',
        status: attempt.status,
      });
    }

    if (attempt.status !== 'in_progress' && attempt.status !== 'resumed') {
      return res.status(403).json({
        error: `Submission rejected: Assessment attempt is ${attempt.status}.`,
        status: attempt.status,
      });
    }

    // Check if user is blocked, removed, or attempt terminated
    const userCheck = await db.query.users.findFirst({
      where: eq(users.id, user.id),
    });
    if (userCheck?.isRemoved) {
      return res.status(403).json({
        error: 'Submission rejected: Participant has been removed from competition.',
      });
    }
    if (userCheck?.isBlocked || attempt.isDisqualified || attempt.status === 'terminated') {
      return res.status(403).json({
        error: 'Submission rejected: Assessment attempt has been terminated by proctor enforcement.',
      });
    }

    // Check timer expiration
    if (Date.now() > attempt.serverDeadline.getTime()) {
      await db
        .update(quizAttempts)
        .set({ status: 'timed_out', endTime: new Date() })
        .where(eq(quizAttempts.id, attempt.id));
      return res.status(400).json({ error: 'Time expired for this assessment.' });
    }

    // Retrieve secret question answer key from server database
    const question = await db.query.questions.findFirst({
      where: eq(questions.id, parseInt(questionId, 10)),
    });

    if (!question) {
      return res.status(404).json({ error: 'Question not found.' });
    }

    // Retrieve mapping for this question in attempt.shuffledQuestions
    const shuffledList = (attempt.shuffledQuestions || []) as Array<{ questionId: number; optionIndices: number[] }>;
    const qMapping = shuffledList.find((m) => m.questionId === question.id);
    let originalSelectedOption = selectedOption;
    if (qMapping && selectedOption !== undefined && qMapping.optionIndices && qMapping.optionIndices[selectedOption] !== undefined) {
      originalSelectedOption = qMapping.optionIndices[selectedOption];
    }

    // Evaluate answer on the server!
    let isCorrect = false;
    let pointsEarned = 0;

    const isQaQuestion = question.type === 'qa' || (question.roundId === 2 && question.type !== 'code');

    if (isQaQuestion) {
      isCorrect = evaluateQaTextAnswer(question, String(textSubmission || ''));
      pointsEarned = isCorrect ? question.points : 0;
    } else if (question.type === 'mcq') {
      isCorrect = selectedOption !== undefined && originalSelectedOption === question.correctOption;
      pointsEarned = isCorrect ? question.points : 0;
    } else if (question.type === 'code') {
      // Automated code validator: checks that submitted code is non-trivial and differs from starter template
      const codeStr = String(textSubmission || '').trim();
      const starterStr = String(question.codeStarter || '').trim();
      const normalizeCode = (s: string) =>
        s
          .replace(/\/\/.*$/gm, '')
          .replace(/#.*$/gm, '')
          .replace(/\s+/g, '');
      const normSub = normalizeCode(codeStr);
      const normStarter = normalizeCode(starterStr);
      if (codeStr.length >= 15 && normSub !== normStarter && normSub.length > 10) {
        isCorrect = true;
        pointsEarned = question.points;
      }
    }

    // Upsert participant answer
    const existing = await db.query.participantAnswers.findFirst({
      where: and(
        eq(participantAnswers.attemptId, attempt.id),
        eq(participantAnswers.questionId, question.id)
      ),
    });

    if (existing) {
      await db
        .update(participantAnswers)
        .set({
          selectedOption: selectedOption ?? existing.selectedOption,
          submittedCode: textSubmission !== undefined ? textSubmission : existing.submittedCode,
          isCorrect,
          pointsEarned,
          submittedAt: new Date(),
        })
        .where(eq(participantAnswers.id, existing.id));
    } else {
      await db.insert(participantAnswers).values({
        attemptId: attempt.id,
        questionId: question.id,
        selectedOption,
        submittedCode: textSubmission,
        isCorrect,
        pointsEarned,
      });
    }

    // Recalculate total score and answers count for attempt (scaled to round.maxScore if customized by admin)
    const [allAnswers, roundObj, activeRoundQs] = await Promise.all([
      db.query.participantAnswers.findMany({
        where: eq(participantAnswers.attemptId, attempt.id),
      }),
      db.query.rounds.findFirst({
        where: eq(rounds.id, attempt.roundId),
      }),
      db.query.questions.findMany({
        where: and(eq(questions.roundId, attempt.roundId), eq(questions.isActive, true)),
      }),
    ]);

    const rawScore = allAnswers.reduce((sum, a) => sum + (a.isCorrect ? a.pointsEarned : 0), 0);
    const rawMaxPoints = activeRoundQs.reduce((sum, q) => sum + (q.points || 1), 0);
    const configuredMax = roundObj?.maxScore || rawMaxPoints;
    const newScore =
      rawMaxPoints > 0 && configuredMax > 0 && configuredMax !== rawMaxPoints
        ? Math.round((rawScore / rawMaxPoints) * configuredMax)
        : rawScore;

    await db
      .update(quizAttempts)
      .set({
        score: newScore,
        answersCount: allAnswers.length,
      })
      .where(eq(quizAttempts.id, attempt.id));

    res.json({
      success: true,
      questionId: question.id,
      answersCount: allAnswers.length,
    });
  } catch (error: any) {
    console.error('Answer submission error:', error);
    res.status(500).json({ error: 'Failed to record answer.' });
  }
});

// Record Security Violation (Detects window blur, tab switch, fullscreen exits)
app.post(
  '/api/attempts/:id/security-event',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const attemptId = parseInt(req.params.id as string, 10);
      const user = req.user!;
      const { violationType, details } = req.body;

      const attempt = await db.query.quizAttempts.findFirst({
        where: and(eq(quizAttempts.id, attemptId), eq(quizAttempts.userId, user.id)),
        with: { round: true },
      });

      if (!attempt) {
        return res.status(404).json({ error: 'Attempt not found.' });
      }

      // If already suspended, return current suspension state without duplicating incidents
      if (attempt.status === 'suspended_awaiting_approval') {
        return res.json({
          suspended: true,
          status: 'suspended_awaiting_approval',
          incidentCount: attempt.violationsCount,
          message: 'Task is suspended awaiting Chief Proctor review and authorization.',
        });
      }

      // Only active attempts (in_progress or resumed) can trigger a suspension
      if (attempt.status !== 'in_progress' && attempt.status !== 'resumed') {
        return res.status(400).json({ error: `Attempt is not currently active (${attempt.status}).` });
      }

      const cleanType = violationType || 'tab_switch';
      const cleanDetails = details || 'Tab switch / Window focus departure';
      const now = new Date();

      // Record security violation incident with participant ID, task/round ID, timestamp, and details
      await db.insert(securityViolations).values({
        attemptId: attempt.id,
        userId: user.id,
        roundId: attempt.roundId,
        violationType: cleanType,
        details: cleanDetails,
        serverTimestamp: now,
      });

      const newViolationsCount = (attempt.violationsCount || 0) + 1;

      // Immediate suspension on the very first tab switch!
      // Freeze the timer by setting pausedAt = now
      await db
        .update(quizAttempts)
        .set({
          status: 'suspended_awaiting_approval',
          pausedAt: now,
          lastIncidentAt: now,
          violationsCount: newViolationsCount,
          disqualificationReason: cleanDetails,
        })
        .where(eq(quizAttempts.id, attempt.id));

      // Record activity event
      await db.insert(activityEvents).values({
        userId: user.id,
        attemptId: attempt.id,
        eventType: 'TAB_SWITCH_SUSPENSION',
        details: `Tab/window switch incident #${newViolationsCount} detected: ${cleanDetails}. Assessment suspended awaiting proctor authorization.`,
        severity: 'critical',
      });

      // Audit log
      await db.insert(auditLogs).values({
        userId: user.id,
        action: 'TAB_SWITCH_SUSPENSION',
        targetType: 'quiz_attempts',
        targetId: String(attempt.id),
        metadata: {
          violationType: cleanType,
          incidentCount: newViolationsCount,
          details: cleanDetails,
          pausedAt: now,
        },
      });

      return res.json({
        suspended: true,
        status: 'suspended_awaiting_approval',
        strikes: newViolationsCount,
        incidentCount: newViolationsCount,
        pausedAt: now.toISOString(),
        message:
          'TASK SUSPENDED: Leaving the active task window violates tournament rules. Assessment has been suspended pending Chief Proctor authorization.',
      });
    } catch (error: any) {
      console.error('Security event error:', error);
      res.status(500).json({ error: 'Failed to record security event.' });
    }
  }
);

// Submit Final Attempt
app.post('/api/attempts/:id/submit', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const attemptId = parseInt(req.params.id as string, 10);
    const user = req.user!;

    const attempt = await db.query.quizAttempts.findFirst({
      where: and(eq(quizAttempts.id, attemptId), eq(quizAttempts.userId, user.id)),
      with: { round: true },
    });

    if (!attempt) {
      return res.status(404).json({ error: 'Attempt not found.' });
    }

    if (attempt.status === 'suspended_awaiting_approval') {
      return res.status(403).json({
        error: 'Submission rejected: Assessment is currently suspended awaiting Chief Proctor review.',
      });
    }

    if (attempt.status === 'terminated' || attempt.status === 'removed' || attempt.status === 'disqualified') {
      return res.status(403).json({
        error: 'Submission rejected: Assessment attempt has been terminated.',
      });
    }

    const now = new Date();
    // Calculate final score across all answered questions (scaled to admin-configured round.maxScore)
    const [allAnswers, activeRoundQs] = await Promise.all([
      db.query.participantAnswers.findMany({
        where: eq(participantAnswers.attemptId, attempt.id),
      }),
      db.query.questions.findMany({
        where: and(eq(questions.roundId, attempt.roundId), eq(questions.isActive, true)),
      }),
    ]);

    const rawScore = allAnswers.reduce((sum, a) => sum + (a.isCorrect ? a.pointsEarned : 0), 0);
    const rawMaxPoints = activeRoundQs.reduce((sum, q) => sum + (q.points || 1), 0);
    const maxScore = attempt.round.maxScore || (attempt.round.roundNumber === 1 ? 30 : attempt.round.roundNumber === 2 ? 300 : 30);
    const finalScore =
      rawMaxPoints > 0 && maxScore > 0 && maxScore !== rawMaxPoints
        ? Math.round((rawScore / rawMaxPoints) * maxScore)
        : rawScore;
    const qualPct = attempt.round.qualifyingPercentage || 60;
    const qualifyingScore = Math.ceil(maxScore * (qualPct / 100));
    const isQualified = finalScore >= qualifyingScore;

    await db
      .update(quizAttempts)
      .set({
        status: 'submitted',
        score: finalScore,
        isQualified,
        endTime: now,
      })
      .where(eq(quizAttempts.id, attempt.id));

    // Audit log
    await db.insert(auditLogs).values({
      userId: user.id,
      action: 'SUBMIT_ATTEMPT',
      targetType: 'quiz_attempts',
      targetId: String(attempt.id),
      metadata: { score: finalScore, maxScore, isQualified, roundNumber: attempt.round.roundNumber },
    });

    res.json({
      success: true,
      score: finalScore,
      maxScore,
      qualifyingScore,
      qualifyingPercentage: qualPct,
      isQualified,
      roundNumber: attempt.round.roundNumber,
      message: isQualified
        ? `Round ${attempt.round.roundNumber} submitted! Congratulations, you qualified with ${finalScore}/${maxScore} marks.`
        : `Round ${attempt.round.roundNumber} submitted. You scored ${finalScore}/${maxScore} marks (Required to qualify: ${qualifyingScore}).`,
    });
  } catch (error: any) {
    console.error('Submit attempt error:', error);
    res.status(500).json({ error: 'Failed to submit attempt.' });
  }
});

// Review Attempt (Explanations and Answer Keys Revealed Only When Allowed)
app.get('/api/attempts/:id/review', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const attemptId = parseInt(req.params.id as string, 10);
    const user = req.user!;

    const attempt = await db.query.quizAttempts.findFirst({
      where: and(eq(quizAttempts.id, attemptId), eq(quizAttempts.userId, user.id)),
      with: { round: true },
    });

    if (!attempt) {
      return res.status(404).json({ error: 'Attempt not found.' });
    }

    if (attempt.status !== 'submitted' && attempt.status !== 'timed_out' && attempt.status !== 'completed') {
      return res.status(400).json({ error: 'Detailed review is only available after attempt submission.' });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({
        error: 'Answers and master answer keys are strictly confidential and never displayed to participants.',
        locked: true,
      });
    }

    const roundQuestions = await db.query.questions.findMany({
      where: eq(questions.roundId, attempt.roundId),
      orderBy: (questions, { asc }) => [asc(questions.orderIndex)],
    });

    const userAnswers = await db.query.participantAnswers.findMany({
      where: eq(participantAnswers.attemptId, attempt.id),
    });

    const answersMap: Record<number, any> = {};
    userAnswers.forEach((a) => {
      answersMap[a.questionId] = a;
    });

    const reviewQuestions = roundQuestions.map((q) => ({
      id: q.id,
      code: q.code,
      prompt: q.prompt,
      options: q.options,
      correctOption: q.correctOption,
      explanation: q.explanation,
      points: q.points,
      category: q.category,
      userAnswer: answersMap[q.id]?.selectedOption,
      isCorrect: answersMap[q.id]?.isCorrect || false,
      pointsEarned: answersMap[q.id]?.pointsEarned || 0,
    }));

    res.json({
      attemptId: attempt.id,
      score: attempt.score,
      maxScore: attempt.round.maxScore,
      isQualified: attempt.isQualified,
      questions: reviewQuestions,
    });
  } catch (error: any) {
    console.error('Review attempt error:', error);
    res.status(500).json({ error: 'Failed to load attempt review.' });
  }
});

// Submit Disqualification Appeal
app.post('/api/appeals', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { appealReason } = req.body;

    if (!appealReason || String(appealReason).trim().length < 5) {
      return res.status(400).json({ error: 'Please provide a descriptive reason for your appeal.' });
    }

    const lastAttempt = await db.query.quizAttempts.findFirst({
      where: eq(quizAttempts.userId, user.id),
      orderBy: (quizAttempts, { desc }) => [desc(quizAttempts.id)],
    });

    if (!lastAttempt) {
      return res.status(400).json({ error: 'No quiz attempts found to appeal.' });
    }

    const [review] = await db
      .insert(disqualificationReviews)
      .values({
        attemptId: lastAttempt.id,
        userId: user.id,
        appealReason: String(appealReason).trim(),
        status: 'pending',
      })
      .returning();

    // Audit log
    await db.insert(auditLogs).values({
      userId: user.id,
      action: 'SUBMIT_APPEAL',
      targetType: 'disqualification_reviews',
      targetId: String(review.id),
      metadata: { appealReason },
    });

    res.json({
      success: true,
      reviewId: review.id,
      message: 'Your appeal has been submitted to the Chief Proctor for review.',
    });
  } catch (error: any) {
    console.error('Appeal error:', error);
    res.status(500).json({ error: 'Failed to submit appeal.' });
  }
});

// Live Leaderboard (Tie-break by total score, then faster time)
app.get('/api/leaderboard', async (_req: Request, res: Response) => {
  try {
    const allUsers = await db.query.users.findMany({
      where: eq(users.role, 'participant'),
      with: {
        attempts: true,
      },
    });

    const leaderboard = allUsers.map((u) => {
      let r1Score = 0;
      let r2Score = 0;
      let r3Score = 0;
      let totalTimeSeconds = 0;

      const userAttempts = Array.isArray(u.attempts) ? u.attempts : [];
      for (const att of userAttempts) {
        if (att.roundId === 1 || att.roundId === 4) r1Score = att.score || 0;
        if (att.roundId === 2 || att.roundId === 5) r2Score = att.score || 0;
        if (att.roundId === 3 || att.roundId === 6) r3Score = att.score || 0;

        if (att.endTime && att.startTime) {
          const endMs = new Date(att.endTime).getTime();
          const startMs = new Date(att.startTime).getTime();
          totalTimeSeconds += Math.max(0, (endMs - startMs) / 1000);
        }
      }

      const totalScore = r1Score + r2Score + r3Score;

      return {
        id: u.id,
        code: u.code,
        name: u.name,
        college: u.college,
        teamName: u.teamName,
        teamMembers: u.teamMembers,
        zone: u.zone,
        isBlocked: u.isBlocked,
        r1Score,
        r2Score,
        r3Score,
        totalScore,
        totalTimeSeconds,
      };
    });

    // Sort: Higher score first; if equal, faster time
    leaderboard.sort((a, b) => {
      if (b.totalScore !== a.totalScore) {
        return b.totalScore - a.totalScore;
      }
      return a.totalTimeSeconds - b.totalTimeSeconds;
    });

    const ranked = leaderboard.map((item, idx) => ({
      ...item,
      rank: idx + 1,
    }));

    // College Standings
    const collegeMap: Record<string, { total: number; count: number; zone: string }> = {};
    ranked.forEach((item) => {
      if (!collegeMap[item.college]) {
        collegeMap[item.college] = { total: item.totalScore, count: 1, zone: item.zone || 'South Zone' };
      } else {
        collegeMap[item.college].total += item.totalScore;
        collegeMap[item.college].count += 1;
      }
    });

    const collegeStandings = Object.entries(collegeMap)
      .map(([institution, data]) => ({
        institution,
        zone: data.zone,
        avgPts: data.count > 0 ? Number((data.total / data.count).toFixed(1)) : 0,
        activeCount: data.count,
      }))
      .sort((a, b) => b.avgPts - a.avgPts)
      .map((item, idx) => ({ ...item, rank: idx + 1 }));

    res.json({
      leaderboard: ranked,
      collegeStandings,
    });
  } catch (error: any) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: 'Failed to generate leaderboard.', details: error?.message || String(error) });
  }
});

// ==========================================
// 3. SECURE ADMINISTRATOR ROUTES (SUPPLEMENTAL TO adminRouter)
// ==========================================

// Admin Block Participant
app.post(
  '/api/admin/participants/:id/block',
  requireAuth,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const targetId = parseInt(req.params.id as string, 10);
      const { reason } = req.body;
      const cleanReason = reason || 'Administrative Disqualification by Chief Proctor.';

      await db
        .update(users)
        .set({
          isBlocked: true,
          blockReason: cleanReason,
        })
        .where(eq(users.id, targetId));

      // Audit log
      await db.insert(auditLogs).values({
        userId: req.user!.id,
        action: 'EJECT_PARTICIPANT',
        targetType: 'users',
        targetId: String(targetId),
        metadata: { reason: cleanReason },
      });

      res.json({ success: true, message: 'Participant has been blocked and questions locked.' });
    } catch (error: any) {
      console.error('Block participant error:', error);
      res.status(500).json({ error: 'Failed to block participant.' });
    }
  }
);

// Admin Violations Timeline
app.get('/api/admin/violations', requireAuth, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const list = await db.query.securityViolations.findMany({
      with: {
        user: true,
        round: true,
      },
      orderBy: (securityViolations, { desc }) => [desc(securityViolations.id)],
      limit: 50,
    });

    const formatted = list.map((v: any) => ({
      id: v.id,
      teamName: v.user?.teamName || 'Unknown Team',
      code: v.user?.code || 'N/A',
      college: v.user?.college || 'N/A',
      roundTitle: v.round?.title || 'Unknown Round',
      violationType: v.violationType,
      details: v.details,
      timestamp: v.serverTimestamp,
    }));

    res.json(formatted);
  } catch (error: any) {
    console.error('Admin violations error:', error);
    res.status(500).json({ error: 'Failed to fetch violation timeline.' });
  }
});

// Admin Appeals & Reviews
app.get('/api/admin/appeals', requireAuth, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const list = await db.query.disqualificationReviews.findMany({
      with: {
        user: true,
        attempt: { with: { round: true } },
      },
      orderBy: (disqualificationReviews, { desc }) => [desc(disqualificationReviews.id)],
    });

    const formatted = list.map((a: any) => ({
      id: a.id,
      userId: a.user?.id,
      teamName: a.user?.teamName || 'Unknown Team',
      code: a.user?.code || 'N/A',
      college: a.user?.college || 'N/A',
      roundTitle: a.attempt?.round?.title || 'Unknown Round',
      appealReason: a.appealReason,
      status: a.status,
      reviewerNotes: a.reviewerNotes,
      reviewedBy: a.reviewedBy,
      reviewedAt: a.reviewedAt,
      createdAt: a.createdAt,
    }));

    res.json(formatted);
  } catch (error: any) {
    console.error('Admin appeals error:', error);
    res.status(500).json({ error: 'Failed to fetch appeals.' });
  }
});

// Review Appeal (Approve or Reject)
app.post(
  '/api/admin/appeals/:id/review',
  requireAuth,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const appealId = parseInt(req.params.id as string, 10);
      const { status, notes } = req.body; // 'approved' | 'rejected'

      const review = await db.query.disqualificationReviews.findFirst({
        where: eq(disqualificationReviews.id, appealId),
        with: { user: true },
      });

      if (!review) {
        return res.status(404).json({ error: 'Appeal not found.' });
      }

      const now = new Date();
      await db
        .update(disqualificationReviews)
        .set({
          status,
          reviewerNotes: notes || '',
          reviewedBy: req.user!.name,
          reviewedAt: now,
        })
        .where(eq(disqualificationReviews.id, appealId));

      if (status === 'approved') {
        // Pardon the user
        await db
          .update(users)
          .set({ isBlocked: false, blockReason: null })
          .where(eq(users.id, review.userId));

        await db
          .update(quizAttempts)
          .set({ isDisqualified: false, violationsCount: 0 })
          .where(eq(quizAttempts.id, review.attemptId));
      }

      // Audit log
      await db.insert(auditLogs).values({
        userId: req.user!.id,
        action: `REVIEW_APPEAL_${status.toUpperCase()}`,
        targetType: 'disqualification_reviews',
        targetId: String(appealId),
        metadata: { status, notes, targetUser: (review as any).user?.teamName || 'Participant' },
      });

      res.json({ success: true, message: `Appeal marked as ${status}.` });
    } catch (error: any) {
      console.error('Review appeal error:', error);
      res.status(500).json({ error: 'Failed to review appeal.' });
    }
  }
);

// Toggle Round Open/Closed
app.post(
  '/api/admin/rounds/:id/toggle',
  requireAuth,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const roundId = parseInt(req.params.id as string, 10);
      const round = await db.query.rounds.findFirst({
        where: eq(rounds.id, roundId),
      });

      if (!round) {
        return res.status(404).json({ error: 'Round not found.' });
      }

      const newOpenState = !round.isOpen;
      await db.update(rounds).set({ isOpen: newOpenState }).where(eq(rounds.id, roundId));

      // Audit log
      await db.insert(auditLogs).values({
        userId: req.user!.id,
        action: 'TOGGLE_ROUND',
        targetType: 'rounds',
        targetId: String(roundId),
        metadata: { isOpen: newOpenState },
      });

      res.json({ success: true, isOpen: newOpenState });
    } catch (error: any) {
      console.error('Toggle round error:', error);
      res.status(500).json({ error: 'Failed to toggle round.' });
    }
  }
);

// Export Participant Results to CSV
app.get('/api/admin/export-csv', requireAuth, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const participantList = await db.query.users.findMany({
      where: eq(users.role, 'participant'),
      with: {
        attempts: {
          with: { round: true },
        },
      },
    });

    const rows = [
      ['Rank', 'Team Code', 'Team Name', 'College', 'Members', 'Round 1 Pts', 'Round 2 Pts', 'Round 3 Pts', 'Total Score', 'Status', 'Violation Strikes'],
    ];

    const sorted = participantList.map((p) => {
      let r1 = 0;
      let r2 = 0;
      let r3 = 0;
      let strikes = 0;

      (p.attempts || []).forEach((att) => {
        strikes += att.violationsCount || 0;
        const rNum = att.round?.roundNumber || att.roundId;
        if (rNum === 1) r1 = att.score || 0;
        if (rNum === 2) r2 = att.score || 0;
        if (rNum === 3) r3 = att.score || 0;
      });

      return {
        code: p.code,
        teamName: p.teamName,
        college: p.college,
        members: p.teamMembers.join('; '),
        r1,
        r2,
        r3,
        total: r1 + r2 + r3,
        status: p.isBlocked ? 'Disqualified' : 'Active',
        strikes,
      };
    }).sort((a, b) => b.total - a.total);

    sorted.forEach((item, idx) => {
      rows.push([
        String(idx + 1),
        `"${item.code}"`,
        `"${item.teamName.replace(/"/g, '""')}"`,
        `"${item.college.replace(/"/g, '""')}"`,
        `"${item.members.replace(/"/g, '""')}"`,
        String(item.r1),
        String(item.r2),
        String(item.r3),
        String(item.total),
        `"${item.status}"`,
        String(item.strikes),
      ]);
    });

    const csvContent = rows.map((r) => r.join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="tech_arena_results.csv"');
    res.send(csvContent);
  } catch (error: any) {
    console.error('Export CSV error:', error);
    res.status(500).json({ error: 'Failed to export CSV.' });
  }
});

// Admin Audit Logs
app.get('/api/admin/audit-logs', requireAuth, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const logs = await db.query.auditLogs.findMany({
      orderBy: (auditLogs, { desc }) => [desc(auditLogs.id)],
      limit: 100,
    });
    res.json(logs);
  } catch (error: any) {
    console.error('Audit logs error:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs.' });
  }
});

// ==========================================
// 4. VITE FRONTEND SPA INTEGRATION
// ==========================================
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    // Dynamically import Vite only in development so serverless production bundles stay lightweight
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in standalone production mode
    app.use(express.static('dist'));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile('dist/index.html', { root: '.' });
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TECH ARENA production server running on port ${PORT}`);
  });
}

// Only start standalone HTTP listener when not running inside Vercel Serverless Functions
if (!process.env.VERCEL) {
  startServer();
}

export default app;
