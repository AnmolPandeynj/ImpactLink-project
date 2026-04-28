
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { runAllocation } = require('./services/allocationEngine');
// Register models
require('./models/Project');
require('./models/Location');
require('./models/Event');
require('./models/Volunteer');
require('./models/AuditLog');

const path = require('path');
dotenv.config({ path: path.join(__dirname, '.env') });

async function test() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected.');

    console.log('Running allocation...');
    const result = await runAllocation(null); // Global run
    console.log('Result:', JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
}

test();
