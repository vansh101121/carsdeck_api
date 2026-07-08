const express = require('express');
const router = express.Router();
const { Car } = require('../models/schemas');

// Get all cars (optional category filter)
router.get('/', async (req, res) => {
  try {
    const { category } = req.query;
    const query = {};
    if (category && category !== 'All') {
      query.category = category;
    }
    const cars = await Car.find(query);
    res.json(cars);
  } catch (err) {
    console.error('Error fetching cars:', err);
    res.status(500).json({ error: 'Server error fetching cars' });
  }
});

// Get car by ID
router.get('/:id', async (req, res) => {
  try {
    const car = await Car.findById(req.params.id);
    if (!car) {
      return res.status(404).json({ error: 'Car not found' });
    }
    res.json(car);
  } catch (err) {
    console.error(`Error fetching car ${req.params.id}:`, err);
    res.status(500).json({ error: 'Server error fetching car details' });
  }
});

module.exports = router;
