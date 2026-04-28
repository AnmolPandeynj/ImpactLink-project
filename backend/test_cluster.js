const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/.env.production' });
if (!process.env.MONGODB_URI) require('dotenv').config({ path: __dirname + '/.env' });

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const Beneficiary = mongoose.model('Beneficiary', new mongoose.Schema({}, {strict: false}));
  
  const allBens = await Beneficiary.find({}).lean();
  console.log(`Found ${allBens.length} total beneficiaries in DB.`);
  if (allBens.length > 0) {
     console.log('First beneficiary:', JSON.stringify(allBens[0], null, 2));
  }

  process.exit(0);
}).catch(console.error);
