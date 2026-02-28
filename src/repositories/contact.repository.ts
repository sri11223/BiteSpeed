/**
 * Contact Repository — Prisma implementation.
 * 
 * Implements IContactRepository (Dependency Inversion Principle).
 * All database access for the Contact entity is encapsulated here,
 * keeping the service layer free from ORM details.
 * 
 * Single Responsibility: Only handles Contact data persistence.
 */

import { PrismaClient, Contact as PrismaContact, LinkPrecedence as PrismaLinkPrecedence } from '@prisma/client';
import {
  ContactEntity,
  CreateContactData,
  IContactRepository,
  LinkPrecedence,
  UpdateContactData,
} from '../types';

export class ContactRepository implements IContactRepository {
  constructor(private readonly prisma: PrismaClient) {}

  // ─── Mapping helpers (Open/Closed: extend via mapping, not modification) ──

  private toDomain(record: PrismaContact): ContactEntity {
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

  private toPrismaLinkPrecedence(lp: LinkPrecedence): PrismaLinkPrecedence {
    return lp as PrismaLinkPrecedence;
  }

  // ─── Query methods ────────────────────────────────────────────────────────

  async findByEmail(email: string): Promise<ContactEntity[]> {
    const records = await this.prisma.contact.findMany({
      where: { email, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async findByPhone(phone: string): Promise<ContactEntity[]> {
    const records = await this.prisma.contact.findMany({
      where: { phoneNumber: phone, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    return records.map((r) => this.toDomain(r));
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

    return records.map((r) => this.toDomain(r));
  }

  async findById(id: number): Promise<ContactEntity | null> {
    const record = await this.prisma.contact.findFirst({
      where: { id, deletedAt: null },
    });
    return record ? this.toDomain(record) : null;
  }

  async findByLinkedId(linkedId: number): Promise<ContactEntity[]> {
    const records = await this.prisma.contact.findMany({
      where: { linkedId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    return records.map((r) => this.toDomain(r));
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

    return records.map((r) => this.toDomain(r));
  }

  // ─── Mutation methods ─────────────────────────────────────────────────────

  async create(data: CreateContactData): Promise<ContactEntity> {
    const record = await this.prisma.contact.create({
      data: {
        phoneNumber: data.phoneNumber ?? null,
        email: data.email ?? null,
        linkedId: data.linkedId ?? null,
        linkPrecedence: this.toPrismaLinkPrecedence(data.linkPrecedence),
      },
    });
    return this.toDomain(record);
  }

  async update(id: number, data: UpdateContactData): Promise<ContactEntity> {
    const updateData: Record<string, unknown> = {};

    if (data.linkedId !== undefined) updateData.linkedId = data.linkedId;
    if (data.linkPrecedence !== undefined) {
      updateData.linkPrecedence = this.toPrismaLinkPrecedence(data.linkPrecedence);
    }

    const record = await this.prisma.contact.update({
      where: { id },
      data: updateData,
    });

    return this.toDomain(record);
  }
}
