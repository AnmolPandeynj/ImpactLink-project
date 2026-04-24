const mongoose = require('mongoose');

const supplyItemSchema = new mongoose.Schema({
  type: { type: String, required: true },
  unit: { type: String, default: 'units' },
  targetQuantity: { type: Number, default: 0 }
});

const supplyCategorySchema = new mongoose.Schema({
  category: { type: String, required: true }, // e.g., 'Food', 'Medical'
  items: [supplyItemSchema]
});

const phaseSchema = new mongoose.Schema({
  name: { type: String, required: true },
  durationDays: { type: Number, required: true }
});

const projectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  scope: { type: String, enum: ['City', 'District', 'State', 'Global', 'Custom'], default: 'District' },
  
  // Geographic Intelligence (Multi-Region Support)
  regions: [{
    center: {
      lat: { type: Number },
      lng: { type: Number }
    },
    radius: { type: Number, default: 50 }, // in km
    name: { type: String }
  }],

  // Temporal Planning
  timeline: {
    startDate: { type: Date },
    endDate: { type: Date },
    phases: [phaseSchema]
  },

  // Human Capital Targets
  volunteerTargets: {
    total: { type: Number, default: 0 },
    local: { type: Number, default: 0 },
    travel: { type: Number, default: 0 },
    requiredSkills: [{ type: String }]
  },

  // Resource Architecture (Hierarchical)
  hierarchicalSupplies: [supplyCategorySchema],
  
  // Operational Modes
  operatingMode: { 
    type: String, 
    enum: ['manual', 'assisted', 'autopilot'], 
    default: 'manual' 
  },

  allocationStrategy: {
    type: String,
    enum: ['ai', 'manual'],
    default: 'ai'
  },

  assignedRoster: [{
    volunteerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Volunteer' },
    regionIndex: { type: Number },
    type: { type: String, enum: ['local', 'travel'] }
  }],

  // Beneficiary Intelligence (Impact Scope)
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
  },

  // Mission Metadata
  metadata: {
    priority: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], default: 'Medium' },
    beneficiaryType: { type: String },
    approvalWorkflow: { type: String, default: 'Standard' },
    notificationMethod: { type: String, default: 'Email+App' }
  },

  createdAt: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true }
});

module.exports = mongoose.model('Project', projectSchema);
