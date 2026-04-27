const { Order, OrderItem, Product, User } = require('../../models');
const { createPaymentIntent } = require('../../services/paymentService');
const { sendOrderConfirmation } = require('../../services/emailService');
const logger = require('../../config/logger');

// Cart helpers (stored in session)
function getCart(req) { return req.session.cart || []; }
function saveCart(req, cart) { req.session.cart = cart; }

// GET /cart
function showCart(req, res) {
  const cart = getCart(req);
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  res.render('pages/cart', { title: 'Your Cart', cart, total });
}

// POST /cart/add
async function addToCart(req, res) {
  try {
    const product = await Product.findByPk(req.body.productId);
    if (!product || product.stock < 1) {
      req.flash('error', 'Product unavailable.');
      return res.redirect('/products');
    }
    const cart = getCart(req);
    const existing = cart.find(i => i.productId === product.id);
    if (existing) {
      existing.quantity = Math.min(existing.quantity + 1, product.stock);
    } else {
      cart.push({ productId: product.id, name: product.name, price: product.price, quantity: 1, image: product.image });
    }
    saveCart(req, cart);
    req.flash('success', `${product.name} added to cart.`);
    res.redirect('/products');
  } catch (err) {
    logger.error('Add to cart error:', err);
    res.redirect('/products');
  }
}

// POST /cart/remove
function removeFromCart(req, res) {
  const cart = getCart(req).filter(i => i.productId !== req.body.productId);
  saveCart(req, cart);
  res.redirect('/cart');
}

// POST /cart/update
function updateCart(req, res) {
  const cart = getCart(req).map(item => {
    if (item.productId === req.body.productId) {
      item.quantity = Math.max(1, parseInt(req.body.quantity) || 1);
    }
    return item;
  });
  saveCart(req, cart);
  res.redirect('/cart');
}

// GET /checkout
async function showCheckout(req, res) {
  const cart = getCart(req);
  if (!cart.length) return res.redirect('/cart');
  const total = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  try {
    const intent = await createPaymentIntent(total, 'usd', { userId: req.session.user.id });
    res.render('pages/checkout', {
      title: 'Checkout',
      cart, total,
      clientSecret: intent.client_secret,
      stripeKey: process.env.STRIPE_PUBLIC_KEY || 'pk_test_placeholder'
    });
  } catch (err) {
    logger.error('Checkout error:', err);
    req.flash('error', 'Could not initiate checkout. Try again.');
    res.redirect('/cart');
  }
}

// POST /checkout/complete
async function completeOrder(req, res) {
  const cart = getCart(req);
  if (!cart.length) return res.redirect('/cart');
  try {
    const total = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const { paymentIntentId, address } = req.body;

    const order = await Order.create({
      userId: req.session.user.id,
      status: 'paid',
      total,
      stripePaymentId: paymentIntentId,
      shippingAddress: JSON.parse(address || '{}')
    });

    // Create order items + decrement stock
    await Promise.all(cart.map(async (item) => {
      await OrderItem.create({
        orderId: order.id,
        productId: item.productId,
        quantity: item.quantity,
        priceAtPurchase: item.price
      });
      await Product.decrement('stock', { by: item.quantity, where: { id: item.productId } });
    }));

    // Clear cart
    saveCart(req, []);

    // Send confirmation email (non-blocking)
    const user = await User.findByPk(req.session.user.id);
    sendOrderConfirmation(user, order).catch(() => {});

    req.flash('success', 'Order placed successfully!');
    res.redirect(`/orders/${order.id}`);
  } catch (err) {
    logger.error('Complete order error:', err);
    req.flash('error', 'Order failed. Please contact support.');
    res.redirect('/cart');
  }
}

// GET /orders
async function listOrders(req, res) {
  const orders = await Order.findAll({
    where: { userId: req.session.user.id },
    include: [{ association: 'items', include: [{ association: 'product' }] }],
    order: [['createdAt', 'DESC']]
  });
  res.render('pages/orders/list', { title: 'My Orders', orders });
}

// GET /orders/:id
async function showOrder(req, res) {
  const order = await Order.findOne({
    where: { id: req.params.id, userId: req.session.user.id },
    include: [{ association: 'items', include: [{ association: 'product' }] }]
  });
  if (!order) return res.status(404).render('pages/404', { title: 'Not Found' });
  res.render('pages/orders/detail', { title: `Order #${order.id.slice(0,8).toUpperCase()}`, order });
}

// GET /admin/orders
async function adminOrders(req, res) {
  const orders = await Order.findAll({
    include: [{ association: 'user' }, { association: 'items' }],
    order: [['createdAt', 'DESC']]
  });
  res.render('pages/admin/orders', { title: 'All Orders', orders });
}

// POST /admin/orders/:id/status
async function updateStatus(req, res) {
  try {
    const order = await Order.findByPk(req.params.id);
    if (order) await order.update({ status: req.body.status });
    req.flash('success', 'Order status updated.');
    res.redirect('/admin/orders');
  } catch (err) {
    req.flash('error', 'Update failed.');
    res.redirect('/admin/orders');
  }
}

module.exports = {
  showCart, addToCart, removeFromCart, updateCart,
  showCheckout, completeOrder,
  listOrders, showOrder,
  adminOrders, updateStatus
};
