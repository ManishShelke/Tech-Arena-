import * as dotenv from 'dotenv';
dotenv.config();

import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.ts';

const { Pool } = pg;

export type DBType = any;

// High-fidelity in-memory storage fallback to ensure immediate reliability in ephemeral container
class InMemoryStore {
  users: any[] = [];
  events: any[] = [];
  rounds: any[] = [];
  questions: any[] = [];
  quizAttempts: any[] = [];
  participantAnswers: any[] = [];
  securityViolations: any[] = [];
  disqualificationReviews: any[] = [];
  auditLogs: any[] = [];
  adminSessions: any[] = [];
  participantSessions: any[] = [];
  activityEvents: any[] = [];
  competitionSettings: any[] = [];

  private idCounters: Record<string, number> = {
    users: 1,
    events: 1,
    rounds: 1,
    questions: 1,
    quizAttempts: 1,
    participantAnswers: 1,
    securityViolations: 1,
    disqualificationReviews: 1,
    auditLogs: 1,
    adminSessions: 1,
    participantSessions: 1,
    activityEvents: 1,
    competitionSettings: 1,
  };

  nextId(table: string) {
    if (!this.idCounters[table]) this.idCounters[table] = 1;
    const next = this.idCounters[table]++;
    return next;
  }
}

export const inMemory = new InMemoryStore();

function extractConditions(clause: any): Array<{ col: string; val: any }> {
  if (!clause) return [];
  const results: Array<{ col: string; val: any }> = [];
  const chunks = clause.queryChunks || (Array.isArray(clause) ? clause : [clause]);

  for (let i = 0; i < chunks.length; i++) {
    const ch = chunks[i];
    if (!ch) continue;

    if (ch.queryChunks && Array.isArray(ch.queryChunks)) {
      results.push(...extractConditions(ch));
      continue;
    }

    if (ch.name && typeof ch.name === 'string') {
      const colName = ch.name;
      for (let j = i + 1; j < chunks.length; j++) {
        const nextCh = chunks[j];
        if (nextCh?.value !== undefined && (nextCh.constructor?.name === 'Param' || 'encoder' in nextCh)) {
          results.push({ col: colName, val: nextCh.value });
          i = j;
          break;
        }
      }
    }
  }

  return results;
}

function toCamelCase(col: string): string {
  return col.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function extractFieldAndVal(whereClause: any): ((item: any) => boolean) | null {
  if (!whereClause) return null;
  if (typeof whereClause === 'function') return whereClause;

  const conditions = extractConditions(whereClause);
  if (conditions.length === 0) return null;

  return (item: any) => {
    return conditions.every(({ col, val }) => {
      const propKey = toCamelCase(col);
      const itemVal = item[propKey] !== undefined ? item[propKey] : item[col];
      if (typeof val === 'boolean' || typeof itemVal === 'boolean') {
        return Boolean(itemVal) === Boolean(val);
      }
      return String(itemVal) === String(val) || itemVal === val;
    });
  };
}

function extractOrderDescriptor(chunk: any): { col: string; direction: 'asc' | 'desc' } | null {
  if (!chunk) return null;
  if (chunk.__mockOrderCol) {
    return { col: chunk.__mockOrderCol, direction: chunk.__mockOrderDir || 'asc' };
  }
  const queryChunks = chunk.queryChunks || (Array.isArray(chunk) ? chunk : []);
  let colName: string | null = null;
  let direction: 'asc' | 'desc' = 'asc';

  for (const part of queryChunks) {
    if (!part) continue;
    if (part.name && typeof part.name === 'string') {
      colName = toCamelCase(part.name);
    } else if (part.queryChunks && Array.isArray(part.queryChunks)) {
      const nested = extractOrderDescriptor(part);
      if (nested) {
        if (!colName) colName = nested.col;
        direction = nested.direction;
      }
    } else if (part.value && Array.isArray(part.value)) {
      const sqlStr = part.value.join(' ').toLowerCase();
      if (sqlStr.includes('desc')) direction = 'desc';
      if (sqlStr.includes('asc')) direction = 'asc';
    } else if (typeof part === 'string') {
      if (part.toLowerCase().includes('desc')) direction = 'desc';
    }
  }

  return colName ? { col: colName, direction } : null;
}

function applyOrderBy(items: any[], orderByOpt: any): any[] {
  if (!orderByOpt || items.length <= 1) return items;

  let descriptors: Array<{ col: string; direction: 'asc' | 'desc' }> = [];

  if (typeof orderByOpt === 'function') {
    const colProxy = new Proxy(
      {},
      {
        get: (_target, prop) => ({ __colName: String(prop), name: String(prop) }),
      }
    );
    const helpers = {
      asc: (colObj: any) => ({
        __mockOrderCol: toCamelCase(colObj?.__colName || colObj?.name || 'id'),
        __mockOrderDir: 'asc' as const,
      }),
      desc: (colObj: any) => ({
        __mockOrderCol: toCamelCase(colObj?.__colName || colObj?.name || 'id'),
        __mockOrderDir: 'desc' as const,
      }),
    };
    const res = orderByOpt(colProxy, helpers);
    const list = Array.isArray(res) ? res : [res];
    for (const d of list) {
      const parsed = extractOrderDescriptor(d);
      if (parsed) descriptors.push(parsed);
    }
  } else {
    const list = Array.isArray(orderByOpt) ? orderByOpt : [orderByOpt];
    for (const d of list) {
      const parsed = extractOrderDescriptor(d);
      if (parsed) descriptors.push(parsed);
    }
  }

  if (descriptors.length === 0) return items;

  return [...items].sort((a, b) => {
    for (const { col, direction } of descriptors) {
      const va = a[col];
      const vb = b[col];
      if (va === vb) continue;
      const numA = va instanceof Date ? va.getTime() : typeof va === 'number' ? va : Number(va);
      const numB = vb instanceof Date ? vb.getTime() : typeof vb === 'number' ? vb : Number(vb);
      let cmp = 0;
      if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
        cmp = numA < numB ? -1 : 1;
      } else {
        cmp = String(va ?? '').localeCompare(String(vb ?? ''));
      }
      return direction === 'desc' ? -cmp : cmp;
    }
    return 0;
  });
}

function getTableName(tableObj: any): string {
  if (!tableObj) return 'users';
  if (typeof tableObj === 'string') return tableObj;
  if (tableObj === schema.users) return 'users';
  if (tableObj === schema.events) return 'events';
  if (tableObj === schema.rounds) return 'rounds';
  if (tableObj === schema.questions) return 'questions';
  if (tableObj === schema.quizAttempts) return 'quizAttempts';
  if (tableObj === schema.participantAnswers) return 'participantAnswers';
  if (tableObj === schema.securityViolations) return 'securityViolations';
  if (tableObj === schema.disqualificationReviews) return 'disqualificationReviews';
  if (tableObj === schema.auditLogs) return 'auditLogs';
  if (tableObj === schema.adminSessions) return 'adminSessions';
  if (tableObj === schema.participantSessions) return 'participantSessions';
  if (tableObj === schema.activityEvents) return 'activityEvents';
  if (tableObj === schema.competitionSettings) return 'competitionSettings';

  if (tableObj?._?.name) return String(tableObj._.name);
  if (tableObj?.name) return String(tableObj.name);

  for (const [key, val] of Object.entries(schema)) {
    if (val === tableObj) {
      return key;
    }
  }

  return 'users';
}

function getStoreTable(tableName: any): any[] {
  const nameStr = typeof tableName === 'string' ? tableName : getTableName(tableName);
  const norm = nameStr.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  if (norm === 'quizAttempt' || norm === 'quizAttempts') return inMemory.quizAttempts;
  if (norm === 'participantAnswer' || norm === 'participantAnswers') return inMemory.participantAnswers;
  if (norm === 'securityViolation' || norm === 'securityViolations') return inMemory.securityViolations;
  if (norm === 'disqualificationReview' || norm === 'disqualificationReviews') return inMemory.disqualificationReviews;
  if (norm === 'auditLog' || norm === 'auditLogs') return inMemory.auditLogs;
  if (norm === 'adminSession' || norm === 'adminSessions') return inMemory.adminSessions;
  if (norm === 'participantSession' || norm === 'participantSessions') return inMemory.participantSessions;
  if (norm === 'activityEvent' || norm === 'activityEvents') return inMemory.activityEvents;
  if (norm === 'competitionSetting' || norm === 'competitionSettings') return inMemory.competitionSettings;
  if (norm === 'user' || norm === 'users') return inMemory.users;
  if (norm === 'round' || norm === 'rounds') return inMemory.rounds;
  if (norm === 'question' || norm === 'questions') return inMemory.questions;
  if (norm === 'event' || norm === 'events') return inMemory.events;
  return (inMemory as any)[norm] || inMemory.users;
}

function enrichItemWithRelations(item: any, relationsConfig?: any): any {
  if (!relationsConfig || !item) return item;
  const enriched = { ...item };

  if (relationsConfig.round) {
    enriched.round = inMemory.rounds.find((r) => r.id === item.roundId) || null;
  }
  if (relationsConfig.user) {
    enriched.user = inMemory.users.find((u) => u.id === item.userId) || null;
  }
  if (relationsConfig.attempts) {
    const userAttempts = inMemory.quizAttempts.filter((a) => a.userId === item.id);
    if (typeof relationsConfig.attempts === 'object' && relationsConfig.attempts.with?.round) {
      enriched.attempts = userAttempts.map((att) => ({
        ...att,
        round: inMemory.rounds.find((r) => r.id === att.roundId) || null,
      }));
    } else {
      enriched.attempts = userAttempts;
    }
  }
  if (relationsConfig.attempt) {
    const att = inMemory.quizAttempts.find((a) => a.id === item.attemptId);
    if (att) {
      const withObj = typeof relationsConfig.attempt === 'object' ? relationsConfig.attempt.with : null;
      enriched.attempt = {
        ...att,
        user: withObj?.user ? inMemory.users.find((u) => u.id === att.userId) || null : null,
        round: withObj?.round ? inMemory.rounds.find((r) => r.id === att.roundId) || null : null,
      };
    } else {
      enriched.attempt = null;
    }
  }
  if (relationsConfig.question) {
    enriched.question = inMemory.questions.find((q) => q.id === item.questionId) || null;
  }

  return enriched;
}

function cloneWithDates(obj: any): any {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (Array.isArray(obj)) return obj.map(cloneWithDates);
  const copy: any = {};
  for (const [k, v] of Object.entries(obj)) {
    copy[k] = cloneWithDates(v);
  }
  return copy;
}

// Create the mock database interface conforming to Drizzle
function createMockDb(): DBType {
  const createTableQuery = (tableName: string) => ({
    findFirst: async (options?: { where?: any; with?: any; orderBy?: any }) => {
      const list = getStoreTable(tableName);
      let items = [...list];
      if (options?.where) {
        const predicate = extractFieldAndVal(options.where);
        items = predicate ? items.filter(predicate) : [];
      }
      if (options?.orderBy) {
        items = applyOrderBy(items, options.orderBy);
      }
      let matched = items[0] || null;
      if (matched && options?.with) {
        matched = enrichItemWithRelations(matched, options.with);
      }
      return matched ? cloneWithDates(matched) : null;
    },
    findMany: async (options?: { where?: any; with?: any; orderBy?: any; limit?: number; columns?: any }) => {
      const list = getStoreTable(tableName);
      let items = [...list];
      if (options?.where) {
        const predicate = extractFieldAndVal(options.where);
        if (predicate) items = items.filter(predicate);
      }
      if (options?.orderBy) {
        items = applyOrderBy(items, options.orderBy);
      }
      if (options?.limit) {
        items = items.slice(0, options.limit);
      }
      if (options?.with) {
        items = items.map((it) => enrichItemWithRelations(it, options.with));
      }
      return items.map(cloneWithDates);
    },
  });

  return {
    query: {
      users: createTableQuery('users'),
      rounds: createTableQuery('rounds'),
      questions: createTableQuery('questions'),
      quizAttempts: createTableQuery('quizAttempts'),
      participantAnswers: createTableQuery('participantAnswers'),
      securityViolations: createTableQuery('securityViolations'),
      disqualificationReviews: createTableQuery('disqualificationReviews'),
      auditLogs: createTableQuery('auditLogs'),
      events: createTableQuery('events'),
      adminSessions: createTableQuery('adminSessions'),
      participantSessions: createTableQuery('participantSessions'),
      activityEvents: createTableQuery('activityEvents'),
      competitionSettings: createTableQuery('competitionSettings'),
    },
    insert: (tableObj: any) => ({
      values: (val: any) => ({
        returning: async () => {
          const tableName = getTableName(tableObj);
          const list = getStoreTable(tableName);
          const newId = inMemory.nextId(tableName);
          const record = {
            id: newId,
            createdAt: new Date(),
            ...val,
          };
          list.push(record);
          return [cloneWithDates(record)];
        },
        then: async (resolve: any) => {
          const tableName = getTableName(tableObj);
          const list = getStoreTable(tableName);
          const newId = inMemory.nextId(tableName);
          const record = {
            id: newId,
            createdAt: new Date(),
            ...val,
          };
          list.push(record);
          resolve([record]);
        },
      }),
    }),
    update: (tableObj: any) => ({
      set: (updates: any) => ({
        where: async (whereClause: any) => {
          const tableName = getTableName(tableObj);
          const list = getStoreTable(tableName);
          const predicate = extractFieldAndVal(whereClause);
          let updatedCount = 0;
          for (let i = 0; i < list.length; i++) {
            if (!predicate || predicate(list[i])) {
              list[i] = { ...list[i], ...updates };
              updatedCount++;
            }
          }
          return { rowCount: updatedCount };
        },
      }),
    }),
    delete: (tableObj: any) => ({
      where: async (whereClause: any) => {
        const tableName = getTableName(tableObj);
        const list = getStoreTable(tableName);
        const predicate = extractFieldAndVal(whereClause);
        let deletedCount = 0;
        for (let i = list.length - 1; i >= 0; i--) {
          if (!predicate || predicate(list[i])) {
            list.splice(i, 1);
            deletedCount++;
          }
        }
        return { rowCount: deletedCount };
      },
    }),
    $count: async (tableObj: any, whereClause?: any) => {
      const tableName = getTableName(tableObj);
      const list = getStoreTable(tableName);
      if (!whereClause) return list.length;
      const predicate = extractFieldAndVal(whereClause);
      return predicate ? list.filter(predicate).length : list.length;
    },
  };
}

export async function initDatabaseSchema(targetPool: any): Promise<void> {
  const ddl = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      uid TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'participant',
      name TEXT NOT NULL,
      college TEXT NOT NULL,
      team_name TEXT NOT NULL,
      team_members JSONB NOT NULL,
      code TEXT NOT NULL UNIQUE,
      zone TEXT NOT NULL DEFAULT 'South Zone',
      is_blocked BOOLEAN NOT NULL DEFAULT false,
      block_reason TEXT,
      is_removed BOOLEAN NOT NULL DEFAULT false,
      removed_at TIMESTAMP,
      removal_reason TEXT,
      round_overrides JSONB,
      retakes_allowed JSONB,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS admin_sessions (
      id SERIAL PRIMARY KEY,
      token TEXT NOT NULL UNIQUE,
      admin_id INTEGER REFERENCES users(id),
      ip TEXT,
      user_agent TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMP NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT true
    );

    CREATE TABLE IF NOT EXISTS participant_sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'online',
      current_difficulty TEXT DEFAULT 'easy',
      current_challenge_id INTEGER,
      last_heartbeat TIMESTAMP NOT NULL DEFAULT NOW(),
      last_activity TIMESTAMP NOT NULL DEFAULT NOW(),
      ip_address TEXT
    );

    CREATE TABLE IF NOT EXISTS events (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      banner_url TEXT,
      start_date TIMESTAMP,
      end_date TIMESTAMP,
      is_active BOOLEAN NOT NULL DEFAULT true
    );

    CREATE TABLE IF NOT EXISTS rounds (
      id SERIAL PRIMARY KEY,
      round_number INTEGER NOT NULL UNIQUE,
      difficulty TEXT NOT NULL DEFAULT 'easy',
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL DEFAULT 10,
      qualifying_percentage INTEGER NOT NULL DEFAULT 60,
      max_score INTEGER NOT NULL DEFAULT 8,
      max_violations INTEGER NOT NULL DEFAULT 2,
      is_open BOOLEAN NOT NULL DEFAULT true,
      is_published BOOLEAN NOT NULL DEFAULT true,
      order_index INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS questions (
      id SERIAL PRIMARY KEY,
      round_id INTEGER NOT NULL REFERENCES rounds(id),
      code TEXT,
      prompt TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'mcq',
      options JSONB,
      correct_option INTEGER,
      explanation TEXT,
      code_starter TEXT,
      points INTEGER NOT NULL DEFAULT 1,
      order_index INTEGER NOT NULL DEFAULT 1,
      category TEXT NOT NULL DEFAULT 'General',
      is_active BOOLEAN NOT NULL DEFAULT true
    );

    CREATE TABLE IF NOT EXISTS quiz_attempts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      round_id INTEGER NOT NULL REFERENCES rounds(id),
      status TEXT NOT NULL DEFAULT 'in_progress',
      start_time TIMESTAMP NOT NULL DEFAULT NOW(),
      server_deadline TIMESTAMP NOT NULL,
      end_time TIMESTAMP,
      score INTEGER NOT NULL DEFAULT 0,
      is_qualified BOOLEAN NOT NULL DEFAULT false,
      qualification_overridden BOOLEAN NOT NULL DEFAULT false,
      shuffled_questions JSONB,
      total_questions INTEGER NOT NULL DEFAULT 0,
      answers_count INTEGER NOT NULL DEFAULT 0,
      violations_count INTEGER NOT NULL DEFAULT 0,
      is_disqualified BOOLEAN NOT NULL DEFAULT false,
      disqualification_reason TEXT,
      termination_reason TEXT,
      terminated_at TIMESTAMP,
      paused_at TIMESTAMP,
      total_paused_seconds INTEGER NOT NULL DEFAULT 0,
      resumed_at TIMESTAMP,
      admin_decision TEXT,
      admin_decision_at TIMESTAMP,
      admin_decision_notes TEXT,
      last_incident_at TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS participant_answers (
      id SERIAL PRIMARY KEY,
      attempt_id INTEGER NOT NULL REFERENCES quiz_attempts(id),
      question_id INTEGER NOT NULL REFERENCES questions(id),
      selected_option INTEGER,
      submitted_code TEXT,
      is_correct BOOLEAN NOT NULL DEFAULT false,
      points_earned INTEGER NOT NULL DEFAULT 0,
      submitted_at TIMESTAMP NOT NULL DEFAULT NOW(),
      attempt_number INTEGER NOT NULL DEFAULT 1,
      rejection_reason TEXT,
      manually_adjusted BOOLEAN NOT NULL DEFAULT false,
      adjusted_by TEXT,
      adjusted_reason TEXT
    );

    CREATE TABLE IF NOT EXISTS activity_events (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      attempt_id INTEGER,
      event_type TEXT NOT NULL,
      difficulty_level TEXT,
      challenge_id INTEGER,
      details TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'info',
      timestamp TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS security_violations (
      id SERIAL PRIMARY KEY,
      attempt_id INTEGER NOT NULL REFERENCES quiz_attempts(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      round_id INTEGER NOT NULL REFERENCES rounds(id),
      violation_type TEXT NOT NULL,
      details TEXT NOT NULL,
      server_timestamp TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS disqualification_reviews (
      id SERIAL PRIMARY KEY,
      attempt_id INTEGER NOT NULL REFERENCES quiz_attempts(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      appeal_reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      reviewer_notes TEXT,
      reviewed_by TEXT,
      reviewed_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS competition_settings (
      id SERIAL PRIMARY KEY,
      competition_status TEXT NOT NULL DEFAULT 'active',
      registration_open BOOLEAN NOT NULL DEFAULT true,
      fullscreen_enforcement BOOLEAN NOT NULL DEFAULT true,
      strict_focus_enforcement BOOLEAN NOT NULL DEFAULT true,
      heartbeat_interval_sec INTEGER NOT NULL DEFAULT 10,
      heartbeat_stale_threshold_sec INTEGER NOT NULL DEFAULT 30,
      leaderboard_frozen BOOLEAN NOT NULL DEFAULT false,
      published_final BOOLEAN NOT NULL DEFAULT false,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      metadata JSONB,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_users_code ON users(code);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_participant_sessions_user ON participant_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_round ON quiz_attempts(user_id, round_id);
    CREATE INDEX IF NOT EXISTS idx_participant_answers_attempt ON participant_answers(attempt_id);
    CREATE INDEX IF NOT EXISTS idx_security_violations_attempt ON security_violations(attempt_id);
    CREATE INDEX IF NOT EXISTS idx_activity_events_user ON activity_events(user_id);
  `;
  await targetPool.query(ddl);
}

let dbInstance: DBType = createMockDb();
let _isUsingPersistentDb = false;
let pool: pg.Pool | null = null;
let dbReadyPromise: Promise<void> | null = null;

// Sanitize Neon PostgreSQL connection strings (strip channel_binding which is unsupported by node-postgres)
function sanitizeDatabaseUrl(url: string): string {
  let cleaned = url.replace(/([?&])channel_binding=[^&]*(&|$)/g, '$1');
  cleaned = cleaned.replace(/\?&/, '?').replace(/[?&]$/, '');
  return cleaned;
}

// Initialize PostgreSQL client if configured via DATABASE_URL / POSTGRES_URL (Neon, Vercel Postgres, Supabase)
const rawConnectionString = (process.env.DATABASE_URL || process.env.POSTGRES_URL || '').trim();
const connectionString = sanitizeDatabaseUrl(rawConnectionString);

if (connectionString || (process.env.SQL_HOST && process.env.SQL_USER)) {
  try {
    const isSocket = process.env.SQL_HOST?.startsWith('/cloudsql/');
    pool = new Pool(
      connectionString
        ? {
            connectionString,
            ssl: connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
              ? false
              : { rejectUnauthorized: false },
            connectionTimeoutMillis: 15000,
            max: 10,
          }
        : isSocket
          ? {
              host: process.env.SQL_HOST,
              user: process.env.SQL_USER,
              password: process.env.SQL_PASSWORD,
              database: process.env.SQL_DB_NAME || 'postgres',
              connectionTimeoutMillis: 3000,
            }
          : {
              host: process.env.SQL_HOST,
              user: process.env.SQL_USER,
              password: process.env.SQL_PASSWORD,
              database: process.env.SQL_DB_NAME || 'postgres',
              port: Number(process.env.SQL_PORT) || 5432,
              connectionTimeoutMillis: 3000,
            }
    );

    // Bind Drizzle directly with schema
    dbInstance = drizzle(pool, { schema });
    _isUsingPersistentDb = true;
  } catch (err) {
    console.warn('[TECH ARENA DB] Error configuring PostgreSQL connection, defaulting to in-memory store:', err);
    dbInstance = createMockDb();
    _isUsingPersistentDb = false;
  }
}

/**
 * Ensures Neon/PostgreSQL database connectivity and verifies all required tables/indexes exist.
 * Called automatically before handling API requests and seeding.
 */
export async function ensureDatabaseReady(): Promise<void> {
  if (!pool || !_isUsingPersistentDb) return;

  if (!dbReadyPromise) {
    dbReadyPromise = (async () => {
      try {
        await pool!.query('SELECT 1');
        await initDatabaseSchema(pool);
        console.log('[TECH ARENA DB] Successfully verified Neon/PostgreSQL connection and synchronized schema tables.');
      } catch (err) {
        console.warn('[TECH ARENA DB] Neon/PostgreSQL connection check failed, operating with in-memory store fallback:', err);
        _isUsingPersistentDb = false;
        dbInstance = createMockDb();
      }
    })();
  }

  await dbReadyPromise;
}

export const db: DBType = new Proxy({}, {
  get: (_target, prop) => {
    return (dbInstance as any)[prop];
  },
});

/** True when connected to a real PostgreSQL instance; false when using in-memory store. */
export function isUsingPersistentDb(): boolean {
  return _isUsingPersistentDb;
}

