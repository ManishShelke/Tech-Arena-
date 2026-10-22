# TECH ARENA — Three-Round Technical Competition Architecture & Implementation Plan

Comprehensive implementation specification for the Tech Arena three-round technical competition system, incorporating the complete 28-question curriculum, sequential qualification gates, individual server-authoritative countdown timers, per-attempt randomized question/option shuffling, and administrative tournament oversight.

***

## User Review & Critical Decisions

> [!IMPORTANT]
> The following operational choices were confirmed via user clarification and will govern the competition engine:

- **Confirmed Decision 1 (Result Disclosure)**: Scores and qualification status (Pass/Fail) are revealed immediately upon round submission. Detailed question-by-question explanations and answer keys remain concealed during the live competition and are revealed only when the tournament concludes or when explicitly authorized by an administrator.
- **Confirmed Decision 2 (Anti-Cheating Randomization)**: Question order and option display sequences (A, B, C, D) are shuffled uniquely for each participant attempt while strictly maintaining authoritative server-side option mapping so that grading remains 100% accurate.
- **Confirmed Decision 3 (Qualification Gating)**: Round 1 is unlocked by default for all registered participants. Round 2 unlocks strictly when a participant scores $\ge 60\%$ in Round 1 (5/8 marks). Round 3 unlocks strictly when qualifying in Round 2 ($\ge 12/20$ marks). Administrators can customize qualifying thresholds and manually override locks or authorize retakes.

***

## 1. Overview & Core Concept

Tech Arena is an elite, proctored inter-collegiate competitive examination platform engineered for Class 11–12, BCA, and Engineering students. The platform challenges students across three escalating tiers:

1. **Round 1 — EASY (Rapid Qualifier)**: 8 questions, 10-minute countdown, 1 mark each (8 total marks). Focuses on computer fundamentals, Python basics, binary arithmetic, HTML document structure, and basic SQL.
2. **Round 2 — MEDIUM (Algorithmic Engineering & Bug Hunt)**: 10 questions, 20-minute countdown, 2 marks each (20 total marks). Focuses on nested loop execution, string slicing, stack LIFO behavior, $O(\log n)$ binary search, SQL filtering, OOP method overriding, Round Robin scheduling, TCP, and Boolean logic.
3. **Round 3 — VERY DIFFICULT (Live Arena Clash)**: 10 questions, 30-minute countdown, 3 marks each (30 total marks). Focuses on complex loop accumulation, factorial recursion, loop doubling complexity, stack traces, SQL `GROUP BY ... HAVING`, Dijkstra's shortest path, bitwise operations (`13 & 10`), Python default mutable argument gotchas, Coffman deadlock conditions, and two-pointer array optimization.

Total competition marks: **58 marks across 28 questions**.

***

## 2. User Experience & Visual Design

Following the established **Tech Arena** design constitution:
- **Canvas & Palette**: 60% neutral canvas (`#FAFAF7` background in light mode, `#0B1006` in terminal mode), 30% structural surfaces with hairline borders (`#E5E0D8` and `#1F2B14`), 10% high-intent focal accents (Colonial Gold `#FFF0BA` and Forest Black `#111808`).
- **Typography & Formatting**: Headings set in Space Grotesk/Plus Jakarta Sans with balanced wrapping (`text-wrap: balance`), monospace numbers (`font-mono tabular-nums`), and zero static pill enclosure clutter.
- **Progressive Disclosure Flow**:
  - **Hub View**: 3 round cards displaying qualification badge, lock status, duration, strike limits, and previous scores.
  - **Runner View**: Full-screen assessment container with round badge, persistent countdown timer, question palette drawer with answered/unanswered/marked status counters, clear multiple-choice radio cards with keyboard navigation (1-4 or A-D), "Mark for Review" toggle, and a submission modal with unanswered questions warning.
  - **Result View**: Clean scorecard presenting earned points, qualification verdict (e.g. `Qualified for Round 2: 7 / 8 Marks (87.5%)`), and next step directions.

***

## 3. Key Product Decisions & Trade-Offs

- **Server-Authoritative Evaluation**:
  - *Chosen Approach*: Questions sent to participants strip `correctOption` and `explanation`. Options and questions are shuffled per attempt using a deterministic or stored per-attempt permutation array on the server.
  - *Why*: Completely blocks browser inspection tools (`F12`, network tab, DOM scrapers) from extracting answer keys.
- **Deterministic Server Timers**:
  - *Chosen Approach*: `serverDeadline = startTime + durationMinutes`. When a participant refreshes or reconnects, `remainingSeconds = max(0, serverDeadline - now)`. If suspended via tab switch, time is frozen at `pausedAt` and adjusted forward on admin approval.
  - *Why*: Client clock manipulation, tab reloading, or disabling local JavaScript cannot grant extra time.
- **Qualification Enforcing Middleware**:
  - *Chosen Approach*: `POST /api/attempts/start` validates eligibility on the server: Round 2 requires Round 1 score $\ge$ Round 1 threshold (default 60%); Round 3 requires Round 2 qualification. Direct API tampering returns `403 Forbidden`.

***

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        TECH ARENA CLIENT                               │
│  ┌───────────────────────┐  ┌─────────────────┐  ┌──────────────────┐  │
│  │ QualifierTerminal.tsx │  │  AdminPanel.tsx │  │  Leaderboard.tsx │  │
│  │ (Question Runner,     │  │ (Question CRUD, │  │ (Live Standings, │  │
│  │  Palette, Timer Bar)  │  │  Overrides, CSV)│  │  Scores)         │  │
│  └───────────┬───────────┘  └────────┬────────┘  └─────────┬────────┘  │
└──────────────┼───────────────────────┼─────────────────────┼───────────┘
               │ JSON / Bearer JWT     │ Admin Token         │ Public
               ▼                       ▼                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        EXPRESS SERVER (PORT 3000)                      │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Routes: /api/rounds, /api/attempts/start, /api/attempts/:id/sync │  │
│  │         /api/attempts/:id/answer, /api/attempts/:id/submit       │  │
│  │ Admin:  /api/admin/rounds, /api/admin/questions (CRUD)          │  │
│  │         /api/admin/participants/:id/unlock, /api/admin/retake    │  │
│  └──────────────────────────────────┬───────────────────────────────┘  │
└─────────────────────────────────────┼──────────────────────────────────┘
                                      ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        PERSISTENT DATA STORE                           │
│  ┌──────────────┐  ┌─────────────────┐  ┌───────────────────────────┐  │
│  │ rounds       │  │ questions       │  │ quiz_attempts             │  │
│  │ (id, num,    │  │ (id, roundId,   │  │ (id, userId, roundId,     │  │
│  │  qualifyPct, │  │  code, prompt,  │  │  status, serverDeadline,  │  │
│  │  duration)   │  │  options, key,  │  │  score, shuffledOrder,    │  │
│  │              │  │  explanation)   │  │  violationsCount)         │  │
│  └──────────────┘  └─────────────────┘  └───────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

### Data Model Additions & Enhancements

1. **`rounds` Table**:
   - `qualifyingPercentage`: integer (default 60).
   - `durationMinutes`: 10 for R1, 20 for R2, 30 for R3.
   - `maxScore`: 8 for R1, 20 for R2, 30 for R3.
2. **`questions` Table**:
   - `code`: text (e.g. 'E1', 'M5', 'H10').
   - `explanation`: text (detailed rationale for review mode).
   - `points`: 1, 2, or 3 marks.
   - `options`: jsonb (array of 4 options).
   - `correctOption`: integer (0 to 3 index).
3. **`quiz_attempts` Table**:
   - `isQualified`: boolean.
   - `qualificationOverridden`: boolean (admin override flag).
   - `shuffledQuestions`: jsonb (stores the randomized question & option mapping for the attempt).
4. **Seed Database (`src/db/seed.ts`)**:
   - Seeds all 28 exact questions from Section 7 with statements, options, answer indices, and explanations.

### Implementation Milestones

1. **Schema & Seed Migration**:
   - Update `src/db/schema.ts` with `code`, `explanation`, `qualifyingPercentage`.
   - Implement `syncQuestionBank()` in `src/db/seed.ts` containing the verified 28-question dataset with answer keys.
2. **Authoritative Backend Logic (`server.ts` & `src/routes/admin.ts`)**:
   - Enforce sequential unlocking in `/api/attempts/start`.
   - Calculate qualification on submission in `/api/attempts/:id/submit`.
   - Support admin question editor, round duration/qualifying % config, retake approvals, and CSV export.
3. **Frontend Question Runner (`src/components/QualifierTerminal.tsx`)**:
   - Add question palette navigation grid (1..N) with status markers (Answered, Current, Marked for Review).
   - Add confirmation modal showing total answered / unanswered count before final submission.
   - Add post-submission qualification banner with direct action to proceed to the next round if qualified.
4. **Admin Dashboard Controls (`src/components/AdminPanel.tsx`)**:
   - Display questions manager with round switcher, question edit modal, answer key updates, and retake authorizations.
