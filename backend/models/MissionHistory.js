const mongoose = require('mongoose');

const MissionHistorySchema = new mongoose.Schema({
  volunteerId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Volunteer', required: true, index: true },
  missionId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Event' }, // The dashboard plan says 'StrategicMission' but in db it's 'Event'
  allocationId:  { type: String }, // Optional/for future since there is no ResourceAllocation model referenced elsewhere
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

module.exports = mongoose.model('MissionHistory', MissionHistorySchema);
