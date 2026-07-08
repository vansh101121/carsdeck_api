const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { getDbStatus } = require('../config/db');

// --- MONGOOSE SCHEMAS ---
const CarSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  brand: { type: String, required: true },
  year: { type: Number, required: true },
  fuelType: { type: String, required: true },
  price: { type: Number, required: true },
  originalPrice: { type: Number },
  category: { type: String },
  rating: { type: Number },
  reviewsCount: { type: Number },
  image: { type: String, required: true },
  specs: { type: Map, of: String },
  description: { type: String },
  colors: [String]
});

const OrderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  razorpayOrderId: { type: String },
  razorpayPaymentId: { type: String },
  razorpaySignature: { type: String },
  customerName: { type: String, required: true },
  customerAddress: { type: String, required: true },
  customerPhone: { type: String, required: true },
  items: [{
    carId: { type: String, required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, default: 1 },
    image: { type: String }
  }],
  totalAmount: { type: Number, required: true },
  status: { type: String, default: 'Pending' },
  paymentStatus: { type: String, default: 'Unpaid' },
  createdAt: { type: Date, default: Date.now },
  estimatedDelivery: { type: Date }
});

const MongooseCar = mongoose.models.Car || mongoose.model('Car', CarSchema);
const MongooseOrder = mongoose.models.Order || mongoose.model('Order', OrderSchema);

// --- JSON FALLBACK DATA STORAGE ---
const getJSONData = () => {
  const { storePath } = getDbStatus();
  if (!fs.existsSync(storePath)) {
    const sampleCars = require('../data/sampleCars');
    const dir = path.dirname(storePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(storePath, JSON.stringify({ cars: sampleCars, orders: [] }, null, 2));
  }
  return JSON.parse(fs.readFileSync(storePath, 'utf8'));
};

const saveJSONData = (data) => {
  const { storePath } = getDbStatus();
  fs.writeFileSync(storePath, JSON.stringify(data, null, 2));
};

// --- DATA ACCESS LAYER WRAPPER ---
const Car = {
  find: async (query = {}) => {
    const { isFallback } = getDbStatus();
    if (!isFallback) {
      try {
        // Seed database if empty in MongoDB
        const count = await MongooseCar.countDocuments();
        if (count === 0) {
          const sampleCars = require('../data/sampleCars');
          await MongooseCar.insertMany(sampleCars);
          console.log('✅ Seeded sample cars to MongoDB.');
        }
        return await MongooseCar.find(query);
      } catch (err) {
        console.error('Error querying MongoDB, reading fallback JSON store:', err);
      }
    }
    const data = getJSONData();
    let results = data.cars;
    if (query.category) {
      results = results.filter(c => c.category.toLowerCase() === query.category.toLowerCase());
    }
    return results;
  },

  findOne: async (query) => {
    const { isFallback } = getDbStatus();
    if (!isFallback) {
      try {
        return await MongooseCar.findOne(query);
      } catch (err) {
        console.error('Error querying MongoDB, reading fallback JSON store:', err);
      }
    }
    const data = getJSONData();
    const key = Object.keys(query)[0];
    const val = query[key];
    return data.cars.find(c => c[key] === val) || null;
  },

  findById: async (id) => {
    const { isFallback } = getDbStatus();
    if (!isFallback) {
      try {
        return await MongooseCar.findOne({ id: id });
      } catch (err) {
        console.error('Error querying MongoDB, reading fallback JSON store:', err);
      }
    }
    const data = getJSONData();
    return data.cars.find(c => c.id === id) || null;
  }
};

const Order = {
  create: async (orderData) => {
    const { isFallback } = getDbStatus();
    if (!isFallback) {
      try {
        return await MongooseOrder.create(orderData);
      } catch (err) {
        console.error('Error creating in MongoDB, falling back to JSON store:', err);
      }
    }
    const data = getJSONData();
    const newOrder = {
      ...orderData,
      createdAt: orderData.createdAt || new Date(),
      status: orderData.status || 'Pending',
      paymentStatus: orderData.paymentStatus || 'Unpaid'
    };
    data.orders.push(newOrder);
    saveJSONData(data);
    return newOrder;
  },

  findOne: async (query) => {
    const { isFallback } = getDbStatus();
    if (!isFallback) {
      try {
        return await MongooseOrder.findOne(query);
      } catch (err) {
        console.error('Error querying MongoDB orders, falling back to JSON store:', err);
      }
    }
    const data = getJSONData();
    const key = Object.keys(query)[0];
    const val = query[key];
    return data.orders.find(o => o[key] === val) || null;
  },

  findOneAndUpdate: async (query, updateData) => {
    const { isFallback } = getDbStatus();
    if (!isFallback) {
      try {
        return await MongooseOrder.findOneAndUpdate(query, updateData, { new: true });
      } catch (err) {
        console.error('Error updating in MongoDB, falling back to JSON store:', err);
      }
    }
    const data = getJSONData();
    const key = Object.keys(query)[0];
    const val = query[key];
    const index = data.orders.findIndex(o => o[key] === val);
    if (index === -1) return null;

    const updates = updateData.$set ? updateData.$set : updateData;
    data.orders[index] = { ...data.orders[index], ...updates };
    saveJSONData(data);
    return data.orders[index];
  }
};

module.exports = {
  Car,
  Order,
  MongooseCar,
  MongooseOrder
};
