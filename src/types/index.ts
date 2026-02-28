/**
 * Core domain types for the Identity Reconciliation service.
 * 
 * Follows Interface Segregation Principle (ISP) — each interface
 * represents a focused, minimal contract.
 */

// ─── Request / Response DTOs ────────────────────────────────────────────────

/** Incoming identification request payload */
export interface IdentifyRequestDTO {
  email?: string | null;
  phoneNumber?: string | null;
}

/** Consolidated contact response returned by /identify */
export interface IdentifyResponseDTO {
  contact: {
    primaryContatctId: number;      // Note: matches spec typo intentionally
    emails: string[];               // Primary email first
    phoneNumbers: string[];         // Primary phone first
    secondaryContactIds: number[];
  };
}

// ─── Domain Models ──────────────────────────────────────────────────────────

export enum LinkPrecedence {
  PRIMARY = 'primary',
  SECONDARY = 'secondary',
}

/** Domain representation of a Contact entity */
export interface ContactEntity {
  id: number;
  phoneNumber: string | null;
  email: string | null;
  linkedId: number | null;
  linkPrecedence: LinkPrecedence;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

// ─── Repository Interfaces (Dependency Inversion) ───────────────────────────

/** 
 * Abstraction over data access for Contact entities.
 * Implementations can swap between Prisma, raw SQL, etc.
 */
export interface IContactRepository {
  /** Find all contacts matching the given email */
  findByEmail(email: string): Promise<ContactEntity[]>;

  /** Find all contacts matching the given phone number */
  findByPhone(phone: string): Promise<ContactEntity[]>;

  /** Find all contacts matching either email or phone */
  findByEmailOrPhone(email: string | null, phone: string | null): Promise<ContactEntity[]>;

  /** Find a contact by its ID */
  findById(id: number): Promise<ContactEntity | null>;

  /** Find all secondary contacts linked to a given primary ID */
  findByLinkedId(linkedId: number): Promise<ContactEntity[]>;

  /** Create a new contact */
  create(data: CreateContactData): Promise<ContactEntity>;

  /** Update a contact by ID */
  update(id: number, data: UpdateContactData): Promise<ContactEntity>;

  /** Find all contacts that are linked to a set of primary IDs */
  findAllLinkedContacts(primaryIds: number[]): Promise<ContactEntity[]>;
}

export interface CreateContactData {
  phoneNumber?: string | null;
  email?: string | null;
  linkedId?: number | null;
  linkPrecedence: LinkPrecedence;
}

export interface UpdateContactData {
  linkedId?: number | null;
  linkPrecedence?: LinkPrecedence;
  updatedAt?: Date;
}

// ─── Service Interfaces ─────────────────────────────────────────────────────

/** Core business logic for identity reconciliation */
export interface IContactService {
  identify(request: IdentifyRequestDTO): Promise<IdentifyResponseDTO>;
}

// ─── Error Types ────────────────────────────────────────────────────────────

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404);
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}
