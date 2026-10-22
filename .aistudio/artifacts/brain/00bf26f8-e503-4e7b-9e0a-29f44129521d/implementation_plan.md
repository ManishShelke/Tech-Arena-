# Tech Arena: Unified Retro-Modern Design System Implementation

A comprehensive implementation plan to unify the public landing experience, participant portal, live competition arena, and public leaderboard under the Colonial White (`#FFF0BA`) and Waterloo Green (`#111808`) design system established in the Admin Console.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The following key design preferences have been confirmed and will guide the execution:
> - **Live Arena & Code Environment**: High-focus dark terminal mode with deep Waterloo black-green surface (`#0A0F05` / `#111808`), sharp borders, and warm Colonial White (`#FFF0BA`) accents and monospace code typography.
> - **Landing Page & Selection Flow**: Editorial retro-grid aesthetic with bold typographic hierarchy, structured geometric panels, zero pill-badge clutter, and unboxed metadata.

---

### 1. Overview & Core Concept

- **What It Delivers**: Transforms the participant-facing Tech Arena views—including the landing hero, team registration modal, student authentication, round selection, live competition coding arena, anti-cheat proctoring indicators, and public leaderboard—into a unified, retro-modern, high-contrast tournament environment.
- **Target Audience**: Collegiate developers, tournament contestants, team leads, and public spectators viewing real-time tournament standings.
- **Key Value**: Provides a cohesive, tournament-grade user experience that matches the precision and aesthetic quality of the administrative dashboard while maintaining zero-latency responsiveness and robust anti-cheat protections.

---

### 2. User Experience & Visual Design

#### A. Key User Flows
1. **Landing & Team Verification**:
   - Participants land on an editorial hero section featuring clean typography, live tournament metadata, and round specifications.
   - Team registration / login modal with structured geometric input fields, monospace labels, and high-contrast Colonial White action triggers.
2. **Participant Arena Dashboard**:
   - Overview card showing active registration status, college affiliation, round qualification, and anti-cheat guidelines.
   - Tiered round selection (Easy / Intermediate / Hard) with clear time limits, point ceilings, and question counts presented in structured grid panels.
3. **Live Competition Arena (QuizInterface)**:
   - Deep dark terminal environment (`#0B1006` / `#111808`) with a high-contrast top bar displaying countdown clock in tabular monospace numerals (`JetBrains Mono`).
   - Anti-cheat proctor status bar with subtle border transitions (warning on tab switches, remote attempt termination if flagged).
   - Question navigator with geometric status indicators (Answered, Flagged, Unvisited).
   - Code execution / answer input area with monospaced editor, clear submit/next controls, and instant local state autosaving.
4. **Public Leaderboard**:
   - High-contrast podium displaying top 3 teams with gold, silver, and bronze geometric accents.
   - Clean tabular rankings with college filtering, search query input, and instant freeze status notification banner.

#### B. Visual Identity & Design System Tokens
- **Dominant Canvas**: Neutral off-white (`#FBFBF7`) for dashboards and landing page; Deep Forest Dark (`#0B1006`) for the active code terminal.
- **Structural Surfaces**: Waterloo Green (`#111808`), soft bone borders (`#E5E0D8` on light, `#1F2B14` on dark).
- **Accent Budget**: Colonial White (`#FFF0BA`) reserved strictly for primary buttons, active state chips, and score highlights.
- **Typography**:
  - Display / Headers: High-contrast neo-grotesque display headers (`Space Grotesk` / `Plus Jakarta Sans`).
  - Data / Telemetry: `JetBrains Mono` with `font-variant-numeric: tabular-nums` for timers, question numbers, scores, and code blocks.
  - Body: Crisp legible sans (`Plus Jakarta Sans`).
- **Anti-Slop Discipline**:
  - No colored pill badges or capsule chips; all metadata rendered as clean unboxed text separated by `·` or `/`.
  - No fake compiler comment headers (`// 01_CORE`).
  - No generic purple gradients or pulsing decorative dots.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Dark Mode vs. Light Mode in Live Arena**
  - *Chosen Approach*: The main dashboard, registration, and leaderboard share the light Colonial White + Waterloo Green editorial look; the live coding arena switches to a deep Waterloo dark terminal mode (`#0B1006`).
  - *Why*: Reduces contestant eye fatigue during intense 30–60 minute algorithmic coding rounds and maximizes code syntax contrast.
  - *Alternatives Considered*: Keeping pure light mode across all views (rejected due to glaring brightness in code editor).

- **Decision 2: Anti-Cheat Proctoring UX**
  - *Chosen Approach*: Unobtrusive inline status strip with sharp geometric warning dialogs when focus is lost or warnings are logged.
  - *Why*: Maintains high tournament integrity without obstructing the code editing workspace.

---

### 4. Technical Architecture & Component Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                      Tech Arena (App.tsx)                   │
│   - Retro Grid Background (.admin-grid-bg)                  │
│   - Top Navigation (Brand Wordmark · Links · Auth Action)   │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
     ┌─────────┴─────────┐          ┌─────────┴─────────┐
     │  Participant View │          │   Public Views    │
     └─────────┬─────────┘          └─────────┬─────────┘
               │                              │
   ┌───────────┴───────────┐         ┌────────┴────────┐
   │ ParticipantDashboard  │         │   Leaderboard   │
   │ - Roster Card         │         │ - Podium (1,2,3)│
   │ - Round Selection     │         │ - Ranked Table  │
   │ - Rules & Status      │         │ - Search/Filter │
   └───────────┬───────────┘         └─────────────────┘
               │
   ┌───────────┴───────────┐
   │    QuizInterface      │
   │ (Dark Terminal Theme) │
   │ - Header Timer (Mono) │
   │ - Question Navigator  │
   │ - Code Editor/Answer  │
   │ - Autosave & Submit   │
   └───────────────────────┘
```

#### Component & State Mapping:
- **`App.tsx`**: Unified navigation header, landing hero, registration & login modals with Colonial White inputs and high-contrast buttons.
- **`ParticipantDashboard.tsx`**: Round selection cards with geometric badges, active countdown, and difficulty tiers.
- **`QuizInterface.tsx`**: Live coding terminal theme with dark green chassis (`#0B1006`), Colonial White accents, tabular timer, and anti-cheat tracking.
- **`Leaderboard.tsx`**: Clean table layout, podium cards, search bar, and freeze state banner.
- **`index.css`**: Global design tokens and utilities for background patterns and monospace alignments.
