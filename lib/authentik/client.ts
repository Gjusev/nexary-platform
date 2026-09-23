/**
 * Authentik API Client
 *
 * This module provides a client for interacting with the Authentik API.
 * It supports creating applications, providers, and SAML sources.
 *
 * Reference: https://docs.goauthentik.io/docs/api/
 */

import type {
  OIDCConfiguration,
  SAMLToOIDCMigration,
} from '@/lib/oidc/oidc-types';

// ============================================================================
// CONFIGURATION
// ============================================================================

const AUTHENTIK_API_BASE = process.env.AUTHENTIK_URL || 'https://ak.mokka-dev.de';
const AUTHENTIK_API_TOKEN = process.env.AUTHENTIK_API_TOKEN;

interface AuthentikConfig {
  baseURL: string;
  apiToken: string;
}

function getConfig(): AuthentikConfig {
  if (!AUTHENTIK_API_TOKEN) {
    throw new Error('AUTHENTIK_API_TOKEN environment variable is not set');
  }

  return {
    baseURL: AUTHENTIK_API_BASE,
    apiToken: AUTHENTIK_API_TOKEN,
  };
}

// ============================================================================
// API CLIENT
// ============================================================================

/**
 * Make authenticated request to Authentik API
 */
async function authentikRequest<T>(
  endpoint: string,
  options?: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: unknown;
    params?: Record<string, string>;
  }
): Promise<T> {
  const config = getConfig();

  const url = new URL(`${config.baseURL}/api/v3/${endpoint}`);

  // Add query params
  if (options?.params) {
    Object.entries(options.params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

  const headers: HeadersInit = {
    'Authorization': `Bearer ${config.apiToken}`,
    'Content-Type': 'application/json',
  };

  const response = await fetch(url.toString(), {
    method: options?.method || 'GET',
    headers,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Authentik API error: ${response.status} ${error}`);
  }

  return response.json() as Promise<T>;
}

// ============================================================================
// TYPES
// ============================================================================

export interface AuthentikApplication {
  pk: string;
  name: string;
  slug: string;
  provider: number | null;
  metaLaunchUrl?: string;
  metaIcon?: string;
  metaDescription?: string;
  policyEngineMode?: string;
}

export interface AuthentikProviderOIDC {
  pk: number;
  name: string;
  authorizationFlow: number;
  clientId: string;
  clientSecret: string;
  issuerMode: 'web' | 'static' | 'custom';
  issuer: string;
  jwksUrl?: string;
  userInfoUrl?: string;
  tokenUrl?: string;
  authorizationUrl?: string;
}

export interface AuthentikProviderSAML {
  pk: number;
  name: string;
  authorizationFlow: number;
  acsUrl: string;
  sloUrl?: string;
  entityId: string;
  spBinding: 'post' | 'redirect';
  audience?: string;
}

export interface AuthentikSAMLSource {
  pk: number;
  name: string;
  slug: string;
  ssoUrl: string;
  entityId: string;
  entityIdIdp?: string;
  bindingType: 'redirect' | 'post';
}

// ============================================================================
// APPLICATIONS
// ============================================================================

/**
 * Create an Authentik application
 */
export async function createApplication(params: {
  name: string;
  slug: string;
  metaLaunchUrl?: string;
  metaDescription?: string;
}): Promise<AuthentikApplication> {
  // Get default provider authorization flow
  const flows = await authentikRequest<{ results: Array<{ pk: number; slug: string }> }>(
    'flows/instances',
    { params: { ordering: 'slug' } }
  );

  const defaultAuthorizationFlow = flows.results.find(f => f.slug === 'default-provider-authorization');
  if (!defaultAuthorizationFlow) {
    throw new Error('Default provider authorization flow not found');
  }

  return authentikRequest<AuthentikApplication>('core/applications', {
    method: 'POST',
    body: {
      name: params.name,
      slug: params.slug,
      metaLaunchUrl: params.metaLaunchUrl,
      metaDescription: params.metaDescription,
      policyEngineMode: 'all',
      provider: null, // Will be linked later
    },
  });
}

/**
 * Get application by slug
 */
export async function getApplication(slug: string): Promise<AuthentikApplication | null> {
  try {
    const apps = await authentikRequest<{ results: AuthentikApplication[] }>(
      'core/applications',
      { params: { slug } }
    );

    if (apps.results.length === 0) {
      return null;
    }

    return apps.results[0];
  } catch {
    return null;
  }
}

/**
 * Link provider to application
 */
export async function linkProviderToApplication(
  applicationSlug: string,
  providerPk: number
): Promise<void> {
  const app = await getApplication(applicationSlug);
  if (!app) {
    throw new Error(`Application ${applicationSlug} not found`);
  }

  await authentikRequest<AuthentikApplication>(`core/applications/${app.pk}`, {
    method: 'PUT',
    body: {
      ...app,
      provider: providerPk,
    },
  });
}

// ============================================================================
// OIDC PROVIDER
// ============================================================================

/**
 * Create OIDC provider in Authentik
 */
export async function createOIDCProvider(params: {
  name: string;
  clientId: string;
  clientSecret: string;
  issuer: string;
  authorizationUrl?: string;
  tokenUrl?: string;
  userInfoUrl?: string;
  jwksUrl?: string;
}): Promise<AuthentikProviderOIDC> {
  // Get default provider authorization flow
  const flows = await authentikRequest<{ results: Array<{ pk: number; slug: string }> }>(
    'flows/instances',
    { params: { ordering: 'slug' } }
  );

  const defaultAuthorizationFlow = flows.results.find(f => f.slug === 'default-provider-authorization');
  if (!defaultAuthorizationFlow) {
    throw new Error('Default provider authorization flow not found');
  }

  return authentikRequest<AuthentikProviderOIDC>('providers/oauth2/', {
    method: 'POST',
    body: {
      name: params.name,
      authorizationFlow: defaultAuthorizationFlow.pk,
      clientId: params.clientId,
      clientSecret: params.clientSecret,
      issuerMode: 'custom',
      issuer: params.issuer,
      jwksUrl: params.jwksUrl,
      userInfoUrl: params.userInfoUrl,
      tokenUrl: params.tokenUrl,
      authorizationUrl: params.authorizationUrl,
    },
  });
}

/**
 * Create OIDC provider from OIDC configuration
 */
export async function createOIDCProviderFromConfig(
  teamSlug: string,
  config: OIDCConfiguration
): Promise<AuthentikProviderOIDC> {
  return createOIDCProvider({
    name: `${teamSlug}-oidc`,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    issuer: config.issuer,
    authorizationUrl: config.authorizationEndpoint,
    tokenUrl: config.tokenEndpoint,
    userInfoUrl: config.userInfoEndpoint,
    jwksUrl: config.jwksUri,
  });
}

// ============================================================================
// SAML SOURCE
// ============================================================================

/**
 * Create SAML source in Authentik
 */
export async function createSAMLSource(params: {
  name: string;
  slug: string;
  ssoUrl: string;
  entityId: string;
  bindingType?: 'redirect' | 'post';
}): Promise<AuthentikSAMLSource> {
  return authentikRequest<AuthentikSAMLSource>('core/sources/', {
    method: 'POST',
    body: {
      name: params.name,
      slug: params.slug,
      ssoUrl: params.ssoUrl,
      entityId: params.entityId,
      bindingType: params.bindingType || 'post',
    },
  });
}

// ============================================================================
// MIGRATION HELPERS
// ============================================================================

/**
 * Create complete Authentik setup for a team
 * - Creates OIDC provider
 * - Creates application
 * - Links provider to application
 *
 * This sets up Authentik as an OIDC broker for an existing IdP
 */
export async function setupAuthentikOIDCBroker(
  teamSlug: string,
  oidcConfig: OIDCConfiguration
): Promise<{
  provider: AuthentikProviderOIDC;
  application: AuthentikApplication;
}> {
  // Create OIDC provider
  const provider = await createOIDCProviderFromConfig(teamSlug, oidcConfig);

  // Create application
  const app = await createApplication({
    name: `Nexary - ${teamSlug}`,
    slug: `nexary-${teamSlug}`,
    metaLaunchUrl: process.env.NEXT_PUBLIC_APP_URL,
    metaDescription: `Nexary Enterprise SSO for ${teamSlug}`,
  });

  // Link provider to application
  await linkProviderToApplication(app.slug, provider.pk);

  return {
    provider,
    application: app,
  };
}

/**
 * Configure Authentik as SAML-to-OIDC bridge
 *
 * This creates a SAML source in Authentik pointing to the customer's IdP,
 * and an OIDC provider that Nexary can use.
 */
export async function setupSAMLToOIDCBridge(
  teamSlug: string,
  customerSamlConfig: {
    idpEntityId: string;
    idpSsoUrl: string;
    idpCert: string;
  }
): Promise<{
  source: AuthentikSAMLSource;
  provider: AuthentikProviderOIDC;
  application: AuthentikApplication;
}> {
  // Step 1: Create SAML source (customer's IdP)
  const source = await createSAMLSource({
    name: `${teamSlug}-saml-idp`,
    slug: `${teamSlug}-saml`,
    ssoUrl: customerSamlConfig.idpSsoUrl,
    entityId: customerSamlConfig.idpEntityId,
  });

  // Step 2: Create OIDC provider (for Nexary)
  // This uses Authentik's internal OIDC
  const provider = await createOIDCProvider({
    name: `${teamSlug}-internal-oidc`,
    clientId: 'nexary-' + teamSlug,
    clientSecret: crypto.randomUUID(),
    issuer: `${AUTHENTIK_API_BASE}/application/o/${teamSlug}/`,
  });

  // Step 3: Create application
  const app = await createApplication({
    name: `Nexary - ${teamSlug}`,
    slug: `nexary-${teamSlug}`,
    metaLaunchUrl: process.env.NEXT_PUBLIC_APP_URL,
  });

  // Step 4: Link provider to application
  await linkProviderToApplication(app.slug, provider.pk);

  return {
    source,
    provider,
    application: app,
  };
}

// ============================================================================
// UTILS
// ============================================================================

import * as crypto from 'crypto';

/**
 * Test Authentik API connection
 */
export async function testAuthentikConnection(): Promise<boolean> {
  try {
    await authentikRequest<{ results: [] }>('core/applications', {
      params: { limit: '1' },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get Authentik version
 */
export async function getAuthentikVersion(): Promise<string | null> {
  try {
    const data = await authentikRequest<{ version: string }>('root');
    return data.version || null;
  } catch {
    return null;
  }
}
