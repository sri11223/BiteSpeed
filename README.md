# Bitespeed Identity Reconciliation Service

A robust backend service that reconciles customer identities across multiple purchases using different contact information (email/phone). Built with **Node.js**, **TypeScript**, **Express**, **Prisma ORM**, and **PostgreSQL**.

> **Live Endpoint:** `https://<your-render-url>/identify`

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
```

### Design Principles

| Principle | Application |
|-----------|-------------|
| **Single Responsibility** | Each layer has exactly one job: Controller handles HTTP, Service handles logic, Repository handles persistence |
| **Open/Closed** | New linking strategies or response formats can be added without modifying existing code |
| **Liskov Substitution** | `IContactRepository` can be swapped with any implementation (Prisma, raw SQL, in-memory for tests) |
| **Interface Segregation** | Minimal, focused interfaces (`IContactService`, `IContactRepository`) |
| **Dependency Inversion** | Service depends on repository *abstraction*, not Prisma directly |

---

## API

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

---

## Getting Started

### Prerequisites

- **Node.js** >= 18
- **PostgreSQL** >= 14 (or use Docker)

### Local Development

```bash
# 1. Clone the repo
git clone https://github.com/<your-username>/bitespeed-backend.git
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
```

### Using Docker

```bash
# Start PostgreSQL + App
docker-compose up --build

# The service will be available at http://localhost:3000
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
│   └── database.ts       # Prisma client singleton
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
| **Prisma ORM** | Type-safe database access with migrations |
| **PostgreSQL** | Relational database for contact storage |
| **Zod** | Runtime request validation |
| **Winston** | Structured logging (JSON in prod) |
| **Helmet** | Security headers |
| **Jest** | Unit testing with in-memory mocks |
| **Docker** | Containerised deployment |

---

## License

ISC
