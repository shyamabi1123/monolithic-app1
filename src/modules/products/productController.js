const { Op } = require('sequelize');
const { body, validationResult } = require('express-validator');
const { Product } = require('../../models');
const upload = require('../../middleware/upload');
const logger = require('../../config/logger');

const productRules = [
  body('name').trim().notEmpty().withMessage('Product name required'),
  body('price').isFloat({ min: 0 }).withMessage('Valid price required'),
  body('stock').isInt({ min: 0 }).withMessage('Valid stock required'),
  body('category').trim().notEmpty()
];

// GET /products
async function listProducts(req, res) {
  try {
    const { search, category, page = 1 } = req.query;
    const limit = 12;
    const offset = (page - 1) * limit;
    const where = { isActive: true };

    if (search) where.name = { [Op.iLike]: `%${search}%` };
    if (category) where.category = category;

    const { rows: products, count } = await Product.findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']]
    });

    const categories = await Product.findAll({
      attributes: [[require('sequelize').fn('DISTINCT', require('sequelize').col('category')), 'category']],
      raw: true
    });

    res.render('pages/products/list', {
      title: 'Products',
      products,
      categories: categories.map(c => c.category),
      currentCategory: category || '',
      search: search || '',
      page: parseInt(page),
      totalPages: Math.ceil(count / limit)
    });
  } catch (err) {
    logger.error('List products error:', err);
    res.render('pages/error', { title: 'Error', message: 'Could not load products.' });
  }
}

// GET /products/:id
async function showProduct(req, res) {
  try {
    const product = await Product.findOne({
      where: { id: req.params.id, isActive: true }
    });
    if (!product) return res.status(404).render('pages/404', { title: 'Not Found' });
    res.render('pages/products/detail', { title: product.name, product });
  } catch (err) {
    res.status(500).render('pages/error', { title: 'Error', message: err.message });
  }
}

// GET /admin/products
async function adminList(req, res) {
  const products = await Product.findAll({ order: [['createdAt', 'DESC']] });
  res.render('pages/admin/products', { title: 'Manage Products', products });
}

// GET /admin/products/new
function showCreateForm(req, res) {
  res.render('pages/admin/product-form', { title: 'New Product', product: {} });
}

// POST /admin/products
async function createProduct(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    req.flash('error', errors.array().map(e => e.msg).join(', '));
    return res.redirect('/admin/products/new');
  }
  try {
    const { name, description, price, stock, category } = req.body;
    const image = req.file ? `/images/uploads/${req.file.filename}` : null;
    await Product.create({
      name, description,
      price: Math.round(parseFloat(price) * 100),
      stock: parseInt(stock),
      category,
      image
    });
    req.flash('success', 'Product created.');
    res.redirect('/admin/products');
  } catch (err) {
    logger.error('Create product error:', err);
    req.flash('error', 'Failed to create product.');
    res.redirect('/admin/products/new');
  }
}

// GET /admin/products/:id/edit
async function showEditForm(req, res) {
  const product = await Product.findByPk(req.params.id);
  if (!product) return res.status(404).render('pages/404', { title: 'Not Found' });
  res.render('pages/admin/product-form', { title: 'Edit Product', product });
}

// POST /admin/products/:id
async function updateProduct(req, res) {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) return res.status(404).render('pages/404', { title: 'Not Found' });
    const { name, description, price, stock, category, isActive } = req.body;
    const image = req.file ? `/images/uploads/${req.file.filename}` : product.image;
    await product.update({
      name, description,
      price: Math.round(parseFloat(price) * 100),
      stock: parseInt(stock),
      category, image,
      isActive: isActive === 'true'
    });
    req.flash('success', 'Product updated.');
    res.redirect('/admin/products');
  } catch (err) {
    logger.error('Update product error:', err);
    req.flash('error', 'Update failed.');
    res.redirect(`/admin/products/${req.params.id}/edit`);
  }
}

// POST /admin/products/:id/delete
async function deleteProduct(req, res) {
  try {
    const product = await Product.findByPk(req.params.id);
    if (product) await product.update({ isActive: false }); // soft delete
    req.flash('success', 'Product removed.');
    res.redirect('/admin/products');
  } catch (err) {
    req.flash('error', 'Delete failed.');
    res.redirect('/admin/products');
  }
}

// API: GET /api/products
async function apiList(req, res) {
  try {
    const products = await Product.findAll({ where: { isActive: true } });
    res.json({ products });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
}

module.exports = {
  listProducts, showProduct,
  adminList, showCreateForm, createProduct,
  showEditForm, updateProduct, deleteProduct,
  apiList, productRules
};
