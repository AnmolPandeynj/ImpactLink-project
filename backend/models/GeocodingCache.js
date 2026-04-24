const mongoose = require('mongoose');

const GeocodingCacheSchema = new mongoose.Schema({
  normalizedAddress: { type: String, required: true, unique: true, index: true },
  lat:               { type: Number, required: true },
  lng:               { type: Number, required: true },
  formattedAddress:  { type: String },
  placeId:           { type: String },
  confidenceScore:   { type: Number, min: 0, max: 1 },
  cachedAt:          { type: Date, default: Date.now }
});

// Auto-expire cache after 90 days (Google recommendations + fresh data check)
GeocodingCacheSchema.index({ cachedAt: 1 }, { expireAfterSeconds: 7776000 });

module.exports = mongoose.model('GeocodingCache', GeocodingCacheSchema);
