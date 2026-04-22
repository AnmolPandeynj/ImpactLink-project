require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const Volunteer = require('../models/Volunteer');
const Location = require('../models/Location');
const Project = require('../models/Project');

const NAMES = [
  'Rahul Sharma', 'Priya Singh', 'Amit Patel', 'Sneha Gupta', 'Vikram Mehta',
  'Anjali Verma', 'Karan Johar', 'Deepa Reddy', 'Siddharth Iyer', 'Priyanka Nair',
  'Rohan Mehra', 'Ishani Roy', 'Vivek Das', 'Sanya Mishra', 'Arjun Kapoor',
  'Meera Joshi', 'Sahil Khan', 'Tanya Bhatia', 'Varun Gill', 'Riya Bansal'
];

const SKILLS_POOL = [
  'First Aid', 'Logistics', 'Medical (Doctor)', 'Search & Rescue', 
  'Technical Support', 'Counseling', 'Language Translation', 
  'Driving (Heavy Vehicles)', 'Water Sanitation', 'Community Outreach'
];

const HUBS = [
  { name: 'Delhi NCR Hub', lat: 28.6139, lng: 77.2090 },
  { name: 'Mumbai Slum Response', lat: 19.0760, lng: 72.8777 },
  { name: 'Bangalore Tech Logistics', lat: 12.9716, lng: 77.5946 },
  { name: 'Wayanad Relief Center', lat: 11.6050, lng: 76.0828 },
  { name: 'Guwahati Flood Response', lat: 26.1445, lng: 91.7362 }
];

async function feedGlobalVolunteers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB.');

    await Volunteer.deleteMany({});
    console.log('🗑️  Cleared existing responders.');

    const globalProject = await Project.findOne({ scope: 'Global' });
    const projectIds = globalProject ? [globalProject._id] : [];

    console.log('🚀 Procedurally Generating GLOBAL Volunteer Force (50 Responders)...');

    const volunteerDocs = [];
    
    // Create Hub Locations if they don't exist
    const locationIds = [];
    const hubs = [];
    for (const hub of HUBS) {
      let loc = await Location.findOne({ name: hub.name });
      if (!loc) {
        loc = await Location.create({ ...hub, type: 'District' });
      }
      locationIds.push(loc._id);
      hubs.push({ id: loc._id, lat: hub.lat, lng: hub.lng });
    }

    const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const SLOTS = ['Morning', 'Afternoon', 'Night'];
    const VEHICLES = ['None', 'Bike', 'Car', 'Truck'];
    const VEHICLE_CAPS = { 'None': 0, 'Bike': 15, 'Car': 150, 'Truck': 1200 };

    // Transport class mapping
    const TRANSPORT_CLASS_MAP = { 'None': 'foot', 'Bike': 'bike', 'Car': 'car', 'Truck': 'truck' };

    // Max load by experience level
    const MAX_LOAD_MAP = { 'Junior': 2, 'Mid-Level': 3, 'Senior': 4, 'Elite': 5 };

    // ── Responder Type Distribution ──────────────────────────────────────────
    // ~60% residents (travelRadius 20–50km, fixed to hub)
    // ~40% mobile  (travelRadius 100–500km, fleet dispatch candidates)
    const RESPONDER_CONFIGS = [
      { type: 'resident', radiusOptions: [20, 30, 50],     weight: 60 },
      { type: 'mobile',   radiusOptions: [100, 250, 500],  weight: 40 },
    ];

    function getRandomResponderType() {
      return Math.random() < 0.6 ? RESPONDER_CONFIGS[0] : RESPONDER_CONFIGS[1];
    }

    for (let i = 0; i < 50; i++) {
      const name = NAMES[i % NAMES.length] + ` ${Math.floor(i / NAMES.length) + 1}`;
      const hubIndex = Math.floor(Math.random() * locationIds.length);
      const randomHubId = locationIds[hubIndex];
      const hub = hubs[hubIndex];
      
      // Select 1-3 random skills
      const numSkills = Math.floor(Math.random() * 3) + 1;
      const skills = [...SKILLS_POOL]
        .sort(() => 0.5 - Math.random())
        .slice(0, numSkills);

      const vehicle = VEHICLES[Math.floor(Math.random() * VEHICLES.length)];
      const transportClass = TRANSPORT_CLASS_MAP[vehicle];

      const { type: responderType, radiusOptions } = getRandomResponderType();
      const travelRadius = radiusOptions[Math.floor(Math.random() * radiusOptions.length)];

      const experienceLevel = ['Junior', 'Mid-Level', 'Senior', 'Elite'][Math.floor(Math.random() * 4)];
      const maxLoad = MAX_LOAD_MAP[experienceLevel];

      volunteerDocs.push({
        name,
        status: ['Active', 'Deployed', 'Active'][Math.floor(Math.random() * 3)],
        locationId: randomHubId,
        skills,
        contactPhone: `+91 ${Math.floor(6000000000 + Math.random() * 3999999999)}`,
        projectIds: projectIds,
        lastActive: new Date(Date.now() - Math.random() * 10 * 24 * 60 * 60 * 1000),
        
        // Performance Data
        performanceScore: Math.floor(75 + Math.random() * 24),
        missionsCompleted: Math.floor(Math.random() * 30),
        completionRate: Math.floor(85 + Math.random() * 15),
        noShowCount: Math.floor(Math.random() * Math.random() * 4), // Weighted towards 0
        experienceLevel,

        // Mobility
        travelRadius,

        // Availability
        availability: {
          days: DAYS.filter(() => Math.random() > 0.3),
          timeSlots: SLOTS.filter(() => Math.random() > 0.4),
          projectDuration: ['Short-term', 'Medium-term', 'Long-term'][Math.floor(Math.random() * 3)]
        },

        // Logistics
        logistics: {
          vehicle,
          supplyCapacity: VEHICLE_CAPS[vehicle] + Math.floor(Math.random() * 20)
        },

        // ── Two-Pass Allocation Engine Fields ─────────────────────────────
        responderType,
        hubId: randomHubId,
        currentLoad: 0,
        maxLoad,
        transportClass,
        eta: null,
      });
    }

    await Volunteer.insertMany(volunteerDocs);

    const residentCount = volunteerDocs.filter(v => v.responderType === 'resident').length;
    const mobileCount = volunteerDocs.filter(v => v.responderType === 'mobile').length;

    console.log(`\n🎉 Successfully commissioned 50 elite responders across ${HUBS.length} national hubs.`);
    console.log(`   🏠 Residents (fixed-node): ${residentCount}`);
    console.log(`   🚁 Mobile (fleet dispatch): ${mobileCount}`);
    console.log(`\n📋 Next steps:`);
    console.log(`   1. Run migration if needed: node scripts/migrate_allocation_fields.js`);
    console.log(`   2. Use POST /api/allocate to run the two-pass engine`);
  } catch (error) {
    console.error('❌ Feeding failed:', error);
  } finally {
    process.exit(0);
  }
}

feedGlobalVolunteers();
