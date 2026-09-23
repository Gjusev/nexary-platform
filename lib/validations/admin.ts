import { z } from 'zod';

/**
 * Validation schemas for Admin UI forms
 * Used for SAML, SCIM, and OIDC configuration
 */

export const samlConfigSchema = z.object({
  teamSlug: z.string().min(1, 'Team slug is required'),
  idpTemplate: z.enum(['okta', 'azure', 'adfs', 'google', 'onelogin', 'ping', 'manual'], {
    errorMap: () => ({ message: 'Select a valid Identity Provider template' }),
  }),
  idpEntityId: z.string().url('IdP Entity ID must be a valid URL'),
  idpSsoUrl: z.string().url('IdP SSO URL must be a valid URL'),
  idpSloUrl: z.string().url('IdP SLO URL must be a valid URL').optional(),
  idpCert: z.string().min(1, 'X.509 Certificate is required'),
  nameIdFormat: z.enum([
    'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    'urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified',
  ], {
    errorMap: () => ({ message: 'Select a valid Name ID format' }),
  }),
  attributeMapping: z.record(z.string()).optional().default({}),
});

export const scimTokenSchema = z.object({
  teamSlug: z.string().min(1, 'Team slug is required'),
  name: z.string()
    .min(1, 'Token name is required')
    .max(100, 'Token name must be less than 100 characters')
    .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Only letters, numbers, spaces, hyphens, and underscores allowed'),
});

export const oidcConfigSchema = z.object({
  teamSlug: z.string().min(1, 'Team slug is required'),
  issuerUrl: z.string().url('Issuer URL must be a valid URL'),
  clientId: z.string().min(1, 'Client ID is required'),
  clientSecret: z.string().min(1, 'Client Secret is required'),
  scopes: z.array(z.string()).default(['openid', 'email', 'profile']),
  pkce: z.boolean().default(true),
});

export const teamFilterSchema = z.object({
  search: z.string().optional(),
  samlStatus: z.enum(['configured', 'not-configured', 'all']).optional(),
  scimStatus: z.enum(['enabled', 'disabled', 'all']).optional(),
  ssoType: z.enum(['saml', 'oidc', 'both', 'all']).optional(),
  sortBy: z.enum(['name', 'createdAt', 'samlStatus', 'scimStatus']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export type SAMLConfigInput = z.infer<typeof samlConfigSchema>;
export type SCIMTokenInput = z.infer<typeof scimTokenSchema>;
export type OIDCConfigInput = z.infer<typeof oidcConfigSchema>;
export type TeamFilterInput = z.infer<typeof teamFilterSchema>;
