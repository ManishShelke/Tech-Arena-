# TECH ARENA 2026 — Full-Stack Audit, Security Hardening & Refactoring Plan

## 1. Executive Audit Summary & Root-Cause Findings

A deep inspection of the codebase revealed several critical security vulnerabilities, data-layer bugs, and API inconsistencies that impact tournament integrity and stability:

1. **Admin Session Bypass Vulnerability (`src/middleware/auth.ts`, `src/routes/admin.ts`)**:
   - `requireAuth` accepts any Bearer token prefixed with `ta_admin_` even when no matching session exists in `adminSessions` (`if (session)` only checks expiration when a row is found and falls through to grant root admin privileges when `session` is `null`).
   - CSV export (`/api/admin/export/:type`) only checks `token.startsWith('ta_admin_')` without verifying active session state or expiration.
2. **Predictable Participant Tokens / IDOR (`server.ts`, `src/middleware/auth.ts`)**:
   - Participant tokens are generated as `ta_team_${user.code}` (e.g., `ta_team_#TA-1042`), allowing any participant to forge tokens for other teams by guessing team codes.
3. **In-Memory Database Engine Bugs (`src/db/index.ts`)**:
   - `extractFieldAndVal` omits mappings for `is_active` (`isActive`), `is_removed` (`isRemoved`), `is_qualified` (`isQualified`), and `is_disqualified` (`isDisqualified`), causing queries filtering on those columns to ignore the filter and return or mutate unintended rows.
   - `findMany` and `findFirst` ignore `orderBy` directives, so queries requesting `[desc(quizAttempts.id)]` return the oldest attempt first instead of the most recent attempt—breaking retakes and active attempt resolution.
   - Raw `sql` filter expressions used in `src/routes/admin.ts` (`status IN ('in_progress', 'suspended_tab_switch')`) are ignored by the in-memory condition parser, causing bulk/targeted updates to affect completed attempts.
4. **Duplicate & Conflicting API Routes (`server.ts` vs `src/routes/admin.ts`)**:
   - `server.ts` defines duplicate handlers for `/api/auth/admin-login`, `/api/admin/overview`, `/api/admin/participants`, `/api/admin/participants/:id/pardon`, `/api/admin/participants/:id/disqualify`, `/api/admin/leaderboard`, and `/api/admin/reset-tournament` that conflict with `adminRouter`.
5. **Curriculum & Manual Score Correction Bugs (`src/routes/admin.ts`)**:
   - `POST /api/admin/questions` and `PUT /api/admin/questions/:id` strictly require 4 MCQ options (`options.length === 4`), preventing admins from creating or editing Round 2 (Short-Answer Q&A) and Round 3 (Coding Challenge) questions.
   - `POST /api/admin/submissions/:id/score-correction` sums raw `pointsEarned` without scaling to the round's `maxScore` (8 / 20 / 30) or updating `isQualified`.
6. **Frontend Telemetry & Session Expiry Handling (`src/App.tsx`, `src/components/AdminPanel.tsx`)**:
   - The client heartbeat sends `{ difficulty }` while `/api/participants/heartbeat` expects `{ currentDifficulty }`.
   - Expired or revoked admin/participant tokens (`401 Unauthorized`) do not cleanly clear stale local storage sessions and redirect to login.

---

## 2. Planned Changes

### Phase 1: Cryptographic Authentication & Session Hardening
- **Token Signing & Verification (`src/utils/cryptoAuth.ts`)**:
  - Implement scrypt-based password hashing and timing-safe verification (`crypto.scryptSync` + `crypto.timingSafeEqual`) for the three authorized administrator passkeys (`tech@kle`, `vybe2k26`, `Matrix2026`) plus `process.env.ADMIN_MASTER_PASSKEY`.
  - Sign participant tokens (`ta_team_<code_or_id>.<hmac>`) and admin session tokens (`ta_admin_<random_hex>.<hmac>`) using HMAC-SHA256.
- **Strict Auth Middleware (`src/middleware/auth.ts`)**:
  - Require every `ta_admin_*` token to match a non-expired, non-revoked session in `adminSessions` and pass HMAC verification.
  - Verify HMAC signatures on participant tokens (with seamless re-issue on login/register) and validate that the participant account is neither blocked (`isBlocked`) nor removed (`isRemoved`).
  - Consolidate `/api/auth/admin-login` into a single hardened endpoint in `src/routes/admin.ts` with rate-limiting and audit logging.

### Phase 2: Database Layer & Query Engine Reliability (`src/db/index.ts`)
- **Complete Column Mapping & Operators**:
  - Add full snake_case-to-camelCase field resolution (`is_active` → `isActive`, `is_removed` → `isRemoved`, `is_qualified` → `isQualified`, `is_disqualified` → `isDisqualified`, `round_number` → `roundNumber`, `attempt_id` → `attemptId`, `question_id` → `questionId`, etc.) and support `inArray` / multi-status matching so in-memory queries behave identically to PostgreSQL.
- **Sorting & Projection Support**:
  - Implement `orderBy` evaluation (`asc` / `desc` descriptors and callback syntax) in `findMany` and `findFirst` so latest attempts, activity feeds, and audit logs sort deterministically.

### Phase 3: Backend Route Consolidation & Curriculum Accuracy (`server.ts`, `src/routes/admin.ts`, `src/routes/rounds.ts`)
- **Deduplicate Server Routes**:
  - Remove shadowed duplicate `/api/admin/*` and `/api/auth/admin-login` handlers from `server.ts` so `src/routes/admin.ts` is the single source of truth for all administrative operations.
  - Replace raw `sql` status `IN` clauses in `src/routes/admin.ts` with portable Drizzle conditions (`or(eq(...), eq(...))`) that work identically across PostgreSQL and the in-memory adapter.
- **Multi-Round Question Management & Score Recalculation**:
  - Update `POST /api/admin/questions` and `PUT /api/admin/questions/:id` to support Round 1 (`mcq`), Round 2 (`qa` with `expectedAnswer`), and Round 3 (`coding` with `starterCode` and `testCases`).
  - Fix `POST /api/admin/submissions/:id/score-correction` to compute normalized round scores against `round.maxScore` and update `isQualified` based on `round.qualifyingPercentage`.
  - Secure `/api/admin/export/:type` using strict `adminSessions` validation.

### Phase 4: Frontend Synchronization & Error Resilience (`src/App.tsx`, `src/components/AdminPanel.tsx`, `src/components/AuthModal.tsx`)
- **Heartbeat & Anti-Cheat Sync**:
  - Align heartbeat payload in `src/App.tsx` to send `{ currentDifficulty }` and preserve immediate tab-switch suspension during active rounds (`in_progress` → `suspended_tab_switch`) pending proctor approval.
- **Automatic Session Expiry Handling**:
  - Add 401 response handling in `src/App.tsx` and `src/components/AdminPanel.tsx` to clear expired tokens and transition cleanly to the login view.
  - Ensure `AuthModal.tsx` and `AdminLogin.tsx` send standardized login payloads and surface clear validation messages.

---

## 3. Verification Plan
1. Run `lint_applet` and `compile_applet` to verify zero TypeScript or build errors.
2. Verify all authentication flows (participant registration/login, HMAC token verification, admin login with `tech@kle` / `vybe2k26` / `Matrix2026`, and rejection of forged `ta_admin_*` tokens).
3. Verify Round 1 → Round 2 → Round 3 progression, immediate tab-switch suspension, proctor pardon/resume, and CSV export endpoints.
