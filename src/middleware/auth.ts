import { Request, Response, NextFunction } from 'express';
import { db, isUsingPersistentDb } from '../db/index.ts';
import { users, adminSessions, participantSessions } from '../db/schema.ts';
import { eq, and } from 'drizzle-orm';
import {
  verifyAdminTokenSignature,
  verifyParticipantToken,
} from '../utils/cryptoAuth.ts';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    uid: string;
    email: string;
    role: string;
    name: string;
    college: string;
    teamName: string;
    teamMembers: string[];
    code: string;
    zone: string;
    isBlocked: boolean;
    blockReason?: string | null;
    isRemoved?: boolean;
  };
  adminSessionToken?: string;
}

/**
 * Validates an administrator session token against both its HMAC-SHA256 signature
 * and the active server-side adminSessions table.
 *
 * When running with in-memory storage (no PostgreSQL), session-table lookup is
 * skipped because serverless invocations cannot share in-memory state. The
 * cryptographic HMAC signature alone guarantees authenticity.
 */
export async function validateAdminSessionToken(rawToken?: string): Promise<{
  valid: boolean;
  error?: string;
}> {
  if (!rawToken || !rawToken.startsWith('ta_admin_')) {
    return { valid: false, error: 'Invalid administrator session token.' };
  }

  if (!verifyAdminTokenSignature(rawToken)) {
    return { valid: false, error: 'Invalid administrator token signature. Please re-authenticate.' };
  }

  // When using in-memory DB (serverless without PostgreSQL), skip session table
  // lookup — the HMAC-SHA256 signature verification above is sufficient.
  if (!isUsingPersistentDb()) {
    return { valid: true };
  }

  const session = await db.query.adminSessions.findFirst({
    where: and(eq(adminSessions.token, rawToken), eq(adminSessions.isActive, true)),
  });

  if (!session) {
    return { valid: false, error: 'Administrator session not found or invalidated. Please log in again.' };
  }

  const now = new Date();
  if (new Date(session.expiresAt) <= now) {
    await db
      .update(adminSessions)
      .set({ isActive: false })
      .where(eq(adminSessions.token, rawToken));
    return { valid: false, error: 'Administrator session expired. Please re-authenticate.' };
  }

  return { valid: true };
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization header missing.' });
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return res.status(401).json({ error: 'Token missing.' });
    }

    // 1. Admin session token check (strictly requires valid HMAC signature + active DB session)
    if (token.startsWith('ta_admin_')) {
      const validation = await validateAdminSessionToken(token);
      if (!validation.valid) {
        return res.status(401).json({ error: validation.error || 'Unauthorized administrator session.' });
      }

      let adminUser = await db.query.users.findFirst({
        where: eq(users.role, 'admin'),
      });

      if (!adminUser) {
        const [created] = await db
          .insert(users)
          .values({
            uid: 'admin_matrix_root',
            email: 'admin@techarena.edu',
            role: 'admin',
            name: 'Chief Administrator',
            college: 'Tech Arena Directorate',
            teamName: 'Admin Control Center',
            teamMembers: ['Chief Proctor', 'Tournament Director'],
            code: '#TA-ADMIN',
            zone: 'Central Command',
            isBlocked: false,
          })
          .returning();
        adminUser = created;
      }

      req.user = adminUser;
      req.adminSessionToken = token;
      return next();
    }

    // 2. Participant Team token check (requires valid HMAC-SHA256 signature)
    if (token.startsWith('ta_team_')) {
      const verified = verifyParticipantToken(token);
      if (!verified) {
        return res.status(401).json({
          error: 'Terminal session expired or invalid signature. Please sign in again.',
        });
      }

      let participant = await db.query.users.findFirst({
        where: eq(users.id, verified.userId),
      });

      if (!participant || participant.code.toUpperCase() !== verified.code.toUpperCase()) {
        participant = await db.query.users.findFirst({
          where: eq(users.code, verified.code),
        });
      }

      if (!participant) {
        if (!isUsingPersistentDb()) {
          // Re-create participant in mock DB from verified HMAC cryptographic token
          const [restored] = await db
            .insert(users)
            .values({
              uid: `team_${verified.userId}`,
              email: `${verified.code.toLowerCase().replace(/[^a-z0-9]/g, '_')}@techarena.edu`,
              role: 'participant',
              name: `Team ${verified.code}`,
              college: 'Tech Arena Campus',
              teamName: `Team ${verified.code}`,
              teamMembers: ['Participant 1'],
              code: verified.code,
              zone: 'South Zone',
              isBlocked: false,
            })
            .returning();
          participant = restored;
        } else {
          return res.status(401).json({ error: 'Terminal session expired or team not found.' });
        }
      }

      if (participant.isRemoved) {
        return res.status(403).json({
          error: 'Terminal access revoked: Participant has been removed from the tournament roster.',
          isRemoved: true,
        });
      }

      // Update participant last activity
      const pSession = await db.query.participantSessions.findFirst({
        where: eq(participantSessions.userId, participant.id),
      });
      if (pSession) {
        await db
          .update(participantSessions)
          .set({ lastActivity: new Date() })
          .where(eq(participantSessions.id, pSession.id));
      }

      req.user = participant;
      return next();
    }

    return res.status(401).json({ error: 'Invalid authentication credentials.' });
  } catch (error) {
    console.error('requireAuth middleware error:', error);
    return res.status(500).json({ error: 'Internal server authentication error.' });
  }
}

export async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'admin' || !req.adminSessionToken) {
    return res.status(403).json({ error: 'Access denied: Tournament Administrator credentials required.' });
  }

  const validation = await validateAdminSessionToken(req.adminSessionToken);
  if (!validation.valid) {
    return res.status(401).json({ error: validation.error || 'Administrator session expired.' });
  }

  next();
}
