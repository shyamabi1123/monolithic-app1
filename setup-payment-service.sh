#!/bin/bash
# ============================================================
#  Payment Microservice - Full Setup Script (Razorpay + Node.js)
#  Run: bash setup-payment-service.sh
# ============================================================

set -e
echo "=========================================="
echo "  Setting up Payment Microservice..."
echo "=========================================="

# ---------- 1. Directory Structure ----------
mkdir -p payment-service/src/{models,controllers,routes}
cd payment-service
echo "[1/7] Directory structure created."

# ---------- 2. package.json ----------
cat > package.json << 'EOF'
{
  "name": "payment-service",
  "version": "1.0.0",
  "description": "Open-source payment microservice using Razorpay",
  "main": "src/app.js",
  "scripts": {
    "start": "node src/app.js",
    "dev": "nodemon src/app.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "razorpay": "^2.9.2",
    "sequelize": "^6.35.0",
    "pg": "^8.11.3",
    "pg-hstore": "^2.3.4",
    "dotenv": "^16.3.1",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
EOF
echo "[2/7] package.json created."

# ---------- 3. .env ----------
cat > .env << 'EOF'
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=yourpassword
DB_NAME=payments_db
PORT=4000
EOF
echo "[3/7] .env created."

# ---------- 4. Payment Model ----------
cat > src/models/Payment.js << 'EOF'
require('dotenv').config();
const { DataTypes, Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host:    process.env.DB_HOST,
    port:    process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false,
  }
);

const Payment = sequelize.define('Payment', {
  id: {
    type:          DataTypes.UUID,
    defaultValue:  DataTypes.UUIDV4,
    primaryKey:    true,
  },
  orderId: {
    type:      DataTypes.STRING,
    allowNull: false,
    comment:   'Order ID from main app',
  },
  razorpayOrderId: {
    type: DataTypes.STRING,
    comment: 'Order ID returned by Razorpay',
  },
  razorpayPaymentId: {
    type: DataTypes.STRING,
    comment: 'Payment ID after successful payment',
  },
  razorpaySignature: {
    type: DataTypes.STRING,
    comment: 'Signature for verification',
  },
  amount: {
    type:      DataTypes.INTEGER,
    allowNull: false,
    comment:   'Amount in paise (₹1 = 100 paise)',
  },
  currency: {
    type:         DataTypes.STRING,
    defaultValue: 'INR',
  },
  status: {
    type:         DataTypes.ENUM('created', 'paid', 'failed', 'refunded'),
    defaultValue: 'created',
  },
  userId: {
    type: DataTypes.INTEGER,
    comment: 'User ID from main app',
  },
  notes: {
    type: DataTypes.JSONB,
    comment: 'Extra metadata',
  },
}, {
  timestamps: true,
});

module.exports = { Payment, sequelize };
EOF
echo "[4/7] Payment model created."

# ---------- 5. Payment Controller ----------
cat > src/controllers/paymentController.js << 'EOF'
require('dotenv').config();
const Razorpay     = require('razorpay');
const crypto       = require('crypto');
const { Payment }  = require('../models/Payment');

// Init Razorpay instance
const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ─── POST /api/payments/create-order ──────────────────────
// Call this from main app when user clicks "Pay Now"
exports.createOrder = async (req, res) => {
  const { amount, userId, orderId, notes } = req.body;

  if (!amount || !orderId) {
    return res.status(400).json({ success: false, message: 'amount and orderId are required' });
  }

  try {
    const options = {
      amount:   Math.round(amount * 100), // ₹ → paise
      currency: 'INR',
      receipt:  `receipt_${orderId}`,
      notes:    notes || {},
    };

    const razorpayOrder = await razorpay.orders.create(options);

    const payment = await Payment.create({
      orderId,
      razorpayOrderId: razorpayOrder.id,
      amount:          options.amount,
      currency:        options.currency,
      userId:          userId || null,
      notes:           notes || {},
      status:          'created',
    });

    res.status(201).json({
      success:       true,
      payment_id:    payment.id,
      razorpayOrder,
      key_id:        process.env.RAZORPAY_KEY_ID, // needed by frontend
    });
  } catch (err) {
    console.error('createOrder error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── POST /api/payments/verify ────────────────────────────
// Call this from frontend after Razorpay popup closes
exports.verifyPayment = async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ success: false, message: 'Missing payment fields' });
  }

  try {
    // Verify HMAC signature
    const body     = razorpay_order_id + '|' + razorpay_payment_id;
    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expected !== razorpay_signature) {
      await Payment.update(
        { status: 'failed' },
        { where: { razorpayOrderId: razorpay_order_id } }
      );
      return res.status(400).json({ success: false, message: 'Payment verification failed' });
    }

    // Mark as paid
    const [updated] = await Payment.update(
      {
        status:            'paid',
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
      },
      { where: { razorpayOrderId: razorpay_order_id } }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Payment record not found' });
    }

    res.json({ success: true, message: 'Payment verified and recorded' });
  } catch (err) {
    console.error('verifyPayment error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET /api/payments/status/:orderId ────────────────────
exports.getPaymentStatus = async (req, res) => {
  try {
    const payment = await Payment.findOne({
      where: { orderId: req.params.orderId },
    });
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    res.json({ success: true, payment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET /api/payments/all ────────────────────────────────
exports.getAllPayments = async (req, res) => {
  try {
    const payments = await Payment.findAll({ order: [['createdAt', 'DESC']] });
    res.json({ success: true, count: payments.length, payments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── POST /api/payments/refund ────────────────────────────
exports.refundPayment = async (req, res) => {
  const { razorpayPaymentId, amount } = req.body;
  try {
    const refund = await razorpay.payments.refund(razorpayPaymentId, {
      amount: amount ? Math.round(amount * 100) : undefined, // partial or full
    });

    await Payment.update(
      { status: 'refunded' },
      { where: { razorpayPaymentId } }
    );

    res.json({ success: true, refund });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
EOF
echo "[5/7] Payment controller created."

# ---------- 6. Payment Routes ----------
cat > src/routes/paymentRoutes.js << 'EOF'
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/paymentController');

// Health check
router.get('/health', (req, res) => res.json({ status: 'Payment service running' }));

// Core payment routes
router.post('/create-order',         ctrl.createOrder);      // Step 1: Create order
router.post('/verify',               ctrl.verifyPayment);    // Step 2: Verify after payment
router.get( '/status/:orderId',      ctrl.getPaymentStatus); // Check payment status
router.get( '/all',                  ctrl.getAllPayments);    // List all payments
router.post('/refund',               ctrl.refundPayment);    // Initiate refund

module.exports = router;
EOF

# ---------- 7. Main App Entry ----------
cat > src/app.js << 'EOF'
require('dotenv').config();
const express           = require('express');
const cors              = require('cors');
const { sequelize }     = require('./models/Payment');
const paymentRoutes     = require('./routes/paymentRoutes');

const app  = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/payments', paymentRoutes);

// Root health
app.get('/', (req, res) => res.json({ service: 'payment-microservice', status: 'up' }));

// DB sync + start
sequelize.sync({ alter: true })
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Payment service started on port ${PORT}`);
      console.log(`Health: http://localhost:${PORT}/api/payments/health`);
    });
  })
  .catch(err => {
    console.error('DB connection failed:', err.message);
    process.exit(1);
  });
EOF
echo "[6/7] App entry point created."

# ---------- 8. Dockerfile ----------
cat > Dockerfile << 'EOF'
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 4000
CMD ["node", "src/app.js"]
EOF

# ---------- 9. Updated seed.js ----------
cat > ../seed.js << 'EOF'
require('dotenv').config();
const { User, Product, sequelize } = require('../src/models');

async function seed() {
  await sequelize.sync({ force: true });
  console.log('Tables created.');

  await User.create({
    name: 'Admin User', email: 'admin@example.com',
    password: 'password123', role: 'admin', isVerified: true
  });

  await User.create({
    name: 'Test User', email: 'user@example.com',
    password: 'password123', isVerified: true
  });

  const products = [
    { name: 'Laptop Pro 15"',     description: 'Powerful laptop for developers.',       price: 149999, stock: 10,  category: 'Electronics'  },
    { name: 'Wireless Mouse',     description: 'Ergonomic wireless mouse.',             price: 2999,   stock: 50,  category: 'Electronics'  },
    { name: 'Mechanical Keyboard',description: 'Tactile switches, RGB backlit.',        price: 7999,   stock: 25,  category: 'Electronics'  },
    { name: 'USB-C Hub',          description: '7-in-1 USB hub.',                       price: 3499,   stock: 40,  category: 'Accessories'  },
    { name: 'Monitor Stand',      description: 'Adjustable height stand.',             price: 4999,   stock: 20,  category: 'Accessories'  },
    { name: 'Notebook A5',        description: '200-page dotted notebook.',            price: 999,    stock: 100, category: 'Stationery'   },
    { name: 'Standing Desk Mat',  description: 'Anti-fatigue ergonomic mat.',          price: 2499,   stock: 30,  category: 'Accessories'  }, // ← NEW PRODUCT
  ];

  for (const p of products) await Product.create(p);

  console.log('Seed complete!');
  console.log('Admin : admin@example.com / password123');
  console.log('User  : user@example.com  / password123');
  await sequelize.close();
}

seed().catch(console.error);
EOF
echo "[7/7] seed.js updated with new product."

# ---------- Done ----------
echo ""
echo "=========================================="
echo "  DONE! Payment microservice is ready."
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. cd payment-service"
echo "  2. Edit .env → add your Razorpay keys"
echo "  3. npm install"
echo "  4. node src/app.js"
echo ""
echo "Or with Docker:"
echo "  docker build -t payment-service ."
echo "  docker run -p 4000:4000 --env-file .env payment-service"
echo ""
echo "API Endpoints:"
echo "  POST  /api/payments/create-order    → Create Razorpay order"
echo "  POST  /api/payments/verify          → Verify after payment"
echo "  GET   /api/payments/status/:orderId → Check payment status"
echo "  GET   /api/payments/all             → List all payments"
echo "  POST  /api/payments/refund          → Issue refund"
echo "  GET   /api/payments/health          → Health check"
echo ""
