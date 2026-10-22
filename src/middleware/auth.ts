import { Request, Response, NextFunction } from 'express';
import { db } from '../db/index.ts';
import { users, adminSessions, participantSessions } from '../db/schema.ts';
import { eq, and } from 'drizzle-orm';

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
  };
  adminSessionToken?: string;
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

    // 1. Admin session token check
    if (token.startsWith('ta_admin_')) {
      // Check admin session validity if it is a session token
      const session = await db.query.adminSessions.findFirst({
        where: and(eq(adminSessions.token, token), eq(adminSessions.isActive, true)),
      });

      const now = new Date();
      if (session) {
        if (new Date(session.expiresAt) <= now) {
          await db
            .update(adminSessions)
            .set({ isActive: false })
            .where(eq(adminSessions.token, token));
          return res.status(401).json({ error: 'Administrator session expired. Please re-authenticate.' });
        }
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

    // 2. Participant Team token format: ta_team_#TA-XXXX or ta_team_TA-XXXX
    if (token.startsWith('ta_team_')) {
      const codePart = token.replace('ta_team_', '').trim();
      let participant = await db.query.users.findFirst({
        where: eq(users.code, codePart),
      });

      if (!participant && !codePart.startsWith('#')) {
        participant = await db.query.users.findFirst({
          where: eq(users.code, `#${codePart}`),
        });
      }

      if (!participant) {
        return res.status(401).json({ error: 'Terminal session expired or team not found.' });
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

    // Fallback: try finding user by uid or code
    const anyUser = await db.query.users.findFirst({
      where: eq(users.uid, token),
    });

    if (anyUser) {
      req.user = anyUser;
      return next();
    }

    return res.status(401).json({ error: 'Invalid authentication credentials.' });
  } catch (error) {
    console.error('requireAuth middleware error:', error);
    return res.status(500).json({ error: 'Internal server authentication error.' });
  }
}

export async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied: Tournament Administrator credentials required.' });
  }

  // Ensure admin session token is valid and not logged out
  if (req.adminSessionToken) {
    const session = await db.query.adminSessions.findFirst({
      where: and(eq(adminSessions.token, req.adminSessionToken), eq(adminSessions.isActive, true)),
    });

    if (session && new Date(session.expiresAt) <= new Date()) {
      return res.status(401).json({ error: 'Administrator session expired. Please re-authenticate.' });
    }
  }

  next();
}
