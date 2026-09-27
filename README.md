# Inventory System

A sales and inventory management application. Sales users manage customer enquiries and quotations; administrators convert accepted quotations into orders, reserve stock, and dispatch orders.

## Tech stack

- **Frontend:** React 19, React Router, Vite
- **Backend:** Node.js, Express 4
- **Database:** PostgreSQL, accessed with Prisma ORM
- **Validation and security:** Zod, JWT in an HTTP-only cookie, bcrypt, Helmet
- **Tests:** Jest and Supertest

## Project layout

```text
inventory-system/
├── backend/
│   ├── prisma/          # Prisma schema, migrations, and seed script
│   ├── src/             # Express API and business logic
│   ├── tests/           # API and inventory workflow tests
│   ├── .env.example
│   └── package.json
└── frontend/
    ├── public/
    ├── src/             # React pages, auth, and API client
    └── package.json
```

## Requirements

- Node.js and npm
- PostgreSQL
- A local PostgreSQL database for development

## Project setup

From the project root, install the backend and frontend dependencies:

```bash
cd backend
npm ci
cd ../frontend
npm ci
```

Create a PostgreSQL database for the app. For example, if PostgreSQL command-line tools are on your PATH:

```bash
createdb inventory_db
```

You can create the database with pgAdmin or another PostgreSQL client instead.

## Environment variables

Copy `backend/.env.example` to `backend/.env`, then set the values for your local setup. `backend/.env` is local configuration and should not be committed.

```env
NODE_ENV=development
PORT=4000
DATABASE_URL="postgresql://postgres:your_password@localhost:5432/inventory_db"
JWT_SECRET="replace-with-a-random-secret-at-least-32-characters-long"
JWT_EXPIRES_IN=1d
BCRYPT_ROUNDS=12
```

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection URL |
| `JWT_SECRET` | Yes | Signs authentication tokens; must be at least 32 characters |
| `PORT` | No | API port; defaults to `4000` |
| `NODE_ENV` | No | Runtime mode; defaults to `development` |
| `JWT_EXPIRES_IN` | No | Token lifetime; defaults to `1d` |
| `BCRYPT_ROUNDS` | No | Password hashing cost; defaults to `12` and must be from 10 to 15 |
| `ALLOWED_ORIGINS` | Production | Comma-separated allowed browser origins |

The backend reads its `.env` from the backend working directory. The seed script currently uses fixed local demo credentials; the `SEED_*` entries in `.env.example` are not wired into the seed script.

## Database migrations and seed data

Run these commands from `backend/` after setting up `backend/.env` and creating the database:

```bash
npm run prisma:generate
npm run prisma:migrate
npx prisma db seed
```

`prisma:migrate` applies the checked-in migrations and may prompt for a development migration name if schema changes are pending. The seed script **deletes existing application records before inserting demo data**. Use it only with a disposable local database; never run it against data you need to keep.

## Run the application

Start the backend in one terminal:

```bash
cd backend
npm run dev
```

The API listens on `http://localhost:4000`; `http://localhost:4000/health` is its health endpoint.

Start the frontend in another terminal:

```bash
cd frontend
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api` requests to the backend on port `4000`.

## Run tests

Tests are in `backend/tests/` and run from `backend/`:

```bash
npm test
```

The tests connect to the database in `DATABASE_URL` and clear application tables during setup. Point `DATABASE_URL` at a separate, disposable test database—not a development database containing data you want to preserve.

## Test login credentials

After running the seed script, sign in at `http://localhost:5173/login` with either seeded account:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@inventory.local` | `Password@123` |
| Sales | `sales@inventory.local` | `Password@123` |

These credentials are for local development only. The seed script hardcodes them; change the credentials before using any shared or deployed environment.

## Quotation status flow

Quotation status changes are enforced by the API:

| Current status | Allowed next status |
|---|---|
| `DRAFT` | `SENT` |
| `SENT` | `ACCEPTED`, `REJECTED` |
| `ACCEPTED` | Terminal |
| `REJECTED` | Terminal |
| `EXPIRED` | Terminal; set by the scheduled expiry job |

A quotation must go through `DRAFT → SENT → ACCEPTED`; attempting to skip a step returns HTTP `409`. The transition rules are implemented in `backend/src/modules/quotations/quotation.service.js`.

## Inventory availability

Available stock is calculated as `physical quantity - reserved quantity - damaged quantity`. Admins can update damaged quantities from the Inventory Snapshot on the Sales Orders page. An update is rejected if it would count reserved units as damaged or make the available quantity negative.
