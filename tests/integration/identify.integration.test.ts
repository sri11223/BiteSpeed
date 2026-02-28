/**
 * Integration tests for POST /identify endpoint.
 *
 * Uses supertest to test the full HTTP pipeline:
 *   Request → Validation → Controller → Service → Repository → Response
 *
 * These tests use an in-memory mock repository (same approach as unit tests)
 * injected into the Express app to avoid needing a real database.
 */

import express, { Application } from 'express';
import request from 'supertest';
import {
  ContactEntity,
  CreateContactData,
  IContactRepository,
  LinkPrecedence,
  UpdateContactData,
} from '../../src/types';
import { ContactService } from '../../src/services/contact.service';
import { ContactController } from '../../src/controllers/contact.controller';
import { createContactRoutes } from '../../src/routes/contact.routes';
import { errorHandler, notFoundHandler } from '../../src/middlewares/error-handler';

// ─── In-memory mock repository ──────────────────────────────────────────────

class InMemoryContactRepository implements IContactRepository {
  private contacts: ContactEntity[] = [];
  private nextId = 1;

  async findByEmail(email: string): Promise<ContactEntity[]> {
    return this.contacts.filter((c) => c.email === email && !c.deletedAt);
  }

  async findByPhone(phone: string): Promise<ContactEntity[]> {
    return this.contacts.filter((c) => c.phoneNumber === phone && !c.deletedAt);
  }

  async findByEmailOrPhone(email: string | null, phone: string | null): Promise<ContactEntity[]> {
    return this.contacts
      .filter(
        (c) =>
          !c.deletedAt &&
          ((email && c.email === email) || (phone && c.phoneNumber === phone)),
      )
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async findById(id: number): Promise<ContactEntity | null> {
    return this.contacts.find((c) => c.id === id && !c.deletedAt) ?? null;
  }

  async findByLinkedId(linkedId: number): Promise<ContactEntity[]> {
    return this.contacts.filter((c) => c.linkedId === linkedId && !c.deletedAt);
  }

  async findAllLinkedContacts(primaryIds: number[]): Promise<ContactEntity[]> {
    return this.contacts
      .filter(
        (c) =>
          !c.deletedAt &&
          (primaryIds.includes(c.id) || (c.linkedId !== null && primaryIds.includes(c.linkedId))),
      )
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async create(data: CreateContactData): Promise<ContactEntity> {
    const contact: ContactEntity = {
      id: this.nextId++,
      phoneNumber: data.phoneNumber ?? null,
      email: data.email ?? null,
      linkedId: data.linkedId ?? null,
      linkPrecedence: data.linkPrecedence,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };
    this.contacts.push(contact);
    return contact;
  }

  async update(id: number, data: UpdateContactData): Promise<ContactEntity> {
    const contact = this.contacts.find((c) => c.id === id);
    if (!contact) throw new Error(`Contact ${id} not found`);
    if (data.linkedId !== undefined) contact.linkedId = data.linkedId;
    if (data.linkPrecedence !== undefined) contact.linkPrecedence = data.linkPrecedence;
    contact.updatedAt = new Date();
    return contact;
  }

  seed(contacts: Partial<ContactEntity>[]): void {
    for (const c of contacts) {
      this.contacts.push({
        id: c.id ?? this.nextId++,
        phoneNumber: c.phoneNumber ?? null,
        email: c.email ?? null,
        linkedId: c.linkedId ?? null,
        linkPrecedence: c.linkPrecedence ?? LinkPrecedence.PRIMARY,
        createdAt: c.createdAt ?? new Date(),
        updatedAt: c.updatedAt ?? new Date(),
        deletedAt: c.deletedAt ?? null,
      });
      if (c.id && c.id >= this.nextId) this.nextId = c.id + 1;
    }
  }

  clear(): void {
    this.contacts = [];
    this.nextId = 1;
  }
}

// ─── App factory (no DB, no rate limiting, just the core pipeline) ──────────

function createTestApp(repo: InMemoryContactRepository): Application {
  const app = express();
  app.use(express.json());

  // Health check
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() });
  });

  // Wire up with the in-memory repo
  const service = new ContactService(repo);
  const controller = new ContactController(service);
  app.use('/', createContactRoutes(controller));

  // Error handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

// ─── Integration Tests ──────────────────────────────────────────────────────

describe('POST /identify — Integration', () => {
  let repo: InMemoryContactRepository;
  let app: Application;

  beforeEach(() => {
    repo = new InMemoryContactRepository();
    app = createTestApp(repo);
  });

  // ── Response shape ────────────────────────────────────────────────────

  describe('response shape', () => {
    it('should return correct JSON structure with all required fields', async () => {
      const res = await request(app)
        .post('/identify')
        .send({ email: 'test@example.com', phoneNumber: '12345' })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(res.body).toHaveProperty('contact');
      expect(res.body.contact).toHaveProperty('primaryContatctId');
      expect(res.body.contact).toHaveProperty('emails');
      expect(res.body.contact).toHaveProperty('phoneNumbers');
      expect(res.body.contact).toHaveProperty('secondaryContactIds');

      expect(typeof res.body.contact.primaryContatctId).toBe('number');
      expect(Array.isArray(res.body.contact.emails)).toBe(true);
      expect(Array.isArray(res.body.contact.phoneNumbers)).toBe(true);
      expect(Array.isArray(res.body.contact.secondaryContactIds)).toBe(true);
    });

    it('should use the spec typo: primaryContatctId (not primaryContactId)', async () => {
      const res = await request(app)
        .post('/identify')
        .send({ email: 'test@example.com' })
        .expect(200);

      expect(res.body.contact).toHaveProperty('primaryContatctId');
      expect(res.body.contact).not.toHaveProperty('primaryContactId');
    });
  });

  // ── Spec Example 1: New primary contact ───────────────────────────────

  describe('Spec Scenario: Brand new contact', () => {
    it('should create a new primary with both email and phone', async () => {
      const res = await request(app)
        .post('/identify')
        .send({ email: 'lorraine@hillvalley.edu', phoneNumber: '123456' })
        .expect(200);

      expect(res.body.contact.primaryContatctId).toBeDefined();
      expect(res.body.contact.emails).toEqual(['lorraine@hillvalley.edu']);
      expect(res.body.contact.phoneNumbers).toEqual(['123456']);
      expect(res.body.contact.secondaryContactIds).toEqual([]);
    });
  });

  // ── Spec Example 2: Secondary creation ────────────────────────────────

  describe('Spec Scenario: Create secondary contact', () => {
    it('should create secondary when phone matches but email is new', async () => {
      repo.seed([
        {
          id: 1,
          email: 'lorraine@hillvalley.edu',
          phoneNumber: '123456',
          linkPrecedence: LinkPrecedence.PRIMARY,
          createdAt: new Date('2023-04-01'),
        },
      ]);

      const res = await request(app)
        .post('/identify')
        .send({ email: 'mcfly@hillvalley.edu', phoneNumber: '123456' })
        .expect(200);

      expect(res.body.contact.primaryContatctId).toBe(1);
      expect(res.body.contact.emails).toContain('lorraine@hillvalley.edu');
      expect(res.body.contact.emails).toContain('mcfly@hillvalley.edu');
      expect(res.body.contact.phoneNumbers).toEqual(['123456']);
      expect(res.body.contact.secondaryContactIds.length).toBe(1);
    });

    it('should create secondary when email matches but phone is new', async () => {
      repo.seed([
        {
          id: 1,
          email: 'doc@hillvalley.edu',
          phoneNumber: '111111',
          linkPrecedence: LinkPrecedence.PRIMARY,
          createdAt: new Date('2023-04-01'),
        },
      ]);

      const res = await request(app)
        .post('/identify')
        .send({ email: 'doc@hillvalley.edu', phoneNumber: '222222' })
        .expect(200);

      expect(res.body.contact.primaryContatctId).toBe(1);
      expect(res.body.contact.phoneNumbers).toContain('111111');
      expect(res.body.contact.phoneNumbers).toContain('222222');
      expect(res.body.contact.secondaryContactIds.length).toBe(1);
    });
  });

  // ── Spec Example 3: Primary merge ────────────────────────────────────

  describe('Spec Scenario: Merge two primary contacts', () => {
    it('should merge: oldest stays primary, newer becomes secondary', async () => {
      repo.seed([
        {
          id: 11,
          phoneNumber: '919191',
          email: 'george@hillvalley.edu',
          linkPrecedence: LinkPrecedence.PRIMARY,
          createdAt: new Date('2023-04-11'),
        },
        {
          id: 27,
          phoneNumber: '717171',
          email: 'biffsucks@hillvalley.edu',
          linkPrecedence: LinkPrecedence.PRIMARY,
          createdAt: new Date('2023-04-21'),
        },
      ]);

      const res = await request(app)
        .post('/identify')
        .send({ email: 'george@hillvalley.edu', phoneNumber: '717171' })
        .expect(200);

      expect(res.body.contact.primaryContatctId).toBe(11);
      expect(res.body.contact.emails).toContain('george@hillvalley.edu');
      expect(res.body.contact.emails).toContain('biffsucks@hillvalley.edu');
      expect(res.body.contact.phoneNumbers).toContain('919191');
      expect(res.body.contact.phoneNumbers).toContain('717171');
      expect(res.body.contact.secondaryContactIds).toContain(27);
    });
  });

  // ── Spec: Exact duplicate request → no new records ────────────────────

  describe('Spec Scenario: Exact duplicate request', () => {
    it('should return existing contact without creating duplicates', async () => {
      repo.seed([
        {
          id: 1,
          email: 'lorraine@hillvalley.edu',
          phoneNumber: '123456',
          linkPrecedence: LinkPrecedence.PRIMARY,
          createdAt: new Date('2023-04-01'),
        },
      ]);

      const res = await request(app)
        .post('/identify')
        .send({ email: 'lorraine@hillvalley.edu', phoneNumber: '123456' })
        .expect(200);

      expect(res.body.contact.primaryContatctId).toBe(1);
      expect(res.body.contact.secondaryContactIds).toEqual([]);
    });
  });

  // ── Validation: Missing both fields ───────────────────────────────────

  describe('Validation errors', () => {
    it('should return 400 when body is empty', async () => {
      const res = await request(app)
        .post('/identify')
        .send({})
        .expect(400);

      expect(res.body.status).toBe('error');
      expect(res.body.message).toMatch(/at least one/i);
    });

    it('should return 400 when both email and phone are null', async () => {
      const res = await request(app)
        .post('/identify')
        .send({ email: null, phoneNumber: null })
        .expect(400);

      expect(res.body.status).toBe('error');
    });

    it('should return 400 for invalid email format', async () => {
      const res = await request(app)
        .post('/identify')
        .send({ email: 'not-an-email' })
        .expect(400);

      expect(res.body.status).toBe('error');
    });
  });

  // ── Edge case: phoneNumber as number type ─────────────────────────────

  describe('Phone number type coercion', () => {
    it('should accept phoneNumber as a number and coerce to string', async () => {
      const res = await request(app)
        .post('/identify')
        .send({ email: 'test@example.com', phoneNumber: 123456 })
        .expect(200);

      expect(res.body.contact.phoneNumbers).toEqual(['123456']);
    });

    it('should accept phoneNumber as string', async () => {
      const res = await request(app)
        .post('/identify')
        .send({ phoneNumber: '555-0100' })
        .expect(200);

      expect(res.body.contact.phoneNumbers).toEqual(['555-0100']);
    });
  });

  // ── Edge case: email only / phone only ────────────────────────────────

  describe('Single field requests', () => {
    it('should create primary with only email', async () => {
      const res = await request(app)
        .post('/identify')
        .send({ email: 'solo@test.com' })
        .expect(200);

      expect(res.body.contact.emails).toEqual(['solo@test.com']);
      expect(res.body.contact.phoneNumbers).toEqual([]);
    });

    it('should create primary with only phone', async () => {
      const res = await request(app)
        .post('/identify')
        .send({ phoneNumber: '9999' })
        .expect(200);

      expect(res.body.contact.emails).toEqual([]);
      expect(res.body.contact.phoneNumbers).toEqual(['9999']);
    });

    it('should return full cluster when querying by email only', async () => {
      repo.seed([
        {
          id: 1,
          email: 'a@test.com',
          phoneNumber: '111',
          linkPrecedence: LinkPrecedence.PRIMARY,
          createdAt: new Date('2023-01-01'),
        },
        {
          id: 2,
          email: 'b@test.com',
          phoneNumber: '111',
          linkedId: 1,
          linkPrecedence: LinkPrecedence.SECONDARY,
          createdAt: new Date('2023-01-02'),
        },
      ]);

      const res = await request(app)
        .post('/identify')
        .send({ email: 'a@test.com' })
        .expect(200);

      expect(res.body.contact.primaryContatctId).toBe(1);
      expect(res.body.contact.emails).toContain('a@test.com');
      expect(res.body.contact.emails).toContain('b@test.com');
      expect(res.body.contact.secondaryContactIds).toContain(2);
    });
  });

  // ── Edge case: Whitespace handling ────────────────────────────────────

  describe('Whitespace handling', () => {
    it('should trim whitespace from email', async () => {
      const res = await request(app)
        .post('/identify')
        .send({ email: '  test@example.com  ', phoneNumber: '123' })
        .expect(200);

      expect(res.body.contact.emails).toEqual(['test@example.com']);
    });

    it('should treat whitespace-only phone as null', async () => {
      const res = await request(app)
        .post('/identify')
        .send({ email: 'test@example.com', phoneNumber: '   ' })
        .expect(200);

      expect(res.body.contact.emails).toEqual(['test@example.com']);
      expect(res.body.contact.phoneNumbers).toEqual([]);
    });
  });

  // ── Edge case: Idempotent repeated requests ───────────────────────────

  describe('Idempotency', () => {
    it('should not create duplicates on repeated identical requests', async () => {
      // First request: creates a new primary
      await request(app)
        .post('/identify')
        .send({ email: 'repeat@test.com', phoneNumber: '000' })
        .expect(200);

      // Second identical request
      const res = await request(app)
        .post('/identify')
        .send({ email: 'repeat@test.com', phoneNumber: '000' })
        .expect(200);

      expect(res.body.contact.secondaryContactIds).toEqual([]);
    });
  });

  // ── Edge case: Chain of 3+ linked contacts ────────────────────────────

  describe('Deep contact chains', () => {
    it('should return all contacts in a 3-deep chain', async () => {
      repo.seed([
        {
          id: 1,
          email: 'a@test.com',
          phoneNumber: '111',
          linkPrecedence: LinkPrecedence.PRIMARY,
          createdAt: new Date('2023-01-01'),
        },
        {
          id: 2,
          email: 'b@test.com',
          phoneNumber: '111',
          linkedId: 1,
          linkPrecedence: LinkPrecedence.SECONDARY,
          createdAt: new Date('2023-01-02'),
        },
        {
          id: 3,
          email: 'b@test.com',
          phoneNumber: '222',
          linkedId: 1,
          linkPrecedence: LinkPrecedence.SECONDARY,
          createdAt: new Date('2023-01-03'),
        },
      ]);

      const res = await request(app)
        .post('/identify')
        .send({ phoneNumber: '222' })
        .expect(200);

      expect(res.body.contact.primaryContatctId).toBe(1);
      expect(res.body.contact.emails).toEqual(['a@test.com', 'b@test.com']);
      expect(res.body.contact.phoneNumbers).toEqual(['111', '222']);
      expect(res.body.contact.secondaryContactIds).toEqual([2, 3]);
    });
  });

  // ── Edge case: Merge with orphaned secondaries ────────────────────────

  describe('Merge with orphaned secondaries', () => {
    it('should re-link orphaned secondaries to winning primary', async () => {
      repo.seed([
        {
          id: 1,
          email: 'a@test.com',
          phoneNumber: '111',
          linkPrecedence: LinkPrecedence.PRIMARY,
          createdAt: new Date('2023-01-01'),
        },
        {
          id: 2,
          email: 'a-extra@test.com',
          phoneNumber: '111',
          linkedId: 1,
          linkPrecedence: LinkPrecedence.SECONDARY,
          createdAt: new Date('2023-01-02'),
        },
        {
          id: 10,
          email: 'b@test.com',
          phoneNumber: '222',
          linkPrecedence: LinkPrecedence.PRIMARY,
          createdAt: new Date('2023-02-01'),
        },
        {
          id: 11,
          email: 'b-extra@test.com',
          phoneNumber: '222',
          linkedId: 10,
          linkPrecedence: LinkPrecedence.SECONDARY,
          createdAt: new Date('2023-02-02'),
        },
      ]);

      const res = await request(app)
        .post('/identify')
        .send({ email: 'a@test.com', phoneNumber: '222' })
        .expect(200);

      expect(res.body.contact.primaryContatctId).toBe(1);
      // Contact 10 should now be in secondaryContactIds
      expect(res.body.contact.secondaryContactIds).toContain(10);
      // All emails and phones should be present
      expect(res.body.contact.emails).toContain('a@test.com');
      expect(res.body.contact.emails).toContain('b@test.com');
      expect(res.body.contact.phoneNumbers).toContain('111');
      expect(res.body.contact.phoneNumbers).toContain('222');
    });
  });

  // ── Primary contact's data comes first ────────────────────────────────

  describe('Response ordering', () => {
    it('should list primary email/phone first in arrays', async () => {
      repo.seed([
        {
          id: 1,
          email: 'primary@test.com',
          phoneNumber: '100',
          linkPrecedence: LinkPrecedence.PRIMARY,
          createdAt: new Date('2023-01-01'),
        },
        {
          id: 2,
          email: 'secondary@test.com',
          phoneNumber: '200',
          linkedId: 1,
          linkPrecedence: LinkPrecedence.SECONDARY,
          createdAt: new Date('2023-01-02'),
        },
      ]);

      const res = await request(app)
        .post('/identify')
        .send({ email: 'secondary@test.com' })
        .expect(200);

      // Primary's data should come first
      expect(res.body.contact.emails[0]).toBe('primary@test.com');
      expect(res.body.contact.phoneNumbers[0]).toBe('100');
    });
  });
});

// ─── Health endpoint tests ──────────────────────────────────────────────────

describe('GET /health', () => {
  let app: Application;

  beforeEach(() => {
    const repo = new InMemoryContactRepository();
    app = createTestApp(repo);
  });

  it('should return 200 with status ok', async () => {
    const res = await request(app).get('/health').expect(200);

    expect(res.body.status).toBe('ok');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('uptime');
  });
});

// ─── 404 endpoint tests ────────────────────────────────────────────────────

describe('Unknown routes', () => {
  let app: Application;

  beforeEach(() => {
    const repo = new InMemoryContactRepository();
    app = createTestApp(repo);
  });

  it('should return 404 for GET /identify', async () => {
    await request(app).get('/identify').expect(404);
  });

  it('should return 404 for unknown routes', async () => {
    await request(app).get('/nonexistent').expect(404);
  });

  it('should return 404 for POST /unknown', async () => {
    await request(app).post('/unknown').send({}).expect(404);
  });
});
