const mongoose = require('mongoose');

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
    assignedZoneId:  { type: String },    // which zone (regionIndex/name) this beneficiary belongs to
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

module.exports = mongoose.model('Beneficiary', BeneficiarySchema);
