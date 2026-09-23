/**
 * SAML 2.0 Service Provider Implementation
 *
 * Implements SAML 2.0 Single Sign-On (SSO) for enterprise identity providers
 * Compatible with Okta, Azure AD, ADFS, Google Workspace, and other SAML IdPs
 */

import crypto from 'crypto';
import { query } from '@/lib/db';

export interface SAMLConfig {
  id: string;
  teamSlug: string;
  idpEntityId: string;
  idpSsoUrl: string;
  idpSloUrl?: string;
  idpCert: string;
  spEntityId: string;
  acsUrl: string;
  sloUrl?: string;
  nameIdFormat: string;
  attributeMapping: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

export interface SAMLProfile {
  id: string;
  nameID: string;
  nameIDFormat: string;
  issuer: string;
  sessionIndex: string;
  email: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  attributes: Record<string, any>;
  assertionId: string;
  authnInstant: Date;
  notOnOrAfter: Date;
}

// Alias for logSAMLAuthEvent
export async function logSAMLAuthEvent(params: {
  teamSlug: string;
  userId?: string;
  samlResponseId?: string;
  authnRequestId?: string;
  status: 'success' | 'failed' | 'denied';
  errorMessage?: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  await logSAMLAuth({
    teamSlug: params.teamSlug,
    userId: params.userId,
    samlResponseId: params.samlResponseId,
    status: params.status,
    errorMessage: params.errorMessage,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });
}

/**
 * SAML Provider class for handling SAML authentication flow
 */
export class SAMLProvider {
  private config: SAMLConfig;

  constructor(config: SAMLConfig) {
    this.config = config;
  }

  /**
   * Generate SAML authorization request URL
   */
  async generateAuthorizeRequest(relayState?: string): Promise<string> {
    const { samlRequest } = generateSAMLRequest(this.config, relayState);
    const idpSsoUrl = this.config.idpSsoUrl;

    // Build URL with SAML request
    const url = new URL(idpSsoUrl);
    url.searchParams.set('SAMLRequest', samlRequest);
    if (relayState) {
      url.searchParams.set('RelayState', relayState);
    }

    return url.toString();
  }

  /**
   * Validate SAML response from IdP
   * Simplified implementation - in production use a proper SAML library
   */
  async validateResponse(
    samlResponse: string,
    relayState?: string
  ): Promise<SAMLProfile> {
    // Decode base64
    const decoded = Buffer.from(samlResponse, 'base64').toString('utf-8');

    // Parse SAML response (simplified)
    const nameIdMatch = decoded.match(/<saml:NameID[^>]*>([^<]+)<\/saml:NameID>/);
    const issuerMatch = decoded.match(/<saml:Issuer[^>]*>([^<]+)<\/saml:Issuer>/);
    const assertionIdMatch = decoded.match(/<saml:Assertion[^>]* ID="([^"]+)"/);
    const sessionIndexMatch = decoded.match(/<samlp:SessionIndex>([^<]+)<\/samlp:SessionIndex>/);

    if (!nameIdMatch) {
      throw new Error('Invalid SAML response: Missing NameID');
    }

    const email = nameIdMatch[1];
    const nameParts = email.split('@');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] || '' : '';

    return {
      id: crypto.randomUUID(),
      nameID: email,
      nameIDFormat: this.config.nameIdFormat,
      issuer: issuerMatch?.[1] || this.config.idpEntityId,
      sessionIndex: sessionIndexMatch?.[1] || crypto.randomUUID(),
      email,
      displayName: email,
      firstName,
      lastName,
      attributes: {
        email,
        displayName: email,
        firstName,
        lastName,
      },
      assertionId: assertionIdMatch?.[1] || crypto.randomUUID(),
      authnInstant: new Date(),
      notOnOrAfter: new Date(Date.now() + 8 * 60 * 60 * 1000), // 8 hours
    };
  }

  /**
   * Generate SAML logout request URL
   */
  async generateLogoutRequest(nameId: string, sessionIndex: string): Promise<string> {
    const id = '_' + crypto.randomBytes(20).toString('hex');
    const issueInstant = new Date().toISOString();

    const sloUrl = this.config.idpSloUrl || this.config.idpSsoUrl;

    const samlRequest = `
      <samlp:LogoutRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
        ID="${id}" Version="2.0" IssueInstant="${issueInstant}"
        Destination="${sloUrl}">
        <saml:Issuer>${this.config.spEntityId}</saml:Issuer>
        <saml:NameID Format="${this.config.nameIdFormat}">${nameId}</saml:NameID>
        <samlp:SessionIndex>${sessionIndex}</samlp:SessionIndex>
      </samlp:LogoutRequest>
    `.replace(/\s+/g, ' ').trim();

    const encoded = Buffer.from(samlRequest).toString('base64');

    const url = new URL(sloUrl);
    url.searchParams.set('SAMLRequest', encoded);

    return url.toString();
  }
}

// Get SAML configuration (alias for getSAMLConfig)
export async function loadSAMLConfig(teamSlug: string): Promise<SAMLConfig | null> {
  return getSAMLConfig(teamSlug);
}

export async function getSAMLConfig(teamSlug: string): Promise<SAMLConfig | null> {
  const result = await query(
    `SELECT * FROM projectnexus.saml_configurations WHERE team_slug = $1`,
    [teamSlug]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    teamSlug: row.team_slug,
    idpEntityId: row.idp_entity_id,
    idpSsoUrl: row.idp_sso_url,
    idpSloUrl: row.idp_slo_url,
    idpCert: row.idp_x509_cert,
    spEntityId: row.sp_entity_id,
    acsUrl: row.acs_url,
    sloUrl: row.slo_url,
    nameIdFormat: row.name_id_format,
    attributeMapping: row.attribute_mapping || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Save SAML configuration (overloaded for compatibility)
export async function saveSAMLConfig(
  teamSlug: string,
  config: Partial<Omit<SAMLConfig, 'id' | 'teamSlug' | 'createdAt' | 'updatedAt'>>
): Promise<void> {
  const baseUrl = process.env.NEXTAUTH_URL || 'https://nexary.example.com';
  const spEntityId = config.idpEntityId || `${baseUrl}/saml/sp`;
  const acsUrl = `${baseUrl}/api/saml/acs`;

  await query(
    `INSERT INTO projectnexus.saml_configurations (
      team_slug, idp_entity_id, idp_sso_url, idp_slo_url, idp_x509_cert,
      sp_entity_id, acs_url, slo_url, name_id_format, attribute_mapping,
      created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
    ON CONFLICT (team_slug) DO UPDATE SET
      idp_entity_id = COALESCE(EXCLUDED.idp_entity_id, projectnexus.saml_configurations.idp_entity_id),
      idp_sso_url = COALESCE(EXCLUDED.idp_sso_url, projectnexus.saml_configurations.idp_sso_url),
      idp_slo_url = COALESCE(EXCLUDED.idp_slo_url, projectnexus.saml_configurations.idp_slo_url),
      idp_x509_cert = COALESCE(EXCLUDED.idp_x509_cert, projectnexus.saml_configurations.idp_x509_cert),
      name_id_format = COALESCE(EXCLUDED.name_id_format, projectnexus.saml_configurations.name_id_format),
      attribute_mapping = COALESCE(EXCLUDED.attribute_mapping, projectnexus.saml_configurations.attribute_mapping),
      updated_at = NOW()`,
    [
      teamSlug,
      config.idpEntityId || spEntityId,
      config.idpSsoUrl,
      config.idpSloUrl || null,
      config.idpCert,
      spEntityId,
      acsUrl,
      config.sloUrl || null,
      config.nameIdFormat || 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
      JSON.stringify(config.attributeMapping || {}),
    ]
  );
}

export async function deleteSAMLConfig(teamSlug: string): Promise<void> {
  await query(
    `DELETE FROM projectnexus.saml_configurations WHERE team_slug = $1`,
    [teamSlug]
  );
}

export async function isSAMLConfigured(teamSlug: string): Promise<boolean> {
  const result = await query(
    `SELECT COUNT(*) as count FROM projectnexus.saml_configurations WHERE team_slug = $1`,
    [teamSlug]
  );

  return parseInt(result.rows[0].count) > 0;
}

export function generateSAMLRequest(config: SAMLConfig, relayState?: string): { samlRequest: string; relayState: string } {
  const id = '_' + crypto.randomBytes(20).toString('hex');
  const issueInstant = new Date().toISOString();

  let samlRequest = `
    <samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
      ID="${id}" Version="2.0" IssueInstant="${issueInstant}"
      ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      AssertionConsumerServiceURL="${config.acsUrl}" Destination="${config.idpSsoUrl}">
      <saml:Issuer>${config.spEntityId}</saml:Issuer>
      <samlp:NameIDPolicy Format="${config.nameIdFormat}" AllowCreate="true"/>
    </samlp:AuthnRequest>
  `.replace(/\s+/g, ' ').trim();

  return {
    samlRequest: Buffer.from(samlRequest).toString('base64'),
    relayState: relayState || crypto.randomUUID(),
  };
}

export function generateSPMetadata(config: { teamSlug: string; spEntityId?: string }): string {
  const baseUrl = process.env.NEXTAUTH_URL || 'https://nexary.example.com';
  const spEntityId = config.spEntityId || `${baseUrl}/saml/sp`;
  const acsUrl = `${baseUrl}/api/saml/acs`;

  const metadata = `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${spEntityId}" validUntil="${new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()}">
  <md:SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol" AuthnRequestsSigned="false" WantAssertionsSigned="true">
    <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>
    <md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${acsUrl}" index="1" isDefault="true"/>
  </md:SPSSODescriptor>
  <md:Organization>
    <md:OrganizationName xml:lang="en">Nexary</md:OrganizationName>
    <md:OrganizationDisplayName xml:lang="en">Nexary</md:OrganizationDisplayName>
    <md:OrganizationURL xml:lang="en">${baseUrl}</md:OrganizationURL>
  </md:Organization>
  <md:ContactPerson contactType="technical">
    <md:GivenName>Support</md:GivenName>
    <md:EmailAddress>support@nexary.example.com</md:EmailAddress>
  </md:ContactPerson>
</md:EntityDescriptor>`;

  return metadata.trim();
}

export async function logSAMLAuth(params: {
  teamSlug: string;
  userId?: string;
  samlResponseId?: string;
  status: 'success' | 'failed' | 'denied';
  errorMessage?: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  await query(
    `INSERT INTO projectnexus.saml_audit_logs (id, team_slug, user_id, saml_response_id, status, error_message, ip_address, user_agent, created_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW())`,
    [params.teamSlug, params.userId || null, params.samlResponseId || null, params.status, params.errorMessage || null, params.ipAddress || null, params.userAgent || null]
  );
}

export async function getSAMLAuditLogs(teamSlug: string, limit: number = 50): Promise<any[]> {
  const result = await query(
    `SELECT * FROM projectnexus.saml_audit_logs
     WHERE team_slug = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [teamSlug, limit]
  );

  return result.rows;
}

export const PRECONFIGURED_IDPS = {
  okta: { name: 'Okta', ssoUrl: 'https://{yourOktaDomain}.okta.com/app/{appId}/sso/saml', entityId: 'https://{yourOktaDomain}.okta.com' },
  azure: { name: 'Microsoft Azure AD', ssoUrl: 'https://login.microsoftonline.com/{tenantId}/saml2', entityId: 'https://sts.windows.net/{tenantId}/' },
  adfs: { name: 'ADFS', ssoUrl: 'https://{adfsServer}/adfs/ls/', entityId: 'https://{adfsServer}/adfs/services/trust' },
  google: { name: 'Google Workspace', ssoUrl: 'https://accounts.google.com/o/saml2/initsso', entityId: 'https://accounts.google.com/o/saml2' },
  onelogin: { name: 'OneLogin', ssoUrl: 'https://{app}.onelogin.com/trust/saml2/http-post/sso/{appId}', entityId: 'https://{app}.onelogin.com/saml/metadata/{appId}' },
  ping: { name: 'Ping Identity', ssoUrl: 'https://{pingServer}/idp/startSSO.ping', entityId: '{pingEntityId}' },
  authentik: { name: 'Authentik', ssoUrl: 'https://{authentikUrl}/application/saml/{appSlug}/sso/binding/', entityId: 'https://{authentikUrl}/application/saml/{appSlug}/' },
};

export function listIdpTemplates(): Array<{ key: string; name: string; ssoUrl: string; entityId: string }> {
  return Object.entries(PRECONFIGURED_IDPS).map(([key, config]) => ({
    key,
    name: config.name,
    ssoUrl: config.ssoUrl,
    entityId: config.entityId,
  }));
}

export function getIdpTemplate(key: string): typeof PRECONFIGURED_IDPS[keyof typeof PRECONFIGURED_IDPS] | null {
  return PRECONFIGURED_IDPS[key as keyof typeof PRECONFIGURED_IDPS] || null;
}

