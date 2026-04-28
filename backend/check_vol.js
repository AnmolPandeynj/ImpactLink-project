const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/.env.production' });
if (!process.env.MONGODB_URI) require('dotenv').config({ path: __dirname + '/.env' });

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const Volunteer = mongoose.model('Volunteer', new mongoose.Schema({}, {strict: false}));
  const Event = mongoose.model('Event', new mongoose.Schema({}, {strict: false}));
  
  const vol = await Volunteer.findOne({name: /Amit Patel 3/i});
  console.log('Volunteer:', vol);
  
  const vols = await Volunteer.find({ 'currentAssignmentId': { $ne: null } });
  console.log('\nVolunteers with assignment:', vols.length);
  vols.forEach(v => console.log(v.name, v.currentAssignmentId, v.assignmentStatus));
  
  const projects = await mongoose.model('Project', new mongoose.Schema({}, {strict: false})).find({name: 'test 7'});
  console.log('\nProject test 7:', projects);

  process.exit(0);
}).catch(console.error);
