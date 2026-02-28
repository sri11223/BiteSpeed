/**
 * Contact Service — Core identity reconciliation logic.
 *
 * Implements the Bitespeed identity linking algorithm:
 *
 * 1. Find all existing contacts that match incoming email OR phone.
 * 2. Determine the set of unique primary contacts they belong to.
 * 3. If zero primaries → create a new primary contact.
 * 4. If one primary → check if we need to create a secondary for new info.
 * 5. If multiple primaries → merge them (oldest stays primary, rest become secondary).
 * 6. Gather the full cluster and build the consolidated response.
 *
 * Follows:
 * - Single Responsibility: Only reconciliation logic, no HTTP concerns.
 * - Open/Closed: New linking strategies can be injected via the repository interface.
 * - Dependency Inversion: Depends on IContactRepository abstraction, not Prisma directly.
 * - Liskov Substitution: Any IContactRepository implementation can be swapped in.
 */

import {
  ContactEntity,
  IContactRepository,
  IContactService,
  IdentifyRequestDTO,
  IdentifyResponseDTO,
  LinkPrecedence,
  ValidationError,
} from '../types';
import { logger } from '../utils/logger';

export class ContactService implements IContactService {
  constructor(private readonly contactRepo: IContactRepository) {}

  /**
   * Main entry point: identify/reconcile a contact from the incoming request.
   */
  async identify(request: IdentifyRequestDTO): Promise<IdentifyResponseDTO> {
    const email = this.normalizeField(request.email);
    const phoneNumber = this.normalizeField(request.phoneNumber);

    // At least one of email or phoneNumber must be provided
    if (!email && !phoneNumber) {
      throw new ValidationError('At least one of email or phoneNumber must be provided');
    }

    logger.debug('Processing identify request', { email, phoneNumber });

    // Step 1: find all contacts matching the incoming email or phone
    const matchingContacts = await this.contactRepo.findByEmailOrPhone(email, phoneNumber);

    if (matchingContacts.length === 0) {
      // No existing contacts → create a brand new primary
      return this.createNewPrimaryContact(email, phoneNumber);
    }

    // Step 2: resolve all unique primary IDs from the matched contacts
    const primaryIds = await this.resolvePrimaryIds(matchingContacts);

    // Step 3: retrieve the full cluster (all primaries + their secondaries)
    const allContacts = await this.contactRepo.findAllLinkedContacts(primaryIds);

    // Step 4: if we discovered multiple primary contacts, merge them
    let mergedContacts = allContacts;
    if (primaryIds.length > 1) {
      mergedContacts = await this.mergePrimaryContacts(primaryIds, allContacts);
    }

    // Step 5: create a secondary if the request contains new info (new email/phone combo)
    mergedContacts = await this.createSecondaryIfNeeded(email, phoneNumber, mergedContacts);

    // Step 6: build the consolidated response
    return this.buildResponse(mergedContacts);
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  /**
   * Normalize request fields: trim whitespace, convert empty/null to null.
   */
  private normalizeField(value: string | null | undefined): string | null {
    if (value === null || value === undefined) return null;
    const trimmed = String(value).trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  /**
   * Create a new primary contact when no existing match is found.
   */
  private async createNewPrimaryContact(
    email: string | null,
    phoneNumber: string | null,
  ): Promise<IdentifyResponseDTO> {
    logger.info('Creating new primary contact', { email, phoneNumber });

    const contact = await this.contactRepo.create({
      email,
      phoneNumber,
      linkPrecedence: LinkPrecedence.PRIMARY,
    });

    return {
      contact: {
        primaryContatctId: contact.id,
        emails: contact.email ? [contact.email] : [],
        phoneNumbers: contact.phoneNumber ? [contact.phoneNumber] : [],
        secondaryContactIds: [],
      },
    };
  }

  /**
   * Given a set of matched contacts, resolve the unique primary contact IDs
   * they all belong to. A contact is either primary itself, or points to its
   * primary via linkedId.
   */
  private async resolvePrimaryIds(contacts: ContactEntity[]): Promise<number[]> {
    const primaryIdSet = new Set<number>();

    for (const contact of contacts) {
      if (contact.linkPrecedence === LinkPrecedence.PRIMARY) {
        primaryIdSet.add(contact.id);
      } else if (contact.linkedId !== null) {
        primaryIdSet.add(contact.linkedId);
      }
    }

    return Array.from(primaryIdSet);
  }

  /**
   * Merge multiple primary contacts into one cluster.
   * The oldest primary (by createdAt) remains primary; all others become
   * secondary, and their existing secondaries are re-pointed as well.
   */
  private async mergePrimaryContacts(
    primaryIds: number[],
    allContacts: ContactEntity[],
  ): Promise<ContactEntity[]> {
    // Find the actual primary records
    const primaries = allContacts
      .filter((c) => primaryIds.includes(c.id) && c.linkPrecedence === LinkPrecedence.PRIMARY)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    if (primaries.length <= 1) return allContacts;

    const winningPrimary = primaries[0];
    const losingPrimaries = primaries.slice(1);

    logger.info('Merging primary contacts', {
      winner: winningPrimary.id,
      losers: losingPrimaries.map((p) => p.id),
    });

    // Turn losing primaries into secondaries pointing to the winner
    for (const loser of losingPrimaries) {
      await this.contactRepo.update(loser.id, {
        linkedId: winningPrimary.id,
        linkPrecedence: LinkPrecedence.SECONDARY,
      });

      // Re-point any secondary contacts that were linked to this losing primary
      const orphanedSecondaries = allContacts.filter(
        (c) => c.linkedId === loser.id && c.id !== loser.id,
      );

      for (const orphan of orphanedSecondaries) {
        await this.contactRepo.update(orphan.id, {
          linkedId: winningPrimary.id,
        });
      }
    }

    // Re-fetch the full cluster to get the updated state
    return this.contactRepo.findAllLinkedContacts([winningPrimary.id]);
  }

  /**
   * If the incoming request contains info (email or phone) that doesn't exist
   * in the current cluster, create a new secondary contact.
   * 
   * Only creates if both email AND phone were provided and at least one is new.
   */
  private async createSecondaryIfNeeded(
    email: string | null,
    phoneNumber: string | null,
    contacts: ContactEntity[],
  ): Promise<ContactEntity[]> {
    const primary = contacts.find((c) => c.linkPrecedence === LinkPrecedence.PRIMARY);
    if (!primary) return contacts;

    const existingEmails = new Set(contacts.map((c) => c.email).filter(Boolean));
    const existingPhones = new Set(contacts.map((c) => c.phoneNumber).filter(Boolean));

    const emailIsNew = email !== null && !existingEmails.has(email);
    const phoneIsNew = phoneNumber !== null && !existingPhones.has(phoneNumber);

    // Check if the exact combination already exists
    const exactMatch = contacts.some(
      (c) =>
        (email === null || c.email === email) &&
        (phoneNumber === null || c.phoneNumber === phoneNumber),
    );

    if (exactMatch) {
      // No new info to add
      return contacts;
    }

    // We have new info if at least one field is new
    if (emailIsNew || phoneIsNew) {
      logger.info('Creating secondary contact', {
        email,
        phoneNumber,
        primaryId: primary.id,
      });

      const newSecondary = await this.contactRepo.create({
        email,
        phoneNumber,
        linkedId: primary.id,
        linkPrecedence: LinkPrecedence.SECONDARY,
      });

      return [...contacts, newSecondary];
    }

    return contacts;
  }

  /**
   * Build the consolidated identification response from the contact cluster.
   * Primary contact's data comes first in the arrays.
   */
  private buildResponse(contacts: ContactEntity[]): IdentifyResponseDTO {
    // Sort: primary first, then secondaries by createdAt
    const sorted = [...contacts].sort((a, b) => {
      if (a.linkPrecedence === LinkPrecedence.PRIMARY && b.linkPrecedence !== LinkPrecedence.PRIMARY) return -1;
      if (a.linkPrecedence !== LinkPrecedence.PRIMARY && b.linkPrecedence === LinkPrecedence.PRIMARY) return 1;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    const primary = sorted.find((c) => c.linkPrecedence === LinkPrecedence.PRIMARY);
    if (!primary) {
      throw new Error('No primary contact found in cluster — data integrity issue');
    }

    // Collect unique emails and phones, preserving order (primary first)
    const emails: string[] = [];
    const phoneNumbers: string[] = [];
    const secondaryContactIds: number[] = [];

    for (const contact of sorted) {
      if (contact.email && !emails.includes(contact.email)) {
        emails.push(contact.email);
      }
      if (contact.phoneNumber && !phoneNumbers.includes(contact.phoneNumber)) {
        phoneNumbers.push(contact.phoneNumber);
      }
      if (contact.linkPrecedence === LinkPrecedence.SECONDARY) {
        secondaryContactIds.push(contact.id);
      }
    }

    return {
      contact: {
        primaryContatctId: primary.id,
        emails,
        phoneNumbers,
        secondaryContactIds,
      },
    };
  }
}
