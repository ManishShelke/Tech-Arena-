# Tech Arena — Streamlined Team Sign-Up & Interactive 3D Cyber-Core Scenes

This plan combines **removing the Team Code function during sign-up** with the integration of procedural **Three.js 3D Cyber-Core Mainframe & Qualification Monolith** scenes across the **Tech Arena** platform.

## User Review & Critical Decisions

> [!IMPORTANT]
> **Proctor Passkey Details & Confirmed Scope**:
> - **What is the Proctor Passkey?**: The Proctor Passkey is the administrator master credential used by tournament officials to unlock the **Directorate Admin Control Panel** (for live proctoring, managing the 28 competition questions, adjusting round timers/thresholds, unlocking rounds, authorizing retakes, and exporting CSV reports).
> - **Active Passkeys**: You can sign in as Administrator/Proctor using either **`tech@kle`** or **`vybe2k26`**.
> - **Team Code Removal**: The `Team Code` sign-in tab and manual `#TA-XXXX` code lookup will be removed from the authentication modal and navigation bar. Participants will simply use **Register Team** (which registers a new team or seamlessly reconnects an existing team by Team Name & College), alongside the **Proctor Passkey** tab for administrators.
> - **Confirmed 3D Integration**: Interactive **Hero 3D Stage** in the Competition Hub + dedicated **Full-Screen 3D Arena Explorer** tab featuring the **3-Tier Cyber-Core Mainframe & Qualification Monoliths**.

---

## 1. Overview & Core Concept

- **What It Does**:
  1. **Streamlined Participant Sign-Up (No Team Code Required)**: Removes the `Team Code` tab and manual code entry from the authentication flow. Entering a Team Name, College, and Members directly registers or signs the team into the terminal.
  2. **Interactive Hero 3D Stage**: Upgrades the Competition Hub hero banner with a live, interactive Three.js 3D viewport displaying the **Tech Arena Cyber-Core** and **Three Qualification Monoliths**, synchronized with the participant's live round status.
  3. **Full-Screen 3D Arena Explorer (`100vw × 100vh`)**: Adds a dedicated spatial exploration mode where participants and spectators can orbit, inspect, explode, and customize the 3D Cyber-Core Mainframe, switch camera presets, and launch unlocked competition rounds directly from the 3D scene.
- **Target Audience / Persona**: Class 11–12 students, BCA students, engineering competitors, and tournament proctors.
- **Key Value**: Eliminates sign-up friction by removing manual team codes while transforming the technical competition into a tactile 3D spatial experience matching the **Green Waterloo (`#111808`)**, **Warm Ivory (`#FAFAF7`)**, and **Colonial Yellow (`#FFF0BA`)** identity.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  - **Frictionless Team Sign-Up**: Clicking **Connect / Register Team** opens the streamlined 2-tab modal (**Register Team** and **Proctor Passkey**). Submitting the team form immediately authenticates the participant without needing to copy or enter a `#TA-XXXX` code.
  - **Competition Hub Hero Stage**: Upon opening the Competition Arena, users see the 3D Cyber-Core Mainframe orbiting in the hero showcase. Clicking any of the 3 Qualification Monoliths highlights its difficulty tier, question count, duration, and 60% qualification rule.
  - **3D Arena Explorer Tab & Collapsible Bottom Dock**: Clicking **3D Arena** in the top navigation bar opens a full-viewport (`100vw × 100vh`) interactive 3D observatory with a collapsible bottom-center HUD dock (`≤ 15%` viewport footprint, `H` shortcut to hide/show controls).
- **Visual Identity & Theme**:
  - **Color Palette & Surface Realism**:
    - *Deep Obsidian / Green Waterloo (`#111808`)*: Anodized chassis plates, monolith cores, and studio horizon fog.
    - *Colonial Gold (`#FFF0BA` & `#D4AF37`)*: Brushed metallic conductor rings, active round buses, and warm specular highlights.
    - *Emerald & Amber Status Accents (`#10B981` / `#F59E0B`)*: Emissive circuit conduits indicating Qualified vs. Locked round states.
  - **Studio PBR Lighting**: `ACESFilmicToneMapping` + procedural `RoomEnvironment` via `PMREMGenerator`, paired with a 3-point warm/cool studio lighting rig and 100% procedural `CanvasTexture` circuit patterns.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Direct Team Registration & Reconnection Without Team Codes**
  - *Chosen Approach*: Remove the `Team Code` tab from `AuthModal` and `Navbar`. Enhance `/api/auth/register-team` so that if a team with the same Team Name and College already exists, it seamlessly reconnects their session; otherwise it creates a new team record automatically.
  - *Why*: Eliminates the need for participants to memorize or type `#TA-XXXX` terminal codes while preserving persistent round progress.
- **Decision 2: Composite 3–12 Part Procedural 3D Models (`THREE.Group`)**
  - *Chosen Approach*: Construct the central Cyber-Core Mainframe and each of the 3 Qualification Monoliths as hierarchical `THREE.Group` assemblies of 8–12 distinct geometric parts (extruded octagonal chassis with bevels, lathe-turned cooling fins, toroidal data rings, glass containment sleeves, and tube-routed fiber conduits).
  - *Why*: Delivers authentic industrial hardware that rewards close-up camera inspection and exploded-view separation at a locked 60fps.

---

## 4. Technical Architecture & Data Strategy

### Architecture & Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        TECH ARENA APPLICATION SHELL                         │
│   [ Top Navigation: Qualifier · 3D Arena · Standings · Register / Proctor ] │
└───────────┬───────────────────────────────┬─────────────────────────┬───────┘
            │                               │                         │
            ▼                               ▼                         ▼
┌───────────────────────┐ ┌─────────────────────────────────┐ ┌───────────────┐
│ STREAMLINED AUTH MODAL│ │  COMPETITION TERMINAL HUB VIEW  │ │ FULL-SCREEN   │
│ ┌───────────────────┐ │ │ ┌─────────────────────────────┐ │ │ 3D ARENA      │
│ │ 1. Register Team  │ │ │ │  Embedded 3D Hero Stage     │ │ │ EXPLORER      │
│ │ (No Team Code Tab)│ │ │ │ (Interactive Orbit + Status)│ │ │ (100vw×100vh) │
│ └─────────┬─────────┘ │ │ └──────────────┬──────────────┘ │ └───────┬───────┘
│ ┌─────────▼─────────┐ │ │ ┌──────────────▼──────────────┐ │ ┌───────▼───────┐
│ │ 2. Proctor Passkey│ │ │ │ 3-Round Progression Grid &  │ │ │ Collapsible   │
│ │ (tech@kle/vybe2k26│ │ │ │  Proctored Assessment Node  │ │ │ Bottom Dock   │
│ └───────────────────┘ │ │ └─────────────────────────────┘ │ └───────────────┘
└───────────────────────┘ └─────────────────┬───────────────┘         │
                                            └────────────┬────────────┘
                                                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   PROCEDURAL THREE.JS SCENE ENGINE                          │
│  ┌─────────────────────────┐  ┌─────────────────────────┐  ┌─────────────┐  │
│  │ Cyber-Core Mainframe    │  │ 3 Qualification         │  │ Instanced   │  │
│  │ (10-Part Composite      │  │ Monoliths (R1, R2, R3   │  │ Data Nodes  │  │
│  │  Extrude + Lathe + Tube)│  │  with Live Score State) │  │ & Grid Deck │  │
│  └─────────────────────────┘  └─────────────────────────┘  └─────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Interactive Component & State Mapping

- **Streamlined Authentication Flow**: Opening the Auth Modal presents two clean options: **Register Team** (Team Name, College, Team Members, Zone) and **Proctor Passkey** (`tech@kle` or `vybe2k26`).
- **Camera Preset Choreography**: Selecting a camera preset (`Overview`, `Round 1: Easy`, `Round 2: Medium`, `Round 3: Very Difficult`, `Core Reactor`) smoothly interpolates `camera.position` and `OrbitControls.target` via `THREE.MathUtils.damp`.
- **Mechanical Exploded-View Slider (`0%` – `100%`)**: Separates the upper containment dome, toroidal bus rings, cooling fins, and monolith armor plates along their local normal vectors.
- **Material Finish Switcher & Direct Round Launch**: Toggles between **Anodized Waterloo & Gold**, **Brushed Titanium & Cyan**, and **Stealth Carbon & Emerald**, and allows clicking any Qualification Monolith to inspect its specs or launch an unlocked round.
