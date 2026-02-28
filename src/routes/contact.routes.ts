/**
 * Contact routes — maps HTTP endpoints to controller methods.
 * 
 * Applies validation middleware before reaching the controller.
 */

import { Router } from 'express';
import { ContactController } from '../controllers/contact.controller.ts';
import { validateIdentifyRequest } from '../middlewares/validator';

export function createContactRoutes(controller: ContactController): Router {
  const router = Router();

  /**
   * POST /identify
   * 
   * Body: { email?: string, phoneNumber?: string | number }
   * Response: { contact: { primaryContatctId, emails, phoneNumbers, secondaryContactIds } }
   */
  router.post('/identify', validateIdentifyRequest, controller.identify);

  return router;
}
