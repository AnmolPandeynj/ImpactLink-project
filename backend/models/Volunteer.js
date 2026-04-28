const mongoose = require('mongoose');

const volunteerSchema = new mongoose.Schema({
  projectIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Project' }], // Can span multiple campaigns
  name: { type: String, required: true },
  status: { type: String, enum: ['Active', 'Deployed', 'Inactive'], default: 'Active' },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', required: true },
  contactPhone: { type: String, required: true },
  email: { type: String, unique: true, sparse: true }, // Added for test login
  password: { type: String, default: '123456' },      // Added for test login
  lastActive: { type: Date, default: Date.now },
  currentAssignment: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', default: null },
  
  // Availability Logic (Field-ready)
  availability: {
    monday:    { morning: Boolean, afternoon: Boolean, night: Boolean },
    tuesday:   { morning: Boolean, afternoon: Boolean, night: Boolean },
    wednesday: { morning: Boolean, afternoon: Boolean, night: Boolean },
    thursday:  { morning: Boolean, afternoon: Boolean, night: Boolean },
    friday:    { morning: Boolean, afternoon: Boolean, night: Boolean },
    saturday:  { morning: Boolean, afternoon: Boolean, night: Boolean },
    sunday:    { morning: Boolean, afternoon: Boolean, night: Boolean },
  },

  // Skills Taxonomy
  skills: [{
    type: String,
    enum: [
      'first_aid', 'medical', 'search_rescue', 'logistics',
      'communication', 'translation', 'counseling', 'driving',
      'heavy_vehicle', 'water_rescue', 'shelter_setup', 'food_distribution'
    ]
  }],

  // Transport & Logistics
  vehicleType: {
    type: String,
    enum: ['none', 'motorcycle', 'car', 'suv', 'van', 'truck', 'boat'],
    default: 'none'
  },
  vehicleCapacity: { type: Number, default: 0 },   // payload in kg
  travelRadiusKm: { type: Number, default: 20 },

  // Performance (System Managed)
  completionRate: { type: Number, default: 0, min: 0, max: 100 },
  totalMissionsCompleted: { type: Number, default: 0 },
  lastRating: { type: Number, min: 1, max: 5, default: null },

  // Emergency Contact
  emergencyContact: {
    name: String,
    phone: String,
    relation: String
  },

  // Current Assignment Lifecycle
  // NOTE: This stores an Event (_id), NOT a ResourceAllocation document.
  // The allocation engine assigns volunteers directly to Event IDs.
  currentAssignmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    default: null
  },
  assignmentStatus: {
    type: String,
    enum: ['unassigned', 'pending_accept', 'accepted', 'en_route', 'on_site', 'completed'],
    default: 'unassigned'
  },
  assignmentAcceptedAt: { type: Date, default: null },

  // Alphanumeric code for first-time linking
  volunteerCode: { type: String, unique: true, sparse: true },

  // ── Two-Pass Allocation Engine Fields ────────────────────────────────────
  responderType: {
    type: String,
    enum: ['resident', 'mobile'],
    default: 'resident',
    index: true,
  },
  hubId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', default: null }, // Resident's fixed hub
  currentLoad: { type: Number, default: 0 },   // Current active assignment count
  maxLoad: { type: Number, default: 3 },        // Max concurrent assignments
  transportClass: {
    type: String,
    enum: ['foot', 'bike', 'car', 'truck', 'helicopter'],
    default: 'car',
  },
  eta: { type: Number, default: null },
  performanceScore: { type: Number, default: 85 },  // Used by allocationEngine Pass 2 scoring

  // Home geo coords (alternative to locationId.lat/lng for coordResolver fallback)
  homeGeo: {
    lat: { type: Number, default: null },
    lng: { type: Number, default: null }
  },
  
  // ── Semantic Orchestration — RAG / Vector Search ─────────────────────────
  semanticProfile: { type: String, default: '' }, // Flattened capability bio for embedding
  embedding: { 
    type: [Number], 
    default: [],
    select: false // Avoid pulling large vector arrays in every query unless needed
  },
  lastEmbeddedAt: { type: Date, default: null },

  // ── Live GPS Location (Volunteer-reported via browser Geolocation API) ─────
  // Separate from locationId (admin-assigned hub). Updated when volunteer taps
  // "Share Location" or auto-updates while en_route/on_site.
  liveLocation: {
    lat:       { type: Number, default: null },
    lng:       { type: Number, default: null },
    accuracy:  { type: Number, default: null }, // metres, from browser Geolocation API
    updatedAt: { type: Date,   default: null }  // timestamp of last share
  }
});

module.exports = mongoose.model('Volunteer', volunteerSchema);
