/**
 * Unit tests for ContactService — the core identity reconciliation logic.
 * 
 * Uses an in-memory mock repository so tests run fast with no DB dependency.
 * Tests cover all scenarios from the Bitespeed spec:
 * 
 * 1. New contact → creates primary
 * 2. Existing contact match → returns consolidated
 * 3. Partial match → creates secondary
 * 4. Multiple primaries → merges (oldest wins)
 * 5. Validation → rejects empty requests
 */

import { ContactService } from '../src/services/contact.service';
import {
  ContactEntity,
  CreateContactData,
  IContactRepository,
  LinkPrecedence,
  UpdateContactData,
} from '../src/types';

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
    return this.contacts.filter(
      (c) =>
        !c.deletedAt &&
        ((email && c.email === email) || (phone && c.phoneNumber === phone)),
    ).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
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

  // ─── Test helpers ───────────────────────────────────────────────────────

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
      if (c.id && c.id >= this.nextId) {
        this.nextId = c.id + 1;
      }
    }
  }

  clear(): void {
    this.contacts = [];
    this.nextId = 1;
  }

  getAll(): ContactEntity[] {
    return [...this.contacts];
  }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('ContactService', () => {
  let repo: InMemoryContactRepository;
  let service: ContactService;

  beforeEach(() => {
    repo = new InMemoryContactRepository();
    service = new ContactService(repo);
  });

  // ── Scenario 1: Brand new contact ─────────────────────────────────────

  describe('when no existing contacts match', () => {
    it('should create a new primary contact', async () => {
      const result = await service.identify({
        email: 'lorraine@hillvalley.edu',
        phoneNumber: '123456',
      });

      expect(result.contact.primaryContatctId).toBeDefined();
      expect(result.contact.emails).toEqual(['lorraine@hillvalley.edu']);
      expect(result.contact.phoneNumbers).toEqual(['123456']);
      expect(result.contact.secondaryContactIds).toEqual([]);
    });

    it('should create primary with only email', async () => {
      const result = await service.identify({
        email: 'doc@hillvalley.edu',
        phoneNumber: null,
      });

      expect(result.contact.emails).toEqual(['doc@hillvalley.edu']);
      expect(result.contact.phoneNumbers).toEqual([]);
      expect(result.contact.secondaryContactIds).toEqual([]);
    });

    it('should create primary with only phone', async () => {
      const result = await service.identify({
        email: null,
        phoneNumber: '555-0100',
      });

      expect(result.contact.emails).toEqual([]);
      expect(result.contact.phoneNumbers).toEqual(['555-0100']);
      expect(result.contact.secondaryContactIds).toEqual([]);
    });
  });

  // ── Scenario 2: Exact match exists ─────────────────────────────────────

  describe('when an exact match already exists', () => {
    it('should return the existing contact without creating duplicates', async () => {
      repo.seed([
        {
          id: 1,
          email: 'lorraine@hillvalley.edu',
          phoneNumber: '123456',
          linkPrecedence: LinkPrecedence.PRIMARY,
          createdAt: new Date('2023-04-01'),
        },
      ]);

      const result = await service.identify({
        email: 'lorraine@hillvalley.edu',
        phoneNumber: '123456',
      });

      expect(result.contact.primaryContatctId).toBe(1);
      expect(result.contact.emails).toEqual(['lorraine@hillvalley.edu']);
      expect(result.contact.phoneNumbers).toEqual(['123456']);
      expect(result.contact.secondaryContactIds).toEqual([]);

      // No new contacts should have been created
      expect(repo.getAll().length).toBe(1);
    });
  });

  // ── Scenario 3: Partial match → create secondary ──────────────────────

  describe('when request has new info alongside existing match', () => {
    it('should create a secondary contact (spec example)', async () => {
      repo.seed([
        {
          id: 1,
          email: 'lorraine@hillvalley.edu',
          phoneNumber: '123456',
          linkPrecedence: LinkPrecedence.PRIMARY,
          createdAt: new Date('2023-04-01'),
        },
      ]);

      const result = await service.identify({
        email: 'mcfly@hillvalley.edu',
        phoneNumber: '123456',
      });

      expect(result.contact.primaryContatctId).toBe(1);
      expect(result.contact.emails).toContain('lorraine@hillvalley.edu');
      expect(result.contact.emails).toContain('mcfly@hillvalley.edu');
      expect(result.contact.phoneNumbers).toEqual(['123456']);
      expect(result.contact.secondaryContactIds.length).toBe(1);
    });
  });

  // ── Scenario 4: Multiple primaries → merge ────────────────────────────

  describe('when request links two separate primary contacts', () => {
    it('should merge: oldest stays primary, newer becomes secondary (spec example)', async () => {
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

      const result = await service.identify({
        email: 'george@hillvalley.edu',
        phoneNumber: '717171',
      });

      expect(result.contact.primaryContatctId).toBe(11);
      expect(result.contact.emails).toContain('george@hillvalley.edu');
      expect(result.contact.emails).toContain('biffsucks@hillvalley.edu');
      expect(result.contact.phoneNumbers).toContain('919191');
      expect(result.contact.phoneNumbers).toContain('717171');
      expect(result.contact.secondaryContactIds).toContain(27);

      // Verify that contact 27 is now secondary
      const contact27 = repo.getAll().find((c) => c.id === 27);
      expect(contact27?.linkPrecedence).toBe(LinkPrecedence.SECONDARY);
      expect(contact27?.linkedId).toBe(11);
    });
  });

  // ── Scenario 5: Query by various single fields ────────────────────────

  describe('when querying with partial info', () => {
    beforeEach(() => {
      repo.seed([
        {
          id: 1,
          email: 'lorraine@hillvalley.edu',
          phoneNumber: '123456',
          linkPrecedence: LinkPrecedence.PRIMARY,
          createdAt: new Date('2023-04-01'),
        },
        {
          id: 23,
          email: 'mcfly@hillvalley.edu',
          phoneNumber: '123456',
          linkedId: 1,
          linkPrecedence: LinkPrecedence.SECONDARY,
          createdAt: new Date('2023-04-20'),
        },
      ]);
    });

    it('should return full cluster when querying by phone only', async () => {
      const result = await service.identify({
        email: null,
        phoneNumber: '123456',
      });

      expect(result.contact.primaryContatctId).toBe(1);
      expect(result.contact.emails).toContain('lorraine@hillvalley.edu');
      expect(result.contact.emails).toContain('mcfly@hillvalley.edu');
      expect(result.contact.secondaryContactIds).toContain(23);
    });

    it('should return full cluster when querying by primary email', async () => {
      const result = await service.identify({
        email: 'lorraine@hillvalley.edu',
        phoneNumber: null,
      });

      expect(result.contact.primaryContatctId).toBe(1);
      expect(result.contact.secondaryContactIds).toContain(23);
    });

    it('should return full cluster when querying by secondary email', async () => {
      const result = await service.identify({
        email: 'mcfly@hillvalley.edu',
        phoneNumber: null,
      });

      expect(result.contact.primaryContatctId).toBe(1);
      expect(result.contact.secondaryContactIds).toContain(23);
    });
  });

  // ── Scenario 6: Validation ────────────────────────────────────────────

  describe('validation', () => {
    it('should throw when both email and phone are null', async () => {
      await expect(
        service.identify({ email: null, phoneNumber: null }),
      ).rejects.toThrow('At least one of email or phoneNumber must be provided');
    });

    it('should throw when both email and phone are undefined', async () => {
      await expect(service.identify({})).rejects.toThrow(
        'At least one of email or phoneNumber must be provided',
      );
    });

    it('should handle whitespace-only email as null', async () => {
      const result = await service.identify({
        email: '   ',
        phoneNumber: '123456',
      });

      expect(result.contact.phoneNumbers).toEqual(['123456']);
      expect(result.contact.emails).toEqual([]);
    });
  });

  // ── Scenario 7: Complex chain ─────────────────────────────────────────

  describe('complex identity chain', () => {
    it('should handle a chain of linked contacts', async () => {
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

      // Query via a secondary's phone that links back to the cluster
      const result = await service.identify({
        email: null,
        phoneNumber: '222',
      });

      expect(result.contact.primaryContatctId).toBe(1);
      expect(result.contact.emails).toEqual(['a@test.com', 'b@test.com']);
      expect(result.contact.phoneNumbers).toEqual(['111', '222']);
      expect(result.contact.secondaryContactIds).toEqual([2, 3]);
    });
  });

  // ── Scenario 8: Merging with existing secondaries ─────────────────────

  describe('merging primaries that already have secondaries', () => {
    it('should re-link orphaned secondaries to the winning primary', async () => {
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
          email: 'a2@test.com',
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
          email: 'b2@test.com',
          phoneNumber: '222',
          linkedId: 10,
          linkPrecedence: LinkPrecedence.SECONDARY,
          createdAt: new Date('2023-02-02'),
        },
      ]);

      // This links the two clusters
      const result = await service.identify({
        email: 'a@test.com',
        phoneNumber: '222',
      });

      expect(result.contact.primaryContatctId).toBe(1);
      expect(result.contact.secondaryContactIds).toContain(10);

      // Contact 10 should now be secondary linked to 1
      const contact10 = repo.getAll().find((c) => c.id === 10);
      expect(contact10?.linkPrecedence).toBe(LinkPrecedence.SECONDARY);
      expect(contact10?.linkedId).toBe(1);

      // Contact 11's linkedId should now point to 1 (re-linked from 10)
      const contact11 = repo.getAll().find((c) => c.id === 11);
      expect(contact11?.linkedId).toBe(1);
    });
  });
});
