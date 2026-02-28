/**
 * Contact Controller — HTTP adapter for the ContactService.
 *
 * Single Responsibility: Only handles HTTP request/response translation.
 * Delegates all business logic to the service layer.
 */

import { Request, Response, NextFunction } from 'express';
import { IContactService, IdentifyRequestDTO } from '../types';
import { logger } from '../utils/logger';

export class ContactController {
  constructor(private readonly contactService: IContactService) {}

  /**
   * POST /identify
   * 
   * Receives email/phoneNumber, reconciles identity, returns consolidated contact.
   */
  identify = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto: IdentifyRequestDTO = {
        email: req.body.email ?? null,
        phoneNumber: req.body.phoneNumber ?? null,
      };

      logger.info('Received identify request', {
        email: dto.email,
        phoneNumber: dto.phoneNumber,
      });

      const result = await this.contactService.identify(dto);

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}
