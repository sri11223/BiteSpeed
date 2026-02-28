/**
 * Request validation middleware using Zod.
 * 
 * Validates the /identify endpoint request body according to the spec:
 * - email: optional string
 * - phoneNumber: optional string or number (coerced to string)
 * - At least one must be present
 */

import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../types';

/**
 * Schema for the /identify endpoint request body.
 * 
 * phoneNumber can arrive as a number (per spec) or string — we coerce to string.
 */
export const identifyRequestSchema = z.object({
  email: z
    .string()
    .transform((val) => val.trim())
    .pipe(z.string().email('Invalid email format'))
    .nullable()
    .optional()
    .transform((val) => val || null),

  phoneNumber: z
    .union([z.string(), z.number()])
    .nullable()
    .optional()
    .transform((val) => {
      if (val === null || val === undefined) return null;
      const str = String(val).trim();
      return str.length > 0 ? str : null;
    }),
}).refine(
  (data) => data.email !== null || data.phoneNumber !== null,
  {
    message: 'At least one of email or phoneNumber must be provided',
  },
);

/**
 * Express middleware that validates the request body against the identify schema.
 */
export function validateIdentifyRequest(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const result = identifyRequestSchema.safeParse(req.body);

  if (!result.success) {
    const errorMessages = result.error.issues.map((issue) => issue.message).join('; ');
    return next(new ValidationError(errorMessages));
  }

  // Replace body with the parsed & normalized values
  req.body = result.data;
  next();
}
