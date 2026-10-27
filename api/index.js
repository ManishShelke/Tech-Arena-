var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server.ts
import express from "express";
import * as dotenv from "dotenv";

// src/db/index.ts
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

// src/db/schema.ts
var schema_exports = {};
__export(schema_exports, {
  activityEvents: () => activityEvents,
  activityEventsRelations: () => activityEventsRelations,
  adminSessions: () => adminSessions,
  auditLogs: () => auditLogs,
  competitionSettings: () => competitionSettings,
  disqualificationReviews: () => disqualificationReviews,
  disqualificationReviewsRelations: () => disqualificationReviewsRelations,
  events: () => events,
  participantAnswers: () => participantAnswers,
  participantAnswersRelations: () => participantAnswersRelations,
  participantSessions: () => participantSessions,
  participantSessionsRelations: () => participantSessionsRelations,
  questions: () => questions,
  questionsRelations: () => questionsRelations,
  quizAttempts: () => quizAttempts,
  quizAttemptsRelations: () => quizAttemptsRelations,
  rounds: () => rounds,
  roundsRelations: () => roundsRelations,
  securityViolations: () => securityViolations,
  securityViolationsRelations: () => securityViolationsRelations,
  users: () => users,
  usersRelations: () => usersRelations
});
import { pgTable, serial, text, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
var users = pgTable("users", {
  id: serial("id").primaryKey(),
  uid: text("uid").notNull().unique(),
  email: text("email").notNull(),
  role: text("role").notNull().default("participant"),
  // 'participant' | 'admin'
  name: text("name").notNull(),
  college: text("college").notNull(),
  teamName: text("team_name").notNull(),
  teamMembers: jsonb("team_members").notNull().$type(),
  code: text("code").notNull().unique(),
  zone: text("zone").notNull().default("South Zone"),
  isBlocked: boolean("is_blocked").notNull().default(false),
  blockReason: text("block_reason"),
  isRemoved: boolean("is_removed").notNull().default(false),
  removedAt: timestamp("removed_at"),
  removalReason: text("removal_reason"),
  roundOverrides: jsonb("round_overrides").$type(),
  retakesAllowed: jsonb("retakes_allowed").$type(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var adminSessions = pgTable("admin_sessions", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  adminId: integer("admin_id").references(() => users.id),
  ip: text("ip"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  isActive: boolean("is_active").notNull().default(true)
});
var participantSessions = pgTable("participant_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  status: text("status").notNull().default("online"),
  // 'online' | 'offline' | 'logged_out' | 'connection_lost'
  currentDifficulty: text("current_difficulty").default("easy"),
  // 'easy' | 'intermediate' | 'hard'
  currentChallengeId: integer("current_challenge_id"),
  lastHeartbeat: timestamp("last_heartbeat").defaultNow().notNull(),
  lastActivity: timestamp("last_activity").defaultNow().notNull(),
  ipAddress: text("ip_address")
});
var events = pgTable("events", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  bannerUrl: text("banner_url"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  isActive: boolean("is_active").notNull().default(true)
});
var rounds = pgTable("rounds", {
  id: serial("id").primaryKey(),
  roundNumber: integer("round_number").notNull().unique(),
  difficulty: text("difficulty").notNull().default("easy"),
  // 'easy' | 'medium' | 'hard'
  title: text("title").notNull(),
  description: text("description").notNull(),
  durationMinutes: integer("duration_minutes").notNull().default(10),
  qualifyingPercentage: integer("qualifying_percentage").notNull().default(60),
  maxScore: integer("max_score").notNull().default(8),
  maxViolations: integer("max_violations").notNull().default(2),
  isOpen: boolean("is_open").notNull().default(true),
  isPublished: boolean("is_published").notNull().default(true),
  orderIndex: integer("order_index").notNull().default(1)
});
var questions = pgTable("questions", {
  id: serial("id").primaryKey(),
  roundId: integer("round_id").notNull().references(() => rounds.id),
  code: text("code"),
  // e.g. 'E1', 'M5', 'H10'
  prompt: text("prompt").notNull(),
  type: text("type").notNull().default("mcq"),
  // 'mcq' | 'code'
  options: jsonb("options").$type(),
  correctOption: integer("correct_option"),
  // 0, 1, 2, 3
  explanation: text("explanation"),
  codeStarter: text("code_starter"),
  points: integer("points").notNull().default(1),
  orderIndex: integer("order_index").notNull().default(1),
  category: text("category").notNull().default("General"),
  isActive: boolean("is_active").notNull().default(true)
});
var quizAttempts = pgTable("quiz_attempts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  roundId: integer("round_id").notNull().references(() => rounds.id),
  status: text("status").notNull().default("in_progress"),
  // 'in_progress' | 'submitted' | 'completed' | 'timed_out' | 'terminated' | 'disqualified'
  startTime: timestamp("start_time").defaultNow().notNull(),
  serverDeadline: timestamp("server_deadline").notNull(),
  endTime: timestamp("end_time"),
  score: integer("score").notNull().default(0),
  isQualified: boolean("is_qualified").notNull().default(false),
  qualificationOverridden: boolean("qualification_overridden").notNull().default(false),
  shuffledQuestions: jsonb("shuffled_questions"),
  totalQuestions: integer("total_questions").notNull().default(0),
  answersCount: integer("answers_count").notNull().default(0),
  violationsCount: integer("violations_count").notNull().default(0),
  isDisqualified: boolean("is_disqualified").notNull().default(false),
  disqualificationReason: text("disqualification_reason"),
  terminationReason: text("termination_reason"),
  terminatedAt: timestamp("terminated_at"),
  pausedAt: timestamp("paused_at"),
  totalPausedSeconds: integer("total_paused_seconds").notNull().default(0),
  resumedAt: timestamp("resumed_at"),
  adminDecision: text("admin_decision"),
  adminDecisionAt: timestamp("admin_decision_at"),
  adminDecisionNotes: text("admin_decision_notes"),
  lastIncidentAt: timestamp("last_incident_at")
});
var participantAnswers = pgTable("participant_answers", {
  id: serial("id").primaryKey(),
  attemptId: integer("attempt_id").notNull().references(() => quizAttempts.id),
  questionId: integer("question_id").notNull().references(() => questions.id),
  selectedOption: integer("selected_option"),
  submittedCode: text("submitted_code"),
  isCorrect: boolean("is_correct").notNull().default(false),
  pointsEarned: integer("points_earned").notNull().default(0),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  attemptNumber: integer("attempt_number").notNull().default(1),
  rejectionReason: text("rejection_reason"),
  manuallyAdjusted: boolean("manually_adjusted").notNull().default(false),
  adjustedBy: text("adjusted_by"),
  adjustedReason: text("adjusted_reason")
});
var activityEvents = pgTable("activity_events", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  attemptId: integer("attempt_id"),
  eventType: text("event_type").notNull(),
  // 'LOGIN' | 'LOGOUT' | 'ATTEMPT_STARTED' | 'DIFFICULTY_SELECTED' | 'CHALLENGE_OPENED' | 'ANSWER_SUBMITTED' | 'SUBMISSION_ACCEPTED' | 'SUBMISSION_REJECTED' | 'WINDOW_FOCUS_LOST' | 'TAB_HIDDEN' | 'FULLSCREEN_EXIT' | 'HEARTBEAT_EXPIRED' | 'ATTEMPT_TERMINATED'
  difficultyLevel: text("difficulty_level"),
  challengeId: integer("challenge_id"),
  details: text("details").notNull(),
  severity: text("severity").notNull().default("info"),
  // 'info' | 'warning' | 'violation' | 'critical'
  timestamp: timestamp("timestamp").defaultNow().notNull()
});
var securityViolations = pgTable("security_violations", {
  id: serial("id").primaryKey(),
  attemptId: integer("attempt_id").notNull().references(() => quizAttempts.id),
  userId: integer("user_id").notNull().references(() => users.id),
  roundId: integer("round_id").notNull().references(() => rounds.id),
  violationType: text("violation_type").notNull(),
  details: text("details").notNull(),
  serverTimestamp: timestamp("server_timestamp").defaultNow().notNull()
});
var disqualificationReviews = pgTable("disqualification_reviews", {
  id: serial("id").primaryKey(),
  attemptId: integer("attempt_id").notNull().references(() => quizAttempts.id),
  userId: integer("user_id").notNull().references(() => users.id),
  appealReason: text("appeal_reason").notNull(),
  status: text("status").notNull().default("pending"),
  // 'pending' | 'approved' | 'rejected'
  reviewerNotes: text("reviewer_notes"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var competitionSettings = pgTable("competition_settings", {
  id: serial("id").primaryKey(),
  competitionStatus: text("competition_status").notNull().default("active"),
  // 'draft' | 'active' | 'paused' | 'ended'
  registrationOpen: boolean("registration_open").notNull().default(true),
  fullscreenEnforcement: boolean("fullscreen_enforcement").notNull().default(true),
  strictFocusEnforcement: boolean("strict_focus_enforcement").notNull().default(true),
  heartbeatIntervalSec: integer("heartbeat_interval_sec").notNull().default(10),
  heartbeatStaleThresholdSec: integer("heartbeat_stale_threshold_sec").notNull().default(30),
  leaderboardFrozen: boolean("leaderboard_frozen").notNull().default(false),
  publishedFinal: boolean("published_final").notNull().default(false),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var usersRelations = relations(users, ({ many, one }) => ({
  attempts: many(quizAttempts),
  violations: many(securityViolations),
  appeals: many(disqualificationReviews),
  session: one(participantSessions, {
    fields: [users.id],
    references: [participantSessions.userId]
  }),
  activities: many(activityEvents)
}));
var roundsRelations = relations(rounds, ({ many }) => ({
  questions: many(questions),
  attempts: many(quizAttempts)
}));
var questionsRelations = relations(questions, ({ one }) => ({
  round: one(rounds, {
    fields: [questions.roundId],
    references: [rounds.id]
  })
}));
var quizAttemptsRelations = relations(quizAttempts, ({ one, many }) => ({
  user: one(users, {
    fields: [quizAttempts.userId],
    references: [users.id]
  }),
  round: one(rounds, {
    fields: [quizAttempts.roundId],
    references: [rounds.id]
  }),
  answers: many(participantAnswers),
  violations: many(securityViolations)
}));
var participantAnswersRelations = relations(participantAnswers, ({ one }) => ({
  attempt: one(quizAttempts, {
    fields: [participantAnswers.attemptId],
    references: [quizAttempts.id]
  }),
  question: one(questions, {
    fields: [participantAnswers.questionId],
    references: [questions.id]
  })
}));
var participantSessionsRelations = relations(participantSessions, ({ one }) => ({
  user: one(users, {
    fields: [participantSessions.userId],
    references: [users.id]
  })
}));
var activityEventsRelations = relations(activityEvents, ({ one }) => ({
  user: one(users, {
    fields: [activityEvents.userId],
    references: [users.id]
  })
}));
var securityViolationsRelations = relations(securityViolations, ({ one }) => ({
  attempt: one(quizAttempts, {
    fields: [securityViolations.attemptId],
    references: [quizAttempts.id]
  }),
  user: one(users, {
    fields: [securityViolations.userId],
    references: [users.id]
  }),
  round: one(rounds, {
    fields: [securityViolations.roundId],
    references: [rounds.id]
  })
}));
var disqualificationReviewsRelations = relations(disqualificationReviews, ({ one }) => ({
  attempt: one(quizAttempts, {
    fields: [disqualificationReviews.attemptId],
    references: [quizAttempts.id]
  }),
  user: one(users, {
    fields: [disqualificationReviews.userId],
    references: [users.id]
  })
}));

// src/db/index.ts
var { Pool } = pg;
var InMemoryStore = class {
  constructor() {
    this.users = [];
    this.events = [];
    this.rounds = [];
    this.questions = [];
    this.quizAttempts = [];
    this.participantAnswers = [];
    this.securityViolations = [];
    this.disqualificationReviews = [];
    this.auditLogs = [];
    this.adminSessions = [];
    this.participantSessions = [];
    this.activityEvents = [];
    this.competitionSettings = [];
    this.idCounters = {
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
      competitionSettings: 1
    };
  }
  nextId(table) {
    if (!this.idCounters[table]) this.idCounters[table] = 1;
    const next = this.idCounters[table]++;
    return next;
  }
};
var inMemory = new InMemoryStore();
function extractConditions(clause) {
  if (!clause) return [];
  const results = [];
  const chunks = clause.queryChunks || (Array.isArray(clause) ? clause : [clause]);
  for (let i = 0; i < chunks.length; i++) {
    const ch = chunks[i];
    if (!ch) continue;
    if (ch.queryChunks && Array.isArray(ch.queryChunks)) {
      results.push(...extractConditions(ch));
      continue;
    }
    if (ch.name && typeof ch.name === "string") {
      const colName = ch.name;
      for (let j = i + 1; j < chunks.length; j++) {
        const nextCh = chunks[j];
        if (nextCh?.value !== void 0 && (nextCh.constructor?.name === "Param" || "encoder" in nextCh)) {
          results.push({ col: colName, val: nextCh.value });
          i = j;
          break;
        }
      }
    }
  }
  return results;
}
function toCamelCase(col) {
  return col.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}
function extractFieldAndVal(whereClause) {
  if (!whereClause) return null;
  if (typeof whereClause === "function") return whereClause;
  const conditions = extractConditions(whereClause);
  if (conditions.length === 0) return null;
  return (item) => {
    return conditions.every(({ col, val }) => {
      const propKey = toCamelCase(col);
      const itemVal = item[propKey] !== void 0 ? item[propKey] : item[col];
      if (typeof val === "boolean" || typeof itemVal === "boolean") {
        return Boolean(itemVal) === Boolean(val);
      }
      return String(itemVal) === String(val) || itemVal === val;
    });
  };
}
function extractOrderDescriptor(chunk) {
  if (!chunk) return null;
  if (chunk.__mockOrderCol) {
    return { col: chunk.__mockOrderCol, direction: chunk.__mockOrderDir || "asc" };
  }
  const queryChunks = chunk.queryChunks || (Array.isArray(chunk) ? chunk : []);
  let colName = null;
  let direction = "asc";
  for (const part of queryChunks) {
    if (!part) continue;
    if (part.name && typeof part.name === "string") {
      colName = toCamelCase(part.name);
    } else if (part.queryChunks && Array.isArray(part.queryChunks)) {
      const nested = extractOrderDescriptor(part);
      if (nested) {
        if (!colName) colName = nested.col;
        direction = nested.direction;
      }
    } else if (part.value && Array.isArray(part.value)) {
      const sqlStr = part.value.join(" ").toLowerCase();
      if (sqlStr.includes("desc")) direction = "desc";
      if (sqlStr.includes("asc")) direction = "asc";
    } else if (typeof part === "string") {
      if (part.toLowerCase().includes("desc")) direction = "desc";
    }
  }
  return colName ? { col: colName, direction } : null;
}
function applyOrderBy(items, orderByOpt) {
  if (!orderByOpt || items.length <= 1) return items;
  let descriptors = [];
  if (typeof orderByOpt === "function") {
    const colProxy = new Proxy(
      {},
      {
        get: (_target, prop) => ({ __colName: String(prop), name: String(prop) })
      }
    );
    const helpers = {
      asc: (colObj) => ({
        __mockOrderCol: toCamelCase(colObj?.__colName || colObj?.name || "id"),
        __mockOrderDir: "asc"
      }),
      desc: (colObj) => ({
        __mockOrderCol: toCamelCase(colObj?.__colName || colObj?.name || "id"),
        __mockOrderDir: "desc"
      })
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
      const numA = va instanceof Date ? va.getTime() : typeof va === "number" ? va : Number(va);
      const numB = vb instanceof Date ? vb.getTime() : typeof vb === "number" ? vb : Number(vb);
      let cmp = 0;
      if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
        cmp = numA < numB ? -1 : 1;
      } else {
        cmp = String(va ?? "").localeCompare(String(vb ?? ""));
      }
      return direction === "desc" ? -cmp : cmp;
    }
    return 0;
  });
}
function getTableName(tableObj) {
  if (!tableObj) return "users";
  if (typeof tableObj === "string") return tableObj;
  if (tableObj === users) return "users";
  if (tableObj === events) return "events";
  if (tableObj === rounds) return "rounds";
  if (tableObj === questions) return "questions";
  if (tableObj === quizAttempts) return "quizAttempts";
  if (tableObj === participantAnswers) return "participantAnswers";
  if (tableObj === securityViolations) return "securityViolations";
  if (tableObj === disqualificationReviews) return "disqualificationReviews";
  if (tableObj === auditLogs) return "auditLogs";
  if (tableObj === adminSessions) return "adminSessions";
  if (tableObj === participantSessions) return "participantSessions";
  if (tableObj === activityEvents) return "activityEvents";
  if (tableObj === competitionSettings) return "competitionSettings";
  if (tableObj?._?.name) return String(tableObj._.name);
  if (tableObj?.name) return String(tableObj.name);
  for (const [key, val] of Object.entries(schema_exports)) {
    if (val === tableObj) {
      return key;
    }
  }
  return "users";
}
function getStoreTable(tableName) {
  const nameStr = typeof tableName === "string" ? tableName : getTableName(tableName);
  const norm = nameStr.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  if (norm === "quizAttempt" || norm === "quizAttempts") return inMemory.quizAttempts;
  if (norm === "participantAnswer" || norm === "participantAnswers") return inMemory.participantAnswers;
  if (norm === "securityViolation" || norm === "securityViolations") return inMemory.securityViolations;
  if (norm === "disqualificationReview" || norm === "disqualificationReviews") return inMemory.disqualificationReviews;
  if (norm === "auditLog" || norm === "auditLogs") return inMemory.auditLogs;
  if (norm === "adminSession" || norm === "adminSessions") return inMemory.adminSessions;
  if (norm === "participantSession" || norm === "participantSessions") return inMemory.participantSessions;
  if (norm === "activityEvent" || norm === "activityEvents") return inMemory.activityEvents;
  if (norm === "competitionSetting" || norm === "competitionSettings") return inMemory.competitionSettings;
  if (norm === "user" || norm === "users") return inMemory.users;
  if (norm === "round" || norm === "rounds") return inMemory.rounds;
  if (norm === "question" || norm === "questions") return inMemory.questions;
  if (norm === "event" || norm === "events") return inMemory.events;
  return inMemory[norm] || inMemory.users;
}
function enrichItemWithRelations(item, relationsConfig) {
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
    if (typeof relationsConfig.attempts === "object" && relationsConfig.attempts.with?.round) {
      enriched.attempts = userAttempts.map((att) => ({
        ...att,
        round: inMemory.rounds.find((r) => r.id === att.roundId) || null
      }));
    } else {
      enriched.attempts = userAttempts;
    }
  }
  if (relationsConfig.attempt) {
    const att = inMemory.quizAttempts.find((a) => a.id === item.attemptId);
    if (att) {
      const withObj = typeof relationsConfig.attempt === "object" ? relationsConfig.attempt.with : null;
      enriched.attempt = {
        ...att,
        user: withObj?.user ? inMemory.users.find((u) => u.id === att.userId) || null : null,
        round: withObj?.round ? inMemory.rounds.find((r) => r.id === att.roundId) || null : null
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
function cloneWithDates(obj) {
  if (obj === null || typeof obj !== "object") return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (Array.isArray(obj)) return obj.map(cloneWithDates);
  const copy = {};
  for (const [k, v] of Object.entries(obj)) {
    copy[k] = cloneWithDates(v);
  }
  return copy;
}
function createMockDb() {
  const createTableQuery = (tableName) => ({
    findFirst: async (options) => {
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
    findMany: async (options) => {
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
    }
  });
  return {
    query: {
      users: createTableQuery("users"),
      rounds: createTableQuery("rounds"),
      questions: createTableQuery("questions"),
      quizAttempts: createTableQuery("quizAttempts"),
      participantAnswers: createTableQuery("participantAnswers"),
      securityViolations: createTableQuery("securityViolations"),
      disqualificationReviews: createTableQuery("disqualificationReviews"),
      auditLogs: createTableQuery("auditLogs"),
      events: createTableQuery("events"),
      adminSessions: createTableQuery("adminSessions"),
      participantSessions: createTableQuery("participantSessions"),
      activityEvents: createTableQuery("activityEvents"),
      competitionSettings: createTableQuery("competitionSettings")
    },
    insert: (tableObj) => ({
      values: (val) => ({
        returning: async () => {
          const tableName = getTableName(tableObj);
          const list = getStoreTable(tableName);
          const newId = inMemory.nextId(tableName);
          const record = {
            id: newId,
            createdAt: /* @__PURE__ */ new Date(),
            ...val
          };
          list.push(record);
          return [cloneWithDates(record)];
        },
        then: async (resolve) => {
          const tableName = getTableName(tableObj);
          const list = getStoreTable(tableName);
          const newId = inMemory.nextId(tableName);
          const record = {
            id: newId,
            createdAt: /* @__PURE__ */ new Date(),
            ...val
          };
          list.push(record);
          resolve([record]);
        }
      })
    }),
    update: (tableObj) => ({
      set: (updates) => ({
        where: async (whereClause) => {
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
        }
      })
    }),
    delete: (tableObj) => ({
      where: async (whereClause) => {
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
      }
    }),
    $count: async (tableObj, whereClause) => {
      const tableName = getTableName(tableObj);
      const list = getStoreTable(tableName);
      if (!whereClause) return list.length;
      const predicate = extractFieldAndVal(whereClause);
      return predicate ? list.filter(predicate).length : list.length;
    }
  };
}
var dbInstance = createMockDb();
var _isUsingPersistentDb = false;
var connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (connectionString || process.env.SQL_HOST && process.env.SQL_USER) {
  try {
    const isSocket = process.env.SQL_HOST?.startsWith("/cloudsql/");
    const pool = new Pool(
      connectionString ? {
        connectionString,
        ssl: connectionString.includes("localhost") || connectionString.includes("127.0.0.1") ? false : { rejectUnauthorized: false },
        connectionTimeoutMillis: 4e3
      } : isSocket ? {
        host: process.env.SQL_HOST,
        user: process.env.SQL_USER,
        password: process.env.SQL_PASSWORD,
        database: process.env.SQL_DB_NAME || "postgres",
        connectionTimeoutMillis: 2e3
      } : {
        host: process.env.SQL_HOST,
        user: process.env.SQL_USER,
        password: process.env.SQL_PASSWORD,
        database: process.env.SQL_DB_NAME || "postgres",
        port: Number(process.env.SQL_PORT) || 5432,
        connectionTimeoutMillis: 2e3
      }
    );
    pool.query("SELECT 1", (err) => {
      if (err) {
        console.warn("[TECH ARENA DB] PostgreSQL connection unavailable, active with in-memory tournament engine.");
      } else {
        console.log("[TECH ARENA DB] Successfully connected to PostgreSQL instance.");
        dbInstance = drizzle(pool, { schema: schema_exports });
        _isUsingPersistentDb = true;
      }
    });
  } catch (err) {
    console.warn("[TECH ARENA DB] Initializing with in-memory database engine:", err);
  }
}
var db = new Proxy({}, {
  get: (_target, prop) => {
    return dbInstance[prop];
  }
});
function isUsingPersistentDb() {
  return _isUsingPersistentDb;
}

// server.ts
import { eq as eq4, and as and3 } from "drizzle-orm";

// src/middleware/auth.ts
import { eq, and } from "drizzle-orm";

// src/utils/cryptoAuth.ts
import crypto from "crypto";
var DEFAULT_TOKEN_SECRET = "tech_arena_2026_hmac_secret_key_v1_kle_bca";
function getTokenSecret() {
  return process.env.SESSION_SECRET || process.env.ADMIN_MASTER_PASSKEY || DEFAULT_TOKEN_SECRET;
}
var SALT = "tech_arena_2026_passkey_salt_v1";
var AUTHORIZED_PASSKEY_HASHES = [
  "tech@kle",
  "vybe2k26",
  "Matrix2026"
].map((key) => crypto.scryptSync(key, SALT, 64));
function verifyAdminPasskey(input) {
  if (!input || typeof input !== "string") return false;
  const trimmed = input.trim();
  if (!trimmed) return false;
  const inputHash = crypto.scryptSync(trimmed, SALT, 64);
  let matched = false;
  for (const validHash of AUTHORIZED_PASSKEY_HASHES) {
    if (crypto.timingSafeEqual(inputHash, validHash)) {
      matched = true;
    }
  }
  const envMaster = process.env.ADMIN_MASTER_PASSKEY?.trim();
  if (envMaster) {
    const envHash = crypto.scryptSync(envMaster, SALT, 64);
    if (crypto.timingSafeEqual(inputHash, envHash)) {
      matched = true;
    }
  }
  return matched;
}
function signPayload(payload) {
  return crypto.createHmac("sha256", getTokenSecret()).update(payload).digest("hex");
}
function verifySignature(payload, signatureHex) {
  if (!signatureHex || !/^[0-9a-f]{64}$/i.test(signatureHex)) return false;
  const expectedHex = signPayload(payload);
  const expectedBuf = Buffer.from(expectedHex, "hex");
  const actualBuf = Buffer.from(signatureHex, "hex");
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}
function signAdminToken() {
  const randomId = crypto.randomBytes(24).toString("hex");
  const baseToken = `ta_admin_${randomId}`;
  const sig = signPayload(baseToken);
  return `${baseToken}.${sig}`;
}
function verifyAdminTokenSignature(token) {
  if (!token || !token.startsWith("ta_admin_")) return false;
  const dotIndex = token.indexOf(".");
  if (dotIndex === -1) return false;
  const baseToken = token.slice(0, dotIndex);
  const sig = token.slice(dotIndex + 1);
  if (baseToken.length <= "ta_admin_".length) return false;
  return verifySignature(baseToken, sig);
}
function signParticipantToken(userId, code) {
  const normalizedCode = code.trim().toUpperCase();
  const basePayload = `ta_team_${normalizedCode}.${userId}`;
  const sig = signPayload(basePayload);
  return `${basePayload}.${sig}`;
}
function verifyParticipantToken(token) {
  if (!token || !token.startsWith("ta_team_")) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [prefixAndCode, userIdStr, sig] = parts;
  const code = prefixAndCode.replace(/^ta_team_/, "").trim().toUpperCase();
  const userId = Number(userIdStr);
  if (!code || !Number.isInteger(userId) || userId <= 0) return null;
  const basePayload = `ta_team_${code}.${userId}`;
  if (!verifySignature(basePayload, sig)) return null;
  return { userId, code };
}

// src/middleware/auth.ts
async function validateAdminSessionToken(rawToken) {
  if (!rawToken || !rawToken.startsWith("ta_admin_")) {
    return { valid: false, error: "Invalid administrator session token." };
  }
  if (!verifyAdminTokenSignature(rawToken)) {
    return { valid: false, error: "Invalid administrator token signature. Please re-authenticate." };
  }
  if (!isUsingPersistentDb()) {
    return { valid: true };
  }
  const session = await db.query.adminSessions.findFirst({
    where: and(eq(adminSessions.token, rawToken), eq(adminSessions.isActive, true))
  });
  if (!session) {
    return { valid: false, error: "Administrator session not found or invalidated. Please log in again." };
  }
  const now = /* @__PURE__ */ new Date();
  if (new Date(session.expiresAt) <= now) {
    await db.update(adminSessions).set({ isActive: false }).where(eq(adminSessions.token, rawToken));
    return { valid: false, error: "Administrator session expired. Please re-authenticate." };
  }
  return { valid: true };
}
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Authorization header missing." });
    }
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return res.status(401).json({ error: "Token missing." });
    }
    if (token.startsWith("ta_admin_")) {
      const validation = await validateAdminSessionToken(token);
      if (!validation.valid) {
        return res.status(401).json({ error: validation.error || "Unauthorized administrator session." });
      }
      let adminUser = await db.query.users.findFirst({
        where: eq(users.role, "admin")
      });
      if (!adminUser) {
        const [created] = await db.insert(users).values({
          uid: "admin_matrix_root",
          email: "admin@techarena.edu",
          role: "admin",
          name: "Chief Administrator",
          college: "Tech Arena Directorate",
          teamName: "Admin Control Center",
          teamMembers: ["Chief Proctor", "Tournament Director"],
          code: "#TA-ADMIN",
          zone: "Central Command",
          isBlocked: false
        }).returning();
        adminUser = created;
      }
      req.user = adminUser;
      req.adminSessionToken = token;
      return next();
    }
    if (token.startsWith("ta_team_")) {
      const verified = verifyParticipantToken(token);
      if (!verified) {
        return res.status(401).json({
          error: "Terminal session expired or invalid signature. Please sign in again."
        });
      }
      let participant = await db.query.users.findFirst({
        where: eq(users.id, verified.userId)
      });
      if (!participant || participant.code.toUpperCase() !== verified.code.toUpperCase()) {
        participant = await db.query.users.findFirst({
          where: eq(users.code, verified.code)
        });
      }
      if (!participant) {
        if (!isUsingPersistentDb()) {
          const [restored] = await db.insert(users).values({
            uid: `team_${verified.userId}`,
            email: `${verified.code.toLowerCase().replace(/[^a-z0-9]/g, "_")}@techarena.edu`,
            role: "participant",
            name: `Team ${verified.code}`,
            college: "Tech Arena Campus",
            teamName: `Team ${verified.code}`,
            teamMembers: ["Participant 1"],
            code: verified.code,
            zone: "South Zone",
            isBlocked: false
          }).returning();
          participant = restored;
        } else {
          return res.status(401).json({ error: "Terminal session expired or team not found." });
        }
      }
      if (participant.isRemoved) {
        return res.status(403).json({
          error: "Terminal access revoked: Participant has been removed from the tournament roster.",
          isRemoved: true
        });
      }
      const pSession = await db.query.participantSessions.findFirst({
        where: eq(participantSessions.userId, participant.id)
      });
      if (pSession) {
        await db.update(participantSessions).set({ lastActivity: /* @__PURE__ */ new Date() }).where(eq(participantSessions.id, pSession.id));
      }
      req.user = participant;
      return next();
    }
    return res.status(401).json({ error: "Invalid authentication credentials." });
  } catch (error) {
    console.error("requireAuth middleware error:", error);
    return res.status(500).json({ error: "Internal server authentication error." });
  }
}
async function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin" || !req.adminSessionToken) {
    return res.status(403).json({ error: "Access denied: Tournament Administrator credentials required." });
  }
  const validation = await validateAdminSessionToken(req.adminSessionToken);
  if (!validation.valid) {
    return res.status(401).json({ error: validation.error || "Administrator session expired." });
  }
  next();
}

// src/db/seed.ts
import { eq as eq2 } from "drizzle-orm";
var QUESTION_BANK = [
  // ==========================================
  // ROUND 1 — MIXED APTITUDE & COMPUTER LANGUAGE MCQs (30 questions: Easy, Moderate, Hard)
  // ==========================================
  // --- EASY TIER (10 Questions × 1 Mark) ---
  {
    code: "E1",
    roundNumber: 1,
    prompt: "Which Python data type is most appropriate for storing the value 3.14?",
    options: ["int", "float", "str", "bool"],
    correctOption: 1,
    explanation: "Float stores numbers with decimal points.",
    points: 1,
    category: "Easy \xB7 Python Fundamentals"
  },
  {
    code: "E2",
    roundNumber: 1,
    prompt: "What is the output of the expression 5 * 2 + 3 in Python?",
    options: ["13", "16", "10", "15"],
    correctOption: 0,
    explanation: "Multiplication precedes addition: 10 + 3 = 13.",
    points: 1,
    category: "Easy \xB7 Output Prediction"
  },
  {
    code: "E3",
    roundNumber: 1,
    prompt: "What is the decimal equivalent of the binary number 1010?",
    options: ["8", "10", "12", "14"],
    correctOption: 1,
    explanation: "8 + 0 + 2 + 0 = 10.",
    points: 1,
    category: "Easy \xB7 Number System"
  },
  {
    code: "E4",
    roundNumber: 1,
    prompt: "Which computer component executes program instructions and performs arithmetic and logical operations?",
    options: ["RAM", "SSD", "CPU", "Monitor"],
    correctOption: 2,
    explanation: "CPU executes instructions and ALU performs operations.",
    points: 1,
    category: "Easy \xB7 Computer Fundamentals"
  },
  {
    code: "E5",
    roundNumber: 1,
    prompt: 'What is printed by: for i in range(1, 4): print(i, end=" ") in Python?',
    options: ["0 1 2 3", "1 2 3", "1 2 3 4", "0 1 2"],
    correctOption: 1,
    explanation: "range(1, 4) yields 1, 2, 3.",
    points: 1,
    category: "Easy \xB7 Loops"
  },
  {
    code: "E6",
    roundNumber: 1,
    prompt: "Which SQL command retrieves records from a database table?",
    options: ["INSERT", "DELETE", "SELECT", "UPDATE"],
    correctOption: 2,
    explanation: "SELECT queries data from a table.",
    points: 1,
    category: "Easy \xB7 SQL"
  },
  {
    code: "E7",
    roundNumber: 1,
    prompt: "Which language primarily defines the structure and content of a standard web page?",
    options: ["HTML", "SQL", "Python", "C"],
    correctOption: 0,
    explanation: "HTML defines web page structure.",
    points: 1,
    category: "Easy \xB7 Web Development"
  },
  {
    code: "E8",
    roundNumber: 1,
    prompt: "In the condition n % 2 == 0, what does the % operator represent?",
    options: ["Division", "Exponentiation", "Modulus (remainder)", "Multiplication"],
    correctOption: 2,
    explanation: "Modulus returns the remainder of division.",
    points: 1,
    category: "Easy \xB7 C / Python Operators"
  },
  {
    code: "E9",
    roundNumber: 1,
    prompt: "Find the next number in the aptitude series: 3, 6, 9, 12, ?",
    options: ["14", "15", "16", "18"],
    correctOption: 1,
    explanation: "Multiples of 3 (+3 each step).",
    points: 1,
    category: "Easy \xB7 Quantitative Aptitude"
  },
  {
    code: "E10",
    roundNumber: 1,
    prompt: "Which symbol is used to start a single-line comment in C and Java?",
    options: ["#", "//", "<!--", "**"],
    correctOption: 1,
    explanation: "// starts a single-line comment in C, C++, and Java.",
    points: 1,
    category: "Easy \xB7 C / Java Syntax"
  },
  // --- MODERATE TIER (10 Questions × 1 Mark) ---
  {
    code: "R1_M1",
    roundNumber: 1,
    prompt: "If a train travels 120 km in 2 hours at a constant speed, how far will it travel in 3.5 hours?",
    options: ["180 km", "200 km", "210 km", "240 km"],
    correctOption: 2,
    explanation: "Speed = 60 km/h; 60 \xD7 3.5 = 210 km.",
    points: 1,
    category: "Moderate \xB7 Quantitative Aptitude"
  },
  {
    code: "R1_M2",
    roundNumber: 1,
    prompt: 'What is the output of the following C code?\n\nint x = 4;\nint y = ++x * 2;\nprintf("%d", y);',
    options: ["8", "9", "10", "12"],
    correctOption: 2,
    explanation: "Pre-increment makes x = 5 first, then 5 * 2 = 10.",
    points: 1,
    category: "Moderate \xB7 C Programming"
  },
  {
    code: "R1_M3",
    roundNumber: 1,
    prompt: 'What is the output of the following Python slice?\n\ns = "TECH_ARENA"\nprint(s[1:4])',
    options: ["TEC", "ECH", "ECH_", "TECH"],
    correctOption: 1,
    explanation: "Indices 1, 2, 3 correspond to E, C, H.",
    points: 1,
    category: "Moderate \xB7 Python Strings"
  },
  {
    code: "R1_M4",
    roundNumber: 1,
    prompt: "In a class of 40 students, 60% passed an aptitude test. How many students did NOT pass?",
    options: ["12", "16", "20", "24"],
    correctOption: 1,
    explanation: "40% of 40 = 16.",
    points: 1,
    category: "Moderate \xB7 Quantitative Aptitude"
  },
  {
    code: "R1_M5",
    roundNumber: 1,
    prompt: "Which data structure operates on a Last-In, First-Out (LIFO) principle?",
    options: ["Queue", "Stack", "Linked List", "Binary Search Tree"],
    correctOption: 1,
    explanation: "Stack follows Last-In, First-Out.",
    points: 1,
    category: "Moderate \xB7 Data Structures"
  },
  {
    code: "R1_M6",
    roundNumber: 1,
    prompt: "Find the odd one out from the following programming terms:",
    options: ["while", "for", "do-while", "switch"],
    correctOption: 3,
    explanation: "switch is a conditional branching statement, whereas the others are loops.",
    points: 1,
    category: "Moderate \xB7 Logical Reasoning"
  },
  {
    code: "R1_M7",
    roundNumber: 1,
    prompt: "What is the result of the bitwise XOR expression 5 ^ 3 in C / Python?",
    options: ["2", "6", "7", "1"],
    correctOption: 1,
    explanation: "101 XOR 011 = 110 (6 in decimal).",
    points: 1,
    category: "Moderate \xB7 Bitwise Logic"
  },
  {
    code: "R1_M8",
    roundNumber: 1,
    prompt: "If CODING is coded as DPEJOH in a certain cipher, how is LOGIC coded?",
    options: ["MPHJF", "MPHJD", "LPHJD", "MQHJD"],
    correctOption: 1,
    explanation: "Each letter is shifted forward by +1 in the alphabet.",
    points: 1,
    category: "Moderate \xB7 Verbal & Logical Aptitude"
  },
  {
    code: "R1_M9",
    roundNumber: 1,
    prompt: "Which SQL clause is used to filter groups created by a GROUP BY clause?",
    options: ["WHERE", "ORDER BY", "HAVING", "DISTINCT"],
    correctOption: 2,
    explanation: "HAVING filters grouped aggregate results.",
    points: 1,
    category: "Moderate \xB7 DBMS & SQL"
  },
  {
    code: "R1_M10",
    roundNumber: 1,
    prompt: 'What is the output of print(bool("False")) in Python?',
    options: ["False", "True", "None", "ValueError"],
    correctOption: 1,
    explanation: "Any non-empty string in Python evaluates to True.",
    points: 1,
    category: "Moderate \xB7 Python Language"
  },
  // --- HARD TIER (10 Questions × 1 Mark) ---
  {
    code: "R1_H1",
    roundNumber: 1,
    prompt: "A can complete a coding module in 12 days and B can complete the same module in 24 days. If they work together, how many days will it take to finish?",
    options: ["6 days", "8 days", "9 days", "10 days"],
    correctOption: 1,
    explanation: "Combined rate = 1/12 + 1/24 = 3/24 = 1/8 -> 8 days.",
    points: 1,
    category: "Hard \xB7 Quantitative Aptitude"
  },
  {
    code: "R1_H2",
    roundNumber: 1,
    prompt: 'What is the output of the following C code?\n\nint a = 1, b = 2, c = 3;\nint res = a++ && --b && ++c;\nprintf("%d %d %d %d", a, b, c, res);',
    options: ["2 1 4 1", "2 1 3 0", "1 1 4 1", "2 2 4 1"],
    correctOption: 0,
    explanation: "a++ evaluates to 1 (truthy, a becomes 2), --b evaluates to 1 (truthy), ++c evaluates to 4 (truthy), so res is 1.",
    points: 1,
    category: "Hard \xB7 C Short-Circuit Evaluation"
  },
  {
    code: "R1_H3",
    roundNumber: 1,
    prompt: "What is the time complexity of finding an element in a balanced Binary Search Tree (BST) with n nodes in the worst case?",
    options: ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
    correctOption: 1,
    explanation: "A balanced BST has height O(log n).",
    points: 1,
    category: "Hard \xB7 Algorithms & Complexity"
  },
  {
    code: "R1_H4",
    roundNumber: 1,
    prompt: "Find the missing number in the series: 2, 5, 11, 23, 47, ?",
    options: ["93", "94", "95", "96"],
    correctOption: 2,
    explanation: "Pattern is \xD72 + 1 at each step: 47 \xD7 2 + 1 = 95.",
    points: 1,
    category: "Hard \xB7 Logical Series Aptitude"
  },
  {
    code: "R1_H5",
    roundNumber: 1,
    prompt: "What will be printed by the following Python code?\n\nx = [1, 2, 3]\ny = x\ny.append(4)\nprint(len(x))",
    options: ["3", "4", "1", "TypeError"],
    correctOption: 1,
    explanation: "x and y reference the same list object in memory.",
    points: 1,
    category: "Hard \xB7 Python Memory Model"
  },
  {
    code: "R1_H6",
    roundNumber: 1,
    prompt: "How many handshakes occur if 8 software engineers in a room each shake hands with every other engineer exactly once?",
    options: ["24", "28", "32", "56"],
    correctOption: 1,
    explanation: "n(n - 1) / 2 = 8 \xD7 7 / 2 = 28.",
    points: 1,
    category: "Hard \xB7 Combinatorics Aptitude"
  },
  {
    code: "R1_H7",
    roundNumber: 1,
    prompt: 'What is the output of the following C code?\n\nint arr[] = {10, 20, 30, 40};\nint *p = arr;\nprintf("%d", *(p + 2));',
    options: ["10", "20", "30", "40"],
    correctOption: 2,
    explanation: "Pointer arithmetic *(p + 2) accesses arr[2], which is 30.",
    points: 1,
    category: "Hard \xB7 C Pointers"
  },
  {
    code: "R1_H8",
    roundNumber: 1,
    prompt: "In an IPv4 Class C network with default subnet mask 255.255.255.0, how many usable host IP addresses are available?",
    options: ["254", "255", "256", "512"],
    correctOption: 0,
    explanation: "2^8 - 2 (excluding network and broadcast addresses) = 254.",
    points: 1,
    category: "Hard \xB7 Computer Networks"
  },
  {
    code: "R1_H9",
    roundNumber: 1,
    prompt: "If the ratio of the ages of two developers is 3:5 and the sum of their ages is 48 years, what will be the ratio of their ages after 6 years?",
    options: ["2:3", "4:5", "3:4", "5:7"],
    correctOption: 0,
    explanation: "Current ages: 18 and 30. After 6 years: 24 and 36 -> 24:36 = 2:3.",
    points: 1,
    category: "Hard \xB7 Quantitative Aptitude"
  },
  {
    code: "R1_H10",
    roundNumber: 1,
    prompt: "How many total nodes are present in a complete and full binary tree of height h (where a single root node has height 0)?",
    options: ["2^h", "2^(h+1) - 1", "2^h - 1", "h^2 + 1"],
    correctOption: 1,
    explanation: "A full binary tree of height h has 1 + 2 + 4 + ... + 2^h = 2^(h+1) - 1 nodes.",
    points: 1,
    category: "Hard \xB7 Data Structures & Trees"
  },
  // ==========================================
  // ROUND 2 — TECHNICAL QUESTIONS POOL (30 questions, 300 marks total)
  // SET A: Easy (10 × 5 Marks) | SET B: Moderate (10 × 10 Marks) | SET C: Difficult (10 × 15 Marks)
  // ==========================================
  // --- SET A — EASY (10 Questions × 5 Marks) ---
  {
    code: "Q1",
    roundNumber: 2,
    prompt: `What is the output?

int a = 5;
int b = 2;
printf("%d", a * b + a);

Clue: Follow the order of arithmetic operations.`,
    options: ["10", "15", "17", "25"],
    correctOption: 1,
    explanation: "Clue: Follow the order of arithmetic operations. Multiplication happens first (5 * 2 = 10), then addition (10 + 5 = 15). Exact Answer: 15.",
    points: 5,
    category: "Set A (Easy) \xB7 Output Prediction"
  },
  {
    code: "Q2",
    roundNumber: 2,
    prompt: `What will be the output?

int x = 10;
if(x % 2 == 0)
    printf("Even");
else
    printf("Odd");

Clue: % gives the remainder.`,
    options: ["Odd", "Even", "0", "Compilation Error"],
    correctOption: 1,
    explanation: 'Clue: % gives the remainder. Since 10 % 2 == 0, the condition is true and "Even" is printed. Exact Answer: Even.',
    points: 5,
    category: "Set A (Easy) \xB7 C Programming"
  },
  {
    code: "Q3",
    roundNumber: 2,
    prompt: `Convert the binary number 10110 into decimal.

Clue: Use powers of 2 from right to left.`,
    options: ["18", "20", "22", "26"],
    correctOption: 2,
    explanation: "Clue: Use powers of 2 from right to left (1\xD716 + 0\xD78 + 1\xD74 + 1\xD72 + 0\xD71 = 22). Exact Answer: 22.",
    points: 5,
    category: "Set A (Easy) \xB7 Number System"
  },
  {
    code: "Q4",
    roundNumber: 2,
    prompt: `How many times will Hello be printed?

for(int i = 1; i <= 10; i += 2)
{
    printf("Hello ");
}

Clue: Write the values taken by i.`,
    options: ["4 times", "5 times", "6 times", "10 times"],
    correctOption: 1,
    explanation: "Clue: Write the values taken by i (1, 3, 5, 7, 9). Exact Answer: 5 times.",
    points: 5,
    category: "Set A (Easy) \xB7 Loop"
  },
  {
    code: "Q5",
    roundNumber: 2,
    prompt: `What is the output?

x = 10
y = 3

print(x // y)
print(x % y)

Clue: // gives the quotient and % gives the remainder.`,
    options: ["3.33 and 1", "3 and 1", "3 and 0", "4 and 1"],
    correctOption: 1,
    explanation: "Clue: // gives the quotient (10 // 3 = 3) and % gives the remainder (10 % 3 = 1). Exact Answer: 3 and 1.",
    points: 5,
    category: "Set A (Easy) \xB7 Python"
  },
  {
    code: "Q6",
    roundNumber: 2,
    prompt: `Which key uniquely identifies each record in a table?

Clue: Think of a unique student ID.`,
    options: ["Foreign Key", "Primary Key", "Candidate Key", "Composite Key"],
    correctOption: 1,
    explanation: "Clue: Think of a unique student ID. Exact Answer: B) Primary Key.",
    points: 5,
    category: "Set A (Easy) \xB7 DBMS"
  },
  {
    code: "Q7",
    roundNumber: 2,
    prompt: `Which component temporarily stores data and programs currently being used by the CPU?

Clue: Its contents are lost when power is switched off.`,
    options: ["Hard Disk", "RAM", "ROM", "Pen Drive"],
    correctOption: 1,
    explanation: "Clue: Its contents are lost when power is switched off. Exact Answer: RAM.",
    points: 5,
    category: "Set A (Easy) \xB7 Computer Fundamentals"
  },
  {
    code: "Q8",
    roundNumber: 2,
    prompt: `Which HTML tag is used to create a hyperlink?

Clue: Think of the anchor element.`,
    options: ["<link>", "<a>", "<href>", "<url>"],
    correctOption: 1,
    explanation: "Clue: Think of the anchor element. Exact Answer: <a>.",
    points: 5,
    category: "Set A (Easy) \xB7 HTML"
  },
  {
    code: "Q9",
    roundNumber: 2,
    prompt: `Find the next number:
2, 6, 12, 20, 30, ?

Clue: Look at the differences.`,
    options: ["38", "40", "42", "44"],
    correctOption: 2,
    explanation: "Clue: Look at the differences (+4, +6, +8, +10, +12). 30 + 12 = 42. Exact Answer: 42.",
    points: 5,
    category: "Set A (Easy) \xB7 Logic"
  },
  {
    code: "Q10",
    roundNumber: 2,
    prompt: `What is the output?

int a = 10;
printf("%d", a++);

Clue: ++ is a post-increment operator.`,
    options: ["10", "11", "9", "Compilation Error"],
    correctOption: 0,
    explanation: "Clue: ++ is a post-increment operator, so 10 is printed before a is incremented. Exact Answer: 10.",
    points: 5,
    category: "Set A (Easy) \xB7 C Programming"
  },
  // --- SET B — MODERATE (10 Questions × 10 Marks) ---
  {
    code: "Q11",
    roundNumber: 2,
    prompt: `What is the output?

int x = 1;
for(int i = 1; i <= 3; i++)
{
    x = x * 2;
}
printf("%d", x);

Clue: The multiplication happens three times.`,
    options: ["6", "8", "4", "16"],
    correctOption: 1,
    explanation: "Clue: The multiplication happens three times (1 -> 2 -> 4 -> 8). Exact Answer: 8.",
    points: 10,
    category: "Set B (Moderate) \xB7 Output Prediction"
  },
  {
    code: "Q12",
    roundNumber: 2,
    prompt: `Find the second-largest distinct number:
12, 5, 18, 18, 9, 15

Clue: Do not count 18 twice.`,
    options: ["18", "15", "12", "9"],
    correctOption: 1,
    explanation: "Clue: Do not count 18 twice. The largest is 18, and the second-largest distinct number is 15. Exact Answer: 15.",
    points: 10,
    category: "Set B (Moderate) \xB7 Array"
  },
  {
    code: "Q13",
    roundNumber: 2,
    prompt: `What is the output?

int a = 5;
int b = 10;

a = b;
b = a;

printf("%d %d", a, b);

Clue: Track the values after each assignment.`,
    options: ["5 10", "10 5", "10 10", "5 5"],
    correctOption: 2,
    explanation: "Clue: Track the values after each assignment. First a becomes 10, then b becomes a (10). Exact Answer: 10 10.",
    points: 10,
    category: "Set B (Moderate) \xB7 C Programming"
  },
  {
    code: "Q14",
    roundNumber: 2,
    prompt: `What is the output?

a = [10, 20, 30, 40]
print(a[1] + a[-1])

Clue: -1 refers to the last element.`,
    options: ["50", "60", "70", "30"],
    correctOption: 1,
    explanation: "Clue: -1 refers to the last element. a[1] is 20 and a[-1] is 40, giving 60. Exact Answer: 60.",
    points: 10,
    category: "Set B (Moderate) \xB7 Python List"
  },
  {
    code: "Q15",
    roundNumber: 2,
    prompt: `Consider the table Student:
Name \u2014 Marks
Ravi \u2014 75
Anu \u2014 90
Kiran \u2014 65
Meena \u2014 90

What will this query return?
SELECT COUNT(*) FROM Student WHERE Marks >= 75;

Clue: Count the students satisfying the condition.`,
    options: ["2", "3", "4", "1"],
    correctOption: 1,
    explanation: "Clue: Count the students satisfying the condition (Ravi, Anu, Meena = 3). Exact Answer: 3.",
    points: 10,
    category: "Set B (Moderate) \xB7 SQL"
  },
  {
    code: "Q16",
    roundNumber: 2,
    prompt: `What is the main purpose of binary search?

Clue: Binary search repeatedly divides the search space.`,
    options: [
      "Sort an array",
      "Search efficiently in a sorted array",
      "Reverse an array",
      "Find duplicate elements"
    ],
    correctOption: 1,
    explanation: "Clue: Binary search repeatedly divides the search space. Exact Answer: B) Search efficiently in a sorted array.",
    points: 10,
    category: "Set B (Moderate) \xB7 Algorithm"
  },
  {
    code: "Q17",
    roundNumber: 2,
    prompt: `What is the decimal value of 1101\u2082?

Clue: 1\xD78 + 1\xD74 + 0\xD72 + 1\xD71.`,
    options: ["11", "12", "13", "15"],
    correctOption: 2,
    explanation: "Clue: 1\xD78 + 1\xD74 + 0\xD72 + 1\xD71 = 13. Exact Answer: 13.",
    points: 10,
    category: "Set B (Moderate) \xB7 Number System"
  },
  {
    code: "Q18",
    roundNumber: 2,
    prompt: `Find the error:

int x = 10;
if(x > 5)
{
    printf("Greater")
}

Clue: Look at the end of the printf statement.`,
    options: [
      "Condition must use ==",
      "A semicolon (;) is missing.",
      "Variable x is not initialized",
      "Curly braces are invalid"
    ],
    correctOption: 1,
    explanation: "Clue: Look at the end of the printf statement. Exact Answer: A semicolon (;) is missing.",
    points: 10,
    category: "Set B (Moderate) \xB7 Debugging"
  },
  {
    code: "Q19",
    roundNumber: 2,
    prompt: `Which device is primarily used to connect different networks and forward packets between them?

Clue: Your home network uses one to connect to the Internet.`,
    options: ["Switch", "Router", "Hub", "Repeater"],
    correctOption: 1,
    explanation: "Clue: Your home network uses one to connect to the Internet. Exact Answer: Router.",
    points: 10,
    category: "Set B (Moderate) \xB7 Networking"
  },
  {
    code: "Q20",
    roundNumber: 2,
    prompt: `What is the output?

x = 5
for i in range(1, 4):
    x = x + i
print(x)

Clue: range(1,4) gives 1, 2, 3.`,
    options: ["9", "10", "11", "15"],
    correctOption: 2,
    explanation: "Clue: range(1,4) gives 1, 2, 3. 5 + 1 + 2 + 3 = 11. Exact Answer: 11.",
    points: 10,
    category: "Set B (Moderate) \xB7 Logic + Programming"
  },
  // --- SET C — DIFFICULT (10 Questions × 15 Marks) ---
  {
    code: "Q21",
    roundNumber: 2,
    prompt: `Given [3, 4, -1, 1, 2, 6], find the smallest positive integer that is missing.

Clue: Start checking from 1.`,
    options: ["0", "5", "7", "2"],
    correctOption: 1,
    explanation: "Clue: Start checking from 1. 1, 2, 3, 4 are present; 5 is missing. Exact Answer: 5.",
    points: 15,
    category: "Set C (Difficult) \xB7 Array Problem"
  },
  {
    code: "Q22",
    roundNumber: 2,
    prompt: `What is the output?

int count = 0;
for(int i = 1; i <= 3; i++)
{
    for(int j = 1; j <= i; j++)
    {
        count++;
    }
}
printf("%d", count);

Clue: Count the inner-loop executions for each value of i.`,
    options: ["3", "6", "9", "4"],
    correctOption: 1,
    explanation: "Clue: Count the inner-loop executions for each value of i (1 + 2 + 3 = 6). Exact Answer: 6.",
    points: 15,
    category: "Set C (Difficult) \xB7 C \u2014 Nested Loops"
  },
  {
    code: "Q23",
    roundNumber: 2,
    prompt: `Given employee salaries: 25000, 40000, 35000, 50000, 40000. What is the second-highest distinct salary?

Clue: Ignore duplicate salaries.`,
    options: ["50000", "40000", "35000", "25000"],
    correctOption: 1,
    explanation: "Clue: Ignore duplicate salaries. Highest is 50000, second-highest distinct is 40000. Exact Answer: 40000.",
    points: 15,
    category: "Set C (Difficult) \xB7 SQL"
  },
  {
    code: "Q24",
    roundNumber: 2,
    prompt: `What is the output?

int fun(int n)
{
    if(n == 0)
        return 1;
    return n * fun(n - 1);
}
printf("%d", fun(4));

Clue: Expand the function until n becomes 0.`,
    options: ["12", "16", "24", "120"],
    correctOption: 2,
    explanation: "Clue: Expand the function until n becomes 0 (4 \xD7 3 \xD7 2 \xD7 1 \xD7 1 = 24). Exact Answer: 24.",
    points: 15,
    category: "Set C (Difficult) \xB7 Recursion"
  },
  {
    code: "Q25",
    roundNumber: 2,
    prompt: `An array contains [2, 7, 11, 15, 3, 6]. Find all pairs whose sum is 9.

Clue: Check which number each element needs to reach 9.`,
    options: ["(2,7) only", "(2,7) and (3,6)", "(3,6) and (2,11)", "(7,11) and (3,6)"],
    correctOption: 1,
    explanation: "Clue: Check which number each element needs to reach 9. Exact Answer: (2,7) and (3,6).",
    points: 15,
    category: "Set C (Difficult) \xB7 Algorithm"
  },
  {
    code: "Q26",
    roundNumber: 2,
    prompt: `What is the output?

int x = 5;
if(x > 3)
{
    if(x < 10)
        printf("A");
    else
        printf("B");
}
else
{
    printf("C");
}

Clue: Both conditions must be checked.`,
    options: ["A", "B", "C", "AB"],
    correctOption: 0,
    explanation: "Clue: Both conditions must be checked (5 > 3 and 5 < 10). Exact Answer: A.",
    points: 15,
    category: "Set C (Difficult) \xB7 C Output"
  },
  {
    code: "Q27",
    roundNumber: 2,
    prompt: `Which normal form removes partial dependency?

Clue: Think about dependencies on part of a composite key.`,
    options: ["1NF", "2NF", "3NF", "BCNF"],
    correctOption: 1,
    explanation: "Clue: Think about dependencies on part of a composite key. Exact Answer: B) 2NF.",
    points: 15,
    category: "Set C (Difficult) \xB7 DBMS"
  },
  {
    code: "Q28",
    roundNumber: 2,
    prompt: `A program has CPU burst = 5 ms, I/O burst = 10 ms, CPU burst = 3 ms. Ignoring context-switching time, what is the total CPU time required?

Clue: Add only the CPU bursts.`,
    options: ["8 ms", "15 ms", "18 ms", "5 ms"],
    correctOption: 0,
    explanation: "Clue: Add only the CPU bursts (5 ms + 3 ms = 8 ms). Exact Answer: 8 ms.",
    points: 15,
    category: "Set C (Difficult) \xB7 Operating System"
  },
  {
    code: "Q29",
    roundNumber: 2,
    prompt: `Find the next number:
1, 2, 6, 24, 120, ?

Clue: Each number is multiplied by an increasing integer.`,
    options: ["240", "600", "720", "840"],
    correctOption: 2,
    explanation: "Clue: Each number is multiplied by an increasing integer (\xD72, \xD73, \xD74, \xD75, \xD76 -> 120 \xD7 6 = 720). Exact Answer: 720.",
    points: 15,
    category: "Set C (Difficult) \xB7 Number + Logic"
  },
  {
    code: "Q30",
    roundNumber: 2,
    prompt: `What is the output?

x = 0
for i in range(1, 6):
    if i % 2 == 0:
        x = x + i
    else:
        x = x - i
print(x)

Clue: Process 1, 2, 3, 4, 5 one at a time.`,
    options: ["-3", "3", "-5", "1"],
    correctOption: 0,
    explanation: "Clue: Process 1, 2, 3, 4, 5 one at a time (-1 + 2 - 3 + 4 - 5 = -3). Exact Answer: -3.",
    points: 15,
    category: "Set C (Difficult) \xB7 Programming Logic \u2014 Challenge"
  },
  // ==========================================
  // ROUND 3 — CODING PROBLEMS (9 Problems: 3 Easy, 3 Moderate, 3 Hard)
  // ==========================================
  // --- EASY TIER (Focus: loops, conditions, arrays, and strings) ---
  {
    code: "R3_E1",
    roundNumber: 3,
    type: "code",
    prompt: `1. The Missing Number
Write a program that reads N and N\u22121 distinct integers from the range 1 to N. Print the missing number.

Sample Input:
5
1 2 4 5

Sample Output:
3

Constraints: 2 \u2264 N \u2264 100,000`,
    codeStarter: `// 1. The Missing Number (Easy)
// Write your solution in Python, C, C++, Java, or JavaScript

def solve():
    n = int(input().strip())
    arr = list(map(int, input().split()))
    # Write your logic here to print the missing number
    pass

if __name__ == "__main__":
    solve()`,
    explanation: "Expected sum of 1..N is N*(N+1)//2. Subtract the sum of the N-1 input integers to find the missing number in O(N) time.",
    points: 5,
    category: "Easy \xB7 Arrays & Loops"
  },
  {
    code: "R3_E2",
    roundNumber: 3,
    type: "code",
    prompt: `2. Count the Vowels
Write a program that counts the vowels (A, E, I, O, U) in a given line of text. Uppercase and lowercase vowels both count.

Sample Input:
Tech Arena

Sample Output:
4

Constraints: Text length: 1 to 10,000 characters`,
    codeStarter: `// 2. Count the Vowels (Easy)
// Write your solution in Python, C, C++, Java, or JavaScript

def solve():
    text = input()
    # Count uppercase and lowercase vowels (A, E, I, O, U)
    pass

if __name__ == "__main__":
    solve()`,
    explanation: "Iterate over each character in the input line and count characters that match A, E, I, O, U (case-insensitive).",
    points: 5,
    category: "Easy \xB7 Strings & Conditions"
  },
  {
    code: "R3_E3",
    roundNumber: 3,
    type: "code",
    prompt: `3. Second Largest Distinct Number
Write a program to print the second-largest distinct value in an array. If no second-largest distinct value exists, print -1.

Sample Input:
6
4 9 9 2 7 7

Sample Output:
7

Constraints: 1 \u2264 N \u2264 100,000`,
    codeStarter: `// 3. Second Largest Distinct Number (Easy)
// Write your solution in Python, C, C++, Java, or JavaScript

def solve():
    n = int(input().strip())
    arr = list(map(int, input().split()))
    # Print the second-largest distinct value, or -1 if none exists
    pass

if __name__ == "__main__":
    solve()`,
    explanation: "Track the largest and second-largest distinct values in a single traversal, ignoring duplicate occurrences of the largest number.",
    points: 5,
    category: "Easy \xB7 Array Traversal"
  },
  // --- MODERATE TIER (Focus: stacks, frequency counting, and array traversal) ---
  {
    code: "R3_M1",
    roundNumber: 3,
    type: "code",
    prompt: `4. Balanced Brackets
Write a program that checks whether a string containing only (), [] and {} has correctly matched and ordered brackets. Print YES if balanced; otherwise print NO.

Sample Input:
{[()]}

Sample Output:
YES

Constraints: String length: 1 to 100,000`,
    codeStarter: `// 4. Balanced Brackets (Moderate)
// Write your solution in Python, C, C++, Java, or JavaScript

def solve():
    s = input().strip()
    # Check whether (), [], {} are balanced. Print YES or NO
    pass

if __name__ == "__main__":
    solve()`,
    explanation: "Use a stack to push opening brackets and match closing brackets against the top of the stack. Output YES if valid and stack is empty at the end, else NO.",
    points: 10,
    category: "Moderate \xB7 Stacks & Strings"
  },
  {
    code: "R3_M2",
    roundNumber: 3,
    type: "code",
    prompt: `5. Longest Increasing Segment
Given an array, print the length of the longest contiguous segment in which every number is strictly greater than the previous number.

Sample Input:
7
1 2 2 3 4 5 1

Sample Output:
4

Constraints: 1 \u2264 N \u2264 200,000`,
    codeStarter: `// 5. Longest Increasing Segment (Moderate)
// Write your solution in Python, C, C++, Java, or JavaScript

def solve():
    n = int(input().strip())
    arr = list(map(int, input().split()))
    # Print the length of the longest strictly increasing contiguous segment
    pass

if __name__ == "__main__":
    solve()`,
    explanation: "Scan the array once, incrementing current streak when arr[i] > arr[i-1] and resetting to 1 otherwise, tracking the maximum length seen.",
    points: 10,
    category: "Moderate \xB7 Array Traversal"
  },
  {
    code: "R3_M3",
    roundNumber: 3,
    type: "code",
    prompt: `6. First Non-Repeating Character
Print the first character in a string that occurs exactly once. Treat uppercase and lowercase as different characters. If none exists, print -1.

Sample Input:
swiss

Sample Output:
w

Constraints: String length: 1 to 100,000`,
    codeStarter: `// 6. First Non-Repeating Character (Moderate)
// Write your solution in Python, C, C++, Java, or JavaScript

def solve():
    s = input().strip()
    # Print the first character that occurs exactly once, or -1
    pass

if __name__ == "__main__":
    solve()`,
    explanation: "Count character frequencies in a hash map or array first, then iterate through the string to find the first character with frequency 1.",
    points: 10,
    category: "Moderate \xB7 Frequency Counting"
  },
  // --- HARD TIER (Focus: dynamic programming, graph traversal, and efficient algorithms) ---
  {
    code: "R3_H1",
    roundNumber: 3,
    type: "code",
    prompt: `7. Minimum Coins
Given coin denominations and a target amount, find the minimum number of coins needed. You may use each denomination unlimited times. Print -1 if the amount cannot be formed.

Sample Input:
3 11
1 5 7

Sample Output:
3

Constraints: 1 \u2264 number of denominations \u2264 100; target amount \u2264 100,000`,
    codeStarter: `// 7. Minimum Coins (Hard)
// Write your solution in Python, C, C++, Java, or JavaScript

def solve():
    n, target = map(int, input().split())
    coins = list(map(int, input().split()))
    # Find the minimum number of coins needed to form target, or print -1
    pass

if __name__ == "__main__":
    solve()`,
    explanation: "Use Bottom-Up Dynamic Programming: dp[a] = min(dp[a], dp[a - coin] + 1) for each coin denomination up to target amount.",
    points: 15,
    category: "Hard \xB7 Dynamic Programming"
  },
  {
    code: "R3_H2",
    roundNumber: 3,
    type: "code",
    prompt: `8. Shortest Path in a Grid
A grid uses 0 for open cells and 1 for blocked cells. Starting at the top-left cell, find the minimum number of up/down/left/right moves to reach the bottom-right cell. Print -1 if no path exists or an endpoint is blocked. Count moves, not cells.

Sample Input:
3 3
0 0 1
1 0 0
0 0 0

Sample Output:
4

Constraints: 1 \u2264 rows, columns \u2264 500`,
    codeStarter: `// 8. Shortest Path in a Grid (Hard)
// Write your solution in Python, C, C++, Java, or JavaScript

from collections import deque

def solve():
    r, c = map(int, input().split())
    grid = [list(map(int, input().split())) for _ in range(r)]
    # Find minimum moves from (0,0) to (r-1,c-1) using BFS, or print -1
    pass

if __name__ == "__main__":
    solve()`,
    explanation: "Use Breadth-First Search (BFS) starting from (0,0) if open. Explore 4-directional neighbors with value 0 and return the shortest move count to (rows-1, cols-1).",
    points: 15,
    category: "Hard \xB7 Graph Traversal (BFS)"
  },
  {
    code: "R3_H3",
    roundNumber: 3,
    type: "code",
    prompt: `9. Maximum Sum Subarray
Given an array containing positive, negative or zero integers, find the maximum sum of any non-empty contiguous subarray.

Sample Input:
8
-2 -3 4 -1 -2 1 5 -3

Sample Output:
7

Constraints: 1 \u2264 N \u2264 200,000; each value is between -10^9 and 10^9`,
    codeStarter: `// 9. Maximum Sum Subarray (Hard)
// Write your solution in Python, C, C++, Java, or JavaScript

def solve():
    n = int(input().strip())
    arr = list(map(int, input().split()))
    # Find the maximum sum of any non-empty contiguous subarray
    pass

if __name__ == "__main__":
    solve()`,
    explanation: "Apply Kadane's algorithm in O(N) time using 64-bit integers: maintain current_sum = max(x, current_sum + x) and best_sum = max(best_sum, current_sum).",
    points: 15,
    category: "Hard \xB7 Kadane's Algorithm"
  }
];
async function seedTournamentDatabase() {
  try {
    const existingEvents = await db.query.events.findMany();
    if (existingEvents.length === 0) {
      await db.insert(events).values({
        title: "TECH ARENA 2026 \u2014 Inter-College Technical Championship",
        description: "Elite three-round inter-collegiate technical championship: Round 1 (Easy, Moderate & Hard MCQs), Round 2 (Technical Question Pool: Set A, Set B, Set C), and Round 3 (Coding Problems: Easy, Moderate & Hard).",
        bannerUrl: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80",
        isActive: true
      });
    }
    const existingSettings = await db.query.competitionSettings.findMany();
    if (existingSettings.length === 0) {
      await db.insert(competitionSettings).values({
        competitionStatus: "active",
        registrationOpen: true,
        fullscreenEnforcement: true,
        strictFocusEnforcement: true,
        heartbeatIntervalSec: 10,
        heartbeatStaleThresholdSec: 30,
        leaderboardFrozen: false,
        publishedFinal: false
      });
    }
    const competitionRoundsDef = [
      {
        roundNumber: 1,
        difficulty: "easy",
        title: "Round 1 \u2014 MIXED APTITUDE & COMPUTER MCQs",
        description: "30 jumbled questions (Easy, Moderate & Hard) \xB7 20 minutes limit \xB7 1 mark per correct answer (30 marks max). Participants can freely choose questions by difficulty level or order.",
        durationMinutes: 20,
        qualifyingPercentage: 60,
        maxScore: 30,
        maxViolations: 2,
        isOpen: true,
        isPublished: true,
        orderIndex: 1
      },
      {
        roundNumber: 2,
        difficulty: "medium",
        title: "Round 2 \u2014 TECHNICAL QUESTION & ANSWER (Q&A)",
        description: "30 Direct Question & Answer problems (No MCQs \u2014 Type your answer in the answer box) \xB7 30 minutes limit \xB7 Set A Easy (10 \xD7 5 Marks), Set B Moderate (10 \xD7 10 Marks), Set C Difficult (10 \xD7 15 Marks) \u2014 300 marks max.",
        durationMinutes: 30,
        qualifyingPercentage: 60,
        maxScore: 300,
        maxViolations: 2,
        isOpen: true,
        isPublished: true,
        orderIndex: 2
      },
      {
        roundNumber: 3,
        difficulty: "hard",
        title: "Round 3 \u2014 CODING PROBLEMS",
        description: "9 coding problems (3 Easy \xD7 5 Marks, 3 Moderate \xD7 10 Marks, 3 Hard \xD7 15 Marks \u2014 90 marks max) \xB7 45 minutes limit. Topics: Arrays, Strings, Stacks, Frequency Counting, Dynamic Programming, BFS Grid Traversal, and Kadane's Algorithm.",
        durationMinutes: 45,
        qualifyingPercentage: 60,
        maxScore: 90,
        maxViolations: 2,
        isOpen: true,
        isPublished: true,
        orderIndex: 3
      }
    ];
    for (const rDef of competitionRoundsDef) {
      const existing = await db.query.rounds.findFirst({
        where: eq2(rounds.roundNumber, rDef.roundNumber)
      });
      if (!existing) {
        await db.insert(rounds).values(rDef);
      } else {
        const nextMaxScore = existing.roundNumber === 1 && existing.maxScore === 8 ? rDef.maxScore : existing.roundNumber === 3 && existing.maxScore === 30 ? rDef.maxScore : existing.maxScore || rDef.maxScore;
        await db.update(rounds).set({
          title: rDef.title,
          description: rDef.description,
          difficulty: rDef.difficulty,
          maxScore: nextMaxScore
        }).where(eq2(rounds.id, existing.id));
      }
    }
    await syncAllCompetitionQuestions();
  } catch (error) {
    console.error("seedTournamentDatabase error:", error);
  }
}
async function syncAllCompetitionQuestions() {
  try {
    const allRounds = await db.query.rounds.findMany();
    const roundMap = /* @__PURE__ */ new Map();
    for (const r of allRounds) {
      roundMap.set(r.roundNumber, r);
    }
    const activeCodes = new Set(QUESTION_BANK.map((q) => q.code));
    const existingAllQs = await db.query.questions.findMany();
    for (const eqItem of existingAllQs) {
      if (eqItem.code && /^(M|H)\d+$/.test(eqItem.code) && !activeCodes.has(eqItem.code)) {
        await db.update(questions).set({ isActive: false }).where(eq2(questions.id, eqItem.id));
      }
    }
    for (let i = 0; i < QUESTION_BANK.length; i++) {
      const qDef = QUESTION_BANK[i];
      const targetRound = roundMap.get(qDef.roundNumber);
      if (!targetRound) continue;
      const resolvedType = qDef.type || (qDef.roundNumber === 2 ? "qa" : "mcq");
      const existing = await db.query.questions.findFirst({
        where: eq2(questions.code, qDef.code)
      });
      if (!existing) {
        await db.insert(questions).values({
          roundId: targetRound.id,
          code: qDef.code,
          prompt: qDef.prompt,
          type: resolvedType,
          options: qDef.options || [],
          correctOption: qDef.correctOption ?? 0,
          codeStarter: qDef.codeStarter || null,
          explanation: qDef.explanation,
          points: qDef.points,
          orderIndex: i + 1,
          category: qDef.category,
          isActive: true
        });
      } else {
        await db.update(questions).set({
          roundId: targetRound.id,
          prompt: qDef.prompt,
          type: resolvedType,
          options: qDef.options || [],
          correctOption: qDef.correctOption ?? 0,
          codeStarter: qDef.codeStarter || null,
          explanation: qDef.explanation,
          points: qDef.points,
          orderIndex: i + 1,
          category: qDef.category,
          isActive: true
        }).where(eq2(questions.id, existing.id));
      }
    }
  } catch (error) {
    console.error("syncAllCompetitionQuestions error:", error);
  }
}
async function syncRound2Questions() {
  return syncAllCompetitionQuestions();
}

// src/routes/admin.ts
import { Router } from "express";
import { eq as eq3, and as and2 } from "drizzle-orm";
var adminRouter = Router();
var adminRateLimits = /* @__PURE__ */ new Map();
function checkAdminRateLimit(ip) {
  const record = adminRateLimits.get(ip);
  const now = Date.now();
  if (!record) return { allowed: true };
  if (record.lockedUntil && record.lockedUntil > now) {
    return {
      allowed: false,
      waitSeconds: Math.ceil((record.lockedUntil - now) / 1e3)
    };
  }
  if (record.lockedUntil && record.lockedUntil <= now) {
    adminRateLimits.delete(ip);
    return { allowed: true };
  }
  return { allowed: true };
}
function recordFailedAdminAttempt(ip) {
  const record = adminRateLimits.get(ip) || { attempts: 0 };
  record.attempts += 1;
  if (record.attempts >= 5) {
    record.lockedUntil = Date.now() + 2 * 60 * 1e3;
  }
  adminRateLimits.set(ip, record);
}
function resetAdminAttempts(ip) {
  adminRateLimits.delete(ip);
}
adminRouter.post("/auth/admin-login", async (req, res) => {
  try {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const rateCheck = checkAdminRateLimit(ip);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        error: `Too many failed login attempts. Terminal locked for ${rateCheck.waitSeconds} seconds.`,
        locked: true,
        waitSeconds: rateCheck.waitSeconds
      });
    }
    const { passkey, password } = req.body || {};
    const cleanKey = String(password || passkey || "").trim();
    const isAuthorized = verifyAdminPasskey(cleanKey);
    if (!isAuthorized) {
      recordFailedAdminAttempt(ip);
      const remainingAttempts = 5 - (adminRateLimits.get(ip)?.attempts || 0);
      return res.status(401).json({
        error: "Authentication failed. Incorrect administrator password.",
        remainingAttempts: Math.max(0, remainingAttempts)
      });
    }
    resetAdminAttempts(ip);
    let adminUser = await db.query.users.findFirst({
      where: eq3(users.role, "admin")
    });
    if (!adminUser) {
      const [newAdmin] = await db.insert(users).values({
        uid: "admin_matrix_root",
        email: "admin@techarena.edu",
        role: "admin",
        name: "Chief Administrator",
        college: "Tech Arena Directorate",
        teamName: "Tournament Control",
        teamMembers: ["Chief Proctor", "Invigilator Prime"],
        code: "#TA-ADMIN",
        zone: "Central Command",
        isBlocked: false
      }).returning();
      adminUser = newAdmin;
    }
    const token = signAdminToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1e3);
    await db.insert(adminSessions).values({
      token,
      adminId: adminUser.id,
      ip,
      userAgent: req.headers["user-agent"] || "unknown",
      expiresAt,
      isActive: true
    });
    await db.insert(auditLogs).values({
      userId: adminUser.id,
      action: "ADMIN_LOGIN_SUCCESS",
      targetType: "admin_sessions",
      targetId: token,
      metadata: { ip, userAgent: req.headers["user-agent"] }
    });
    res.json({
      token,
      expiresAt: expiresAt.toISOString(),
      user: {
        id: adminUser.id,
        uid: adminUser.uid,
        email: adminUser.email,
        role: "admin",
        name: adminUser.name,
        college: adminUser.college,
        teamName: adminUser.teamName,
        code: adminUser.code,
        zone: adminUser.zone,
        isBlocked: false
      }
    });
  } catch (error) {
    console.error("Admin login error:", error);
    res.status(500).json({ error: "Server authentication failure." });
  }
});
adminRouter.get("/admin/verify-session", requireAuth, requireAdmin, async (req, res) => {
  res.json({
    valid: true,
    user: req.user
  });
});
adminRouter.post("/admin/logout", requireAuth, requireAdmin, async (req, res) => {
  try {
    if (req.adminSessionToken) {
      await db.update(adminSessions).set({ isActive: false }).where(eq3(adminSessions.token, req.adminSessionToken));
    }
    await db.insert(auditLogs).values({
      userId: req.user.id,
      action: "ADMIN_LOGOUT",
      targetType: "admin_sessions",
      targetId: req.adminSessionToken || "unknown"
    });
    res.json({ success: true, message: "Administrator session invalidated." });
  } catch (error) {
    console.error("Admin logout error:", error);
    res.status(500).json({ error: "Failed to terminate session." });
  }
});
adminRouter.get("/admin/overview", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const allParticipants = await db.query.users.findMany({
      where: eq3(users.role, "participant")
    });
    const allSessions = await db.query.participantSessions.findMany();
    const allAttempts = await db.query.quizAttempts.findMany();
    const allAnswers = await db.query.participantAnswers.findMany();
    const allViolations = await db.query.securityViolations.findMany();
    const allAppeals = await db.query.disqualificationReviews.findMany();
    const now = Date.now();
    const heartbeatThresholdMs = 30 * 1e3;
    let loggedInCount = 0;
    let onlineCount = 0;
    let disconnectedCount = 0;
    let explicitlyLoggedOutCount = 0;
    const sessionByUserId = /* @__PURE__ */ new Map();
    for (const s of allSessions) {
      sessionByUserId.set(s.userId, s);
      loggedInCount++;
      const lastHb = new Date(s.lastHeartbeat).getTime();
      const isFresh = now - lastHb <= heartbeatThresholdMs;
      if (s.status === "logged_out") {
        explicitlyLoggedOutCount++;
      } else if (isFresh && s.status === "online") {
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
      if (att.status === "in_progress") activeCompetingCount++;
      if (att.status === "submitted") submittedAttemptsCount++;
      if (att.status === "completed" || att.status === "submitted") completedAttemptsCount++;
      if (att.status === "terminated" || att.status === "disqualified") terminatedAttemptsCount++;
    }
    const blockedCount = allParticipants.filter((p) => p.isBlocked).length;
    const pendingAppealsCount = allAppeals.filter((a) => a.status === "pending").length;
    let acceptedSubmissionsCount = 0;
    let totalPointsAwarded = 0;
    for (const ans of allAnswers) {
      if (ans.isCorrect) {
        acceptedSubmissionsCount++;
        totalPointsAwarded += ans.pointsEarned || 0;
      }
    }
    const avgScore = allParticipants.length > 0 && allAttempts.length > 0 ? Math.round(
      allAttempts.reduce((acc, a) => acc + (a.score || 0), 0) / Math.max(1, allAttempts.length)
    ) : 0;
    const difficultyParticipation = {
      easy: allAttempts.filter((a) => a.roundId === 1).length,
      intermediate: allAttempts.filter((a) => a.roundId === 2).length,
      hard: allAttempts.filter((a) => a.roundId === 3).length
    };
    const scoreDistribution = {
      "0-20": 0,
      "21-40": 0,
      "41-60": 0,
      "61-80": 0,
      "81-100": 0,
      "100+": 0
    };
    for (const att of allAttempts) {
      const s = att.score || 0;
      if (s <= 20) scoreDistribution["0-20"]++;
      else if (s <= 40) scoreDistribution["21-40"]++;
      else if (s <= 60) scoreDistribution["41-60"]++;
      else if (s <= 80) scoreDistribution["61-80"]++;
      else if (s <= 100) scoreDistribution["81-100"]++;
      else scoreDistribution["100+"]++;
    }
    const violationsByType = {};
    for (const v of allViolations) {
      const type = v.violationType || "unknown";
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
      violationsByType
    });
  } catch (error) {
    console.error("Admin overview error:", error);
    res.status(500).json({ error: "Failed to retrieve administrative overview." });
  }
});
adminRouter.get("/admin/participants", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { search, status, difficulty, sort } = req.query;
    const allUsers = await db.query.users.findMany({
      where: eq3(users.role, "participant"),
      with: {
        attempts: {
          with: { round: true }
        }
      },
      orderBy: (users2, { desc: desc2 }) => [desc2(users2.id)]
    });
    const allSessions = await db.query.participantSessions.findMany();
    const allAnswers = await db.query.participantAnswers.findMany();
    const allViolations = await db.query.securityViolations.findMany({
      orderBy: (securityViolations2, { desc: desc2 }) => [desc2(securityViolations2.id)]
    });
    const sessionMap = /* @__PURE__ */ new Map();
    allSessions.forEach((s) => sessionMap.set(s.userId, s));
    const now = Date.now();
    const hbThreshold = 30 * 1e3;
    let roster = allUsers.map((u) => {
      const session = sessionMap.get(u.id);
      const userAttempts = Array.isArray(u.attempts) ? u.attempts : [];
      const userViolations = allViolations.filter((v) => v.userId === u.id);
      let easyScore = 0;
      let intermediateScore = 0;
      let hardScore = 0;
      let totalViolations = userViolations.length;
      let currentAttempt = null;
      for (const att of userAttempts) {
        const rNum = att.round?.roundNumber || att.roundId;
        if (rNum === 1) easyScore = att.score || 0;
        if (rNum === 2) intermediateScore = att.score || 0;
        if (rNum === 3) hardScore = att.score || 0;
        if (att.status === "in_progress" || att.status === "resumed" || att.status === "suspended_awaiting_approval" || att.status === "tab_switch_detected") {
          currentAttempt = att;
        }
      }
      let connectionStatus = "OFFLINE";
      if (session) {
        const lastHb = new Date(session.lastHeartbeat).getTime();
        const isFresh = now - lastHb <= hbThreshold;
        if (session.status === "logged_out") {
          connectionStatus = "LOGGED OUT";
        } else if (isFresh) {
          connectionStatus = "ONLINE";
        } else {
          connectionStatus = "CONNECTION LOST";
        }
      }
      let competitionStatus = "NOT STARTED";
      if (u.isRemoved) {
        competitionStatus = "REMOVED";
      } else if (currentAttempt) {
        if (currentAttempt.status === "suspended_awaiting_approval") {
          competitionStatus = "SUSPENDED \u2014 AWAITING ADMIN APPROVAL";
        } else if (currentAttempt.status === "tab_switch_detected") {
          competitionStatus = "TAB SWITCH DETECTED";
        } else if (currentAttempt.status === "resumed") {
          competitionStatus = "RESUMED";
        } else if (currentAttempt.status === "in_progress") {
          competitionStatus = "IN PROGRESS";
        } else {
          competitionStatus = currentAttempt.status.toUpperCase();
        }
      } else if (u.isBlocked) {
        competitionStatus = "TERMINATED";
      } else {
        const lastAttempt = userAttempts[userAttempts.length - 1];
        if (lastAttempt) {
          if (lastAttempt.status === "terminated") competitionStatus = "TERMINATED";
          else if (lastAttempt.status === "submitted") competitionStatus = "COMPLETED";
          else if (lastAttempt.status === "timed_out") competitionStatus = "TIMED OUT";
          else if (lastAttempt.status === "removed") competitionStatus = "REMOVED";
          else competitionStatus = lastAttempt.status.toUpperCase();
        }
      }
      const userAnswers = allAnswers.filter(
        (a) => userAttempts.some((att) => att.id === a.attemptId)
      );
      const acceptedCount = userAnswers.filter((a) => a.isCorrect).length;
      const failedCount = userAnswers.filter((a) => !a.isCorrect).length;
      let timeRemainingSeconds = 0;
      if (currentAttempt && currentAttempt.serverDeadline) {
        if (currentAttempt.status === "suspended_awaiting_approval") {
          const pauseTime = currentAttempt.pausedAt ? new Date(currentAttempt.pausedAt).getTime() : now;
          timeRemainingSeconds = Math.max(
            0,
            Math.floor((new Date(currentAttempt.serverDeadline).getTime() - pauseTime) / 1e3)
          );
        } else {
          timeRemainingSeconds = Math.max(
            0,
            Math.floor((new Date(currentAttempt.serverDeadline).getTime() - now) / 1e3)
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
        isSuspended: currentAttempt?.status === "suspended_awaiting_approval",
        pausedAt: currentAttempt?.pausedAt || null,
        resumedAt: currentAttempt?.resumedAt || null,
        currentDifficulty: session?.currentDifficulty || "easy",
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
        terminationReason: currentAttempt?.terminationReason || u.blockReason || null
      };
    });
    if (search) {
      const q = String(search).toLowerCase();
      roster = roster.filter(
        (p) => p.name.toLowerCase().includes(q) || p.teamName.toLowerCase().includes(q) || p.college.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)
      );
    }
    if (status && status !== "all") {
      const sTarget = String(status).toUpperCase();
      roster = roster.filter(
        (p) => p.connectionStatus === sTarget || p.competitionStatus === sTarget || sTarget === "SUSPENDED" && p.competitionStatus.includes("SUSPENDED")
      );
    }
    if (difficulty && difficulty !== "all") {
      roster = roster.filter((p) => p.currentDifficulty === String(difficulty).toLowerCase());
    }
    if (sort === "score_desc") {
      roster.sort((a, b) => b.totalScore - a.totalScore);
    } else if (sort === "violations_desc") {
      roster.sort((a, b) => b.violationsCount - a.violationsCount);
    } else if (sort === "time_remaining") {
      roster.sort((a, b) => a.timeRemainingSeconds - b.timeRemainingSeconds);
    }
    res.json(roster);
  } catch (error) {
    console.error("Fetch participants error:", error);
    res.status(500).json({ error: "Failed to retrieve participants roster." });
  }
});
adminRouter.get("/admin/participants/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    const user = await db.query.users.findFirst({
      where: eq3(users.id, targetId),
      with: {
        attempts: {
          with: { round: true }
        }
      }
    });
    if (!user) {
      return res.status(404).json({ error: "Participant not found." });
    }
    const session = await db.query.participantSessions.findFirst({
      where: eq3(participantSessions.userId, targetId)
    });
    const activities = await db.query.activityEvents.findMany({
      where: eq3(activityEvents.userId, targetId),
      orderBy: (activityEvents2, { desc: desc2 }) => [desc2(activityEvents2.timestamp)],
      limit: 100
    });
    const userViolations = await db.query.securityViolations.findMany({
      where: eq3(securityViolations.userId, targetId),
      orderBy: (securityViolations2, { desc: desc2 }) => [desc2(securityViolations2.serverTimestamp)]
    });
    res.json({
      user,
      session,
      attempts: user.attempts || [],
      activities,
      violations: userViolations
    });
  } catch (error) {
    console.error("Participant profile error:", error);
    res.status(500).json({ error: "Failed to fetch participant profile." });
  }
});
adminRouter.post("/admin/attempts/:id/approve-resume", requireAuth, requireAdmin, async (req, res) => {
  try {
    const attemptId = parseInt(req.params.id, 10);
    const { notes } = req.body;
    const cleanNotes = notes || "Chief Proctor authorized task resumption after incident review.";
    const attempt = await db.query.quizAttempts.findFirst({
      where: eq3(quizAttempts.id, attemptId),
      with: { user: true, round: true }
    });
    if (!attempt) {
      return res.status(404).json({ error: "Attempt not found." });
    }
    if (attempt.status !== "suspended_awaiting_approval" && attempt.status !== "tab_switch_detected") {
      return res.status(400).json({
        error: `Attempt is not suspended (current status: ${attempt.status}).`,
        status: attempt.status
      });
    }
    const now = /* @__PURE__ */ new Date();
    const pauseTime = attempt.pausedAt ? new Date(attempt.pausedAt).getTime() : now.getTime();
    const pauseMs = Math.max(0, now.getTime() - pauseTime);
    const currentDeadline = new Date(attempt.serverDeadline).getTime();
    const newDeadline = new Date(currentDeadline + pauseMs);
    const additionalPausedSeconds = Math.floor(pauseMs / 1e3);
    const totalPausedSeconds = (attempt.totalPausedSeconds || 0) + additionalPausedSeconds;
    await db.update(quizAttempts).set({
      status: "resumed",
      pausedAt: null,
      resumedAt: now,
      serverDeadline: newDeadline,
      totalPausedSeconds,
      adminDecision: "APPROVED_RESUME",
      adminDecisionAt: now,
      adminDecisionNotes: cleanNotes
    }).where(eq3(quizAttempts.id, attempt.id));
    await db.update(users).set({ isBlocked: false, blockReason: null }).where(eq3(users.id, attempt.userId));
    await db.insert(auditLogs).values({
      userId: req.user.id,
      action: "ADMIN_APPROVED_RESUME",
      targetType: "quiz_attempts",
      targetId: String(attempt.id),
      metadata: {
        participantId: attempt.userId,
        additionalPausedSeconds,
        totalPausedSeconds,
        newDeadline,
        notes: cleanNotes
      }
    });
    await db.insert(activityEvents).values({
      userId: attempt.userId,
      attemptId: attempt.id,
      eventType: "ATTEMPT_RESUMED",
      details: `Resumed by administrator: ${cleanNotes}. Remaining time preserved (${additionalPausedSeconds}s pause interval compensated).`,
      severity: "info"
    });
    const remainingSeconds = Math.max(0, Math.floor((newDeadline.getTime() - now.getTime()) / 1e3));
    res.json({
      success: true,
      message: "Participant attempt approved for resumption. Time and progress preserved.",
      status: "resumed",
      remainingSeconds
    });
  } catch (error) {
    console.error("Approve resume error:", error);
    res.status(500).json({ error: "Failed to approve attempt resumption." });
  }
});
adminRouter.post("/admin/participants/:id/resume", requireAuth, requireAdmin, async (req, res) => {
  try {
    const targetUserId = parseInt(req.params.id, 10);
    const { notes } = req.body;
    const suspendedAttempt = await db.query.quizAttempts.findFirst({
      where: and2(
        eq3(quizAttempts.userId, targetUserId),
        eq3(quizAttempts.status, "suspended_awaiting_approval")
      ),
      orderBy: (quizAttempts2, { desc: desc2 }) => [desc2(quizAttempts2.id)]
    });
    if (!suspendedAttempt) {
      return res.status(404).json({ error: "No suspended attempt found for this participant." });
    }
    const now = /* @__PURE__ */ new Date();
    const pauseTime = suspendedAttempt.pausedAt ? new Date(suspendedAttempt.pausedAt).getTime() : now.getTime();
    const pauseMs = Math.max(0, now.getTime() - pauseTime);
    const currentDeadline = new Date(suspendedAttempt.serverDeadline).getTime();
    const newDeadline = new Date(currentDeadline + pauseMs);
    const additionalPausedSeconds = Math.floor(pauseMs / 1e3);
    const totalPausedSeconds = (suspendedAttempt.totalPausedSeconds || 0) + additionalPausedSeconds;
    await db.update(quizAttempts).set({
      status: "resumed",
      pausedAt: null,
      resumedAt: now,
      serverDeadline: newDeadline,
      totalPausedSeconds,
      adminDecision: "APPROVED_RESUME",
      adminDecisionAt: now,
      adminDecisionNotes: notes || "Admin approved continuation."
    }).where(eq3(quizAttempts.id, suspendedAttempt.id));
    await db.update(users).set({ isBlocked: false, blockReason: null }).where(eq3(users.id, targetUserId));
    await db.insert(auditLogs).values({
      userId: req.user.id,
      action: "ADMIN_APPROVED_RESUME",
      targetType: "quiz_attempts",
      targetId: String(suspendedAttempt.id),
      metadata: { participantId: targetUserId, notes }
    });
    res.json({
      success: true,
      message: "Participant attempt approved for resumption. Time and progress preserved."
    });
  } catch (error) {
    console.error("Participant resume error:", error);
    res.status(500).json({ error: "Failed to resume participant attempt." });
  }
});
adminRouter.post("/admin/participants/:id/terminate", requireAuth, requireAdmin, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    const { reason } = req.body;
    const cleanReason = reason || "Terminated remotely by Chief Proctor after tab switch review.";
    const userAttempts = await db.query.quizAttempts.findMany({
      where: eq3(quizAttempts.userId, targetId),
      orderBy: (quizAttempts2, { desc: desc2 }) => [desc2(quizAttempts2.id)]
    });
    const activeStatuses = /* @__PURE__ */ new Set([
      "in_progress",
      "suspended_awaiting_approval",
      "tab_switch_detected",
      "resumed"
    ]);
    const activeAttempt = userAttempts.find((a) => activeStatuses.has(a.status));
    const now = /* @__PURE__ */ new Date();
    if (activeAttempt) {
      await db.update(quizAttempts).set({
        status: "terminated",
        terminationReason: cleanReason,
        terminatedAt: now,
        endTime: now,
        adminDecision: "TERMINATED",
        adminDecisionAt: now,
        adminDecisionNotes: cleanReason
      }).where(eq3(quizAttempts.id, activeAttempt.id));
    }
    await db.update(participantSessions).set({ status: "logged_out" }).where(eq3(participantSessions.userId, targetId));
    await db.update(users).set({ isBlocked: true, blockReason: cleanReason }).where(eq3(users.id, targetId));
    await db.insert(auditLogs).values({
      userId: req.user.id,
      action: "ADMIN_REMOTE_TERMINATION",
      targetType: "users",
      targetId: String(targetId),
      metadata: { reason: cleanReason, attemptId: activeAttempt?.id }
    });
    await db.insert(activityEvents).values({
      userId: targetId,
      attemptId: activeAttempt?.id,
      eventType: "ATTEMPT_TERMINATED",
      details: cleanReason,
      severity: "critical"
    });
    res.json({ success: true, message: "Participant attempt permanently terminated and questions locked." });
  } catch (error) {
    console.error("Remote termination error:", error);
    res.status(500).json({ error: "Failed to terminate attempt." });
  }
});
adminRouter.post("/admin/attempts/:id/terminate", requireAuth, requireAdmin, async (req, res) => {
  try {
    const attemptId = parseInt(req.params.id, 10);
    const { reason } = req.body;
    const cleanReason = reason || "Attempt terminated by Chief Proctor.";
    const attempt = await db.query.quizAttempts.findFirst({
      where: eq3(quizAttempts.id, attemptId)
    });
    if (!attempt) {
      return res.status(404).json({ error: "Attempt not found." });
    }
    const now = /* @__PURE__ */ new Date();
    await db.update(quizAttempts).set({
      status: "terminated",
      terminationReason: cleanReason,
      terminatedAt: now,
      endTime: now,
      adminDecision: "TERMINATED",
      adminDecisionAt: now,
      adminDecisionNotes: cleanReason
    }).where(eq3(quizAttempts.id, attempt.id));
    await db.update(users).set({ isBlocked: true, blockReason: cleanReason }).where(eq3(users.id, attempt.userId));
    await db.insert(auditLogs).values({
      userId: req.user.id,
      action: "ADMIN_REMOTE_TERMINATION",
      targetType: "quiz_attempts",
      targetId: String(attempt.id),
      metadata: { reason: cleanReason, participantId: attempt.userId }
    });
    res.json({ success: true, message: "Attempt terminated successfully." });
  } catch (error) {
    console.error("Attempt termination error:", error);
    res.status(500).json({ error: "Failed to terminate attempt." });
  }
});
adminRouter.post("/admin/participants/:id/remove", requireAuth, requireAdmin, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    const { reason } = req.body;
    const cleanReason = reason || "Removed from competition roster by administrator.";
    const user = await db.query.users.findFirst({
      where: eq3(users.id, targetId)
    });
    if (!user) {
      return res.status(404).json({ error: "Participant not found." });
    }
    const now = /* @__PURE__ */ new Date();
    await db.update(users).set({
      isRemoved: true,
      removedAt: now,
      removalReason: cleanReason,
      isBlocked: true,
      blockReason: cleanReason
    }).where(eq3(users.id, targetId));
    const userAttempts = await db.query.quizAttempts.findMany({
      where: eq3(quizAttempts.userId, targetId)
    });
    for (const att of userAttempts) {
      if (att.status !== "completed" && att.status !== "submitted") {
        await db.update(quizAttempts).set({
          status: "removed",
          endTime: now,
          terminationReason: cleanReason
        }).where(eq3(quizAttempts.id, att.id));
      }
    }
    await db.update(participantSessions).set({ status: "logged_out" }).where(eq3(participantSessions.userId, targetId));
    await db.insert(auditLogs).values({
      userId: req.user.id,
      action: "ADMIN_REMOVE_PARTICIPANT",
      targetType: "users",
      targetId: String(targetId),
      metadata: { reason: cleanReason, removedAt: now }
    });
    await db.insert(activityEvents).values({
      userId: targetId,
      eventType: "PARTICIPANT_REMOVED",
      details: cleanReason,
      severity: "critical"
    });
    res.json({ success: true, message: "Participant removed from active tournament competition." });
  } catch (error) {
    console.error("Remove participant error:", error);
    res.status(500).json({ error: "Failed to remove participant." });
  }
});
adminRouter.post("/admin/participants/:id/readd", requireAuth, requireAdmin, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    const { notes } = req.body;
    const cleanNotes = notes || "Participant re-added by administrator. Clean attempt granted.";
    const user = await db.query.users.findFirst({
      where: eq3(users.id, targetId)
    });
    if (!user) {
      return res.status(404).json({ error: "Participant not found." });
    }
    const now = /* @__PURE__ */ new Date();
    await db.update(users).set({
      isRemoved: false,
      removedAt: null,
      removalReason: null,
      isBlocked: false,
      blockReason: null
    }).where(eq3(users.id, targetId));
    const userAttempts = await db.query.quizAttempts.findMany({
      where: eq3(quizAttempts.userId, targetId)
    });
    for (const att of userAttempts) {
      if (att.status !== "completed" && att.status !== "submitted") {
        await db.update(quizAttempts).set({
          status: "removed",
          endTime: now
        }).where(eq3(quizAttempts.id, att.id));
      }
    }
    await db.insert(auditLogs).values({
      userId: req.user.id,
      action: "ADMIN_READD_PARTICIPANT",
      targetType: "users",
      targetId: String(targetId),
      metadata: { notes: cleanNotes, readdedAt: now }
    });
    await db.insert(activityEvents).values({
      userId: targetId,
      eventType: "PARTICIPANT_READDED",
      details: `${cleanNotes} Eligible for fresh attempt with full countdown timer.`,
      severity: "info"
    });
    res.json({
      success: true,
      message: "Participant re-added to competition. They can now launch a fresh attempt with a full timer."
    });
  } catch (error) {
    console.error("Re-add participant error:", error);
    res.status(500).json({ error: "Failed to re-add participant." });
  }
});
adminRouter.delete("/admin/participants/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    const user = await db.query.users.findFirst({
      where: eq3(users.id, targetId)
    });
    if (!user) {
      return res.status(404).json({ error: "Participant not found." });
    }
    if (user.role === "admin") {
      return res.status(403).json({ error: "Cannot delete administrator account." });
    }
    const userAttempts = await db.query.quizAttempts.findMany({
      where: eq3(quizAttempts.userId, targetId)
    });
    for (const att of userAttempts) {
      await db.delete(participantAnswers).where(eq3(participantAnswers.attemptId, att.id));
      await db.delete(securityViolations).where(eq3(securityViolations.attemptId, att.id));
    }
    await db.delete(disqualificationReviews).where(eq3(disqualificationReviews.userId, targetId));
    await db.delete(quizAttempts).where(eq3(quizAttempts.userId, targetId));
    await db.delete(participantSessions).where(eq3(participantSessions.userId, targetId));
    await db.delete(activityEvents).where(eq3(activityEvents.userId, targetId));
    await db.delete(users).where(eq3(users.id, targetId));
    await db.insert(auditLogs).values({
      userId: req.user.id,
      action: "ADMIN_DELETE_PARTICIPANT",
      targetType: "users",
      targetId: String(targetId),
      metadata: {
        deletedTeamName: user.teamName,
        deletedCollege: user.college,
        deletedUid: user.uid
      }
    });
    res.json({
      success: true,
      message: `Participant ${user.teamName} (#${user.code}) deleted cleanly without orphan data.`
    });
  } catch (error) {
    console.error("Delete participant error:", error);
    res.status(500).json({ error: "Failed to delete participant." });
  }
});
adminRouter.post("/admin/participants/:id/disqualify", requireAuth, requireAdmin, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    const { reason } = req.body;
    const cleanReason = reason || "Disqualified by Tournament Directorate.";
    await db.update(users).set({ isBlocked: true, blockReason: cleanReason }).where(eq3(users.id, targetId));
    await db.insert(auditLogs).values({
      userId: req.user.id,
      action: "ADMIN_DISQUALIFICATION",
      targetType: "users",
      targetId: String(targetId),
      metadata: { reason: cleanReason }
    });
    res.json({ success: true, message: "Participant disqualified." });
  } catch (error) {
    console.error("Disqualification error:", error);
    res.status(500).json({ error: "Failed to disqualify participant." });
  }
});
adminRouter.post("/admin/participants/:id/pardon", requireAuth, requireAdmin, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    await db.update(users).set({ isBlocked: false, blockReason: null }).where(eq3(users.id, targetId));
    await db.update(quizAttempts).set({ isDisqualified: false, violationsCount: 0 }).where(eq3(quizAttempts.userId, targetId));
    await db.insert(auditLogs).values({
      userId: req.user.id,
      action: "ADMIN_PARDON",
      targetType: "users",
      targetId: String(targetId)
    });
    res.json({ success: true, message: "Participant pardoned. Access restored." });
  } catch (error) {
    console.error("Pardon error:", error);
    res.status(500).json({ error: "Failed to pardon participant." });
  }
});
adminRouter.get("/admin/live-monitoring", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const sessions = await db.query.participantSessions.findMany({
      with: { user: true },
      orderBy: (participantSessions2, { desc: desc2 }) => [desc2(participantSessions2.lastHeartbeat)]
    });
    const now = Date.now();
    const formatted = sessions.map((s) => {
      const diffMs = now - new Date(s.lastHeartbeat).getTime();
      const isOnline = diffMs <= 3e4 && s.status !== "logged_out";
      return {
        id: s.id,
        userId: s.userId,
        teamName: s.user?.teamName || "Unknown Team",
        name: s.user?.name || "Competitor",
        code: s.user?.code || "N/A",
        college: s.user?.college || "N/A",
        status: s.status === "logged_out" ? "LOGGED OUT" : isOnline ? "ONLINE" : "STALE / DISCONNECTED",
        currentDifficulty: s.currentDifficulty || "easy",
        currentChallengeId: s.currentChallengeId,
        lastHeartbeat: s.lastHeartbeat,
        heartbeatAgeSeconds: Math.floor(diffMs / 1e3),
        ipAddress: s.ipAddress,
        isBlocked: s.user?.isBlocked || false
      };
    });
    res.json(formatted);
  } catch (error) {
    console.error("Live monitoring error:", error);
    res.status(500).json({ error: "Failed to fetch live monitoring feed." });
  }
});
adminRouter.get("/admin/activity-logs", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { eventType, severity, search } = req.query;
    let events3 = await db.query.activityEvents.findMany({
      with: { user: true },
      orderBy: (activityEvents2, { desc: desc2 }) => [desc2(activityEvents2.id)],
      limit: 150
    });
    if (eventType && eventType !== "all") {
      events3 = events3.filter((e) => e.eventType === eventType);
    }
    if (severity && severity !== "all") {
      events3 = events3.filter((e) => e.severity === severity);
    }
    if (search) {
      const q = String(search).toLowerCase();
      events3 = events3.filter(
        (e) => e.details.toLowerCase().includes(q) || e.user?.teamName?.toLowerCase().includes(q) || e.user?.code?.toLowerCase().includes(q)
      );
    }
    const formatted = events3.map((e) => ({
      id: e.id,
      userId: e.userId,
      teamName: e.user?.teamName || "System",
      code: e.user?.code || "N/A",
      college: e.user?.college || "N/A",
      eventType: e.eventType,
      details: e.details,
      severity: e.severity,
      difficultyLevel: e.difficultyLevel,
      challengeId: e.challengeId,
      timestamp: e.timestamp
    }));
    res.json(formatted);
  } catch (error) {
    console.error("Activity logs error:", error);
    res.status(500).json({ error: "Failed to fetch activity logs." });
  }
});
adminRouter.get("/admin/submissions", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { status, difficulty } = req.query;
    const answers = await db.query.participantAnswers.findMany({
      with: {
        attempt: { with: { user: true, round: true } },
        question: true
      },
      orderBy: (participantAnswers2, { desc: desc2 }) => [desc2(participantAnswers2.id)]
    });
    let list = answers.map((a) => ({
      id: a.id,
      attemptId: a.attemptId,
      participantName: a.attempt?.user?.name || "Competitor",
      teamName: a.attempt?.user?.teamName || "Unknown Team",
      code: a.attempt?.user?.code || "N/A",
      college: a.attempt?.user?.college || "N/A",
      challengeTitle: a.question?.prompt?.substring(0, 60) + "..." || "Challenge",
      questionId: a.questionId,
      difficulty: a.attempt?.round?.difficulty || (a.attempt?.roundId === 1 ? "easy" : a.attempt?.roundId === 2 ? "intermediate" : "hard"),
      isCorrect: a.isCorrect,
      pointsEarned: a.pointsEarned,
      maxPoints: a.question?.points || 10,
      submittedAt: a.submittedAt,
      attemptNumber: a.attemptNumber || 1,
      attemptStatus: a.attempt?.status || "completed",
      selectedOption: a.selectedOption,
      submittedCode: a.submittedCode,
      manuallyAdjusted: a.manuallyAdjusted || false,
      adjustedBy: a.adjustedBy,
      adjustedReason: a.adjustedReason
    }));
    if (status && status !== "all") {
      if (status === "accepted") list = list.filter((s) => s.isCorrect);
      if (status === "rejected") list = list.filter((s) => !s.isCorrect);
      if (status === "adjusted") list = list.filter((s) => s.manuallyAdjusted);
    }
    if (difficulty && difficulty !== "all") {
      list = list.filter((s) => s.difficulty === difficulty);
    }
    res.json(list);
  } catch (error) {
    console.error("Submissions list error:", error);
    res.status(500).json({ error: "Failed to retrieve submissions." });
  }
});
adminRouter.post("/admin/submissions/:id/score-correction", requireAuth, requireAdmin, async (req, res) => {
  try {
    const submissionId = parseInt(req.params.id, 10);
    const { newPoints, isCorrect, reason } = req.body;
    const answer = await db.query.participantAnswers.findFirst({
      where: eq3(participantAnswers.id, submissionId)
    });
    if (!answer) {
      return res.status(404).json({ error: "Submission not found." });
    }
    const previousPoints = answer.pointsEarned;
    const finalPoints = typeof newPoints === "number" ? newPoints : answer.pointsEarned;
    const finalCorrect = typeof isCorrect === "boolean" ? isCorrect : answer.isCorrect;
    await db.update(participantAnswers).set({
      pointsEarned: finalPoints,
      isCorrect: finalCorrect,
      manuallyAdjusted: true,
      adjustedBy: req.user.name,
      adjustedReason: reason || "Manual score correction by Administrator."
    }).where(eq3(participantAnswers.id, submissionId));
    const [allAttemptAnswers, attemptObj] = await Promise.all([
      db.query.participantAnswers.findMany({
        where: eq3(participantAnswers.attemptId, answer.attemptId)
      }),
      db.query.quizAttempts.findFirst({
        where: eq3(quizAttempts.id, answer.attemptId),
        with: { round: true }
      })
    ]);
    const rawScore = allAttemptAnswers.reduce(
      (sum, a) => sum + (a.isCorrect ? a.pointsEarned : 0),
      0
    );
    let updatedTotalScore = rawScore;
    let isQualified = attemptObj?.isQualified || false;
    if (attemptObj) {
      const activeRoundQs = await db.query.questions.findMany({
        where: and2(
          eq3(questions.roundId, attemptObj.roundId),
          eq3(questions.isActive, true)
        )
      });
      const rawMaxPoints = activeRoundQs.reduce((sum, q) => sum + (q.points || 1), 0);
      const configuredMax = attemptObj.round?.maxScore || rawMaxPoints;
      updatedTotalScore = rawMaxPoints > 0 && configuredMax > 0 && configuredMax !== rawMaxPoints ? Math.round(rawScore / rawMaxPoints * configuredMax) : rawScore;
      const qualPct = attemptObj.round?.qualifyingPercentage || 60;
      const qualifyingScore = Math.ceil(configuredMax * (qualPct / 100));
      isQualified = updatedTotalScore >= qualifyingScore;
    }
    await db.update(quizAttempts).set({ score: updatedTotalScore, isQualified }).where(eq3(quizAttempts.id, answer.attemptId));
    await db.insert(auditLogs).values({
      userId: req.user.id,
      action: "MANUAL_SCORE_CORRECTION",
      targetType: "participant_answers",
      targetId: String(submissionId),
      metadata: {
        previousPoints,
        newPoints: finalPoints,
        isCorrect: finalCorrect,
        reason,
        attemptId: answer.attemptId
      }
    });
    res.json({
      success: true,
      message: "Score corrected and auditable log recorded.",
      newScore: updatedTotalScore
    });
  } catch (error) {
    console.error("Score correction error:", error);
    res.status(500).json({ error: "Failed to update submission score." });
  }
});
adminRouter.get("/admin/competition-settings", requireAuth, requireAdmin, async (_req, res) => {
  try {
    let settings = await db.query.competitionSettings.findFirst();
    if (!settings) {
      const [newSettings] = await db.insert(competitionSettings).values({
        competitionStatus: "active",
        registrationOpen: true,
        fullscreenEnforcement: true,
        strictFocusEnforcement: true,
        heartbeatIntervalSec: 10,
        heartbeatStaleThresholdSec: 30,
        leaderboardFrozen: false,
        publishedFinal: false
      }).returning();
      settings = newSettings;
    }
    res.json(settings);
  } catch (error) {
    console.error("Fetch competition settings error:", error);
    res.status(500).json({ error: "Failed to retrieve competition settings." });
  }
});
adminRouter.post("/admin/competition-settings", requireAuth, requireAdmin, async (req, res) => {
  try {
    const updates = req.body;
    let settings = await db.query.competitionSettings.findFirst();
    if (settings) {
      await db.update(competitionSettings).set({
        ...updates,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq3(competitionSettings.id, settings.id));
    } else {
      await db.insert(competitionSettings).values(updates);
    }
    await db.insert(auditLogs).values({
      userId: req.user.id,
      action: "UPDATE_COMPETITION_SETTINGS",
      targetType: "competition_settings",
      targetId: "1",
      metadata: updates
    });
    res.json({ success: true, message: "Competition configuration saved." });
  } catch (error) {
    console.error("Update competition settings error:", error);
    res.status(500).json({ error: "Failed to update competition settings." });
  }
});
adminRouter.post("/admin/leaderboard/freeze", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { freeze, publish } = req.body;
    const settings = await db.query.competitionSettings.findFirst();
    if (settings) {
      await db.update(competitionSettings).set({
        leaderboardFrozen: freeze !== void 0 ? freeze : settings.leaderboardFrozen,
        publishedFinal: publish !== void 0 ? publish : settings.publishedFinal,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq3(competitionSettings.id, settings.id));
    }
    await db.insert(auditLogs).values({
      userId: req.user.id,
      action: "LEADERBOARD_STATUS_TOGGLED",
      targetType: "competition_settings",
      targetId: "1",
      metadata: { freeze, publish }
    });
    res.json({ success: true, message: "Leaderboard freeze status updated." });
  } catch (error) {
    console.error("Freeze leaderboard error:", error);
    res.status(500).json({ error: "Failed to update leaderboard status." });
  }
});
adminRouter.get("/admin/export/:type", async (req, res) => {
  try {
    const { type } = req.params;
    const token = req.query.token || req.headers.authorization?.replace(/^Bearer\s+/i, "").trim();
    const validation = await validateAdminSessionToken(token);
    if (!validation.valid) {
      return res.status(401).send(validation.error || "Unauthorized export request.");
    }
    if (type === "participants") {
      const allUsers = await db.query.users.findMany({
        where: eq3(users.role, "participant"),
        with: { attempts: true }
      });
      const rows = [
        ["ID", "Team Code", "Team Name", "College", "Members", "Zone", "Easy Pts", "Intermediate Pts", "Hard Pts", "Total Score", "Status"]
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
          `"${(u.teamMembers || []).join("; ")}"`,
          `"${u.zone}"`,
          String(r1),
          String(r2),
          String(r3),
          String(r1 + r2 + r3),
          u.isBlocked ? "Disqualified" : "Active"
        ]);
      });
      const csv = rows.map((r) => r.join(",")).join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", 'attachment; filename="participants_roster.csv"');
      return res.send(csv);
    }
    if (type === "submissions") {
      const answers = await db.query.participantAnswers.findMany({
        with: {
          attempt: { with: { user: true } },
          question: true
        }
      });
      const rows = [
        ["Submission ID", "Team Code", "Team Name", "College", "Question ID", "Question Category", "Validation Status", "Points Earned", "Submitted At", "Manually Adjusted"]
      ];
      answers.forEach((a) => {
        rows.push([
          String(a.id),
          `"${a.attempt?.user?.code || "N/A"}"`,
          `"${a.attempt?.user?.teamName || "N/A"}"`,
          `"${a.attempt?.user?.college || "N/A"}"`,
          String(a.questionId),
          `"${a.question?.category || "General"}"`,
          a.isCorrect ? "Accepted" : "Rejected",
          String(a.pointsEarned),
          new Date(a.submittedAt).toISOString(),
          a.manuallyAdjusted ? "Yes" : "No"
        ]);
      });
      const csv = rows.map((r) => r.join(",")).join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", 'attachment; filename="submissions_records.csv"');
      return res.send(csv);
    }
    if (type === "activity") {
      const events3 = await db.query.activityEvents.findMany({
        with: { user: true },
        orderBy: (activityEvents2, { desc: desc2 }) => [desc2(activityEvents2.id)]
      });
      const rows = [
        ["Event ID", "Team Code", "Team Name", "Event Type", "Severity", "Details", "Difficulty Level", "Timestamp"]
      ];
      events3.forEach((e) => {
        rows.push([
          String(e.id),
          `"${e.user?.code || "N/A"}"`,
          `"${e.user?.teamName || "System"}"`,
          `"${e.eventType}"`,
          `"${e.severity}"`,
          `"${e.details.replace(/"/g, '""')}"`,
          `"${e.difficultyLevel || "N/A"}"`,
          new Date(e.timestamp).toISOString()
        ]);
      });
      const csv = rows.map((r) => r.join(",")).join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", 'attachment; filename="activity_surveillance.csv"');
      return res.send(csv);
    }
    if (type === "leaderboard") {
      const allUsers = await db.query.users.findMany({
        where: eq3(users.role, "participant"),
        with: { attempts: true }
      });
      const ranked = allUsers.map((u) => {
        let total = 0, time = 0;
        (u.attempts || []).forEach((att) => {
          total += att.score || 0;
          if (att.endTime && att.startTime) {
            time += Math.max(0, (new Date(att.endTime).getTime() - new Date(att.startTime).getTime()) / 1e3);
          }
        });
        return { ...u, total, time };
      }).sort((a, b) => b.total !== a.total ? b.total - a.total : a.time - b.time);
      const rows = [
        ["Rank", "Team Code", "Team Name", "College", "Total Score", "Time (Seconds)", "Status"]
      ];
      ranked.forEach((r, idx) => {
        rows.push([
          String(idx + 1),
          `"${r.code}"`,
          `"${r.teamName}"`,
          `"${r.college}"`,
          String(r.total),
          String(r.time),
          r.isBlocked ? "Disqualified" : "Active"
        ]);
      });
      const csv = rows.map((r) => r.join(",")).join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", 'attachment; filename="final_leaderboard.csv"');
      return res.send(csv);
    }
    if (type === "competition_results" || type === "results") {
      const allUsers = await db.query.users.findMany({
        where: eq3(users.role, "participant"),
        with: {
          attempts: {
            with: { round: true }
          }
        }
      });
      const rows = [
        [
          "Rank",
          "Team Code",
          "Team Name",
          "College",
          "Round 1 Score (Max 8)",
          "Round 1 Qualified",
          "Round 2 Score (Max 20)",
          "Round 2 Qualified",
          "Round 3 Score (Max 30)",
          "Round 3 Qualified",
          "Total Score (Max 58)",
          "Current Status"
        ]
      ];
      const ranked = allUsers.map((u) => {
        let r1Score = 0, r1Q = "No";
        let r2Score = 0, r2Q = "No";
        let r3Score = 0, r3Q = "No";
        let total = 0;
        (u.attempts || []).forEach((att) => {
          if (att.round?.roundNumber === 1) {
            r1Score = att.score;
            if (att.isQualified || att.score >= 5) r1Q = "Yes";
          } else if (att.round?.roundNumber === 2) {
            r2Score = att.score;
            if (att.isQualified || att.score >= 12) r2Q = "Yes";
          } else if (att.round?.roundNumber === 3) {
            r3Score = att.score;
            if (att.isQualified || att.score >= 18) r3Q = "Yes";
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
          isRemoved: u.isRemoved
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
          r.isRemoved ? "Removed" : r.isBlocked ? "Disqualified" : "Active"
        ]);
      });
      const csv = rows.map((r) => r.join(",")).join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", 'attachment; filename="competition_results.csv"');
      return res.send(csv);
    }
    return res.status(400).send("Invalid export type requested.");
  } catch (error) {
    console.error("Export CSV error:", error);
    res.status(500).send("Error generating export.");
  }
});
adminRouter.get("/admin/questions", requireAuth, requireAdmin, async (req, res) => {
  try {
    const roundIdParam = req.query.roundId ? parseInt(String(req.query.roundId), 10) : void 0;
    const allQuestions = await db.query.questions.findMany({
      where: roundIdParam ? eq3(questions.roundId, roundIdParam) : void 0,
      with: { round: true },
      orderBy: (questions2, { asc }) => [asc(questions2.orderIndex), asc(questions2.id)]
    });
    res.json(allQuestions);
  } catch (error) {
    console.error("Admin fetch questions error:", error);
    res.status(500).json({ error: "Failed to retrieve curriculum questions." });
  }
});
adminRouter.post("/admin/questions", requireAuth, requireAdmin, async (req, res) => {
  try {
    const {
      roundId,
      code,
      prompt,
      type,
      questionType,
      options,
      correctOption,
      expectedAnswer,
      codeStarter,
      starterCode,
      explanation,
      points,
      category
    } = req.body;
    const rId = parseInt(roundId, 10);
    if (!rId || !prompt || !String(prompt).trim()) {
      return res.status(400).json({ error: "Question requires a valid roundId and prompt." });
    }
    const rawType = String(type || questionType || (rId === 2 ? "qa" : rId === 3 ? "code" : "mcq")).toLowerCase();
    const normalizedType = rawType === "coding" ? "code" : rawType === "qa" ? "qa" : "mcq";
    let finalOptions = [];
    let finalCorrectOption = 0;
    if (normalizedType === "mcq") {
      if (!Array.isArray(options) || options.length < 2) {
        return res.status(400).json({ error: "MCQ questions require at least 2 options." });
      }
      finalOptions = options.map((o) => String(o).trim());
      const cOpt = parseInt(correctOption, 10);
      if (isNaN(cOpt) || cOpt < 0 || cOpt >= finalOptions.length) {
        return res.status(400).json({ error: "Valid correct option index is required." });
      }
      finalCorrectOption = cOpt;
    } else if (normalizedType === "qa") {
      if (expectedAnswer !== void 0 && String(expectedAnswer).trim()) {
        finalOptions = [String(expectedAnswer).trim()];
      } else if (Array.isArray(options) && options.length > 0) {
        finalOptions = options.map((o) => String(o).trim()).filter(Boolean);
      }
      finalCorrectOption = 0;
    } else {
      finalOptions = Array.isArray(options) ? options.map((o) => String(o).trim()) : [];
      finalCorrectOption = 0;
    }
    const [newQ] = await db.insert(questions).values({
      roundId: rId,
      code: code || `Q${Date.now().toString().slice(-4)}`,
      prompt: String(prompt).trim(),
      type: normalizedType,
      options: finalOptions,
      correctOption: finalCorrectOption,
      codeStarter: codeStarter !== void 0 ? String(codeStarter) : starterCode !== void 0 ? String(starterCode) : null,
      explanation: explanation ? String(explanation).trim() : null,
      points: parseInt(points, 10) || (rId === 2 ? 10 : rId === 3 ? 10 : 1),
      category: category ? String(category).trim() : "Easy",
      isActive: true
    }).returning();
    await db.insert(auditLogs).values({
      userId: req.user.id,
      action: "ADMIN_CREATE_QUESTION",
      targetType: "questions",
      targetId: String(newQ.id),
      metadata: { code: newQ.code, roundId: rId, type: normalizedType }
    });
    res.json({ success: true, question: newQ });
  } catch (error) {
    console.error("Admin create question error:", error);
    res.status(500).json({ error: "Failed to create question." });
  }
});
adminRouter.put("/admin/questions/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const qId = parseInt(req.params.id, 10);
    const {
      prompt,
      type,
      questionType,
      options,
      correctOption,
      expectedAnswer,
      codeStarter,
      starterCode,
      explanation,
      points,
      category,
      isActive,
      code
    } = req.body;
    const existing = await db.query.questions.findFirst({
      where: eq3(questions.id, qId)
    });
    if (!existing) {
      return res.status(404).json({ error: "Question not found." });
    }
    const updates = {};
    if (prompt !== void 0) updates.prompt = String(prompt).trim();
    if (type !== void 0 || questionType !== void 0) {
      const rawT = String(type || questionType).toLowerCase();
      updates.type = rawT === "coding" ? "code" : rawT === "qa" ? "qa" : "mcq";
    }
    if (expectedAnswer !== void 0 && String(expectedAnswer).trim()) {
      updates.options = [String(expectedAnswer).trim()];
      updates.correctOption = 0;
    } else if (Array.isArray(options)) {
      updates.options = options.map((o) => String(o).trim());
    }
    if (correctOption !== void 0) {
      const c = parseInt(correctOption, 10);
      if (!isNaN(c) && c >= 0) updates.correctOption = c;
    }
    if (codeStarter !== void 0 || starterCode !== void 0) {
      updates.codeStarter = String(codeStarter ?? starterCode ?? "");
    }
    if (explanation !== void 0) updates.explanation = String(explanation).trim();
    if (points !== void 0) updates.points = Math.max(1, parseInt(points, 10) || 1);
    if (category !== void 0) updates.category = String(category).trim();
    if (isActive !== void 0) updates.isActive = Boolean(isActive);
    if (code !== void 0) updates.code = String(code).trim();
    await db.update(questions).set(updates).where(eq3(questions.id, qId));
    await db.insert(auditLogs).values({
      userId: req.user.id,
      action: "ADMIN_UPDATE_QUESTION",
      targetType: "questions",
      targetId: String(qId),
      metadata: updates
    });
    res.json({ success: true, message: "Question updated successfully." });
  } catch (error) {
    console.error("Admin update question error:", error);
    res.status(500).json({ error: "Failed to update question." });
  }
});
adminRouter.delete("/admin/questions/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const qId = parseInt(req.params.id, 10);
    await db.update(questions).set({ isActive: false }).where(eq3(questions.id, qId));
    await db.insert(auditLogs).values({
      userId: req.user.id,
      action: "ADMIN_DISABLE_QUESTION",
      targetType: "questions",
      targetId: String(qId)
    });
    res.json({ success: true, message: "Question disabled successfully." });
  } catch (error) {
    console.error("Admin delete question error:", error);
    res.status(500).json({ error: "Failed to disable question." });
  }
});
adminRouter.get("/admin/rounds", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const allRounds = await db.query.rounds.findMany({
      orderBy: (rounds2, { asc }) => [asc(rounds2.roundNumber)]
    });
    res.json(allRounds);
  } catch (error) {
    console.error("Admin fetch rounds error:", error);
    res.status(500).json({ error: "Failed to retrieve rounds." });
  }
});
adminRouter.put("/admin/rounds/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const roundId = parseInt(req.params.id, 10);
    const { durationMinutes, qualifyingPercentage, maxScore, isOpen, title, description } = req.body;
    const existing = await db.query.rounds.findFirst({
      where: eq3(rounds.id, roundId)
    });
    if (!existing) {
      return res.status(404).json({ error: "Round not found." });
    }
    const updates = {};
    if (durationMinutes !== void 0) updates.durationMinutes = Math.max(1, parseInt(durationMinutes, 10));
    if (qualifyingPercentage !== void 0) updates.qualifyingPercentage = Math.max(0, Math.min(100, parseInt(qualifyingPercentage, 10)));
    if (maxScore !== void 0) updates.maxScore = Math.max(1, parseInt(maxScore, 10));
    if (isOpen !== void 0) updates.isOpen = Boolean(isOpen);
    if (title !== void 0) updates.title = String(title).trim();
    if (description !== void 0) updates.description = String(description).trim();
    await db.update(rounds).set(updates).where(eq3(rounds.id, roundId));
    await db.insert(auditLogs).values({
      userId: req.user.id,
      action: "ADMIN_UPDATE_ROUND_CONFIG",
      targetType: "rounds",
      targetId: String(roundId),
      metadata: updates
    });
    res.json({ success: true, message: "Round settings updated successfully." });
  } catch (error) {
    console.error("Admin update round error:", error);
    res.status(500).json({ error: "Failed to update round configuration." });
  }
});
adminRouter.post("/admin/participants/:id/unlock-round", requireAuth, requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { roundNumber } = req.body;
    const rNum = parseInt(roundNumber, 10);
    if (isNaN(rNum) || rNum < 1 || rNum > 3) {
      return res.status(400).json({ error: "Valid round number (1, 2, or 3) is required." });
    }
    const user = await db.query.users.findFirst({
      where: eq3(users.id, userId)
    });
    if (!user) {
      return res.status(404).json({ error: "Participant not found." });
    }
    const currentOverrides = user.roundOverrides || {};
    currentOverrides[String(rNum)] = true;
    currentOverrides[`r${rNum}`] = true;
    await db.update(users).set({ roundOverrides: currentOverrides }).where(eq3(users.id, userId));
    await db.insert(auditLogs).values({
      userId: req.user.id,
      action: "ADMIN_MANUAL_UNLOCK_ROUND",
      targetType: "users",
      targetId: String(userId),
      metadata: { roundNumber: rNum, participantCode: user.code }
    });
    res.json({
      success: true,
      message: `Round ${rNum} successfully unlocked for participant ${user.code}.`
    });
  } catch (error) {
    console.error("Unlock round error:", error);
    res.status(500).json({ error: "Failed to unlock round for participant." });
  }
});
adminRouter.post("/admin/participants/:id/authorize-retake", requireAuth, requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { roundNumber } = req.body;
    const rNum = parseInt(roundNumber, 10);
    if (isNaN(rNum) || rNum < 1 || rNum > 3) {
      return res.status(400).json({ error: "Valid round number (1, 2, or 3) is required." });
    }
    const user = await db.query.users.findFirst({
      where: eq3(users.id, userId)
    });
    if (!user) {
      return res.status(404).json({ error: "Participant not found." });
    }
    const currentRetakes = user.retakesAllowed || {};
    currentRetakes[String(rNum)] = true;
    currentRetakes[`r${rNum}`] = true;
    await db.update(users).set({ retakesAllowed: currentRetakes }).where(eq3(users.id, userId));
    await db.insert(auditLogs).values({
      userId: req.user.id,
      action: "ADMIN_AUTHORIZE_RETAKE",
      targetType: "users",
      targetId: String(userId),
      metadata: { roundNumber: rNum, participantCode: user.code }
    });
    res.json({
      success: true,
      message: `Retake authorized for Round ${rNum} for participant ${user.code}. A clean attempt will begin upon start.`
    });
  } catch (error) {
    console.error("Authorize retake error:", error);
    res.status(500).json({ error: "Failed to authorize retake." });
  }
});

// server.ts
dotenv.config();
var app = express();
var PORT = 3e3;
app.use(express.json());
app.use((req, _res, next) => {
  const matchedPath = req.headers["x-matched-path"] || req.headers["x-original-url"];
  if (matchedPath && matchedPath.startsWith("/api")) {
    const queryIndex = req.url.indexOf("?");
    const query = queryIndex !== -1 ? req.url.substring(queryIndex) : "";
    req.url = `${matchedPath}${query}`;
  } else if ((req.url.startsWith("/api/index.js") || req.url.startsWith("/api/index")) && matchedPath) {
    req.url = matchedPath;
  }
  if (!req.url.startsWith("/api") && (req.url.startsWith("/auth/") || req.url.startsWith("/admin/") || req.url.startsWith("/rounds") || req.url.startsWith("/attempts") || req.url.startsWith("/leaderboard") || req.url.startsWith("/participants/") || req.url.startsWith("/events/") || req.url.startsWith("/appeals") || req.url.startsWith("/competition/") || req.url.startsWith("/health"))) {
    req.url = `/api${req.url}`;
  }
  next();
});
var seedPromise = null;
function ensureDatabaseSeeded() {
  if (!seedPromise) {
    seedPromise = seedTournamentDatabase().then(() => syncRound2Questions()).catch((err) => {
      console.error("Error during initial database seed check:", err);
    });
  }
  return seedPromise;
}
app.use("/api", async (_req, _res, next) => {
  await ensureDatabaseSeeded();
  next();
});
app.use("/api", adminRouter);
ensureDatabaseSeeded();
app.get("/api/health", (_req, res) => {
  res.json({
    status: "online",
    serverTime: (/* @__PURE__ */ new Date()).toISOString(),
    epoch: Date.now()
  });
});
app.post("/api/auth/register-team", async (req, res) => {
  try {
    const { teamName, college, teamMembers, zone } = req.body;
    if (!teamName || !college || !Array.isArray(teamMembers) || teamMembers.length === 0) {
      return res.status(400).json({
        error: "Missing required registration parameters: teamName, college, and teamMembers."
      });
    }
    const cleanTeam = String(teamName).trim();
    const cleanCollege = String(college).trim();
    const cleanMembers = teamMembers.map((m) => String(m).trim()).filter(Boolean);
    const cleanZone = zone || "South Zone";
    let user = await db.query.users.findFirst({
      where: eq4(users.teamName, cleanTeam)
    });
    if (!user) {
      const code = `#TA-${Math.floor(1e3 + Math.random() * 9e3)}`;
      const uid = `team_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const [newUser] = await db.insert(users).values({
        uid,
        email: `${cleanTeam.toLowerCase().replace(/\s+/g, "_")}@techarena.edu`,
        role: "participant",
        name: cleanMembers[0] || cleanTeam,
        college: cleanCollege,
        teamName: cleanTeam,
        teamMembers: cleanMembers,
        code,
        zone: cleanZone
      }).returning();
      user = newUser;
      await db.insert(auditLogs).values({
        userId: user.id,
        action: "REGISTER_TEAM",
        targetType: "users",
        targetId: String(user.id),
        metadata: { teamName: cleanTeam, college: cleanCollege, code }
      });
    }
    if (user.isRemoved) {
      return res.status(403).json({
        error: "Terminal access revoked: This team has been removed from the tournament roster by an administrator."
      });
    }
    const existingSession = await db.query.participantSessions.findFirst({
      where: eq4(participantSessions.userId, user.id)
    });
    const now = /* @__PURE__ */ new Date();
    if (existingSession) {
      await db.update(participantSessions).set({
        status: "online",
        lastHeartbeat: now,
        lastActivity: now,
        ipAddress: req.ip
      }).where(eq4(participantSessions.id, existingSession.id));
    } else {
      await db.insert(participantSessions).values({
        userId: user.id,
        status: "online",
        currentDifficulty: "easy",
        lastHeartbeat: now,
        lastActivity: now,
        ipAddress: req.ip
      });
    }
    await db.insert(activityEvents).values({
      userId: user.id,
      eventType: "LOGIN",
      details: `Team node registered / connected: ${user.teamName} (${user.code})`,
      severity: "info"
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
        blockReason: user.blockReason
      }
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Failed to register team terminal." });
  }
});
app.post("/api/participants/heartbeat", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const { currentDifficulty, difficulty, currentChallengeId } = req.body || {};
    const resolvedDifficulty = currentDifficulty || difficulty;
    const now = /* @__PURE__ */ new Date();
    const session = await db.query.participantSessions.findFirst({
      where: eq4(participantSessions.userId, user.id)
    });
    if (session) {
      await db.update(participantSessions).set({
        status: "online",
        lastHeartbeat: now,
        lastActivity: now,
        currentDifficulty: resolvedDifficulty || session.currentDifficulty,
        currentChallengeId: currentChallengeId || session.currentChallengeId,
        ipAddress: req.ip
      }).where(eq4(participantSessions.id, session.id));
    } else {
      await db.insert(participantSessions).values({
        userId: user.id,
        status: "online",
        currentDifficulty: resolvedDifficulty || "easy",
        currentChallengeId,
        lastHeartbeat: now,
        lastActivity: now,
        ipAddress: req.ip
      });
    }
    res.json({ success: true, timestamp: now.toISOString() });
  } catch (error) {
    console.error("Heartbeat error:", error);
    res.status(500).json({ error: "Failed to record session heartbeat." });
  }
});
app.post("/api/auth/logout", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const session = await db.query.participantSessions.findFirst({
      where: eq4(participantSessions.userId, user.id)
    });
    if (session) {
      await db.update(participantSessions).set({
        status: "logged_out",
        lastActivity: /* @__PURE__ */ new Date()
      }).where(eq4(participantSessions.id, session.id));
    }
    await db.insert(activityEvents).values({
      userId: user.id,
      eventType: "LOGOUT",
      details: "Participant explicitly logged out from terminal.",
      severity: "info"
    });
    res.json({ success: true, message: "Terminal logged out." });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ error: "Failed to log out." });
  }
});
app.post("/api/events/record", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const { eventType, details, difficultyLevel, challengeId, severity } = req.body;
    await db.insert(activityEvents).values({
      userId: user.id,
      eventType: String(eventType || "ACTION"),
      details: String(details || "General event"),
      difficultyLevel,
      challengeId,
      severity: severity || "info"
    });
    res.json({ success: true });
  } catch (error) {
    console.error("Record event error:", error);
    res.status(500).json({ error: "Failed to record event." });
  }
});
app.post("/api/auth/login-code", async (req, res) => {
  try {
    const { code } = req.body || {};
    const rawCode = String(code || "").trim().toUpperCase();
    if (!rawCode) {
      return res.status(400).json({ error: "Team code is required." });
    }
    const normalizedCode = rawCode.startsWith("#") ? rawCode : `#${rawCode}`;
    const user = await db.query.users.findFirst({ where: eq4(users.code, normalizedCode) }) || await db.query.users.findFirst({ where: eq4(users.code, rawCode) });
    if (!user || user.role !== "participant") {
      return res.status(404).json({ error: "Team node not found for the provided access code." });
    }
    if (user.isRemoved) {
      return res.status(403).json({
        error: "Terminal access revoked: This team has been removed from the tournament roster."
      });
    }
    const token = signParticipantToken(user.id, user.code);
    res.json({ token, user });
  } catch (error) {
    console.error("Login by code error:", error);
    res.status(500).json({ error: "Failed to authenticate team code." });
  }
});
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
app.get("/api/auth/me", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const dbUser = await db.query.users.findFirst({
      where: eq4(users.id, user.id)
    });
    if (!dbUser) {
      return res.status(404).json({ error: "User record not found." });
    }
    const attempts = await db.query.quizAttempts.findMany({
      where: eq4(quizAttempts.userId, dbUser.id),
      with: {
        round: true
      },
      orderBy: (quizAttempts2, { desc: desc2 }) => [desc2(quizAttempts2.id)]
    });
    const allRounds = await db.query.rounds.findMany({
      orderBy: (rounds2, { asc }) => [asc(rounds2.roundNumber)]
    });
    const roundMap = {};
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
        r1Completed = att.status === "submitted" || att.status === "timed_out";
        isQualifiedR1 = att.isQualified || att.score >= r1Min;
      } else if (att.round?.roundNumber === 2 && !r2Completed) {
        r2Score = att.score;
        r2Completed = att.status === "submitted" || att.status === "timed_out";
        isQualifiedR2 = att.isQualified || att.score >= r2Min;
      } else if (att.round?.roundNumber === 3 && !r3Completed) {
        r3Score = att.score;
        r3Completed = att.status === "submitted" || att.status === "timed_out";
        isQualifiedR3 = att.isQualified || att.score >= r3Min;
      }
    }
    const roundOverrides = dbUser.roundOverrides || {};
    const retakesAllowed = dbUser.retakesAllowed || {};
    const canAccessR1 = !dbUser.isBlocked && !dbUser.isRemoved;
    const canAccessR2 = canAccessR1 && Boolean(roundOverrides["2"] || r1Completed && isQualifiedR1);
    const canAccessR3 = canAccessR1 && Boolean(roundOverrides["3"] || r2Completed && isQualifiedR2);
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
        maxViolations: 2
      }
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ error: "Failed to retrieve participant profile." });
  }
});
app.get("/api/rounds", async (_req, res) => {
  try {
    const allRounds = await db.query.rounds.findMany({
      where: eq4(rounds.isPublished, true),
      orderBy: (rounds2, { asc }) => [asc(rounds2.roundNumber)]
    });
    res.json(allRounds);
  } catch (error) {
    console.error("Fetch rounds error:", error);
    res.status(500).json({ error: "Failed to retrieve competition rounds." });
  }
});
app.post("/api/attempts/start", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const { roundNumber } = req.body;
    const rNum = parseInt(roundNumber, 10);
    if (isNaN(rNum) || rNum < 1 || rNum > 3) {
      return res.status(400).json({ error: "Invalid round number." });
    }
    const dbUser = await db.query.users.findFirst({
      where: eq4(users.id, user.id)
    });
    if (dbUser?.isRemoved) {
      return res.status(403).json({
        error: "Terminal access revoked: Participant has been removed from the tournament roster by an administrator.",
        isRemoved: true
      });
    }
    if (dbUser?.isBlocked) {
      return res.status(403).json({
        error: "Questions blocked: Your terminal is restricted due to a rule violation.",
        isBlocked: true
      });
    }
    const round = await db.query.rounds.findFirst({
      where: eq4(rounds.roundNumber, rNum)
    });
    if (!round || !round.isOpen) {
      return res.status(400).json({ error: "Round is currently closed." });
    }
    const roundOverrides = dbUser?.roundOverrides || {};
    if (rNum === 2 && !roundOverrides["2"]) {
      const r1 = await db.query.rounds.findFirst({ where: eq4(rounds.roundNumber, 1) });
      const r1MinScore = r1 ? Math.ceil((r1.maxScore || 30) * ((r1.qualifyingPercentage || 60) / 100)) : 18;
      const r1Attempt = await db.query.quizAttempts.findFirst({
        where: and3(eq4(quizAttempts.userId, user.id), eq4(quizAttempts.roundId, r1?.id || 1)),
        orderBy: (quizAttempts2, { desc: desc2 }) => [desc2(quizAttempts2.id)]
      });
      const isR1Done = r1Attempt && (r1Attempt.status === "submitted" || r1Attempt.status === "timed_out");
      const isR1Qualified = isR1Done && (r1Attempt.isQualified || r1Attempt.score >= r1MinScore);
      if (!isR1Qualified) {
        return res.status(403).json({
          error: `Round 2 is locked. Qualification required: You must achieve at least ${r1?.qualifyingPercentage || 60}% (${r1MinScore} marks) in Round 1 to unlock Round 2.`,
          locked: true,
          requiredRound: 1,
          qualifyingScore: r1MinScore
        });
      }
    } else if (rNum === 3 && !roundOverrides["3"]) {
      const r2 = await db.query.rounds.findFirst({ where: eq4(rounds.roundNumber, 2) });
      const r2MinScore = r2 ? Math.ceil((r2.maxScore || 300) * ((r2.qualifyingPercentage || 60) / 100)) : 180;
      const r2Attempt = await db.query.quizAttempts.findFirst({
        where: and3(eq4(quizAttempts.userId, user.id), eq4(quizAttempts.roundId, r2?.id || 2)),
        orderBy: (quizAttempts2, { desc: desc2 }) => [desc2(quizAttempts2.id)]
      });
      const isR2Done = r2Attempt && (r2Attempt.status === "submitted" || r2Attempt.status === "timed_out");
      const isR2Qualified = isR2Done && (r2Attempt.isQualified || r2Attempt.score >= r2MinScore);
      if (!isR2Qualified) {
        return res.status(403).json({
          error: `Round 3 is locked. Qualification required: You must achieve at least ${r2?.qualifyingPercentage || 60}% (${r2MinScore} marks) in Round 2 to unlock Round 3.`,
          locked: true,
          requiredRound: 2,
          qualifyingScore: r2MinScore
        });
      }
    }
    let attempt = await db.query.quizAttempts.findFirst({
      where: and3(eq4(quizAttempts.userId, user.id), eq4(quizAttempts.roundId, round.id)),
      orderBy: (quizAttempts2, { desc: desc2 }) => [desc2(quizAttempts2.id)]
    });
    const now = /* @__PURE__ */ new Date();
    if (attempt && (attempt.status === "submitted" || attempt.status === "timed_out" || attempt.status === "completed")) {
      const retakesAllowed = dbUser?.retakesAllowed || {};
      if (!retakesAllowed[String(rNum)]) {
        return res.status(400).json({
          error: `Round ${rNum} has already been completed and submitted. Multiple attempts require explicit administrator authorization.`,
          alreadySubmitted: true,
          score: attempt.score
        });
      }
      delete retakesAllowed[String(rNum)];
      await db.update(users).set({ retakesAllowed }).where(eq4(users.id, user.id));
      attempt = null;
    }
    if (!attempt || attempt.status === "removed") {
      const serverDeadline = new Date(now.getTime() + round.durationMinutes * 60 * 1e3);
      const rawQs = await db.query.questions.findMany({
        where: and3(eq4(questions.roundId, round.id), eq4(questions.isActive, true)),
        orderBy: (questions2, { asc }) => [asc(questions2.orderIndex), asc(questions2.id)]
      });
      const shuffledQuestionsList = shuffleArray(rawQs);
      const shuffledMapping = shuffledQuestionsList.map((q) => {
        const originalOpts = q.options || [];
        const optionIndices = shuffleArray([0, 1, 2, 3].slice(0, originalOpts.length));
        return {
          questionId: q.id,
          optionIndices
        };
      });
      const [newAttempt] = await db.insert(quizAttempts).values({
        userId: user.id,
        roundId: round.id,
        status: "in_progress",
        startTime: now,
        serverDeadline,
        score: 0,
        totalQuestions: rawQs.length,
        answersCount: 0,
        violationsCount: 0,
        totalPausedSeconds: 0,
        shuffledQuestions: shuffledMapping
      }).returning();
      attempt = newAttempt;
      await db.insert(auditLogs).values({
        userId: user.id,
        action: "START_ATTEMPT",
        targetType: "quiz_attempts",
        targetId: String(attempt.id),
        metadata: { roundNumber: rNum, serverDeadline }
      });
    }
    let remainingMs = 0;
    if (attempt.status === "suspended_awaiting_approval") {
      const pauseTime = attempt.pausedAt ? new Date(attempt.pausedAt).getTime() : now.getTime();
      remainingMs = new Date(attempt.serverDeadline).getTime() - pauseTime;
    } else if (attempt.status === "in_progress" || attempt.status === "resumed") {
      remainingMs = new Date(attempt.serverDeadline).getTime() - now.getTime();
      if (remainingMs <= 0) {
        await db.update(quizAttempts).set({ status: "timed_out", endTime: now }).where(eq4(quizAttempts.id, attempt.id));
        attempt.status = "timed_out";
      }
    }
    const rawQuestions = await db.query.questions.findMany({
      where: and3(eq4(questions.roundId, round.id), eq4(questions.isActive, true))
    });
    const questionMap = /* @__PURE__ */ new Map();
    rawQuestions.forEach((q) => questionMap.set(q.id, q));
    let mappingList = attempt.shuffledQuestions || [];
    const originalMappingLength = mappingList.length;
    mappingList = mappingList.filter((m) => questionMap.has(m.questionId));
    let orderedQuestions = [];
    const mappedIds = new Set(mappingList.map((m) => m.questionId));
    const missingQs = rawQuestions.filter((q) => !mappedIds.has(q.id));
    if (missingQs.length > 0 || mappingList.length !== originalMappingLength) {
      const extraMapped = shuffleArray(missingQs).map((q) => {
        const originalOpts = q.options || [];
        const optionIndices = shuffleArray([0, 1, 2, 3].slice(0, originalOpts.length));
        return {
          questionId: q.id,
          optionIndices
        };
      });
      mappingList = shuffleArray([...mappingList, ...extraMapped]);
      await db.update(quizAttempts).set({
        shuffledQuestions: mappingList,
        totalQuestions: mappingList.length
      }).where(eq4(quizAttempts.id, attempt.id));
    }
    if (mappingList && mappingList.length > 0) {
      mappingList.forEach((m) => {
        const q = questionMap.get(m.questionId);
        if (q) {
          const isQa = q.type === "qa" || round.roundNumber === 2 && q.type !== "code";
          const originalOpts = q.options || [];
          const shuffledOpts = isQa ? [] : m.optionIndices.map((idx) => originalOpts[idx]);
          orderedQuestions.push({
            id: q.id,
            code: q.code,
            prompt: q.prompt,
            type: isQa ? "qa" : q.type,
            options: shuffledOpts,
            codeStarter: q.codeStarter,
            points: q.points,
            orderIndex: q.orderIndex,
            category: q.category
          });
        }
      });
    } else {
      orderedQuestions = shuffleArray(rawQuestions).map((q) => {
        const isQa = q.type === "qa" || round.roundNumber === 2 && q.type !== "code";
        return {
          id: q.id,
          code: q.code,
          prompt: q.prompt,
          type: isQa ? "qa" : q.type,
          options: isQa ? [] : q.options,
          codeStarter: q.codeStarter,
          points: q.points,
          orderIndex: q.orderIndex,
          category: q.category
        };
      });
    }
    const savedAnswers = await db.query.participantAnswers.findMany({
      where: eq4(participantAnswers.attemptId, attempt.id)
    });
    const answersMap = {};
    savedAnswers.forEach((ans) => {
      answersMap[ans.questionId] = {
        selectedOption: ans.selectedOption ?? void 0,
        submittedCode: ans.submittedCode ?? void 0
      };
    });
    res.json({
      attemptId: attempt.id,
      roundId: round.id,
      roundNumber: round.roundNumber,
      status: attempt.status,
      serverDeadline: attempt.serverDeadline,
      remainingSeconds: Math.max(0, Math.floor(remainingMs / 1e3)),
      durationMinutes: round.durationMinutes,
      qualifyingPercentage: round.qualifyingPercentage,
      maxScore: round.maxScore,
      violationsCount: attempt.violationsCount,
      maxViolations: round.maxViolations,
      isSuspended: attempt.status === "suspended_awaiting_approval",
      pausedAt: attempt.pausedAt,
      resumedAt: attempt.resumedAt,
      questions: orderedQuestions,
      savedAnswers: answersMap
    });
  } catch (error) {
    console.error("Start attempt error:", error);
    res.status(500).json({ error: "Failed to initialize quiz attempt." });
  }
});
app.get("/api/attempts/:id/sync", requireAuth, async (req, res) => {
  try {
    const attemptId = parseInt(req.params.id, 10);
    const user = req.user;
    const attempt = await db.query.quizAttempts.findFirst({
      where: and3(eq4(quizAttempts.id, attemptId), eq4(quizAttempts.userId, user.id))
    });
    if (!attempt) {
      return res.status(404).json({ error: "Attempt not found." });
    }
    const now = /* @__PURE__ */ new Date();
    let remainingMs = 0;
    if (attempt.status === "suspended_awaiting_approval") {
      const pauseTime = attempt.pausedAt ? new Date(attempt.pausedAt).getTime() : now.getTime();
      remainingMs = new Date(attempt.serverDeadline).getTime() - pauseTime;
    } else if (attempt.status === "in_progress" || attempt.status === "resumed") {
      remainingMs = new Date(attempt.serverDeadline).getTime() - now.getTime();
      if (remainingMs <= 0) {
        await db.update(quizAttempts).set({ status: "timed_out", endTime: now }).where(eq4(quizAttempts.id, attempt.id));
        attempt.status = "timed_out";
      }
    }
    res.json({
      attemptId: attempt.id,
      status: attempt.status,
      remainingSeconds: Math.max(0, Math.floor(remainingMs / 1e3)),
      isSuspended: attempt.status === "suspended_awaiting_approval",
      serverTime: now.toISOString(),
      violationsCount: attempt.violationsCount,
      isDisqualified: attempt.isDisqualified,
      terminationReason: attempt.terminationReason,
      disqualificationReason: attempt.disqualificationReason
    });
  } catch (error) {
    console.error("Sync attempt error:", error);
    res.status(500).json({ error: "Failed to synchronize attempt timer." });
  }
});
function evaluateQaTextAnswer(question, rawAnswer) {
  const userRaw = String(rawAnswer || "").trim();
  if (!userRaw) return false;
  const norm = (s) => s.toLowerCase().replace(/[.,;!?'"`()[\]{}]/g, " ").replace(/\s+/g, " ").trim();
  const compact = (s) => s.toLowerCase().replace(/\s+/g, "");
  const userNorm = norm(userRaw);
  const userCompact = compact(userRaw);
  const qOpts = Array.isArray(question.options) ? question.options : [];
  const expectedPrimary = String(qOpts[question.correctOption ?? 0] || "").trim();
  if (expectedPrimary) {
    if (userNorm === norm(expectedPrimary) || userCompact === compact(expectedPrimary)) {
      return true;
    }
  }
  const code = String(question.code || "").toUpperCase();
  const acceptedByCode = {
    Q1: ["15"],
    Q2: ["even"],
    Q3: ["22"],
    Q4: ["5", "5 times", "five", "five times"],
    Q5: ["3 and 1", "3 1", "3, 1", "3,1"],
    Q6: ["primary key", "primary"],
    Q7: ["ram", "random access memory"],
    Q8: ["<a>", "a", "<a></a>", "anchor", "anchor tag", "a tag", "<a href>"],
    Q9: ["42"],
    Q10: ["10"],
    Q11: ["8"],
    Q12: ["15"],
    Q13: ["10 10", "10, 10", "10,10", "10 and 10"],
    Q14: ["60"],
    Q15: ["3", "three"],
    Q16: ["search efficiently in a sorted array", "searching in a sorted array", "search a sorted array", "fast search in sorted array"],
    Q17: ["13"],
    Q18: ["missing semicolon", "semicolon missing", "a semicolon is missing", ";", "semicolon", "missing ;"],
    Q19: ["router"],
    Q20: ["11"],
    Q21: ["5"],
    Q22: ["6"],
    Q23: ["40000", "40,000", "40k"],
    Q24: ["24"],
    Q25: ["(2,7) and (3,6)", "2,7 and 3,6", "(2, 7) and (3, 6)", "2 7 and 3 6", "(2,7), (3,6)"],
    Q26: ["a"],
    Q27: ["2nf", "second normal form", "2nd normal form"],
    Q28: ["8 ms", "8ms", "8", "8 milliseconds"],
    Q29: ["720"],
    Q30: ["-3"]
  };
  const extras = acceptedByCode[code] || [];
  for (const cand of extras) {
    if (userNorm === norm(cand) || userCompact === compact(cand)) {
      return true;
    }
  }
  if (code === "Q16" && userNorm.includes("search") && userNorm.includes("sort")) {
    return true;
  }
  if (code === "Q18" && (userNorm.includes("semicolon") || userRaw.includes(";"))) {
    return true;
  }
  if (code === "Q25" && userRaw.includes("2") && userRaw.includes("7") && userRaw.includes("3") && userRaw.includes("6")) {
    return true;
  }
  return false;
}
app.post("/api/attempts/:id/answer", requireAuth, async (req, res) => {
  try {
    const attemptId = parseInt(req.params.id, 10);
    const user = req.user;
    const { questionId, selectedOption, submittedCode, submittedAnswer } = req.body;
    const textSubmission = submittedAnswer !== void 0 ? submittedAnswer : submittedCode;
    const attempt = await db.query.quizAttempts.findFirst({
      where: and3(eq4(quizAttempts.id, attemptId), eq4(quizAttempts.userId, user.id))
    });
    if (!attempt) {
      return res.status(404).json({ error: "Attempt not found." });
    }
    if (attempt.status === "suspended_awaiting_approval") {
      return res.status(403).json({
        error: "Submission rejected: Task is suspended awaiting Chief Proctor review and authorization.",
        status: attempt.status
      });
    }
    if (attempt.status !== "in_progress" && attempt.status !== "resumed") {
      return res.status(403).json({
        error: `Submission rejected: Assessment attempt is ${attempt.status}.`,
        status: attempt.status
      });
    }
    const userCheck = await db.query.users.findFirst({
      where: eq4(users.id, user.id)
    });
    if (userCheck?.isRemoved) {
      return res.status(403).json({
        error: "Submission rejected: Participant has been removed from competition."
      });
    }
    if (userCheck?.isBlocked || attempt.isDisqualified || attempt.status === "terminated") {
      return res.status(403).json({
        error: "Submission rejected: Assessment attempt has been terminated by proctor enforcement."
      });
    }
    if (Date.now() > attempt.serverDeadline.getTime()) {
      await db.update(quizAttempts).set({ status: "timed_out", endTime: /* @__PURE__ */ new Date() }).where(eq4(quizAttempts.id, attempt.id));
      return res.status(400).json({ error: "Time expired for this assessment." });
    }
    const question = await db.query.questions.findFirst({
      where: eq4(questions.id, parseInt(questionId, 10))
    });
    if (!question) {
      return res.status(404).json({ error: "Question not found." });
    }
    const shuffledList = attempt.shuffledQuestions || [];
    const qMapping = shuffledList.find((m) => m.questionId === question.id);
    let originalSelectedOption = selectedOption;
    if (qMapping && selectedOption !== void 0 && qMapping.optionIndices && qMapping.optionIndices[selectedOption] !== void 0) {
      originalSelectedOption = qMapping.optionIndices[selectedOption];
    }
    let isCorrect = false;
    let pointsEarned = 0;
    const isQaQuestion = question.type === "qa" || question.roundId === 2 && question.type !== "code";
    if (isQaQuestion) {
      isCorrect = evaluateQaTextAnswer(question, String(textSubmission || ""));
      pointsEarned = isCorrect ? question.points : 0;
    } else if (question.type === "mcq") {
      isCorrect = selectedOption !== void 0 && originalSelectedOption === question.correctOption;
      pointsEarned = isCorrect ? question.points : 0;
    } else if (question.type === "code") {
      const codeStr = String(textSubmission || "").trim();
      const starterStr = String(question.codeStarter || "").trim();
      const normalizeCode = (s) => s.replace(/\/\/.*$/gm, "").replace(/#.*$/gm, "").replace(/\s+/g, "");
      const normSub = normalizeCode(codeStr);
      const normStarter = normalizeCode(starterStr);
      if (codeStr.length >= 15 && normSub !== normStarter && normSub.length > 10) {
        isCorrect = true;
        pointsEarned = question.points;
      }
    }
    const existing = await db.query.participantAnswers.findFirst({
      where: and3(
        eq4(participantAnswers.attemptId, attempt.id),
        eq4(participantAnswers.questionId, question.id)
      )
    });
    if (existing) {
      await db.update(participantAnswers).set({
        selectedOption: selectedOption ?? existing.selectedOption,
        submittedCode: textSubmission !== void 0 ? textSubmission : existing.submittedCode,
        isCorrect,
        pointsEarned,
        submittedAt: /* @__PURE__ */ new Date()
      }).where(eq4(participantAnswers.id, existing.id));
    } else {
      await db.insert(participantAnswers).values({
        attemptId: attempt.id,
        questionId: question.id,
        selectedOption,
        submittedCode: textSubmission,
        isCorrect,
        pointsEarned
      });
    }
    const [allAnswers, roundObj, activeRoundQs] = await Promise.all([
      db.query.participantAnswers.findMany({
        where: eq4(participantAnswers.attemptId, attempt.id)
      }),
      db.query.rounds.findFirst({
        where: eq4(rounds.id, attempt.roundId)
      }),
      db.query.questions.findMany({
        where: and3(eq4(questions.roundId, attempt.roundId), eq4(questions.isActive, true))
      })
    ]);
    const rawScore = allAnswers.reduce((sum, a) => sum + (a.isCorrect ? a.pointsEarned : 0), 0);
    const rawMaxPoints = activeRoundQs.reduce((sum, q) => sum + (q.points || 1), 0);
    const configuredMax = roundObj?.maxScore || rawMaxPoints;
    const newScore = rawMaxPoints > 0 && configuredMax > 0 && configuredMax !== rawMaxPoints ? Math.round(rawScore / rawMaxPoints * configuredMax) : rawScore;
    await db.update(quizAttempts).set({
      score: newScore,
      answersCount: allAnswers.length
    }).where(eq4(quizAttempts.id, attempt.id));
    res.json({
      success: true,
      questionId: question.id,
      answersCount: allAnswers.length
    });
  } catch (error) {
    console.error("Answer submission error:", error);
    res.status(500).json({ error: "Failed to record answer." });
  }
});
app.post(
  "/api/attempts/:id/security-event",
  requireAuth,
  async (req, res) => {
    try {
      const attemptId = parseInt(req.params.id, 10);
      const user = req.user;
      const { violationType, details } = req.body;
      const attempt = await db.query.quizAttempts.findFirst({
        where: and3(eq4(quizAttempts.id, attemptId), eq4(quizAttempts.userId, user.id)),
        with: { round: true }
      });
      if (!attempt) {
        return res.status(404).json({ error: "Attempt not found." });
      }
      if (attempt.status === "suspended_awaiting_approval") {
        return res.json({
          suspended: true,
          status: "suspended_awaiting_approval",
          incidentCount: attempt.violationsCount,
          message: "Task is suspended awaiting Chief Proctor review and authorization."
        });
      }
      if (attempt.status !== "in_progress" && attempt.status !== "resumed") {
        return res.status(400).json({ error: `Attempt is not currently active (${attempt.status}).` });
      }
      const cleanType = violationType || "tab_switch";
      const cleanDetails = details || "Tab switch / Window focus departure";
      const now = /* @__PURE__ */ new Date();
      await db.insert(securityViolations).values({
        attemptId: attempt.id,
        userId: user.id,
        roundId: attempt.roundId,
        violationType: cleanType,
        details: cleanDetails,
        serverTimestamp: now
      });
      const newViolationsCount = (attempt.violationsCount || 0) + 1;
      await db.update(quizAttempts).set({
        status: "suspended_awaiting_approval",
        pausedAt: now,
        lastIncidentAt: now,
        violationsCount: newViolationsCount,
        disqualificationReason: cleanDetails
      }).where(eq4(quizAttempts.id, attempt.id));
      await db.insert(activityEvents).values({
        userId: user.id,
        attemptId: attempt.id,
        eventType: "TAB_SWITCH_SUSPENSION",
        details: `Tab/window switch incident #${newViolationsCount} detected: ${cleanDetails}. Assessment suspended awaiting proctor authorization.`,
        severity: "critical"
      });
      await db.insert(auditLogs).values({
        userId: user.id,
        action: "TAB_SWITCH_SUSPENSION",
        targetType: "quiz_attempts",
        targetId: String(attempt.id),
        metadata: {
          violationType: cleanType,
          incidentCount: newViolationsCount,
          details: cleanDetails,
          pausedAt: now
        }
      });
      return res.json({
        suspended: true,
        status: "suspended_awaiting_approval",
        strikes: newViolationsCount,
        incidentCount: newViolationsCount,
        pausedAt: now.toISOString(),
        message: "TASK SUSPENDED: Leaving the active task window violates tournament rules. Assessment has been suspended pending Chief Proctor authorization."
      });
    } catch (error) {
      console.error("Security event error:", error);
      res.status(500).json({ error: "Failed to record security event." });
    }
  }
);
app.post("/api/attempts/:id/submit", requireAuth, async (req, res) => {
  try {
    const attemptId = parseInt(req.params.id, 10);
    const user = req.user;
    const attempt = await db.query.quizAttempts.findFirst({
      where: and3(eq4(quizAttempts.id, attemptId), eq4(quizAttempts.userId, user.id)),
      with: { round: true }
    });
    if (!attempt) {
      return res.status(404).json({ error: "Attempt not found." });
    }
    if (attempt.status === "suspended_awaiting_approval") {
      return res.status(403).json({
        error: "Submission rejected: Assessment is currently suspended awaiting Chief Proctor review."
      });
    }
    if (attempt.status === "terminated" || attempt.status === "removed" || attempt.status === "disqualified") {
      return res.status(403).json({
        error: "Submission rejected: Assessment attempt has been terminated."
      });
    }
    const now = /* @__PURE__ */ new Date();
    const [allAnswers, activeRoundQs] = await Promise.all([
      db.query.participantAnswers.findMany({
        where: eq4(participantAnswers.attemptId, attempt.id)
      }),
      db.query.questions.findMany({
        where: and3(eq4(questions.roundId, attempt.roundId), eq4(questions.isActive, true))
      })
    ]);
    const rawScore = allAnswers.reduce((sum, a) => sum + (a.isCorrect ? a.pointsEarned : 0), 0);
    const rawMaxPoints = activeRoundQs.reduce((sum, q) => sum + (q.points || 1), 0);
    const maxScore = attempt.round.maxScore || (attempt.round.roundNumber === 1 ? 30 : attempt.round.roundNumber === 2 ? 300 : 30);
    const finalScore = rawMaxPoints > 0 && maxScore > 0 && maxScore !== rawMaxPoints ? Math.round(rawScore / rawMaxPoints * maxScore) : rawScore;
    const qualPct = attempt.round.qualifyingPercentage || 60;
    const qualifyingScore = Math.ceil(maxScore * (qualPct / 100));
    const isQualified = finalScore >= qualifyingScore;
    await db.update(quizAttempts).set({
      status: "submitted",
      score: finalScore,
      isQualified,
      endTime: now
    }).where(eq4(quizAttempts.id, attempt.id));
    await db.insert(auditLogs).values({
      userId: user.id,
      action: "SUBMIT_ATTEMPT",
      targetType: "quiz_attempts",
      targetId: String(attempt.id),
      metadata: { score: finalScore, maxScore, isQualified, roundNumber: attempt.round.roundNumber }
    });
    res.json({
      success: true,
      score: finalScore,
      maxScore,
      qualifyingScore,
      qualifyingPercentage: qualPct,
      isQualified,
      roundNumber: attempt.round.roundNumber,
      message: isQualified ? `Round ${attempt.round.roundNumber} submitted! Congratulations, you qualified with ${finalScore}/${maxScore} marks.` : `Round ${attempt.round.roundNumber} submitted. You scored ${finalScore}/${maxScore} marks (Required to qualify: ${qualifyingScore}).`
    });
  } catch (error) {
    console.error("Submit attempt error:", error);
    res.status(500).json({ error: "Failed to submit attempt." });
  }
});
app.get("/api/attempts/:id/review", requireAuth, async (req, res) => {
  try {
    const attemptId = parseInt(req.params.id, 10);
    const user = req.user;
    const attempt = await db.query.quizAttempts.findFirst({
      where: and3(eq4(quizAttempts.id, attemptId), eq4(quizAttempts.userId, user.id)),
      with: { round: true }
    });
    if (!attempt) {
      return res.status(404).json({ error: "Attempt not found." });
    }
    if (attempt.status !== "submitted" && attempt.status !== "timed_out" && attempt.status !== "completed") {
      return res.status(400).json({ error: "Detailed review is only available after attempt submission." });
    }
    if (user.role !== "admin") {
      return res.status(403).json({
        error: "Answers and master answer keys are strictly confidential and never displayed to participants.",
        locked: true
      });
    }
    const roundQuestions = await db.query.questions.findMany({
      where: eq4(questions.roundId, attempt.roundId),
      orderBy: (questions2, { asc }) => [asc(questions2.orderIndex)]
    });
    const userAnswers = await db.query.participantAnswers.findMany({
      where: eq4(participantAnswers.attemptId, attempt.id)
    });
    const answersMap = {};
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
      pointsEarned: answersMap[q.id]?.pointsEarned || 0
    }));
    res.json({
      attemptId: attempt.id,
      score: attempt.score,
      maxScore: attempt.round.maxScore,
      isQualified: attempt.isQualified,
      questions: reviewQuestions
    });
  } catch (error) {
    console.error("Review attempt error:", error);
    res.status(500).json({ error: "Failed to load attempt review." });
  }
});
app.post("/api/appeals", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const { appealReason } = req.body;
    if (!appealReason || String(appealReason).trim().length < 5) {
      return res.status(400).json({ error: "Please provide a descriptive reason for your appeal." });
    }
    const lastAttempt = await db.query.quizAttempts.findFirst({
      where: eq4(quizAttempts.userId, user.id),
      orderBy: (quizAttempts2, { desc: desc2 }) => [desc2(quizAttempts2.id)]
    });
    if (!lastAttempt) {
      return res.status(400).json({ error: "No quiz attempts found to appeal." });
    }
    const [review] = await db.insert(disqualificationReviews).values({
      attemptId: lastAttempt.id,
      userId: user.id,
      appealReason: String(appealReason).trim(),
      status: "pending"
    }).returning();
    await db.insert(auditLogs).values({
      userId: user.id,
      action: "SUBMIT_APPEAL",
      targetType: "disqualification_reviews",
      targetId: String(review.id),
      metadata: { appealReason }
    });
    res.json({
      success: true,
      reviewId: review.id,
      message: "Your appeal has been submitted to the Chief Proctor for review."
    });
  } catch (error) {
    console.error("Appeal error:", error);
    res.status(500).json({ error: "Failed to submit appeal." });
  }
});
app.get("/api/leaderboard", async (_req, res) => {
  try {
    const allUsers = await db.query.users.findMany({
      where: eq4(users.role, "participant"),
      with: {
        attempts: true
      }
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
          totalTimeSeconds += Math.max(0, (endMs - startMs) / 1e3);
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
        totalTimeSeconds
      };
    });
    leaderboard.sort((a, b) => {
      if (b.totalScore !== a.totalScore) {
        return b.totalScore - a.totalScore;
      }
      return a.totalTimeSeconds - b.totalTimeSeconds;
    });
    const ranked = leaderboard.map((item, idx) => ({
      ...item,
      rank: idx + 1
    }));
    const collegeMap = {};
    ranked.forEach((item) => {
      if (!collegeMap[item.college]) {
        collegeMap[item.college] = { total: item.totalScore, count: 1, zone: item.zone || "South Zone" };
      } else {
        collegeMap[item.college].total += item.totalScore;
        collegeMap[item.college].count += 1;
      }
    });
    const collegeStandings = Object.entries(collegeMap).map(([institution, data]) => ({
      institution,
      zone: data.zone,
      avgPts: data.count > 0 ? Number((data.total / data.count).toFixed(1)) : 0,
      activeCount: data.count
    })).sort((a, b) => b.avgPts - a.avgPts).map((item, idx) => ({ ...item, rank: idx + 1 }));
    res.json({
      leaderboard: ranked,
      collegeStandings
    });
  } catch (error) {
    console.error("Leaderboard error:", error);
    res.status(500).json({ error: "Failed to generate leaderboard.", details: error?.message || String(error) });
  }
});
app.post(
  "/api/admin/participants/:id/block",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const targetId = parseInt(req.params.id, 10);
      const { reason } = req.body;
      const cleanReason = reason || "Administrative Disqualification by Chief Proctor.";
      await db.update(users).set({
        isBlocked: true,
        blockReason: cleanReason
      }).where(eq4(users.id, targetId));
      await db.insert(auditLogs).values({
        userId: req.user.id,
        action: "EJECT_PARTICIPANT",
        targetType: "users",
        targetId: String(targetId),
        metadata: { reason: cleanReason }
      });
      res.json({ success: true, message: "Participant has been blocked and questions locked." });
    } catch (error) {
      console.error("Block participant error:", error);
      res.status(500).json({ error: "Failed to block participant." });
    }
  }
);
app.get("/api/admin/violations", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const list = await db.query.securityViolations.findMany({
      with: {
        user: true,
        round: true
      },
      orderBy: (securityViolations2, { desc: desc2 }) => [desc2(securityViolations2.id)],
      limit: 50
    });
    const formatted = list.map((v) => ({
      id: v.id,
      teamName: v.user?.teamName || "Unknown Team",
      code: v.user?.code || "N/A",
      college: v.user?.college || "N/A",
      roundTitle: v.round?.title || "Unknown Round",
      violationType: v.violationType,
      details: v.details,
      timestamp: v.serverTimestamp
    }));
    res.json(formatted);
  } catch (error) {
    console.error("Admin violations error:", error);
    res.status(500).json({ error: "Failed to fetch violation timeline." });
  }
});
app.get("/api/admin/appeals", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const list = await db.query.disqualificationReviews.findMany({
      with: {
        user: true,
        attempt: { with: { round: true } }
      },
      orderBy: (disqualificationReviews2, { desc: desc2 }) => [desc2(disqualificationReviews2.id)]
    });
    const formatted = list.map((a) => ({
      id: a.id,
      userId: a.user?.id,
      teamName: a.user?.teamName || "Unknown Team",
      code: a.user?.code || "N/A",
      college: a.user?.college || "N/A",
      roundTitle: a.attempt?.round?.title || "Unknown Round",
      appealReason: a.appealReason,
      status: a.status,
      reviewerNotes: a.reviewerNotes,
      reviewedBy: a.reviewedBy,
      reviewedAt: a.reviewedAt,
      createdAt: a.createdAt
    }));
    res.json(formatted);
  } catch (error) {
    console.error("Admin appeals error:", error);
    res.status(500).json({ error: "Failed to fetch appeals." });
  }
});
app.post(
  "/api/admin/appeals/:id/review",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const appealId = parseInt(req.params.id, 10);
      const { status, notes } = req.body;
      const review = await db.query.disqualificationReviews.findFirst({
        where: eq4(disqualificationReviews.id, appealId),
        with: { user: true }
      });
      if (!review) {
        return res.status(404).json({ error: "Appeal not found." });
      }
      const now = /* @__PURE__ */ new Date();
      await db.update(disqualificationReviews).set({
        status,
        reviewerNotes: notes || "",
        reviewedBy: req.user.name,
        reviewedAt: now
      }).where(eq4(disqualificationReviews.id, appealId));
      if (status === "approved") {
        await db.update(users).set({ isBlocked: false, blockReason: null }).where(eq4(users.id, review.userId));
        await db.update(quizAttempts).set({ isDisqualified: false, violationsCount: 0 }).where(eq4(quizAttempts.id, review.attemptId));
      }
      await db.insert(auditLogs).values({
        userId: req.user.id,
        action: `REVIEW_APPEAL_${status.toUpperCase()}`,
        targetType: "disqualification_reviews",
        targetId: String(appealId),
        metadata: { status, notes, targetUser: review.user?.teamName || "Participant" }
      });
      res.json({ success: true, message: `Appeal marked as ${status}.` });
    } catch (error) {
      console.error("Review appeal error:", error);
      res.status(500).json({ error: "Failed to review appeal." });
    }
  }
);
app.post(
  "/api/admin/rounds/:id/toggle",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const roundId = parseInt(req.params.id, 10);
      const round = await db.query.rounds.findFirst({
        where: eq4(rounds.id, roundId)
      });
      if (!round) {
        return res.status(404).json({ error: "Round not found." });
      }
      const newOpenState = !round.isOpen;
      await db.update(rounds).set({ isOpen: newOpenState }).where(eq4(rounds.id, roundId));
      await db.insert(auditLogs).values({
        userId: req.user.id,
        action: "TOGGLE_ROUND",
        targetType: "rounds",
        targetId: String(roundId),
        metadata: { isOpen: newOpenState }
      });
      res.json({ success: true, isOpen: newOpenState });
    } catch (error) {
      console.error("Toggle round error:", error);
      res.status(500).json({ error: "Failed to toggle round." });
    }
  }
);
app.get("/api/admin/export-csv", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const participantList = await db.query.users.findMany({
      where: eq4(users.role, "participant"),
      with: {
        attempts: {
          with: { round: true }
        }
      }
    });
    const rows = [
      ["Rank", "Team Code", "Team Name", "College", "Members", "Round 1 Pts", "Round 2 Pts", "Round 3 Pts", "Total Score", "Status", "Violation Strikes"]
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
        members: p.teamMembers.join("; "),
        r1,
        r2,
        r3,
        total: r1 + r2 + r3,
        status: p.isBlocked ? "Disqualified" : "Active",
        strikes
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
        String(item.strikes)
      ]);
    });
    const csvContent = rows.map((r) => r.join(",")).join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="tech_arena_results.csv"');
    res.send(csvContent);
  } catch (error) {
    console.error("Export CSV error:", error);
    res.status(500).json({ error: "Failed to export CSV." });
  }
});
app.get("/api/admin/audit-logs", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const logs = await db.query.auditLogs.findMany({
      orderBy: (auditLogs2, { desc: desc2 }) => [desc2(auditLogs2.id)],
      limit: 100
    });
    res.json(logs);
  } catch (error) {
    console.error("Audit logs error:", error);
    res.status(500).json({ error: "Failed to fetch audit logs." });
  }
});
async function startServer() {
  const isProduction = process.env.NODE_ENV === "production";
  if (!isProduction) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (_req, res) => {
      res.sendFile("dist/index.html", { root: "." });
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`TECH ARENA production server running on port ${PORT}`);
  });
}
if (!process.env.VERCEL) {
  startServer();
}
var server_default = app;
export {
  app,
  server_default as default,
  ensureDatabaseSeeded
};
