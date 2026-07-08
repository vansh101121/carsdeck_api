const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

let isFallback = false;
const storePath = path.join(__dirname, '../data/db_store.json');

const connectDB = async () => {
  try {
    mongoose.set('strictQuery', false);
    // Set a short timeout so it fails quickly if MongoDB isn't running
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/carshop', {
      serverSelectionTimeoutMS: 2000,
    });
    console.log('✅ MongoDB connected successfully.');
    isFallback = false;
  } catch (err) {
    console.warn('\n⚠️  =========================================');
    console.warn('⚠️  MongoDB Connection Failed!');
    console.warn('⚠️  Falling back to In-Memory/JSON File Database');
    console.warn(`⚠️  Store Path: ${storePath}`);
    console.warn('⚠️  =========================================\n');
    isFallback = true;
    initializeJSONDb();
  }
};

const initializeJSONDb = () => {
  const dir = path.dirname(storePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(storePath)) {
    const sampleCars = require('../data/sampleCars');
    fs.writeFileSync(storePath, JSON.stringify({ cars: sampleCars, orders: [] }, null, 2));
    console.log('📁 Initialized local JSON database store with sample cars.');
  }
};

const getDbStatus = () => ({
  isFallback,
  storePath,
});

module.exports = { connectDB, getDbStatus };
