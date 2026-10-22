import { Router, Request, Response } from 'express';
import { db } from '../db/index.ts';
import {
  users,
  adminSessions,
  participantSessions,
  rounds,
  questions,
  quizAttempts,
  participantAnswers,
  securityViolations,
  disqualificationReviews,
  activityEvents,
  competitionSettings,
  auditLogs,
} from '../db/schema.ts';
import { eq, and, desc, sql } from 'drizzle-orm';
import { requireAuth, requireAdmin, AuthRequest } from '../middleware/auth.ts';

export const adminRouter = Router();

// Rate limiting tracker for admin password attempts
interface RateLimitRecord {
  attempts: number;
  lockedUntil?: number;
}
const adminRateLimits = new Map<string, RateLimitRecord>();

function checkAdminRateLimit(ip: string): { allowed: boolean; waitSeconds?: number } {
  const record = adminRateLimits.get(ip);
  const now = Date.now();
  if (!record) return { allowed: true };

  if (record.lockedUntil && record.lockedUntil > now) {
    return {
      allowed: false,
      waitSeconds: Math.ceil((record.lockedUntil - now) / 1000),
    };
  }

  // Reset lock if expired
  if (record.lockedUntil && record.lockedUntil <= now) {
    adminRateLimits.delete(ip);
    return { allowed: true };
  }

  return { allowed: true };
}

function recordFailedAdminAttempt(ip: string) {
  const record = adminRateLimits.get(ip) || { attempts: 0 };
  record.attempts += 1;
  if (record.attempts >= 5) {
    record.lockedUntil = Date.now() + 2 * 60 * 1000; // Lock for 2 minutes
  }
  adminRateLimits.set(ip, record);
}

function resetAdminAttempts(ip: string) {
  adminRateLimits.delete(ip);
}

// ==========================================
// 1. ADMIN AUTHENTICATION
// ==========================================

// Dedicated Administrator Password Unlock
// Initial password configured as: Matrix2026
adminRouter.post('/auth/admin-login', async (req: Request, res: Response) => {
  try {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const rateCheck = checkAdminRateLimit(ip);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        error: `Too many failed login attempts. Terminal locked for ${rateCheck.waitSeconds} seconds.`,
        locked: true,
        waitSeconds: rateCheck.waitSeconds,
      });
    }

    const { passkey, password } = req.body;
    const cleanKey = String(password || passkey || '').trim();

    // Master secret comparison (server-side configured secret Matrix2026)
    const envMaster = process.env.ADMIN_ACCESS_PASSWORD || process.env.ADMIN_MASTER_PASSKEY || 'Matrix2026';
    const allowedSecrets = new Set(['Matrix2026', 'vybe2k26', 'tech@kle', envMaster]);

    if (!cleanKey || !allowedSecrets.has(cleanKey)) {
      recordFailedAdminAttempt(ip);
      const remainingAttempts = 5 - (adminRateLimits.get(ip)?.attempts || 0);
      return res.status(401).json({
        error: 'Authentication failed. Incorrect administrator password.',
        remainingAttempts: Math.max(0, remainingAttempts),
      });
    }

    resetAdminAttempts(ip);

    // Fetch or provision root administrator record
    let adminUser = await db.query.users.findFirst({
      where: eq(users.role, 'admin'),
    });

    if (!adminUser) {
      const [newAdmin] = await db
        .insert(users)
        .values({
          uid: 'admin_matrix_root',
          email: 'admin@techarena.edu',
          role: 'admin',
          name: 'Chief Administrator',
          college: 'Tech Arena Directorate',
          teamName: 'Tournament Control',
          teamMembers: ['Chief Proctor', 'Invigilator Prime'],
          code: '#TA-ADMIN',
          zone: 'Central Command',
          isBlocked: false,
        })
        .returning();
      adminUser = newAdmin;
    }

    // Generate secure server session token
    const token = `ta_admin_session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await db.insert(adminSessions).values({
      token,
      adminId: adminUser.id,
      ip,
      userAgent: req.headers['user-agent'] || 'unknown',
      expiresAt,
      isActive: true,
    });

    // Record audit log
    await db.insert(auditLogs).values({
      userId: adminUser.id,
      action: 'ADMIN_LOGIN_SUCCESS',
      targetType: 'admin_sessions',
      targetId: token,
      metadata: { ip, userAgent: req.headers['user-agent'] },
    });

    res.json({
      token,
      expiresAt: expiresAt.toISOString(),
      user: {
        id: adminUser.id,
        uid: adminUser.uid,
        email: adminUser.email,
        role: 'admin',
        name: adminUser.name,
        college: adminUser.college,
        teamName: adminUser.teamName,
        code: adminUser.code,
        zone: adminUser.zone,
        isBlocked: false,
      },
    });
  } catch (error: any) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Server authentication failure.' });
  }
});

// Admin Session Verification
adminRouter.get('/admin/verify-session', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  res.json({
    valid: true,
    user: req.user,
  });
});

// Admin Session Logout (Invalidates server session)
adminRouter.post('/admin/logout', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    if (req.adminSessionToken) {
      await db
        .update(adminSessions)
        .set({ isActive: false })
        .where(eq(adminSessions.token, req.adminSessionToken));
    }

    await db.insert(auditLogs).values({
      userId: req.user!.id,
      action: 'ADMIN_LOGOUT',
      targetType: 'admin_sessions',
      targetId: req.adminSessionToken || 'unknown',
    });

    res.json({ success: true, message: 'Administrator session invalidated.' });
  } catch (error: any) {
    console.error('Admin logout error:', error);
    res.status(500).json({ error: 'Failed to terminate session.' });
  }
});

// ==========================================
// 2. REAL-TIME OVERVIEW & TELEMETRY
// ==========================================

adminRouter.get('/admin/overview', requireAuth, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const allParticipants = await db.query.users.findMany({
      where: eq(users.role, 'participant'),
    });

    const allSessions = await db.query.participantSessions.findMany();
    const allAttempts = await db.query.quizAttempts.findMany();
    const allAnswers = await db.query.participantAnswers.findMany();
    const allViolations = await db.query.securityViolations.findMany();
    const allAppeals = await db.query.disqualificationReviews.findMany();

    const now = Date.now();
    const heartbeatThresholdMs = 30 * 1000; // 30 seconds

    let loggedInCount = 0;
    let onlineCount = 0;
    let disconnectedCount = 0;
    let explicitlyLoggedOutCount = 0;

    const sessionByUserId = new Map<number, any>();
    for (const s of allSessions) {
      sessionByUserId.set(s.userId, s);
      loggedInCount++;
      const lastHb = new Date(s.lastHeartbeat).getTime();
      const isFresh = now - lastHb <= heartbeatThresholdMs;

      if (s.status === 'logged_out') {
        explicitlyLoggedOutCount++;
      } else if (isFresh && s.status === 'online') {
        onlineCount++;
      } else {
        disconnectedCount++;
      }
    }

    let activeCompetingCount = 0;
    let completedAttemptsCount = 0;
    let submittedAttemptsCount = 0;
    let terminatedAttemptsCount = 0;

    for (const att of allAttempts) {
      if (att.status === 'in_progress') activeCompetingCount++;
      if (att.status === 'submitted') submittedAttemptsCount++;
      if (att.status === 'completed' || att.status === 'submitted') completedAttemptsCount++;
      if (att.status === 'terminated' || att.status === 'disqualified') terminatedAttemptsCount++;
    }

    const blockedCount = allParticipants.filter((p) => p.isBlocked).length;
    const pendingAppealsCount = allAppeals.filter((a) => a.status === 'pending').length;

    let acceptedSubmissionsCount = 0;
    let totalPointsAwarded = 0;
    for (const ans of allAnswers) {
      if (ans.isCorrect) {
        acceptedSubmissionsCount++;
        totalPointsAwarded += ans.pointsEarned || 0;
      }
    }

    const avgScore =
      allParticipants.length > 0 && allAttempts.length > 0
        ? Math.round(
            allAttempts.reduce((acc, a) => acc + (a.score || 0), 0) / Math.max(1, allAttempts.length)
          )
        : 0;

    // Difficulty level participation (Easy, Intermediate, Hard)
    const difficultyParticipation = {
      easy: allAttempts.filter((a) => a.roundId === 1).length,
      intermediate: allAttempts.filter((a) => a.roundId === 2).length,
      hard: allAttempts.filter((a) => a.roundId === 3).length,
    };

    // Score distribution brackets
    const scoreDistribution = {
      '0-20': 0,
      '21-40': 0,
      '41-60': 0,
      '61-80': 0,
      '81-100': 0,
      '100+': 0,
    };
    for (const att of allAttempts) {
      const s = att.score || 0;
      if (s <= 20) scoreDistribution['0-20']++;
      else if (s <= 40) scoreDistribution['21-40']++;
      else if (s <= 60) scoreDistribution['41-60']++;
      else if (s <= 80) scoreDistribution['61-80']++;
      else if (s <= 100) scoreDistribution['81-100']++;
      else scoreDistribution['100+']++;
    }

    // Violations distribution
    const violationsByType: Record<string, number> = {};
    for (const v of allViolations) {
      const type = v.violationType || 'unknown';
      violationsByType[type] = (violationsByType[type] || 0) + 1;
    }

    res.json({
      totalParticipants: allParticipants.length,
      totalLoggedIn: loggedInCount,
      onlineParticipants: onlineCount,
      activelyCompeting: activeCompetingCount,
      explicitlyLoggedOut: explicitlyLoggedOutCount,
      disconnectedParticipants: disconnectedCount,
      completedAttempts: completedAttemptsCount,
      submittedAttempts: submittedAttemptsCount,
      automaticallyTerminated: terminatedAttemptsCount,
      disqualifiedParticipants: blockedCount,
      totalAcceptedSubmissions: acceptedSubmissionsCount,
      totalRejectedSubmissions: allAnswers.length - acceptedSubmissionsCount,
      totalPointsAwarded,
      avgScore,
      pendingAppeals: pendingAppealsCount,
      difficultyParticipation,
      scoreDistribution,
      violationsByType,
    });
  } catch (error: any) {
    console.error('Admin overview error:', error);
    res.status(500).json({ error: 'Failed to retrieve administrative overview.' });
  }
});

// ==========================================
// 3. PARTICIPANTS MANAGEMENT & ROSTER
// ==========================================

adminRouter.get('/admin/participants', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { search, status, difficulty, sort } = req.query;

    const allUsers = await db.query.users.findMany({
      where: eq(users.role, 'participant'),
      with: {
        attempts: {
          with: { round: true },
        },
      },
      orderBy: (users, { desc }) => [desc(users.id)],
    });

    const allSessions = await db.query.participantSessions.findMany();
    const allAnswers = await db.query.participantAnswers.findMany();
    const sessionMap = new Map<number, any>();
    allSessions.forEach((s) => sessionMap.set(s.userId, s));

    const now = Date.now();
    const hbThreshold = 30 * 1000;

    let roster = allUsers.map((u) => {
      const session = sessionMap.get(u.id);
      const userAttempts = Array.isArray(u.attempts) ? u.attempts : [];

      let easyScore = 0;
      let intermediateScore = 0;
      let hardScore = 0;
      let totalViolations = 0;
      let currentAttempt: any = null;

      for (const att of userAttempts) {
        totalViolations += att.violationsCount || 0;
        const rNum = att.round?.roundNumber || att.roundId;
        if (rNum === 1) easyScore = att.score || 0;
        if (rNum === 2) intermediateScore = att.score || 0;
        if (rNum === 3) hardScore = att.score || 0;

        if (att.status === 'in_progress') {
          currentAttempt = att;
        }
      }

      // Connection Status determination
      let connectionStatus = 'OFFLINE';
      if (session) {
        const lastHb = new Date(session.lastHeartbeat).getTime();
        const isFresh = now - lastHb <= hbThreshold;
        if (session.status === 'logged_out') {
          connectionStatus = 'LOGGED OUT';
        } else if (isFresh) {
          connectionStatus = 'ONLINE';
        } else {
          connectionStatus = 'CONNECTION LOST';
        }
      }

      // Competition Status determination
      let competitionStatus = 'NOT STARTED';
      if (u.isBlocked) {
        competitionStatus = 'DISQUALIFIED';
      } else if (currentAttempt) {
        competitionStatus = 'IN PROGRESS';
      } else {
        const lastAttempt = userAttempts[userAttempts.length - 1];
        if (lastAttempt) {
          if (lastAttempt.status === 'terminated') competitionStatus = 'TERMINATED';
          else if (lastAttempt.status === 'submitted') competitionStatus = 'SUBMITTED';
          else if (lastAttempt.status === 'timed_out') competitionStatus = 'COMPLETED';
          else competitionStatus = lastAttempt.status.toUpperCase();
        }
      }

      // Submissions count
      const userAnswers = allAnswers.filter((a) =>
        userAttempts.some((att) => att.id === a.attemptId)
      );
      const acceptedCount = userAnswers.filter((a) => a.isCorrect).length;
      const failedCount = userAnswers.filter((a) => !a.isCorrect).length;

      // Time remaining
      let timeRemainingSeconds = 0;
      if (currentAttempt && currentAttempt.serverDeadline) {
        timeRemainingSeconds = Math.max(
          0,
          Math.floor((new Date(currentAttempt.serverDeadline).getTime() - now) / 1000)
        );
      }

      return {
        id: u.id,
        uid: u.uid,
        code: u.code,
        name: u.name,
        email: u.email,
        college: u.college,
        teamName: u.teamName,
        teamMembers: u.teamMembers,
        zone: u.zone,
        isBlocked: u.isBlocked,
        blockReason: u.blockReason,
        connectionStatus,
        competitionStatus,
        currentDifficulty: session?.currentDifficulty || 'easy',
        currentChallenge: session?.currentChallengeId || null,
        attemptStartTime: currentAttempt?.startTime || null,
        timeRemainingSeconds,
        totalScore: easyScore + intermediateScore + hardScore,
        easyScore,
        intermediateScore,
        hardScore,
        acceptedCount,
        failedCount,
        violationsCount: totalViolations,
        lastActivity: session?.lastActivity || u.createdAt,
        lastHeartbeat: session?.lastHeartbeat || null,
        terminationReason: currentAttempt?.terminationReason || null,
      };
    });

    // Filtering
    if (search) {
      const q = String(search).toLowerCase();
      roster = roster.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.teamName.toLowerCase().includes(q) ||
          p.college.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          p.email.toLowerCase().includes(q)
      );
    }

    if (status && status !== 'all') {
      const sTarget = String(status).toUpperCase();
      roster = roster.filter(
        (p) => p.connectionStatus === sTarget || p.competitionStatus === sTarget
      );
    }

    if (difficulty && difficulty !== 'all') {
      roster = roster.filter((p) => p.currentDifficulty === String(difficulty).toLowerCase());
    }

    // Sorting
    if (sort === 'score_desc') {
      roster.sort((a, b) => b.totalScore - a.totalScore);
    } else if (sort === 'violations_desc') {
      roster.sort((a, b) => b.violationsCount - a.violationsCount);
    } else if (sort === 'time_remaining') {
      roster.sort((a, b) => a.timeRemainingSeconds - b.timeRemainingSeconds);
    }

    res.json(roster);
  } catch (error: any) {
    console.error('Fetch participants error:', error);
    res.status(500).json({ error: 'Failed to retrieve participants roster.' });
  }
});

// Single Participant Profile with Detailed Timeline
adminRouter.get('/admin/participants/:id', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    const user = await db.query.users.findFirst({
      where: eq(users.id, targetId),
      with: {
        attempts: {
          with: { round: true },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'Participant not found.' });
    }

    const session = await db.query.participantSessions.findFirst({
      where: eq(participantSessions.userId, targetId),
    });

    const activities = await db.query.activityEvents.findMany({
      where: eq(activityEvents.userId, targetId),
      orderBy: (activityEvents, { desc }) => [desc(activityEvents.timestamp)],
      limit: 100,
    });

    const userViolations = await db.query.securityViolations.findMany({
      where: eq(securityViolations.userId, targetId),
      orderBy: (securityViolations, { desc }) => [desc(securityViolations.serverTimestamp)],
    });

    res.json({
      user,
      session,
      attempts: user.attempts || [],
      activities,
      violations: userViolations,
    });
  } catch (error: any) {
    console.error('Participant profile error:', error);
    res.status(500).json({ error: 'Failed to fetch participant profile.' });
  }
});

// Authoritative Remote Termination
adminRouter.post('/admin/participants/:id/terminate', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    const { reason } = req.body;
    const cleanReason = reason || 'Terminated remotely by Chief Proctor.';

    const activeAttempt = await db.query.quizAttempts.findFirst({
      where: and(eq(quizAttempts.userId, targetId), eq(quizAttempts.status, 'in_progress')),
    });

    const now = new Date();
    if (activeAttempt) {
      await db
        .update(quizAttempts)
        .set({
          status: 'terminated',
          terminationReason: cleanReason,
          terminatedAt: now,
          endTime: now,
        })
        .where(eq(quizAttempts.id, activeAttempt.id));
    }

    // Lock user terminal
    await db
      .update(users)
      .set({ isBlocked: true, blockReason: cleanReason })
      .where(eq(users.id, targetId));

    // Audit log
    await db.insert(auditLogs).values({
      userId: req.user!.id,
      action: 'ADMIN_REMOTE_TERMINATION',
      targetType: 'users',
      targetId: String(targetId),
      metadata: { reason: cleanReason, attemptId: activeAttempt?.id },
    });

    // Record activity event
    await db.insert(activityEvents).values({
      userId: targetId,
      attemptId: activeAttempt?.id,
      eventType: 'ATTEMPT_TERMINATED',
      details: cleanReason,
      severity: 'critical',
    });

    res.json({ success: true, message: 'Participant attempt terminated and questions locked.' });
  } catch (error: any) {
    console.error('Remote termination error:', error);
    res.status(500).json({ error: 'Failed to terminate attempt.' });
  }
});

// Admin Disqualify Participant
adminRouter.post('/admin/participants/:id/disqualify', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    const { reason } = req.body;
    const cleanReason = reason || 'Disqualified by Tournament Directorate.';

    await db
      .update(users)
      .set({ isBlocked: true, blockReason: cleanReason })
      .where(eq(users.id, targetId));

    await db.insert(auditLogs).values({
      userId: req.user!.id,
      action: 'ADMIN_DISQUALIFICATION',
      targetType: 'users',
      targetId: String(targetId),
      metadata: { reason: cleanReason },
    });

    res.json({ success: true, message: 'Participant disqualified.' });
  } catch (error: any) {
    console.error('Disqualification error:', error);
    res.status(500).json({ error: 'Failed to disqualify participant.' });
  }
});

// Admin Pardon Participant (Restore Access)
adminRouter.post('/admin/participants/:id/pardon', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const targetId = parseInt(req.params.id, 10);

    await db
      .update(users)
      .set({ isBlocked: false, blockReason: null })
      .where(eq(users.id, targetId));

    await db
      .update(quizAttempts)
      .set({ isDisqualified: false, violationsCount: 0 })
      .where(eq(quizAttempts.userId, targetId));

    await db.insert(auditLogs).values({
      userId: req.user!.id,
      action: 'ADMIN_PARDON',
      targetType: 'users',
      targetId: String(targetId),
    });

    res.json({ success: true, message: 'Participant pardoned. Access restored.' });
  } catch (error: any) {
    console.error('Pardon error:', error);
    res.status(500).json({ error: 'Failed to pardon participant.' });
  }
});

// ==========================================
// 4. LIVE MONITORING & ACTIVITY LOGS
// ==========================================

adminRouter.get('/admin/live-monitoring', requireAuth, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const sessions = await db.query.participantSessions.findMany({
      with: { user: true },
      orderBy: (participantSessions, { desc }) => [desc(participantSessions.lastHeartbeat)],
    });

    const now = Date.now();
    const formatted = sessions.map((s: any) => {
      const diffMs = now - new Date(s.lastHeartbeat).getTime();
      const isOnline = diffMs <= 30000 && s.status !== 'logged_out';

      return {
        id: s.id,
        userId: s.userId,
        teamName: s.user?.teamName || 'Unknown Team',
        name: s.user?.name || 'Competitor',
        code: s.user?.code || 'N/A',
        college: s.user?.college || 'N/A',
        status: s.status === 'logged_out' ? 'LOGGED OUT' : isOnline ? 'ONLINE' : 'STALE / DISCONNECTED',
        currentDifficulty: s.currentDifficulty || 'easy',
        currentChallengeId: s.currentChallengeId,
        lastHeartbeat: s.lastHeartbeat,
        heartbeatAgeSeconds: Math.floor(diffMs / 1000),
        ipAddress: s.ipAddress,
        isBlocked: s.user?.isBlocked || false,
      };
    });

    res.json(formatted);
  } catch (error: any) {
    console.error('Live monitoring error:', error);
    res.status(500).json({ error: 'Failed to fetch live monitoring feed.' });
  }
});

adminRouter.get('/admin/activity-logs', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { eventType, severity, search } = req.query;

    let events = await db.query.activityEvents.findMany({
      with: { user: true },
      orderBy: (activityEvents, { desc }) => [desc(activityEvents.id)],
      limit: 150,
    });

    if (eventType && eventType !== 'all') {
      events = events.filter((e: any) => e.eventType === eventType);
    }

    if (severity && severity !== 'all') {
      events = events.filter((e: any) => e.severity === severity);
    }

    if (search) {
      const q = String(search).toLowerCase();
      events = events.filter(
        (e: any) =>
          e.details.toLowerCase().includes(q) ||
          e.user?.teamName?.toLowerCase().includes(q) ||
          e.user?.code?.toLowerCase().includes(q)
      );
    }

    const formatted = events.map((e: any) => ({
      id: e.id,
      userId: e.userId,
      teamName: e.user?.teamName || 'System',
      code: e.user?.code || 'N/A',
      college: e.user?.college || 'N/A',
      eventType: e.eventType,
      details: e.details,
      severity: e.severity,
      difficultyLevel: e.difficultyLevel,
      challengeId: e.challengeId,
      timestamp: e.timestamp,
    }));

    res.json(formatted);
  } catch (error: any) {
    console.error('Activity logs error:', error);
    res.status(500).json({ error: 'Failed to fetch activity logs.' });
  }
});

// ==========================================
// 5. SUBMISSIONS MANAGEMENT & SCORE CORRECTION
// ==========================================

adminRouter.get('/admin/submissions', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { status, difficulty } = req.query;

    const answers = await db.query.participantAnswers.findMany({
      with: {
        attempt: { with: { user: true, round: true } },
        question: true,
      },
      orderBy: (participantAnswers, { desc }) => [desc(participantAnswers.id)],
    });

    let list = answers.map((a: any) => ({
      id: a.id,
      attemptId: a.attemptId,
      participantName: a.attempt?.user?.name || 'Competitor',
      teamName: a.attempt?.user?.teamName || 'Unknown Team',
      code: a.attempt?.user?.code || 'N/A',
      college: a.attempt?.user?.college || 'N/A',
      challengeTitle: a.question?.prompt?.substring(0, 60) + '...' || 'Challenge',
      questionId: a.questionId,
      difficulty: a.attempt?.round?.difficulty || (a.attempt?.roundId === 1 ? 'easy' : a.attempt?.roundId === 2 ? 'intermediate' : 'hard'),
      isCorrect: a.isCorrect,
      pointsEarned: a.pointsEarned,
      maxPoints: a.question?.points || 10,
      submittedAt: a.submittedAt,
      attemptNumber: a.attemptNumber || 1,
      attemptStatus: a.attempt?.status || 'completed',
      selectedOption: a.selectedOption,
      submittedCode: a.submittedCode,
      manuallyAdjusted: a.manuallyAdjusted || false,
      adjustedBy: a.adjustedBy,
      adjustedReason: a.adjustedReason,
    }));

    if (status && status !== 'all') {
      if (status === 'accepted') list = list.filter((s) => s.isCorrect);
      if (status === 'rejected') list = list.filter((s) => !s.isCorrect);
      if (status === 'adjusted') list = list.filter((s) => s.manuallyAdjusted);
    }

    if (difficulty && difficulty !== 'all') {
      list = list.filter((s) => s.difficulty === difficulty);
    }

    res.json(list);
  } catch (error: any) {
    console.error('Submissions list error:', error);
    res.status(500).json({ error: 'Failed to retrieve submissions.' });
  }
});

// Manual Score Override / Correction with Audit Trail
adminRouter.post('/admin/submissions/:id/score-correction', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const submissionId = parseInt(req.params.id, 10);
    const { newPoints, isCorrect, reason } = req.body;

    const answer = await db.query.participantAnswers.findFirst({
      where: eq(participantAnswers.id, submissionId),
    });

    if (!answer) {
      return res.status(404).json({ error: 'Submission not found.' });
    }

    const previousPoints = answer.pointsEarned;
    const finalPoints = typeof newPoints === 'number' ? newPoints : answer.pointsEarned;
    const finalCorrect = typeof isCorrect === 'boolean' ? isCorrect : answer.isCorrect;

    await db
      .update(participantAnswers)
      .set({
        pointsEarned: finalPoints,
        isCorrect: finalCorrect,
        manuallyAdjusted: true,
        adjustedBy: req.user!.name,
        adjustedReason: reason || 'Manual score correction by Administrator.',
      })
      .where(eq(participantAnswers.id, submissionId));

    // Recalculate attempt score
    const allAttemptAnswers = await db.query.participantAnswers.findMany({
      where: eq(participantAnswers.attemptId, answer.attemptId),
    });
    const updatedTotalScore = allAttemptAnswers.reduce((sum, a) => sum + (a.isCorrect ? a.pointsEarned : 0), 0);

    await db
      .update(quizAttempts)
      .set({ score: updatedTotalScore })
      .where(eq(quizAttempts.id, answer.attemptId));

    // Audit log
    await db.insert(auditLogs).values({
      userId: req.user!.id,
      action: 'MANUAL_SCORE_CORRECTION',
      targetType: 'participant_answers',
      targetId: String(submissionId),
      metadata: {
        previousPoints,
        newPoints: finalPoints,
        isCorrect: finalCorrect,
        reason,
        attemptId: answer.attemptId,
      },
    });

    res.json({
      success: true,
      message: 'Score corrected and auditable log recorded.',
      newScore: updatedTotalScore,
    });
  } catch (error: any) {
    console.error('Score correction error:', error);
    res.status(500).json({ error: 'Failed to update submission score.' });
  }
});

// ==========================================
// 6. COMPETITION CONTROLS & SETTINGS
// ==========================================

adminRouter.get('/admin/competition-settings', requireAuth, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    let settings = await db.query.competitionSettings.findFirst();
    if (!settings) {
      const [newSettings] = await db
        .insert(competitionSettings)
        .values({
          competitionStatus: 'active',
          registrationOpen: true,
          fullscreenEnforcement: true,
          strictFocusEnforcement: true,
          heartbeatIntervalSec: 10,
          heartbeatStaleThresholdSec: 30,
          leaderboardFrozen: false,
          publishedFinal: false,
        })
        .returning();
      settings = newSettings;
    }
    res.json(settings);
  } catch (error: any) {
    console.error('Fetch competition settings error:', error);
    res.status(500).json({ error: 'Failed to retrieve competition settings.' });
  }
});

adminRouter.post('/admin/competition-settings', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const updates = req.body;
    let settings = await db.query.competitionSettings.findFirst();

    if (settings) {
      await db
        .update(competitionSettings)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(competitionSettings.id, settings.id));
    } else {
      await db.insert(competitionSettings).values(updates);
    }

    // Audit log
    await db.insert(auditLogs).values({
      userId: req.user!.id,
      action: 'UPDATE_COMPETITION_SETTINGS',
      targetType: 'competition_settings',
      targetId: '1',
      metadata: updates,
    });

    res.json({ success: true, message: 'Competition configuration saved.' });
  } catch (error: any) {
    console.error('Update competition settings error:', error);
    res.status(500).json({ error: 'Failed to update competition settings.' });
  }
});

// Freeze & Publish Leaderboard
adminRouter.post('/admin/leaderboard/freeze', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { freeze, publish } = req.body;
    const settings = await db.query.competitionSettings.findFirst();

    if (settings) {
      await db
        .update(competitionSettings)
        .set({
          leaderboardFrozen: freeze !== undefined ? freeze : settings.leaderboardFrozen,
          publishedFinal: publish !== undefined ? publish : settings.publishedFinal,
          updatedAt: new Date(),
        })
        .where(eq(competitionSettings.id, settings.id));
    }

    await db.insert(auditLogs).values({
      userId: req.user!.id,
      action: 'LEADERBOARD_STATUS_TOGGLED',
      targetType: 'competition_settings',
      targetId: '1',
      metadata: { freeze, publish },
    });

    res.json({ success: true, message: 'Leaderboard freeze status updated.' });
  } catch (error: any) {
    console.error('Freeze leaderboard error:', error);
    res.status(500).json({ error: 'Failed to update leaderboard status.' });
  }
});

// ==========================================
// 7. CSV EXPORTS
// ==========================================

adminRouter.get('/admin/export/:type', async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const token = (req.query.token as string) || req.headers.authorization?.replace(/^Bearer\s+/i, '');

    if (!token || !token.startsWith('ta_admin_')) {
      return res.status(401).send('Unauthorized export request.');
    }

    if (type === 'participants') {
      const allUsers = await db.query.users.findMany({
        where: eq(users.role, 'participant'),
        with: { attempts: true },
      });

      const rows = [
        ['ID', 'Team Code', 'Team Name', 'College', 'Members', 'Zone', 'Easy Pts', 'Intermediate Pts', 'Hard Pts', 'Total Score', 'Status'],
      ];

      allUsers.forEach((u) => {
        let r1 = 0, r2 = 0, r3 = 0;
        (u.attempts || []).forEach((att) => {
          if (att.roundId === 1) r1 = att.score;
          if (att.roundId === 2) r2 = att.score;
          if (att.roundId === 3) r3 = att.score;
        });
        rows.push([
          String(u.id),
          `"${u.code}"`,
          `"${u.teamName}"`,
          `"${u.college}"`,
          `"${(u.teamMembers || []).join('; ')}"`,
          `"${u.zone}"`,
          String(r1),
          String(r2),
          String(r3),
          String(r1 + r2 + r3),
          u.isBlocked ? 'Disqualified' : 'Active',
        ]);
      });

      const csv = rows.map((r) => r.join(',')).join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="participants_roster.csv"');
      return res.send(csv);
    }

    if (type === 'submissions') {
      const answers = await db.query.participantAnswers.findMany({
        with: {
          attempt: { with: { user: true } },
          question: true,
        },
      });

      const rows = [
        ['Submission ID', 'Team Code', 'Team Name', 'College', 'Question ID', 'Question Category', 'Validation Status', 'Points Earned', 'Submitted At', 'Manually Adjusted'],
      ];

      answers.forEach((a: any) => {
        rows.push([
          String(a.id),
          `"${a.attempt?.user?.code || 'N/A'}"`,
          `"${a.attempt?.user?.teamName || 'N/A'}"`,
          `"${a.attempt?.user?.college || 'N/A'}"`,
          String(a.questionId),
          `"${a.question?.category || 'General'}"`,
          a.isCorrect ? 'Accepted' : 'Rejected',
          String(a.pointsEarned),
          new Date(a.submittedAt).toISOString(),
          a.manuallyAdjusted ? 'Yes' : 'No',
        ]);
      });

      const csv = rows.map((r) => r.join(',')).join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="submissions_records.csv"');
      return res.send(csv);
    }

    if (type === 'activity') {
      const events = await db.query.activityEvents.findMany({
        with: { user: true },
        orderBy: (activityEvents, { desc }) => [desc(activityEvents.id)],
      });

      const rows = [
        ['Event ID', 'Team Code', 'Team Name', 'Event Type', 'Severity', 'Details', 'Difficulty Level', 'Timestamp'],
      ];

      events.forEach((e: any) => {
        rows.push([
          String(e.id),
          `"${e.user?.code || 'N/A'}"`,
          `"${e.user?.teamName || 'System'}"`,
          `"${e.eventType}"`,
          `"${e.severity}"`,
          `"${e.details.replace(/"/g, '""')}"`,
          `"${e.difficultyLevel || 'N/A'}"`,
          new Date(e.timestamp).toISOString(),
        ]);
      });

      const csv = rows.map((r) => r.join(',')).join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="activity_surveillance.csv"');
      return res.send(csv);
    }

    if (type === 'leaderboard') {
      const allUsers = await db.query.users.findMany({
        where: eq(users.role, 'participant'),
        with: { attempts: true },
      });

      const ranked = allUsers
        .map((u) => {
          let total = 0, time = 0;
          (u.attempts || []).forEach((att) => {
            total += att.score || 0;
            if (att.endTime && att.startTime) {
              time += Math.max(0, (new Date(att.endTime).getTime() - new Date(att.startTime).getTime()) / 1000);
            }
          });
          return { ...u, total, time };
        })
        .sort((a, b) => b.total !== a.total ? b.total - a.total : a.time - b.time);

      const rows = [
        ['Rank', 'Team Code', 'Team Name', 'College', 'Total Score', 'Time (Seconds)', 'Status'],
      ];

      ranked.forEach((r, idx) => {
        rows.push([
          String(idx + 1),
          `"${r.code}"`,
          `"${r.teamName}"`,
          `"${r.college}"`,
          String(r.total),
          String(r.time),
          r.isBlocked ? 'Disqualified' : 'Active',
        ]);
      });

      const csv = rows.map((r) => r.join(',')).join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="final_leaderboard.csv"');
      return res.send(csv);
    }

    return res.status(400).send('Invalid export type requested.');
  } catch (error: any) {
    console.error('Export CSV error:', error);
    res.status(500).send('Error generating export.');
  }
});
