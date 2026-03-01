# Architecture: Bitespeed Identity Reconciliation

> *"Great Scott! If my calculations are correct, when this service hits the database at 88 requests per second... you're gonna see some serious identity linking."*  
> — Doc Brown, probably

---

## The Big Picture

Think of this system as a **detective** 🔍. A customer walks into FluxKart.com with an email and a phone number. The detective's job? Figure out: *"Have I seen this person before, perhaps in disguise?"*

```
                          ┌─────────────────────────────────────────────┐
                          │              THE OUTSIDE WORLD              │
                          │                                             │
                          │   FluxKart.com checkout → POST /identify    │
                          │   Frontend tester → http://localhost:5173   │
                          └───────────────────┬─────────────────────────┘
                                              │
                                              ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                          🛡️  SECURITY PERIMETER                            │
│                                                                              │
│   Helmet (headers) → CORS → Rate Limiter (100 req/min) → Body Parser (1MB) │
└──────────────────────────────────┬───────────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│   📋 VALIDATOR (Zod)                                                        │
│   ┌─────────────────────────────────────────────────────┐                   │
│   │  • At least one of email/phoneNumber required       │                   │
│   │  • Email: trim whitespace → validate format         │                   │
│   │  • Phone: coerce number → string, trim              │                   │
│   │  • Reject: empty body, both null, invalid email     │                   │
│   └─────────────────────────────────────────────────────┘                   │
│                                                                              │
└──────────────────────────────────┬───────────────────────────────────────────┘
                                   │
                          ┌────────▼────────┐
                          │   CONTROLLER    │  ← Thin HTTP adapter
                          │                 │     Knows: req/res
                          │  "Translate     │     Doesn't know: DB, logic
                          │   HTTP to       │
                          │   domain"       │
                          └────────┬────────┘
                                   │
                                   │  IdentifyRequestDTO
                                   ▼
                   ┌───────────────────────────────┐
                   │          🧠 SERVICE           │  ← The Brain
                   │                               │
                   │   ContactService.identify()   │
                   │                               │
                   │   This is where the magic     │
                   │   happens. 274 lines of pure  │
                   │   identity reconciliation.    │
                   └───────────────┬───────────────┘
                                   │
                                   │  IContactRepository (interface)
                                   ▼
                   ┌───────────────────────────────┐
                   │       📦 REPOSITORY           │  ← Data gatekeeper
                   │                               │
                   │   ContactRepository (Prisma)  │
                   │                               │
                   │   Could be swapped for:       │
                   │   • Raw SQL implementation    │
                   │   • In-memory (tests use this)│
                   │   • Redis cache layer         │
                   └───────────────┬───────────────┘
                                   │
                                   ▼
                          ┌─────────────────┐
                          │   PostgreSQL    │
                          │   ┌───────────┐ │
                          │   │ Contact   │ │
                          │   │  table    │ │
                          │   └───────────┘ │
                          └─────────────────┘
```

---

## The Identity Reconciliation Algorithm

This is the heart of the service. Here's how the detective thinks:

```
            ┌──────────────────────────┐
            │   Incoming Request       │
            │   email? phoneNumber?    │
            └────────────┬─────────────┘
                         │
                         ▼
            ┌──────────────────────────┐
            │  🔍 SEARCH the database  │
            │  Find ALL contacts where │
            │  email = X OR phone = Y  │
            └────────────┬─────────────┘
                         │
               ┌─────────┴─────────┐
               │                   │
          No matches          Has matches
               │                   │
               ▼                   ▼
     ┌──────────────┐   ┌───────────────────┐
     │ CREATE new   │   │ How many UNIQUE   │
     │ PRIMARY      │   │ primary contacts? │
     │ contact      │   └────────┬──────────┘
     └──────────────┘            │
                        ┌────────┴────────┐
                        │                 │
                   One primary      Multiple primaries
                        │                 │
                        ▼                 ▼
              ┌──────────────┐  ┌───────────────────┐
              │ Has NEW info │  │ 🔗 MERGE!         │
              │ to add?      │  │                   │
              └──────┬───────┘  │ Oldest → stays    │
                     │          │            primary │
               ┌─────┴─────┐   │                   │
               │           │   │ Newer → become     │
            No info     New!   │          secondary │
               │           │   │                   │
               ▼           ▼   │ Re-link all       │
           (return     CREATE  │ orphaned children  │
            as-is)    SECONDARY└───────────────────┘
                        │
                        ▼
            ┌──────────────────────────┐
            │  📊 BUILD RESPONSE       │
            │                          │
            │  Gather full cluster:    │
            │  • Primary + all linked  │
            │  • Emails (primary first)│
            │  • Phones (primary first)│
            │  • Deduplicate           │
            │  • Sort secondary IDs    │
            └──────────────────────────┘
```

### The Merge in Action (Spec Example)

```
 BEFORE                                           AFTER
 ══════                                           ═════

 ┌──────────────────┐  ┌──────────────────┐      ┌──────────────────┐
 │ PRIMARY (id: 11) │  │ PRIMARY (id: 27) │      │ PRIMARY (id: 11) │  ← Oldest wins!
 │ george@          │  │ biffsucks@       │      │ george@          │
 │ hillvalley.edu   │  │ hillvalley.edu   │      │ hillvalley.edu   │
 │ phone: 919191    │  │ phone: 717171    │      │ phone: 919191    │
 └──────────────────┘  └──────────────────┘      └────────┬─────────┘
       (no link)             (no link)                     │
                                                           │ linkedId = 11
            ┌───────────────────────────┐                  │
            │ Request:                  │         ┌────────▼─────────┐
            │ email: george@hillvalley  │         │ SECONDARY (id:27)│
            │ phone: 717171             │         │ biffsucks@       │
            │                           │         │ hillvalley.edu   │
            │ "These two are the        │         │ phone: 717171    │
            │  SAME PERSON!"            │         └──────────────────┘
            └───────────────────────────┘
```

---

## SOLID Principles — Why It Matters

### The Dependency Chain

```
┌─────────────────────────────────────────────────────────────┐
│                     app.ts (Composition Root)                │
│                                                              │
│   const repo = new ContactRepository(prisma);   ← Concrete  │
│   const service = new ContactService(repo);     ← Abstract  │
│   const controller = new ContactController(svc);← Abstract  │
│                                                              │
│   Only THIS file knows about concrete implementations.      │
│   Everything else talks through interfaces.                  │
└─────────────────────────────────────────────────────────────┘

         Controller                Service               Repository
    ┌────────────────┐      ┌────────────────┐     ┌────────────────┐
    │ Knows about:   │      │ Knows about:   │     │ Knows about:   │
    │ • HTTP req/res │      │ • Business rules│     │ • Database     │
    │ • IContactSvc  │      │ • IContactRepo │     │ • Prisma ORM   │
    │                │      │                │     │                │
    │ Doesn't know:  │      │ Doesn't know:  │     │ Doesn't know:  │
    │ • Database     │      │ • HTTP         │     │ • HTTP         │
    │ • Prisma       │      │ • Prisma       │     │ • Business     │
    │ • Business     │      │ • Express      │     │   rules        │
    │   rules        │      │                │     │                │
    └────────────────┘      └────────────────┘     └────────────────┘
```

### Testing Benefit

```
  PRODUCTION                          TESTING
  ══════════                          ═══════

  ContactService                      ContactService
       │                                   │
       │ IContactRepository                │ IContactRepository
       ▼                                   ▼
  ┌──────────────────┐              ┌──────────────────┐
  │ ContactRepository│              │ MockRepository   │
  │ (Prisma + PG)    │              │ (In-memory Map)  │
  └──────────────────┘              └──────────────────┘

  Same service code, zero database needed for 23 unit tests.
  Runs in ~2 seconds, not 20.
```

---

## Frontend Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        App.tsx                                │
│                     (Layout Shell)                            │
│                                                              │
│  ┌─────────┐  ┌──────────────────────────────────────────┐  │
│  │ Header  │  │              useIdentify()                │  │
│  │ Health  │  │  Custom hook — State management for:      │  │
│  │ Status  │  │  • loading, response, error, history     │  │
│  │ (polls) │  │  • identify(), clearHistory()            │  │
│  └─────────┘  └────────────┬─────────────────────────────┘  │
│                             │                                │
│       Props flow DOWN       │       Events flow UP           │
│               ┌─────────────┼──────────────┐                │
│               │             │              │                │
│               ▼             ▼              ▼                │
│  ┌──────────────┐ ┌───────────────┐ ┌──────────────────┐   │
│  │ IdentifyForm │ │ResponseViewer │ │ RequestHistory   │   │
│  │              │ │               │ │                  │   │
│  │ • Validation │ │ • Card view   │ │ • Click replay   │   │
│  │ • 7 presets  │ │ • SVG graph   │ │ • Clear history  │   │
│  │ • Submit     │ │ • Raw JSON    │ │ • Timestamps     │   │
│  └──────────────┘ └───────────────┘ └──────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           Reusable UI Primitives                      │   │
│  │   Button │ Input │ Card │ Badge                       │   │
│  │   (variants, sizes, loading states, forwardRef)       │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘

         │ fetch()                    ▲ JSON response
         ▼                            │
    ┌─────────────────────────────────────────────────┐
    │  services/api.ts                                 │
    │                                                  │
    │  identifyContact() → POST /identify              │
    │  checkHealth()     → GET /health                 │
    │                                                  │
    │  Vite proxy: localhost:5173 → localhost:3000      │
    └─────────────────────────────────────────────────┘
```

---

## Data Flow: A Complete Request Journey

Here's what happens when Doc Brown clicks "Identify" on the frontend:

```
 Step  │ Where                  │ What Happens
 ──────┼────────────────────────┼─────────────────────────────────────────
   1   │ Browser                │ User clicks "Identify" button
   2   │ IdentifyForm.tsx       │ Validates: at least email or phone
   3   │ useIdentify hook       │ Sets loading=true, clears previous
   4   │ api.ts                 │ fetch('POST /identify', { email, phone })
   5   │ Vite dev proxy         │ localhost:5173/identify → localhost:3000
   6   │ Express middleware     │ Helmet → CORS → Rate limit → JSON parse
   7   │ Zod validator          │ Trim whitespace, coerce types, validate
   8   │ ContactController      │ Extracts DTO, calls service.identify()
   9   │ ContactService         │ ─┬─ findByEmailOrPhone()
       │                        │  ├─ Resolve primary IDs
       │                        │  ├─ Merge if multiple primaries
       │                        │  ├─ Create secondary if new info
       │                        │  └─ Build consolidated response
  10   │ ContactRepository      │ Prisma queries → PostgreSQL
  11   │ PostgreSQL             │ SELECT/INSERT/UPDATE on Contact table
  12   │ ← Response bubbles up  │ Repository → Service → Controller → HTTP 200
  13   │ useIdentify hook       │ Sets response, adds to history
  14   │ ResponseViewer         │ Renders card view + SVG graph + raw JSON
  15   │ RequestHistory         │ Entry appears with timestamp, click to replay
```

---

## Database Schema

```sql
┌─────────────────────────────────────────────────┐
│                   Contact                        │
├─────────────────────────────────────────────────┤
│ id              SERIAL PRIMARY KEY               │
│ phoneNumber     VARCHAR          NULLABLE         │
│ email           VARCHAR          NULLABLE         │
│ linkedId        INT → Contact.id NULLABLE (FK)    │
│ linkPrecedence  ENUM('primary', 'secondary')      │
│ createdAt       TIMESTAMP        NOT NULL          │
│ updatedAt       TIMESTAMP        NOT NULL          │
│ deletedAt       TIMESTAMP        NULLABLE          │
├─────────────────────────────────────────────────┤
│ INDEX on (email)                                 │
│ INDEX on (phoneNumber)                           │
│ INDEX on (linkedId)                              │
└─────────────────────────────────────────────────┘

Relationships:
  Contact.linkedId → Contact.id  (self-referencing FK)
  
  Primary:   linkedId = NULL,  linkPrecedence = 'primary'
  Secondary: linkedId = <primary's id>, linkPrecedence = 'secondary'
```

---

## Security Layers

```
Request arrives
     │
     ├─→ Helmet         : Sets 11+ security headers (X-Frame-Options,
     │                     Content-Security-Policy, HSTS, etc.)
     │
     ├─→ CORS           : Configurable allowed origins
     │
     ├─→ Rate Limiter   : 100 requests per 60s window per IP
     │                     Returns 429 Too Many Requests
     │
     ├─→ Body Parser    : 1MB limit, rejects oversized payloads
     │
     ├─→ Zod Validator  : Schema validation — rejects malformed input
     │                     before it reaches business logic
     │
     └─→ Prisma ORM     : Parameterized queries — SQL injection impossible
```

---

## File Map

```
bitespeed-backend/
│
├── backend/                          # Express + TypeScript + Prisma
│   ├── src/
│   │   ├── config/
│   │   │   ├── index.ts              # Env vars with defaults
│   │   │   ├── database.ts           # Prisma client singleton
│   │   │   └── swagger.ts            # OpenAPI 3.0 spec (334 lines)
│   │   ├── types/
│   │   │   └── index.ts              # DTOs, entities, interfaces, errors
│   │   ├── repositories/
│   │   │   └── contact.repository.ts # Prisma data access
│   │   ├── services/
│   │   │   └── contact.service.ts    # THE ALGORITHM (274 lines)
│   │   ├── controllers/
│   │   │   └── contact.controller.ts # HTTP adapter
│   │   ├── middlewares/
│   │   │   ├── validator.ts          # Zod schemas
│   │   │   └── error-handler.ts      # Global catch-all
│   │   ├── routes/
│   │   │   └── contact.routes.ts     # POST /identify
│   │   ├── utils/
│   │   │   └── logger.ts             # Winston
│   │   ├── app.ts                    # Composition root
│   │   └── server.ts                 # Bootstrap + graceful shutdown
│   ├── tests/
│   │   ├── contact.service.test.ts   # 23 unit tests
│   │   └── integration/
│   │       └── identify.integration.test.ts  # 25 HTTP tests
│   ├── scripts/
│   │   └── load-test.ts              # Autocannon (4 scenarios)
│   ├── prisma/
│   │   └── schema.prisma             # DB schema
│   ├── Dockerfile                    # Multi-stage build
│   ├── docker-compose.yml            # PG + App
│   └── render.yaml                   # Render.com blueprint
│
├── frontend/                         # React 19 + Vite + Tailwind v4
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/                   # Reusable primitives
│   │   │   │   ├── Button.tsx        # Variants, sizes, loading
│   │   │   │   ├── Input.tsx         # Labels, errors, hints
│   │   │   │   ├── Card.tsx          # Title, subtitle, shadow
│   │   │   │   └── Badge.tsx         # 6 color variants
│   │   │   ├── Header.tsx            # Health indicator (15s poll)
│   │   │   ├── IdentifyForm.tsx      # 7 spec-based presets
│   │   │   ├── ResponseViewer.tsx    # Card + SVG graph + JSON
│   │   │   └── RequestHistory.tsx    # Replay past requests
│   │   ├── hooks/
│   │   │   └── useIdentify.ts        # State management hook
│   │   ├── services/
│   │   │   └── api.ts                # fetch() client
│   │   ├── types/
│   │   │   └── index.ts              # Shared TS types
│   │   ├── App.tsx                   # 3-column layout
│   │   └── main.tsx                  # React root
│   └── vite.config.ts               # Proxy + Tailwind plugin
│
└── README.md                         # You are here
```

---

## Why These Technology Choices?

| Decision | Alternative Considered | Why This Was Chosen |
|----------|----------------------|-------------------|
| **Prisma** over raw `pg` | Less code, type-safe, zero SQL injection risk. The `IContactRepository` interface means we can swap to raw SQL anytime without touching the service layer. |
| **Zod** over `joi`/`yup` | First-class TypeScript inference, smaller bundle, `.transform().pipe()` pattern for trim-then-validate. |
| **Winston** over `console.log` | Structured JSON logs in production, pretty logs in development. Production-ready from day one. |
| **Jest** over `vitest` | Mature ecosystem, supertest integration works seamlessly, ts-jest for TypeScript. |
| **Tailwind v4** over CSS modules | Utility-first, no context switching, `@tailwindcss/vite` plugin — zero config. |
| **Vite** over CRA/webpack | 10x faster HMR, native ESM, built-in proxy for API calls, TypeScript out of the box. |

---

*Built with care for the Bitespeed assignment. Every line serves a purpose.* ⚡
