# Bitespeed Identity Reconciliation

A full-stack application for reconciling customer identities across multiple purchases. Customers may use different email addresses and phone numbers — this service links them all together into a consolidated view.

> **Assignment:** [Bitespeed Backend Task](https://bitespeed.io/backend-task)  
> **GitHub:** [sri11223/BiteSpeed](https://github.com/sri11223/BiteSpeed)  
> **Live Frontend:** [https://bite-speed-henna.vercel.app](https://bite-speed-henna.vercel.app)  
> **Live API:** [https://bitespeed-1-s82e.onrender.com](https://bitespeed-1-s82e.onrender.com)  
> **Swagger Docs:** [https://bitespeed-1-s82e.onrender.com/api-docs](https://bitespeed-1-s82e.onrender.com/api-docs)  
> **Architecture Deep-Dive:** [ARCHITECTURE.md](ARCHITECTURE.md)

---

## Repository Structure

```
├── backend/          ← Express + TypeScript + Prisma + PostgreSQL
│   ├── src/          ← Source code (layered architecture)
│   ├── tests/        ← Unit + Integration tests (48 tests, 95%+ coverage)
│   ├── scripts/      ← Load testing scripts
│   ├── prisma/       ← Database schema + migrations
│   ├── Dockerfile
│   └── docker-compose.yml
├── frontend/         ← React 19 + TypeScript + Tailwind CSS v4 (Vite)
│   ├── src/
│   │   ├── components/   ← Reusable UI components (Button, Input, Card, Badge)
│   │   ├── hooks/        ← Custom React hooks (useIdentify)
│   │   ├── services/     ← API client (fetch-based)
│   │   └── types/        ← Shared TypeScript types
│   └── ...
├── package.json      ← Monorepo root scripts
└── README.md         ← You are here
```

---

## Quick Start

### Prerequisites

- **Node.js** >= 18
- **PostgreSQL** >= 14 (or use Docker)

### 1. Start the Database

```bash
cd backend
docker compose up -d db        # Starts PostgreSQL in Docker
```

Or connect to your own PostgreSQL instance — edit `backend/.env`:
```
DATABASE_URL="postgresql://user:pass@localhost:5432/bitespeed?schema=public"
```

### 2. Start the Backend

```bash
cd backend
npm install
cp .env.example .env           # Configure DATABASE_URL
npx prisma migrate dev         # Run migrations
npm run dev                    # Starts on http://localhost:3000
```

### 3. Start the Frontend

```bash
cd frontend
npm install
npm run dev                    # Starts on http://localhost:5173
```

The frontend proxies `/identify` and `/health` requests to `http://localhost:3000` automatically via Vite's dev server proxy.

### Using Docker (Backend + DB)

```bash
cd backend
docker compose up --build      # Starts PostgreSQL + Express app
# Service at http://localhost:3000
# API docs at http://localhost:3000/api-docs
```

---

## API Endpoint

### `POST /identify`

Reconciles a customer identity from email and/or phone number.

**Request:**
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
Health check with uptime info.

### `GET /api-docs`
Interactive Swagger UI documentation.

---

## Architecture

### Backend — SOLID + Clean Layered Architecture

```
Client → Controller (HTTP) → Service (Business Logic) → Repository (Data Access) → PostgreSQL
```

| Principle | Implementation |
|-----------|---------------|
| **Single Responsibility** | Each layer has exactly one job |
| **Open/Closed** | New linking strategies can be added without modifying existing code |
| **Liskov Substitution** | `IContactRepository` can be Prisma, raw SQL, or in-memory (tests) |
| **Interface Segregation** | Minimal, focused interfaces |
| **Dependency Inversion** | Service depends on abstractions, not concrete Prisma |

### Frontend — Component-based Architecture

| Component | Purpose |
|-----------|---------|
| `ui/Button`, `Input`, `Card`, `Badge` | Reusable primitive UI components |
| `Header` | App branding + live API health indicator (polling) |
| `IdentifyForm` | Form with validation + 6 quick-fill presets from spec |
| `ResponseViewer` | Visual contact cluster + SVG graph + raw JSON |
| `RequestHistory` | Clickable history sidebar with replay |
| `useIdentify` hook | Encapsulates API calls, loading/error state, history |

---

## Identity Reconciliation Algorithm

1. **Find matches:** Query all contacts matching the incoming email OR phone number
2. **Resolve primaries:** Determine the unique set of primary contacts they belong to
3. **No match?** → Create a new primary contact
4. **One primary?** → Check if the request has new info — create secondary if needed
5. **Multiple primaries?** → Merge: oldest stays primary, newer ones become secondary. Re-link all orphaned secondaries
6. **Build response:** Gather the full cluster and return consolidated data (primary's info first)

### Database Schema

```sql
Contact {
  id            Int        @id @default(autoincrement())
  phoneNumber   String?
  email         String?
  linkedId      Int?       -- FK to primary Contact
  linkPrecedence "primary" | "secondary"
  createdAt     DateTime
  updatedAt     DateTime
  deletedAt     DateTime?
}
```

---

## Testing

```bash
cd backend
npm test                      # All 48 tests with coverage
npm run test:unit             # 23 unit tests (service layer)
npm run test:integration      # 25 HTTP integration tests
npm run load-test             # Load testing (server must be running)
```

### Test Coverage

| Suite | Tests | Coverage |
|-------|-------|----------|
| **Unit** (`contact.service.test.ts`) | 23 | 98.75% lines on service |
| **Integration** (`identify.integration.test.ts`) | 25 | Full HTTP pipeline |
| **Total** | **48** | **95%+ overall** |

**Scenarios covered:** New primary creation, secondary creation, primary merge (oldest wins), 2-way & 3-way merges, orphan re-linking, deep chains, exact duplicates, idempotency, null fields, phone coercion, whitespace trimming, validation errors, response ordering, email/phone deduplication.

### Load Testing

4 scenarios with Autocannon:
1. Health endpoint baseline (10 connections, 10s)
2. New contact creation (10 connections, 10s)
3. Existing contact lookup (10 connections, 10s)
4. High concurrency stress (50 connections, 15s)

---

## Backend Project Structure

```
backend/src/
├── config/
│   ├── index.ts              # Environment config with validation
│   ├── database.ts           # Prisma client singleton + connection management
│   └── swagger.ts            # OpenAPI 3.0 spec + Swagger configuration
├── types/index.ts            # Domain types, interfaces, error classes
├── repositories/
│   └── contact.repository.ts # Data access layer (Prisma, implements IContactRepository)
├── services/
│   └── contact.service.ts    # Core reconciliation logic
├── controllers/
│   └── contact.controller.ts # HTTP request/response adapter
├── middlewares/
│   ├── validator.ts          # Zod request validation
│   └── error-handler.ts      # Global error handling
├── routes/contact.routes.ts  # Route definitions
├── utils/logger.ts           # Winston structured logging
├── app.ts                    # Express app factory (composition root)
└── server.ts                 # Bootstrap & graceful shutdown
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Node.js, TypeScript 5.6, Express 4, Prisma 5, PostgreSQL |
| **Frontend** | React 19, TypeScript 5.9, Tailwind CSS v4, Vite 7 |
| **Validation** | Zod (runtime), TypeScript (compile-time) |
| **Logging** | Winston (JSON in prod, pretty in dev) |
| **Security** | Helmet, express-rate-limit, CORS |
| **Testing** | Jest 29, Supertest, Autocannon |
| **Docs** | Swagger/OpenAPI 3.0 at `/api-docs` |
| **DevOps** | Docker, docker-compose, Render.com |

---

## Deployment

### Backend — [Render.com](https://render.com)

1. Push code to GitHub
2. Create a new **Web Service** on Render → connect repo
3. Set **Root Directory** to `backend`
4. **Build Command:** `npm install && npx prisma generate && npx prisma db push --accept-data-loss && npm run build`
5. **Start Command:** `node dist/server.js`
6. Add a **PostgreSQL** database (or reuse an existing one)
7. Set `DATABASE_URL` env var to the internal database connection string
8. Deploy!

> Live at: https://bitespeed-1-s82e.onrender.com

### Frontend — [Vercel](https://vercel.com)

1. Import the repo on Vercel
2. Set **Root Directory** to `frontend`
3. Set **Framework Preset** to Vite
4. Add env variable `VITE_API_URL` = `https://bitespeed-1-s82e.onrender.com`
5. Deploy!

> Live at: https://bite-speed-henna.vercel.app

---

## License

ISC
