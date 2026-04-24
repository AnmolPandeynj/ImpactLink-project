# ImpactLink — Stage 3: Beneficiary Intelligence
## Wizard Integration & Implementation Plan

**Version:** 1.0 | **Status:** Ready for AI Execution
**Scope:** New wizard stage — beneficiary data ingestion, geocoding pipeline, zone-coverage resolution, and dataset persistence
**Depends on:** Stage 2 (Geographic Intelligence — zones already defined with centers + radii before this stage runs)

---

## Table of Contents

1. [Stage Placement & Wizard Reshuffle](#1-stage-placement--wizard-reshuffle)
2. [The Core Problem: Address → Zone Resolution](#2-the-core-problem-address--zone-resolution)
3. [Data Models](#3-data-models)
4. [Backend API Routes](#4-backend-api-routes)
5. [Geocoding Pipeline](#5-geocoding-pipeline)
6. [Out-of-Zone Resolution Logic](#6-out-of-zone-resolution-logic)
7. [Frontend: Stage UI Specification](#7-frontend-stage-ui-specification)
8. [File Structure](#8-file-structure)
9. [Phase Execution Order](#9-phase-execution-order)
10. [Phase 1 — Data Models](#phase-1--data-models)
11. [Phase 2 — Geocoding Pipeline Service](#phase-2--geocoding-pipeline-service)
12. [Phase 3 — API Routes](#phase-3--api-routes)
13. [Phase 4 — File Parser Service](#phase-4--file-parser-service)
14. [Phase 5 — Frontend Stage Component](#phase-5--frontend-stage-component)
15. [Phase 6 — Resolution UX (Out-of-Zone Handling)](#phase-6--resolution-ux)
16. [Phase 7 — Dataset Library](#phase-7--dataset-library)
17. [Verification Checklist](#verification-checklist)
18. [Critical Constraints & Pitfalls](#critical-constraints--pitfalls)

---

## 1. Stage Placement & Wizard Reshuffle

### Why it goes at Stage 3

Beneficiary Intelligence must come **after** Geographic Intelligence (Stage 2) because every beneficiary record is validated against the zones defined in Stage 2. It cannot run before zones exist — the "out of zone" resolution flow requires real zone data to offer meaningful options.

It must come **before** Human Capital (Stage 4) because the beneficiary count and density distribution directly informs how many responders are needed and what skills they should have. Running Human Capital without knowing beneficiary volume produces arbitrary capacity numbers.

### Revised wizard order

| # | Stage | Change |
|---|-------|--------|
| 1 | Mission Identity | No change |
| 2 | Geographic Intelligence | No change |
| **3** | **Beneficiary Intelligence** | **NEW — inserted here** |
| 4 | Temporal Planning | Was Stage 3 — shifted down |
| 5 | Human Capital | Was Stage 4 — shifted down |
| 6 | Tactical Roster | Was Stage 5 — shifted down |
| 7 | Resource Architecture | Was Stage 6 — shifted down |

### Wizard state dependency

Stage 3 reads from Stage 2's output and writes its output for Stage 5 to consume:

```
Stage 2 output → zones[]: { zoneId, centerLat, centerLng, radiusKm, name }
                    │
                    ▼
            Stage 3 (Beneficiary Intelligence)
                    │
                    ▼
Stage 5 input ← beneficiaryStats: { totalCount, perZone: { zoneId, count, needCategories[] } }
```

---

## 2. The Core Problem: Address → Zone Resolution

This is the hardest engineering problem in the stage. Here is the full decision tree:

### Input types (what can come from a CSV/Excel row)

```
Type A: Coordinate pair         "28.6139, 77.2090"          → use directly
Type B: Partial coordinates     "28.6139"  (lat only)       → flag as malformed
Type C: Clean address           "12 MG Road, Bengaluru"     → geocode
Type D: Vague locality          "Near Lal Bagh, Bengaluru"  → geocode, low confidence
Type E: District/state only     "Bhopal, MP"                → geocode to centroid, warn
Type F: Landmark                "Behind AIIMS Delhi"        → geocode, may fail
Type G: Empty/null              ""                          → flag as missing
```

### Per-record resolution pipeline

```
FOR EACH beneficiary row:

  1. DETECT input type (A–G above)

  2. IF Type A: parse directly → { lat, lng, geocodeMethod: "direct" }

  3. IF Type C/D/E/F: call Geocoding Service
       → append ", India" if no country context detected
       → receive { lat, lng, confidence: 0–1, formattedAddress, placeId }
       → if confidence < 0.6: flag as LOW_CONFIDENCE (needs review)
       → if geocode fails: flag as GEOCODE_FAILED

  4. IF geocoded or direct: run Zone Intersection Test
       FOR EACH zone in project:
         distance = haversine(beneficiary.lat, beneficiary.lng, zone.centerLat, zone.centerLng)
         IF distance <= zone.radiusKm: assign to zone → MATCHED
       IF no zone matched: status = OUT_OF_ZONE

  5. IF OUT_OF_ZONE: calculate nearest zone
       nearestZone = zones.reduce(minDistance)
       overshootKm = distance - nearestZone.radiusKm
       store { nearestZoneId, overshootKm }

  6. Store result with status:
       MATCHED | OUT_OF_ZONE | LOW_CONFIDENCE | GEOCODE_FAILED | MALFORMED | MISSING_LOCATION
```

### Zone intersection: haversine formula (must implement server-side)

```javascript
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) *
            Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
```

---

## 3. Data Models

### 3.1 `BeneficiaryDataset` — NEW: `backend/models/BeneficiaryDataset.js`

A dataset is a reusable collection of beneficiary records that can be imported into multiple projects. It exists independently of any project — this enables the "select from already uploaded datasets" flow.

```javascript
const BeneficiaryDatasetSchema = new mongoose.Schema({
  // Identity
  name:         { type: String, required: true },
  description:  { type: String },
  uploadedBy:   { type: String, required: true },      // Firebase uid
  orgId:        { type: String },                       // optional org scope

  // Source file metadata (original upload preserved for re-ingestion)
  sourceFile: {
    originalName:  { type: String },
    storagePath:   { type: String },                   // GCS/S3 path or local path
    mimeType:      { type: String },                   // text/csv or application/vnd.openxmlformats...
    rowCount:      { type: Number },
    sizeBytes:     { type: Number },
    uploadedAt:    { type: Date, default: Date.now }
  },

  // Column mapping (how CSV columns map to beneficiary fields)
  columnMapping: {
    name:          { type: String },   // CSV column name → beneficiary name
    phone:         { type: String },
    address:       { type: String },   // raw address column
    lat:           { type: String },   // if coordinates present
    lng:           { type: String },
    needCategory:  { type: String },   // e.g. "food", "medical", "shelter"
    severity:      { type: String },   // 1–10 urgency if present
    customFields:  [{ csvColumn: String, mappedTo: String }]
  },

  // Processing stats (filled after geocoding completes)
  processingStats: {
    status:           { type: String, enum: ['pending', 'processing', 'complete', 'failed'], default: 'pending' },
    geocodedCount:    { type: Number, default: 0 },
    failedCount:      { type: Number, default: 0 },
    totalRows:        { type: Number, default: 0 },
    processingTimeMs: { type: Number }
  },

  tags:      [String],
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });
```

### 3.2 `Beneficiary` — NEW: `backend/models/Beneficiary.js`

Individual records within a dataset. Kept separate from the dataset document to allow querying at scale without loading the entire dataset.

```javascript
const BeneficiarySchema = new mongoose.Schema({
  datasetId:   { type: mongoose.Schema.Types.ObjectId, ref: 'BeneficiaryDataset', required: true, index: true },
  projectId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Project', index: true },  // set when linked to a project
  rowIndex:    { type: Number },   // original row number in CSV (for error reporting)

  // Identity fields
  name:         { type: String },
  phone:        { type: String },
  needCategory: { type: String, enum: ['food', 'medical', 'shelter', 'water', 'evacuation', 'communication', 'other'] },
  severity:     { type: Number, min: 1, max: 10, default: 5 },
  customFields: { type: Map, of: String },

  // Raw location as it appeared in the source file
  rawLocation:  { type: String },    // original text: "Near AIIMS, Delhi" or "28.6, 77.2"

  // Geocoded result
  geo: {
    lat:             { type: Number },
    lng:             { type: Number },
    formattedAddress: { type: String },
    placeId:         { type: String },      // Google Places ID for deduplication
    geocodeMethod:   { type: String, enum: ['direct_coordinates', 'geocoded', 'manual_override', 'unresolved'] },
    confidenceScore: { type: Number, min: 0, max: 1 },
    geocodedAt:      { type: Date }
  },

  // Zone assignment result
  zoneAssignment: {
    status: {
      type: String,
      enum: ['matched', 'out_of_zone', 'low_confidence', 'geocode_failed', 'malformed', 'missing_location', 'excluded'],
      default: 'missing_location'
    },
    assignedZoneId:  { type: String },    // which zone this beneficiary belongs to
    nearestZoneId:   { type: String },    // if out_of_zone: which zone is closest
    distanceFromNearestZoneKm: { type: Number },
    overshootKm:     { type: Number },    // how far outside the nearest zone's radius
    resolvedBy:      { type: String, enum: ['auto', 'admin_expand', 'admin_reassign', 'admin_exclude'], default: 'auto' },
    resolvedAt:      { type: Date }
  }
}, { timestamps: true });

// Geospatial index for proximity queries
BeneficiarySchema.index({ 'geo.lat': 1, 'geo.lng': 1 });
BeneficiarySchema.index({ datasetId: 1, 'zoneAssignment.status': 1 });
```

### 3.3 Patch to `Project` model

Add these fields to the existing Project schema:

```javascript
// ADD to existing Project schema:
{
  beneficiaryDatasets: [{
    datasetId:    { type: mongoose.Schema.Types.ObjectId, ref: 'BeneficiaryDataset' },
    linkedAt:     { type: Date, default: Date.now },
    recordsLinked: { type: Number }
  }],

  beneficiarySummary: {
    totalCount:   { type: Number, default: 0 },
    perZone: [{
      zoneId:       String,
      zoneName:     String,
      count:        Number,
      needBreakdown: { type: Map, of: Number }   // { food: 12, medical: 8, ... }
    }],
    outOfZoneCount:     { type: Number, default: 0 },
    unresolvedCount:    { type: Number, default: 0 },
    lastUpdated:        { type: Date }
  }
}
```

---

## 4. Backend API Routes

All routes require `verifyFirebaseToken` middleware. Dataset-modifying routes additionally require `checkRole('Administrator')`.

```
POST   /api/beneficiary-datasets
       Body: multipart/form-data — file (CSV or XLSX), name, description, tags[]
       — Validates file type and size (max 10MB)
       — Stores file to disk/storage, creates BeneficiaryDataset doc with status: pending
       — Enqueues geocoding job (async — does NOT wait for geocoding to finish)
       — Returns: { datasetId, jobId, estimatedRows }

GET    /api/beneficiary-datasets
       Query: ?page=1&limit=20&tags=flood,medical
       — Returns paginated list of datasets uploaded by this user/org
       — Includes processingStats.status so UI can show "processing" state

GET    /api/beneficiary-datasets/:datasetId
       — Full dataset document + column mapping + processing stats
       — Does NOT return individual records (use /records endpoint)

GET    /api/beneficiary-datasets/:datasetId/records
       Query: ?status=out_of_zone&page=1&limit=50
       — Paginated beneficiary records, filterable by zoneAssignment.status
       — Used by resolution UI to show problem rows

GET    /api/beneficiary-datasets/:datasetId/summary
       — Returns counts grouped by status, zone, needCategory
       — Used to render the summary panel without loading all records

PATCH  /api/beneficiary-datasets/:datasetId/column-mapping
       Body: { columnMapping: { name, phone, address, lat, lng, needCategory, severity } }
       — Updates column mapping and triggers re-parse + re-geocode
       — Only allowed when dataset status is 'complete' or 'failed'

POST   /api/beneficiary-datasets/:datasetId/resolve
       Body: { beneficiaryIds: [], action: "expand_zone"|"reassign_zone"|"exclude", zoneId?: string }
       — Bulk resolution action for out-of-zone records
       — "expand_zone": increases the nearest zone's radius to include these records
       — "reassign_zone": manually assigns records to a specified zone
       — "exclude": marks records as excluded (not counted, not assigned)
       — Returns updated counts

POST   /api/projects/:projectId/beneficiary-datasets/:datasetId/link
       — Links an existing dataset to a project
       — Runs zone intersection against THIS project's zones (not the original upload's zones)
       — Triggers async re-geocoding for any records that don't already have coordinates
       — Returns: { matched, outOfZone, unresolved, jobId }

DELETE /api/projects/:projectId/beneficiary-datasets/:datasetId
       — Unlinks dataset from project (does not delete the dataset itself)

GET    /api/projects/:projectId/beneficiary-summary
       — Returns beneficiarySummary from the Project doc
       — Used by wizard to show the stage completion state
       — Used by Stage 5 (Human Capital) to suggest responder counts
```

### Geocoding job status endpoint

```
GET    /api/beneficiary-datasets/:datasetId/job-status
       — Returns { status, processed, total, failedCount, estimatedTimeRemainingSeconds }
       — Frontend polls this every 3 seconds while status is 'processing'
```

---

## 5. Geocoding Pipeline

### 5.1 Service file: `backend/services/geocodingPipeline.js`

The geocoding pipeline runs as an async job — never in-request. A large CSV (10,000 rows) could take minutes. The frontend polls for job status.

```
Pipeline steps:

1. PARSE
   Read CSV/XLSX row by row using streaming (never load entire file into memory)
   Detect location column type: coordinate pair vs address string
   Create Beneficiary document for each row with status: 'missing_location' initially

2. BATCH
   Group rows needing geocoding into batches of 50
   (Google Geocoding API allows 50 QPS on standard tier)

3. GEOCODE (per batch)
   For each address in batch:
     a. Normalize: trim, remove extra spaces, ensure country context
        IF address does not contain "India" AND no state/city hint → append ", India"
     b. Call Google Geocoding API:
        GET https://maps.googleapis.com/maps/api/geocode/json
          ?address={encodeURIComponent(normalizedAddress)}
          &key={GOOGLE_MAPS_API_KEY}
          &region=in         ← biases results to India
          &language=en
     c. Parse response:
        IF status === "OK":
          lat = results[0].geometry.location.lat
          lng = results[0].geometry.location.lng
          confidence = computeConfidence(results[0])
          formattedAddress = results[0].formatted_address
          placeId = results[0].place_id
        IF status === "ZERO_RESULTS": mark GEOCODE_FAILED
        IF status === "REQUEST_DENIED" or error: log, mark GEOCODE_FAILED, continue

4. COMPUTE CONFIDENCE (helper function)
   Confidence is derived from Google's location_type field:
     ROOFTOP       → 0.95   (precise street address)
     RANGE_INTERPOLATED → 0.75  (interpolated between rooftops)
     GEOMETRIC_CENTER   → 0.55  (centroid of a named region)
     APPROXIMATE        → 0.35  (general area)
   Also reduce confidence if:
     - result.types includes "country" (geocoded to entire country)
     - result.types includes "administrative_area_level_1" (just a state)
     - formatted_address differs significantly from input address

5. ZONE INTERSECTION (per record with valid coordinates)
   Run haversine against all zones in the project
   Assign status: matched | out_of_zone

6. UPDATE DATASET STATS
   After all batches complete:
   Update BeneficiaryDataset.processingStats
   Recompute Project.beneficiarySummary if this dataset is linked to a project
```

### 5.2 Rate limiting and cost control

```javascript
// Geocoding costs money. Implement these guards:

const GEOCODING_GUARDS = {
  maxRowsPerDataset: 50000,           // hard cap — reject uploads above this
  maxConcurrentJobs: 3,               // never run more than 3 geocoding jobs at once
  batchSize: 50,                      // rows per API call batch
  delayBetweenBatchesMs: 1100,        // ~50 QPS with buffer
  skipGeocodingIfPlaceIdExists: true, // do not re-geocode if placeId already stored
  cacheResults: true,                 // cache by normalized address in Redis/MongoDB
};

// Cache geocoding results by normalized address:
// Collection: GeocodingCache { normalizedAddress, lat, lng, formattedAddress, placeId, confidence, cachedAt }
// Before calling API: check cache. On API success: write to cache.
// Cache TTL: 90 days (addresses don't move)
```

### 5.3 India-specific address normalization

Indian addresses are particularly diverse. Apply these transforms before geocoding:

```javascript
function normalizeIndianAddress(raw) {
  let addr = raw.trim();

  // Remove common noise phrases
  addr = addr.replace(/^(near|opp|opposite|behind|beside|adjacent to|in front of)\s+/i, '');

  // Expand common abbreviations
  const abbr = {
    'nagar': 'Nagar', 'marg': 'Marg', 'rd': 'Road', 'st': 'Street',
    'dist': 'District', 'tehsil': 'Tehsil', 'taluka': 'Taluka',
    'vill': 'Village', 'po': 'Post Office', 'ps': 'Police Station',
    'mp': 'Madhya Pradesh', 'up': 'Uttar Pradesh', 'mh': 'Maharashtra',
    'rj': 'Rajasthan', 'gj': 'Gujarat', 'ka': 'Karnataka',
    'wb': 'West Bengal', 'ap': 'Andhra Pradesh', 'ts': 'Telangana'
  };
  // Apply abbreviation expansion (word-boundary aware)

  // Append country if not present
  if (!/india$/i.test(addr)) addr += ', India';

  return addr;
}
```

---

## 6. Out-of-Zone Resolution Logic

This is the most important UX decision in the stage. When records fall outside defined zones, the admin has three options. Each has consequences that propagate forward.

### Option A: Expand Zone Radius

The admin increases the radius of the nearest zone to absorb the out-of-zone records.

```
Consequences:
+ Records become matched → counted in beneficiarySummary
+ Zone now covers a larger area → impacts responder travel distance (Stage 5)
+ The expanded radius is saved back to the Zone document (Stage 2 data mutated)
! Warn admin: "Expanding this zone will affect responder allocation. The new radius
  is X km — review your responder count in Stage 5."

Implementation:
  PATCH /api/projects/:projectId/zones/:zoneId
  Body: { radiusKm: newRadius }
  → Update Zone document
  → Re-run zone intersection for ALL beneficiaries in this project (not just new ones)
  → Recompute beneficiarySummary
```

### Option B: Reassign to Nearest Zone

Manually assigns records to a zone even though they fall outside its radius. The zone boundary is NOT changed — this is a logical override.

```
Consequences:
+ Records become matched with a note: resolvedBy: "admin_reassign"
+ beneficiarySummary count for that zone increases
+ Responders from that zone will need to travel further than the radius suggests
! Store overshootKm so the dispatch algorithm knows these are edge-case assignments

Implementation:
  POST /api/beneficiary-datasets/:datasetId/resolve
  Body: { beneficiaryIds: [...], action: "reassign_zone", zoneId: "targetZoneId" }
```

### Option C: Exclude Records

Records are excluded from this project. They remain in the dataset for future projects with different geographic scope.

```
Consequences:
+ zoneAssignment.status = "excluded"
+ Not counted in beneficiarySummary
+ Not visible in mission planning
! Show count to admin: "X beneficiaries excluded — they will not receive assistance
  in this mission. You may add a new geographic zone in Stage 2 to include them."

Implementation:
  POST /api/beneficiary-datasets/:datasetId/resolve
  Body: { beneficiaryIds: [...], action: "exclude" }
```

### Resolution UI decision flow

```
After upload + geocoding completes:

IF outOfZoneCount > 0:
  Show resolution panel with three choices per "cluster" of out-of-zone records
  (cluster by proximity — nearby out-of-zone records are grouped, not listed individually)

  For each cluster:
    - Show count, average location, nearest zone name, average overshoot in km
    - Three action buttons: Expand Zone / Reassign / Exclude
    - Preview: if "Expand Zone" selected, show updated radius on minimap

  Admin must resolve ALL clusters before wizard allows proceeding to Stage 4
  OR admin can click "Exclude all unresolved" to bulk-exclude and proceed

IF lowConfidenceCount > 0:
  Show warning: "X records have low-confidence geocoding. Review and manually
  correct addresses in the dataset, or proceed with approximate locations."
  Admin CAN proceed without resolving low-confidence records (they are matched
  but flagged — dispatch system shows them differently)

IF geocodeFailedCount > 0:
  Show error list with original addresses
  Options: Download failed-rows CSV → fix → re-upload as patch
           OR mark as excluded
  Admin CANNOT proceed with unresolved geocode failures (they have no location at all)
```

---

## 7. Frontend: Stage UI Specification

### 7.1 Stage shell: `BeneficiaryIntelligenceStage.jsx`

Three internal sub-views managed by local state (not routes):

```
SubView 1: SOURCE SELECTION     → choose upload new vs select existing dataset
SubView 2: INGESTION & MAPPING  → upload file + map columns + watch processing
SubView 3: RESOLUTION           → handle out-of-zone, low-confidence, failures
SubView 4: SUMMARY              → final counts by zone, confirm and continue
```

Progression through sub-views is linear. The stage is "complete" when SubView 4 is confirmed.

### 7.2 SubView 1 — Source Selection

```
Two-panel layout:

Panel A — Upload New Dataset
  Drag-and-drop zone (accepts .csv, .xlsx, .xls only)
  OR file picker button
  File size limit: 10MB — show error if exceeded
  Show: "Accepted formats: CSV, Excel. Max 10MB. Up to 50,000 rows."

Panel B — Select Existing Dataset
  Searchable list of previously uploaded datasets (GET /api/beneficiary-datasets)
  Each item shows: name, row count, upload date, tags, processingStats.status badge
  If status is 'processing': show spinner, disable selection
  "Use this dataset" button → jumps to SubView 3 (skips ingestion, runs zone intersection only)

At bottom: text input for dataset name (required if uploading new)
```

### 7.3 SubView 2 — Ingestion & Column Mapping

This appears after a file is selected but before geocoding starts.

```
Section A — Column Mapping (critical — must get this right before geocoding)

  Show a preview table: first 5 rows of the uploaded file
  Below the preview: dropdown selectors for each required field

  REQUIRED mapping:
    Location field: select which column contains location data
                    (name it: Address / Coordinates / Lat+Lng columns)

  OPTIONAL mapping:
    Beneficiary name:  [select column or "skip"]
    Phone number:      [select column or "skip"]
    Need category:     [select column or "skip"]
    Severity (1–10):   [select column or "skip"]

  Location type selector (radio):
    ○ "Single address column" → one column contains full address
    ○ "Latitude/Longitude columns" → two separate columns
    ○ "Mixed" → some rows have coordinates, some have addresses

  Smart detection: on file load, auto-detect likely column mappings:
    If column header contains "lat" → suggest as latitude column
    If column header contains "lng" or "lon" → suggest as longitude column
    If column header contains "address" or "location" or "addr" → suggest as address
    If column header contains "name" or "beneficiary" → suggest as name
    Highlight auto-detected suggestions in amber — admin confirms or overrides

Section B — Processing Options

  Geocoding behavior:
    ☑ Append ", India" if no country context detected (default ON)
    ☑ Skip rows where location is empty (default ON — uncheck to include as "location unknown")
    ○ Low confidence threshold: [slider 0.5 – 0.8, default 0.6]

  [Start Processing] button → calls POST /api/beneficiary-datasets, then begins polling

Section C — Progress (shown after processing starts)

  Progress bar: "Processing 847 / 2,341 rows"
  Live stats (update every 3s):
    Geocoded successfully: 812
    Direct coordinates:    234
    Low confidence:         18
    Failed to geocode:       3
  Estimated time remaining: "~4 minutes"
  [Cancel] button (marks job as cancelled, leaves partial dataset)
```

### 7.4 SubView 3 — Resolution Panel

Only shown if `outOfZoneCount > 0` or `geocodeFailedCount > 0`.

```
Header summary bar:
  [✓ 1,847 matched]  [⚠ 312 out of zone]  [~ 45 low confidence]  [✗ 18 failed]

Section A — Out of Zone Records (shown as clusters, not individual rows)

  Each cluster card:
    Title: "Cluster near [nearest_place_name]"  (reverse geocoded)
    Count: "34 beneficiaries"
    Nearest zone: "[Zone Name]" — [X] km outside radius
    Map thumbnail: minimap showing zone boundary + cluster location

    Three action buttons:
      [Expand Zone to include these]
        → shows preview: "Zone radius: 25 km → 31.4 km"
        → shows warning if expansion overlaps another zone
      [Assign to [Zone Name] without expanding]
        → shows note: "These records will be outside the zone boundary"
      [Exclude from this mission]
        → shows count: "34 beneficiaries will not be served"

Section B — Geocode Failures

  Table showing failed rows:
    Row # | Original location text | Reason
    12    | "Near water tank"      | Insufficient location detail
    47    | "Block C"              | No city/district context

  Actions:
    [Download failed rows as CSV] — download file with "corrected_address" column for admin to fill
    [Re-upload corrected file]    — patches only the failed rows
    [Exclude all failed rows]     — mark all as excluded

Section C — Low Confidence (collapsible, not blocking)

  "45 records have approximate locations. They will be included but flagged."
  Expandable list showing records with confidence < threshold
  Admin can optionally review — not required to proceed

[Proceed] button — disabled until:
  All out-of-zone clusters have an action selected AND
  All geocode failures are either re-uploaded or excluded
```

### 7.5 SubView 4 — Summary & Confirmation

```
Title: "Beneficiary Intelligence — Summary"

Zone breakdown table:
  Zone Name     | Beneficiaries | Need Breakdown            | Coverage
  Delhi Hub     | 1,234         | Food: 45%, Medical: 31%   | ✓ Within radius
  Indore Zone   | 612           | Shelter: 68%, Food: 22%   | ✓ Within radius
  [Expanded]    | 89            | Medical: 91%              | ⚠ Radius expanded

Stats row:
  Total beneficiaries linked: 1,935
  Excluded: 18
  Low confidence (included): 45

Note to admin: "Stage 5 (Human Capital) will suggest responder counts based on
these beneficiary numbers. You can return to this stage at any time to adjust."

[Confirm & Continue to Temporal Planning] button
```

### 7.6 Returning to a completed stage

If the admin returns to Stage 3 after completion:
- Show SubView 4 (summary) by default
- Provide edit options: "Upload additional dataset", "Re-run resolution", "Manage linked datasets"
- Changes to beneficiaries after Stage 5 is complete → show warning: "Changing beneficiary
  data may affect your responder count recommendations. Review Stage 5 after saving."

---

## 8. File Structure

```
backend/
├── models/
│   ├── BeneficiaryDataset.js       NEW
│   ├── Beneficiary.js              NEW
│   └── GeocodingCache.js           NEW (simple cache: { normalizedAddress, lat, lng, ... })
│
├── services/
│   ├── geocodingPipeline.js        NEW — async geocoding job runner
│   ├── fileParser.js               NEW — CSV and XLSX parser (streaming)
│   ├── zoneIntersection.js         NEW — haversine + zone matching logic
│   └── beneficiaryClusterer.js     NEW — clusters out-of-zone records for resolution UI
│
├── routes/
│   └── beneficiaryDatasets.js      NEW — all /api/beneficiary-datasets routes
│
└── middleware/
    └── uploadMiddleware.js         NEW — multer config for CSV/XLSX uploads

src/
├── pages/wizard/
│   └── stages/
│       └── BeneficiaryIntelligenceStage.jsx   NEW — stage shell
│
├── components/wizard/beneficiary/
│   ├── SourceSelector.jsx          NEW — SubView 1: upload vs existing dataset
│   ├── ColumnMappingForm.jsx       NEW — SubView 2: map CSV columns to fields
│   ├── ProcessingProgress.jsx      NEW — SubView 2: live progress during geocoding
│   ├── OutOfZoneClusterCard.jsx    NEW — SubView 3: single cluster resolution card
│   ├── GeocodingFailureTable.jsx   NEW — SubView 3: failed rows table + re-upload
│   ├── DatasetLibraryList.jsx      NEW — SubView 1: browse existing datasets
│   └── BeneficiarySummaryPanel.jsx NEW — SubView 4: zone breakdown + confirmation
│
└── services/
    └── beneficiaryApi.js           NEW — client-side API wrapper
```

---

## 9. Phase Execution Order

```
Phase 1 → Data models (Beneficiary, BeneficiaryDataset, GeocodingCache)
Phase 2 → Geocoding pipeline service + zoneIntersection + normalizer
Phase 3 → API routes (upload, status polling, resolution, linking)
Phase 4 → File parser service (CSV streaming, XLSX, column detection)
Phase 5 → Frontend stage shell + SubView 1 + SubView 2
Phase 6 → Resolution UX — OutOfZoneClusterCard + SubView 3
Phase 7 → Dataset library + SubView 4 + wizard integration
```

---

## Phase 1 — Data Models

**Files to create:** `backend/models/BeneficiaryDataset.js`, `backend/models/Beneficiary.js`, `backend/models/GeocodingCache.js`

**Files to modify:** Existing Project model — add `beneficiaryDatasets[]` and `beneficiarySummary` fields from §3.3

**Implementation notes:**

The `Beneficiary` model is separate from `BeneficiaryDataset` intentionally. A dataset with 50,000 rows must not be loaded as a single MongoDB document. Each beneficiary is its own document, indexed by `datasetId`.

The `GeocodingCache` model is simple: `{ normalizedAddress: String (unique index), lat, lng, formattedAddress, placeId, confidenceScore, cachedAt }`. Always query cache before calling the Google API. This is the single most important cost-control measure.

---

## Phase 2 — Geocoding Pipeline Service

**Files to create:** `backend/services/geocodingPipeline.js`, `backend/services/zoneIntersection.js`, `backend/services/beneficiaryClusterer.js`

**Implementation notes:**

The pipeline runs as an async function called after the upload route responds. Use a simple job queue pattern — store job state in the `BeneficiaryDataset.processingStats` document. Do not use a separate queue system (Bull, etc.) unless the app already has one.

```javascript
// Pseudocode for pipeline orchestrator
async function runGeocodingPipeline(datasetId, projectId) {
  const dataset = await BeneficiaryDataset.findById(datasetId);
  const zones = projectId ? await getProjectZones(projectId) : [];

  await BeneficiaryDataset.findByIdAndUpdate(datasetId, {
    'processingStats.status': 'processing'
  });

  const rows = await streamParseFile(dataset.sourceFile.storagePath, dataset.columnMapping);
  const batches = chunkArray(rows, GEOCODING_GUARDS.batchSize);

  let processed = 0;
  for (const batch of batches) {
    await processBatch(batch, datasetId, zones);
    processed += batch.length;
    await updateProgress(datasetId, processed, rows.length);
    await sleep(GEOCODING_GUARDS.delayBetweenBatchesMs);
  }

  await finalizeDataset(datasetId, projectId);
}
```

The `beneficiaryClusterer.js` uses a simplified DBSCAN pass over out-of-zone records to group nearby ones into resolution clusters. Use a 10km epsilon for clustering — nearby out-of-zone records likely represent the same underserved area and should be resolved together.

---

## Phase 3 — API Routes

**Files to create:** `backend/routes/beneficiaryDatasets.js`, `backend/middleware/uploadMiddleware.js`

**Implementation notes for upload route:**

```javascript
// POST /api/beneficiary-datasets
// 1. Validate file type: only text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel
// 2. Validate file size: max 10MB
// 3. Do NOT geocode synchronously — respond immediately with 202 Accepted + datasetId
// 4. Call runGeocodingPipeline(datasetId, projectId) without await (fire and forget)
// 5. The client polls /job-status for progress

// PATCH /api/beneficiary-datasets/:id/resolve — most complex route
// Must be atomic: update multiple Beneficiary docs + recompute dataset stats + recompute project summary
// Use MongoDB transactions if available, otherwise handle partial-failure gracefully
// For "expand_zone" action: also update the Zone document radius
```

---

## Phase 4 — File Parser Service

**Files to create:** `backend/services/fileParser.js`

**Implementation notes:**

Use `csv-parser` npm package for CSV (streaming — does not load entire file into memory).
Use `xlsx` npm package for Excel files.

```javascript
// Required packages: npm install csv-parser xlsx multer

// The parser must:
// 1. Detect file type from mimetype, not extension (extension can be spoofed)
// 2. Stream CSV row by row — do not collect all rows into an array first
// 3. For XLSX: convert to CSV in memory using xlsx.utils.sheet_to_csv, then stream
// 4. Return an AsyncIterator or use a callback pattern
// 5. Detect column headers on first row, auto-suggest mappings

// Auto-detection heuristics for column names (case-insensitive):
const COLUMN_HINTS = {
  lat:         ['lat', 'latitude', 'y', 'y_coord'],
  lng:         ['lng', 'lon', 'longitude', 'x', 'x_coord'],
  address:     ['address', 'addr', 'location', 'place', 'area', 'locality'],
  name:        ['name', 'beneficiary', 'person', 'individual', 'head'],
  phone:       ['phone', 'mobile', 'contact', 'tel', 'number'],
  needCategory:['need', 'category', 'type', 'requirement', 'req'],
  severity:    ['severity', 'urgency', 'priority', 'score'],
};
```

---

## Phase 5 — Frontend Stage Shell (SubViews 1 & 2)

**Files to create:** `BeneficiaryIntelligenceStage.jsx`, `SourceSelector.jsx`, `ColumnMappingForm.jsx`, `ProcessingProgress.jsx`, `DatasetLibraryList.jsx`

**Implementation notes:**

`ColumnMappingForm.jsx` receives the first 5 rows of the file as preview data. It renders a scrollable table plus a mapping form below. Each field (name, address, phone, etc.) has a `<select>` populated with all column headers detected from row 1. Auto-detected suggestions are pre-selected but amber-highlighted with a "confirm" indicator.

`ProcessingProgress.jsx` polls `GET /api/beneficiary-datasets/:id/job-status` every 3 seconds using `setInterval`. Clean up the interval on component unmount. Show the live counts (geocoded, failed, low confidence) updating in real time — this makes a potentially 5-minute process feel alive rather than frozen.

---

## Phase 6 — Resolution UX

**Files to create:** `OutOfZoneClusterCard.jsx`, `GeocodingFailureTable.jsx`

**Implementation notes:**

`OutOfZoneClusterCard.jsx` uses a Google Maps Static API image (not an interactive map) to show the zone boundary and cluster location. This is a single `<img>` tag — no SDK, no performance impact.

```javascript
// Google Maps Static API URL for zone + cluster minimap
const staticMapUrl = [
  `https://maps.googleapis.com/maps/api/staticmap`,
  `?size=320x180`,
  `&zoom=9`,
  `&center=${cluster.avgLat},${cluster.avgLng}`,
  // Zone boundary circle
  `&path=color:0x4F46E5|fillcolor:0x4F46E540|weight:2`,
  `|enc:${encodeZoneCircle(zone.centerLat, zone.centerLng, zone.radiusKm)}`,
  // Cluster marker
  `&markers=color:red|${cluster.avgLat},${cluster.avgLng}`,
  `&key=${MAPS_API_KEY}`
].join('');
```

The resolution actions (expand/reassign/exclude) must show a preview of the consequence before committing. Use a local state "pending action" — highlight the selected action, show the consequence text, then require a single "Confirm" click to call the API.

The "Expand Zone to include these" preview must calculate the minimum radius expansion needed:
```javascript
// Min new radius = max(distance from zone center to all records in cluster) + 0.5km buffer
const newRadius = Math.max(...cluster.records.map(r =>
  haversineKm(zone.centerLat, zone.centerLng, r.lat, r.lng)
)) + 0.5;
```

---

## Phase 7 — Dataset Library & Wizard Integration

**Files to create:** `BeneficiarySummaryPanel.jsx`

**Files to modify:**
- Wizard navigation component — add Stage 3 between Geographic Intelligence and Temporal Planning
- Wizard state management — add `beneficiaryDatasets`, `beneficiarySummary` to wizard context
- Stage 5 (Human Capital) — read `beneficiarySummary.perZone` to suggest responder counts

**Wizard state additions:**

```javascript
// Add to wizard context / state:
{
  beneficiaryDatasets: [],        // array of linked datasetIds
  beneficiarySummary: {
    totalCount: 0,
    perZone: [],
    outOfZoneCount: 0,
    unresolvedCount: 0
  },
  beneficiaryStageComplete: false   // required to proceed past Stage 3
}
```

**Stage completion condition:**
Stage 3 is complete when:
1. At least one dataset is linked AND
2. `unresolvedCount === 0` (all geocode failures are either re-uploaded or excluded) AND
3. All out-of-zone clusters have a resolution action (expand / reassign / exclude)

Low-confidence records do NOT block stage completion.

**Human Capital integration (Stage 5 patch):**

In the Human Capital stage, add a read-only info panel at the top:

```
"Based on your beneficiary data, this mission will serve [X] people across [N] zones.
 Suggested minimum responder count: [X / 15] (assumes 1 responder per 15 beneficiaries).
 Adjust based on resource type and travel requirements."
```

The ratio (1:15) should be a configurable constant, not hardcoded.

---

## Verification Checklist

### Data ingestion

- [ ] CSV with address column geocodes correctly and assigns to correct zones
- [ ] CSV with lat/lng columns skips geocoding and assigns directly
- [ ] CSV with mixed columns (some addresses, some coordinates) handled correctly
- [ ] XLSX file parses correctly (column headers detected, data rows extracted)
- [ ] Malformed file (wrong mimetype, corrupted, empty) returns clear error message
- [ ] File over 10MB is rejected before geocoding starts
- [ ] File with 0 data rows (headers only) is rejected with clear message

### Geocoding

- [ ] Clean Indian address ("MG Road, Bengaluru") geocodes with confidence > 0.7
- [ ] Vague address ("Near AIIMS, Delhi") geocodes with confidence flag
- [ ] Address without country context has ", India" appended before geocoding
- [ ] Failed geocode (gibberish input) is marked GEOCODE_FAILED, does not crash pipeline
- [ ] Duplicate addresses use cache — no second API call
- [ ] Progress updates every 3 seconds during processing
- [ ] Cancel button stops geocoding job and marks dataset as cancelled

### Zone intersection

- [ ] Record at center of zone is MATCHED to that zone
- [ ] Record exactly at zone boundary (radiusKm distance) is MATCHED
- [ ] Record 0.1km outside zone boundary is OUT_OF_ZONE
- [ ] Record equidistant from two zones is assigned to the one with larger radius
- [ ] Record outside ALL zones has correct nearestZoneId and overshootKm

### Resolution UI

- [ ] Out-of-zone clusters group nearby records (within 10km of each other)
- [ ] Expanding zone calculates minimum required radius correctly
- [ ] Expanding zone updates Zone document and re-runs intersection for all records
- [ ] Reassigning zone sets resolvedBy: "admin_reassign" and stores overshootKm
- [ ] Excluding records removes them from beneficiarySummary count
- [ ] [Proceed] button disabled until all clusters resolved and all failures addressed
- [ ] "Exclude all unresolved" bulk action works correctly

### Existing dataset selection

- [ ] Dataset list shows all datasets uploaded by this user
- [ ] Selecting existing dataset runs zone intersection against THIS project's zones (not original)
- [ ] Dataset processing status shown correctly (completed, processing, failed)
- [ ] Re-using a dataset in a second project does not modify the original dataset

### Wizard integration

- [ ] Stage order is correct: 1→2→3(new)→4→5→6→7
- [ ] Cannot proceed to Stage 4 until Stage 3 completion conditions are met
- [ ] Stage 5 shows beneficiary-informed responder suggestions
- [ ] Returning to Stage 3 shows summary view, not the upload flow
- [ ] Changing Stage 2 (geographic zones) after Stage 3 is complete shows: "Your beneficiary
     assignments may be affected. Re-run zone intersection?"

---

## Critical Constraints & Pitfalls

**1. Never geocode synchronously in the upload request.**
The upload responds with 202 immediately. Geocoding runs as a background process. A 5,000-row CSV at 50 QPS takes 100+ seconds. A synchronous approach will time out.

**2. Never re-geocode records that already have a `placeId`.**
If a dataset is re-linked to a different project, only zone intersection needs to re-run. The geocoding results are reusable. Re-geocoding would double API costs.

**3. Zone intersection must run against the current project's zones, not cached zones.**
When an existing dataset is reused across projects, each project may have different zones. Always re-run `zoneIntersection` against the live zone data for the current project. Never use the cached `zoneAssignment` from a previous project link.

**4. The `Beneficiary.zoneAssignment` field is project-scoped.**
The same beneficiary record can be MATCHED in Project A and OUT_OF_ZONE in Project B. The `zoneAssignment` must store the `projectId` it was computed against, not just the result.

**Add `projectId` to the zoneAssignment subdocument:**
```javascript
zoneAssignment: {
  projectId: { type: mongoose.Schema.Types.ObjectId },   // ADD THIS
  status: ...,
  assignedZoneId: ...,
  ...
}
```
Or better: store zone assignments in a separate `BeneficiaryZoneAssignment` collection keyed by `(beneficiaryId, projectId)`.

**5. The column mapping UI must handle files with no header row.**
Some field exports have no header. Show a toggle: "First row is header" (default ON). If OFF, generate column names: Column A, Column B, etc.

**6. Do not show individual beneficiary names or phone numbers in the UI by default.**
PII visibility should be role-gated. The UI shows counts and aggregates. Individual records (with PII) only appear in the failure resolution table where the admin needs them to fix bad addresses. This is also important for GDPR/DPDP Act compliance.

**7. Address normalization must not corrupt coordinate strings.**
The normalizer must detect coordinate pairs (regex: `^-?\d+\.?\d*\s*,\s*-?\d+\.?\d*$`) and skip all normalization for those rows. Appending ", India" to "28.6139, 77.2090" would break geocoding.

---

*End of implementation plan. Begin with Phase 1 (data models), then Phase 2 (geocoding pipeline) before any frontend work.*
