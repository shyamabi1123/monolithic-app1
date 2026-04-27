# MonolithApp — Node.js Monolithic Application

A full-stack monolithic web application with authentication, product catalogue, cart, checkout (Stripe), and order management.

---

## Requirements (install these on your laptop first)

| Tool | Version | Download |
|---|---|---|
| Node.js | 18+ LTS | https://nodejs.org |
| npm | comes with Node | — |
| PostgreSQL | 14+ | https://www.postgresql.org/download |
| Git | any | https://git-scm.com |

Optional but highly recommended:
- **nodemon** — for auto-reload during development (installed as devDependency)
- **pgAdmin** or **TablePlus** — GUI to view your database

---

## Folder Structure

```
monolith-app/
├── src/
│   ├── server.js              ← App entry point
│   ├── config/
│   │   ├── database.js        ← Sequelize / PostgreSQL connection
│   │   └── logger.js          ← Winston logger
│   ├── middleware/
│   │   ├── auth.js            ← requireAuth, requireAdmin, JWT
│   │   └── upload.js          ← Multer file uploads
│   ├── models/
│   │   └── index.js           ← User, Product, Order, OrderItem + associations
│   ├── modules/
│   │   ├── users/
│   │   │   └── userController.js   ← Register, login, dashboard, profile
│   │   ├── products/
│   │   │   └── productController.js ← CRUD products, admin panel
│   │   └── orders/
│   │       └── orderController.js  ← Cart, checkout, order history
│   ├── routes/
│   │   └── index.js           ← All routes wired together
│   └── services/
│       ├── emailService.js    ← Nodemailer (welcome, order confirmation)
│       └── paymentService.js  ← Stripe payment intents
├── views/                     ← Handlebars templates
│   ├── layouts/main.hbs       ← Shared HTML shell (navbar, footer)
│   ├── pages/
│   │   ├── home.hbs
│   │   ├── dashboard.hbs
│   │   ├── cart.hbs
│   │   ├── auth/login.hbs
│   │   ├── auth/register.hbs
│   │   ├── products/list.hbs
│   │   └── orders/list.hbs
│   └── partials/              ← Reusable snippets
├── public/                    ← Static files served directly
│   ├── css/style.css
│   ├── js/app.js
│   └── images/uploads/        ← User-uploaded images (gitignored)
├── migrations/
│   └── seed.js                ← Seed DB with sample data
├── tests/                     ← Jest tests
├── .env.example               ← Copy to .env and fill in
├── .gitignore
└── package.json
```

---

## Step-by-Step: Run on Your Local Machine

### Step 1 — Clone / download the project

```bash
cd ~/Desktop
# If using git:
git clone <your-repo-url> monolith-app
cd monolith-app

# Or just place the folder here and cd into it
```

### Step 2 — Install dependencies

```bash
npm install
```

### Step 3 — Set up PostgreSQL

Open **pgAdmin** or your terminal and run:

```sql
CREATE DATABASE monolith_db;
```

Or via terminal:
```bash
psql -U postgres -c "CREATE DATABASE monolith_db;"
```

### Step 4 — Create your .env file

```bash
cp .env.example .env
```

Now open `.env` and fill in at minimum:

```
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=monolith_db
DB_USER=postgres
DB_PASSWORD=your_postgres_password

SESSION_SECRET=any-long-random-string
JWT_SECRET=another-long-random-string
```

For email: sign up free at https://mailtrap.io and paste your SMTP credentials.
For Stripe: use test keys from https://dashboard.stripe.com/test/apikeys.

### Step 5 — Seed the database

```bash
npm run seed
```

This creates tables and inserts:
- Admin: admin@example.com / password123
- User: user@example.com / password123
- 6 sample products

### Step 6 — Start the dev server

```bash
npm run dev
```

Open your browser at: **http://localhost:3000**

---

## Available npm Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start with nodemon (auto-restart on file changes) |
| `npm start` | Start without nodemon (production-like) |
| `npm run seed` | Drop + recreate tables and insert sample data |
| `npm test` | Run Jest tests |

---

## Routes Reference

| Method | Path | Description |
|---|---|---|
| GET | / | Home page |
| GET/POST | /auth/register | Register |
| GET/POST | /auth/login | Login |
| POST | /auth/logout | Logout |
| GET | /dashboard | User dashboard (auth) |
| GET | /products | Product listing |
| GET | /products/:id | Product detail |
| GET | /cart | View cart (auth) |
| POST | /cart/add | Add item to cart |
| GET | /checkout | Checkout page |
| POST | /checkout/complete | Place order |
| GET | /orders | Order history |
| GET | /admin/products | Admin: manage products |
| GET | /admin/orders | Admin: all orders |
| POST | /api/auth/token | REST API: get JWT |
| GET | /api/products | REST API: list products |

---

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL + Sequelize ORM
- **Templates**: Handlebars (hbs)
- **Auth**: Sessions (express-session) + JWT for API
- **Payments**: Stripe
- **Email**: Nodemailer (Mailtrap for dev)
- **File uploads**: Multer
- **Security**: Helmet, rate limiting, bcrypt
- **Logging**: Winston
