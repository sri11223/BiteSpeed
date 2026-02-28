# Bitespeed Identity Reconciliation

A full-stack application for reconciling customer identities across multiple purchases. Customers may use different email addresses and phone numbers — this service links them all together into a consolidated view.

> **Assignment:** [Bitespeed Backend Task](https://bitespeed.io/backend-task)

---

## Repository Structure

```
├── backend/          ← Express + TypeScript + Prisma + PostgreSQL
│   ├── src/          ← Source code (layered architecture)
│   ├── tests/        ← Unit + Integration tests (48 tests, 95%+ coverage)
│   ├── scripts/      ← Load testing scripts
│   ├── prisma/       ← Database schema + migrations
│   └── ...
├── frontend/         ← React + TypeScript + Tailwind CSS (Vite)
│   ├── src/
│   │   ├── components/   ← Reusable UI components
│   │   ├── hooks/        ← Custom React hooks
│   │   ├── services/     ← API client
│   │   └── types/        ← Shared TypeScript types
│   └── ...
└── README.md         ← You are here
```

## Quick Start

### Backend

```bash
cd backend
npm install
cp .env.example .env         # Configure DATABASE_URL
npx prisma migrate dev       # Run migrations
npm run dev                   # Starts on http://localhost:3000
```

### Frontend

```bash
cd frontend
npm install
npm run dev                   # Starts on http://localhost:5173
```

The frontend proxies `/identify` and `/health` requests to `http://localhost:3000` automatically via Vite's dev server proxy.

---

## Architecture

### Backend (SOLID + Clean Architecture)

```
Client → Controller (HTTP) → Service (Business Logic) → Repository (Data Access) → PostgreSQL
```

| Principle | Implementation |
|-----------|---------------|
| **Single Responsibility** | Each layer has one job |
| **Open/Closed** | Add new strategies without modifying existing code |
| **Liskov Substitution** | `IContactRepository` can be Prisma, raw SQL, or in-memory |
| **Interface Segregation** | Minimal, focused interfaces |
| **Dependency Inversion** | Service depends on abstractions, not concrete Prisma |

### Frontend (Component-based)

| Component | Purpose |
|-----------|---------|
| `ui/Button`, `Input`, `Card`, `Badge` | Reusable primitive UI components |
| `Header` | App branding + live API health indicator |
| `IdentifyForm` | Form with validation + quick-fill presets |
| `ResponseViewer` | Visual contact cluster + SVG graph + raw JSON |
| `RequestHistory` | Clickable history sidebar with replay |
| `useIdentify` hook | Encapsulates API calls, loading/error state, history |

---

## Features

- **POST /identify** — Core identity reconciliation endpoint
- **GET /health** — Health check with uptime
- **Swagger UI** — Interactive API docs at `/api-docs`
- **Frontend tester** — Visual tool to test the API with quick presets
- **Contact graph** — SVG visualization of primary → secondary links
- **Request history** — Replay past requests with one click
- **48 automated tests** — Unit + integration with 95%+ coverage
- **Load testing** — Autocannon script with 4 scenarios

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Node.js, TypeScript, Express, Prisma, PostgreSQL |
| **Frontend** | React 19, TypeScript, Tailwind CSS, Vite |
| **Testing** | Jest, Supertest, Autocannon |
| **Docs** | Swagger/OpenAPI 3.0 |
| **DevOps** | Docker, docker-compose, Render.com |

---

## API Endpoint

### POST /identify

```json
// Request
{ "email": "mcfly@hillvalley.edu", "phoneNumber": "123456" }

// Response
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["lorraine@hillvalley.edu", "mcfly@hillvalley.edu"],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": [23]
  }
}
```

---

## Testing

```bash
cd backend
npm test                      # All 48 tests with coverage
npm run test:unit             # Unit tests only
npm run test:integration      # Integration tests only
npm run load-test             # Load testing (server must be running)
```

## Deployment

See [backend/README.md](backend/README.md) for detailed deployment instructions (Docker, Render.com).

---

## License

ISC
