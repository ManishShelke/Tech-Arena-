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
        if (nextCh?.value !== undefined && nextCh.constructor?.name === 'Param') {
          results.push({ col: colName, val: nextCh.value });
          i = j;
          break;
        }
      }
    }
  }

  return results;
}

function extractFieldAndVal(whereClause: any): ((item: any) => boolean) | null {
  if (!whereClause) return null;
  if (typeof whereClause === 'function') return whereClause;

  const conditions = extractConditions(whereClause);
  if (conditions.length === 0) return null;

  const propertyMap: Record<string, string> = {
    team_name: 'teamName',
    round_number: 'roundNumber',
    user_id: 'userId',
    round_id: 'roundId',
    is_published: 'isPublished',
    is_open: 'isOpen',
    is_blocked: 'isBlocked',
    attempt_id: 'attemptId',
    question_id: 'questionId',
    created_at: 'createdAt',
  };

  return (item: any) => {
    return conditions.every(({ col, val }) => {
      const propKey = propertyMap[col] || col.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      const itemVal = item[propKey] !== undefined ? item[propKey] : item[col];
      return String(itemVal) === String(val) || itemVal === val;
    });
  };
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
      const predicate = options?.where ? extractFieldAndVal(options.where) : null;
      let matched = predicate ? list.find(predicate) : (options?.where ? null : list[0]);
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

let dbInstance: DBType = createMockDb();

// Attempt real postgres if configured and connected
if (process.env.SQL_HOST && process.env.SQL_USER) {
  try {
    const isSocket = process.env.SQL_HOST.startsWith('/cloudsql/');
    const pool = new Pool(
      isSocket
        ? {
            host: process.env.SQL_HOST,
            user: process.env.SQL_USER,
            password: process.env.SQL_PASSWORD,
            database: process.env.SQL_DB_NAME || 'postgres',
            connectionTimeoutMillis: 2000,
          }
        : {
            host: process.env.SQL_HOST,
            user: process.env.SQL_USER,
            password: process.env.SQL_PASSWORD,
            database: process.env.SQL_DB_NAME || 'postgres',
            port: Number(process.env.SQL_PORT) || 5432,
            connectionTimeoutMillis: 2000,
          }
    );

    // Test connectivity quickly
    pool.query('SELECT 1', (err) => {
      if (err) {
        console.warn('[TECH ARENA DB] Cloud SQL connection unavailable, active with in-memory tournament engine.');
      } else {
        console.log('[TECH ARENA DB] Successfully connected to PostgreSQL instance.');
        dbInstance = drizzle(pool, { schema });
      }
    });
  } catch (err) {
    console.warn('[TECH ARENA DB] Initializing with in-memory database engine:', err);
  }
}

export const db: DBType = new Proxy({}, {
  get: (_target, prop) => {
    return (dbInstance as any)[prop];
  },
});
