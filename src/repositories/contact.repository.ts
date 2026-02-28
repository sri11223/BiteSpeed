/**
 * Contact Repository — Prisma implementation.
 *
 * Implements IContactRepository (Dependency Inversion Principle).
 * All database access for the Contact entity is encapsulated here,
 * keeping the service layer free from ORM details.
 *
 * Why Prisma over raw SQL?
 * ────────────────────────
 * ✅ Auto-generated TypeScript types from schema — zero manual mapping errors
 * ✅ Parameterized queries by default — SQL injection is impossible
 * ✅ Version-controlled migrations with `prisma migrate`
 * ✅ ~50% less code than equivalent raw pg implementation
 * ✅ Query engine handles connection pooling, retries, and prepared statements
 *
 * Trade-offs acknowledged:
 * ⚠️ Slightly heavier binary (~10MB engine), acceptable for this scale
 * ⚠️ Complex raw SQL (window functions, CTEs) harder to express — not needed here
 * ⚠️ Extra build step (prisma generate) — handled in postinstall
 *
 * The architecture uses IContactRepository interface (Dependency Inversion),
 * so swapping to raw SQL later requires only a new implementation class — no
 * service or controller changes needed.
 *
 * Single Responsibility: Only handles Contact data persistence.
 */

import { PrismaClient } from '@prisma/client';
import {
  ContactEntity,
  CreateContactData,
  IContactRepository,
  LinkPrecedence,
  UpdateContactData,
} from '../types';

/**
 * Shape of a raw Contact record returned by Prisma.
 * We define this locally instead of importing generated model types,
 * because Prisma 5.x exports them under Prisma namespace which varies
 * across versions. This keeps imports stable.
 */
interface PrismaContactRecord {
  id: number;
  phoneNumber: string | null;
  email: string | null;
  linkedId: number | null;
  linkPrecedence: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export class ContactRepository implements IContactRepository {
  constructor(private readonly prisma: PrismaClient) {}

  // ─── Mapping helpers (Open/Closed: extend via mapping, not modification) ──

  private toDomain(record: PrismaContactRecord): ContactEntity {
    return {
      id: record.id,
      phoneNumber: record.phoneNumber,
      email: record.email,
      linkedId: record.linkedId,
      linkPrecedence: record.linkPrecedence as LinkPrecedence,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt,
    };
  }

  // ─── Query methods ────────────────────────────────────────────────────────

  async findByEmail(email: string): Promise<ContactEntity[]> {
    const records = await this.prisma.contact.findMany({
      where: { email, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    return records.map((r: PrismaContactRecord) => this.toDomain(r));
  }

  async findByPhone(phone: string): Promise<ContactEntity[]> {
    const records = await this.prisma.contact.findMany({
      where: { phoneNumber: phone, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    return records.map((r: PrismaContactRecord) => this.toDomain(r));
  }

  async findByEmailOrPhone(
    email: string | null,
    phone: string | null,
  ): Promise<ContactEntity[]> {
    const conditions: Array<Record<string, unknown>> = [];

    if (email) {
      conditions.push({ email });
    }
    if (phone) {
      conditions.push({ phoneNumber: phone });
    }

    if (conditions.length === 0) return [];

    const records = await this.prisma.contact.findMany({
      where: {
        deletedAt: null,
        OR: conditions,
      },
      orderBy: { createdAt: 'asc' },
    });

    return records.map((r: PrismaContactRecord) => this.toDomain(r));
  }

  async findById(id: number): Promise<ContactEntity | null> {
    const record = await this.prisma.contact.findFirst({
      where: { id, deletedAt: null },
    });
    return record ? this.toDomain(record as PrismaContactRecord) : null;
  }

  async findByLinkedId(linkedId: number): Promise<ContactEntity[]> {
    const records = await this.prisma.contact.findMany({
      where: { linkedId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    return records.map((r: PrismaContactRecord) => this.toDomain(r));
  }

  async findAllLinkedContacts(primaryIds: number[]): Promise<ContactEntity[]> {
    if (primaryIds.length === 0) return [];

    const records = await this.prisma.contact.findMany({
      where: {
        deletedAt: null,
        OR: [
          { id: { in: primaryIds } },
          { linkedId: { in: primaryIds } },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });

    return records.map((r: PrismaContactRecord) => this.toDomain(r));
  }

  // ─── Mutation methods ─────────────────────────────────────────────────────

  async create(data: CreateContactData): Promise<ContactEntity> {
    const record = await this.prisma.contact.create({
      data: {
        phoneNumber: data.phoneNumber ?? null,
        email: data.email ?? null,
        linkedId: data.linkedId ?? null,
        linkPrecedence: data.linkPrecedence,
      },
    });
    return this.toDomain(record as PrismaContactRecord);
  }

  async update(id: number, data: UpdateContactData): Promise<ContactEntity> {
    const updateData: Record<string, unknown> = {};

    if (data.linkedId !== undefined) updateData.linkedId = data.linkedId;
    if (data.linkPrecedence !== undefined) {
      updateData.linkPrecedence = data.linkPrecedence;
    }

    const record = await this.prisma.contact.update({
      where: { id },
      data: updateData,
    });

    return this.toDomain(record as PrismaContactRecord);
  }
}
