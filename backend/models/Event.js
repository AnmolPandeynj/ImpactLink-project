const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null }, // Nullable for global/legacy events
  beneficiaryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Beneficiary', default: null }, // Nullable for general area events
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', default: null },
  eventType: { type: String, default: 'General' }, // e.g. "Health Check", "Relief Delivery", "Utility Failure"
  severity: { type: Number, required: true, min: 1, max: 10 },
  resourceGap: { type: Number, required: true, min: 1, max: 10 },
  frequency: { type: Number, required: true, min: 1, max: 10 },
  timeSensitivity: { type: Number, required: true, min: 1, max: 10 },
  eventTime: { type: Date, default: Date.now },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  notes: { type: String },

  // ── Two-Pass Allocation Engine Fields ────────────────────────────────────
  allocationStatus: {
    type: String,
    enum: ['unassigned', 'partially_saturated', 'saturated', 'critical_unmet'],
    default: 'unassigned',
    index: true,
  },
  saturationRate: { type: Number, default: 0, min: 0, max: 1 },      // 0.0–1.0 (% of resource gap filled)
  assignedResponders: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Volunteer' }],
  resourceGapMet: { type: Number, default: 0 },                        // Units filled (absolute)
  lastSeverityChange: { type: Date, default: null },                   // Used for spike detection in Pass 2
  urgencyWindow: { type: Number, default: 24 },                        // Hours before critical escalation
});

// Spatial index for clustering and radius searches
eventSchema.index({ lat: 1, lng: 1 });
eventSchema.index({ eventTime: -1 });

module.exports = mongoose.model('Event', eventSchema);
