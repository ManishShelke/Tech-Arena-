import { pgTable, serial, text, integer, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  role: text('role').notNull().default('participant'), // 'participant' | 'admin'
  name: text('name').notNull(),
  college: text('college').notNull(),
  teamName: text('team_name').notNull(),
  teamMembers: jsonb('team_members').notNull().$type<string[]>(),
  code: text('code').notNull().unique(),
  zone: text('zone').notNull().default('South Zone'),
  isBlocked: boolean('is_blocked').notNull().default(false),
  blockReason: text('block_reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const adminSessions = pgTable('admin_sessions', {
  id: serial('id').primaryKey(),
  token: text('token').notNull().unique(),
  adminId: integer('admin_id').references(() => users.id),
  ip: text('ip'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  isActive: boolean('is_active').notNull().default(true),
});

export const participantSessions = pgTable('participant_sessions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  status: text('status').notNull().default('online'), // 'online' | 'offline' | 'logged_out' | 'connection_lost'
  currentDifficulty: text('current_difficulty').default('easy'), // 'easy' | 'intermediate' | 'hard'
  currentChallengeId: integer('current_challenge_id'),
  lastHeartbeat: timestamp('last_heartbeat').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  ipAddress: text('ip_address'),
});

export const events = pgTable('events', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  bannerUrl: text('banner_url'),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  isActive: boolean('is_active').notNull().default(true),
});

export const rounds = pgTable('rounds', {
  id: serial('id').primaryKey(),
  roundNumber: integer('round_number').notNull().unique(),
  difficulty: text('difficulty').notNull().default('easy'), // 'easy' | 'intermediate' | 'hard'
  title: text('title').notNull(),
  description: text('description').notNull(),
  durationMinutes: integer('duration_minutes').notNull().default(30),
  maxViolations: integer('max_violations').notNull().default(2),
  isOpen: boolean('is_open').notNull().default(true),
  isPublished: boolean('is_published').notNull().default(true),
  orderIndex: integer('order_index').notNull().default(1),
});

export const questions = pgTable('questions', {
  id: serial('id').primaryKey(),
  roundId: integer('round_id').notNull().references(() => rounds.id),
  prompt: text('prompt').notNull(),
  type: text('type').notNull().default('mcq'), // 'mcq' | 'code'
  options: jsonb('options').$type<string[]>(),
  correctOption: integer('correct_option'),
  codeStarter: text('code_starter'),
  points: integer('points').notNull().default(10),
  orderIndex: integer('order_index').notNull().default(1),
  category: text('category').notNull().default('General'),
});

export const quizAttempts = pgTable('quiz_attempts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  roundId: integer('round_id').notNull().references(() => rounds.id),
  status: text('status').notNull().default('in_progress'), // 'in_progress' | 'submitted' | 'completed' | 'timed_out' | 'terminated' | 'disqualified'
  startTime: timestamp('start_time').defaultNow().notNull(),
  serverDeadline: timestamp('server_deadline').notNull(),
  endTime: timestamp('end_time'),
  score: integer('score').notNull().default(0),
  totalQuestions: integer('total_questions').notNull().default(0),
  answersCount: integer('answers_count').notNull().default(0),
  violationsCount: integer('violations_count').notNull().default(0),
  isDisqualified: boolean('is_disqualified').notNull().default(false),
  disqualificationReason: text('disqualification_reason'),
  terminationReason: text('termination_reason'),
  terminatedAt: timestamp('terminated_at'),
});

export const participantAnswers = pgTable('participant_answers', {
  id: serial('id').primaryKey(),
  attemptId: integer('attempt_id').notNull().references(() => quizAttempts.id),
  questionId: integer('question_id').notNull().references(() => questions.id),
  selectedOption: integer('selected_option'),
  submittedCode: text('submitted_code'),
  isCorrect: boolean('is_correct').notNull().default(false),
  pointsEarned: integer('points_earned').notNull().default(0),
  submittedAt: timestamp('submitted_at').defaultNow().notNull(),
  attemptNumber: integer('attempt_number').notNull().default(1),
  rejectionReason: text('rejection_reason'),
  manuallyAdjusted: boolean('manually_adjusted').notNull().default(false),
  adjustedBy: text('adjusted_by'),
  adjustedReason: text('adjusted_reason'),
});

export const activityEvents = pgTable('activity_events', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  attemptId: integer('attempt_id'),
  eventType: text('event_type').notNull(), // 'LOGIN' | 'LOGOUT' | 'ATTEMPT_STARTED' | 'DIFFICULTY_SELECTED' | 'CHALLENGE_OPENED' | 'ANSWER_SUBMITTED' | 'SUBMISSION_ACCEPTED' | 'SUBMISSION_REJECTED' | 'WINDOW_FOCUS_LOST' | 'TAB_HIDDEN' | 'FULLSCREEN_EXIT' | 'HEARTBEAT_EXPIRED' | 'ATTEMPT_TERMINATED'
  difficultyLevel: text('difficulty_level'),
  challengeId: integer('challenge_id'),
  details: text('details').notNull(),
  severity: text('severity').notNull().default('info'), // 'info' | 'warning' | 'violation' | 'critical'
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

export const securityViolations = pgTable('security_violations', {
  id: serial('id').primaryKey(),
  attemptId: integer('attempt_id').notNull().references(() => quizAttempts.id),
  userId: integer('user_id').notNull().references(() => users.id),
  roundId: integer('round_id').notNull().references(() => rounds.id),
  violationType: text('violation_type').notNull(),
  details: text('details').notNull(),
  serverTimestamp: timestamp('server_timestamp').defaultNow().notNull(),
});

export const disqualificationReviews = pgTable('disqualification_reviews', {
  id: serial('id').primaryKey(),
  attemptId: integer('attempt_id').notNull().references(() => quizAttempts.id),
  userId: integer('user_id').notNull().references(() => users.id),
  appealReason: text('appeal_reason').notNull(),
  status: text('status').notNull().default('pending'), // 'pending' | 'approved' | 'rejected'
  reviewerNotes: text('reviewer_notes'),
  reviewedBy: text('reviewed_by'),
  reviewedAt: timestamp('reviewed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const competitionSettings = pgTable('competition_settings', {
  id: serial('id').primaryKey(),
  competitionStatus: text('competition_status').notNull().default('active'), // 'draft' | 'active' | 'paused' | 'ended'
  registrationOpen: boolean('registration_open').notNull().default(true),
  fullscreenEnforcement: boolean('fullscreen_enforcement').notNull().default(true),
  strictFocusEnforcement: boolean('strict_focus_enforcement').notNull().default(true),
  heartbeatIntervalSec: integer('heartbeat_interval_sec').notNull().default(10),
  heartbeatStaleThresholdSec: integer('heartbeat_stale_threshold_sec').notNull().default(30),
  leaderboardFrozen: boolean('leaderboard_frozen').notNull().default(false),
  publishedFinal: boolean('published_final').notNull().default(false),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id'),
  action: text('action').notNull(),
  targetType: text('target_type').notNull(),
  targetId: text('target_id').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many, one }) => ({
  attempts: many(quizAttempts),
  violations: many(securityViolations),
  appeals: many(disqualificationReviews),
  session: one(participantSessions, {
    fields: [users.id],
    references: [participantSessions.userId],
  }),
  activities: many(activityEvents),
}));

export const roundsRelations = relations(rounds, ({ many }) => ({
  questions: many(questions),
  attempts: many(quizAttempts),
}));

export const questionsRelations = relations(questions, ({ one }) => ({
  round: one(rounds, {
    fields: [questions.roundId],
    references: [rounds.id],
  }),
}));

export const quizAttemptsRelations = relations(quizAttempts, ({ one, many }) => ({
  user: one(users, {
    fields: [quizAttempts.userId],
    references: [users.id],
  }),
  round: one(rounds, {
    fields: [quizAttempts.roundId],
    references: [rounds.id],
  }),
  answers: many(participantAnswers),
  violations: many(securityViolations),
}));

export const participantAnswersRelations = relations(participantAnswers, ({ one }) => ({
  attempt: one(quizAttempts, {
    fields: [participantAnswers.attemptId],
    references: [quizAttempts.id],
  }),
  question: one(questions, {
    fields: [participantAnswers.questionId],
    references: [questions.id],
  }),
}));

export const participantSessionsRelations = relations(participantSessions, ({ one }) => ({
  user: one(users, {
    fields: [participantSessions.userId],
    references: [users.id],
  }),
}));

export const activityEventsRelations = relations(activityEvents, ({ one }) => ({
  user: one(users, {
    fields: [activityEvents.userId],
    references: [users.id],
  }),
}));

export const securityViolationsRelations = relations(securityViolations, ({ one }) => ({
  attempt: one(quizAttempts, {
    fields: [securityViolations.attemptId],
    references: [quizAttempts.id],
  }),
  user: one(users, {
    fields: [securityViolations.userId],
    references: [users.id],
  }),
  round: one(rounds, {
    fields: [securityViolations.roundId],
    references: [rounds.id],
  }),
}));

export const disqualificationReviewsRelations = relations(disqualificationReviews, ({ one }) => ({
  attempt: one(quizAttempts, {
    fields: [disqualificationReviews.attemptId],
    references: [quizAttempts.id],
  }),
  user: one(users, {
    fields: [disqualificationReviews.userId],
    references: [users.id],
  }),
}));
