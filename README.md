# Bitespeed Identity Reconciliation Service

A robust backend service that reconciles customer identities across multiple purchases using different contact information (email/phone). Built with **Node.js**, **TypeScript**, **Express**, **Prisma ORM**, and **PostgreSQL**.

> **Live Endpoint:** `https://<your-render-url>/identify`
> **API Documentation:** `https://<your-render-url>/api-docs`

---

## Problem

Customers may use different email addresses and phone numbers across purchases. This service links those identities together so that a single consolidated view of each customer is maintained.

## Architecture

```
┌──────────────┐     ┌────────────────┐     ┌───────────────────┐     ┌──────────────┐
│   Client     │────▶│   Controller   │────▶│     Service       │────▶│  Repository  │
│  (HTTP POST) │     │  (HTTP adapter)│     │ (Business Logic)  │     │ (Data Access)│
└──────────────┘     └────────────────┘     └───────────────────┘     └──────────────┘
                            │                        │                         │
                      Validation MW          Identity Reconciliation     Prisma + PostgreSQL
                      Error Handler          Link / Merge / Create
                      Swagger Docs
```

### Design Principles (SOLID)

| Principle | Application |
|-----------|-------------|
| **Single Responsibility** | Each layer has exactly one job: Controller handles HTTP, Service handles logic, Repository handles persistence |
| **Open/Closed** | New linking strategies or response formats can be added without modifying existing code |
| **Liskov Substitution** | `IContactRepository` can be swapped with any implementation (Prisma, raw SQL, in-memory for tests) |
| **Interface Segregation** | Minimal, focused interfaces (`IContactService`, `IContactRepository`) |
| **Dependency Inversion** | Service depends on repository *abstraction*, not Prisma directly |

### Why Prisma ORM (not raw SQL)?

| Factor | Prisma | Raw pg |
|--------|--------|--------|
| **Type safety** | Auto-generated from schema — 0 manual mapping errors | Hand-written types, easy to drift from DB |
| **Migrations** | `prisma migrate` — version-controlled, reversible | Manual `.sql` files, self-managed |
| **SQL injection** | Impossible — parameterized by default | Must remember `$1` params every time |
| **Code volume** | ~120 lines for repository | ~250+ lines for same functionality |
| **Maintenance** | Change schema → types auto-update | Change schema → update SQL + types + mapping |

> **Key insight:** The architecture uses `IContactRepository` interface (Dependency Inversion), so if raw SQL is ever needed for performance-critical queries, just add a new implementation class — zero changes to service or controller layers.

---

## API Documentation

### Interactive Swagger UI

Visit **`/api-docs`** for interactive API documentation with examples, try-it-out functionality, and full schema definitions.

### `POST /identify`

Reconciles a customer identity from email and/or phone number.

**Request Body:**
```json
{
  "email": "mcfly@hillvalley.edu",
  "phoneNumber": "123456"
}
```

**Response (200 OK):**
```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["lorraine@hillvalley.edu", "mcfly@hillvalley.edu"],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": [23]
  }
}
```

### `GET /health`

Health check endpoint.

### `GET /api-docs`

Interactive Swagger UI documentation.

### `GET /api-docs.json`

Raw OpenAPI 3.0 JSON specification.

---

## Getting Started

### Prerequisites

- **Node.js** >= 18
- **PostgreSQL** >= 14 (or use Docker)

### Local Development

```bash
# 1. Clone the repo
git clone https://github.com/sri11223/BiteSpeed.git
cd bitespeed-backend

# 2. Install dependencies
npm install

# 3. Set up environment
cp .env.example .env
# Edit .env with your PostgreSQL connection string

# 4. Run database migrations
npx prisma migrate dev --name init

# 5. Start development server (with hot reload)
npm run dev

# 6. Open API docs at http://localhost:3000/api-docs
```

### Using Docker

```bash
# Start PostgreSQL + App
docker-compose up --build

# The service will be available at http://localhost:3000
# API docs at http://localhost:3000/api-docs
```

### Running Tests

```bash
npm test
```

---

## Project Structure

```
src/
├── config/
│   ├── index.ts          # Environment config with validation
│   ├── database.ts       # Prisma client singleton + connection management
│   └── swagger.ts        # OpenAPI 3.0 spec + Swagger configuration
├── types/
│   └── index.ts          # Domain types, interfaces, error classes
├── repositories/
│   └── contact.repository.ts  # Data access layer (Prisma)
├── services/
│   └── contact.service.ts     # Core reconciliation logic
├── controllers/
│   └── contact.controller.ts  # HTTP request/response adapter
├── middlewares/
│   ├── validator.ts       # Zod request validation
│   └── error-handler.ts  # Global error handling
├── routes/
│   └── contact.routes.ts # Route definitions
├── utils/
│   └── logger.ts         # Winston structured logging
├── app.ts                # Express app factory (composition root)
└── server.ts             # Bootstrap & graceful shutdown
tests/
└── contact.service.test.ts  # Unit tests with in-memory mock repository
```

---

## Identity Reconciliation Algorithm

1. **Find matches:** Query all contacts matching the incoming email OR phone number.
2. **Resolve primaries:** Determine the unique set of primary contacts they belong to.
3. **No match?** → Create a new primary contact.
4. **One primary?** → Check if the request has new info to add as a secondary.
5. **Multiple primaries?** → Merge them: oldest stays primary, newer ones become secondary. Re-link all orphaned secondaries.
6. **Build response:** Gather the full cluster and return consolidated data.

---

## Deployment (Render.com)

1. Push code to GitHub
2. Create a new **Web Service** on Render
3. Connect your GitHub repository
4. Configure:
   - **Build Command:** `npm ci && npx prisma generate && npx prisma migrate deploy && npm run build`
   - **Start Command:** `node dist/server.js`
5. Add a **PostgreSQL** database on Render
6. Set `DATABASE_URL` environment variable from the database connection string
7. Deploy!

Or use the included `render.yaml` for [Blueprint deploys](https://render.com/docs/blueprint-spec).

---

## Tech Stack

| Technology | Purpose |
|-----------|---------|
| **Node.js + TypeScript** | Type-safe backend runtime |
| **Express.js** | Minimal, fast HTTP framework |
| **Prisma ORM** | Type-safe database access with auto-migrations |
| **PostgreSQL** | Relational database for contact storage |
| **Swagger UI** | Interactive API documentation at `/api-docs` |
| **Zod** | Runtime request validation |
| **Winston** | Structured logging (JSON in prod, pretty in dev) |
| **Helmet** | Security headers |
| **Jest** | Unit testing with in-memory mocks |
| **Docker** | Containerised deployment |

---

## License

ISC
