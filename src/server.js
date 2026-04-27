require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const flash = require('connect-flash');
const { engine } = require('express-handlebars');
const rateLimit = require('express-rate-limit');

const { sequelize } = require('./config/database');
const logger = require('./config/logger');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Security middleware ─────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: 'Too many requests, please try again later.'
});
app.use('/api/', limiter);

// ─── Body parsers ────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Session ─────────────────────────────────────────────────────────────────
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 7  // 7 days
  }
}));

app.use(flash());

// ─── Template engine (Handlebars) ────────────────────────────────────────────
app.engine('hbs', engine({
  extname: '.hbs',
  defaultLayout: 'main',
  layoutsDir: path.join(__dirname, '../views/layouts'),
  partialsDir: path.join(__dirname, '../views/partials'),
  helpers: {
    eq: (a, b) => a === b,
    formatPrice: (p) => `$${(p / 100).toFixed(2)}`,
    formatDate: (d) => new Date(d).toLocaleDateString()
  }
}));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, '../views'));

// ─── Static files ────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../public')));

// ─── Global template locals ──────────────────────────────────────────────────
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  next();
});

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/', routes);

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).render('pages/404', { title: 'Page Not Found' });
});

// ─── Global error handler ────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error(err.stack);
  const status = err.status || 500;
  res.status(status).render('pages/error', {
    title: 'Something went wrong',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// ─── Start server ─────────────────────────────────────────────────────────────
async function start() {
  try {
    await sequelize.authenticate();
    logger.info('Database connected.');
    await sequelize.sync({ alter: true });
    logger.info('Models synced.');

    app.listen(PORT, () => {
      logger.info(`Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    logger.error('Failed to start:', err);
    process.exit(1);
  }
}

start();
