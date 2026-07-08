const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Razorpay = require('razorpay');
const { Order, Car } = require('../models/schemas');

// Initialize Razorpay
let razorpayInstance = null;
const isRazorpayConfigured = 
  process.env.RAZORPAY_KEY_ID && 
  process.env.RAZORPAY_KEY_SECRET && 
  !process.env.RAZORPAY_KEY_ID.includes('dummy') && 
  !process.env.RAZORPAY_KEY_SECRET.includes('dummy');

if (isRazorpayConfigured) {
  try {
    razorpayInstance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
    console.log('💳 Razorpay initialized successfully.');
  } catch (err) {
    console.error('❌ Failed to initialize Razorpay instance:', err.message);
  }
} else {
  console.log('⚠️  Razorpay API keys not configured or using dummy values. Running payment in simulation mode.');
}

// 1. Create order on backend
router.post('/', async (req, res) => {
  try {
    const { customerName, customerAddress, customerPhone, items } = req.body;

    if (!customerName || !customerAddress || !customerPhone || !items || items.length === 0) {
      return res.status(400).json({ error: 'Missing required order details' });
    }

    // Calculate total amount based on database car prices to ensure integrity
    let calculatedTotal = 0;
    const validatedItems = [];

    for (const item of items) {
      const car = await Car.findById(item.carId);
      if (!car) {
        return res.status(400).json({ error: `Car with ID ${item.carId} not found` });
      }
      const itemPriceINR = car.price * 85000;
      calculatedTotal += itemPriceINR * item.quantity;
      validatedItems.push({
        carId: car.id,
        name: car.name,
        price: itemPriceINR,
        quantity: item.quantity,
        image: car.image
      });
    }

    const internalOrderId = `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    let rzpOrder = null;
    let isSimulated = true;

    if (isRazorpayConfigured && razorpayInstance) {
      try {
        // Razorpay accepts amount in paise (1 INR = 100 paise)
        const options = {
          amount: calculatedTotal * 100, 
          currency: 'INR',
          receipt: internalOrderId,
        };
        rzpOrder = await razorpayInstance.orders.create(options);
        isSimulated = false;
      } catch (err) {
        console.warn('⚠️ Razorpay order creation failed, falling back to simulation:', err.message);
      }
    }

    // If Razorpay key is missing or call failed, generate mock razorpay order info
    const razorpayOrderId = rzpOrder ? rzpOrder.id : `rzp_order_${Math.random().toString(36).substring(2, 11)}`;

    const estimatedDelivery = new Date();
    estimatedDelivery.setDate(estimatedDelivery.getDate() + 4); // 4 days delivery standard

    const newOrder = await Order.create({
      orderId: internalOrderId,
      razorpayOrderId,
      customerName,
      customerAddress,
      customerPhone,
      items: validatedItems,
      totalAmount: calculatedTotal,
      status: 'Pending',
      paymentStatus: 'Unpaid',
      createdAt: new Date(),
      estimatedDelivery
    });

    res.status(201).json({
      order: newOrder,
      razorpayKeyId: isSimulated ? 'rzp_test_simulation' : process.env.RAZORPAY_KEY_ID,
      isSimulated
    });

  } catch (err) {
    console.error('Error creating order:', err);
    res.status(500).json({ error: 'Server error during order creation' });
  }
});

// 2. Verify payment signature on backend
router.post('/verify', async (req, res) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, isSimulated } = req.body;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({ error: 'Missing payment details' });
    }

    let isValid = false;

    if (isSimulated || !isRazorpayConfigured) {
      // Mock validation for simulation mode: check signature conforms to mock format
      const expectedMockSig = `simulated_sig_${razorpayOrderId}_${razorpayPaymentId}`;
      isValid = (razorpaySignature === expectedMockSig);
    } else {
      // Real signature verification using HMAC SHA256
      const secret = process.env.RAZORPAY_KEY_SECRET;
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(razorpayOrderId + "|" + razorpayPaymentId);
      const generatedSignature = hmac.digest('hex');
      isValid = (generatedSignature === razorpaySignature);
    }

    if (!isValid) {
      return res.status(400).json({ error: 'Invalid payment signature. Verification failed.' });
    }

    // Update order in database
    const updatedOrder = await Order.findOneAndUpdate(
      { razorpayOrderId: razorpayOrderId },
      { 
        $set: {
          razorpayPaymentId,
          razorpaySignature,
          status: 'Confirmed',
          paymentStatus: 'Paid'
        }
      }
    );

    if (!updatedOrder) {
      return res.status(404).json({ error: 'Order not found for verification' });
    }

    res.json({
      success: true,
      message: 'Payment verified successfully',
      order: updatedOrder
    });

  } catch (err) {
    console.error('Error verifying payment:', err);
    res.status(500).json({ error: 'Server error during payment verification' });
  }
});

// 3. Get order by Order ID or Razorpay Order ID
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    // Check both local orderId and razorpayOrderId
    let order = await Order.findOne({ orderId: id });
    if (!order) {
      order = await Order.findOne({ razorpayOrderId: id });
    }

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(order);
  } catch (err) {
    console.error(`Error retrieving order ${req.params.id}:`, err);
    res.status(500).json({ error: 'Server error retrieving order details' });
  }
});

module.exports = router;
