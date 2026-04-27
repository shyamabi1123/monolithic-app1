require('dotenv').config();
const { User, Product, sequelize } = require('../src/models');

async function seed() {
  await sequelize.sync({ force: true });
  console.log('Tables created.');

  // Admin user
  await User.create({
    name: 'Admin User',
    email: 'admin@example.com',
    password: 'password123',
    role: 'admin',
    isVerified: true
  });

  // Regular user
  await User.create({
    name: 'Test User',
    email: 'user@example.com',
    password: 'password123',
    isVerified: true
  });

  // Sample products
  const products = [
    { name: 'Laptop Pro 15"', description: 'Powerful laptop for developers.', price: 149999, stock: 10, category: 'Electronics' },
    { name: 'Wireless Mouse', description: 'Ergonomic wireless mouse.', price: 2999, stock: 50, category: 'Electronics' },
    { name: 'Mechanical Keyboard', description: 'Tactile switches, RGB backlit.', price: 7999, stock: 25, category: 'Electronics' },
    { name: 'USB-C Hub', description: '7-in-1 USB hub.', price: 3499, stock: 40, category: 'Accessories' },
    { name: 'Monitor Stand', description: 'Adjustable height stand.', price: 4999, stock: 20, category: 'Accessories' },
    { name: 'Notebook A5', description: '200-page dotted notebook.', price: 999, stock: 100, category: 'Stationery' },
  ];

  for (const p of products) await Product.create(p);

  console.log('Seed complete!');
  console.log('Admin: admin@example.com / password123');
  console.log('User:  user@example.com  / password123');
  await sequelize.close();
}

seed().catch(console.error);
