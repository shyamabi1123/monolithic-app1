const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const { User } = require('../../models');
const { sendWelcomeEmail } = require('../../services/emailService');
const logger = require('../../config/logger');

// Validation rules
const registerRules = [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 chars'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
];

const loginRules = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
];

// GET /auth/register
async function showRegister(req, res) {
  res.render('pages/auth/register', { title: 'Create Account' });
}

// POST /auth/register
async function register(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    req.flash('error', errors.array().map(e => e.msg).join(', '));
    return res.redirect('/auth/register');
  }
  try {
    const { name, email, password } = req.body;
    const existing = await User.findOne({ where: { email } });
    if (existing) {
      req.flash('error', 'Email already registered.');
      return res.redirect('/auth/register');
    }
    const user = await User.create({ name, email, password });
    req.session.user = user.toSafeObject();
    await sendWelcomeEmail(user).catch(() => {}); // non-blocking
    req.flash('success', `Welcome, ${user.name}!`);
    res.redirect('/dashboard');
  } catch (err) {
    logger.error('Register error:', err);
    req.flash('error', 'Registration failed. Try again.');
    res.redirect('/auth/register');
  }
}

// GET /auth/login
async function showLogin(req, res) {
  res.render('pages/auth/login', { title: 'Login' });
}

// POST /auth/login
async function login(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    req.flash('error', 'Invalid email or password.');
    return res.redirect('/auth/login');
  }
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user || !(await user.comparePassword(password))) {
      req.flash('error', 'Invalid email or password.');
      return res.redirect('/auth/login');
    }
    req.session.user = user.toSafeObject();
    req.flash('success', `Welcome back, ${user.name}!`);
    res.redirect(req.session.returnTo || '/dashboard');
    delete req.session.returnTo;
  } catch (err) {
    logger.error('Login error:', err);
    req.flash('error', 'Login failed. Try again.');
    res.redirect('/auth/login');
  }
}

// POST /auth/logout
function logout(req, res) {
  req.session.destroy();
  res.redirect('/');
}

// GET /dashboard
async function dashboard(req, res) {
  const user = await User.findByPk(req.session.user.id, {
    include: [{ association: 'orders', limit: 5, order: [['createdAt', 'DESC']] }]
  });
  res.render('pages/dashboard', { title: 'Dashboard', user: user.toSafeObject(), orders: user.orders });
}

// GET /profile
async function showProfile(req, res) {
  const user = await User.findByPk(req.session.user.id);
  res.render('pages/profile', { title: 'My Profile', user: user.toSafeObject() });
}

// POST /profile
async function updateProfile(req, res) {
  try {
    const user = await User.findByPk(req.session.user.id);
    const { name } = req.body;
    if (req.file) user.avatar = `/images/uploads/${req.file.filename}`;
    await user.update({ name, avatar: user.avatar });
    req.session.user = user.toSafeObject();
    req.flash('success', 'Profile updated.');
    res.redirect('/profile');
  } catch (err) {
    logger.error('Profile update error:', err);
    req.flash('error', 'Update failed.');
    res.redirect('/profile');
  }
}

// API: POST /api/auth/token
async function getToken(req, res) {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET || 'dev-jwt-secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    res.json({ token, user: user.toSafeObject() });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
}

module.exports = {
  showRegister, register, registerRules,
  showLogin, login, loginRules,
  logout, dashboard, showProfile, updateProfile, getToken
};
