/**
 * ImpactLink Schema Migration: Allocation Fields
 *
 * Backfills existing Events and Volunteers with the new allocation engine fields.
 * Safe to run multiple times (idempotent - only updates docs missing the fields).
 *
 * Run: node backend/scripts/migrate_allocation_fields.js
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const Event = require('../models/Event');
const Volunteer = require('../models/Volunteer');

async function migrate() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB.');

  // ── Migrate Events ─────────────────────────────────────────────────────────
  console.log('\n📋 Migrating Events...');
  const eventResult = await Event.updateMany(
    { allocationStatus: { $exists: false } },
    {
      $set: {
        allocationStatus: 'unassigned',
        saturationRate: 0,
        assignedResponders: [],
        resourceGapMet: 0,
        urgencyWindow: 24,
        lastSeverityChange: null,
      },
    }
  );
  console.log(`   ↳ Updated ${eventResult.modifiedCount} events with default allocation fields.`);

  // ── Migrate Volunteers ─────────────────────────────────────────────────────
  console.log('\n👥 Migrating Volunteers...');
  const volunteers = await Volunteer.find({
    $or: [{ responderType: { $exists: false } }, { maxLoad: { $exists: false } }],
  });

  let volUpdated = 0;
  for (const vol of volunteers) {
    const travelRadius = vol.travelRadius || 50;
    const vehicle = vol.logistics?.vehicle || 'None';

    // Classify responder type by travel radius
    const responderType = travelRadius <= 50 ? 'resident' : 'mobile';

    // Derive transport class from vehicle
    const transportClassMap = {
      None: 'foot',
      Bike: 'bike',
      Car: 'car',
      Truck: 'truck',
    };
    const transportClass = transportClassMap[vehicle] || 'car';

    // Max load by experience level
    const maxLoadMap = {
      Junior:    2,
      'Mid-Level': 3,
      Senior:    4,
      Elite:     5,
    };
    const maxLoad = maxLoadMap[vol.experienceLevel] || 3;

    await Volunteer.updateOne(
      { _id: vol._id },
      {
        $set: {
          responderType,
          hubId: vol.locationId,
          currentLoad: 0,
          maxLoad,
          transportClass,
          ...(vol.eta === undefined ? { eta: null } : {}),
        },
      }
    );
    volUpdated++;
  }

  console.log(`   ↳ Updated ${volUpdated} volunteers with allocation engine fields.`);
  console.log(`   ↳ Residents (radius ≤50km): ${volunteers.filter(v => (v.travelRadius || 50) <= 50).length}`);
  console.log(`   ↳ Mobile units (radius >50km): ${volunteers.filter(v => (v.travelRadius || 50) > 50).length}`);

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n✅ Migration complete.');
  console.log('   Next: node backend/scripts/global_feed_volunteers.js to re-seed responders with new fields.');
  process.exit(0);
}

migrate().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
