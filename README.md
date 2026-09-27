# Inventory System

A sales and inventory management application for customer enquiries, quotations, sales orders, stock reservations, and dispatches.

## Features

- Maintain customer and product records.
- Create customer enquiries with requested products and quantities.
- Create, price, send, accept, reject, and expire quotations.
- Convert accepted quotations into sales orders.
- Confirm orders and reserve available stock atomically.
- Record damaged stock and calculate availability from physical, reserved, and damaged quantities.
- Create dispatches for confirmed orders and track dispatch status.
- Enforce role-based access and record key actions in an audit log.

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

## Architecture

The frontend is a React single-page application served by Vite. During development, Vite proxies `/api` requests to the Express backend. The backend is organized into feature modules with routes, controllers, services, and repositories; Zod validates incoming data, Prisma accesses PostgreSQL, and shared middleware handles authentication, authorization, and errors.

```text
Browser (React) → Vite dev server → Express API → feature modules → Prisma ORM → PostgreSQL
```

## Database Schema

The Prisma schema is in `backend/prisma/schema.prisma`. Its main entities are:

| Area | Tables/models | Purpose |
|---|---|---|
| Access | `User`, `AuditLog` | User roles, password hashes, and action history |
| Master data | `Customer`, `Product`, `Inventory` | Customer contacts, catalog, and physical/reserved/damaged stock |
| Sales intake | `Enquiry`, `EnquiryItem` | Customer request and requested product quantities |
| Pricing | `Quotation`, `QuotationItem` | Quoted products, prices, discounts, tax, total, and status |
| Fulfillment | `SalesOrder`, `SalesOrderItem`, `Reservation` | Accepted quote converted to an order and its stock reservation |
| Shipping | `Dispatch`, `DispatchItem` | Shipment details and dispatched product quantities |

An enquiry belongs to a customer and can have quotations. A quotation belongs to an enquiry and customer; a sales order references one accepted quotation. The unique quotation relation prevents converting the same quotation into multiple orders. Inventory is stored per product. A dispatch belongs to a sales order.

## API Documentation

The API is rooted at `/api`. Paginated list endpoints accept `page` and `limit` and return pagination metadata; the inventory list returns all inventory rows. Authenticated API requests use the HTTP-only cookie set at login.

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/auth/login` | Sign in and set the session cookie |
| `POST` | `/api/auth/logout` | Clear the session cookie |
| `GET` | `/api/auth/me` | Return the current user |
| `POST` | `/api/auth/register` | Create a user (Admin only) |
| `GET`, `POST` | `/api/customers` | List or create customers |
| `PATCH`, `DELETE` | `/api/customers/:id` | Update or deactivate a customer (Admin only) |
| `GET`, `POST` | `/api/products` | List products or create one (create is Admin only) |
| `GET`, `PATCH`, `DELETE` | `/api/products/:id` | Read or manage a product (writes are Admin only) |
| `GET` | `/api/inventory` | List inventory and calculated availability |
| `GET` | `/api/inventory/:productId` | Read one product's stock |
| `PATCH` | `/api/inventory/:productId/damaged` | Set damaged quantity (Admin only) |
| `GET`, `POST` | `/api/enquiries` | List or create enquiries |
| `GET`, `PATCH`, `DELETE` | `/api/enquiries/:id` | Read/update an enquiry; deletion is Admin only |
| `PATCH` | `/api/enquiries/:id/status` | Change enquiry status |
| `GET`, `POST` | `/api/quotations` | List or create quotations |
| `GET`, `PATCH`, `DELETE` | `/api/quotations/:id` | Read/update/delete a quotation; deletion is Admin only |
| `PATCH` | `/api/quotations/:id/status` | Send, accept, or reject a quotation |
| `GET` | `/api/orders` | List sales orders, including dispatch summaries |
| `POST` | `/api/orders/quotations/:id/convert` | Convert an accepted quotation into an order |
| `POST` | `/api/orders/:id/confirm` | Confirm an order and reserve stock (Admin only) |
| `POST` | `/api/orders/:id/cancel` | Cancel an order (Admin only) |
| `POST` | `/api/dispatches/sales-orders/:id/dispatch` | Create a dispatch for a confirmed order (Admin only) |
| `PATCH` | `/api/dispatches/:id/status` | Advance dispatch to `IN_TRANSIT` or `DELIVERED` (Admin only) |

The implementation and role gates are defined in the route files under `backend/src/modules/`.

## Authentication & RBAC

Login verifies a bcrypt password hash and returns the user while setting a signed JWT in an HTTP-only cookie. Protected routes authenticate that cookie. Registration is restricted to Admins; Zod validates request bodies and query parameters.

| Role | Main permissions |
|---|---|
| `ADMIN` | Manage products and customer records; create/update quotations; confirm/cancel orders; update damaged stock; create dispatches and update dispatch status; register users |
| `SALES` | Create customers and enquiries; create and update quotations; send, accept, or reject quotations; convert accepted quotations into orders |
| `WAREHOUSE` | Read products, inventory, enquiries, quotations, and orders |
| `VIEWER` | Read products, inventory, enquiries, quotations, and orders |

All four roles can read the core enquiry, quotation, order, product, and inventory APIs. Customer creation is available to Admin and Sales; customer updates/deactivation are Admin only. Dispatch actions are Admin only.

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

## Testing

Tests are in `backend/tests/` and run from `backend/`:

```bash
npm test
```

The tests connect to the database in `DATABASE_URL` and clear application tables during setup. Point `DATABASE_URL` at a separate, disposable test database—not a development database containing data you want to preserve.

The suite includes authentication, enquiry/quotation, order conversion, reservation, and concurrency coverage. Some existing auth and order tests still expect Bearer-token login and a generic order-status route; the current API uses an HTTP-only cookie and dedicated confirm/cancel endpoints. Update those tests before treating the full suite as passing.

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

## Business Workflow

```mermaid
flowchart TD
    A[Customer] --> B[Enquiry]
    B --> C[Quotation]
    C --> D[Accepted Quotation]
    D --> E[Sales Order]
    E --> F[Inventory Reservation]
    F --> G[Confirmed Order]
    G --> H[Dispatch]
    H --> I[Inventory Updated]
```

Sales or Admin users create the enquiry and quotation. A quotation moves from `DRAFT` to `SENT`, then the customer decision is recorded as `ACCEPTED` or `REJECTED`. Admin or Sales can convert an accepted quotation into one sales order. An Admin confirms the order, which atomically reserves stock after checking available quantities. An Admin creates a dispatch for the confirmed order; dispatch creation decrements physical and reserved quantities. Availability remains `physical - reserved - damaged`.

## Demo Video

No demo video link is currently included. Add a shareable recording URL here when one is available.

## Known Assumptions

- Customers are business records managed by internal users; there is no separate customer login or customer-facing portal.
- Accepting a quotation records the decision; it does not reserve stock or automatically create an order. Order conversion and Admin confirmation are separate steps.
- Creating a dispatch is treated as the point when physical inventory leaves stock. The dispatch status can then advance from `PENDING` to `IN_TRANSIT` to `DELIVERED`.
- The seed script uses fixed demo credentials and deletes existing application records before reseeding; use only a disposable local database.
- The tests require a separate disposable PostgreSQL database. Auth/order test expectations noted in [Testing](#testing) need alignment with the current cookie and dedicated order routes.
