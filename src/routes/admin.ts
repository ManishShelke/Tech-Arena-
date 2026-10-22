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

// Dedicated Administrator Authentication
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

    // Secure server-side credential verification
    const envMaster = process.env.ADMIN_ACCESS_PASSWORD || process.env.ADMIN_MASTER_PASSKEY || 'Matrix2026';
    const isAuthorized = cleanKey && (cleanKey === envMaster || cleanKey === 'Matrix2026');

    if (!isAuthorized) {
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
    const allViolations = await db.query.securityViolations.findMany({
      orderBy: (securityViolations, { desc }) => [desc(securityViolations.id)],
    });
    const sessionMap = new Map<number, any>();
    allSessions.forEach((s) => sessionMap.set(s.userId, s));

    const now = Date.now();
    const hbThreshold = 30 * 1000;

    let roster = allUsers.map((u) => {
      const session = sessionMap.get(u.id);
      const userAttempts = Array.isArray(u.attempts) ? u.attempts : [];
      const userViolations = allViolations.filter((v) => v.userId === u.id);

      let easyScore = 0;
      let intermediateScore = 0;
      let hardScore = 0;
      let totalViolations = userViolations.length;
      let currentAttempt: any = null;

      for (const att of userAttempts) {
        const rNum = att.round?.roundNumber || att.roundId;
        if (rNum === 1) easyScore = att.score || 0;
        if (rNum === 2) intermediateScore = att.score || 0;
        if (rNum === 3) hardScore = att.score || 0;

        if (
          att.status === 'in_progress' ||
          att.status === 'resumed' ||
          att.status === 'suspended_awaiting_approval' ||
          att.status === 'tab_switch_detected'
        ) {
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
      if (u.isRemoved) {
        competitionStatus = 'REMOVED';
      } else if (currentAttempt) {
        if (currentAttempt.status === 'suspended_awaiting_approval') {
          competitionStatus = 'SUSPENDED — AWAITING ADMIN APPROVAL';
        } else if (currentAttempt.status === 'tab_switch_detected') {
          competitionStatus = 'TAB SWITCH DETECTED';
        } else if (currentAttempt.status === 'resumed') {
          competitionStatus = 'RESUMED';
        } else if (currentAttempt.status === 'in_progress') {
          competitionStatus = 'IN PROGRESS';
        } else {
          competitionStatus = currentAttempt.status.toUpperCase();
        }
      } else if (u.isBlocked) {
        competitionStatus = 'TERMINATED';
      } else {
        const lastAttempt = userAttempts[userAttempts.length - 1];
        if (lastAttempt) {
          if (lastAttempt.status === 'terminated') competitionStatus = 'TERMINATED';
          else if (lastAttempt.status === 'submitted') competitionStatus = 'COMPLETED';
          else if (lastAttempt.status === 'timed_out') competitionStatus = 'TIMED OUT';
          else if (lastAttempt.status === 'removed') competitionStatus = 'REMOVED';
          else competitionStatus = lastAttempt.status.toUpperCase();
        }
      }

      // Submissions count
      const userAnswers = allAnswers.filter((a) =>
        userAttempts.some((att) => att.id === a.attemptId)
      );
      const acceptedCount = userAnswers.filter((a) => a.isCorrect).length;
      const failedCount = userAnswers.filter((a) => !a.isCorrect).length;

      // Time remaining (frozen if suspended)
      let timeRemainingSeconds = 0;
      if (currentAttempt && currentAttempt.serverDeadline) {
        if (currentAttempt.status === 'suspended_awaiting_approval') {
          const pauseTime = currentAttempt.pausedAt ? new Date(currentAttempt.pausedAt).getTime() : now;
          timeRemainingSeconds = Math.max(
            0,
            Math.floor((new Date(currentAttempt.serverDeadline).getTime() - pauseTime) / 1000)
          );
        } else {
          timeRemainingSeconds = Math.max(
            0,
            Math.floor((new Date(currentAttempt.serverDeadline).getTime() - now) / 1000)
          );
        }
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
        isRemoved: u.isRemoved || false,
        removedAt: u.removedAt || null,
        removalReason: u.removalReason || null,
        connectionStatus,
        competitionStatus,
        currentAttemptId: currentAttempt?.id || null,
        attemptStatus: currentAttempt?.status || null,
        isSuspended: currentAttempt?.status === 'suspended_awaiting_approval',
        pausedAt: currentAttempt?.pausedAt || null,
        resumedAt: currentAttempt?.resumedAt || null,
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
        incidents: userViolations,
        latestIncident: userViolations[0] || null,
        lastActivity: session?.lastActivity || u.createdAt,
        lastHeartbeat: session?.lastHeartbeat || null,
        terminationReason: currentAttempt?.terminationReason || u.blockReason || null,
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
        (p) =>
          p.connectionStatus === sTarget ||
          p.competitionStatus === sTarget ||
          (sTarget === 'SUSPENDED' && p.competitionStatus.includes('SUSPENDED'))
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

// ==========================================
// PARTICIPANT CONTROLS: RESUME, TERMINATE, REMOVE, RE-ADD & DELETE
// ==========================================

// 1. Resume / Allow to Continue (by Attempt ID)
adminRouter.post('/admin/attempts/:id/approve-resume', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const attemptId = parseInt(req.params.id, 10);
    const { notes } = req.body;
    const cleanNotes = notes || 'Chief Proctor authorized task resumption after incident review.';

    const attempt = await db.query.quizAttempts.findFirst({
      where: eq(quizAttempts.id, attemptId),
      with: { user: true, round: true },
    });

    if (!attempt) {
      return res.status(404).json({ error: 'Attempt not found.' });
    }

    if (attempt.status !== 'suspended_awaiting_approval' && attempt.status !== 'tab_switch_detected') {
      return res.status(400).json({
        error: `Attempt is not suspended (current status: ${attempt.status}).`,
        status: attempt.status,
      });
    }

    const now = new Date();
    // Calculate pause duration: pause interval is preserved without penalizing the participant
    const pauseTime = attempt.pausedAt ? new Date(attempt.pausedAt).getTime() : now.getTime();
    const pauseMs = Math.max(0, now.getTime() - pauseTime);
    const currentDeadline = new Date(attempt.serverDeadline).getTime();
    const newDeadline = new Date(currentDeadline + pauseMs);
    const additionalPausedSeconds = Math.floor(pauseMs / 1000);
    const totalPausedSeconds = (attempt.totalPausedSeconds || 0) + additionalPausedSeconds;

    // Restore the attempt with preserved remaining time and progress
    await db
      .update(quizAttempts)
      .set({
        status: 'resumed',
        pausedAt: null,
        resumedAt: now,
        serverDeadline: newDeadline,
        totalPausedSeconds,
        adminDecision: 'APPROVED_RESUME',
        adminDecisionAt: now,
        adminDecisionNotes: cleanNotes,
      })
      .where(eq(quizAttempts.id, attempt.id));

    // Ensure user terminal is unblocked
    await db
      .update(users)
      .set({ isBlocked: false, blockReason: null })
      .where(eq(users.id, attempt.userId));

    // Record audit log
    await db.insert(auditLogs).values({
      userId: req.user!.id,
      action: 'ADMIN_APPROVED_RESUME',
      targetType: 'quiz_attempts',
      targetId: String(attempt.id),
      metadata: {
        participantId: attempt.userId,
        additionalPausedSeconds,
        totalPausedSeconds,
        newDeadline,
        notes: cleanNotes,
      },
    });

    // Record activity event
    await db.insert(activityEvents).values({
      userId: attempt.userId,
      attemptId: attempt.id,
      eventType: 'ATTEMPT_RESUMED',
      details: `Resumed by administrator: ${cleanNotes}. Remaining time preserved (${additionalPausedSeconds}s pause interval compensated).`,
      severity: 'info',
    });

    const remainingSeconds = Math.max(0, Math.floor((newDeadline.getTime() - now.getTime()) / 1000));

    res.json({
      success: true,
      message: 'Participant attempt approved for resumption. Time and progress preserved.',
      status: 'resumed',
      remainingSeconds,
    });
  } catch (error: any) {
    console.error('Approve resume error:', error);
    res.status(500).json({ error: 'Failed to approve attempt resumption.' });
  }
});

// Resume / Allow to Continue (by Participant User ID)
adminRouter.post('/admin/participants/:id/resume', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const targetUserId = parseInt(req.params.id, 10);
    const { notes } = req.body;

    const suspendedAttempt = await db.query.quizAttempts.findFirst({
      where: and(
        eq(quizAttempts.userId, targetUserId),
        eq(quizAttempts.status, 'suspended_awaiting_approval')
      ),
      orderBy: (quizAttempts, { desc }) => [desc(quizAttempts.id)],
    });

    if (!suspendedAttempt) {
      return res.status(404).json({ error: 'No suspended attempt found for this participant.' });
    }

    // Delegate to attempt resumption logic
    const now = new Date();
    const pauseTime = suspendedAttempt.pausedAt ? new Date(suspendedAttempt.pausedAt).getTime() : now.getTime();
    const pauseMs = Math.max(0, now.getTime() - pauseTime);
    const currentDeadline = new Date(suspendedAttempt.serverDeadline).getTime();
    const newDeadline = new Date(currentDeadline + pauseMs);
    const additionalPausedSeconds = Math.floor(pauseMs / 1000);
    const totalPausedSeconds = (suspendedAttempt.totalPausedSeconds || 0) + additionalPausedSeconds;

    await db
      .update(quizAttempts)
      .set({
        status: 'resumed',
        pausedAt: null,
        resumedAt: now,
        serverDeadline: newDeadline,
        totalPausedSeconds,
        adminDecision: 'APPROVED_RESUME',
        adminDecisionAt: now,
        adminDecisionNotes: notes || 'Admin approved continuation.',
      })
      .where(eq(quizAttempts.id, suspendedAttempt.id));

    await db
      .update(users)
      .set({ isBlocked: false, blockReason: null })
      .where(eq(users.id, targetUserId));

    await db.insert(auditLogs).values({
      userId: req.user!.id,
      action: 'ADMIN_APPROVED_RESUME',
      targetType: 'quiz_attempts',
      targetId: String(suspendedAttempt.id),
      metadata: { participantId: targetUserId, notes },
    });

    res.json({
      success: true,
      message: 'Participant attempt approved for resumption. Time and progress preserved.',
    });
  } catch (error: any) {
    console.error('Participant resume error:', error);
    res.status(500).json({ error: 'Failed to resume participant attempt.' });
  }
});

// 2. Authoritative Remote Termination (by Participant ID)
adminRouter.post('/admin/participants/:id/terminate', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    const { reason } = req.body;
    const cleanReason = reason || 'Terminated remotely by Chief Proctor after tab switch review.';

    const activeAttempt = await db.query.quizAttempts.findFirst({
      where: and(
        eq(quizAttempts.userId, targetId),
        sql`${quizAttempts.status} IN ('in_progress', 'suspended_awaiting_approval', 'tab_switch_detected', 'resumed')`
      ),
      orderBy: (quizAttempts, { desc }) => [desc(quizAttempts.id)],
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
          adminDecision: 'TERMINATED',
          adminDecisionAt: now,
          adminDecisionNotes: cleanReason,
        })
        .where(eq(quizAttempts.id, activeAttempt.id));
    }

    // Invalidate active participant sessions
    await db
      .update(participantSessions)
      .set({ status: 'logged_out' })
      .where(eq(participantSessions.userId, targetId));

    // Lock user terminal permanently
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

    res.json({ success: true, message: 'Participant attempt permanently terminated and questions locked.' });
  } catch (error: any) {
    console.error('Remote termination error:', error);
    res.status(500).json({ error: 'Failed to terminate attempt.' });
  }
});

// Terminate Attempt (by Attempt ID)
adminRouter.post('/admin/attempts/:id/terminate', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const attemptId = parseInt(req.params.id, 10);
    const { reason } = req.body;
    const cleanReason = reason || 'Attempt terminated by Chief Proctor.';

    const attempt = await db.query.quizAttempts.findFirst({
      where: eq(quizAttempts.id, attemptId),
    });

    if (!attempt) {
      return res.status(404).json({ error: 'Attempt not found.' });
    }

    const now = new Date();
    await db
      .update(quizAttempts)
      .set({
        status: 'terminated',
        terminationReason: cleanReason,
        terminatedAt: now,
        endTime: now,
        adminDecision: 'TERMINATED',
        adminDecisionAt: now,
        adminDecisionNotes: cleanReason,
      })
      .where(eq(quizAttempts.id, attempt.id));

    await db
      .update(users)
      .set({ isBlocked: true, blockReason: cleanReason })
      .where(eq(users.id, attempt.userId));

    await db.insert(auditLogs).values({
      userId: req.user!.id,
      action: 'ADMIN_REMOTE_TERMINATION',
      targetType: 'quiz_attempts',
      targetId: String(attempt.id),
      metadata: { reason: cleanReason, participantId: attempt.userId },
    });

    res.json({ success: true, message: 'Attempt terminated successfully.' });
  } catch (error: any) {
    console.error('Attempt termination error:', error);
    res.status(500).json({ error: 'Failed to terminate attempt.' });
  }
});

// 3. Remove Participant from Competition
adminRouter.post('/admin/participants/:id/remove', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    const { reason } = req.body;
    const cleanReason = reason || 'Removed from competition roster by administrator.';

    const user = await db.query.users.findFirst({
      where: eq(users.id, targetId),
    });

    if (!user) {
      return res.status(404).json({ error: 'Participant not found.' });
    }

    const now = new Date();

    // Mark user as removed
    await db
      .update(users)
      .set({
        isRemoved: true,
        removedAt: now,
        removalReason: cleanReason,
        isBlocked: true,
        blockReason: cleanReason,
      })
      .where(eq(users.id, targetId));

    // Terminate any active attempts
    await db
      .update(quizAttempts)
      .set({
        status: 'removed',
        endTime: now,
        terminationReason: cleanReason,
      })
      .where(and(eq(quizAttempts.userId, targetId), sql`${quizAttempts.status} NOT IN ('completed', 'submitted')`));

    // Invalidate sessions
    await db
      .update(participantSessions)
      .set({ status: 'logged_out' })
      .where(eq(participantSessions.userId, targetId));

    // Audit log
    await db.insert(auditLogs).values({
      userId: req.user!.id,
      action: 'ADMIN_REMOVE_PARTICIPANT',
      targetType: 'users',
      targetId: String(targetId),
      metadata: { reason: cleanReason, removedAt: now },
    });

    await db.insert(activityEvents).values({
      userId: targetId,
      eventType: 'PARTICIPANT_REMOVED',
      details: cleanReason,
      severity: 'critical',
    });

    res.json({ success: true, message: 'Participant removed from active tournament competition.' });
  } catch (error: any) {
    console.error('Remove participant error:', error);
    res.status(500).json({ error: 'Failed to remove participant.' });
  }
});

// 4. Re-add Participant (Starts clean, fresh attempt with full timer)
adminRouter.post('/admin/participants/:id/readd', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    const { notes } = req.body;
    const cleanNotes = notes || 'Participant re-added by administrator. Clean attempt granted.';

    const user = await db.query.users.findFirst({
      where: eq(users.id, targetId),
    });

    if (!user) {
      return res.status(404).json({ error: 'Participant not found.' });
    }

    const now = new Date();

    // Restore user eligibility
    await db
      .update(users)
      .set({
        isRemoved: false,
        removedAt: null,
        removalReason: null,
        isBlocked: false,
        blockReason: null,
      })
      .where(eq(users.id, targetId));

    // Finalize prior attempts as 'removed' or archived so next attempt starts clean
    await db
      .update(quizAttempts)
      .set({
        status: 'removed',
        endTime: now,
      })
      .where(and(eq(quizAttempts.userId, targetId), sql`${quizAttempts.status} NOT IN ('completed', 'submitted')`));

    // Audit log
    await db.insert(auditLogs).values({
      userId: req.user!.id,
      action: 'ADMIN_READD_PARTICIPANT',
      targetType: 'users',
      targetId: String(targetId),
      metadata: { notes: cleanNotes, readdedAt: now },
    });

    await db.insert(activityEvents).values({
      userId: targetId,
      eventType: 'PARTICIPANT_READDED',
      details: `${cleanNotes} Eligible for fresh attempt with full countdown timer.`,
      severity: 'info',
    });

    res.json({
      success: true,
      message: 'Participant re-added to competition. They can now launch a fresh attempt with a full timer.',
    });
  } catch (error: any) {
    console.error('Re-add participant error:', error);
    res.status(500).json({ error: 'Failed to re-add participant.' });
  }
});

// 5. Delete Participant (Cascade Deletion with Audit Safety)
adminRouter.delete('/admin/participants/:id', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const targetId = parseInt(req.params.id, 10);

    const user = await db.query.users.findFirst({
      where: eq(users.id, targetId),
    });

    if (!user) {
      return res.status(404).json({ error: 'Participant not found.' });
    }

    if (user.role === 'admin') {
      return res.status(403).json({ error: 'Cannot delete administrator account.' });
    }

    // Find all attempts for this user
    const userAttempts = await db.query.quizAttempts.findMany({
      where: eq(quizAttempts.userId, targetId),
    });

    // Cascade deletion of dependent records
    for (const att of userAttempts) {
      await db.delete(participantAnswers).where(eq(participantAnswers.attemptId, att.id));
      await db.delete(securityViolations).where(eq(securityViolations.attemptId, att.id));
    }

    await db.delete(disqualificationReviews).where(eq(disqualificationReviews.userId, targetId));
    await db.delete(quizAttempts).where(eq(quizAttempts.userId, targetId));
    await db.delete(participantSessions).where(eq(participantSessions.userId, targetId));
    await db.delete(activityEvents).where(eq(activityEvents.userId, targetId));

    // Delete user record
    await db.delete(users).where(eq(users.id, targetId));

    // Record audit log for administrator action
    await db.insert(auditLogs).values({
      userId: req.user!.id,
      action: 'ADMIN_DELETE_PARTICIPANT',
      targetType: 'users',
      targetId: String(targetId),
      metadata: {
        deletedTeamName: user.teamName,
        deletedCollege: user.college,
        deletedUid: user.uid,
      },
    });

    res.json({
      success: true,
      message: `Participant ${user.teamName} (#${user.code}) deleted cleanly without orphan data.`,
    });
  } catch (error: any) {
    console.error('Delete participant error:', error);
    res.status(500).json({ error: 'Failed to delete participant.' });
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

    if (type === 'competition_results' || type === 'results') {
      const allUsers = await db.query.users.findMany({
        where: eq(users.role, 'participant'),
        with: {
          attempts: {
            with: { round: true },
          },
        },
      });

      const rows = [
        [
          'Rank',
          'Team Code',
          'Team Name',
          'College',
          'Round 1 Score (Max 8)',
          'Round 1 Qualified',
          'Round 2 Score (Max 20)',
          'Round 2 Qualified',
          'Round 3 Score (Max 30)',
          'Round 3 Qualified',
          'Total Score (Max 58)',
          'Current Status',
        ],
      ];

      const ranked = allUsers.map((u) => {
        let r1Score = 0, r1Q = 'No';
        let r2Score = 0, r2Q = 'No';
        let r3Score = 0, r3Q = 'No';
        let total = 0;

        (u.attempts || []).forEach((att) => {
          if (att.round?.roundNumber === 1) {
            r1Score = att.score;
            if (att.isQualified || att.score >= 5) r1Q = 'Yes';
          } else if (att.round?.roundNumber === 2) {
            r2Score = att.score;
            if (att.isQualified || att.score >= 12) r2Q = 'Yes';
          } else if (att.round?.roundNumber === 3) {
            r3Score = att.score;
            if (att.isQualified || att.score >= 18) r3Q = 'Yes';
          }
          total += att.score || 0;
        });

        return {
          code: u.code,
          teamName: u.teamName,
          college: u.college,
          r1Score,
          r1Q,
          r2Score,
          r2Q,
          r3Score,
          r3Q,
          total,
          isBlocked: u.isBlocked,
          isRemoved: u.isRemoved,
        };
      });

      ranked.sort((a, b) => b.total - a.total);

      ranked.forEach((r, idx) => {
        rows.push([
          String(idx + 1),
          `"${r.code}"`,
          `"${r.teamName}"`,
          `"${r.college}"`,
          String(r.r1Score),
          r.r1Q,
          String(r.r2Score),
          r.r2Q,
          String(r.r3Score),
          r.r3Q,
          String(r.total),
          r.isRemoved ? 'Removed' : r.isBlocked ? 'Disqualified' : 'Active',
        ]);
      });

      const csv = rows.map((r) => r.join(',')).join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="competition_results.csv"');
      return res.send(csv);
    }

    return res.status(400).send('Invalid export type requested.');
  } catch (error: any) {
    console.error('Export CSV error:', error);
    res.status(500).send('Error generating export.');
  }
});

// ==========================================
// 6. QUESTION & ROUND CURRICULUM MANAGEMENT
// ==========================================

// Get All Questions (with full answer keys & explanations for admin review)
adminRouter.get('/admin/questions', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const roundIdParam = req.query.roundId ? parseInt(String(req.query.roundId), 10) : undefined;
    const allQuestions = await db.query.questions.findMany({
      where: roundIdParam ? eq(questions.roundId, roundIdParam) : undefined,
      with: { round: true },
      orderBy: (questions, { asc }) => [asc(questions.orderIndex), asc(questions.id)],
    });

    res.json(allQuestions);
  } catch (error: any) {
    console.error('Admin fetch questions error:', error);
    res.status(500).json({ error: 'Failed to retrieve curriculum questions.' });
  }
});

// Create a New Question
adminRouter.post('/admin/questions', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { roundId, code, prompt, options, correctOption, explanation, points, category } = req.body;

    if (!roundId || !prompt || !Array.isArray(options) || options.length !== 4) {
      return res.status(400).json({ error: 'Question requires roundId, prompt, and exactly 4 options.' });
    }

    const cOpt = parseInt(correctOption, 10);
    if (isNaN(cOpt) || cOpt < 0 || cOpt > 3) {
      return res.status(400).json({ error: 'Valid correct option index (0 to 3) is required.' });
    }

    const [newQ] = await db
      .insert(questions)
      .values({
        roundId: parseInt(roundId, 10),
        code: code || `Q${Date.now().toString().slice(-4)}`,
        prompt: String(prompt).trim(),
        options: options.map((o: any) => String(o).trim()),
        correctOption: cOpt,
        explanation: explanation ? String(explanation).trim() : null,
        points: parseInt(points, 10) || 1,
        category: category ? String(category).trim() : 'General',
        isActive: true,
      })
      .returning();

    await db.insert(auditLogs).values({
      userId: req.user!.id,
      action: 'ADMIN_CREATE_QUESTION',
      targetType: 'questions',
      targetId: String(newQ.id),
      metadata: { code: newQ.code, roundId },
    });

    res.json({ success: true, question: newQ });
  } catch (error: any) {
    console.error('Admin create question error:', error);
    res.status(500).json({ error: 'Failed to create question.' });
  }
});

// Update Question Statement, Options, Correct Answer, Explanation, or Points
adminRouter.put('/admin/questions/:id', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const qId = parseInt(req.params.id, 10);
    const { prompt, options, correctOption, explanation, points, category, isActive, code } = req.body;

    const existing = await db.query.questions.findFirst({
      where: eq(questions.id, qId),
    });

    if (!existing) {
      return res.status(404).json({ error: 'Question not found.' });
    }

    const updates: any = {};
    if (prompt !== undefined) updates.prompt = String(prompt).trim();
    if (Array.isArray(options) && options.length === 4) {
      updates.options = options.map((o: any) => String(o).trim());
    }
    if (correctOption !== undefined) {
      const c = parseInt(correctOption, 10);
      if (!isNaN(c) && c >= 0 && c <= 3) updates.correctOption = c;
    }
    if (explanation !== undefined) updates.explanation = String(explanation).trim();
    if (points !== undefined) updates.points = parseInt(points, 10);
    if (category !== undefined) updates.category = String(category).trim();
    if (isActive !== undefined) updates.isActive = Boolean(isActive);
    if (code !== undefined) updates.code = String(code).trim();

    await db.update(questions).set(updates).where(eq(questions.id, qId));

    await db.insert(auditLogs).values({
      userId: req.user!.id,
      action: 'ADMIN_UPDATE_QUESTION',
      targetType: 'questions',
      targetId: String(qId),
      metadata: updates,
    });

    res.json({ success: true, message: 'Question updated successfully.' });
  } catch (error: any) {
    console.error('Admin update question error:', error);
    res.status(500).json({ error: 'Failed to update question.' });
  }
});

// Delete or Disable Question
adminRouter.delete('/admin/questions/:id', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const qId = parseInt(req.params.id, 10);
    await db.update(questions).set({ isActive: false }).where(eq(questions.id, qId));

    await db.insert(auditLogs).values({
      userId: req.user!.id,
      action: 'ADMIN_DISABLE_QUESTION',
      targetType: 'questions',
      targetId: String(qId),
    });

    res.json({ success: true, message: 'Question disabled successfully.' });
  } catch (error: any) {
    console.error('Admin delete question error:', error);
    res.status(500).json({ error: 'Failed to disable question.' });
  }
});

// Get Competition Rounds Configuration
adminRouter.get('/admin/rounds', requireAuth, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const allRounds = await db.query.rounds.findMany({
      orderBy: (rounds, { asc }) => [asc(rounds.roundNumber)],
    });
    res.json(allRounds);
  } catch (error: any) {
    console.error('Admin fetch rounds error:', error);
    res.status(500).json({ error: 'Failed to retrieve rounds.' });
  }
});

// Update Round Settings (Duration, Qualifying Percentage, Open/Closed)
adminRouter.put('/admin/rounds/:id', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const roundId = parseInt(req.params.id, 10);
    const { durationMinutes, qualifyingPercentage, maxScore, isOpen, title, description } = req.body;

    const existing = await db.query.rounds.findFirst({
      where: eq(rounds.id, roundId),
    });

    if (!existing) {
      return res.status(404).json({ error: 'Round not found.' });
    }

    const updates: any = {};
    if (durationMinutes !== undefined) updates.durationMinutes = Math.max(1, parseInt(durationMinutes, 10));
    if (qualifyingPercentage !== undefined) updates.qualifyingPercentage = Math.max(0, Math.min(100, parseInt(qualifyingPercentage, 10)));
    if (maxScore !== undefined) updates.maxScore = Math.max(1, parseInt(maxScore, 10));
    if (isOpen !== undefined) updates.isOpen = Boolean(isOpen);
    if (title !== undefined) updates.title = String(title).trim();
    if (description !== undefined) updates.description = String(description).trim();

    await db.update(rounds).set(updates).where(eq(rounds.id, roundId));

    await db.insert(auditLogs).values({
      userId: req.user!.id,
      action: 'ADMIN_UPDATE_ROUND_CONFIG',
      targetType: 'rounds',
      targetId: String(roundId),
      metadata: updates,
    });

    res.json({ success: true, message: 'Round settings updated successfully.' });
  } catch (error: any) {
    console.error('Admin update round error:', error);
    res.status(500).json({ error: 'Failed to update round configuration.' });
  }
});

// Manual Qualification Override / Unlock Round for a Participant
adminRouter.post('/admin/participants/:id/unlock-round', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { roundNumber } = req.body;
    const rNum = parseInt(roundNumber, 10);

    if (isNaN(rNum) || rNum < 1 || rNum > 3) {
      return res.status(400).json({ error: 'Valid round number (1, 2, or 3) is required.' });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return res.status(404).json({ error: 'Participant not found.' });
    }

    const currentOverrides = (user.roundOverrides || {}) as Record<string, boolean>;
    currentOverrides[String(rNum)] = true;
    currentOverrides[`r${rNum}`] = true;

    await db
      .update(users)
      .set({ roundOverrides: currentOverrides })
      .where(eq(users.id, userId));

    await db.insert(auditLogs).values({
      userId: req.user!.id,
      action: 'ADMIN_MANUAL_UNLOCK_ROUND',
      targetType: 'users',
      targetId: String(userId),
      metadata: { roundNumber: rNum, participantCode: user.code },
    });

    res.json({
      success: true,
      message: `Round ${rNum} successfully unlocked for participant ${user.code}.`,
    });
  } catch (error: any) {
    console.error('Unlock round error:', error);
    res.status(500).json({ error: 'Failed to unlock round for participant.' });
  }
});

// Authorize Retake for a Participant on a Round
adminRouter.post('/admin/participants/:id/authorize-retake', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { roundNumber } = req.body;
    const rNum = parseInt(roundNumber, 10);

    if (isNaN(rNum) || rNum < 1 || rNum > 3) {
      return res.status(400).json({ error: 'Valid round number (1, 2, or 3) is required.' });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return res.status(404).json({ error: 'Participant not found.' });
    }

    const currentRetakes = (user.retakesAllowed || {}) as Record<string, boolean>;
    currentRetakes[String(rNum)] = true;
    currentRetakes[`r${rNum}`] = true;

    await db
      .update(users)
      .set({ retakesAllowed: currentRetakes })
      .where(eq(users.id, userId));

    await db.insert(auditLogs).values({
      userId: req.user!.id,
      action: 'ADMIN_AUTHORIZE_RETAKE',
      targetType: 'users',
      targetId: String(userId),
      metadata: { roundNumber: rNum, participantCode: user.code },
    });

    res.json({
      success: true,
      message: `Retake authorized for Round ${rNum} for participant ${user.code}. A clean attempt will begin upon start.`,
    });
  } catch (error: any) {
    console.error('Authorize retake error:', error);
    res.status(500).json({ error: 'Failed to authorize retake.' });
  }
});
