# ImpactLink — Volunteer Dashboard: Implementation Plan

**Version:** 2.0 | **Status:** Approved for AI Execution  
**Scope:** Full-stack volunteer portal — backend models, API, auth, frontend dashboard, offline support  
**Depends on:** Existing Firebase auth, MongoDB Atlas, Express server, React SPA, Google Maps API, Gemini integration

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Data Models (MongoDB)](#2-data-models)
3. [Backend — API Routes](#3-backend-api-routes)
4. [Auth & Role System](#4-auth--role-system)
5. [Frontend — File Structure](#5-frontend-file-structure)
6. [Phase Execution Order](#6-phase-execution-order)
7. [Phase 1 — Backend Models & Auth](#phase-1-backend-models--auth)
8. [Phase 2 — Auth Context & Role Routing](#phase-2-auth-context--role-routing)
9. [Phase 3 — Landing Page Updates](#phase-3-landing-page-updates)
10. [Phase 4 — Volunteer API Service](#phase-4-volunteer-api-service)
11. [Phase 5 — Volunteer Dashboard Shell](#phase-5-volunteer-dashboard-shell)
12. [Phase 6 — Dashboard Tabs (Feature Components)](#phase-6-dashboard-tabs)
13. [Phase 7 — Offline & PWA Support](#phase-7-offline--pwa-support)
14. [Phase 8 — Design Tokens & Styling](#phase-8-design-tokens--styling)
15. [Verification Checklist](#verification-checklist)
16. [Critical Constraints & Pitfalls](#critical-constraints--pitfalls)

---

## 1. Architecture Overview

```
Firebase Auth (uid)
      │
      ▼
POST /api/users/setup          ← first-time role selection
GET  /api/users/me             ← fetch User doc (role, linkedVolunteerId)
      │
      ├── role: Administrator  →  /dashboard         (existing command center)
      │
      └── role: Volunteer      →  /volunteer
                                       │
                              VolunteerDashboard.jsx
                                       │
                    ┌──────────────────┼───────────────────┐
                 Home tab        Assignment tab       Schedule tab
                    │                 │                    │
            GET /volunteer/me  GET /volunteer/me    PATCH /volunteer/me
                              GET /assignment/:id   (availability update)
                              GET /missions/:missionId
```

**Key design decisions:**

- The volunteer is **always** a linked entity — `User.linkedVolunteerId` ties the Firebase user to the existing `Volunteer` (Responder) document in MongoDB. Do not create a parallel user record; enrich the existing one.
- The dashboard is **mobile-first and field-hardened** — large touch targets (min 48px), high-contrast text, works at 320px width, graceful offline degradation.
- All sensitive writes go through the Express backend, never directly to MongoDB from the client.
- The Gemini layer is admin-only. The volunteer view consumes pre-processed mission data only.

---

## 2. Data Models

### 2.1 `User` model — NEW file: `backend/models/User.js`

```javascript
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true, index: true },
  email: { type: String, required: true },
  displayName: { type: String },
  role: {
    type: String,
    enum: ['Volunteer', 'Administrator'],
    default: null   // null = not yet selected (triggers onboarding modal)
  },
  linkedVolunteerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Volunteer',   // or 'Responder' — match whatever the existing model is named
    default: null
  },
  onboardingComplete: { type: Boolean, default: false },
  lastActiveAt: { type: Date },
  fcmToken: { type: String, default: null },   // for push notifications (Phase 7)
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
```

### 2.2 `Volunteer` (Responder) model — PATCH existing model

Add these fields to the existing Volunteer/Responder schema. Do not replace it — merge these in:

```javascript
// ADD to existing Volunteer/Responder schema:
{
  // Availability (replaces any mock availability field)
  availability: {
    monday:    { morning: Boolean, afternoon: Boolean, night: Boolean },
    tuesday:   { morning: Boolean, afternoon: Boolean, night: Boolean },
    wednesday: { morning: Boolean, afternoon: Boolean, night: Boolean },
    thursday:  { morning: Boolean, afternoon: Boolean, night: Boolean },
    friday:    { morning: Boolean, afternoon: Boolean, night: Boolean },
    saturday:  { morning: Boolean, afternoon: Boolean, night: Boolean },
    sunday:    { morning: Boolean, afternoon: Boolean, night: Boolean },
  },

  // Skills taxonomy — use consistent enum
  skills: [{
    type: String,
    enum: [
      'first_aid', 'medical', 'search_rescue', 'logistics',
      'communication', 'translation', 'counseling', 'driving',
      'heavy_vehicle', 'water_rescue', 'shelter_setup', 'food_distribution'
    ]
  }],

  // Transport
  vehicleType: {
    type: String,
    enum: ['none', 'motorcycle', 'car', 'suv', 'van', 'truck', 'boat'],
    default: 'none'
  },
  vehicleCapacity: { type: Number, default: 0 },   // payload in kg
  travelRadiusKm: { type: Number, default: 20 },

  // Performance — written by admin/system only, read-only for volunteer
  completionRate: { type: Number, default: 0, min: 0, max: 100 },
  totalMissionsCompleted: { type: Number, default: 0 },
  performanceScore: { type: Number, default: 0 },
  lastRating: { type: Number, min: 1, max: 5, default: null },

  // Emergency contact
  emergencyContact: {
    name: String,
    phone: String,
    relation: String
  },

  // Current assignment — only one active at a time
  currentAssignmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ResourceAllocation',
    default: null
  },
  assignmentStatus: {
    type: String,
    enum: ['unassigned', 'pending_accept', 'accepted', 'en_route', 'on_site', 'completed'],
    default: 'unassigned'
  },
  assignmentAcceptedAt: { type: Date, default: null },
}
```

### 2.3 `MissionHistory` model — NEW file: `backend/models/MissionHistory.js`

```javascript
const MissionHistorySchema = new mongoose.Schema({
  volunteerId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Volunteer', required: true, index: true },
  missionId:     { type: mongoose.Schema.Types.ObjectId, ref: 'StrategicMission' },
  allocationId:  { type: mongoose.Schema.Types.ObjectId, ref: 'ResourceAllocation' },
  projectId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  missionName:   { type: String },
  resourceType:  { type: String },          // "Medical: First Aid Kits" etc.
  unitsCarried:  { type: Number },
  status:        { type: String, enum: ['completed', 'recalled', 'incomplete'] },
  startedAt:     { type: Date },
  completedAt:   { type: Date },
  durationMinutes: { type: Number },
  ratingGiven:   { type: Number, min: 1, max: 5 },   // volunteer rates the mission
  adminNotes:    { type: String },                    // admin-only field
}, { timestamps: true });
```

---

## 3. Backend API Routes

### 3.1 New route file: `backend/routes/volunteer.js`

All routes require `verifyFirebaseToken` middleware. Routes marked `[self-only]` additionally require the requesting user's `linkedVolunteerId` to match the target.

```
POST   /api/users/setup
       Body: { role: "Volunteer"|"Administrator", volunteerCode?: string }
       — Creates User doc, links volunteerCode to existing Volunteer if provided
       — Returns: { uid, role, linkedVolunteerId, onboardingComplete }

GET    /api/users/me
       — Returns full User doc with populated Volunteer ref
       — Used by AuthContext on every app load

PATCH  /api/users/me
       Body: { fcmToken?, displayName? }
       — Limited updates only; role cannot be self-changed after setup

GET    /api/volunteer/me                          [self-only]
       — Returns full Volunteer doc for the linked volunteer
       — Excludes adminNotes, performanceScore (admin-only fields)

PATCH  /api/volunteer/me                          [self-only]
       Body: Partial<Volunteer> — only whitelisted fields accepted
       Allowed: availability, skills, vehicleType, vehicleCapacity,
                travelRadiusKm, emergencyContact, phone, address
       Blocked: completionRate, performanceScore, currentAssignmentId,
                assignmentStatus (system-managed)

GET    /api/volunteer/me/assignment               [self-only]
       — Returns current assignment with populated mission + resource data
       — Returns { assignment: null } if unassigned

PATCH  /api/volunteer/me/assignment/accept        [self-only]
       — Sets assignmentStatus: "accepted", assignmentAcceptedAt: now
       — Only valid when status is "pending_accept"

PATCH  /api/volunteer/me/assignment/status        [self-only]
       Body: { status: "en_route"|"on_site"|"completed" }
       — Sequential only (cannot skip steps)
       — On "completed": creates MissionHistory record, clears currentAssignmentId

GET    /api/volunteer/me/history                  [self-only]
       Query: ?page=1&limit=20&projectId=xxx
       — Paginated mission history, newest first

GET    /api/volunteer/me/notifications            [self-only]
       — Returns unread notifications for this volunteer
       — Source: new assignment alerts, urgency escalations

PATCH  /api/volunteer/me/notifications/:id/read   [self-only]
       — Marks a notification as read
```

### 3.2 Middleware — `backend/middleware/checkRole.js` — NEW file

```javascript
const checkRole = (...allowedRoles) => async (req, res, next) => {
  try {
    const user = await User.findOne({ uid: req.user.uid });
    if (!user || !allowedRoles.includes(user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    req.impactUser = user;   // attach to request for downstream use
    next();
  } catch (err) {
    res.status(500).json({ error: 'Role check failed' });
  }
};

// Usage on admin routes: router.get('/missions', verifyFirebaseToken, checkRole('Administrator'), handler)
// Usage on volunteer routes: router.get('/volunteer/me', verifyFirebaseToken, checkRole('Volunteer', 'Administrator'), handler)
```

### 3.3 Volunteer Code System

When a volunteer self-registers, they need to link to an existing Volunteer document (created by admin). Use a short alphanumeric code:

- Admin creates Volunteer record → system generates `volunteerCode` (6-char: e.g., `HX72KP`)
- Volunteer enters code during onboarding → backend looks up Volunteer by code → links `User.linkedVolunteerId`
- Code is single-use — nulled after linking
- Add `volunteerCode: { type: String, unique: true, sparse: true }` to Volunteer schema

---

## 4. Auth & Role System

### 4.1 `AuthContext.jsx` — NEW file: `src/context/AuthContext.jsx`

```
State shape:
{
  firebaseUser: object | null,    // raw Firebase user
  appUser: {                       // from GET /api/users/me
    uid, email, displayName,
    role: "Volunteer"|"Administrator"|null,
    linkedVolunteerId: string | null,
    onboardingComplete: boolean
  } | null,
  loading: boolean,
  error: string | null
}

Behavior:
- On Firebase auth state change: if logged in, fetch /api/users/me
- If /api/users/me returns 404: user exists in Firebase but not MongoDB → trigger setup flow
- If appUser.role is null: show RoleSelectionModal (blocks navigation)
- If appUser.onboardingComplete is false AND role is Volunteer: show VolunteerOnboardingModal
- Expose: login(), logout(), refreshUser() functions
```

### 4.2 Role-based routing — update `App.jsx`

```
/                     → LandingPage (public)
/auth                 → AuthForm (public, query: ?intent=volunteer|admin)
/dashboard            → RequireRole("Administrator") → existing Dashboard
/volunteer            → RequireRole("Volunteer") → VolunteerDashboard
/volunteer/onboarding → RequireRole("Volunteer", onboardingComplete: false) → OnboardingFlow
/setup                → RequireAuth, role===null → RoleSelectionModal page
```

`RequireRole` component logic:
1. If `loading` → show spinner
2. If not authenticated → redirect to `/auth`
3. If authenticated but wrong role → redirect to their correct dashboard
4. If authenticated and correct role → render children

---

## 5. Frontend File Structure

```
src/
├── context/
│   └── AuthContext.jsx              NEW — global auth state
│
├── hooks/
│   ├── useAuth.js                   NEW — useContext(AuthContext) shorthand
│   ├── useVolunteer.js              NEW — fetches + caches volunteer profile
│   └── useAssignment.js            NEW — polls/subscribes to current assignment
│
├── services/
│   └── volunteerApi.js             NEW — all volunteer API calls
│
├── components/
│   ├── auth/
│   │   ├── RoleSelectionModal.jsx  NEW — first-login role picker
│   │   └── RequireRole.jsx         NEW — route guard with role check
│   │
│   └── volunteer/
│       ├── VolunteerHeader.jsx     NEW — top nav (name, avatar, logout)
│       ├── AssignmentCard.jsx      NEW — current assignment summary card
│       ├── AssignmentMap.jsx       NEW — Google Maps navigation to assignment
│       ├── ResourceChecklist.jsx   NEW — items volunteer is carrying
│       ├── AvailabilityGrid.jsx    NEW — 7×3 weekly schedule toggle
│       ├── ProfileForm.jsx         NEW — editable volunteer profile
│       ├── MissionHistoryList.jsx  NEW — paginated past missions
│       ├── NotificationList.jsx    NEW — assignment alerts
│       └── StatusStepper.jsx       NEW — en_route → on_site → completed flow
│
├── pages/
│   ├── VolunteerDashboard.jsx      NEW — shell with tab navigation
│   ├── VolunteerOnboarding.jsx     NEW — code entry + profile setup flow
│   └── [existing pages unchanged]
│
└── styles/
    ├── volunteer.css               NEW — volunteer-specific design tokens
    └── index.css                   MODIFY — add :root vars for both themes
```

---

## 6. Phase Execution Order

Each phase is independently mergeable. Later phases depend on earlier ones as noted.

```
Phase 1 → Backend models + auth middleware       (no frontend deps)
Phase 2 → AuthContext + RequireRole + routing    (depends on Phase 1)
Phase 3 → Landing page dual CTA                 (depends on Phase 2)
Phase 4 → volunteerApi.js service layer         (depends on Phase 1)
Phase 5 → VolunteerDashboard shell + tabs       (depends on Phase 2, 4)
Phase 6 → Feature components (6 tabs)           (depends on Phase 5)
Phase 7 → Offline / PWA                        (depends on Phase 6)
Phase 8 → Design polish                        (parallel with Phase 5+)
```

---

## Phase 1 — Backend Models & Auth

**Files to create:**
- `backend/models/User.js` — full schema from §2.1
- `backend/models/MissionHistory.js` — full schema from §2.3
- `backend/middleware/checkRole.js` — from §3.2
- `backend/routes/volunteer.js` — all routes from §3.1

**Files to modify:**
- Existing Volunteer/Responder model — merge fields from §2.2
- `backend/server.js` — register `require('./routes/volunteer')` under `/api`

**Implementation notes:**

The `POST /api/users/setup` route is the most critical. It must:
1. Accept `{ role, volunteerCode? }` in body
2. Create the User document with uid from Firebase token
3. If `volunteerCode` provided: find Volunteer where `volunteerCode === code`, set `linkedVolunteerId`, null out the code (single-use)
4. If no code: set `linkedVolunteerId: null` (admin can link later)
5. Return the full user object

The `PATCH /api/volunteer/me` route must use an explicit whitelist — never `Object.assign(volunteer, req.body)`. Enumerate every allowed field. Any unlisted field is silently ignored.

The `PATCH /api/volunteer/me/assignment/status` route must enforce sequential progression:
```
unassigned → pending_accept → accepted → en_route → on_site → completed
```
Reject any transition that skips a step. On `completed`, atomically:
1. Create `MissionHistory` record
2. Set `currentAssignmentId: null`, `assignmentStatus: "unassigned"`
3. Increment `totalMissionsCompleted`
4. Update `ResourceAllocation.status` to `"delivered"`
5. Decrement `Resource.available_units` by `units_dispatched` if not already done

---

## Phase 2 — Auth Context & Role Routing

**Files to create:**
- `src/context/AuthContext.jsx`
- `src/hooks/useAuth.js`
- `src/components/auth/RequireRole.jsx`
- `src/components/auth/RoleSelectionModal.jsx`

**Files to modify:**
- `src/App.jsx` — replace existing route protection with `RequireRole`

### `AuthContext.jsx` implementation spec

```jsx
// Initialization sequence (critical — get this order right):
// 1. onAuthStateChanged fires
// 2. If user: call GET /api/users/me with Firebase ID token in Authorization header
// 3. If 200: setAppUser(data) → navigate based on role
// 4. If 404: user exists in Firebase, not in DB → navigate to /setup
// 5. If user is null: setAppUser(null), setLoading(false)

// Token refresh: Firebase tokens expire after 1h
// Before every API call, use: await firebaseUser.getIdToken(/* forceRefresh */ false)
// This returns cached token if valid, refreshes silently if expired
// Wrap this in a helper: getAuthHeader() → { Authorization: `Bearer ${token}` }
```

### `RoleSelectionModal.jsx` implementation spec

- Renders as a full-screen blocking overlay (not a popup — cannot be dismissed)
- Two large cards: "Volunteer Portal" (warm orange) and "Command Center" (indigo)
- On Volunteer selected: show text input for Volunteer Code + "Skip for now" link
- On confirm: call `POST /api/users/setup`, then `refreshUser()`, then navigate
- Code input: uppercase transform, 6-char limit, show inline error if code not found

### `RequireRole.jsx` implementation spec

```jsx
// Props: role (string), children
// Renders loading spinner while AuthContext.loading === true
// If !firebaseUser: <Navigate to="/auth" state={{ from: location }} />
// If firebaseUser && !appUser: still loading — spinner
// If appUser.role === null: <Navigate to="/setup" />
// If appUser.role !== role: redirect to correct dashboard for their role
// Otherwise: render children
```

---

## Phase 3 — Landing Page Updates

**Files to modify:** `src/pages/LandingPage.jsx`

Add a dual-CTA section below the existing hero. Do not replace existing content.

```
Layout: Two side-by-side cards (stacked on mobile < 640px)

Card 1 — Volunteer Portal:
  Icon: shield/person SVG
  Title: "Volunteer Portal"
  Subtitle: "View your assignment, update availability, track your impact"
  Button: "Sign in as volunteer" → /auth?intent=volunteer
  Color: amber/orange accent (#F59E0B border, warm bg)

Card 2 — Command Center:
  Icon: chart/radar SVG  
  Title: "Command Center"
  Subtitle: "Manage missions, allocate resources, monitor field operations"
  Button: "Sign in as admin" → /auth?intent=admin
  Color: indigo accent (#6366F1 border, cool bg)
```

**Files to modify:** `src/pages/AuthForm.jsx`

Read `?intent` query param. Pre-select the corresponding role in `RoleSelectionModal` if it appears. Do not auto-skip the modal — let the user confirm. This prevents URL-based role spoofing.

---

## Phase 4 — Volunteer API Service

**File to create:** `src/services/volunteerApi.js`

This is a thin wrapper — all it does is call the backend and handle errors uniformly. No business logic here.

```javascript
// All functions are async and return { data, error }
// Never throw — always catch and return { data: null, error: message }

export const volunteerApi = {
  getProfile:           () => get('/api/volunteer/me'),
  updateProfile:        (fields) => patch('/api/volunteer/me', fields),

  getAssignment:        () => get('/api/volunteer/me/assignment'),
  acceptAssignment:     () => patch('/api/volunteer/me/assignment/accept'),
  updateStatus:         (status) => patch('/api/volunteer/me/assignment/status', { status }),

  getHistory:           (page = 1) => get(`/api/volunteer/me/history?page=${page}&limit=20`),

  getNotifications:     () => get('/api/volunteer/me/notifications'),
  markNotificationRead: (id) => patch(`/api/volunteer/me/notifications/${id}/read`),
};

// Internal helper — always attaches fresh Firebase token
async function get(path) { ... }
async function patch(path, body) { ... }
```

### `useAssignment.js` hook spec

```javascript
// Polls GET /api/volunteer/me/assignment every 30 seconds
// On window focus, immediately re-fetches (catches assignments made while tab was backgrounded)
// Returns: { assignment, loading, error, refetch }
// assignment === null when unassigned (this is normal, not an error)
// Cleans up interval on unmount
```

---

## Phase 5 — Volunteer Dashboard Shell

**File to create:** `src/pages/VolunteerDashboard.jsx`

The shell owns tab state and data fetching. Child components receive data as props.

```
Tab structure (bottom navigation on mobile, left sidebar on desktop ≥ 1024px):

Tab 1: Home         icon: home       — default tab
Tab 2: Assignment   icon: map-pin    — highlighted with badge if pending_accept
Tab 3: Schedule     icon: calendar
Tab 4: Profile      icon: user
Tab 5: History      icon: clock
Tab 6: Alerts       icon: bell       — badge with unread count
```

### Shell layout spec

```
Mobile (< 1024px):
┌─────────────────────────────┐
│  VolunteerHeader             │  fixed top, 56px
├─────────────────────────────┤
│                             │
│  <ActiveTabContent>         │  flex-1, overflow-y-auto
│                             │
├─────────────────────────────┤
│  BottomTabBar               │  fixed bottom, 60px, safe-area padding
└─────────────────────────────┘

Desktop (≥ 1024px):
┌──────────┬──────────────────┐
│ Sidebar  │                  │
│ (240px)  │  <ActiveTab>     │
│  tabs    │                  │
└──────────┴──────────────────┘
```

### Data loading strategy

Fetch all data in the shell on mount. Pass down as props. This avoids N separate loading spinners and enables the tab bar to show unread counts.

```
On mount, fetch in parallel:
  Promise.all([
    volunteerApi.getProfile(),
    volunteerApi.getAssignment(),
    volunteerApi.getNotifications()
  ])

History is fetched lazily — only when History tab is first opened.
```

---

## Phase 6 — Dashboard Tabs

### Tab 1: Home (`HomeTab.jsx`)

Summarizes everything. No actions — read-only.

```
Sections:
1. Greeting: "Good morning, [name]" + current date/time
2. AssignmentCard (compact): shows current mission name, status badge, ETA
   - If unassigned: "No active assignment" with warm gray state
   - If pending_accept: pulsing orange "New assignment — tap to review"
3. QuickStats row (3 cards):
   - Missions completed (all time)
   - Completion rate %
   - Available this week (count of true slots in availability)
4. ActiveAlerts: shows max 2 unread notifications inline
```

### Tab 2: Assignment (`AssignmentTab.jsx`)

The most important tab. Optimized for field use.

```
If assignmentStatus === "pending_accept":
  ┌─────────────────────────────────┐
  │  NEW ASSIGNMENT                 │
  │  Mission: [name]                │
  │  Resources: [type] × [qty]      │
  │  Location: [address]            │
  │  Priority: [score badge]        │
  │                                 │
  │  [ACCEPT]        [DECLINE]      │  large buttons, 56px height
  └─────────────────────────────────┘

If status === "accepted" | "en_route" | "on_site":
  ┌─────────────────────────────────┐
  │  AssignmentMap                  │  Google Maps iframe, 240px height
  │  (shows route to destination)   │
  ├─────────────────────────────────┤
  │  ResourceChecklist              │
  │  ☐ First Aid Kit × 40          │
  │  ☐ Food Rations × 120          │
  ├─────────────────────────────────┤
  │  StatusStepper                  │
  │  [EN ROUTE] → [ON SITE] →      │
  │  [MARK COMPLETE]                │
  │  (only current step is active)  │
  └─────────────────────────────────┘

AssignmentMap component:
  - Uses Google Maps Embed API (no JS SDK required — just iframe)
  - URL: https://www.google.com/maps/embed/v1/directions
         ?key={MAPS_API_KEY}
         &origin=My+Location
         &destination={lat},{lng}
         &mode=driving
  - "Open in Google Maps" button below map → deep link to native app
  - Shows destination marker even when offline (static map fallback)

StatusStepper:
  - Shows all steps in sequence with icons
  - Current step is highlighted and has a large CTA button
  - Completed steps shown with checkmark
  - On "Mark Complete": show confirmation bottom sheet before calling API
  - Confirmation sheet shows summary: mission name, resources delivered, duration
```

### Tab 3: Schedule (`ScheduleTab.jsx`)

Weekly availability grid.

```
Layout: 7 columns (days) × 3 rows (Morning / Afternoon / Night)
Each cell: toggle button, 44px × 44px minimum, 
  ON  = amber/orange filled
  OFF = gray outlined

Below grid:
  "You're available [N] slots this week"
  [Save Changes] button — disabled until grid is dirty
  
On save: calls PATCH /api/volunteer/me with full availability object
Show success toast on save, error toast on failure
```

### Tab 4: Profile (`ProfileTab.jsx`)

Editable form. Two sections: read-only stats, editable info.

```
Section A — Performance (read-only, shown as metric cards):
  Missions completed | Completion rate | Last rating (stars)

Section B — Editable fields (form):
  Name (text)
  Phone (tel input, validated)
  Skills (multi-select chips — use skill enum from §2.2)
  Vehicle type (select)
  Vehicle capacity in kg (number, only shown if vehicle !== "none")
  Travel radius (slider: 10–500 km, step 10)
  Emergency contact: name, phone, relation (text inputs)

[Save Profile] button — only enabled when form is dirty
Inline field validation before submit
On save: calls PATCH /api/volunteer/me
```

### Tab 5: History (`HistoryTab.jsx`)

```
List of MissionHistory records, newest first.
Each row:
  Date (formatted: "15 Apr 2026")
  Mission name
  Resource delivered (type × qty)
  Duration (e.g., "2h 15m")
  Status badge (completed / recalled / incomplete)
  Star rating given (if exists)

Load more: "Load previous missions" button (not infinite scroll — too janky on mobile)
Empty state: "No completed missions yet — your history will appear here"
```

### Tab 6: Alerts (`AlertsTab.jsx`)

```
List of notifications from GET /api/volunteer/me/notifications
Each item:
  Timestamp (relative: "2 hours ago")
  Title (e.g., "New assignment available")
  Body text
  Unread indicator dot (orange)
  Tap to mark read + navigate to relevant tab

Empty state: "You're all caught up"
```

---

## Phase 7 — Offline & PWA Support

Field volunteers frequently lose connectivity. The app must not break when offline.

### 7.1 Service Worker — `public/sw.js`

Cache strategy per resource type:

```
Cache-first (static assets — fast load):
  HTML, CSS, JS bundles, images, icons

Network-first with cache fallback (API responses):
  GET /api/volunteer/me           → cache for 10 min
  GET /api/volunteer/me/assignment → cache for 5 min
  GET /api/volunteer/me/history   → cache for 30 min

Write-queue for offline mutations:
  PATCH requests that fail due to offline → store in IndexedDB queue
  On reconnect (navigator.onLine event) → replay queue in order
  Show "Syncing..." indicator while queue is draining
```

### 7.2 Offline UX

- Offline banner: fixed yellow bar at top — "You're offline. Changes will sync when reconnected."
- Disable `AssignmentTab` status updates while offline — show tooltip "Reconnect to update status"
- `AvailabilityGrid` and `ProfileForm` changes queue silently and sync on reconnect
- Static map image fallback if Google Maps embed fails to load

### 7.3 PWA manifest — `public/manifest.json`

```json
{
  "name": "ImpactLink Volunteer",
  "short_name": "ImpactLink",
  "start_url": "/volunteer",
  "display": "standalone",
  "background_color": "#1a1a2e",
  "theme_color": "#F59E0B",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

---

## Phase 8 — Design Tokens & Styling

**File to create:** `src/styles/volunteer.css`

### Color system

The volunteer dashboard uses a warm palette. This visually separates it from the command center (cool indigo/cyan) at a glance — important for operators who switch between views.

```css
/* src/styles/volunteer.css */
:root {
  /* Volunteer brand colors */
  --v-amber:        #F59E0B;
  --v-amber-light:  #FDE68A;
  --v-amber-dark:   #B45309;
  --v-orange:       #EA580C;
  --v-orange-light: #FED7AA;

  /* Semantic — map to volunteer context */
  --v-accent:       var(--v-amber);
  --v-accent-bg:    #FFFBEB;    /* amber-50 equivalent */
  --v-pending:      #F97316;    /* orange for pending_accept */

  /* Status colors */
  --v-en-route:     #3B82F6;    /* blue */
  --v-on-site:      #10B981;    /* emerald */
  --v-completed:    #6B7280;    /* gray */
  --v-unassigned:   #9CA3AF;    /* lighter gray */

  /* Touch target minimum */
  --v-touch-target: 48px;

  /* Typography scale — slightly larger for field readability */
  --v-text-xs:   13px;
  --v-text-sm:   15px;
  --v-text-base: 17px;
  --v-text-lg:   20px;
  --v-text-xl:   24px;
  --v-text-2xl:  30px;

  /* Spacing */
  --v-gap-sm:  12px;
  --v-gap-md:  20px;
  --v-gap-lg:  32px;

  /* Cards */
  --v-card-radius: 16px;
  --v-card-padding: 20px;
}
```

### Mobile-first breakpoints

```css
/* Base styles target 320px (smallest Android phones) */
/* Tablet: 640px */
@media (min-width: 640px) { ... }
/* Desktop: 1024px — switch to sidebar nav */
@media (min-width: 1024px) { ... }
```

### Touch target rules

Every interactive element must meet 48×48px minimum:

```css
.v-tab-button,
.v-toggle,
.v-checklist-item,
.v-status-button {
  min-height: var(--v-touch-target);
  min-width: var(--v-touch-target);
}
```

### Status badge system

```css
.v-badge                { border-radius: 9999px; padding: 3px 10px; font-size: 12px; font-weight: 600; }
.v-badge--pending       { background: #FEF3C7; color: #92400E; }
.v-badge--accepted      { background: #DBEAFE; color: #1E40AF; }
.v-badge--en-route      { background: #EFF6FF; color: #2563EB; }
.v-badge--on-site       { background: #D1FAE5; color: #065F46; }
.v-badge--completed     { background: #F3F4F6; color: #374151; }
.v-badge--unassigned    { background: #F9FAFB; color: #9CA3AF; }
```

---

## Verification Checklist

Run through each scenario before marking any phase complete.

### Auth flows

- [ ] New user → Firebase login → `/setup` page → selects Volunteer + enters code → linked to Volunteer doc → redirected to `/volunteer`
- [ ] New user → Firebase login → `/setup` → selects Administrator → redirected to `/dashboard`
- [ ] Volunteer tries to access `/dashboard` → redirected to `/volunteer`
- [ ] Admin tries to access `/volunteer` → redirected to `/dashboard`
- [ ] Returning volunteer → Firebase login → already has role → skips `/setup` → directly to `/volunteer`
- [ ] Token expiry → silent refresh → no forced logout unless refresh itself fails

### Volunteer dashboard

- [ ] Home tab loads with correct name, stats, and compact assignment card
- [ ] Assignment tab shows "No active assignment" when `currentAssignmentId` is null
- [ ] Assignment tab shows accept/decline when `assignmentStatus === "pending_accept"`
- [ ] Accept triggers status update → map renders → status stepper appears
- [ ] Status steps enforce sequence — cannot jump from accepted to completed
- [ ] "Mark Complete" requires confirmation sheet — not single tap
- [ ] Schedule grid toggles save to DB on explicit save button
- [ ] Profile form only enables Save when dirty
- [ ] History tab paginates correctly — "load more" works
- [ ] Alerts tab shows unread count in tab badge
- [ ] Marking notification read removes the dot

### Mobile & offline

- [ ] Renders correctly at 320px viewport width
- [ ] All interactive elements ≥ 48px tall
- [ ] Bottom tab bar has safe-area padding (iOS notch/home bar)
- [ ] Offline banner appears when navigator.onLine is false
- [ ] Profile edits made offline are queued and sync on reconnect
- [ ] Google Maps embed has static image fallback when offline

### Security

- [ ] `PATCH /api/volunteer/me` rejects any attempt to write `completionRate`, `performanceScore`, `assignmentStatus` directly
- [ ] Volunteer A cannot fetch volunteer B's assignment via `/api/volunteer/me/assignment` (self-only enforcement)
- [ ] Volunteer code is nulled after first use — cannot be reused
- [ ] All routes return 401 without valid Firebase token

---

## Critical Constraints & Pitfalls

**Do not do these things:**

1. Never auto-assign a role based on the `?intent` URL param without user confirmation. The modal must be shown — this prevents phishing-style URLs from silently changing a user's role.

2. Never let `PATCH /api/volunteer/me` accept arbitrary body keys. Use an explicit allowlist. If a future developer adds `role` or `completionRate` to a form, the endpoint must silently ignore it, not persist it.

3. Never store computed fields (`gap_delta`, `coverage_pct`, assignment counts) in the database. Always derive them in the aggregation layer. Stored computed fields go stale.

4. Never render all 100+ incidents on the map in the volunteer view. The volunteer map shows only their single assignment destination — one marker, one route. The full heatmap is admin-only.

5. Never use `display: none` for offline-queued mutations. Show clear pending state (spinner or "pending sync" label) so the volunteer knows their action was registered even without server confirmation.

6. The status transition `completed` is irreversible from the volunteer side. Do not provide an undo. If a volunteer accidentally marks complete, that requires admin intervention. Show a strong confirmation dialog that names the mission and the consequence.

7. Do not run DBSCAN or Gemini calls from volunteer-facing routes. The volunteer API is read-heavy and must be fast (sub-200ms). All intelligence runs on the admin side and the volunteer consumes the output.

---

*End of implementation plan. All phases are independently mergeable. Begin with Phase 1.*
