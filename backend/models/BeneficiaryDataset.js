const mongoose = require('mongoose');

const BeneficiaryDatasetSchema = new mongoose.Schema({
  // Identity
  name:         { type: String, required: true },
  description:  { type: String },
  uploadedBy:   { type: String, required: true },      // Firebase uid
  orgId:        { type: String },                       // optional org scope

  // Source file metadata (original upload preserved for re-ingestion)
  sourceFile: {
    originalName:  { type: String },
    storagePath:   { type: String },                   // local path for now
    mimeType:      { type: String },
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

module.exports = mongoose.model('BeneficiaryDataset', BeneficiaryDatasetSchema);
