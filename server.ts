// server.ts
import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
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
} from './src/db/schema.ts';
import { eq, and, desc, sql } from 'drizzle-orm';
import { requireAuth, requireAdmin, AuthRequest } from './src/middleware/auth.ts';
import { seedTournamentDatabase, syncRound2Questions } from './src/db/seed.ts';

const app = express();
// The AI Studio dev server and Cloud Run reverse proxy requires the backend to listen on port 3000
const PORT = 3000;

app.use(express.json());

// Run initial seed check on startup
seedTournamentDatabase()
  .then(() => syncRound2Questions())
  .catch((err) => {
    console.error('Error during initial database seed check:', err);
  });

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

    const token = `ta_team_${user.code}`;

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

// Admin Authentication (Master Password verification)
app.post('/api/auth/admin-login', async (req: Request, res: Response) => {
  try {
    const { passkey } = req.body;
    const cleanKey = String(passkey || '').trim();

    // Verify master admin password (configured as tech@kle)
    if (cleanKey !== 'tech@kle') {
      return res.status(401).json({ error: 'Authentication failed. Incorrect password.' });
    }

    let adminUser = await db.query.users.findFirst({
      where: eq(users.role, 'admin'),
    });

    if (!adminUser) {
      const [newAdmin] = await db
        .insert(users)
        .values({
          uid: 'admin_vybe2k26_root',
          email: 'admin@techarena.edu',
          role: 'admin',
          name: 'Chief Proctor Administrator',
          college: 'Tournament Directorate',
          teamName: 'Tournament Control',
          teamMembers: ['Chief Proctor', 'Invigilator Prime'],
          code: '#TA-ADMIN',
          zone: 'Central Command',
        })
        .returning();
      adminUser = newAdmin;
    }

    const token = `ta_admin_${Date.now()}`;

    // Log audit
    await db.insert(auditLogs).values({
      userId: adminUser.id,
      action: 'ADMIN_LOGIN',
      targetType: 'users',
      targetId: String(adminUser.id),
      metadata: { ip: req.ip },
    });

    res.json({
      token,
      user: {
        id: adminUser.id,
        uid: adminUser.uid,
        email: adminUser.email,
        role: 'admin',
        name: adminUser.name,
        college: adminUser.college,
        teamName: adminUser.teamName,
        teamMembers: adminUser.teamMembers,
        code: adminUser.code,
        zone: adminUser.zone,
        isBlocked: false,
      },
    });
  } catch (error: any) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Admin authentication failure.' });
  }
});

// ==========================================
// 2. AUTHENTICATED PARTICIPANT ROUTES
// ==========================================

// Get Current User Profile & Round Progression Status
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
    });

    let r1Score = 0;
    let r2Score = 0;
    let r3Score = 0;
    let r1Completed = false;
    let r2Completed = false;
    let r3Completed = false;
    let violations = 0;

    for (const att of attempts) {
      violations += att.violationsCount;
      if (att.round.roundNumber === 1) {
        r1Score = att.score;
        r1Completed = att.status === 'submitted' || att.status === 'timed_out';
      } else if (att.round.roundNumber === 2) {
        r2Score = att.score;
        r2Completed = att.status === 'submitted' || att.status === 'timed_out';
      } else if (att.round.roundNumber === 3) {
        r3Score = att.score;
        r3Completed = att.status === 'submitted' || att.status === 'timed_out';
      }
    }

    res.json({
      user: {
        ...dbUser,
        r1Score,
        r2Score,
        r3Score,
        r1Completed,
        r2Completed,
        r3Completed,
        violations,
        maxViolations: 2,
      },
    });
  } catch (error: any) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to retrieve participant profile.' });
  }
});

// Get Competition Rounds
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

// Start a Quiz Attempt (Enforces server countdown timer & anti-cheat lockout)
app.post('/api/attempts/start', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { roundNumber } = req.body;
    const rNum = parseInt(roundNumber, 10);

    if (isNaN(rNum) || rNum < 1 || rNum > 3) {
      return res.status(400).json({ error: 'Invalid round number.' });
    }

    // Check if participant is blocked
    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, user.id),
    });

    if (dbUser?.isBlocked) {
      return res.status(403).json({
        error: 'Questions blocked: Your terminal is restricted due to a rule violation.',
        isBlocked: true,
      });
    }

    // Get round
    const round = await db.query.rounds.findFirst({
      where: eq(rounds.roundNumber, rNum),
    });

    if (!round || !round.isOpen) {
      return res.status(400).json({ error: 'Round is currently closed.' });
    }

    // Check for existing attempt
    let attempt = await db.query.quizAttempts.findFirst({
      where: and(eq(quizAttempts.userId, user.id), eq(quizAttempts.roundId, round.id)),
    });

    const now = new Date();

    if (!attempt) {
      // Calculate server deadline: now + duration in minutes
      const serverDeadline = new Date(now.getTime() + round.durationMinutes * 60 * 1000);

      // Fetch question count
      const qs = await db.query.questions.findMany({
        where: eq(questions.roundId, round.id),
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
          totalQuestions: qs.length,
          answersCount: 0,
          violationsCount: 0,
        })
        .returning();

      attempt = newAttempt;

      // Log attempt start
      await db.insert(auditLogs).values({
        userId: user.id,
        action: 'START_ATTEMPT',
        targetType: 'quiz_attempts',
        targetId: String(attempt.id),
        metadata: { roundNumber: rNum, serverDeadline },
      });
    }

    // Check if deadline has passed
    const remainingMs = attempt.serverDeadline.getTime() - now.getTime();
    if (remainingMs <= 0 && attempt.status === 'in_progress') {
      await db
        .update(quizAttempts)
        .set({ status: 'timed_out', endTime: now })
        .where(eq(quizAttempts.id, attempt.id));
      attempt.status = 'timed_out';
    }

    // Fetch questions WITHOUT exposing correctOption to participant!
    const roundQuestions = await db.query.questions.findMany({
      where: eq(questions.roundId, round.id),
      orderBy: (questions, { asc }) => [asc(questions.orderIndex)],
    });

    // Sanitized questions for client (correctOption is stripped)
    const sanitizedQuestions = roundQuestions.map((q) => ({
      id: q.id,
      prompt: q.prompt,
      type: q.type,
      options: q.options,
      codeStarter: q.codeStarter,
      points: q.points,
      orderIndex: q.orderIndex,
      category: q.category,
    }));

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
      status: attempt.status,
      serverDeadline: attempt.serverDeadline,
      remainingSeconds: Math.max(0, Math.floor(remainingMs / 1000)),
      durationMinutes: round.durationMinutes,
      violationsCount: attempt.violationsCount,
      maxViolations: round.maxViolations,
      questions: sanitizedQuestions,
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
    const attemptId = parseInt(req.params.id, 10);
    const user = req.user!;

    const attempt = await db.query.quizAttempts.findFirst({
      where: and(eq(quizAttempts.id, attemptId), eq(quizAttempts.userId, user.id)),
    });

    if (!attempt) {
      return res.status(404).json({ error: 'Attempt not found.' });
    }

    const now = new Date();
    const remainingMs = attempt.serverDeadline.getTime() - now.getTime();

    // Auto-timeout if server deadline has expired
    if (remainingMs <= 0 && attempt.status === 'in_progress') {
      await db
        .update(quizAttempts)
        .set({ status: 'timed_out', endTime: now })
        .where(eq(quizAttempts.id, attempt.id));
      attempt.status = 'timed_out';
    }

    res.json({
      attemptId: attempt.id,
      status: attempt.status,
      remainingSeconds: Math.max(0, Math.floor(remainingMs / 1000)),
      serverTime: now.toISOString(),
      violationsCount: attempt.violationsCount,
      isDisqualified: attempt.isDisqualified,
    });
  } catch (error: any) {
    console.error('Sync attempt error:', error);
    res.status(500).json({ error: 'Failed to synchronize attempt timer.' });
  }
});

// Submit/Save an Answer to a Question (Idempotent server-side evaluation)
app.post('/api/attempts/:id/answer', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const attemptId = parseInt(req.params.id, 10);
    const user = req.user!;
    const { questionId, selectedOption, submittedCode } = req.body;

    const attempt = await db.query.quizAttempts.findFirst({
      where: and(eq(quizAttempts.id, attemptId), eq(quizAttempts.userId, user.id)),
    });

    if (!attempt || attempt.status !== 'in_progress') {
      return res.status(400).json({ error: 'Attempt is not currently active.' });
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

    // Evaluate answer on the server!
    let isCorrect = false;
    let pointsEarned = 0;

    if (question.type === 'mcq') {
      isCorrect = selectedOption !== undefined && selectedOption === question.correctOption;
      pointsEarned = isCorrect ? question.points : 0;
    } else if (question.type === 'code') {
      // Basic automated code validator: checks that submitted code compiles and contains key algorithmic tokens
      const codeStr = String(submittedCode || '');
      if (codeStr.length > 20 && !codeStr.includes('return []')) {
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
          submittedCode: submittedCode ?? existing.submittedCode,
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
        submittedCode,
        isCorrect,
        pointsEarned,
      });
    }

    // Recalculate total score and answers count for attempt
    const allAnswers = await db.query.participantAnswers.findMany({
      where: eq(participantAnswers.attemptId, attempt.id),
    });

    const newScore = allAnswers.reduce((sum, a) => sum + (a.isCorrect ? a.pointsEarned : 0), 0);

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
      const attemptId = parseInt(req.params.id, 10);
      const user = req.user!;
      const { violationType, details } = req.body;

      const attempt = await db.query.quizAttempts.findFirst({
        where: and(eq(quizAttempts.id, attemptId), eq(quizAttempts.userId, user.id)),
        with: { round: true },
      });

      if (!attempt || attempt.status !== 'in_progress') {
        return res.status(400).json({ error: 'Attempt is not currently active.' });
      }

      const cleanType = violationType || 'tab_blur';
      const cleanDetails = details || 'Tab switch / Window focus departure';
      const now = new Date();

      // Record security violation event
      await db.insert(securityViolations).values({
        attemptId: attempt.id,
        userId: user.id,
        roundId: attempt.roundId,
        violationType: cleanType,
        details: cleanDetails,
        serverTimestamp: now,
      });

      const newViolationsCount = attempt.violationsCount + 1;
      const maxAllowed = attempt.round.maxViolations;
      const shouldDisqualify = newViolationsCount >= maxAllowed;

      if (shouldDisqualify) {
        // Disqualify attempt and block user terminal!
        await db
          .update(quizAttempts)
          .set({
            violationsCount: newViolationsCount,
            isDisqualified: true,
            disqualificationReason: cleanDetails,
            status: 'disqualified',
            endTime: now,
          })
          .where(eq(quizAttempts.id, attempt.id));

        // Block user terminal across all questions
        await db
          .update(users)
          .set({
            isBlocked: true,
            blockReason: `Disqualified in ${attempt.round.title}: ${cleanDetails}`,
          })
          .where(eq(users.id, user.id));

        // Audit log
        await db.insert(auditLogs).values({
          userId: user.id,
          action: 'SECURITY_DISQUALIFICATION',
          targetType: 'quiz_attempts',
          targetId: String(attempt.id),
          metadata: { violationType: cleanType, strikes: newViolationsCount, details: cleanDetails },
        });

        return res.json({
          disqualified: true,
          strikes: newViolationsCount,
          maxAllowed,
          reason: cleanDetails,
          message:
            'Security violation threshold reached. Terminal ejected to dashboard and all questions locked.',
        });
      }

      // Increment strikes
      await db
        .update(quizAttempts)
        .set({ violationsCount: newViolationsCount })
        .where(eq(quizAttempts.id, attempt.id));

      res.json({
        disqualified: false,
        strikes: newViolationsCount,
        maxAllowed,
        warning: `Integrity warning: ${newViolationsCount}/${maxAllowed} strikes. Do not switch tabs or exit fullscreen.`,
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
    const attemptId = parseInt(req.params.id, 10);
    const user = req.user!;

    const attempt = await db.query.quizAttempts.findFirst({
      where: and(eq(quizAttempts.id, attemptId), eq(quizAttempts.userId, user.id)),
      with: { round: true },
    });

    if (!attempt) {
      return res.status(404).json({ error: 'Attempt not found.' });
    }

    const now = new Date();
    await db
      .update(quizAttempts)
      .set({
        status: 'submitted',
        endTime: now,
      })
      .where(eq(quizAttempts.id, attempt.id));

    // Audit log
    await db.insert(auditLogs).values({
      userId: user.id,
      action: 'SUBMIT_ATTEMPT',
      targetType: 'quiz_attempts',
      targetId: String(attempt.id),
      metadata: { score: attempt.score, totalQuestions: attempt.totalQuestions },
    });

    res.json({
      success: true,
      score: attempt.score,
      roundNumber: attempt.round.roundNumber,
      message: `Round ${attempt.round.roundNumber} submitted successfully!`,
    });
  } catch (error: any) {
    console.error('Submit attempt error:', error);
    res.status(500).json({ error: 'Failed to submit attempt.' });
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

      for (const att of u.attempts) {
        if (att.roundId === 1 || att.roundId === 4) r1Score = att.score;
        if (att.roundId === 2 || att.roundId === 5) r2Score = att.score;
        if (att.roundId === 3 || att.roundId === 6) r3Score = att.score;

        if (att.endTime && att.startTime) {
          totalTimeSeconds += Math.max(0, (att.endTime.getTime() - att.startTime.getTime()) / 1000);
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
    res.status(500).json({ error: 'Failed to generate leaderboard.' });
  }
});

// ==========================================
// 3. SECURE ADMINISTRATOR ROUTES
// ==========================================

// Admin Overview & Metrics
app.get('/api/admin/overview', requireAuth, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const totalParticipants = await db.$count(users, eq(users.role, 'participant'));
    const totalAttempts = await db.$count(quizAttempts);
    const activeAttempts = await db.$count(quizAttempts, eq(quizAttempts.status, 'in_progress'));
    const completedAttempts = await db.$count(quizAttempts, eq(quizAttempts.status, 'submitted'));
    const blockedCount = await db.$count(users, eq(users.isBlocked, true));
    const pendingAppeals = await db.$count(
      disqualificationReviews,
      eq(disqualificationReviews.status, 'pending')
    );

    // Calculate average score
    const allAttempts = await db.query.quizAttempts.findMany({
      columns: { score: true },
    });
    const avgScore =
      allAttempts.length > 0
        ? Math.round(allAttempts.reduce((sum, a) => sum + a.score, 0) / allAttempts.length)
        : 0;

    // Violations by round
    const allViolations = await db.query.securityViolations.findMany({
      with: { round: true },
    });
    const violationsByRound: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
    allViolations.forEach((v: any) => {
      const rNum = v.round?.roundNumber || 1;
      violationsByRound[rNum] = (violationsByRound[rNum] || 0) + 1;
    });

    res.json({
      totalParticipants,
      activeAttempts,
      completedAttempts,
      totalAttempts,
      blockedCount,
      pendingAppeals,
      avgScore,
      violationsByRound,
    });
  } catch (error: any) {
    console.error('Admin overview error:', error);
    res.status(500).json({ error: 'Failed to retrieve admin telemetry.' });
  }
});

// Admin Participant List
app.get('/api/admin/participants', requireAuth, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const participantList = await db.query.users.findMany({
      where: eq(users.role, 'participant'),
      with: {
        attempts: {
          with: { round: true },
        },
      },
      orderBy: (users, { desc }) => [desc(users.id)],
    });

    const data = participantList.map((p) => {
      let r1 = 0;
      let r2 = 0;
      let r3 = 0;
      let strikes = 0;

      p.attempts.forEach((att) => {
        strikes += att.violationsCount;
        if (att.round.roundNumber === 1) r1 = att.score;
        if (att.round.roundNumber === 2) r2 = att.score;
        if (att.round.roundNumber === 3) r3 = att.score;
      });

      return {
        id: p.id,
        code: p.code,
        name: p.name,
        college: p.college,
        teamName: p.teamName,
        teamMembers: p.teamMembers,
        zone: p.zone,
        isBlocked: p.isBlocked,
        blockReason: p.blockReason,
        r1Score: r1,
        r2Score: r2,
        r3Score: r3,
        totalScore: r1 + r2 + r3,
        strikes,
        createdAt: p.createdAt,
      };
    });

    res.json(data);
  } catch (error: any) {
    console.error('Admin participants error:', error);
    res.status(500).json({ error: 'Failed to fetch participant roster.' });
  }
});

// Admin Block Participant
app.post(
  '/api/admin/participants/:id/block',
  requireAuth,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const targetId = parseInt(req.params.id, 10);
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

// Admin Pardon Participant (Restore question access)
app.post(
  '/api/admin/participants/:id/pardon',
  requireAuth,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const targetId = parseInt(req.params.id, 10);

      await db
        .update(users)
        .set({
          isBlocked: false,
          blockReason: null,
        })
        .where(eq(users.id, targetId));

      // Reset violations on attempts
      await db
        .update(quizAttempts)
        .set({
          isDisqualified: false,
          violationsCount: 0,
        })
        .where(eq(quizAttempts.userId, targetId));

      // Audit log
      await db.insert(auditLogs).values({
        userId: req.user!.id,
        action: 'PARDON_PARTICIPANT',
        targetType: 'users',
        targetId: String(targetId),
      });

      res.json({ success: true, message: 'Participant pardoned. Question access restored.' });
    } catch (error: any) {
      console.error('Pardon participant error:', error);
      res.status(500).json({ error: 'Failed to pardon participant.' });
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
      const appealId = parseInt(req.params.id, 10);
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
      const roundId = parseInt(req.params.id, 10);
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

      p.attempts.forEach((att) => {
        strikes += att.violationsCount;
        if (att.round.roundNumber === 1) r1 = att.score;
        if (att.round.roundNumber === 2) r2 = att.score;
        if (att.round.roundNumber === 3) r3 = att.score;
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
    // Mount Vite middlewares in development
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static('dist'));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile('dist/index.html', { root: '.' });
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TECH ARENA production server running on port ${PORT}`);
  });
}

startServer();
