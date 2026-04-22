const mongoose = require('mongoose');

const volunteerSchema = new mongoose.Schema({
  projectIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Project' }], // Can span multiple campaigns
  name: { type: String, required: true },
  status: { type: String, enum: ['Active', 'Deployed', 'Inactive'], default: 'Active' },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', required: true },
  skills: [{
    type: String,
    enum: [
      'first_aid', 'medical', 'search_rescue', 'logistics',
      'communication', 'translation', 'counseling', 'driving',
      'heavy_vehicle', 'water_rescue', 'shelter_setup', 'food_distribution',
      'Medical', 'First Aid', 'Food', 'Water', 'Infrastructure', 'Shelter' // Legacy backwards compat
    ]
  }],
  contactPhone: { type: String, required: true },
  lastActive: { type: Date, default: Date.now },
  currentAssignment: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', default: null },
  
  // Tactical Performance Metrics
  performanceScore: { type: Number, default: 85 }, // 0-100%
  missionsCompleted: { type: Number, default: 0 },
  completionRate: { type: Number, default: 100 }, // % of missions finished
  noShowCount: { type: Number, default: 0 },
  experienceLevel: { 
    type: String, 
    enum: ['Junior', 'Mid-Level', 'Senior', 'Elite'], 
    default: 'Mid-Level' 
  },

  // Mobility & Location
  travelRadiusKm: { type: Number, default: 20 }, // Renaming travelRadius to travelRadiusKm or keeping both if needed. The plan adds travelRadiusKm.
  travelRadius: { type: Number, default: 50 }, // Keep legacy for compat
  
  // Availability
  availability: {
    monday:    { morning: { type: Boolean, default: false }, afternoon: { type: Boolean, default: false }, night: { type: Boolean, default: false } },
    tuesday:   { morning: { type: Boolean, default: false }, afternoon: { type: Boolean, default: false }, night: { type: Boolean, default: false } },
    wednesday: { morning: { type: Boolean, default: false }, afternoon: { type: Boolean, default: false }, night: { type: Boolean, default: false } },
    thursday:  { morning: { type: Boolean, default: false }, afternoon: { type: Boolean, default: false }, night: { type: Boolean, default: false } },
    friday:    { morning: { type: Boolean, default: false }, afternoon: { type: Boolean, default: false }, night: { type: Boolean, default: false } },
    saturday:  { morning: { type: Boolean, default: false }, afternoon: { type: Boolean, default: false }, night: { type: Boolean, default: false } },
    sunday:    { morning: { type: Boolean, default: false }, afternoon: { type: Boolean, default: false }, night: { type: Boolean, default: false } },
  },

  // Transport
  vehicleType: {
    type: String,
    enum: ['none', 'motorcycle', 'car', 'suv', 'van', 'truck', 'boat', 'None', 'Bike', 'Car', 'Truck'], // Includes legacy values
    default: 'none'
  },
  vehicleCapacity: { type: Number, default: 0 },   // payload in kg
  
  // Logistics (Legacy wrapper)
  logistics: {
    vehicle: { type: String, enum: ['None', 'Bike', 'Car', 'Truck'], default: 'None' },
    supplyCapacity: { type: Number, default: 0 } // kg
  },

  // ── Two-Pass Allocation Engine Fields ────────────────────────────────────
  responderType: {
    type: String,
    enum: ['resident', 'mobile'],
    default: 'resident',
    index: true,
  },
  hubId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', default: null }, // Resident's fixed hub
  currentLoad: { type: Number, default: 0 },   // Current active assignment count
  maxLoad: { type: Number, default: 3 },        // Max concurrent assignments (set by experienceLevel)
  transportClass: {
    type: String,
    enum: ['foot', 'bike', 'car', 'truck', 'helicopter'],
    default: 'car',
  },
  eta: { type: Number, default: null },         // Predicted ETA in hours (populated at dispatch time)
  
  // Tactical Performance Metrics additions
  totalMissionsCompleted: { type: Number, default: 0 },
  lastRating: { type: Number, min: 1, max: 5, default: null },

  // Emergency contact
  emergencyContact: {
    name: String,
    phone: String,
    relation: String
  },

  // Assignment tracking expanded
  currentAssignmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event', // Using Event assuming it's the mission model
    default: null
  },
  assignmentStatus: {
    type: String,
    enum: ['unassigned', 'pending_accept', 'accepted', 'en_route', 'on_site', 'completed'],
    default: 'unassigned'
  },
  assignmentAcceptedAt: { type: Date, default: null },
  volunteerCode: { type: String, index: { unique: true, partialFilterExpression: { volunteerCode: { $type: "string" } } } } // Sparse unique index
});

module.exports = mongoose.model('Volunteer', volunteerSchema);
