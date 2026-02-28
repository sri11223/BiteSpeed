/**
 * Swagger / OpenAPI 3.0 configuration.
 *
 * Generates interactive API documentation at /api-docs.
 * Uses swagger-jsdoc to auto-generate spec from JSDoc annotations
 * and this central definition.
 */

import swaggerJsdoc from 'swagger-jsdoc';

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Bitespeed Identity Reconciliation API',
    version: '1.0.0',
    description: `
## Overview

This service reconciles customer identities across multiple purchases at FluxKart.com.

Customers may use different **email addresses** and **phone numbers** for each purchase.
This API links all those identities together and returns a **consolidated contact** view.

## How it works

1. **New customer** — If no existing contact matches the incoming email/phone, a new primary contact is created.
2. **Existing match with new info** — If one field matches but the other is new, a secondary contact is created and linked to the primary.
3. **Multiple primaries merge** — If the request bridges two previously unrelated primary contacts, the older one stays primary and the newer becomes secondary.

## Key Concepts

| Term | Meaning |
|------|---------|
| **Primary Contact** | The oldest contact in a linked cluster |
| **Secondary Contact** | A contact linked to a primary via \`linkedId\` |
| **Cluster** | All contacts (primary + secondaries) that belong to the same person |

## Algorithm Flow

\`\`\`
Request (email, phone)
    ↓
Find all contacts matching email OR phone
    ↓
┌── No matches? → Create new primary → Return
├── One primary? → Check for new info → Maybe create secondary → Return cluster
└── Multiple primaries? → Merge (oldest wins) → Maybe create secondary → Return cluster
\`\`\`

## Database Schema

| Column | Type | Description |
|--------|------|-------------|
| id | INT (PK) | Auto-increment primary key |
| phoneNumber | VARCHAR | Customer phone number (nullable) |
| email | VARCHAR | Customer email address (nullable) |
| linkedId | INT (FK) | Points to the primary contact (null for primaries) |
| linkPrecedence | ENUM | \`primary\` or \`secondary\` |
| createdAt | TIMESTAMP | Record creation time |
| updatedAt | TIMESTAMP | Last update time |
| deletedAt | TIMESTAMP | Soft-delete timestamp (nullable) |

## Examples

### Example 1: First purchase by a new customer
\`\`\`json
Request:  { "email": "lorraine@hillvalley.edu", "phoneNumber": "123456" }
Response: { "contact": { "primaryContatctId": 1, "emails": ["lorraine@hillvalley.edu"], "phoneNumbers": ["123456"], "secondaryContactIds": [] } }
\`\`\`

### Example 2: Same customer, different email
\`\`\`json
Request:  { "email": "mcfly@hillvalley.edu", "phoneNumber": "123456" }
Response: { "contact": { "primaryContatctId": 1, "emails": ["lorraine@hillvalley.edu", "mcfly@hillvalley.edu"], "phoneNumbers": ["123456"], "secondaryContactIds": [23] } }
\`\`\`

### Example 3: Request bridges two separate customers (merge)
\`\`\`json
Request:  { "email": "george@hillvalley.edu", "phoneNumber": "717171" }
→ Contact #11 (george, 919191, primary) + Contact #27 (biffsucks, 717171, primary)
→ #27 becomes secondary of #11 (oldest wins)
Response: { "contact": { "primaryContatctId": 11, "emails": ["george@hillvalley.edu", "biffsucks@hillvalley.edu"], "phoneNumbers": ["919191", "717171"], "secondaryContactIds": [27] } }
\`\`\`

## Rate Limiting
- Default: 100 requests per 15-minute window per IP
- Configurable via \`RATE_LIMIT_WINDOW_MS\` and \`RATE_LIMIT_MAX_REQUESTS\` env vars
    `,
    contact: {
      name: 'Bitespeed Support',
      url: 'https://bitespeed.co',
    },
    license: {
      name: 'ISC',
    },
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Local development server',
    },
    {
      url: 'https://bitespeed-backend.onrender.com',
      description: 'Production server (Render.com)',
    },
  ],
  tags: [
    {
      name: 'Identity',
      description: 'Customer identity reconciliation endpoints',
    },
    {
      name: 'Health',
      description: 'Service health monitoring',
    },
  ],
  paths: {
    '/identify': {
      post: {
        tags: ['Identity'],
        summary: 'Identify and reconcile a customer contact',
        description: `
Receives an email and/or phone number and returns a consolidated view of all
linked contacts for that customer.

**Scenarios handled:**
- Both email and phone are new → creates a new primary contact
- Email or phone matches existing → returns full cluster, optionally creating a secondary
- Request bridges two separate primaries → merges them (oldest wins)
        `,
        operationId: 'identifyContact',
        requestBody: {
          required: true,
          description: 'At least one of `email` or `phoneNumber` must be provided.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/IdentifyRequest',
              },
              examples: {
                'both-fields': {
                  summary: 'Both email and phone',
                  value: {
                    email: 'mcfly@hillvalley.edu',
                    phoneNumber: '123456',
                  },
                },
                'email-only': {
                  summary: 'Email only',
                  value: {
                    email: 'lorraine@hillvalley.edu',
                  },
                },
                'phone-only': {
                  summary: 'Phone only',
                  value: {
                    phoneNumber: '123456',
                  },
                },
                'phone-as-number': {
                  summary: 'Phone as number type',
                  value: {
                    email: 'doc@hillvalley.edu',
                    phoneNumber: 555100,
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successfully identified and reconciled the contact',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/IdentifyResponse',
                },
                examples: {
                  'linked-contacts': {
                    summary: 'Customer with linked contacts',
                    value: {
                      contact: {
                        primaryContatctId: 1,
                        emails: ['lorraine@hillvalley.edu', 'mcfly@hillvalley.edu'],
                        phoneNumbers: ['123456'],
                        secondaryContactIds: [23],
                      },
                    },
                  },
                  'new-customer': {
                    summary: 'Brand new customer',
                    value: {
                      contact: {
                        primaryContatctId: 42,
                        emails: ['newcustomer@example.com'],
                        phoneNumbers: ['999888777'],
                        secondaryContactIds: [],
                      },
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error (missing both email and phone, invalid format)',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
                example: {
                  status: 'error',
                  message: 'At least one of email or phoneNumber must be provided',
                },
              },
            },
          },
          '429': {
            description: 'Rate limit exceeded',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
                example: {
                  status: 'error',
                  message: 'Too many requests, please try again later',
                },
              },
            },
          },
          '500': {
            description: 'Internal server error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
                example: {
                  status: 'error',
                  message: 'Internal server error',
                },
              },
            },
          },
        },
      },
    },
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        description: 'Returns the current health status of the service, including uptime.',
        operationId: 'healthCheck',
        responses: {
          '200': {
            description: 'Service is healthy',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HealthResponse',
                },
                example: {
                  status: 'ok',
                  timestamp: '2023-04-20T05:30:00.000Z',
                  uptime: 12345.678,
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      IdentifyRequest: {
        type: 'object',
        description: 'Request to identify a customer. At least one field must be provided.',
        properties: {
          email: {
            type: 'string',
            format: 'email',
            nullable: true,
            description: 'Customer email address',
            example: 'mcfly@hillvalley.edu',
          },
          phoneNumber: {
            oneOf: [
              { type: 'string' },
              { type: 'number' },
            ],
            nullable: true,
            description: 'Customer phone number (accepts string or number)',
            example: '123456',
          },
        },
        example: {
          email: 'mcfly@hillvalley.edu',
          phoneNumber: '123456',
        },
      },
      IdentifyResponse: {
        type: 'object',
        required: ['contact'],
        properties: {
          contact: {
            type: 'object',
            required: ['primaryContatctId', 'emails', 'phoneNumbers', 'secondaryContactIds'],
            properties: {
              primaryContatctId: {
                type: 'integer',
                description: 'ID of the primary contact in the cluster',
                example: 1,
              },
              emails: {
                type: 'array',
                items: { type: 'string', format: 'email' },
                description: 'All emails in the cluster (primary email first)',
                example: ['lorraine@hillvalley.edu', 'mcfly@hillvalley.edu'],
              },
              phoneNumbers: {
                type: 'array',
                items: { type: 'string' },
                description: 'All phone numbers in the cluster (primary phone first)',
                example: ['123456'],
              },
              secondaryContactIds: {
                type: 'array',
                items: { type: 'integer' },
                description: 'IDs of all secondary contacts',
                example: [23],
              },
            },
          },
        },
      },
      HealthResponse: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['ok'],
            description: 'Service status',
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            description: 'Current server timestamp',
          },
          uptime: {
            type: 'number',
            description: 'Server uptime in seconds',
          },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['error'],
            description: 'Always "error" for error responses',
          },
          message: {
            type: 'string',
            description: 'Human-readable error description',
          },
          stack: {
            type: 'string',
            description: 'Stack trace (development mode only)',
          },
        },
      },
    },
  },
};

export const swaggerSpec = swaggerJsdoc({
  definition: swaggerDefinition,
  apis: [], // We define everything inline above — no file scanning needed
});
