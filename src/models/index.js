const { sequelize, Sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');

// ─── User Model ───────────────────────────────────────────────────────────────
const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: { len: [2, 100] }
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: { isEmail: true }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  role: {
    type: DataTypes.ENUM('user', 'admin'),
    defaultValue: 'user'
  },
  isVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  avatar: {
    type: DataTypes.STRING,
    defaultValue: null
  }
}, {
  hooks: {
    beforeCreate: async (user) => {
      user.password = await bcrypt.hash(user.password, 12);
    },
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        user.password = await bcrypt.hash(user.password, 12);
      }
    }
  }
});

User.prototype.comparePassword = async function (plain) {
  return bcrypt.compare(plain, this.password);
};

User.prototype.toSafeObject = function () {
  const { password, ...safe } = this.toJSON();
  return safe;
};

// ─── Product Model ────────────────────────────────────────────────────────────
const Product = sequelize.define('Product', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT
  },
  price: {
    type: DataTypes.INTEGER,  // stored in cents
    allowNull: false,
    validate: { min: 0 }
  },
  stock: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: { min: 0 }
  },
  image: {
    type: DataTypes.STRING,
    defaultValue: null
  },
  category: {
    type: DataTypes.STRING,
    defaultValue: 'general'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
});

// ─── Order Model ──────────────────────────────────────────────────────────────
const Order = sequelize.define('Order', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  status: {
    type: DataTypes.ENUM('pending', 'paid', 'shipped', 'delivered', 'cancelled'),
    defaultValue: 'pending'
  },
  total: {
    type: DataTypes.INTEGER,  // cents
    allowNull: false
  },
  stripePaymentId: {
    type: DataTypes.STRING,
    defaultValue: null
  },
  shippingAddress: {
    type: DataTypes.JSONB,
    defaultValue: {}
  }
});

// ─── OrderItem Model ──────────────────────────────────────────────────────────
const OrderItem = sequelize.define('OrderItem', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: { min: 1 }
  },
  priceAtPurchase: {
    type: DataTypes.INTEGER,  // cents
    allowNull: false
  }
});

// ─── Associations ─────────────────────────────────────────────────────────────
User.hasMany(Order, { foreignKey: 'userId', as: 'orders' });
Order.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Order.hasMany(OrderItem, { foreignKey: 'orderId', as: 'items' });
OrderItem.belongsTo(Order, { foreignKey: 'orderId' });

Product.hasMany(OrderItem, { foreignKey: 'productId' });
OrderItem.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

module.exports = { User, Product, Order, OrderItem, sequelize };
