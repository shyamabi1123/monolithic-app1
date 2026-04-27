const express = require('express');
const router = express.Router();

const { requireAuth, requireAdmin, guestOnly } = require('../middleware/auth');
const upload = require('../middleware/upload');

const userCtrl = require('../modules/users/userController');
const productCtrl = require('../modules/products/productController');
const orderCtrl = require('../modules/orders/orderController');

// ─── Home ─────────────────────────────────────────────────────────────────────
router.get('/', (req, res) => res.render('pages/home', { title: 'Welcome' }));

// ─── Auth routes ──────────────────────────────────────────────────────────────
router.get('/auth/register', guestOnly, userCtrl.showRegister);
router.post('/auth/register', guestOnly, userCtrl.registerRules, userCtrl.register);

router.get('/auth/login', guestOnly, userCtrl.showLogin);
router.post('/auth/login', guestOnly, userCtrl.loginRules, userCtrl.login);

router.post('/auth/logout', userCtrl.logout);

// ─── User routes ──────────────────────────────────────────────────────────────
router.get('/dashboard', requireAuth, userCtrl.dashboard);
router.get('/profile', requireAuth, userCtrl.showProfile);
router.post('/profile', requireAuth, upload.single('avatar'), userCtrl.updateProfile);

// ─── Product routes ───────────────────────────────────────────────────────────
router.get('/products', productCtrl.listProducts);
router.get('/products/:id', productCtrl.showProduct);

// ─── Cart routes ──────────────────────────────────────────────────────────────
router.get('/cart', requireAuth, orderCtrl.showCart);
router.post('/cart/add', requireAuth, orderCtrl.addToCart);
router.post('/cart/remove', requireAuth, orderCtrl.removeFromCart);
router.post('/cart/update', requireAuth, orderCtrl.updateCart);

// ─── Checkout routes ──────────────────────────────────────────────────────────
router.get('/checkout', requireAuth, orderCtrl.showCheckout);
router.post('/checkout/complete', requireAuth, orderCtrl.completeOrder);

// ─── Order routes ─────────────────────────────────────────────────────────────
router.get('/orders', requireAuth, orderCtrl.listOrders);
router.get('/orders/:id', requireAuth, orderCtrl.showOrder);

// ─── Admin routes ─────────────────────────────────────────────────────────────
router.get('/admin/products', requireAuth, requireAdmin, productCtrl.adminList);
router.get('/admin/products/new', requireAuth, requireAdmin, productCtrl.showCreateForm);
router.post('/admin/products', requireAuth, requireAdmin, upload.single('image'), productCtrl.productRules, productCtrl.createProduct);
router.get('/admin/products/:id/edit', requireAuth, requireAdmin, productCtrl.showEditForm);
router.post('/admin/products/:id', requireAuth, requireAdmin, upload.single('image'), productCtrl.updateProduct);
router.post('/admin/products/:id/delete', requireAuth, requireAdmin, productCtrl.deleteProduct);

router.get('/admin/orders', requireAuth, requireAdmin, orderCtrl.adminOrders);
router.post('/admin/orders/:id/status', requireAuth, requireAdmin, orderCtrl.updateStatus);

// ─── REST API routes ──────────────────────────────────────────────────────────
const { requireJWT } = require('../middleware/auth');
router.post('/api/auth/token', userCtrl.getToken);
router.get('/api/products', productCtrl.apiList);

module.exports = router;
