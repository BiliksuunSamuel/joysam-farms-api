# JoySam Farms API

The backend for **JoySam Farms** - a single-vendor, multi-shop commerce
platform. One warehouse stocks several shops; each shop sells, tracks its own
cash, and can extend credit to vendors it does regular business with. Built
with **NestJS**, **MongoDB (Mongoose)**, **JWT auth**, and **Swagger**.

---

## What it does

- **Warehouse & inventory** - a central stock pool, transferred out to shops
  (`Inventory`, `Transfer`, `ShopInventory`) and replenished from suppliers
  (`Supplier`, `SupplyRequest`).
- **Shops** - each shop has its own cash wallet, sourced entirely from its
  own `LedgerEntry` rows (`Wallet`, `LedgerEntry`) - never a cached balance.
- **Sales & checkout** (`Sale`) - cash, mobile money, or credit. A credit
  sale posts a charge to the buyer's vendor account instead of the shop's
  wallet.
- **Vendors & credit** (`Vendor`, `VendorLedgerEntry`) - accounts-receivable
  for buyers who purchase on credit. No pre-approved credit limit - a vendor
  either owes money or doesn't, tracked with FIFO payment allocation and
  invoice-level aging.
- **Expenses** (`Expense`) - company-wide or per-shop operating costs,
  debited from a shop's wallet once marked paid.
- **Stock requests** (`StockRequest`) - a shop asking the warehouse to
  replenish it, approved into a `Transfer`.
- **Employees, roles & permissions** (`User`, `Role`) - permission-key based
  RBAC (`src/permissions/index.ts`), independent of role: a role is just a
  job-title label, what a user can actually do is the `permissionKeys`/
  `allPermissions` set directly on them.
- **Settings** - a single company-wide settings document covering business
  identity, receipts, inventory thresholds, credit policy, security and
  notification preferences.
- **Audit log** - every significant action (`@AuditLog` + `AuditLogInterceptor`)
  is recorded with who did it, when, and from where.

### Shop-scoped access

A `User` is either company-wide (`shopId: null`, e.g. a Super Manager) or
tied to one shop. **Shop-tied employees only ever see their own shop's
data** - this is enforced server-side (`resolveRequesterShopId` in
`src/utils/index.ts`), not just hidden in the UI: a shop-tied employee's
`shopId` is re-resolved fresh on every request and forced onto every list/
trend/getById call for `Sale`, `Expense`, `ShopInventory`, `StockRequest`,
`Transfer` and `LedgerEntry`, overriding whatever they ask for. Fetching a
specific record that belongs to another shop 404s rather than revealing it
exists.

---

## Requirements

- Node.js
- A MongoDB server - [MongoDB Community Edition](https://www.mongodb.com/try/download/community) for local development

---

## Environment variables

Create a `.env` file at the project root:

```
PORT=5858
CONNECTION_STRING=mongodb://localhost:27017/JoySamFarms
JWT_SECRET=your-secret-key
```

---

## Getting started

```sh
npm install
npm run start:dev
```

The API listens on `PORT` (default `3000`), and interactive Swagger docs are
served at the root (`http://localhost:<PORT>/`).

### Seed data (local development only)

```sh
npm run seed
```

Creates one user per role against a fresh database (safe to re-run - it
looks up each role/user by name/email first, and re-syncs permissions
either way). Every seeded user's password is `Password123!`:

| Role | Email | Notes |
|---|---|---|
| Super Manager | `biliksuunsamuel@gmail.com` | `allPermissions: true`, company-wide |
| Shop Manager | `shop.manager@joysamfarms.test` | Tied to a shop |
| Storekeeper | `storekeeper@joysamfarms.test` | Company-wide (warehouse) |
| Accountant | `accountant@joysamfarms.test` | Company-wide |
| Cashier | `cashier@joysamfarms.test` | Tied to a shop |

Never used outside local development - production accounts are created
through the app, with real passwords set on invite/reset.

---

## Scripts

| Command | Purpose |
|---|---|
| `npm run start:dev` | Run the API with hot reload |
| `npm run build` | Compile to `dist/` |
| `npm run start:prod` | Run the compiled build |
| `npm run seed` | Seed local dev roles/users (see above) |
| `npm run lint` | Lint and auto-fix |
| `npm run test` / `test:e2e` | Unit / end-to-end tests |

---

## Project structure

Auto-loaded, one concern per file: `schemas/` (Mongoose models) →
`repositories/` (data access) → `services/` (business logic, returns
`ApiResponseDto<T>`) → `controllers/` (thin HTTP layer, `@AuthPermissions(...)`
gated). Cross-cutting pieces live in `middlewares/`, `providers/`,
`decorators/`, and shared logic in `utils/`.
