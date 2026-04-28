const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/.env.production' });
if (!process.env.MONGODB_URI) require('dotenv').config({ path: __dirname + '/.env' });

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const Event = mongoose.model('Event', new mongoose.Schema({}, {strict: false}));
  const evs = await Event.find({projectId: '69f067c2189d4c888afb4955'});
  console.log('Events in test 7:', evs.length);
  evs.forEach(e => console.log(e._id, e.eventType, e.allocationStatus, e.saturationRate, e.assignedResponders));
  
  process.exit(0);
}).catch(console.error);
